from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from torch.utils.data import Dataset

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
            key: torch.from_numpy(value[index]) for key, value in self.arrays.items()
        }
