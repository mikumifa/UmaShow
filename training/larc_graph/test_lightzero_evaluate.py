from __future__ import annotations

import argparse
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from training.larc_graph.evaluate_lightzero import (
    load_manifest,
    opening_options,
    pair_rows,
    paired_comparison,
    resolve_search_chance_space,
    stable_load_checkpoint,
    validate_args,
    validate_lightzero_action,
    validate_native_state_response,
)
from training.larc_graph.schema import (
    LEARNED_CHANCE_GRADIENT,
    LIGHTZERO_ACTIONS,
    LIGHTZERO_CHANCE_SEARCH,
    LIGHTZERO_COMMIT,
    LIGHTZERO_MANIFEST,
    LIGHTZERO_MODEL_FAMILY,
    LIGHTZERO_OBSERVATION,
    SCENARIO_ID,
    SCHEMA_VERSION,
    SCORE_SCALE,
)
from training.larc_graph.train_lightzero import TOTAL_TURNS, model_config


def opening(seed: int) -> dict[str, object]:
    return {
        "seed": seed,
        "umaId": 1001,
        "umaStars": 5,
        "cards": [1, 2, 3, 4, 5, 6],
        "blueInheritance": [3, 3, 3, 3, 3],
        "extraInheritance": [],
        "targets": [1200, 1000, 1100, 900, 1000],
    }


def compatible_manifest() -> dict[str, object]:
    return {
        "formatVersion": 1,
        "algorithm": "stochastic_muzero",
        "modelFamily": LIGHTZERO_MODEL_FAMILY,
        "graphSchema": SCHEMA_VERSION,
        "scenarioId": SCENARIO_ID,
        "scoreScale": SCORE_SCALE,
        "learnedChanceGradient": LEARNED_CHANCE_GRADIENT,
        "observationFeatures": LIGHTZERO_OBSERVATION,
        "actionSpaceSize": LIGHTZERO_ACTIONS,
        "lightZeroCommit": LIGHTZERO_COMMIT,
        "model": model_config(
            argparse.Namespace(chance_space_size=32, latent_state_dim=256)
        ),
    }


def native_response(
    *,
    turn: int,
    recommendation_score: int,
    reward: float,
    episode_return: float,
    done: bool = False,
) -> dict[str, object]:
    mask = [0] * LIGHTZERO_ACTIONS
    action_ids: list[int] = []
    if not done:
        mask[3] = 1
        action_ids = [3]
    return {
        "type": "environment",
        "scenarioId": SCENARIO_ID,
        "turn": turn,
        "observation": [0.0] * LIGHTZERO_OBSERVATION,
        "actionMask": mask,
        "actionIds": action_ids,
        "toPlay": -1,
        "reward": reward,
        "episodeReturn": episode_return,
        "done": done,
        "recommendationScore": recommendation_score,
        "finalScore": recommendation_score,
        "scoreScale": SCORE_SCALE,
    }


def validation_args(root: Path) -> argparse.Namespace:
    checkpoint = root / "run" / "ckpt" / "iteration_1.pth.tar"
    checkpoint.parent.mkdir(parents=True)
    executable = root / "native"
    database = root / "database.json"
    for path in (checkpoint, executable, database):
        path.touch()
    return argparse.Namespace(
        games=1,
        seed=1,
        lightzero_envs=1,
        simulations=1,
        chance_search_space=0,
        builtin_workers=1,
        threads=1,
        builtin_searches=1,
        radical_factor=3.0,
        tie_margin=0,
        target_speed=0,
        target_stamina=0,
        target_power=0,
        target_guts=0,
        target_wisdom=0,
        checkpoint=checkpoint,
        executable=executable,
        database=database,
        output=None,
    )


class LightZeroEvaluationTest(unittest.TestCase):
    def test_old_manifest_uses_historical_two_outcome_search(self) -> None:
        manifest = {"model": {"chance_space_size": 32}}
        size, warnings = resolve_search_chance_space(manifest, 0)
        self.assertEqual(size, 2)
        self.assertTrue(warnings)

    def test_patched_manifest_uses_full_model_chance_space(self) -> None:
        manifest = {
            "chanceSearch": LIGHTZERO_CHANCE_SEARCH,
            "model": {"chance_space_size": 32},
        }
        size, warnings = resolve_search_chance_space(manifest, 0)
        self.assertEqual(size, 32)
        self.assertEqual(warnings, [])

    def test_old_manifest_override_is_marked_diagnostic(self) -> None:
        manifest = {"model": {"chance_space_size": 32}}
        size, warnings = resolve_search_chance_space(manifest, 32)
        self.assertEqual(size, 32)
        self.assertTrue(any("diagnostic" in warning for warning in warnings))

    def test_unknown_chance_search_is_rejected_even_with_override(self) -> None:
        manifest = {
            "chanceSearch": "unknown",
            "model": {"chance_space_size": 32},
        }
        with self.assertRaisesRegex(ValueError, "unsupported manifest chanceSearch"):
            resolve_search_chance_space(manifest, 2)

    def test_manifest_semantics_are_checked(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checkpoint = root / "ckpt" / "iteration_1.pth.tar"
            checkpoint.parent.mkdir()
            checkpoint.touch()
            manifest = compatible_manifest()
            (root / LIGHTZERO_MANIFEST).write_text(
                json.dumps(manifest),
                encoding="utf-8",
            )
            path, loaded = load_manifest(checkpoint)
            self.assertEqual(path, root / LIGHTZERO_MANIFEST)
            self.assertEqual(loaded, manifest)

            manifest["graphSchema"] = "wrong"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "graphSchema"):
                load_manifest(checkpoint)

    def test_seed_range_and_output_collision_are_checked(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            args = validation_args(Path(directory))
            args.seed = -1
            with self.assertRaisesRegex(ValueError, "--seed"):
                validate_args(args)

            args.seed = 1
            args.output = args.checkpoint
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                validate_args(args)

    def test_opening_options_share_targets_with_builtin(self) -> None:
        args = argparse.Namespace(
            no_random_targets=True,
            target_speed=1200,
            target_stamina=0,
            target_power=1100,
            target_guts=0,
            target_wisdom=900,
        )
        self.assertEqual(
            opening_options(args),
            {
                "randomizeTargets": False,
                "targetSpeed": 1200,
                "targetPower": 1100,
                "targetWisdom": 900,
            },
        )

    def test_pair_rows_checks_opening_and_score_deltas(self) -> None:
        shared = opening(77)
        lightzero = {
            0: {
                "index": 0,
                "seed": 10,
                "opening": shared,
                "recommendationScore": 12_000,
                "finalScore": 13_000,
                "decisions": TOTAL_TURNS,
            }
        }
        builtin = {
            0: {
                "index": 0,
                "seed": 10,
                "opening": shared,
                "openingSeed": 77,
                "recommendationScore": 11_500,
                "finalScore": 12_800,
                "decisions": TOTAL_TURNS,
            }
        }
        rows = pair_rows(lightzero, builtin)
        self.assertEqual(rows[0]["delta"]["recommendationScore"], 500)
        self.assertEqual(rows[0]["delta"]["finalScore"], 200)

    def test_pair_rows_rejects_seed_or_opening_mismatch(self) -> None:
        shared = opening(77)
        lightzero = {
            0: {
                "seed": 10,
                "opening": shared,
                "recommendationScore": 12_000,
                "finalScore": 13_000,
                "decisions": TOTAL_TURNS,
            }
        }
        builtin = {
            0: {
                "seed": 11,
                "opening": shared,
                "openingSeed": 77,
                "recommendationScore": 11_500,
                "finalScore": 12_800,
                "decisions": TOTAL_TURNS,
            }
        }
        with self.assertRaisesRegex(RuntimeError, "requested seeds"):
            pair_rows(lightzero, builtin)

        builtin[0]["seed"] = 10
        builtin[0]["openingSeed"] = 78
        with self.assertRaisesRegex(RuntimeError, "opening seeds"):
            pair_rows(lightzero, builtin)

        builtin[0]["openingSeed"] = 77
        builtin[0]["decisions"] = TOTAL_TURNS - 1
        with self.assertRaisesRegex(RuntimeError, "decisions per policy"):
            pair_rows(lightzero, builtin)

    def test_illegal_lightzero_actions_are_rejected(self) -> None:
        mask = np.zeros(LIGHTZERO_ACTIONS, dtype=np.int8)
        mask[3] = 1
        validate_lightzero_action(3, mask, 7)
        for action in (-1, 2, LIGHTZERO_ACTIONS):
            with self.subTest(action=action):
                with self.assertRaisesRegex(RuntimeError, "illegal action"):
                    validate_lightzero_action(action, mask, 7)

    def test_native_environment_protocol_is_checked(self) -> None:
        reset = native_response(
            turn=0,
            recommendation_score=1_000,
            reward=0.0,
            episode_return=0.0,
        )
        reset["opening"] = opening(77)
        validate_native_state_response(reset, game_index=0, phase="reset")

        step = native_response(
            turn=1,
            recommendation_score=1_500,
            reward=0.01,
            episode_return=0.01,
        )
        step["action"] = 3
        step["actionLabel"] = "speed"
        validate_native_state_response(
            step,
            game_index=0,
            phase="step",
            previous=reset,
            requested_action=3,
        )

        step["scoreScale"] = 1
        with self.assertRaisesRegex(RuntimeError, "scoreScale"):
            validate_native_state_response(
                step,
                game_index=0,
                phase="step",
                previous=reset,
                requested_action=3,
            )

    def test_full_checkpoint_envelope_is_required(self) -> None:
        import torch

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "checkpoint.pth.tar"
            state = {"weight": torch.tensor([1.0])}
            torch.save(
                {
                    "model": state,
                    "target_model": {"weight": torch.tensor([1.0])},
                    "optimizer": {"state": {}, "param_groups": []},
                    "last_iter": 1,
                    "last_step": 2,
                },
                path,
            )
            checkpoint, digest = stable_load_checkpoint(path)
            self.assertEqual(checkpoint["last_iter"], 1)
            self.assertEqual(len(digest), 64)

            torch.save(
                {
                    "model": state,
                    "target_model": {"weight": torch.tensor([1.0])},
                    "optimizer": {"state": {}, "param_groups": []},
                },
                path,
            )
            final_checkpoint, _ = stable_load_checkpoint(path)
            self.assertNotIn("last_iter", final_checkpoint)

            torch.save({"model": state}, path)
            with self.assertRaisesRegex(ValueError, "full LightZero"):
                stable_load_checkpoint(path)

    def test_constant_median_interval_is_explicit(self) -> None:
        rows = [
            {
                "lightzero": {"recommendationScore": 10_100},
                "builtin": {"recommendationScore": 10_000},
            }
            for _ in range(3)
        ]
        result = paired_comparison(rows, "recommendationScore", 0, 123)
        self.assertEqual(result["medianDelta95Ci"], [100.0, 100.0])
        self.assertEqual(result["medianDelta95CiMethod"], "constant")
        self.assertEqual(result["bootstrapResamples"], 0)

    def test_paired_statistics_use_paired_differences(self) -> None:
        deltas = [500, 300, -100, 0, 700]
        rows = [
            {
                "lightzero": {
                    "recommendationScore": 10_000 + delta,
                },
                "builtin": {"recommendationScore": 10_000},
            }
            for delta in deltas
        ]
        result = paired_comparison(rows, "recommendationScore", 0, 123)
        self.assertEqual(result["lightzeroWins"], 3)
        self.assertEqual(result["builtinWins"], 1)
        self.assertEqual(result["ties"], 1)
        self.assertAlmostEqual(result["delta"]["mean"], 280.0)
        low, high = result["meanDelta95CiT"]
        self.assertLess(low, 280.0)
        self.assertGreater(high, 280.0)


if __name__ == "__main__":
    unittest.main()
