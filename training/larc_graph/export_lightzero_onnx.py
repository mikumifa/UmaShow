from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import onnx
import torch
from torch import Tensor, nn

try:
    from .schema import (
        LIGHTZERO_ACTIONS,
        LIGHTZERO_MANIFEST,
        LIGHTZERO_MODEL_FAMILY,
        LIGHTZERO_OBSERVATION,
        SCENARIO_ID,
        SCHEMA_VERSION,
        SCORE_SCALE,
    )
except ImportError:
    from schema import (  # type: ignore
        LIGHTZERO_ACTIONS,
        LIGHTZERO_MANIFEST,
        LIGHTZERO_MODEL_FAMILY,
        LIGHTZERO_OBSERVATION,
        SCENARIO_ID,
        SCHEMA_VERSION,
        SCORE_SCALE,
    )


class InitialInferenceModel(nn.Module):
    def __init__(self, model: nn.Module, value_support_range: list[float]):
        super().__init__()
        self.model = model
        self.register_buffer(
            "value_support",
            torch.arange(*value_support_range, dtype=torch.float32).unsqueeze(0),
        )

    def forward(self, observation: Tensor) -> tuple[Tensor, Tensor]:
        output = self.model.initial_inference(observation)
        probabilities = torch.softmax(output.value, dim=1)
        transformed = (probabilities * self.value_support).sum(dim=1, keepdim=True)
        epsilon = 0.001
        inverse_root = (
            torch.sqrt(
                1.0
                + 4.0
                * epsilon
                * (torch.abs(transformed) + 1.0 + epsilon)
            )
            - 1.0
        ) / (2.0 * epsilon)
        value = torch.sign(transformed) * (inverse_root * inverse_root - 1.0)
        return output.policy_logits, value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a LightZero checkpoint for UmaShow"
    )
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--config", type=Path, help="path to umashow-model.json")
    parser.add_argument("--opset", type=int, default=18)
    return parser.parse_args()


def find_manifest(checkpoint: Path, explicit: Path | None) -> Path:
    if explicit is not None:
        if not explicit.is_file():
            raise FileNotFoundError(f"model manifest not found: {explicit}")
        return explicit
    candidates = (
        checkpoint.parent.parent / LIGHTZERO_MANIFEST,
        checkpoint.parent / LIGHTZERO_MANIFEST,
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        f"could not find {LIGHTZERO_MANIFEST}; pass it with --config"
    )


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    expected = {
        "modelFamily": LIGHTZERO_MODEL_FAMILY,
        "graphSchema": SCHEMA_VERSION,
        "scenarioId": SCENARIO_ID,
        "scoreScale": SCORE_SCALE,
        "observationFeatures": LIGHTZERO_OBSERVATION,
        "actionSpaceSize": LIGHTZERO_ACTIONS,
    }
    for key, value in expected.items():
        if manifest.get(key) != value:
            raise ValueError(f"model manifest has incompatible {key}")
    if not isinstance(manifest.get("model"), dict):
        raise ValueError("model manifest does not contain model settings")
    return manifest


def checkpoint_model_state(checkpoint: Any) -> dict[str, Tensor]:
    if not isinstance(checkpoint, dict):
        raise ValueError("LightZero checkpoint must be a dictionary")
    state = checkpoint.get("model", checkpoint.get("model_state"))
    if state is None and checkpoint and all(
        isinstance(value, Tensor) for value in checkpoint.values()
    ):
        state = checkpoint
    if not isinstance(state, dict) or not state:
        raise ValueError("checkpoint does not contain LightZero model weights")

    keys = tuple(str(key) for key in state)
    for prefix in ("module.", "_orig_mod."):
        if keys and all(key.startswith(prefix) for key in keys):
            return {str(key)[len(prefix) :]: value for key, value in state.items()}
    return state


def main() -> None:
    args = parse_args()
    if not args.checkpoint.is_file():
        raise FileNotFoundError(f"checkpoint not found: {args.checkpoint}")
    manifest_path = find_manifest(args.checkpoint.resolve(), args.config)
    manifest = load_manifest(manifest_path)

    try:
        from lzero.model.stochastic_muzero_model_mlp import (
            StochasticMuZeroModelMLP,
        )
    except ImportError as exception:
        raise RuntimeError(
            "LightZero is not installed; run `uv sync --extra larc-graph` first"
        ) from exception

    model_settings = dict(manifest["model"])
    model_settings.pop("model_type", None)
    model_settings.pop("frame_stack_num", None)
    value_support_range = list(model_settings["value_support_range"])
    model = StochasticMuZeroModelMLP(**model_settings)
    checkpoint = torch.load(
        args.checkpoint, map_location="cpu", weights_only=False
    )
    model.load_state_dict(checkpoint_model_state(checkpoint), strict=True)
    model.eval()
    exported_model = InitialInferenceModel(model, value_support_range).eval()

    dummy = torch.zeros(1, LIGHTZERO_OBSERVATION, dtype=torch.float32)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        exported_model,
        dummy,
        args.output,
        input_names=["observation"],
        output_names=["policy_logits", "value"],
        dynamic_axes={
            "observation": {0: "batch"},
            "policy_logits": {0: "batch"},
            "value": {0: "batch"},
        },
        opset_version=args.opset,
        do_constant_folding=True,
        dynamo=False,
    )

    exported = onnx.load(args.output)
    onnx.helper.set_model_props(
        exported,
        {
            "umashow.graph_schema": str(SCHEMA_VERSION),
            "umashow.scenario_id": str(SCENARIO_ID),
            "umashow.score_scale": str(SCORE_SCALE),
            "umashow.model_family": LIGHTZERO_MODEL_FAMILY,
            "umashow.algorithm": "stochastic_muzero",
            "umashow.value_semantics": "remaining_recommendation_return",
        },
    )
    onnx.checker.check_model(exported)
    onnx.save(exported, args.output)
    print(f"exported recommendation model: {args.output.resolve()}")


if __name__ == "__main__":
    main()
