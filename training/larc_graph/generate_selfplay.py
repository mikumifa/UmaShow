from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
import sys
import uuid
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from pathlib import Path
from typing import Any

import numpy as np

try:
    from .collect_teacher import read_protocol, shaped_features, targets
    from .schema import SCHEMA_VERSION
except ImportError:
    from collect_teacher import read_protocol, shaped_features, targets  # type: ignore
    from schema import SCHEMA_VERSION  # type: ignore


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RECOMMENDATION_EXECUTABLE = (
    "UmaShowMonteCarloLArc.exe" if os.name == "nt" else "UmaShowMonteCarloLArc"
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate LArc graph samples through simulator self-play"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPOSITORY_ROOT / "training/larc_graph/data/selfplay-v0",
    )
    parser.add_argument("--games", type=int, default=128)
    parser.add_argument("--games-per-request", type=int, default=1)
    parser.add_argument("--shard-size", type=int, default=1024)
    parser.add_argument("--searches", type=int, default=128)
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="number of simulator processes generating games in parallel",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=1,
        help="threads used inside each simulated game",
    )
    parser.add_argument("--policy-temperature", type=float, default=80.0)
    parser.add_argument("--teacher-play-temperature", type=float, default=120.0)
    parser.add_argument("--visit-temperature", type=float, default=1.0)
    parser.add_argument("--visit-temperature-drop-turn", type=int, default=40)
    parser.add_argument("--visit-temperature-after", type=float, default=0.15)
    parser.add_argument("--play-exploration", type=float, default=0.0)
    parser.add_argument("--search-depth", type=int, default=5)
    parser.add_argument("--search-time-ms", type=int, default=30_000)
    parser.add_argument("--search-top-k", type=int, default=4)
    parser.add_argument("--chance-outcomes", type=int, default=8)
    parser.add_argument("--cpuct", type=float, default=1.5)
    parser.add_argument("--root-dirichlet-alpha", type=float, default=0.3)
    parser.add_argument("--root-noise-fraction", type=float, default=0.25)
    parser.add_argument("--radical-factor", type=float, default=3.0)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--model-path", type=Path)
    parser.add_argument(
        "--allow-model-fallback",
        action="store_true",
        help="keep samples even if a requested model could not be loaded",
    )
    parser.add_argument("--no-random-targets", action="store_true")
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


def next_shard_index(output_dir: Path) -> int:
    indices: list[int] = []
    for path in output_dir.glob("selfplay-*.npz"):
        try:
            indices.append(int(path.stem.rsplit("-", 1)[1]))
        except (IndexError, ValueError):
            continue
    return max(indices, default=0) + 1


def write_shard(
    output_dir: Path,
    shard_index: int,
    samples: dict[str, list[np.ndarray]],
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / f"selfplay-{shard_index:06d}.npz"
    np.savez_compressed(
        output,
        schema_version=np.asarray(SCHEMA_VERSION, dtype=np.int32),
        **{key: np.stack(values) for key, values in samples.items()},
    )
    return output


def sample_arrays(sample: dict[str, Any], temperature: float) -> dict[str, np.ndarray]:
    return {
        **shaped_features(sample["graphFeatures"]),
        **targets(sample, temperature),
    }


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
            ready = read_protocol(self.process)
            if not ready.get("ok"):
                raise RuntimeError(
                    ready.get("error", "recommendation process failed to start")
                )
        except BaseException:
            self.close()
            raise

    def generate(
        self,
        game_count: int,
        seed: int,
        options: dict[str, Any],
    ) -> dict[str, Any]:
        request_options = dict(options)
        request_options["gameCount"] = game_count
        request = {
            "id": str(uuid.uuid4()),
            "command": "selfplay",
            "seed": seed,
            "options": request_options,
        }
        if self.process.stdin is None:
            raise RuntimeError("recommendation process stdin is unavailable")
        self.process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
        self.process.stdin.flush()
        response = read_protocol(self.process)
        if not response.get("ok"):
            raise RuntimeError(response.get("error", "self-play generation failed"))
        return response

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


def main() -> None:
    args = parse_args()
    if args.games <= 0:
        raise ValueError("--games must be positive")
    if not 1 <= args.games_per_request <= 16:
        raise ValueError("--games-per-request must be between 1 and 16")
    if not 1 <= args.workers <= 32:
        raise ValueError("--workers must be between 1 and 32")
    if not 1 <= args.threads <= 32:
        raise ValueError("--threads must be between 1 and 32")
    if args.shard_size <= 0:
        raise ValueError("--shard-size must be positive")
    executable = args.executable.resolve()
    database = args.database.resolve()
    if not executable.is_file():
        raise FileNotFoundError(f"recommendation executable not found: {executable}")
    if not database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {database}")

    pending: dict[str, list[np.ndarray]] = {}
    pending_count = 0
    total_samples = 0
    completed_games = 0
    scheduled_games = 0
    shard_index = next_shard_index(args.output_dir)
    base_seed = args.seed if args.seed is not None else secrets.randbelow(2**32)
    interrupted = False
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
            workers.append(SimulatorWorker(executable, database))
    except BaseException:
        for worker in workers:
            worker.close()
        raise

    options: dict[str, Any] = {
        "searchSingleMax": args.searches,
        "graphSearchNodes": args.searches,
        "graphSearchDepth": args.search_depth,
        "graphSearchTimeMs": args.search_time_ms,
        "graphSearchTopK": args.search_top_k,
        "graphSearchChanceOutcomes": args.chance_outcomes,
        "graphSearchCpuct": args.cpuct,
        "rootDirichletAlpha": args.root_dirichlet_alpha,
        "rootNoiseFraction": args.root_noise_fraction,
        "threadNum": args.threads,
        "radicalFactor": args.radical_factor,
        "playTemperature": args.teacher_play_temperature,
        "visitTemperature": args.visit_temperature,
        "visitTemperatureDropTurn": args.visit_temperature_drop_turn,
        "visitTemperatureAfter": args.visit_temperature_after,
        "playExploration": args.play_exploration,
        "randomizeTargets": not args.no_random_targets,
    }
    if args.model_path:
        options["modelPath"] = str(args.model_path.resolve())

    executor = ThreadPoolExecutor(max_workers=worker_count)
    in_flight: dict[
        Future[dict[str, Any]],
        tuple[SimulatorWorker, int],
    ] = {}

    def submit(worker: SimulatorWorker) -> None:
        nonlocal scheduled_games
        if scheduled_games >= args.games:
            return
        request_games = min(
            args.games_per_request,
            args.games - scheduled_games,
        )
        first_game = scheduled_games
        scheduled_games += request_games
        future = executor.submit(
            worker.generate,
            request_games,
            (base_seed + first_game) & 0xFFFFFFFF,
            options,
        )
        in_flight[future] = (worker, request_games)

    try:
        for worker in workers:
            submit(worker)
        while in_flight:
            finished, _ = wait(in_flight, return_when=FIRST_COMPLETED)
            for future in finished:
                worker, requested_games = in_flight.pop(future)
                response = future.result()
                response_games = int(response.get("gameCount", requested_games))
                if response_games != requested_games:
                    raise RuntimeError(
                        "self-play returned an unexpected number of games"
                    )
                fallback_count = int(response.get("fallbackCount", 0))
                if args.model_path and fallback_count and not args.allow_model_fallback:
                    raise RuntimeError(
                        "the requested model fell back to the built-in policy; "
                        "fix model loading before generating AlphaZero samples"
                    )

                response_samples = response.get("samples")
                if not isinstance(response_samples, list) or not response_samples:
                    raise RuntimeError("self-play returned no training samples")
                for raw_sample in response_samples:
                    arrays = sample_arrays(raw_sample, args.policy_temperature)
                    for key, value in arrays.items():
                        pending.setdefault(key, []).append(value)
                    pending_count += 1
                    total_samples += 1
                    if pending_count >= args.shard_size:
                        output = write_shard(args.output_dir, shard_index, pending)
                        print(f"wrote {pending_count} samples to {output}")
                        shard_index += 1
                        pending = {}
                        pending_count = 0

                completed_games += response_games
                final_scores = [
                    int(game.get("finalScore", 0))
                    for game in response.get("games", [])
                    if isinstance(game, dict)
                ]
                print(
                    json.dumps(
                        {
                            "games": completed_games,
                            "requestedGames": args.games,
                            "samples": total_samples,
                            "workers": worker_count,
                            "threadsPerGame": args.threads,
                            "latestFinalScores": final_scores,
                            "fallbacks": fallback_count,
                        },
                        ensure_ascii=False,
                    )
                )
                submit(worker)
    except KeyboardInterrupt:
        interrupted = True
        print("generation interrupted; saving the completed samples...")
    finally:
        for future in in_flight:
            future.cancel()
        for worker in workers:
            worker.close()
        executor.shutdown(wait=True, cancel_futures=True)

    if pending_count:
        output = write_shard(args.output_dir, shard_index, pending)
        print(f"wrote {pending_count} samples to {output}")
    print(f"generated {total_samples} samples from {completed_games} games")
    if interrupted:
        print("run the same command again to append more shards")


if __name__ == "__main__":
    main()
