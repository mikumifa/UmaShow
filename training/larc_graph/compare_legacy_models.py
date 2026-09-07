from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import subprocess
import sys
import tempfile
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from .evaluate_legacy import (
        OPENING_KEYS,
        RECOMMENDATION_EXECUTABLE,
        REPOSITORY_ROOT,
        STATUS_NAMES,
        SimulatorWorker,
        describe,
        sha256,
        write_output,
    )
except ImportError:
    from evaluate_legacy import (  # type: ignore
        OPENING_KEYS,
        RECOMMENDATION_EXECUTABLE,
        REPOSITORY_ROOT,
        STATUS_NAMES,
        SimulatorWorker,
        describe,
        sha256,
        write_output,
    )


EXPORTER = Path(__file__).with_name("export_onnx.py")


@dataclass(frozen=True)
class PreparedModel:
    source: Path
    onnx: Path
    source_sha256: str
    onnx_sha256: str
    exported: bool


class ModelPairWorker:
    def __init__(self, executable: Path, database: Path):
        self.model_a = SimulatorWorker(executable, database)
        try:
            self.model_b = SimulatorWorker(executable, database)
        except BaseException:
            self.model_a.close()
            raise

    def close(self) -> None:
        self.model_a.close()
        self.model_b.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare two legacy LArc graph checkpoints or ONNX models on "
            "identical paired simulator openings"
        )
    )
    parser.add_argument("model_a", type=Path, help="baseline .pt or .onnx model")
    parser.add_argument("model_b", type=Path, help="candidate .pt or .onnx model")
    parser.add_argument("--games", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260908)
    parser.add_argument(
        "--workers",
        type=int,
        default=min(4, max(1, (os.cpu_count() or 2) // 2)),
        help="parallel model pairs; each pair starts two native processes",
    )
    parser.add_argument("--nodes", type=int, default=64)
    parser.add_argument("--depth", type=int, default=8)
    parser.add_argument("--time-ms", type=int, default=30_000)
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--chance-outcomes", type=int, default=8)
    parser.add_argument("--cpuct", type=float, default=1.5)
    parser.add_argument(
        "--root-selection",
        choices=("puct", "gumbel"),
        default="puct",
    )
    parser.add_argument("--gumbel-max-actions", type=int, default=16)
    parser.add_argument("--gumbel-scale", type=float, default=0.0)
    parser.add_argument("--radical-factor", type=float, default=3.0)
    parser.add_argument("--no-random-targets", action="store_true")
    for status in STATUS_NAMES:
        parser.add_argument(f"--target-{status}", type=int, default=0)
    parser.add_argument(
        "--output",
        type=Path,
        help="optional JSON file containing paired games and aggregate results",
    )
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
    if not 1 <= args.workers <= 16:
        raise ValueError("--workers must be between 1 and 16")
    if not 16 <= args.nodes <= 8_192:
        raise ValueError("--nodes must be between 16 and 8192")
    if not 1 <= args.depth <= 16:
        raise ValueError("--depth must be between 1 and 16")
    if not 50 <= args.time_ms <= 30_000:
        raise ValueError("--time-ms must be between 50 and 30000")
    if not 1 <= args.top_k <= 12:
        raise ValueError("--top-k must be between 1 and 12")
    if not 1 <= args.chance_outcomes <= 32:
        raise ValueError("--chance-outcomes must be between 1 and 32")
    if not 0.0 <= args.cpuct <= 20.0:
        raise ValueError("--cpuct must be between 0 and 20")
    if not 1 <= args.gumbel_max_actions <= 48:
        raise ValueError("--gumbel-max-actions must be between 1 and 48")
    if not 0.0 <= args.gumbel_scale <= 10.0:
        raise ValueError("--gumbel-scale must be between 0 and 10")
    if not 0.0 <= args.radical_factor <= 20.0:
        raise ValueError("--radical-factor must be between 0 and 20")
    for status in STATUS_NAMES:
        value = int(getattr(args, f"target_{status}"))
        if not 0 <= value <= 3_000:
            raise ValueError(f"--target-{status} must be between 0 and 3000")

    args.model_a = args.model_a.resolve()
    args.model_b = args.model_b.resolve()
    args.executable = args.executable.resolve()
    args.database = args.database.resolve()
    if args.output is not None:
        args.output = args.output.resolve()
    for model in (args.model_a, args.model_b):
        if not model.is_file():
            raise FileNotFoundError(f"model not found: {model}")
        if model.suffix.lower() not in {".pt", ".onnx"}:
            raise ValueError(f"model must be a legacy .pt or .onnx file: {model}")
    if not args.executable.is_file():
        raise FileNotFoundError(
            f"recommendation executable not found: {args.executable}"
        )
    if not args.database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {args.database}")
    if not EXPORTER.is_file():
        raise FileNotFoundError(f"legacy ONNX exporter not found: {EXPORTER}")
    if args.output is not None:
        protected = {
            args.model_a,
            args.model_b,
            args.executable,
            args.database,
        }
        if args.output in protected:
            raise ValueError("--output must not overwrite an evaluation input file")
        if args.output.is_dir():
            raise ValueError("--output must be a file path, not a directory")


def prepare_model(source: Path, temporary: Path, name: str) -> PreparedModel:
    source_hash = sha256(source)
    if source.suffix.lower() == ".onnx":
        return PreparedModel(source, source, source_hash, source_hash, False)

    output = temporary / f"{name}.onnx"
    subprocess.run(
        [sys.executable, str(EXPORTER), str(source), str(output)],
        cwd=REPOSITORY_ROOT,
        check=True,
    )
    return PreparedModel(source, output, source_hash, sha256(output), True)


def model_options(
    args: argparse.Namespace,
    model: PreparedModel,
) -> dict[str, Any]:
    options: dict[str, Any] = {
        "modelPath": str(model.onnx),
        "requireModel": True,
        "graphSearchNodes": args.nodes,
        "graphSearchDepth": args.depth,
        "graphSearchTimeMs": args.time_ms,
        "graphSearchTopK": args.top_k,
        "graphSearchChanceOutcomes": args.chance_outcomes,
        "graphSearchCpuct": args.cpuct,
        "graphRootSelection": args.root_selection,
        "graphRootGumbelMaxActions": args.gumbel_max_actions,
        "graphRootGumbelScale": args.gumbel_scale,
        "radicalFactor": args.radical_factor,
        "randomizeTargets": not args.no_random_targets,
        "playExploration": 0.0,
        "playTemperature": 0.0,
        "visitTemperature": 0.0,
        "visitTemperatureAfter": 0.0,
        "rootDirichletAlpha": 0.0,
        "rootNoiseFraction": 0.0,
    }
    for status in STATUS_NAMES:
        value = int(getattr(args, f"target_{status}"))
        if value > 0:
            options[f"target{status.title()}"] = value
    return options


def policy_result(game: dict[str, Any], elapsed: float) -> dict[str, Any]:
    return {
        "finalScore": int(game["finalScore"]),
        "recommendationScore": int(game["recommendationScore"]),
        "finalStatus": game.get("finalStatus"),
        "skillPt": game.get("skillPt"),
        "estimatedSkillScore": game.get("estimatedSkillScore"),
        "seconds": elapsed,
    }


def evaluate_pair(
    worker: ModelPairWorker,
    index: int,
    seed: int,
    options_a: dict[str, Any],
    options_b: dict[str, Any],
) -> dict[str, Any]:
    if index % 2 == 0:
        game_a, seconds_a = worker.model_a.rollout(
            seed, options_a, require_model=True
        )
        game_b, seconds_b = worker.model_b.rollout(
            seed, options_b, require_model=True
        )
    else:
        game_b, seconds_b = worker.model_b.rollout(
            seed, options_b, require_model=True
        )
        game_a, seconds_a = worker.model_a.rollout(
            seed, options_a, require_model=True
        )

    mismatches = [
        key for key in OPENING_KEYS if game_a.get(key) != game_b.get(key)
    ]
    if mismatches:
        raise RuntimeError(
            f"paired seed {seed} produced different openings: {', '.join(mismatches)}"
        )

    model_a = policy_result(game_a, seconds_a)
    model_b = policy_result(game_b, seconds_b)
    return {
        "index": index,
        "seed": seed,
        "openingSeed": game_a.get("seed"),
        "opening": {key: game_a.get(key) for key in OPENING_KEYS},
        "modelA": model_a,
        "modelB": model_b,
        "deltaBMinusA": {
            "finalScore": model_b["finalScore"] - model_a["finalScore"],
            "recommendationScore": (
                model_b["recommendationScore"] - model_a["recommendationScore"]
            ),
            "seconds": seconds_b - seconds_a,
        },
    }


def comparison(rows: list[dict[str, Any]], metric: str) -> dict[str, Any]:
    model_a = [float(row["modelA"][metric]) for row in rows]
    model_b = [float(row["modelB"][metric]) for row in rows]
    delta = [right - left for left, right in zip(model_a, model_b, strict=True)]
    wins = sum(value > 0 for value in delta)
    losses = sum(value < 0 for value in delta)
    ties = len(delta) - wins - losses
    delta_stdev = statistics.stdev(delta) if len(delta) > 1 else 0.0
    standard_error = delta_stdev / math.sqrt(len(delta))
    mean_delta = statistics.fmean(delta)
    return {
        "modelA": describe(model_a),
        "modelB": describe(model_b),
        "deltaBMinusA": describe(delta),
        "modelBWins": wins,
        "modelAWins": losses,
        "ties": ties,
        "modelBWinRateExcludingTies": (
            wins / (wins + losses) if wins + losses else 0.0
        ),
        "meanDelta95CiNormal": [
            mean_delta - 1.96 * standard_error,
            mean_delta + 1.96 * standard_error,
        ],
        "pairedEffectSizeDz": mean_delta / delta_stdev if delta_stdev > 0 else 0.0,
    }


def status_summary(
    rows: list[dict[str, Any]], policy: str
) -> dict[str, float] | None:
    statuses = [row[policy].get("finalStatus") for row in rows]
    if not statuses or any(
        not isinstance(values, list) or len(values) != 5 for values in statuses
    ):
        return None
    return {
        name: statistics.fmean(float(values[index]) for values in statuses)
        for index, name in enumerate(STATUS_NAMES)
    }


def build_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "completedGames": len(rows),
        "finalScore": comparison(rows, "finalScore"),
        "recommendationScore": comparison(rows, "recommendationScore"),
        "secondsPerGame": {
            "modelA": describe([float(row["modelA"]["seconds"]) for row in rows]),
            "modelB": describe([float(row["modelB"]["seconds"]) for row in rows]),
        },
    }
    for metric in ("skillPt", "estimatedSkillScore"):
        if all(
            isinstance(row[policy].get(metric), (int, float))
            for row in rows
            for policy in ("modelA", "modelB")
        ):
            summary[metric] = comparison(rows, metric)
    status_a = status_summary(rows, "modelA")
    status_b = status_summary(rows, "modelB")
    if status_a is not None and status_b is not None:
        summary["meanFinalStatus"] = {
            "modelA": status_a,
            "modelB": status_b,
            "deltaBMinusA": {
                name: status_b[name] - status_a[name] for name in STATUS_NAMES
            },
        }
    return summary


def model_metadata(model: PreparedModel) -> dict[str, Any]:
    return {
        "source": str(model.source),
        "sourceSha256": model.source_sha256,
        "sourceFormat": model.source.suffix.lower().lstrip("."),
        "exportedTemporarily": model.exported,
        "onnxSha256": model.onnx_sha256,
    }


def output_payload(
    args: argparse.Namespace,
    model_a: PreparedModel,
    model_b: PreparedModel,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "evaluation": "legacy-graph-model-a-vs-model-b-paired-rollout",
        "comparisonDirection": "modelB-minus-modelA",
        "models": {
            "modelA": model_metadata(model_a),
            "modelB": model_metadata(model_b),
        },
        "config": {
            "executable": str(args.executable),
            "executableSha256": sha256(args.executable),
            "database": str(args.database),
            "databaseSha256": sha256(args.database),
            "gamesRequested": args.games,
            "seed": args.seed,
            "workers": min(args.workers, args.games),
            "nativeProcesses": 2 * min(args.workers, args.games),
            "nodes": args.nodes,
            "depth": args.depth,
            "timeMs": args.time_ms,
            "topK": args.top_k,
            "chanceOutcomes": args.chance_outcomes,
            "cpuct": args.cpuct,
            "rootSelection": args.root_selection,
            "gumbelMaxActions": args.gumbel_max_actions,
            "gumbelScale": args.gumbel_scale,
            "radicalFactor": args.radical_factor,
            "randomizeTargets": not args.no_random_targets,
            "targets": {
                status: int(getattr(args, f"target_{status}"))
                for status in STATUS_NAMES
            },
            "deterministicPlayTemperature": True,
        },
        "summary": build_summary(rows),
        "games": rows,
    }


def main() -> None:
    args = parse_args()
    validate_args(args)
    worker_count = min(args.workers, args.games)

    with tempfile.TemporaryDirectory(prefix="umashow-legacy-model-compare-") as name:
        temporary = Path(name)
        model_a = prepare_model(args.model_a, temporary, "model-a")
        model_b = prepare_model(args.model_b, temporary, "model-b")
        options_a = model_options(args, model_a)
        options_b = model_options(args, model_b)

        workers: list[ModelPairWorker] = []
        try:
            for _ in range(worker_count):
                workers.append(ModelPairWorker(args.executable, args.database))
        except BaseException:
            for worker in workers:
                worker.close()
            raise

        executor = ThreadPoolExecutor(max_workers=worker_count)
        in_flight: dict[Future[dict[str, Any]], ModelPairWorker] = {}
        rows_by_index: dict[int, dict[str, Any]] = {}
        next_index = 0
        interrupted = False

        def submit(worker: ModelPairWorker) -> None:
            nonlocal next_index
            if next_index >= args.games:
                return
            index = next_index
            next_index += 1
            seed = (args.seed + index) & 0xFFFFFFFFFFFFFFFF
            future = executor.submit(
                evaluate_pair,
                worker,
                index,
                seed,
                options_a,
                options_b,
            )
            in_flight[future] = worker

        try:
            for worker in workers:
                submit(worker)
            while in_flight:
                finished, _ = wait(in_flight, return_when=FIRST_COMPLETED)
                for future in finished:
                    worker = in_flight.pop(future)
                    row = future.result()
                    rows_by_index[int(row["index"])] = row
                    print(
                        json.dumps(
                            {
                                "completedGames": len(rows_by_index),
                                "requestedGames": args.games,
                                "seed": row["seed"],
                                "modelAFinalScore": row["modelA"]["finalScore"],
                                "modelBFinalScore": row["modelB"]["finalScore"],
                                "deltaBMinusA": row["deltaBMinusA"]["finalScore"],
                            },
                            ensure_ascii=False,
                        )
                    )
                    submit(worker)
        except KeyboardInterrupt:
            interrupted = True
            print(
                "comparison interrupted; saving completed pairs...",
                file=sys.stderr,
            )
        finally:
            for future in in_flight:
                future.cancel()
            for worker in workers:
                worker.close()
            executor.shutdown(wait=True, cancel_futures=True)

        rows = [rows_by_index[index] for index in sorted(rows_by_index)]
        if not rows:
            raise RuntimeError("comparison completed no paired games")
        payload = output_payload(args, model_a, model_b, rows)
        print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
        if args.output is not None:
            write_output(args.output, payload)
        if interrupted:
            raise SystemExit(130)


if __name__ == "__main__":
    main()
