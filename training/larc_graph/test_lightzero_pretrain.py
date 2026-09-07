from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import torch

from training.larc_graph.lightzero_checkpoint import (
    PRETRAIN_FORMAT,
    load_pretrain_checkpoint,
    save_pretrain_checkpoint,
)
from training.larc_graph.lightzero_model import LArcStochasticMuZeroModelMLP
from training.larc_graph.pretrain_lightzero_from_legacy import (
    LegacyLightZeroDataset,
    calculate_initial_loss,
    convert_action_slots,
    current_recommendation_score,
    lightzero_observation,
    load_status_score_table,
)
from training.larc_graph.schema import (
    ACTION_FEATURES,
    GLOBAL_FEATURES,
    LIGHTZERO_OBSERVATION,
    MAX_ACTIONS,
    MAX_PERSONS,
    PERSON_FEATURES,
    SCHEMA_VERSION,
    SCORE_SCALE,
    TRAINING_COUNT,
    TRAINING_FEATURES,
)


def set_action(
    action_features: np.ndarray,
    sample: int,
    slot: int,
    train: int,
    *,
    buy_50: bool = False,
    buy_pt: bool = False,
    buy_vital: bool = False,
) -> None:
    action_features[sample, slot, 0] = 1.0
    action_features[sample, slot, 1 + train] = 1.0
    action_features[sample, slot, 11] = float(buy_50)
    action_features[sample, slot, 12] = float(buy_pt)
    action_features[sample, slot, 14] = float(buy_vital)


def tiny_model_settings() -> dict[str, object]:
    return {
        "observation_shape": 12,
        "action_space_size": 4,
        "chance_space_size": 3,
        "latent_state_dim": 8,
        "reward_head_hidden_channels": [4],
        "value_head_hidden_channels": [4],
        "policy_head_hidden_channels": [4],
        "reward_support_range": [-1.0, 1.01, 0.1],
        "value_support_range": [-1.0, 1.01, 0.1],
        "categorical_distribution": True,
        "self_supervised_learning_loss": False,
        "discrete_action_encoding_type": "one_hot",
        "norm_type": "LN",
        "state_norm": True,
        "res_connection_in_dynamics": True,
    }


class TestLegacyConversion(unittest.TestCase):
    def test_dynamic_slots_map_to_semantic_action_ids(self) -> None:
        action_features = np.zeros(
            (1, MAX_ACTIONS, ACTION_FEATURES), dtype=np.float32
        )
        action_mask = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        policy = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        specifications = (
            # slot, train, buy50, buyPt, buyVital, expected ID, mass
            (7, 6, False, False, False, 6, 0.1),
            (2, 2, True, False, False, 12, 0.2),
            (11, 3, False, True, False, 23, 0.3),
            (4, 1, True, False, True, 31, 0.4),
        )
        for slot, train, buy_50, buy_pt, buy_vital, _, mass in specifications:
            set_action(
                action_features,
                0,
                slot,
                train,
                buy_50=buy_50,
                buy_pt=buy_pt,
                buy_vital=buy_vital,
            )
            action_mask[0, slot] = 1.0
            policy[0, slot] = mass

        converted_policy, converted_mask = convert_action_slots(
            action_features, action_mask, policy
        )
        self.assertEqual(converted_policy.shape, (1, 40))
        self.assertEqual(converted_mask.shape, (1, 40))
        for _, _, _, _, _, action_id, mass in specifications:
            self.assertAlmostEqual(
                float(converted_policy[0, action_id]), mass, places=6
            )
            self.assertEqual(float(converted_mask[0, action_id]), 1.0)
        self.assertAlmostEqual(float(converted_policy.sum()), 1.0, places=6)
        self.assertEqual(int(converted_mask.sum()), len(specifications))

    def test_duplicate_semantic_action_is_rejected(self) -> None:
        action_features = np.zeros(
            (1, MAX_ACTIONS, ACTION_FEATURES), dtype=np.float32
        )
        action_mask = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        policy = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        for slot in (0, 3):
            set_action(action_features, 0, slot, 2, buy_50=True)
            action_mask[0, slot] = 1.0
            policy[0, slot] = 0.5
        with self.assertRaisesRegex(ValueError, "multiple legacy slots"):
            convert_action_slots(action_features, action_mask, policy)

    def test_unsupported_friend_purchase_is_rejected(self) -> None:
        action_features = np.zeros(
            (1, MAX_ACTIONS, ACTION_FEATURES), dtype=np.float32
        )
        action_mask = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        policy = np.zeros((1, MAX_ACTIONS), dtype=np.float32)
        set_action(action_features, 0, 0, 2)
        action_features[0, 0, 13] = 1.0
        action_mask[0, 0] = 1.0
        policy[0, 0] = 1.0

        with self.assertRaisesRegex(ValueError, "unsupported buyFriend20"):
            convert_action_slots(action_features, action_mask, policy)

    def test_observation_order_matches_native_flattening(self) -> None:
        global_features = np.arange(GLOBAL_FEATURES, dtype=np.float32)[None]
        person_features = (
            np.arange(MAX_PERSONS * PERSON_FEATURES, dtype=np.float32)
            .reshape(1, MAX_PERSONS, PERSON_FEATURES)
            + 10_000
        )
        training_features = (
            np.arange(TRAINING_COUNT * TRAINING_FEATURES, dtype=np.float32)
            .reshape(1, TRAINING_COUNT, TRAINING_FEATURES)
            + 20_000
        )
        placement = (
            np.arange(TRAINING_COUNT * MAX_PERSONS, dtype=np.float32)
            .reshape(1, TRAINING_COUNT, MAX_PERSONS)
            + 30_000
        )
        observation = lightzero_observation(
            global_features, person_features, training_features, placement
        )
        expected = np.concatenate(
            (
                global_features.reshape(1, -1),
                person_features.reshape(1, -1),
                training_features.reshape(1, -1),
                placement.reshape(1, -1),
            ),
            axis=1,
        ).astype(np.float16)
        self.assertEqual(observation.shape, (1, LIGHTZERO_OBSERVATION))
        np.testing.assert_array_equal(observation, expected)

    def test_reconstructs_current_recommendation_score(self) -> None:
        score_table = np.arange(3_000, dtype=np.int64) * 10
        global_features = np.zeros((1, GLOBAL_FEATURES), dtype=np.float32)
        statuses = np.asarray([10, 20, 30, 40, 50])
        targets = np.asarray([8, 25, 35, 35, 60])
        global_features[0, 40:45] = statuses / 3_000.0
        global_features[0, 50:55] = targets / 3_000.0
        global_features[0, 15] = 100 / 3_000.0
        global_features[0, 16] = 55 / SCORE_SCALE
        # Status: (8 + 20 + 30 + 35 + 50) * 10 = 1430.
        # Skills: 100 * 1.9 + 55 = 245.
        score = current_recommendation_score(global_features, score_table)
        self.assertEqual(float(score[0]), 1_675.0)

    def test_recommendation_score_matches_simulator_float_order(self) -> None:
        score_table = np.zeros(3_000, dtype=np.int64)
        score_table[134] = 100
        global_features = np.zeros((1, GLOBAL_FEATURES), dtype=np.float32)
        global_features[0, 7] = 1.0
        global_features[0, 15] = 30 / 3_000.0
        global_features[0, 40] = 134 / 3_000.0
        global_features[0, 50] = 134 / 3_000.0

        score = current_recommendation_score(global_features, score_table)

        # The native code adds the float skill score to the integer status
        # score before truncating.  Truncating the two parts separately would
        # incorrectly produce 162 here.
        self.assertEqual(float(score[0]), 163.0)

    def test_recommendation_score_rejects_float16_observation(self) -> None:
        with self.assertRaisesRegex(ValueError, "before float16"):
            current_recommendation_score(
                np.zeros((1, GLOBAL_FEATURES), dtype=np.float16),
                np.arange(3_000, dtype=np.int64),
            )

    def test_status_score_table_matches_simulator(self) -> None:
        table = load_status_score_table()
        self.assertEqual(table.shape, (2_801,))
        self.assertEqual(int(table[0]), 0)
        self.assertEqual(int(table[-1]), 14_280)


class TestLegacyDataset(unittest.TestCase):
    def test_npz_is_converted_to_lightzero_targets(self) -> None:
        sample_count = 2
        global_features = np.zeros(
            (sample_count, GLOBAL_FEATURES), dtype=np.float32
        )
        global_features[:, 40:45] = 10 / 3_000.0
        global_features[:, 50:55] = 20 / 3_000.0
        action_features = np.zeros(
            (sample_count, MAX_ACTIONS, ACTION_FEATURES), dtype=np.float32
        )
        action_mask = np.zeros((sample_count, MAX_ACTIONS), dtype=np.float32)
        policy = np.zeros((sample_count, MAX_ACTIONS), dtype=np.float32)
        for sample in range(sample_count):
            set_action(action_features, sample, 0, 4, buy_50=True)
            action_mask[sample, 0] = 1.0
            policy[sample, 0] = 1.0

        # With score_table[x] = x, five statuses at 10 produce current score 50.
        terminal = np.full(sample_count, 5_050.0, dtype=np.float32)
        with tempfile.TemporaryDirectory() as directory:
            shard = Path(directory) / "sample.npz"
            np.savez_compressed(
                shard,
                schema_version=np.asarray(SCHEMA_VERSION, dtype=np.int32),
                global_features=global_features,
                person_features=np.zeros(
                    (sample_count, MAX_PERSONS, PERSON_FEATURES), dtype=np.float32
                ),
                training_features=np.zeros(
                    (sample_count, TRAINING_COUNT, TRAINING_FEATURES),
                    dtype=np.float32,
                ),
                placement=np.zeros(
                    (sample_count, TRAINING_COUNT, MAX_PERSONS), dtype=np.float32
                ),
                action_features=action_features,
                action_mask=action_mask,
                policy_target=policy,
                value_target=terminal,
            )
            dataset = LegacyLightZeroDataset(
                [shard], np.arange(3_000, dtype=np.int64)
            )

        self.assertEqual(len(dataset), sample_count)
        self.assertEqual(dataset.observation.dtype, np.float16)
        self.assertEqual(dataset.observation.shape, (2, LIGHTZERO_OBSERVATION))
        self.assertAlmostEqual(float(dataset.policy_target[0, 14]), 1.0)
        self.assertEqual(int(dataset.action_mask[0, 14]), 1)
        self.assertAlmostEqual(float(dataset.value_target[0]), 0.1, places=6)

    def test_npz_rejects_non_finite_observation(self) -> None:
        sample_count = 2
        global_features = np.zeros(
            (sample_count, GLOBAL_FEATURES), dtype=np.float32
        )
        action_features = np.zeros(
            (sample_count, MAX_ACTIONS, ACTION_FEATURES), dtype=np.float32
        )
        action_mask = np.zeros((sample_count, MAX_ACTIONS), dtype=np.float32)
        policy = np.zeros((sample_count, MAX_ACTIONS), dtype=np.float32)
        for sample in range(sample_count):
            set_action(action_features, sample, 0, 0)
            action_mask[sample, 0] = 1.0
            policy[sample, 0] = 1.0
        person_features = np.zeros(
            (sample_count, MAX_PERSONS, PERSON_FEATURES), dtype=np.float32
        )
        person_features[1, 2, 3] = np.nan

        with tempfile.TemporaryDirectory() as directory:
            shard = Path(directory) / "non-finite.npz"
            np.savez_compressed(
                shard,
                schema_version=np.asarray(SCHEMA_VERSION, dtype=np.int32),
                global_features=global_features,
                person_features=person_features,
                training_features=np.zeros(
                    (sample_count, TRAINING_COUNT, TRAINING_FEATURES),
                    dtype=np.float32,
                ),
                placement=np.zeros(
                    (sample_count, TRAINING_COUNT, MAX_PERSONS), dtype=np.float32
                ),
                action_features=action_features,
                action_mask=action_mask,
                policy_target=policy,
                value_target=np.ones(sample_count, dtype=np.float32),
            )
            with self.assertRaisesRegex(ValueError, "person_features.*non-finite"):
                LegacyLightZeroDataset(
                    [shard], np.arange(3_000, dtype=np.int64)
                )


class TestInitialNetworkTraining(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(7)
        self.settings = tiny_model_settings()
        self.model = LArcStochasticMuZeroModelMLP(**self.settings)

    def test_initial_loss_updates_only_pretrained_components(self) -> None:
        from lzero.policy import DiscreteSupport

        batch = {
            "observation": torch.randn(5, 12),
            "policy_target": torch.nn.functional.one_hot(
                torch.tensor([0, 1, 2, 3, 1]), num_classes=4
            ).float(),
            "action_mask": torch.ones(5, 4, dtype=torch.bool),
            "value_target": torch.tensor([0.1, 0.2, -0.1, 0.3, 0.0]),
        }
        support = DiscreteSupport(*self.settings["value_support_range"])
        optimizer = torch.optim.Adam(self.model.parameters(), lr=1e-3)
        # LightZero zero-initializes the final policy/value linear layers.  The
        # first update opens those heads; the second propagates into the shared
        # prediction trunk and representation network.
        for _ in range(2):
            optimizer.zero_grad(set_to_none=True)
            loss, _ = calculate_initial_loss(
                self.model,
                batch,
                support,
                policy_loss_weight=1.0,
                value_loss_weight=0.5,
            )
            loss.backward()
            optimizer.step()
        representation_grad = sum(
            float(parameter.grad.abs().sum())
            for parameter in self.model.representation_network.parameters()
            if parameter.grad is not None
        )
        prediction_grad = sum(
            float(parameter.grad.abs().sum())
            for parameter in self.model.prediction_network.parameters()
            if parameter.grad is not None
        )
        dynamics_grads = [
            parameter.grad
            for parameter in self.model.dynamics_network.parameters()
        ]
        self.assertGreater(representation_grad, 0.0)
        self.assertGreater(prediction_grad, 0.0)
        self.assertTrue(all(gradient is None for gradient in dynamics_grads))

    def test_saved_model_loads_as_strict_warm_start(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(
                path,
                self.model,
                self.settings,
                metadata={"source": "unit-test"},
            )
            raw = torch.load(path, map_location="cpu", weights_only=True)
            self.assertEqual(raw["format"], PRETRAIN_FORMAT)
            restored = LArcStochasticMuZeroModelMLP(**self.settings)
            result = load_pretrain_checkpoint(path, restored, self.settings)

        self.assertEqual(result["metadata"], {"source": "unit-test"})
        for expected, actual in zip(
            self.model.state_dict().values(), restored.state_dict().values()
        ):
            torch.testing.assert_close(actual, expected)


if __name__ == "__main__":
    unittest.main()
