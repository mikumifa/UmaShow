from __future__ import annotations

from pathlib import Path

import onnx


def topologically_sort_graph(graph: onnx.GraphProto) -> None:
    available = {value.name for value in graph.input}
    available.update(value.name for value in graph.initializer)
    remaining = list(graph.node)
    ordered: list[onnx.NodeProto] = []
    while remaining:
        ready = [
            node
            for node in remaining
            if all(not name or name in available for name in node.input)
        ]
        if not ready:
            unresolved = ", ".join(node.name or node.op_type for node in remaining[:5])
            raise ValueError(f"could not topologically sort ONNX graph near: {unresolved}")
        for node in ready:
            remaining.remove(node)
            ordered.append(node)
            available.update(name for name in node.output if name)
    graph.ClearField("node")
    graph.node.extend(ordered)


def default_fp16_path(output: Path) -> Path:
    if output.suffix.lower() == ".onnx":
        return output.with_name(f"{output.stem}.fp16.onnx")
    return output.with_name(f"{output.name}.fp16.onnx")


def save_model_variants(
    model: onnx.ModelProto,
    metadata: dict[str, str],
    output: Path,
    fp16_output: Path | None,
) -> Path | None:
    fp32_metadata = {**metadata, "umashow.precision": "fp32"}
    onnx.helper.set_model_props(model, fp32_metadata)
    onnx.checker.check_model(model)
    onnx.save(model, output)

    if fp16_output is None:
        return None
    if fp16_output.resolve() == output.resolve():
        raise ValueError("FP16 output must be different from the FP32 output")

    try:
        from onnxruntime.transformers.float16 import convert_float_to_float16
    except ImportError as exception:
        raise RuntimeError(
            "FP16 export requires onnxruntime; run with "
            "`uv run --extra larc-graph`"
        ) from exception

    fp16_output.parent.mkdir(parents=True, exist_ok=True)
    fp16_model = convert_float_to_float16(model, keep_io_types=True)
    topologically_sort_graph(fp16_model.graph)
    onnx.helper.set_model_props(
        fp16_model,
        {
            **metadata,
            "umashow.precision": "fp16",
            "umashow.fp32_model": output.name,
        },
    )
    onnx.checker.check_model(fp16_model)
    onnx.save(fp16_model, fp16_output)
    return fp16_output
