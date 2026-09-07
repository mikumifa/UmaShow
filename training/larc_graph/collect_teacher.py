from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

import numpy as np

try:
    from .schema import (
        ACTION_FEATURES,
        GLOBAL_FEATURES,
        MAX_ACTIONS,
        MAX_PERSONS,
        PERSON_FEATURES,
        SCHEMA_VERSION,
        TRAINING_COUNT,
        TRAINING_FEATURES,
    )
except ImportError:
    from schema import (  # type: ignore
        ACTION_FEATURES,
        GLOBAL_FEATURES,
        MAX_ACTIONS,
        MAX_PERSONS,
        PERSON_FEATURES,
        SCHEMA_VERSION,
        TRAINING_COUNT,
        TRAINING_FEATURES,
    )


PROTOCOL_PREFIX = "UMASHOW_JSON:"
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
        description="Collect graph training samples from captured LArc state JSONL"
    )
    parser.add_argument("input", type=Path, help="one captured recommendation state per line")
    parser.add_argument("output", type=Path)
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
    parser.add_argument("--searches", type=int, default=4096)
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--temperature", type=float, default=80.0)
    parser.add_argument("--model-path", type=Path)
    parser.add_argument("--max-states", type=int, default=0)
    return parser.parse_args()


def read_protocol(process: subprocess.Popen[str]) -> dict[str, Any]:
    assert process.stdout is not None
    while True:
        line = process.stdout.readline()
        if not line:
            stderr = process.stderr.read() if process.stderr else ""
            raise RuntimeError(f"recommendation process stopped: {stderr}")
        marker = line.find(PROTOCOL_PREFIX)
        if marker >= 0:
            return json.loads(line[marker + len(PROTOCOL_PREFIX) :])


def extract_state(value: dict[str, Any]) -> dict[str, Any]:
    if isinstance(value.get("state"), dict):
        return value["state"]
    if int(value.get("scenarioId", 0)) == 6:
        return value
    raise ValueError("line is neither a captured state nor a direct LArc state")


def shaped_features(features: dict[str, Any]) -> dict[str, np.ndarray]:
    if int(features["schemaVersion"]) != SCHEMA_VERSION:
        raise ValueError("native feature schema does not match Python schema")
    result = {
        "global_features": np.asarray(features["globalFeatures"], dtype=np.float32),
        "person_features": np.asarray(features["personFeatures"], dtype=np.float32),
        "training_features": np.asarray(features["trainingFeatures"], dtype=np.float32),
        "placement": np.asarray(features["placement"], dtype=np.float32),
        "action_features": np.asarray(features["actionFeatures"], dtype=np.float32),
        "person_mask": np.asarray(features["personMask"], dtype=np.float32),
        "action_mask": np.asarray(features["actionMask"], dtype=np.float32),
    }
    expected = {
        "global_features": (GLOBAL_FEATURES,),
        "person_features": (MAX_PERSONS, PERSON_FEATURES),
        "training_features": (TRAINING_COUNT, TRAINING_FEATURES),
        "placement": (TRAINING_COUNT, MAX_PERSONS),
        "action_features": (MAX_ACTIONS, ACTION_FEATURES),
        "person_mask": (MAX_PERSONS,),
        "action_mask": (MAX_ACTIONS,),
    }
    for key, shape in expected.items():
        if result[key].shape != shape:
            raise ValueError(f"{key} shape {result[key].shape}, expected {shape}")
    return result


def targets(response: dict[str, Any], temperature: float) -> dict[str, np.ndarray]:
    features = response["graphFeatures"]
    action_ids = [int(value) for value in features["actionIds"]]
    index_by_id = {action_id: index for index, action_id in enumerate(action_ids)}
    q_target = np.full(MAX_ACTIONS, np.nan, dtype=np.float32)
    score_target = np.full(MAX_ACTIONS, np.nan, dtype=np.float32)
    visit_target = np.zeros(MAX_ACTIONS, dtype=np.float32)
    for action in response["actions"]:
        index = index_by_id.get(int(action["id"]))
        if index is None:
            continue
        q_target[index] = float(action["value"])
        score_target[index] = float(action["scoreMean"])
        visit_target[index] = max(0.0, float(action.get("searches", 0)))

    legal = np.isfinite(q_target)
    policy_target = np.zeros(MAX_ACTIONS, dtype=np.float32)
    use_visits = (
        response.get("policyTargetType") == "root-visits"
        and visit_target[legal].sum() > 0
    )
    if use_visits:
        policy_target[legal] = visit_target[legal] / visit_target[legal].sum()
    elif legal.any():
        logits = (q_target[legal] - np.nanmax(q_target)) / max(1e-3, temperature)
        logits = np.clip(logits, -80.0, 0.0)
        probabilities = np.exp(logits)
        probabilities /= probabilities.sum()
        policy_target[legal] = probabilities

    outcome_value = float(response.get("outcomeValue", response["bestValue"]))
    outcome_score = float(response.get("outcomeScore", response["predictedScore"]))
    played_index = index_by_id.get(int(response.get("playedActionId", -1)))
    if played_index is not None:
        q_target[played_index] = outcome_value
        score_target[played_index] = outcome_score
    return {
        "policy_target": policy_target,
        "q_target": q_target,
        "action_score_target": score_target,
        "value_target": np.asarray(outcome_value, dtype=np.float32),
        "state_score_target": np.asarray(outcome_score, dtype=np.float32),
    }


def main() -> None:
    args = parse_args()
    process = subprocess.Popen(
        [str(args.executable.resolve()), str(args.database.resolve())],
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

    samples: dict[str, list[np.ndarray]] = {}
    assert process.stdin is not None
    try:
        with args.input.open("r", encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                if not line.strip():
                    continue
                state = extract_state(json.loads(line))
                options: dict[str, Any] = {
                    "searchSingleMax": args.searches,
                    "threadNum": args.threads,
                    "exportGraphFeatures": True,
                }
                if args.model_path:
                    options["modelPath"] = str(args.model_path.resolve())
                request = {
                    "id": str(uuid.uuid4()),
                    "state": state,
                    "options": options,
                }
                process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
                process.stdin.flush()
                response = read_protocol(process)
                if not response.get("ok"):
                    raise RuntimeError(
                        f"line {line_number}: {response.get('error', 'analysis failed')}"
                    )
                sample = {
                    **shaped_features(response["graphFeatures"]),
                    **targets(response, args.temperature),
                }
                for key, value in sample.items():
                    samples.setdefault(key, []).append(value)
                count = len(samples["global_features"])
                print(
                    json.dumps(
                        {
                            "sample": count,
                            "line": line_number,
                            "turn": response.get("turn"),
                            "bestAction": response.get("bestAction"),
                            "backend": response.get("backend"),
                        },
                        ensure_ascii=False,
                    )
                )
                if args.max_states > 0 and count >= args.max_states:
                    break
    finally:
        process.stdin.close()
        process.terminate()
        process.wait(timeout=10)

    if not samples:
        raise ValueError("no samples were collected")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(
        args.output,
        schema_version=np.asarray(SCHEMA_VERSION, dtype=np.int32),
        **{key: np.stack(values) for key, values in samples.items()},
    )
    size_mb = args.output.stat().st_size / math.pow(1024, 2)
    print(f"wrote {len(samples['global_features'])} samples to {args.output} ({size_mb:.1f} MiB)")


if __name__ == "__main__":
    main()
