from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader, random_split

try:
    from .dataset import GraphDataset, ShardedGraphDataset
    from .losses import policy_cross_entropy, quantile_huber_loss
    from .model import LArcGraphNetwork, ModelConfig
    from .schema import SCORE_SCALE, SCHEMA_VERSION
except ImportError:
    from dataset import GraphDataset, ShardedGraphDataset  # type: ignore
    from losses import policy_cross_entropy, quantile_huber_loss  # type: ignore
    from model import LArcGraphNetwork, ModelConfig  # type: ignore
    from schema import SCORE_SCALE, SCHEMA_VERSION  # type: ignore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the LArc graph recommendation model")
    parser.add_argument("data", nargs="+", help="NPZ shards or glob patterns")
    parser.add_argument("--output", type=Path, default=Path("checkpoints/larc_graph.pt"))
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=3e-4)
    parser.add_argument("--weight-decay", type=float, default=1e-4)
    parser.add_argument("--validation-ratio", type=float, default=0.05)
    parser.add_argument("--workers", type=int, default=0)
    parser.add_argument(
        "--streaming",
        action="store_true",
        help="load one compressed shard at a time instead of all samples into RAM",
    )
    parser.add_argument("--seed", type=int, default=20260907)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--message-layers", type=int, default=2)
    parser.add_argument("--attention-heads", type=int, default=4)
    parser.add_argument("--dropout", type=float, default=0.05)
    parser.add_argument("--init-checkpoint", type=Path)
    parser.add_argument("--training-round", type=int, default=-1)
    return parser.parse_args()


def resolve_data(patterns: list[str]) -> list[Path]:
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
        raise FileNotFoundError("no NPZ dataset shards matched")
    return unique


def choose_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def split_shards(
    files: list[Path], validation_ratio: float, seed: int
) -> tuple[list[Path], list[Path]]:
    if len(files) < 2:
        raise ValueError("streaming training requires at least two NPZ shards")
    generator = np.random.default_rng(seed)
    indices = generator.permutation(len(files))
    validation_count = min(
        max(1, round(len(files) * validation_ratio)), len(files) - 1
    )
    validation_indices = set(int(index) for index in indices[:validation_count])
    training_files = [
        path for index, path in enumerate(files) if index not in validation_indices
    ]
    validation_files = [
        path for index, path in enumerate(files) if index in validation_indices
    ]
    return training_files, validation_files


def move(batch: dict[str, torch.Tensor], device: torch.device) -> dict[str, torch.Tensor]:
    return {key: value.to(device, non_blocking=True) for key, value in batch.items()}


def calculate_loss(
    model: LArcGraphNetwork,
    batch: dict[str, torch.Tensor],
) -> tuple[torch.Tensor, dict[str, float]]:
    outputs = model(
        batch["global_features"],
        batch["person_features"],
        batch["training_features"],
        batch["placement"],
        batch["action_features"],
        batch["person_mask"],
        batch["action_mask"],
    )
    policy, q_quantiles, score_quantiles, value_quantiles, state_score_quantiles = outputs
    q_target = batch["q_target"] / SCORE_SCALE
    action_score_target = batch["action_score_target"] / SCORE_SCALE
    value_target = batch["value_target"] / SCORE_SCALE
    state_score_target = batch["state_score_target"] / SCORE_SCALE
    q_mask = torch.isfinite(q_target) & (batch["action_mask"] > 0.5)
    score_mask = torch.isfinite(action_score_target) & (batch["action_mask"] > 0.5)
    safe_q_target = torch.nan_to_num(q_target)
    safe_action_score = torch.nan_to_num(action_score_target)

    policy_loss = policy_cross_entropy(
        policy, batch["policy_target"], batch["action_mask"]
    )
    q_loss = quantile_huber_loss(q_quantiles, safe_q_target, q_mask)
    action_score_loss = quantile_huber_loss(
        score_quantiles, safe_action_score, score_mask
    )
    value_loss = quantile_huber_loss(value_quantiles, value_target)
    state_score_loss = quantile_huber_loss(state_score_quantiles, state_score_target)

    policy_weights = batch["policy_target"] * batch["action_mask"]
    policy_weights = policy_weights / policy_weights.sum(dim=-1, keepdim=True).clamp_min(
        1e-6
    )
    expected_q = (q_quantiles.mean(dim=-1) * policy_weights).sum(dim=-1)
    consistency_loss = torch.nn.functional.smooth_l1_loss(
        expected_q, value_quantiles.mean(dim=-1)
    )

    total = (
        policy_loss
        + q_loss
        + 0.35 * action_score_loss
        + value_loss
        + 0.35 * state_score_loss
        + 0.15 * consistency_loss
    )
    metrics = {
        "total": float(total.detach()),
        "policy": float(policy_loss.detach()),
        "q": float(q_loss.detach()),
        "value": float(value_loss.detach()),
        "score": float((action_score_loss + state_score_loss).detach()),
        "consistency": float(consistency_loss.detach()),
    }
    return total, metrics


@torch.no_grad()
def evaluate(
    model: LArcGraphNetwork,
    loader: DataLoader[dict[str, torch.Tensor]],
    device: torch.device,
) -> float:
    model.eval()
    totals: list[float] = []
    for batch in loader:
        loss, _ = calculate_loss(model, move(batch, device))
        totals.append(float(loss))
    return float(np.mean(totals)) if totals else 0.0


def main() -> None:
    args = parse_args()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    files = resolve_data(args.data)
    if not 0.0 < args.validation_ratio < 1.0:
        raise ValueError("--validation-ratio must be between 0 and 1")
    if args.streaming:
        training_files, validation_files = split_shards(
            files, args.validation_ratio, args.seed
        )
        training_set = ShardedGraphDataset(
            training_files, shuffle=True, seed=args.seed
        )
        validation_set = ShardedGraphDataset(
            validation_files, shuffle=False, seed=args.seed
        )
        training_count = len(training_set)
        validation_count = len(validation_set)
        dataset_count = training_count + validation_count
    else:
        dataset = GraphDataset(files)
        if len(dataset) < 2:
            raise ValueError("training requires at least two samples")
        validation_count = min(
            max(1, round(len(dataset) * args.validation_ratio)),
            max(1, len(dataset) - 1),
        )
        training_count = len(dataset) - validation_count
        generator = torch.Generator().manual_seed(args.seed)
        training_set, validation_set = random_split(
            dataset, [training_count, validation_count], generator=generator
        )
        dataset_count = len(dataset)
    device = choose_device(args.device)
    pin_memory = device.type == "cuda"
    train_loader = DataLoader(
        training_set,
        batch_size=args.batch_size,
        shuffle=not args.streaming,
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

    initial_checkpoint: dict[str, object] | None = None
    if args.init_checkpoint is not None:
        initial_checkpoint = torch.load(
            args.init_checkpoint, map_location="cpu", weights_only=False
        )
        if int(initial_checkpoint.get("schema_version", -1)) != SCHEMA_VERSION:
            raise ValueError("initial checkpoint schema does not match this trainer")
        config = ModelConfig(**initial_checkpoint["model_config"])
    else:
        config = ModelConfig(
            hidden_dim=args.hidden_dim,
            message_layers=args.message_layers,
            attention_heads=args.attention_heads,
            dropout=args.dropout,
        )
    model = LArcGraphNetwork(config).to(device)
    if initial_checkpoint is not None:
        model.load_state_dict(initial_checkpoint["model_state"])
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=args.learning_rate, weight_decay=args.weight_decay
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=max(1, args.epochs)
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    best_validation = float("inf")
    print(
        json.dumps(
            {
                "samples": dataset_count,
                "training": training_count,
                "validation": validation_count,
                "parameters": model.parameter_count(),
                "device": str(device),
                "initializedFrom": str(args.init_checkpoint.resolve())
                if args.init_checkpoint
                else None,
            },
            ensure_ascii=False,
        )
    )

    for epoch in range(1, args.epochs + 1):
        if args.streaming:
            training_set.set_epoch(epoch)
        model.train()
        running: list[float] = []
        for batch in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss, _ = calculate_loss(model, move(batch, device))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 2.0)
            optimizer.step()
            running.append(float(loss.detach()))
        scheduler.step()
        validation = evaluate(model, validation_loader, device)
        training = float(np.mean(running)) if running else 0.0
        print(
            json.dumps(
                {
                    "epoch": epoch,
                    "trainLoss": training,
                    "validationLoss": validation,
                    "learningRate": scheduler.get_last_lr()[0],
                },
                ensure_ascii=False,
            )
        )
        if validation <= best_validation:
            best_validation = validation
            torch.save(
                {
                    "schema_version": SCHEMA_VERSION,
                    "model_config": config.to_dict(),
                    "model_state": model.state_dict(),
                    "optimizer_state": optimizer.state_dict(),
                    "epoch": epoch,
                    "validation_loss": validation,
                    "training_round": args.training_round,
                    "parent_checkpoint": str(args.init_checkpoint.resolve())
                    if args.init_checkpoint
                    else None,
                },
                args.output,
            )


if __name__ == "__main__":
    main()
