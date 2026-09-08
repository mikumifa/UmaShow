from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from torch.utils.data import Dataset, IterableDataset, get_worker_info

try:
    from .schema import FEATURE_SHAPES, SCHEMA_VERSION, TARGET_SHAPES
except ImportError:
    from schema import FEATURE_SHAPES, SCHEMA_VERSION, TARGET_SHAPES  # type: ignore


class GraphDataset(Dataset[dict[str, torch.Tensor]]):
    def __init__(self, files: Iterable[str | Path]):
        paths = [Path(path) for path in files]
        if not paths:
            raise ValueError("no dataset shards were provided")

        chunks: dict[str, list[np.ndarray]] = {
            key: [] for key in (*FEATURE_SHAPES, *TARGET_SHAPES)
        }
        sample_count = 0
        for path in paths:
            with np.load(path, allow_pickle=False) as shard:
                version = int(np.asarray(shard["schema_version"]).item())
                if version != SCHEMA_VERSION:
                    raise ValueError(
                        f"{path}: schema {version} != expected {SCHEMA_VERSION}"
                    )
                shard_count = int(shard["global_features"].shape[0])
                for key, expected in {**FEATURE_SHAPES, **TARGET_SHAPES}.items():
                    value = np.asarray(shard[key], dtype=np.float32)
                    if value.shape != (shard_count, *expected):
                        raise ValueError(
                            f"{path}: {key} shape {value.shape}, expected "
                            f"{(shard_count, *expected)}"
                        )
                    chunks[key].append(value)
                sample_count += shard_count

        self.arrays = {
            key: np.concatenate(values, axis=0) for key, values in chunks.items()
        }
        self.sample_count = sample_count

    def __len__(self) -> int:
        return self.sample_count

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        return {
            key: torch.as_tensor(value[index]) for key, value in self.arrays.items()
        }


class ShardedGraphDataset(IterableDataset[dict[str, torch.Tensor]]):
    """Read compressed shards one at a time instead of expanding all data in RAM."""

    def __init__(
        self,
        files: Iterable[str | Path],
        *,
        shuffle: bool,
        seed: int,
    ):
        self.paths = [Path(path) for path in files]
        if not self.paths:
            raise ValueError("no dataset shards were provided")
        self.shuffle = shuffle
        self.seed = seed
        self.epoch = 0
        self.sample_count = sum(self._validate_header(path) for path in self.paths)

    @staticmethod
    def _validate_header(path: Path) -> int:
        with np.load(path, allow_pickle=False) as shard:
            version = int(np.asarray(shard["schema_version"]).item())
            if version != SCHEMA_VERSION:
                raise ValueError(
                    f"{path}: schema {version} != expected {SCHEMA_VERSION}"
                )
            shard_count = int(shard["global_features"].shape[0])
            for key, expected in {**FEATURE_SHAPES, **TARGET_SHAPES}.items():
                if shard[key].shape != (shard_count, *expected):
                    raise ValueError(
                        f"{path}: {key} shape {shard[key].shape}, expected "
                        f"{(shard_count, *expected)}"
                    )
        return shard_count

    def __len__(self) -> int:
        return self.sample_count

    def set_epoch(self, epoch: int) -> None:
        self.epoch = epoch

    def __iter__(self):  # type: ignore[no-untyped-def]
        worker = get_worker_info()
        worker_id = worker.id if worker is not None else 0
        worker_count = worker.num_workers if worker is not None else 1
        rng = np.random.default_rng(self.seed + self.epoch)
        path_order = np.arange(len(self.paths))
        if self.shuffle:
            rng.shuffle(path_order)
        path_order = path_order[worker_id::worker_count]

        for path_index in path_order:
            path = self.paths[int(path_index)]
            with np.load(path, allow_pickle=False) as shard:
                arrays = {
                    key: np.asarray(shard[key], dtype=np.float32)
                    for key in (*FEATURE_SHAPES, *TARGET_SHAPES)
                }
            sample_order = np.arange(arrays["global_features"].shape[0])
            if self.shuffle:
                rng.shuffle(sample_order)
            for sample_index in sample_order:
                yield {
                    key: torch.as_tensor(value[int(sample_index)])
                    for key, value in arrays.items()
                }
