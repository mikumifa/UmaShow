from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import statistics
import subprocess
import sys
import time
import uuid
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Any


PROTOCOL_PREFIX = "UMASHOW_JSON:"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RECOMMENDATION_EXECUTABLE = (
    "UmaShowMonteCarloLArc.exe" if os.name == "nt" else "UmaShowMonteCarloLArc"
)
STATUS_NAMES = ("speed", "stamina", "power", "guts", "wisdom")
OPENING_KEYS = (
    "umaId",
    "umaStars",
    "cards",
    "blueInheritance",
    "extraInheritance",
    "targets",
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate a legacy LArc graph ONNX model against the built-in "
            "hand-written Monte Carlo policy on paired simulator seeds"
        )
    )
    parser.add_argument("model", type=Path, help="legacy graph ONNX model")
    parser.add_argument("--games", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20260907)
    parser.add_argument(
        "--workers",
        type=int,
        default=min(4, os.cpu_count() or 1),
        help="number of native simulator processes",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=1,
        help="threads used by the built-in policy in each simulator process",
    )
    parser.add_argument(
        "--builtin-searches",
        type=int,
        default=128,
        help="full rollouts per legal action for the built-in policy",
    )
    parser.add_argument("--model-nodes", type=int, default=128)
    parser.add_argument("--model-depth", type=int, default=5)
    parser.add_argument("--model-time-ms", type=int, default=30_000)
    parser.add_argument("--inference-batch-size", type=int, default=32)
    parser.add_argument("--model-top-k", type=int, default=4)
    parser.add_argument("--chance-outcomes", type=int, default=8)
    parser.add_argument("--cpuct", type=float, default=1.5)
    parser.add_argument("--radical-factor", type=float, default=3.0)
    parser.add_argument("--no-random-targets", action="store_true")
    for status in STATUS_NAMES:
        parser.add_argument(f"--target-{status}", type=int, default=0)
    parser.add_argument(
        "--output",
        type=Path,
        help="optional JSON file containing the configuration, paired games, and summary",
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
    if not 1 <= args.workers <= 32:
        raise ValueError("--workers must be between 1 and 32")
    if not 1 <= args.threads <= 32:
        raise ValueError("--threads must be between 1 and 32")
    if not 1 <= args.builtin_searches <= 65_536:
        raise ValueError("--builtin-searches must be between 1 and 65536")
    if not 16 <= args.model_nodes <= 8_192:
        raise ValueError("--model-nodes must be between 16 and 8192")
    if not 1 <= args.model_depth <= 16:
        raise ValueError("--model-depth must be between 1 and 16")
    if not 50 <= args.model_time_ms <= 30_000:
        raise ValueError("--model-time-ms must be between 50 and 30000")
    if not 1 <= args.inference_batch_size <= 64:
        raise ValueError("--inference-batch-size must be between 1 and 64")
    if not 1 <= args.model_top_k <= 12:
        raise ValueError("--model-top-k must be between 1 and 12")
    if not 1 <= args.chance_outcomes <= 32:
        raise ValueError("--chance-outcomes must be between 1 and 32")
    if not 0.0 <= args.cpuct <= 20.0:
        raise ValueError("--cpuct must be between 0 and 20")
    if not 0.0 <= args.radical_factor <= 20.0:
        raise ValueError("--radical-factor must be between 0 and 20")
    for status in STATUS_NAMES:
        value = int(getattr(args, f"target_{status}"))
        if not 0 <= value <= 3_000:
            raise ValueError(f"--target-{status} must be between 0 and 3000")

    args.model = args.model.resolve()
    args.executable = args.executable.resolve()
    args.database = args.database.resolve()
    if not args.model.is_file():
        raise FileNotFoundError(f"model not found: {args.model}")
    if not args.executable.is_file():
        raise FileNotFoundError(
            f"recommendation executable not found: {args.executable}"
        )
    if not args.database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {args.database}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class SimulatorWorker:
    def __init__(self, executable: Path, database: Path):
        self.process = subprocess.Popen(
            [str(executable), str(database)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        try:
            ready = self._read()
            if not ready.get("ok"):
                raise RuntimeError(
                    ready.get("error", "recommendation process failed to start")
                )
        except BaseException:
            self.close()
            raise

    def _read(self) -> dict[str, Any]:
        if self.process.stdout is None:
            raise RuntimeError("recommendation process stdout is unavailable")
        while True:
            line = self.process.stdout.readline()
            if not line:
                stderr = self.process.stderr.read() if self.process.stderr else ""
                raise RuntimeError(f"recommendation process stopped: {stderr}")
            marker = line.find(PROTOCOL_PREFIX)
            if marker >= 0:
                return json.loads(line[marker + len(PROTOCOL_PREFIX) :])

    def rollout(
        self,
        seed: int,
        options: dict[str, Any],
        require_model: bool = False,
    ) -> tuple[dict[str, Any], float]:
        if self.process.stdin is None:
            raise RuntimeError("recommendation process stdin is unavailable")
        request = {
            "id": str(uuid.uuid4()),
            "command": "selfplay",
            "seed": seed,
            "options": {**options, "gameCount": 1, "collectSamples": False},
        }
        started_at = time.perf_counter()
        self.process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
        self.process.stdin.flush()
        response = self._read()
        elapsed_seconds = time.perf_counter() - started_at
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "evaluation rollout failed"))
        if require_model and int(response.get("fallbackCount", 0)) > 0:
            raise RuntimeError(
                "the requested model fell back to the built-in policy; "
                "fix model loading before evaluating it"
            )
        games = response.get("games")
        if not isinstance(games, list) or len(games) != 1:
            raise RuntimeError("evaluation rollout returned an unexpected game count")
        return games[0], elapsed_seconds

    def close(self) -> None:
        if self.process.stdin is not None and not self.process.stdin.closed:
            try:
                self.process.stdin.close()
            except (BrokenPipeError, OSError):
                pass
        if self.process.poll() is not None:
            return
        self.process.terminate()
        try:
            self.process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=10)


def common_options(args: argparse.Namespace) -> dict[str, Any]:
    options: dict[str, Any] = {
        "searchSingleMax": args.builtin_searches,
        "threadNum": args.threads,
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


def evaluate_pair(
    worker: SimulatorWorker,
    index: int,
    seed: int,
    args: argparse.Namespace,
) -> dict[str, Any]:
    builtin_options = common_options(args)
    model_options = {
        **builtin_options,
        "modelPath": str(args.model),
        "requireModel": True,
        "graphSearchNodes": args.model_nodes,
        "graphSearchDepth": args.model_depth,
        "graphSearchTimeMs": args.model_time_ms,
        "graphInferenceBatchSize": args.inference_batch_size,
        "graphSearchTopK": args.model_top_k,
        "graphSearchChanceOutcomes": args.chance_outcomes,
        "graphSearchCpuct": args.cpuct,
    }

    if index % 2 == 0:
        builtin, builtin_seconds = worker.rollout(seed, builtin_options)
        model, model_seconds = worker.rollout(
            seed, model_options, require_model=True
        )
    else:
        model, model_seconds = worker.rollout(
            seed, model_options, require_model=True
        )
        builtin, builtin_seconds = worker.rollout(seed, builtin_options)

    mismatches = [key for key in OPENING_KEYS if builtin.get(key) != model.get(key)]
    if mismatches:
        raise RuntimeError(
            f"paired seed {seed} produced different openings: {', '.join(mismatches)}"
        )

    model_final_score = int(model["finalScore"])
    builtin_final_score = int(builtin["finalScore"])
    model_recommendation_score = int(model["recommendationScore"])
    builtin_recommendation_score = int(builtin["recommendationScore"])
    return {
        "index": index,
        "seed": seed,
        "openingSeed": model.get("seed"),
        "opening": {key: model.get(key) for key in OPENING_KEYS},
        "model": {
            "finalScore": model_final_score,
            "recommendationScore": model_recommendation_score,
            "finalStatus": model.get("finalStatus"),
            "skillPt": model.get("skillPt"),
            "estimatedSkillScore": model.get("estimatedSkillScore"),
            "seconds": model_seconds,
        },
        "builtin": {
            "finalScore": builtin_final_score,
            "recommendationScore": builtin_recommendation_score,
            "finalStatus": builtin.get("finalStatus"),
            "skillPt": builtin.get("skillPt"),
            "estimatedSkillScore": builtin.get("estimatedSkillScore"),
            "seconds": builtin_seconds,
        },
        "delta": {
            "finalScore": model_final_score - builtin_final_score,
            "recommendationScore": (
                model_recommendation_score - builtin_recommendation_score
            ),
            "seconds": model_seconds - builtin_seconds,
        },
    }


def percentile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def describe(values: list[float]) -> dict[str, float | int]:
    if not values:
        raise ValueError("cannot summarize an empty evaluation")
    return {
        "count": len(values),
        "mean": statistics.fmean(values),
        "stdev": statistics.stdev(values) if len(values) > 1 else 0.0,
        "min": min(values),
        "p25": percentile(values, 0.25),
        "median": statistics.median(values),
        "p75": percentile(values, 0.75),
        "max": max(values),
    }


def comparison(rows: list[dict[str, Any]], metric: str) -> dict[str, Any]:
    model = [float(row["model"][metric]) for row in rows]
    builtin = [float(row["builtin"][metric]) for row in rows]
    delta = [left - right for left, right in zip(model, builtin)]
    wins = sum(value > 0 for value in delta)
    losses = sum(value < 0 for value in delta)
    ties = len(delta) - wins - losses
    delta_stdev = statistics.stdev(delta) if len(delta) > 1 else 0.0
    standard_error = delta_stdev / math.sqrt(len(delta))
    mean_delta = statistics.fmean(delta)
    return {
        "model": describe(model),
        "builtin": describe(builtin),
        "delta": describe(delta),
        "modelWins": wins,
        "builtinWins": losses,
        "ties": ties,
        "modelWinRateExcludingTies": wins / (wins + losses) if wins + losses else 0.0,
        "meanDelta95CiNormal": [
            mean_delta - 1.96 * standard_error,
            mean_delta + 1.96 * standard_error,
        ],
        "pairedEffectSizeDz": mean_delta / delta_stdev if delta_stdev > 0 else 0.0,
    }


def status_summary(rows: list[dict[str, Any]], policy: str) -> dict[str, float] | None:
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
            "model": describe([float(row["model"]["seconds"]) for row in rows]),
            "builtin": describe([float(row["builtin"]["seconds"]) for row in rows]),
        },
    }
    for metric in ("skillPt", "estimatedSkillScore"):
        if all(
            isinstance(row[policy].get(metric), (int, float))
            for row in rows
            for policy in ("model", "builtin")
        ):
            summary[metric] = comparison(rows, metric)
    model_status = status_summary(rows, "model")
    builtin_status = status_summary(rows, "builtin")
    if model_status is not None and builtin_status is not None:
        summary["meanFinalStatus"] = {
            "model": model_status,
            "builtin": builtin_status,
            "delta": {
                name: model_status[name] - builtin_status[name]
                for name in STATUS_NAMES
            },
        }
    return summary


def output_payload(
    args: argparse.Namespace,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    targets = {
        status: int(getattr(args, f"target_{status}")) for status in STATUS_NAMES
    }
    return {
        "evaluation": "legacy-graph-vs-builtin-paired-rollout",
        "config": {
            "model": str(args.model),
            "modelSha256": sha256(args.model),
            "executable": str(args.executable),
            "executableSha256": sha256(args.executable),
            "database": str(args.database),
            "databaseSha256": sha256(args.database),
            "gamesRequested": args.games,
            "seed": args.seed,
            "workers": min(args.workers, args.games),
            "threadsPerWorker": args.threads,
            "builtinSearches": args.builtin_searches,
            "modelNodes": args.model_nodes,
            "modelDepth": args.model_depth,
            "modelTimeMs": args.model_time_ms,
            "inferenceBatchSize": args.inference_batch_size,
            "modelTopK": args.model_top_k,
            "chanceOutcomes": args.chance_outcomes,
            "cpuct": args.cpuct,
            "radicalFactor": args.radical_factor,
            "randomizeTargets": not args.no_random_targets,
            "targets": targets,
            "deterministicActionSelection": True,
        },
        "summary": build_summary(rows),
        "games": rows,
    }


def write_output(path: Path, payload: dict[str, Any]) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as destination:
        json.dump(payload, destination, ensure_ascii=False, indent=2)
        destination.write("\n")
    print(f"wrote evaluation to {path}")


def main() -> None:
    args = parse_args()
    validate_args(args)
    worker_count = min(args.workers, args.games)
    available_cpus = os.cpu_count()
    if available_cpus and worker_count * args.threads > available_cpus:
        print(
            f"warning: {worker_count} workers x {args.threads} threads exceeds "
            f"{available_cpus} available CPUs",
            file=sys.stderr,
        )

    workers: list[SimulatorWorker] = []
    try:
        for _ in range(worker_count):
            workers.append(SimulatorWorker(args.executable, args.database))
    except BaseException:
        for worker in workers:
            worker.close()
        raise

    executor = ThreadPoolExecutor(max_workers=worker_count)
    in_flight: dict[Future[dict[str, Any]], SimulatorWorker] = {}
    rows_by_index: dict[int, dict[str, Any]] = {}
    next_index = 0
    interrupted = False

    def submit(worker: SimulatorWorker) -> None:
        nonlocal next_index
        if next_index >= args.games:
            return
        index = next_index
        next_index += 1
        game_seed = (args.seed + index) & 0xFFFFFFFFFFFFFFFF
        future = executor.submit(evaluate_pair, worker, index, game_seed, args)
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
                completed = len(rows_by_index)
                print(
                    json.dumps(
                        {
                            "completedGames": completed,
                            "requestedGames": args.games,
                            "seed": row["seed"],
                            "modelFinalScore": row["model"]["finalScore"],
                            "builtinFinalScore": row["builtin"]["finalScore"],
                            "finalScoreDelta": row["delta"]["finalScore"],
                        },
                        ensure_ascii=False,
                    )
                )
                submit(worker)
    except KeyboardInterrupt:
        interrupted = True
        print("evaluation interrupted; saving completed paired games...", file=sys.stderr)
    finally:
        for future in in_flight:
            future.cancel()
        for worker in workers:
            worker.close()
        executor.shutdown(wait=True)

    rows = [rows_by_index[index] for index in sorted(rows_by_index)]
    if not rows:
        raise RuntimeError("evaluation completed no paired games")
    payload = output_payload(args, rows)
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))
    if args.output is not None:
        write_output(args.output, payload)
    if interrupted:
        raise SystemExit(130)


if __name__ == "__main__":
    main()
