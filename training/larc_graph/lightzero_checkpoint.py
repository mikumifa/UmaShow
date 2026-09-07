from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

import torch
from torch import Tensor, nn

from training.larc_graph.schema import (
    LEARNED_CHANCE_GRADIENT,
    LIGHTZERO_ACTIONS,
    LIGHTZERO_COMMIT,
    LIGHTZERO_MODEL_FAMILY,
    LIGHTZERO_OBSERVATION,
    SCENARIO_ID,
    SCHEMA_VERSION,
    SCORE_SCALE,
)


PRETRAIN_FORMAT = "umashow_lightzero_legacy_pretrain_v1"
PRETRAINED_COMPONENTS = (
    "representation_network",
    "prediction_network",
)

_REQUIRED_FIELDS = {
    "format",
    "model",
    "model_config",
    "pretrained_components",
    "compatibility",
    "metadata",
}


def pretrain_compatibility() -> dict[str, object]:
    """Return the semantic contract required by a legacy warm-start model."""
    return {
        "graph_schema": SCHEMA_VERSION,
        "scenario_id": SCENARIO_ID,
        "score_scale": SCORE_SCALE,
        "model_family": LIGHTZERO_MODEL_FAMILY,
        "learned_chance_gradient": LEARNED_CHANCE_GRADIENT,
        "lightzero_commit": LIGHTZERO_COMMIT,
        "observation_features": LIGHTZERO_OBSERVATION,
        "action_space_size": LIGHTZERO_ACTIONS,
    }


def _json_value(value: object, label: str) -> object:
    """Copy metadata through JSON so weights-only loading stays portable."""
    try:
        encoded = json.dumps(value, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as exception:
        raise ValueError(f"{label} must contain only JSON-compatible values") from exception
    return json.loads(encoded)


def _different_fields(actual: Mapping[str, object], expected: Mapping[str, object]) -> list[str]:
    return sorted(
        key
        for key in set(actual) | set(expected)
        if actual.get(key) != expected.get(key)
    )


def _validate_model_state(model: nn.Module, state: object) -> Mapping[str, Tensor]:
    if not isinstance(state, Mapping) or not state:
        raise ValueError("pretrain checkpoint does not contain model weights")
    if any(not isinstance(key, str) for key in state):
        raise ValueError("pretrain checkpoint model keys must be strings")
    if any(not isinstance(value, Tensor) for value in state.values()):
        raise ValueError("pretrain checkpoint model values must be tensors")

    expected_state = model.state_dict()
    missing = sorted(set(expected_state) - set(state))
    unexpected = sorted(set(state) - set(expected_state))
    if missing or unexpected:
        details: list[str] = []
        if missing:
            details.append(f"missing keys: {', '.join(missing[:8])}")
        if unexpected:
            details.append(f"unexpected keys: {', '.join(unexpected[:8])}")
        raise ValueError("incompatible pretrain model state (" + "; ".join(details) + ")")

    incompatible_tensors: list[str] = []
    non_finite_tensors: list[str] = []
    for key, expected in expected_state.items():
        actual = state[key]
        if actual.shape != expected.shape or actual.dtype != expected.dtype:
            incompatible_tensors.append(
                f"{key}: got {tuple(actual.shape)}/{actual.dtype}, "
                f"expected {tuple(expected.shape)}/{expected.dtype}"
            )
        elif actual.is_floating_point() and not torch.isfinite(actual).all():
            non_finite_tensors.append(key)
    if incompatible_tensors:
        raise ValueError(
            "incompatible pretrain model tensors: " + "; ".join(incompatible_tensors[:8])
        )
    if non_finite_tensors:
        raise ValueError(
            "pretrain model contains non-finite tensors: "
            + ", ".join(non_finite_tensors[:8])
        )
    return state  # type: ignore[return-value]


def save_pretrain_checkpoint(
    path: Path,
    model: nn.Module,
    model_config: Mapping[str, Any],
    *,
    pretrained_components: Sequence[str] = PRETRAINED_COMPONENTS,
    metadata: Mapping[str, Any] | None = None,
) -> None:
    """Save model weights for a fresh LightZero run.

    This intentionally omits the target model, optimizer, learner counters, and
    replay data.  It is therefore not interchangeable with a LightZero resume
    checkpoint.
    """
    components = list(pretrained_components)
    if tuple(components) != PRETRAINED_COMPONENTS:
        raise ValueError(
            "legacy pretrain v1 must train exactly: "
            + ", ".join(PRETRAINED_COMPONENTS)
        )
    plain_config = _json_value(dict(model_config), "model_config")
    plain_metadata = _json_value(dict(metadata or {}), "metadata")
    state = {
        key: value.detach().cpu().clone()
        for key, value in model.state_dict().items()
    }
    checkpoint = {
        "format": PRETRAIN_FORMAT,
        "model": state,
        "model_config": plain_config,
        "pretrained_components": components,
        "compatibility": pretrain_compatibility(),
        "metadata": plain_metadata,
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(checkpoint, path)


def load_pretrain_checkpoint(
    path: Path,
    model: nn.Module,
    expected_model_config: Mapping[str, Any],
) -> dict[str, object]:
    """Strictly load legacy-distilled weights into an unwrapped model.

    Call this before passing ``model`` to ``train_muzero``.  The policy will
    then copy these weights into its target model and create a fresh optimizer.
    """
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"pretrain checkpoint not found: {path}")
    try:
        checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    except Exception as exception:
        raise ValueError(
            f"could not safely load pretrain checkpoint: {path}"
        ) from exception
    if not isinstance(checkpoint, dict):
        raise ValueError("pretrain checkpoint must be a dictionary")
    if checkpoint.get("format") != PRETRAIN_FORMAT:
        raise ValueError(
            "not an UmaShow legacy-to-LightZero pretrain checkpoint; "
            "the legacy graph .pt file cannot be loaded directly"
        )

    fields = set(checkpoint)
    missing_fields = sorted(_REQUIRED_FIELDS - fields)
    unexpected_fields = sorted(fields - _REQUIRED_FIELDS)
    if missing_fields or unexpected_fields:
        details: list[str] = []
        if missing_fields:
            details.append("missing fields: " + ", ".join(missing_fields))
        if unexpected_fields:
            details.append("unexpected fields: " + ", ".join(unexpected_fields))
        raise ValueError("invalid pretrain checkpoint envelope (" + "; ".join(details) + ")")
    actual_config = checkpoint["model_config"]
    if not isinstance(actual_config, Mapping):
        raise ValueError("pretrain checkpoint model_config must be a dictionary")
    expected_config = _json_value(dict(expected_model_config), "expected model_config")
    actual_config = _json_value(dict(actual_config), "checkpoint model_config")
    if actual_config != expected_config:
        assert isinstance(actual_config, dict)
        assert isinstance(expected_config, dict)
        differences = _different_fields(actual_config, expected_config)
        raise ValueError(
            "pretrain checkpoint model settings differ from this run: "
            + ", ".join(differences)
        )

    compatibility = checkpoint["compatibility"]
    if not isinstance(compatibility, Mapping):
        raise ValueError("pretrain checkpoint compatibility must be a dictionary")
    expected_compatibility = pretrain_compatibility()
    if dict(compatibility) != expected_compatibility:
        differences = _different_fields(dict(compatibility), expected_compatibility)
        raise ValueError(
            "pretrain checkpoint has incompatible UmaShow semantics: "
            + ", ".join(differences)
        )

    components = checkpoint["pretrained_components"]
    if not isinstance(components, list) or tuple(components) != PRETRAINED_COMPONENTS:
        raise ValueError(
            "pretrain checkpoint has unexpected pretrained components"
        )

    metadata = checkpoint["metadata"]
    if not isinstance(metadata, dict):
        raise ValueError("pretrain checkpoint metadata must be a dictionary")
    plain_metadata = _json_value(metadata, "checkpoint metadata")
    assert isinstance(plain_metadata, dict)
    state = _validate_model_state(model, checkpoint["model"])
    model.load_state_dict(state, strict=True)
    return {
        "format": PRETRAIN_FORMAT,
        "pretrained_components": list(PRETRAINED_COMPONENTS),
        "metadata": plain_metadata,
    }
