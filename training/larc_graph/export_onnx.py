from __future__ import annotations

import argparse
from pathlib import Path

import onnx
import torch

try:
    from .model import LArcGraphNetwork, ModelConfig
    from .onnx_export import default_fp16_path, save_model_variants
    from .schema import (
        ACTION_FEATURES,
        GLOBAL_FEATURES,
        INPUT_NAMES,
        MAX_ACTIONS,
        MAX_PERSONS,
        OUTPUT_NAMES,
        PERSON_FEATURES,
        SCENARIO_ID,
        SCHEMA_VERSION,
        SCORE_SCALE,
        TRAINING_COUNT,
        TRAINING_FEATURES,
    )
except ImportError:
    from model import LArcGraphNetwork, ModelConfig  # type: ignore
    from onnx_export import default_fp16_path, save_model_variants  # type: ignore
    from schema import (  # type: ignore
        ACTION_FEATURES,
        GLOBAL_FEATURES,
        INPUT_NAMES,
        MAX_ACTIONS,
        MAX_PERSONS,
        OUTPUT_NAMES,
        PERSON_FEATURES,
        SCENARIO_ID,
        SCHEMA_VERSION,
        SCORE_SCALE,
        TRAINING_COUNT,
        TRAINING_FEATURES,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a trained model for UmaShow")
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--opset", type=int, default=18)
    parser.add_argument(
        "--fp16-output",
        type=Path,
        help="GPU FP16 output path; defaults to <output stem>.fp16.onnx",
    )
    parser.add_argument(
        "--no-fp16",
        action="store_true",
        help="only export the general FP32 model",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    if int(checkpoint.get("schema_version", -1)) != SCHEMA_VERSION:
        raise ValueError("checkpoint schema version does not match this exporter")
    config = ModelConfig(**checkpoint["model_config"])
    model = LArcGraphNetwork(config)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    dummy = (
        torch.zeros(1, GLOBAL_FEATURES, dtype=torch.float32),
        torch.zeros(1, MAX_PERSONS, PERSON_FEATURES, dtype=torch.float32),
        torch.zeros(1, TRAINING_COUNT, TRAINING_FEATURES, dtype=torch.float32),
        torch.zeros(1, TRAINING_COUNT, MAX_PERSONS, dtype=torch.float32),
        torch.zeros(1, MAX_ACTIONS, ACTION_FEATURES, dtype=torch.float32),
        torch.ones(1, MAX_PERSONS, dtype=torch.float32),
        torch.ones(1, MAX_ACTIONS, dtype=torch.float32),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        dummy,
        args.output,
        input_names=list(INPUT_NAMES),
        output_names=list(OUTPUT_NAMES),
        dynamic_axes={name: {0: "batch"} for name in (*INPUT_NAMES, *OUTPUT_NAMES)},
        opset_version=args.opset,
        do_constant_folding=True,
        dynamo=False,
    )

    exported = onnx.load(args.output)
    fp16_output = None if args.no_fp16 else (
        args.fp16_output or default_fp16_path(args.output)
    )
    saved_fp16 = save_model_variants(
        exported,
        {
            "umashow.graph_schema": str(SCHEMA_VERSION),
            "umashow.scenario_id": str(SCENARIO_ID),
            "umashow.score_scale": str(SCORE_SCALE),
            "umashow.model_family": "larc_sparse_graph_v2",
        },
        args.output,
        fp16_output,
    )

    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(args.output), providers=["CPUExecutionProvider"])
        values = {
            name: tensor.numpy() for name, tensor in zip(INPUT_NAMES, dummy, strict=True)
        }
        outputs = session.run(list(OUTPUT_NAMES), values)
        print(
            f"exported {args.output} ({model.parameter_count():,} parameters); "
            f"smoke outputs={[tuple(value.shape) for value in outputs]}; "
            f"GPU FP16={saved_fp16 or 'disabled'}"
        )
    except ImportError:
        print(
            f"exported {args.output} ({model.parameter_count():,} parameters); "
            f"GPU FP16={saved_fp16 or 'disabled'}; "
            "onnxruntime smoke test skipped"
        )


if __name__ == "__main__":
    main()
