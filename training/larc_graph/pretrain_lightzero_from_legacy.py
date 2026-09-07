from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Iterable, Mapping

import numpy as np
import torch
from torch import Tensor, nn
from torch.utils.data import DataLoader, Dataset, random_split


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from training.larc_graph.lightzero_checkpoint import save_pretrain_checkpoint
from training.larc_graph.schema import (
    ACTION_FEATURES,
    GLOBAL_FEATURES,
    LIGHTZERO_ACTIONS,
    LIGHTZERO_OBSERVATION,
    MAX_ACTIONS,
    MAX_PERSONS,
    PERSON_FEATURES,
    SCHEMA_VERSION,
    SCORE_SCALE,
    TRAINING_COUNT,
    TRAINING_FEATURES,
)
from training.larc_graph.train_lightzero import model_config


STATUS_SCALE = 3_000.0
SKILL_POINT_SCALE = 3_000.0
STATUS_SCORE_SOURCE = (
    REPOSITORY_ROOT
    / "native/monte-carlo-larc/GameDatabase/GameConstants.cpp"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Pretrain LightZero's initial representation/policy/value networks "
            "from legacy LArc NPZ teacher data"
        )
    )
    parser.add_argument("data", nargs="+", help="legacy NPZ shards or glob patterns")
    parser.add_argument(
        "--output",
        type=Path,
        default=REPOSITORY_ROOT
        / "training/larc_graph/checkpoints/lightzero-legacy-init.pth.tar",
    )
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--validation-ratio", type=float, default=0.05)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument("--seed", type=int, default=20260907)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--chance-space-size", type=int, default=32)
    parser.add_argument("--latent-state-dim", type=int, default=256)
    parser.add_argument("--policy-loss-weight", type=float, default=1.0)
    parser.add_argument("--value-loss-weight", type=float, default=0.5)
    parser.add_argument(
        "--max-samples",
        type=int,
        default=0,
        help="optional sample cap for smoke tests; zero uses every matched sample",
    )
    parser.add_argument(
        "--status-score-source",
        type=Path,
        default=STATUS_SCORE_SOURCE,
        help="C++ source containing GameConstants::FiveStatusFinalScore",
    )
    return parser.parse_args()


def resolve_data(patterns: Iterable[str]) -> list[Path]:
    files: list[Path] = []
    for pattern in patterns:
        path = Path(pattern)
        if path.is_file():
            files.append(path)
            continue
        root = path.parent if str(path.parent) != "." else Path.cwd()
        files.extend(sorted(root.glob(path.name)))
    unique = list(dict.fromkeys(file.resolve() for file in files))
    if not unique:
        raise FileNotFoundError("no legacy NPZ dataset shards matched")
    return unique


def choose_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_status_score_table(source: Path = STATUS_SCORE_SOURCE) -> np.ndarray:
    """Read the simulator's exact status-score lookup table.

    Legacy shards store the terminal absolute recommendation score.  LightZero
    learns the remaining return because its environment emits score deltas.  The
    current recommendation score can be reconstructed from ``global_features``;
    using the simulator's table here prevents a systematic value-target offset.
    """

    if not source.is_file():
        raise FileNotFoundError(f"status score source not found: {source}")
    text = source.read_text(encoding="utf-8")
    match = re.search(
        r"FiveStatusFinalScore\[(\d+)\]\s*=\s*\{(.*?)\};",
        text,
        flags=re.DOTALL,
    )
    if match is None:
        raise ValueError(f"could not find FiveStatusFinalScore in {source}")
    expected_size = int(match.group(1))
    values = np.asarray(
        [int(value) for value in re.findall(r"-?\d+", match.group(2))],
        dtype=np.int64,
    )
    if values.shape != (expected_size,):
        raise ValueError(
            f"{source}: parsed {values.size} status scores, expected {expected_size}"
        )
    return values


def lightzero_observation(
    global_features: np.ndarray,
    person_features: np.ndarray,
    training_features: np.ndarray,
    placement: np.ndarray,
) -> np.ndarray:
    """Flatten legacy graph state tensors in the native LightZero order."""

    sample_count = global_features.shape[0]
    observation = np.concatenate(
        (
            global_features.reshape(sample_count, -1),
            person_features.reshape(sample_count, -1),
            training_features.reshape(sample_count, -1),
            placement.reshape(sample_count, -1),
        ),
        axis=1,
    )
    if observation.shape != (sample_count, LIGHTZERO_OBSERVATION):
        raise ValueError(
            f"flattened observation shape {observation.shape}, expected "
            f"{(sample_count, LIGHTZERO_OBSERVATION)}"
        )
    # The live LightZero environment sends float16 observations.  Keeping the
    # same quantization also roughly halves the in-memory size of the old data.
    return observation.astype(np.float16, copy=False)


def convert_action_slots(
    action_features: np.ndarray,
    action_mask: np.ndarray,
    policy_target: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Map the legacy 48 dynamic slots to LightZero's semantic action IDs.

    ``enumerateLegalActions`` assigns ``choice * 10 + train``.  The dynamic NPZ
    slot itself is not stable across states, but the action feature vector keeps
    both the train ID and the two purchase-choice bits needed to recover that
    semantic ID.
    """

    action_features = np.asarray(action_features, dtype=np.float32)
    action_mask = np.asarray(action_mask, dtype=np.float32)
    policy_target = np.asarray(policy_target, dtype=np.float32)
    if action_features.ndim != 3 or action_features.shape[1:] != (
        MAX_ACTIONS,
        ACTION_FEATURES,
    ):
        raise ValueError(
            f"action_features shape {action_features.shape}, expected "
            f"(samples, {MAX_ACTIONS}, {ACTION_FEATURES})"
        )
    expected_slots = action_features.shape[:2]
    if action_mask.shape != expected_slots:
        raise ValueError(
            f"action_mask shape {action_mask.shape}, expected {expected_slots}"
        )
    if policy_target.shape != expected_slots:
        raise ValueError(
            f"policy_target shape {policy_target.shape}, expected {expected_slots}"
        )

    valid = action_mask > 0.5
    if np.any(valid.sum(axis=1) == 0):
        sample = int(np.flatnonzero(valid.sum(axis=1) == 0)[0])
        raise ValueError(f"sample {sample} has no legal legacy action")
    invalid_policy = (~valid) & (np.abs(policy_target) > 1e-5)
    if np.any(invalid_policy):
        sample, slot = (int(value) for value in np.argwhere(invalid_policy)[0])
        raise ValueError(
            f"sample {sample} slot {slot} has policy mass but is not legal"
        )
    if np.any(valid & (~np.isfinite(policy_target) | (policy_target < 0.0))):
        sample, slot = (
            int(value)
            for value in np.argwhere(
                valid & (~np.isfinite(policy_target) | (policy_target < 0.0))
            )[0]
        )
        raise ValueError(f"sample {sample} slot {slot} has invalid policy mass")

    train_one_hot = action_features[:, :, 1:11]
    train_hot_count = (train_one_hot > 0.5).sum(axis=2)
    malformed_train = valid & (train_hot_count != 1)
    if np.any(malformed_train):
        sample, slot = (int(value) for value in np.argwhere(malformed_train)[0])
        raise ValueError(
            f"sample {sample} slot {slot} does not contain one train/action ID"
        )
    train_id = np.argmax(train_one_hot, axis=2).astype(np.int64)

    buy_50 = action_features[:, :, 11] > 0.5
    buy_pt = action_features[:, :, 12] > 0.5
    buy_friend = action_features[:, :, 13] > 0.5
    buy_vital = action_features[:, :, 14] > 0.5
    unsupported_friend_purchase = valid & buy_friend
    if np.any(unsupported_friend_purchase):
        sample, slot = (
            int(value)
            for value in np.argwhere(unsupported_friend_purchase)[0]
        )
        raise ValueError(
            f"sample {sample} slot {slot} uses unsupported buyFriend20"
        )
    conflicting_purchase = valid & buy_pt & buy_vital
    if np.any(conflicting_purchase):
        sample, slot = (
            int(value) for value in np.argwhere(conflicting_purchase)[0]
        )
        raise ValueError(
            f"sample {sample} slot {slot} buys both skill and vitality upgrades"
        )

    # choice 0: no purchase; 1: +50%; 2: phase-specific secondary upgrade;
    # choice 3: both.  In the two expeditions the secondary bit denotes either
    # skill-point +10 or vitality-cost -20%, but the stable action ID is shared.
    choice = buy_50.astype(np.int64) + 2 * (buy_pt | buy_vital).astype(np.int64)
    action_id = choice * 10 + train_id
    malformed_id = valid & (
        (action_id < 0) | (action_id >= LIGHTZERO_ACTIONS)
    )
    if np.any(malformed_id):
        sample, slot = (int(value) for value in np.argwhere(malformed_id)[0])
        raise ValueError(
            f"sample {sample} slot {slot} maps outside the LightZero action space"
        )

    sample_indices, slot_indices = np.nonzero(valid)
    semantic_ids = action_id[sample_indices, slot_indices]
    duplicate_counts = np.zeros(
        (action_features.shape[0], LIGHTZERO_ACTIONS), dtype=np.uint8
    )
    np.add.at(duplicate_counts, (sample_indices, semantic_ids), 1)
    duplicates = np.argwhere(duplicate_counts > 1)
    if duplicates.size:
        sample, semantic_id = (int(value) for value in duplicates[0])
        raise ValueError(
            f"sample {sample} maps multiple legacy slots to action {semantic_id}"
        )

    fixed_mask = duplicate_counts.astype(np.float32)
    fixed_policy = np.zeros_like(fixed_mask)
    np.add.at(
        fixed_policy,
        (sample_indices, semantic_ids),
        policy_target[sample_indices, slot_indices],
    )
    policy_sums = fixed_policy.sum(axis=1, keepdims=True)
    if np.any(~np.isfinite(policy_sums) | (policy_sums <= 0.0)):
        sample = int(
            np.flatnonzero(
                (~np.isfinite(policy_sums) | (policy_sums <= 0.0)).reshape(-1)
            )[0]
        )
        raise ValueError(f"sample {sample} has no positive teacher policy mass")
    fixed_policy /= policy_sums
    return fixed_policy, fixed_mask


def current_recommendation_score(
    global_features: np.ndarray,
    status_score_table: np.ndarray,
) -> np.ndarray:
    """Reconstruct ``Game::recommendationScore`` from graph globals."""

    raw_global_features = np.asarray(global_features)
    if raw_global_features.dtype == np.float16:
        raise ValueError(
            "recommendation score must be reconstructed before float16 "
            "observation quantization"
        )
    global_features = raw_global_features.astype(np.float32, copy=False)
    if global_features.ndim != 2 or global_features.shape[1] != GLOBAL_FEATURES:
        raise ValueError(
            f"global_features shape {global_features.shape}, expected "
            f"(samples, {GLOBAL_FEATURES})"
        )
    status_score_table = np.asarray(status_score_table, dtype=np.int64)
    if status_score_table.ndim != 1 or status_score_table.size == 0:
        raise ValueError("status score table must be a non-empty vector")

    # ``normalized`` divides in double precision and stores float32.  Decode in
    # float64 before rounding so values such as 1501 do not land just below the
    # integer after a second float32 multiplication.
    statuses = np.rint(
        global_features[:, 40:45].astype(np.float64) * STATUS_SCALE
    ).astype(np.int64)
    targets = np.rint(
        global_features[:, 50:55].astype(np.float64) * STATUS_SCALE
    ).astype(np.int64)
    scored_statuses = np.minimum(statuses, targets)
    if np.any(scored_statuses < 0) or np.any(
        scored_statuses >= status_score_table.size
    ):
        sample, status = (
            int(value)
            for value in np.argwhere(
                (scored_statuses < 0)
                | (scored_statuses >= status_score_table.size)
            )[0]
        )
        value = int(scored_statuses[sample, status])
        raise ValueError(
            f"sample {sample} status {status}={value} is outside the score table"
        )

    status_score = status_score_table[scored_statuses].sum(axis=1)
    skill_points = np.rint(
        global_features[:, 15].astype(np.float64) * SKILL_POINT_SCALE
    ).astype(np.int64)
    bought_skill_score = np.rint(
        global_features[:, 16].astype(np.float64) * SCORE_SCALE
    ).astype(np.int64)
    skill_rate = np.where(
        global_features[:, 7] > 0.5,
        np.float32(2.1),
        np.float32(1.9),
    )
    # Reproduce the simulator's float return from getSkillScore followed by
    # conversion to int in recommendationScore.
    skill_score = (
        skill_rate * skill_points.astype(np.float32)
    ).astype(np.float32)
    skill_score = (
        skill_score + bought_skill_score.astype(np.float32)
    ).astype(np.float32)
    total_score = (
        status_score.astype(np.float32) + skill_score
    ).astype(np.float32)
    return np.trunc(total_score).astype(np.float32)


def remaining_value_target(
    global_features: np.ndarray,
    terminal_value_target: np.ndarray,
    status_score_table: np.ndarray,
) -> np.ndarray:
    terminal_value_target = np.asarray(terminal_value_target, dtype=np.float32)
    expected = (global_features.shape[0],)
    if terminal_value_target.shape != expected:
        raise ValueError(
            f"value_target shape {terminal_value_target.shape}, expected {expected}"
        )
    current = current_recommendation_score(global_features, status_score_table)
    target = (terminal_value_target - current) / np.float32(SCORE_SCALE)
    if not np.all(np.isfinite(target)):
        sample = int(np.flatnonzero(~np.isfinite(target))[0])
        raise ValueError(f"sample {sample} has a non-finite remaining value target")
    return target.astype(np.float32, copy=False)


class LegacyLightZeroDataset(Dataset[dict[str, Tensor]]):
    """In-memory, compact view of legacy shards for initial-network training."""

    def __init__(
        self,
        files: Iterable[str | Path],
        status_score_table: np.ndarray,
        max_samples: int = 0,
    ) -> None:
        paths = [Path(path) for path in files]
        if not paths:
            raise ValueError("no dataset shards were provided")
        if max_samples < 0:
            raise ValueError("max_samples cannot be negative")

        observations: list[np.ndarray] = []
        policies: list[np.ndarray] = []
        action_masks: list[np.ndarray] = []
        values: list[np.ndarray] = []
        loaded = 0
        for path in paths:
            if max_samples and loaded >= max_samples:
                break
            with np.load(path, allow_pickle=False) as shard:
                if "schema_version" not in shard:
                    raise ValueError(f"{path}: missing schema_version")
                version = int(np.asarray(shard["schema_version"]).item())
                if version != SCHEMA_VERSION:
                    raise ValueError(
                        f"{path}: schema {version} != expected {SCHEMA_VERSION}"
                    )
                required = {
                    "global_features": (GLOBAL_FEATURES,),
                    "person_features": (MAX_PERSONS, PERSON_FEATURES),
                    "training_features": (TRAINING_COUNT, TRAINING_FEATURES),
                    "placement": (TRAINING_COUNT, MAX_PERSONS),
                    "action_features": (MAX_ACTIONS, ACTION_FEATURES),
                    "action_mask": (MAX_ACTIONS,),
                    "policy_target": (MAX_ACTIONS,),
                    "value_target": (),
                }
                missing = [key for key in required if key not in shard]
                if missing:
                    raise ValueError(f"{path}: missing arrays {', '.join(missing)}")
                shard_count = int(shard["global_features"].shape[0])
                take = (
                    min(shard_count, max_samples - loaded)
                    if max_samples
                    else shard_count
                )
                if take <= 0:
                    continue
                arrays: dict[str, np.ndarray] = {}
                for key, expected_shape in required.items():
                    value = np.asarray(shard[key][:take], dtype=np.float32)
                    if value.shape != (take, *expected_shape):
                        raise ValueError(
                            f"{path}: {key} shape {value.shape}, expected "
                            f"{(take, *expected_shape)}"
                        )
                    if not np.all(np.isfinite(value)):
                        location = tuple(
                            int(index)
                            for index in np.argwhere(~np.isfinite(value))[0]
                        )
                        raise ValueError(
                            f"{path}: {key} contains a non-finite value at "
                            f"index {location}"
                        )
                    arrays[key] = value

                observations.append(
                    lightzero_observation(
                        arrays["global_features"],
                        arrays["person_features"],
                        arrays["training_features"],
                        arrays["placement"],
                    )
                )
                fixed_policy, fixed_mask = convert_action_slots(
                    arrays["action_features"],
                    arrays["action_mask"],
                    arrays["policy_target"],
                )
                policies.append(fixed_policy)
                action_masks.append(fixed_mask.astype(np.uint8))
                values.append(
                    remaining_value_target(
                        arrays["global_features"],
                        arrays["value_target"],
                        status_score_table,
                    )
                )
                loaded += take

        if not observations:
            raise ValueError("dataset shards contain no samples")
        self.observation = np.concatenate(observations, axis=0)
        self.policy_target = np.concatenate(policies, axis=0)
        self.action_mask = np.concatenate(action_masks, axis=0)
        self.value_target = np.concatenate(values, axis=0)

    def __len__(self) -> int:
        return int(self.observation.shape[0])

    def __getitem__(self, index: int) -> dict[str, Tensor]:
        return {
            "observation": torch.from_numpy(self.observation[index]),
            "policy_target": torch.from_numpy(self.policy_target[index]),
            "action_mask": torch.from_numpy(self.action_mask[index]),
            "value_target": torch.as_tensor(self.value_target[index]),
        }


def move_batch(
    batch: Mapping[str, Tensor], device: torch.device
) -> dict[str, Tensor]:
    return {
        "observation": batch["observation"].to(
            device=device, dtype=torch.float32, non_blocking=True
        ),
        "policy_target": batch["policy_target"].to(
            device=device, dtype=torch.float32, non_blocking=True
        ),
        "action_mask": batch["action_mask"].to(
            device=device, dtype=torch.bool, non_blocking=True
        ),
        "value_target": batch["value_target"].to(
            device=device, dtype=torch.float32, non_blocking=True
        ),
    }


def calculate_initial_loss(
    model: nn.Module,
    batch: Mapping[str, Tensor],
    value_support: object,
    *,
    policy_loss_weight: float,
    value_loss_weight: float,
) -> tuple[Tensor, dict[str, Tensor]]:
    from lzero.policy import cross_entropy_loss, phi_transform, scalar_transform

    output = model.initial_inference(batch["observation"])
    policy_per_sample = cross_entropy_loss(
        output.policy_logits, batch["policy_target"]
    )
    transformed_value = scalar_transform(batch["value_target"])
    categorical_value = phi_transform(value_support, transformed_value)
    value_per_sample = cross_entropy_loss(output.value, categorical_value)
    loss = (
        policy_loss_weight * policy_per_sample
        + value_loss_weight * value_per_sample
    ).mean()
    return loss, {
        "policy": policy_per_sample.mean(),
        "value": value_per_sample.mean(),
        "policy_logits": output.policy_logits,
        "value_logits": output.value,
    }


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader[dict[str, Tensor]],
    device: torch.device,
    value_support: object,
    *,
    policy_loss_weight: float,
    value_loss_weight: float,
) -> dict[str, float]:
    from lzero.policy import InverseScalarTransform

    model.eval()
    inverse_value = InverseScalarTransform(value_support, True)
    totals = {
        "loss": 0.0,
        "policy_loss": 0.0,
        "value_loss": 0.0,
        "correct": 0.0,
        "value_absolute_error": 0.0,
        "samples": 0.0,
    }
    for raw_batch in loader:
        batch = move_batch(raw_batch, device)
        loss, details = calculate_initial_loss(
            model,
            batch,
            value_support,
            policy_loss_weight=policy_loss_weight,
            value_loss_weight=value_loss_weight,
        )
        count = int(batch["observation"].shape[0])
        masked_logits = details["policy_logits"].masked_fill(
            ~batch["action_mask"], -torch.inf
        )
        predicted_action = masked_logits.argmax(dim=1)
        teacher_action = batch["policy_target"].argmax(dim=1)
        predicted_value = inverse_value(details["value_logits"]).squeeze(1)
        totals["loss"] += float(loss) * count
        totals["policy_loss"] += float(details["policy"]) * count
        totals["value_loss"] += float(details["value"]) * count
        totals["correct"] += float((predicted_action == teacher_action).sum())
        totals["value_absolute_error"] += float(
            torch.abs(predicted_value - batch["value_target"]).sum()
        )
        totals["samples"] += count

    samples = max(1.0, totals["samples"])
    return {
        "loss": totals["loss"] / samples,
        "policyLoss": totals["policy_loss"] / samples,
        "valueLoss": totals["value_loss"] / samples,
        "policyTop1": totals["correct"] / samples,
        "valueMae": totals["value_absolute_error"] / samples,
    }


def cpu_state_dict(model: nn.Module) -> dict[str, Tensor]:
    return {
        key: value.detach().cpu().clone()
        for key, value in model.state_dict().items()
    }


def main() -> None:
    args = parse_args()
    if args.epochs <= 0:
        raise ValueError("--epochs must be positive")
    if args.batch_size <= 0:
        raise ValueError("--batch-size must be positive")
    if args.workers < 0:
        raise ValueError("--workers cannot be negative")
    if not 0.0 < args.validation_ratio < 1.0:
        raise ValueError("--validation-ratio must be between zero and one")
    if args.max_samples < 0:
        raise ValueError("--max-samples cannot be negative")
    if args.policy_loss_weight < 0.0 or args.value_loss_weight < 0.0:
        raise ValueError("loss weights cannot be negative")
    if args.policy_loss_weight + args.value_loss_weight <= 0.0:
        raise ValueError("at least one loss weight must be positive")

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    files = resolve_data(args.data)
    score_table = load_status_score_table(args.status_score_source.resolve())
    dataset = LegacyLightZeroDataset(
        files,
        score_table,
        max_samples=args.max_samples,
    )
    if len(dataset) < 2:
        raise ValueError("pretraining requires at least two samples")

    validation_count = min(
        max(1, round(len(dataset) * args.validation_ratio)),
        len(dataset) - 1,
    )
    training_count = len(dataset) - validation_count
    generator = torch.Generator().manual_seed(args.seed)
    training_set, validation_set = random_split(
        dataset,
        [training_count, validation_count],
        generator=generator,
    )
    device = choose_device(args.device)
    pin_memory = device.type == "cuda"
    training_loader = DataLoader(
        training_set,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.workers,
        pin_memory=pin_memory,
    )
    validation_loader = DataLoader(
        validation_set,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=pin_memory,
    )

    # Importing LightZero pulls in optional runtime packages, so defer it until
    # after argument/data validation and provide the same actionable error as the
    # online trainer.
    try:
        from lzero.policy import DiscreteSupport
        from training.larc_graph.lightzero_model import (
            LArcStochasticMuZeroModelMLP,
        )
    except Exception as exception:
        raise RuntimeError(
            "LightZero failed to import; run `uv sync --extra larc-graph`"
        ) from exception

    settings = model_config(args)
    model = LArcStochasticMuZeroModelMLP(**settings).to(device)
    trainable_components = (
        "representation_network",
        "prediction_network",
    )
    trainable_parameter_list: list[nn.Parameter] = []
    for name, parameter in model.named_parameters():
        is_pretrained_component = name.startswith(trainable_components)
        parameter.requires_grad_(is_pretrained_component)
        if is_pretrained_component:
            trainable_parameter_list.append(parameter)
    optimizer = torch.optim.AdamW(
        trainable_parameter_list,
        lr=args.learning_rate,
        weight_decay=args.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=max(1, args.epochs)
    )
    value_support = DiscreteSupport(
        *settings["value_support_range"], device=device
    )
    trainable_parameters = sum(
        parameter.numel() for parameter in trainable_parameter_list
    )
    print(
        json.dumps(
            {
                "samples": len(dataset),
                "training": training_count,
                "validation": validation_count,
                "files": len(files),
                "device": str(device),
                "modelParameters": sum(
                    parameter.numel() for parameter in model.parameters()
                ),
                "pretrainedParameters": trainable_parameters,
                "valueTarget": "remaining_recommendation_return",
            },
            ensure_ascii=False,
        )
    )

    best_validation = float("inf")
    best_epoch = 0
    best_state: dict[str, Tensor] | None = None
    best_metrics: dict[str, float] | None = None
    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        running_samples = 0
        for raw_batch in training_loader:
            batch = move_batch(raw_batch, device)
            optimizer.zero_grad(set_to_none=True)
            loss, _ = calculate_initial_loss(
                model,
                batch,
                value_support,
                policy_loss_weight=args.policy_loss_weight,
                value_loss_weight=args.value_loss_weight,
            )
            loss.backward()
            torch.nn.utils.clip_grad_norm_(trainable_parameter_list, 5.0)
            optimizer.step()
            count = int(batch["observation"].shape[0])
            running_loss += float(loss.detach()) * count
            running_samples += count
        scheduler.step()

        metrics = evaluate(
            model,
            validation_loader,
            device,
            value_support,
            policy_loss_weight=args.policy_loss_weight,
            value_loss_weight=args.value_loss_weight,
        )
        training_loss = running_loss / max(1, running_samples)
        print(
            json.dumps(
                {
                    "epoch": epoch,
                    "trainLoss": training_loss,
                    **metrics,
                    "learningRate": scheduler.get_last_lr()[0],
                },
                ensure_ascii=False,
            )
        )
        if metrics["loss"] <= best_validation:
            best_validation = metrics["loss"]
            best_epoch = epoch
            best_metrics = dict(metrics)
            best_state = cpu_state_dict(model)

    if best_state is None or best_metrics is None:
        raise RuntimeError("pretraining completed without a checkpoint candidate")
    model.load_state_dict(best_state, strict=True)
    metadata = {
        "source_files": [str(path) for path in files],
        "sample_count": len(dataset),
        "training_count": training_count,
        "validation_count": validation_count,
        "best_epoch": best_epoch,
        "validation": best_metrics,
        "seed": args.seed,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "weight_decay": args.weight_decay,
        "policy_loss_weight": args.policy_loss_weight,
        "value_loss_weight": args.value_loss_weight,
        "value_target": "remaining_recommendation_return",
        "action_mapping": "legacy_dynamic_slot_to_choice_times_10_plus_train",
    }
    save_pretrain_checkpoint(
        args.output.resolve(),
        model,
        settings,
        pretrained_components=trainable_components,
        metadata=metadata,
    )
    print(f"pretrained LightZero initialization: {args.output.resolve()}")


if __name__ == "__main__":
    main()
