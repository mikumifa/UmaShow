from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
import sys
import uuid
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
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--policy-temperature", type=float, default=80.0)
    parser.add_argument("--play-temperature", type=float, default=120.0)
    parser.add_argument("--play-exploration", type=float, default=0.08)
    parser.add_argument("--radical-factor", type=float, default=3.0)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--model-path", type=Path)
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


def main() -> None:
    args = parse_args()
    if args.games <= 0:
        raise ValueError("--games must be positive")
    if not 1 <= args.games_per_request <= 16:
        raise ValueError("--games-per-request must be between 1 and 16")
    if args.shard_size <= 0:
        raise ValueError("--shard-size must be positive")
    executable = args.executable.resolve()
    database = args.database.resolve()
    if not executable.is_file():
        raise FileNotFoundError(f"recommendation executable not found: {executable}")
    if not database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {database}")

    process = subprocess.Popen(
        [str(executable), str(database)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    ready = read_protocol(process)
    if not ready.get("ok"):
        raise RuntimeError(ready.get("error", "recommendation process failed to start"))

    pending: dict[str, list[np.ndarray]] = {}
    pending_count = 0
    total_samples = 0
    completed_games = 0
    shard_index = next_shard_index(args.output_dir)
    base_seed = args.seed if args.seed is not None else secrets.randbelow(2**32)
    interrupted = False
    assert process.stdin is not None
    try:
        while completed_games < args.games:
            request_games = min(
                args.games_per_request,
                args.games - completed_games,
            )
            options: dict[str, Any] = {
                "gameCount": request_games,
                "searchSingleMax": args.searches,
                "threadNum": args.threads,
                "radicalFactor": args.radical_factor,
                "playTemperature": args.play_temperature,
                "playExploration": args.play_exploration,
                "randomizeTargets": not args.no_random_targets,
            }
            if args.model_path:
                options["modelPath"] = str(args.model_path.resolve())
            request = {
                "id": str(uuid.uuid4()),
                "command": "selfplay",
                "seed": (base_seed + completed_games) & 0xFFFFFFFF,
                "options": options,
            }
            process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
            process.stdin.flush()
            response = read_protocol(process)
            if not response.get("ok"):
                raise RuntimeError(response.get("error", "self-play generation failed"))

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

            completed_games += int(response.get("gameCount", request_games))
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
                        "latestFinalScores": final_scores,
                        "fallbacks": int(response.get("fallbackCount", 0)),
                    },
                    ensure_ascii=False,
                )
            )
    except KeyboardInterrupt:
        interrupted = True
        print("generation interrupted; saving the completed samples...")
    finally:
        try:
            process.stdin.close()
        except (BrokenPipeError, OSError):
            pass
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)

    if pending_count:
        output = write_shard(args.output_dir, shard_index, pending)
        print(f"wrote {pending_count} samples to {output}")
    print(f"generated {total_samples} samples from {completed_games} games")
    if interrupted:
        print("run the same command again to append more shards")


if __name__ == "__main__":
    main()
