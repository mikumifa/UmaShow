from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics
import sys
import time
import warnings as python_warnings
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Any, Mapping

import numpy as np
from scipy.stats import binomtest, bootstrap, t as student_t


os.environ.setdefault("PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION", "python")

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from training.larc_graph.evaluate_legacy import (
    OPENING_KEYS,
    STATUS_NAMES,
    SimulatorWorker,
    common_options,
    describe,
    sha256,
)
from training.larc_graph.lightzero_runtime import (
    CHANCE_SEARCH_PATCH,
    configure_stochastic_muzero_chance_space,
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
from training.larc_graph.train_lightzero import (
    RECOMMENDATION_EXECUTABLE,
    TOTAL_TURNS,
    build_config,
    model_config,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate a LightZero Stochastic MuZero checkpoint against the "
            "native Monte Carlo policy with hand-written rollouts on paired openings"
        )
    )
    parser.add_argument(
        "checkpoint",
        type=Path,
        help="full LightZero training checkpoint under an experiment ckpt directory",
    )
    parser.add_argument(
        "--games",
        type=int,
        default=100,
        help="number of paired openings to evaluate",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20261001,
        help="held-out base seed; each paired game uses seed + game index",
    )
    parser.add_argument(
        "--lightzero-envs",
        type=int,
        default=8,
        help="native environments batched into each LightZero inference step",
    )
    parser.add_argument(
        "--simulations",
        type=int,
        default=64,
        help="LightZero latent MCTS simulations per decision",
    )
    parser.add_argument(
        "--chance-search-space",
        type=int,
        default=0,
        help=(
            "override MCTS chance outcomes; zero follows the manifest and uses "
            "the historical upstream default of 2 for old manifests"
        ),
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="auto, cpu, cuda, or a concrete CUDA device such as cuda:1",
    )
    parser.add_argument(
        "--no-ctree",
        action="store_true",
        help="use the slower Python MCTS tree instead of the default C++ tree",
    )
    parser.add_argument(
        "--builtin-workers",
        type=int,
        default=min(4, os.cpu_count() or 1),
        help="parallel native processes used for the builtin baseline",
    )
    parser.add_argument(
        "--builtin-threads",
        "--threads",
        dest="threads",
        type=int,
        default=1,
        help="rollout threads inside each builtin baseline process",
    )
    parser.add_argument(
        "--builtin-searches",
        type=int,
        default=128,
        help=(
            "full simulator rollouts per legal root action; not numerically "
            "equivalent to LightZero --simulations"
        ),
    )
    parser.add_argument(
        "--radical-factor",
        type=float,
        default=3.0,
        help="maximum risk-seeking adjustment used by the builtin baseline",
    )
    parser.add_argument(
        "--no-random-targets",
        action="store_true",
        help="disable randomized recommendation-score target caps",
    )
    for status in STATUS_NAMES:
        parser.add_argument(
            f"--target-{status}",
            type=int,
            default=0,
            help=f"fixed displayed {status} target cap; zero leaves it unset",
        )
    parser.add_argument(
        "--tie-margin",
        type=int,
        default=0,
        help="score differences within this absolute margin count as practical ties",
    )
    parser.add_argument(
        "--include-actions",
        action="store_true",
        help="include the LightZero action ID/label trajectory in the JSON output",
    )
    parser.add_argument("--output", type=Path, help="optional full JSON result")
    parser.add_argument(
        "--executable",
        type=Path,
        default=REPOSITORY_ROOT / "assets/native" / RECOMMENDATION_EXECUTABLE,
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=REPOSITORY_ROOT / "assets/data/monte_carlo.json",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if args.games <= 0:
        raise ValueError("--games must be positive")
    if not 0 <= args.seed <= 0xFFFFFFFFFFFFFFFF:
        raise ValueError("--seed must be between 0 and 2^64-1")
    if not 1 <= args.lightzero_envs <= 32:
        raise ValueError("--lightzero-envs must be between 1 and 32")
    if not 1 <= args.simulations <= 8_192:
        raise ValueError("--simulations must be between 1 and 8192")
    if not 0 <= args.chance_search_space <= 1_024:
        raise ValueError("--chance-search-space must be between 0 and 1024")
    if not 1 <= args.builtin_workers <= 32:
        raise ValueError("--builtin-workers must be between 1 and 32")
    if not 1 <= args.threads <= 32:
        raise ValueError("--builtin-threads must be between 1 and 32")
    if not 1 <= args.builtin_searches <= 65_536:
        raise ValueError("--builtin-searches must be between 1 and 65536")
    if not 0.0 <= args.radical_factor <= 20.0:
        raise ValueError("--radical-factor must be between 0 and 20")
    if args.tie_margin < 0:
        raise ValueError("--tie-margin cannot be negative")
    for status in STATUS_NAMES:
        value = int(getattr(args, f"target_{status}"))
        if not 0 <= value <= 3_000:
            raise ValueError(f"--target-{status} must be between 0 and 3000")

    args.checkpoint = args.checkpoint.resolve()
    args.executable = args.executable.resolve()
    args.database = args.database.resolve()
    if args.output is not None:
        args.output = args.output.resolve()
    if not args.checkpoint.is_file():
        raise FileNotFoundError(f"checkpoint not found: {args.checkpoint}")
    if not args.executable.is_file():
        raise FileNotFoundError(
            f"recommendation executable not found: {args.executable}"
        )
    if not args.database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {args.database}")
    if args.output is not None:
        protected_paths = {
            args.checkpoint,
            args.checkpoint.parent.parent / LIGHTZERO_MANIFEST,
            args.executable,
            args.database,
        }
        if args.output in protected_paths:
            raise ValueError("--output must not overwrite an evaluation input file")
        if args.output.is_dir():
            raise ValueError("--output must be a file path, not a directory")


def load_manifest(checkpoint: Path) -> tuple[Path, dict[str, Any]]:
    path = checkpoint.parent.parent / LIGHTZERO_MANIFEST
    if not path.is_file():
        raise FileNotFoundError(
            f"LightZero model manifest not found next to checkpoint: {path}"
        )
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("LightZero model manifest must be a JSON object")
    expected = {
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
    }
    differences = [
        key for key, value in expected.items() if manifest.get(key) != value
    ]
    if differences:
        raise ValueError(
            "checkpoint manifest is incompatible with this evaluator: "
            + ", ".join(differences)
        )
    settings = manifest.get("model")
    if not isinstance(settings, dict):
        raise ValueError("checkpoint manifest does not contain model settings")
    try:
        chance_space_size = int(settings["chance_space_size"])
        latent_state_dim = int(settings["latent_state_dim"])
    except (KeyError, TypeError, ValueError) as exception:
        raise ValueError(
            "checkpoint manifest has invalid chance_space_size or latent_state_dim"
        ) from exception
    canonical_model = model_config(
        argparse.Namespace(
            chance_space_size=chance_space_size,
            latent_state_dim=latent_state_dim,
        )
    )
    model_differences = sorted(
        key
        for key in set(settings) | set(canonical_model)
        if settings.get(key) != canonical_model.get(key)
    )
    if model_differences:
        raise ValueError(
            "checkpoint manifest has incompatible model semantics: "
            + ", ".join(model_differences)
        )
    return path, manifest


def resolve_search_chance_space(
    manifest: Mapping[str, Any], override: int
) -> tuple[int, list[str]]:
    model = manifest.get("model")
    if not isinstance(model, Mapping):
        raise ValueError("checkpoint manifest does not contain model settings")
    model_size = int(model.get("chance_space_size", 0))
    if model_size <= 0:
        raise ValueError("checkpoint manifest has an invalid chance_space_size")
    warnings: list[str] = []
    search_patch = manifest.get("chanceSearch")
    if search_patch is not None and search_patch != LIGHTZERO_CHANCE_SEARCH:
        raise ValueError(f"unsupported manifest chanceSearch: {search_patch}")
    historical_size = min(2, model_size)

    if override > 0:
        if override > model_size:
            raise ValueError(
                "--chance-search-space cannot exceed the model chance_space_size"
            )
        if search_patch is None and override != historical_size:
            warnings.append(
                "manifest predates the configured-chance-root fix; overriding "
                f"its historical {historical_size}-outcome MCTS with {override} "
                "outcomes for a diagnostic evaluation"
            )
        elif search_patch is None:
            warnings.append(
                "manifest predates the configured-chance-root fix; evaluating the "
                f"checkpoint with its historical {historical_size}-outcome MCTS behavior"
            )
        elif override != model_size:
            warnings.append(
                f"MCTS is restricted to {override} of the model's {model_size} chance outcomes"
            )
        return override, warnings

    if search_patch is None:
        warnings.append(
            "manifest predates the configured-chance-root fix; evaluating the "
            f"checkpoint with its historical {historical_size}-outcome MCTS behavior"
        )
        return historical_size, warnings
    return model_size, warnings


def stable_load_checkpoint(path: Path) -> tuple[dict[str, Any], str]:
    import torch

    last_error: BaseException | None = None
    for _ in range(3):
        before = path.stat()
        try:
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
            digest = sha256(path)
        except BaseException as exception:
            last_error = exception
            time.sleep(0.1)
            continue
        after = path.stat()
        if (
            before.st_size == after.st_size
            and before.st_mtime_ns == after.st_mtime_ns
        ):
            if not isinstance(checkpoint, dict):
                raise ValueError("LightZero checkpoint must be a dictionary")
            required_fields = {
                "model",
                "target_model",
                "optimizer",
            }
            missing_fields = sorted(required_fields - set(checkpoint))
            if missing_fields:
                raise ValueError(
                    "checkpoint is not a full LightZero training checkpoint; "
                    "missing fields: " + ", ".join(missing_fields)
                )
            state = checkpoint.get("model")
            if not isinstance(state, Mapping) or not state:
                raise ValueError("checkpoint does not contain model weights")
            if any(not isinstance(key, str) for key in state):
                raise ValueError("checkpoint model keys must be strings")
            if any(not isinstance(value, torch.Tensor) for value in state.values()):
                raise ValueError("checkpoint model values must be tensors")
            non_finite = [
                key
                for key, value in state.items()
                if value.is_floating_point() and not torch.isfinite(value).all()
            ]
            if non_finite:
                raise ValueError(
                    "checkpoint contains non-finite model tensors: "
                    + ", ".join(non_finite[:8])
                )
            target_state = checkpoint.get("target_model")
            if not isinstance(target_state, Mapping) or not target_state:
                raise ValueError("checkpoint does not contain target model weights")
            if set(target_state) != set(state):
                raise ValueError("checkpoint target model keys differ from model keys")
            invalid_target = [
                key
                for key, value in target_state.items()
                if not isinstance(key, str)
                or not isinstance(value, torch.Tensor)
                or value.shape != state[key].shape
                or value.dtype != state[key].dtype
                or (
                    value.is_floating_point()
                    and not torch.isfinite(value).all()
                )
            ]
            if invalid_target:
                raise ValueError(
                    "checkpoint contains incompatible target model tensors: "
                    + ", ".join(invalid_target[:8])
                )
            optimizer = checkpoint.get("optimizer")
            if not isinstance(optimizer, Mapping) or not optimizer:
                raise ValueError("checkpoint does not contain optimizer state")
            has_last_iter = "last_iter" in checkpoint
            has_last_step = "last_step" in checkpoint
            if has_last_iter != has_last_step:
                raise ValueError(
                    "checkpoint must contain both last_iter and last_step or neither"
                )
            if has_last_iter:
                for counter in ("last_iter", "last_step"):
                    value = checkpoint.get(counter)
                    if type(value) is not int or value < 0:
                        raise ValueError(
                            f"checkpoint {counter} must be a non-negative integer"
                        )
            return checkpoint, digest
        last_error = RuntimeError("checkpoint changed while it was being read")
        time.sleep(0.1)
    raise RuntimeError(f"could not read a stable checkpoint snapshot: {path}") from last_error


def stable_file_sha256(path: Path) -> str:
    last_error: BaseException | None = None
    for _ in range(3):
        try:
            before = path.stat()
            digest = sha256(path)
            after = path.stat()
        except BaseException as exception:
            last_error = exception
            time.sleep(0.1)
            continue
        if (
            before.st_size == after.st_size
            and before.st_mtime_ns == after.st_mtime_ns
        ):
            return digest
        last_error = RuntimeError(f"artifact changed while hashing: {path}")
        time.sleep(0.1)
    raise RuntimeError(f"could not hash a stable artifact: {path}") from last_error


def verify_artifacts_unchanged(
    artifacts: Mapping[Path, str],
    phase: str,
) -> None:
    changed = [
        str(path)
        for path, expected_digest in artifacts.items()
        if stable_file_sha256(path) != expected_digest
    ]
    if changed:
        raise RuntimeError(
            f"evaluation inputs changed during {phase}: " + ", ".join(changed)
        )


def choose_device(requested: str) -> "Any":
    import torch

    if requested == "auto":
        requested = "cuda" if torch.cuda.is_available() else "cpu"
    device = torch.device(requested)
    if device.type not in {"cpu", "cuda"}:
        raise ValueError("--device must be auto, cpu, cuda, or cuda:N")
    if device.type == "cpu":
        return torch.device("cpu")
    if device.type == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is unavailable")
    if device.type == "cuda":
        index = device.index
        if index is None:
            index = torch.cuda.current_device()
        torch.cuda.set_device(index)
        device = torch.device("cuda", index)
    return device


def build_policy(
    args: argparse.Namespace,
    model_settings: Mapping[str, Any],
    model_state: Mapping[str, Any],
    search_chance_space: int,
) -> tuple[Any, Any, Any]:
    import torch
    from easydict import EasyDict
    from lzero.policy import DiscreteSupport, InverseScalarTransform
    from lzero.policy.stochastic_muzero import StochasticMuZeroPolicy

    from training.larc_graph.lightzero_model import LArcStochasticMuZeroModelMLP

    device = choose_device(args.device)
    random.seed(args.seed)
    np.random.seed(args.seed & 0xFFFFFFFF)
    torch.manual_seed(args.seed)
    if device.type == "cuda":
        torch.cuda.manual_seed_all(args.seed)

    configure_stochastic_muzero_chance_space(search_chance_space)
    settings = dict(model_settings)
    if int(settings.get("frame_stack_num", 0)) != 1:
        raise ValueError(
            "this evaluator requires checkpoint model.frame_stack_num == 1"
        )
    model = LArcStochasticMuZeroModelMLP(**settings)
    model.load_state_dict(model_state, strict=True)

    config_args = argparse.Namespace(
        experiment_dir=REPOSITORY_ROOT / "training/larc_graph/runs/evaluate-lightzero",
        executable=args.executable,
        database=args.database,
        no_random_targets=args.no_random_targets,
        collector_envs=args.lightzero_envs,
        evaluator_envs=args.lightzero_envs,
        simulations=args.simulations,
        updates_per_collect=1,
        batch_size=1,
        replay_buffer_size=1,
        reanalyze_ratio=0.0,
        chance_space_size=int(settings["chance_space_size"]),
        latent_state_dim=int(settings["latent_state_dim"]),
        learning_rate=0.001,
        eval_freq=1,
        cpu=device.type == "cpu",
        no_ctree=args.no_ctree,
        checkpoint_every=1,
    )
    main_config, _ = build_config(config_args)
    policy_config = StochasticMuZeroPolicy.default_config()
    default_model_config = EasyDict(policy_config.model)
    policy_config.update(EasyDict(main_config.policy))
    # ``build_config`` contains only the fields used by UmaShow's custom
    # model.  Keep LightZero's remaining model defaults as well: the pinned
    # policy reads a few of them directly during inference and destruction.
    default_model_config.update(settings)
    policy_config.model = default_model_config
    policy_config.cuda = device.type == "cuda"
    policy_config.device = str(device)
    policy_config.num_simulations = args.simulations
    policy_config.mcts_ctree = not args.no_ctree

    # Upstream _forward_eval currently reads _collect_model, so collect mode is
    # needed even though action selection uses only eval mode.  Initializing the
    # learner would allocate an optimizer and target model unnecessarily.
    policy = StochasticMuZeroPolicy(
        policy_config,
        model=model,
        enable_field=["collect", "eval"],
    )
    parameter_device = next(model.parameters()).device
    if parameter_device != device:
        raise RuntimeError(
            f"LightZero placed the model on {parameter_device}, expected {device}"
        )
    value_support = DiscreteSupport(
        *settings["value_support_range"], device=str(device)
    )
    policy.value_support = value_support
    policy.value_inverse_scalar_transform_handle = InverseScalarTransform(
        value_support,
        bool(settings["categorical_distribution"]),
    )
    policy.eval_mode.load_state_dict({"model": model_state})
    return policy, policy_config, device


def opening_options(args: argparse.Namespace) -> dict[str, Any]:
    options: dict[str, Any] = {
        "randomizeTargets": not args.no_random_targets,
    }
    for status in STATUS_NAMES:
        value = int(getattr(args, f"target_{status}"))
        if value > 0:
            options[f"target{status.title()}"] = value
    return options


def validate_lightzero_action(
    action: int,
    action_mask: np.ndarray,
    game_index: int,
) -> None:
    mask = np.asarray(action_mask)
    if mask.shape != (LIGHTZERO_ACTIONS,):
        raise RuntimeError(
            f"game {game_index} has action mask shape {mask.shape}, "
            f"expected {(LIGHTZERO_ACTIONS,)}"
        )
    if action < 0 or action >= LIGHTZERO_ACTIONS or int(mask[action]) != 1:
        raise RuntimeError(
            f"LightZero selected illegal action {action} for game {game_index}"
        )


def validate_native_state_response(
    response: Mapping[str, Any],
    *,
    game_index: int,
    phase: str,
    previous: Mapping[str, Any] | None = None,
    requested_action: int | None = None,
) -> None:
    required = {
        "type",
        "scenarioId",
        "turn",
        "observation",
        "actionMask",
        "actionIds",
        "toPlay",
        "reward",
        "episodeReturn",
        "done",
        "recommendationScore",
        "finalScore",
        "scoreScale",
    }
    missing = sorted(required - set(response))
    if missing:
        raise RuntimeError(
            f"native {phase} response for game {game_index} is missing: "
            + ", ".join(missing)
        )
    if response.get("type") != "environment":
        raise RuntimeError(f"native {phase} returned an unexpected response type")
    if response.get("scenarioId") != SCENARIO_ID:
        raise RuntimeError(f"native {phase} returned an unexpected scenarioId")
    if response.get("toPlay") != -1:
        raise RuntimeError(f"native {phase} returned an unexpected toPlay value")

    score_scale = response.get("scoreScale")
    if isinstance(score_scale, bool) or not isinstance(score_scale, (int, float)):
        raise RuntimeError(f"native {phase} returned an invalid scoreScale")
    if not math.isclose(float(score_scale), SCORE_SCALE, rel_tol=0.0, abs_tol=0.0):
        raise RuntimeError(f"native {phase} returned an unexpected scoreScale")

    turn = response.get("turn")
    if type(turn) is not int or turn < 0:
        raise RuntimeError(f"native {phase} returned an invalid turn")
    done = response.get("done")
    if type(done) is not bool:
        raise RuntimeError(f"native {phase} returned an invalid done flag")
    for key in ("recommendationScore", "finalScore"):
        if type(response.get(key)) is not int:
            raise RuntimeError(f"native {phase} returned an invalid {key}")
    for key in ("reward", "episodeReturn"):
        value = response.get(key)
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
        ):
            raise RuntimeError(f"native {phase} returned an invalid {key}")

    try:
        observation = np.asarray(response["observation"], dtype=np.float64)
        raw_action_mask = np.asarray(response["actionMask"], dtype=np.float64)
    except (TypeError, ValueError) as exception:
        raise RuntimeError(
            f"native {phase} returned malformed observation data"
        ) from exception
    if observation.shape != (LIGHTZERO_OBSERVATION,) or not np.isfinite(
        observation
    ).all():
        raise RuntimeError(f"native {phase} returned an invalid observation")
    if raw_action_mask.shape != (LIGHTZERO_ACTIONS,) or not np.isin(
        raw_action_mask, (0.0, 1.0)
    ).all():
        raise RuntimeError(f"native {phase} returned an invalid action mask")
    action_mask = raw_action_mask.astype(np.int8)

    action_ids = response.get("actionIds")
    if (
        not isinstance(action_ids, list)
        or any(type(action) is not int for action in action_ids)
        or len(action_ids) != len(set(action_ids))
    ):
        raise RuntimeError(f"native {phase} returned invalid action IDs")
    expected_action_ids = np.flatnonzero(action_mask).tolist()
    if sorted(action_ids) != expected_action_ids:
        raise RuntimeError(f"native {phase} action IDs do not match its action mask")
    if done and action_ids:
        raise RuntimeError(f"terminal native {phase} response still has legal actions")
    if not done and not action_ids:
        raise RuntimeError(f"non-terminal native {phase} response has no legal actions")

    if phase == "reset":
        if previous is not None or requested_action is not None:
            raise RuntimeError("reset validation received step-only context")
        if turn != 0 or done:
            raise RuntimeError("native reset did not produce an active turn-zero state")
        if not math.isclose(float(response["reward"]), 0.0, abs_tol=0.0):
            raise RuntimeError("native reset returned a non-zero reward")
        if not math.isclose(float(response["episodeReturn"]), 0.0, abs_tol=0.0):
            raise RuntimeError("native reset returned a non-zero episode return")
        if not isinstance(response.get("opening"), Mapping):
            raise RuntimeError("native reset response is missing opening metadata")
        return

    if phase != "step" or previous is None or requested_action is None:
        raise RuntimeError("native response validation received invalid phase context")
    if response.get("action") != requested_action:
        raise RuntimeError("native step did not echo the requested action")
    if not isinstance(response.get("actionLabel"), str):
        raise RuntimeError("native step returned an invalid action label")
    previous_turn = previous.get("turn")
    if type(previous_turn) is not int or turn <= previous_turn:
        raise RuntimeError("native step did not advance the game turn")
    expected_reward = (
        int(response["recommendationScore"])
        - int(previous["recommendationScore"])
    ) / SCORE_SCALE
    if not math.isclose(
        float(response["reward"]),
        expected_reward,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise RuntimeError("native step reward does not match its score delta")
    expected_return = float(previous["episodeReturn"]) + float(response["reward"])
    if not math.isclose(
        float(response["episodeReturn"]),
        expected_return,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise RuntimeError("native step episode return is not cumulative")


def evaluate_lightzero(
    args: argparse.Namespace,
    policy: Any,
    policy_config: Any,
    device: Any,
) -> tuple[dict[int, dict[str, Any]], dict[str, float]]:
    import gymnasium as gym
    import torch
    from lzero.mcts.buffer.game_segment import GameSegment
    from lzero.mcts.utils import prepare_observation

    from training.larc_graph.lightzero_env import NativeLArcEnvironment, UmaShowLArcEnv

    worker_count = min(args.lightzero_envs, args.games)
    action_space = gym.spaces.Discrete(LIGHTZERO_ACTIONS)
    sessions: list[NativeLArcEnvironment] = []
    rows: dict[int, dict[str, Any]] = {}
    total_started = time.perf_counter()
    try:
        for _ in range(worker_count):
            sessions.append(NativeLArcEnvironment(args.executable, args.database))
        for first in range(0, args.games, worker_count):
            count = min(worker_count, args.games - first)
            observations: dict[int, dict[str, Any]] = {}
            native_states: dict[int, dict[str, Any]] = {}
            segments: dict[int, GameSegment] = {}
            records: dict[int, dict[str, Any]] = {}
            active = list(range(count))
            policy.eval_mode.reset(active)
            batch_started = time.perf_counter()

            for local_id in active:
                index = first + local_id
                seed = (args.seed + index) & 0xFFFFFFFFFFFFFFFF
                response = sessions[local_id].request(
                    "env-reset",
                    seed=seed,
                    options=opening_options(args),
                )
                validate_native_state_response(
                    response,
                    game_index=index,
                    phase="reset",
                )
                observation = UmaShowLArcEnv._observation(response)
                segment = GameSegment(
                    action_space,
                    game_segment_length=80,
                    config=policy_config,
                )
                segment.reset([np.asarray(observation["observation"])])
                observations[local_id] = observation
                native_states[local_id] = response
                segments[local_id] = segment
                records[local_id] = {
                    "index": index,
                    "seed": seed,
                    "opening": response.get("opening"),
                    "initialRecommendationScore": int(response["recommendationScore"]),
                    "decisions": 0,
                    "actions": [],
                }

            while active:
                ready = sorted(active)
                stack_observation = np.asarray(
                    [segments[env_id].get_obs() for env_id in ready]
                )
                stack_observation = prepare_observation(
                    stack_observation,
                    policy_config.model.model_type,
                )
                tensor = torch.from_numpy(stack_observation).to(
                    device=device,
                    dtype=torch.float32,
                )
                action_masks = [
                    np.asarray(observations[env_id]["action_mask"]) for env_id in ready
                ]
                to_play = [int(observations[env_id]["to_play"]) for env_id in ready]
                timesteps = [int(observations[env_id]["timestep"]) for env_id in ready]
                outputs = policy.eval_mode.forward(
                    tensor,
                    action_masks,
                    to_play,
                    ready_env_id=ready,
                    timestep=timesteps,
                )

                completed: list[int] = []
                for env_id in ready:
                    previous = observations[env_id]
                    previous_native = native_states[env_id]
                    decision = int(records[env_id]["decisions"]) + 1
                    if decision > TOTAL_TURNS:
                        raise RuntimeError(
                            f"game {records[env_id]['index']} exceeded "
                            f"{TOTAL_TURNS} LightZero decisions"
                        )
                    action = int(outputs[env_id]["action"])
                    action_mask = np.asarray(previous["action_mask"])
                    validate_lightzero_action(
                        action,
                        action_mask,
                        int(records[env_id]["index"]),
                    )
                    response = sessions[env_id].request("env-step", action=action)
                    validate_native_state_response(
                        response,
                        game_index=int(records[env_id]["index"]),
                        phase="step",
                        previous=previous_native,
                        requested_action=action,
                    )
                    next_observation = UmaShowLArcEnv._observation(response)
                    segments[env_id].append(
                        np.asarray(action),
                        np.asarray(next_observation["observation"]),
                        np.asarray(float(response["reward"]), dtype=np.float32),
                        np.asarray(previous["action_mask"]),
                        int(previous["to_play"]),
                        int(previous["timestep"]),
                    )
                    if args.include_actions:
                        records[env_id]["actions"].append(
                            {
                                "decision": decision,
                                "turn": int(previous["timestep"]),
                                "action": action,
                                "label": response.get("actionLabel"),
                                "reward": float(response["reward"]),
                            }
                        )
                    records[env_id]["decisions"] = decision
                    observations[env_id] = next_observation
                    native_states[env_id] = response
                    if bool(response["done"]):
                        if decision != TOTAL_TURNS:
                            raise RuntimeError(
                                f"game {records[env_id]['index']} ended after "
                                f"{decision} decisions, expected {TOTAL_TURNS}"
                            )
                        initial = int(records[env_id]["initialRecommendationScore"])
                        final_recommendation = int(response["recommendationScore"])
                        episode_return = float(response["episodeReturn"])
                        reconstructed = (
                            final_recommendation - initial
                        ) / SCORE_SCALE
                        if not math.isclose(
                            episode_return,
                            reconstructed,
                            rel_tol=0.0,
                            abs_tol=1e-5,
                        ):
                            raise RuntimeError(
                                "native episode return does not match recommendation "
                                f"score delta for game {records[env_id]['index']}"
                            )
                        records[env_id].update(
                            {
                                "recommendationScore": final_recommendation,
                                "finalScore": int(response["finalScore"]),
                                "episodeReturn": episode_return,
                                "terminalTurn": int(response["turn"]),
                            }
                        )
                        if not args.include_actions:
                            records[env_id].pop("actions", None)
                        policy.eval_mode.reset([env_id])
                        completed.append(env_id)
                    elif decision >= TOTAL_TURNS:
                        raise RuntimeError(
                            f"game {records[env_id]['index']} did not finish after "
                            f"{TOTAL_TURNS} decisions"
                        )
                active = [env_id for env_id in active if env_id not in completed]

            batch_seconds = time.perf_counter() - batch_started
            for local_id, record in records.items():
                record["batchWallSeconds"] = batch_seconds
                rows[int(record["index"])] = record
            print(
                json.dumps(
                    {
                        "phase": "lightzero",
                        "completedGames": len(rows),
                        "requestedGames": args.games,
                        "batchSeconds": batch_seconds,
                    },
                    ensure_ascii=False,
                )
            )
    finally:
        for session in sessions:
            session.close()

    total_seconds = time.perf_counter() - total_started
    return rows, {
        "totalSeconds": total_seconds,
        "gamesPerSecond": len(rows) / total_seconds if total_seconds > 0 else 0.0,
    }


def evaluate_builtin(
    args: argparse.Namespace,
) -> tuple[dict[int, dict[str, Any]], dict[str, float]]:
    worker_count = min(args.builtin_workers, args.games)
    workers: list[SimulatorWorker] = []
    executor = ThreadPoolExecutor(max_workers=worker_count)
    in_flight: dict[Future[tuple[dict[str, Any], float]], tuple[SimulatorWorker, int]] = {}
    rows: dict[int, dict[str, Any]] = {}
    next_index = 0
    started = time.perf_counter()
    options = common_options(args)
    actual_searches = (
        (args.builtin_searches + args.threads - 1) // args.threads
    ) * args.threads
    options["searchSingleMax"] = actual_searches

    def submit(worker: SimulatorWorker) -> None:
        nonlocal next_index
        if next_index >= args.games:
            return
        index = next_index
        next_index += 1
        seed = (args.seed + index) & 0xFFFFFFFFFFFFFFFF
        future = executor.submit(worker.rollout, seed, options)
        in_flight[future] = (worker, index)

    try:
        for _ in range(worker_count):
            worker = SimulatorWorker(args.executable, args.database)
            workers.append(worker)
            submit(worker)
        while in_flight:
            finished, _ = wait(in_flight, return_when=FIRST_COMPLETED)
            for future in finished:
                worker, index = in_flight.pop(future)
                game, seconds = future.result()
                rows[index] = {
                    "index": index,
                    "seed": (args.seed + index) & 0xFFFFFFFFFFFFFFFF,
                    "opening": {key: game.get(key) for key in OPENING_KEYS},
                    "openingSeed": game.get("seed"),
                    "recommendationScore": int(game["recommendationScore"]),
                    "finalScore": int(game["finalScore"]),
                    "decisions": int(game["decisions"]),
                    "seconds": seconds,
                }
                print(
                    json.dumps(
                        {
                            "phase": "builtin",
                            "completedGames": len(rows),
                            "requestedGames": args.games,
                            "seed": rows[index]["seed"],
                        },
                        ensure_ascii=False,
                    )
                )
                submit(worker)
    finally:
        for future in in_flight:
            future.cancel()
        for worker in workers:
            worker.close()
        executor.shutdown(wait=True)

    total_seconds = time.perf_counter() - started
    return rows, {
        "totalSeconds": total_seconds,
        "gamesPerSecond": len(rows) / total_seconds if total_seconds > 0 else 0.0,
    }


def pair_rows(
    lightzero: Mapping[int, dict[str, Any]],
    builtin: Mapping[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    if set(lightzero) != set(builtin):
        raise RuntimeError("LightZero and builtin evaluations completed different games")
    rows: list[dict[str, Any]] = []
    for index in sorted(lightzero):
        left = lightzero[index]
        right = builtin[index]
        if left.get("seed") != right.get("seed"):
            raise RuntimeError(f"paired game {index} used different requested seeds")
        left_opening = left.get("opening")
        right_opening = right.get("opening")
        if not isinstance(left_opening, Mapping) or not isinstance(right_opening, Mapping):
            raise RuntimeError(f"paired game {index} is missing opening metadata")
        if "seed" not in left_opening or right.get("openingSeed") is None:
            raise RuntimeError(f"paired game {index} is missing an opening seed")
        if left_opening["seed"] != right["openingSeed"]:
            raise RuntimeError(f"paired game {index} used different opening seeds")
        if left.get("decisions") != TOTAL_TURNS or right.get("decisions") != TOTAL_TURNS:
            raise RuntimeError(
                f"paired game {index} did not contain {TOTAL_TURNS} decisions per policy"
            )
        mismatches = [
            key for key in OPENING_KEYS if left_opening.get(key) != right_opening.get(key)
        ]
        if mismatches:
            raise RuntimeError(
                f"paired seed {left['seed']} produced different openings: "
                + ", ".join(mismatches)
            )
        recommendation_delta = int(left["recommendationScore"]) - int(
            right["recommendationScore"]
        )
        final_delta = int(left["finalScore"]) - int(right["finalScore"])
        rows.append(
            {
                "index": index,
                "seed": left["seed"],
                "openingSeed": right.get("openingSeed", left_opening.get("seed")),
                "opening": {key: left_opening.get(key) for key in OPENING_KEYS},
                "lightzero": left,
                "builtin": right,
                "delta": {
                    "recommendationScore": recommendation_delta,
                    "finalScore": final_delta,
                },
            }
        )
    return rows


def wilson_interval(successes: int, total: int) -> list[float] | None:
    if total <= 0:
        return None
    z = 1.959963984540054
    proportion = successes / total
    denominator = 1.0 + z * z / total
    center = (proportion + z * z / (2.0 * total)) / denominator
    half = (
        z
        * math.sqrt(
            proportion * (1.0 - proportion) / total
            + z * z / (4.0 * total * total)
        )
        / denominator
    )
    return [max(0.0, center - half), min(1.0, center + half)]


BOOTSTRAP_RESAMPLES = 10_000


def median_bootstrap_interval(
    values: list[float],
    seed: int,
) -> tuple[list[float] | None, str | None]:
    if len(values) < 2:
        return None, None
    if min(values) == max(values):
        return [values[0], values[0]], "constant"

    sample = np.asarray(values, dtype=np.float64)
    for method in ("BCa", "percentile"):
        try:
            with python_warnings.catch_warnings():
                python_warnings.simplefilter("ignore")
                result = bootstrap(
                    (sample,),
                    np.median,
                    vectorized=False,
                    n_resamples=BOOTSTRAP_RESAMPLES,
                    confidence_level=0.95,
                    method=method,
                    rng=np.random.default_rng(seed),
                )
        except (FloatingPointError, ValueError):
            continue
        low = float(result.confidence_interval.low)
        high = float(result.confidence_interval.high)
        if math.isfinite(low) and math.isfinite(high):
            return [low, high], method
    return None, None


def paired_comparison(
    rows: list[dict[str, Any]],
    metric: str,
    tie_margin: int,
    bootstrap_seed: int,
) -> dict[str, Any]:
    lightzero = [float(row["lightzero"][metric]) for row in rows]
    builtin = [float(row["builtin"][metric]) for row in rows]
    delta = [left - right for left, right in zip(lightzero, builtin)]
    wins = sum(value > tie_margin for value in delta)
    losses = sum(value < -tie_margin for value in delta)
    ties = len(delta) - wins - losses
    decisive = wins + losses
    mean_delta = statistics.fmean(delta)
    delta_stdev = statistics.stdev(delta) if len(delta) > 1 else 0.0
    standard_error = delta_stdev / math.sqrt(len(delta)) if len(delta) > 1 else None
    if standard_error is None:
        mean_interval = None
    else:
        critical = float(student_t.ppf(0.975, len(delta) - 1))
        mean_interval = [
            mean_delta - critical * standard_error,
            mean_delta + critical * standard_error,
        ]
    median_interval, median_method = median_bootstrap_interval(
        delta,
        bootstrap_seed,
    )
    return {
        "lightzero": describe(lightzero),
        "builtin": describe(builtin),
        "delta": describe(delta),
        "standardError": standard_error,
        "meanDelta95CiT": mean_interval,
        "medianDelta95Ci": median_interval,
        "medianDelta95CiMethod": median_method,
        "medianDelta95CiBca": (
            median_interval if median_method in {"BCa", "constant"} else None
        ),
        "bootstrapResamples": (
            BOOTSTRAP_RESAMPLES
            if median_method in {"BCa", "percentile"}
            else 0
        ),
        "bootstrapSeed": bootstrap_seed,
        "lightzeroWins": wins,
        "builtinWins": losses,
        "ties": ties,
        "tieMargin": tie_margin,
        "lightzeroWinRate": wins / len(delta),
        "lightzeroWinRateExcludingTies": wins / decisive if decisive else None,
        "winRateExcludingTies95CiWilson": wilson_interval(wins, decisive),
        "signTestPValue": (
            float(binomtest(wins, decisive, 0.5).pvalue) if decisive else None
        ),
        "pairedEffectSizeDz": (
            mean_delta / delta_stdev if delta_stdev > 0.0 else None
        ),
    }


def build_summary(
    rows: list[dict[str, Any]],
    args: argparse.Namespace,
    timings: Mapping[str, Any],
) -> dict[str, Any]:
    return {
        "completedGames": len(rows),
        "primaryMetric": "recommendationScore",
        "recommendationScore": paired_comparison(
            rows,
            "recommendationScore",
            args.tie_margin,
            args.seed ^ 0x243F6A88,
        ),
        "finalScore": paired_comparison(
            rows,
            "finalScore",
            args.tie_margin,
            args.seed ^ 0x85A308D3,
        ),
        "timing": dict(timings),
    }


def main() -> None:
    args = parse_args()
    validate_args(args)
    artifact_hashes = {
        args.checkpoint.parent.parent / LIGHTZERO_MANIFEST: stable_file_sha256(
            args.checkpoint.parent.parent / LIGHTZERO_MANIFEST
        ),
        args.executable: stable_file_sha256(args.executable),
        args.database: stable_file_sha256(args.database),
    }
    manifest_path, manifest = load_manifest(args.checkpoint)
    verify_artifacts_unchanged(artifact_hashes, "manifest loading")
    search_chance_space, warnings = resolve_search_chance_space(
        manifest,
        args.chance_search_space,
    )
    if args.no_ctree:
        warnings.append(
            "Python-tree search uses process-global seeded RNG state; changing "
            "batch size or environment count can change its random sequence"
        )
    else:
        warnings.append(
            "C++ chance-node selection uses an unseeded random_device; repeated "
            "evaluations can choose different LightZero search trajectories"
        )
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)

    checkpoint, checkpoint_hash = stable_load_checkpoint(args.checkpoint)
    checkpoint_last_iter = checkpoint.get("last_iter")
    checkpoint_last_step = checkpoint.get("last_step")
    model_settings = manifest["model"]
    policy, policy_config, device = build_policy(
        args,
        model_settings,
        checkpoint["model"],
        search_chance_space,
    )
    del checkpoint

    try:
        lightzero_rows, lightzero_timing = evaluate_lightzero(
            args,
            policy,
            policy_config,
            device,
        )
    finally:
        del policy
        if device.type == "cuda":
            import gc
            import torch

            gc.collect()
            torch.cuda.empty_cache()
    verify_artifacts_unchanged(artifact_hashes, "LightZero evaluation")
    builtin_rows, builtin_timing = evaluate_builtin(args)
    verify_artifacts_unchanged(artifact_hashes, "builtin evaluation")
    rows = pair_rows(lightzero_rows, builtin_rows)
    timings = {
        "lightzeroBatched": lightzero_timing,
        "builtin": builtin_timing,
        "warning": (
            "timings are not directly comparable while policies use different "
            "batching and the machine may have other active workloads"
        ),
    }
    summary = build_summary(rows, args, timings)
    payload = {
        "evaluation": "lightzero-vs-builtin-monte-carlo-paired-rollout",
        "baselineDescription": (
            "native Monte Carlo search whose rollout policy is hand-written; "
            "this is not a pure one-step greedy hand-written policy"
        ),
        "config": {
            "checkpoint": str(args.checkpoint),
            "checkpointSha256": checkpoint_hash,
            "checkpointLastIter": checkpoint_last_iter,
            "checkpointLastStep": checkpoint_last_step,
            "manifest": str(manifest_path),
            "manifestSha256": artifact_hashes[manifest_path],
            "executable": str(args.executable),
            "executableSha256": artifact_hashes[args.executable],
            "database": str(args.database),
            "databaseSha256": artifact_hashes[args.database],
            "games": args.games,
            "seed": args.seed,
            "lightzeroEnvs": min(args.lightzero_envs, args.games),
            "simulations": args.simulations,
            "modelChanceSpaceSize": int(model_settings["chance_space_size"]),
            "searchChanceSpaceSize": search_chance_space,
            "chanceSearchPatch": CHANCE_SEARCH_PATCH,
            "manifestChanceSearch": manifest.get("chanceSearch"),
            "ctree": not args.no_ctree,
            "device": str(device),
            "builtinWorkers": min(args.builtin_workers, args.games),
            "builtinThreads": args.threads,
            "builtinSearchesRequestedPerLegalAction": args.builtin_searches,
            "builtinSearchesActualPerLegalAction": (
                (args.builtin_searches + args.threads - 1) // args.threads
            ) * args.threads,
            "radicalFactor": args.radical_factor,
            "randomizeTargets": not args.no_random_targets,
            "targets": {
                status: int(getattr(args, f"target_{status}"))
                for status in STATUS_NAMES
            },
            "rootNoise": False,
            "actionSelection": "visit_count_argmax",
            "chanceNodeSelection": "stochastic",
            "searchRngSeeded": bool(args.no_ctree),
            "checkpointManifestBinding": (
                "adjacent-path-plus-strict-model-semantics; the checkpoint does "
                "not embed a manifest digest"
            ),
            "warnings": warnings,
        },
        "summary": summary,
        "games": rows,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if args.output is not None:
        output = args.output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"wrote evaluation to {output}")


if __name__ == "__main__":
    main()
