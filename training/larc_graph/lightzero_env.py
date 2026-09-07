from __future__ import annotations

import copy
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

import gymnasium as gym
import numpy as np
from ding.envs import BaseEnvTimestep
from ding.utils import ENV_REGISTRY
from easydict import EasyDict

try:
    from .schema import LIGHTZERO_ACTIONS, LIGHTZERO_OBSERVATION
except ImportError:
    from schema import LIGHTZERO_ACTIONS, LIGHTZERO_OBSERVATION  # type: ignore


PROTOCOL_PREFIX = "UMASHOW_JSON:"
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RECOMMENDATION_EXECUTABLE = (
    "UmaShowMonteCarloLArc.exe" if os.name == "nt" else "UmaShowMonteCarloLArc"
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


class NativeLArcEnvironment:
    def __init__(self, executable: Path, database: Path):
        if not executable.is_file():
            raise FileNotFoundError(f"recommendation executable not found: {executable}")
        if not database.is_file():
            raise FileNotFoundError(f"recommendation database not found: {database}")
        self._recent_output: list[str] = []
        self.process = subprocess.Popen(
            [str(executable), str(database)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        ready = self._read()
        if not ready.get("ok"):
            self.close()
            raise RuntimeError(ready.get("error", "native environment failed to start"))

    def request(self, command: str, **payload: Any) -> dict[str, Any]:
        if self.process.stdin is None:
            raise RuntimeError("native environment stdin is unavailable")
        request = {"id": str(uuid.uuid4()), "command": command, **payload}
        self.process.stdin.write(json.dumps(request, ensure_ascii=False) + "\n")
        self.process.stdin.flush()
        response = self._read()
        if not response.get("ok"):
            raise RuntimeError(response.get("error", f"{command} failed"))
        return response

    def _read(self) -> dict[str, Any]:
        if self.process.stdout is None:
            raise RuntimeError("native environment stdout is unavailable")
        while True:
            line = self.process.stdout.readline()
            if not line:
                detail = "\n".join(self._recent_output[-20:])
                raise RuntimeError(
                    "native environment stopped"
                    + (f":\n{detail}" if detail else "")
                )
            marker = line.find(PROTOCOL_PREFIX)
            if marker >= 0:
                return json.loads(line[marker + len(PROTOCOL_PREFIX) :])
            self._recent_output.append(line.rstrip())

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


@ENV_REGISTRY.register("umashow_larc")
class UmaShowLArcEnv(gym.Env):
    config = dict(
        env_id="umashow_larc",
        executable=str(
            REPOSITORY_ROOT / "assets" / "native" / RECOMMENDATION_EXECUTABLE
        ),
        database=str(REPOSITORY_ROOT / "assets" / "data" / "monte_carlo.json"),
        randomize_targets=True,
        collector_env_num=8,
        evaluator_env_num=4,
        n_evaluator_episode=4,
        stop_value=10.0,
    )

    @classmethod
    def default_config(cls) -> EasyDict:
        cfg = EasyDict(copy.deepcopy(cls.config))
        cfg.cfg_type = cls.__name__ + "Dict"
        return cfg

    def __init__(self, cfg: EasyDict | dict | None = None):
        merged = self.default_config()
        if cfg is not None:
            merged.update(cfg)
        self._cfg = merged
        self._native: NativeLArcEnvironment | None = None
        self._seed = 0
        self._episode = 0
        self._dynamic_seed = True
        self._action_space = gym.spaces.Discrete(LIGHTZERO_ACTIONS)
        self._observation_space = gym.spaces.Box(
            low=-4.0,
            high=4.0,
            shape=(LIGHTZERO_OBSERVATION,),
            dtype=np.float16,
        )
        self._reward_space = gym.spaces.Box(
            low=-4.0, high=4.0, shape=(), dtype=np.float32
        )

    def _client(self) -> NativeLArcEnvironment:
        if self._native is None:
            self._native = NativeLArcEnvironment(
                Path(self._cfg.executable).resolve(),
                Path(self._cfg.database).resolve(),
            )
        return self._native

    @staticmethod
    def _observation(response: dict[str, Any]) -> dict[str, np.ndarray | int]:
        observation = np.asarray(response["observation"], dtype=np.float16)
        action_mask = np.asarray(response["actionMask"], dtype=np.int8)
        if observation.shape != (LIGHTZERO_OBSERVATION,):
            raise ValueError(
                f"native observation shape {observation.shape}, "
                f"expected {(LIGHTZERO_OBSERVATION,)}"
            )
        if action_mask.shape != (LIGHTZERO_ACTIONS,):
            raise ValueError(
                f"native action mask shape {action_mask.shape}, "
                f"expected {(LIGHTZERO_ACTIONS,)}"
            )
        return {
            "observation": observation,
            "action_mask": action_mask,
            "to_play": -1,
            "chance": 0,
            "timestep": int(response.get("turn", 0)),
        }

    def reset(self) -> dict[str, np.ndarray | int]:
        episode_seed = self._seed
        if self._dynamic_seed:
            episode_seed += self._episode * 1_000_003
            self._episode += 1
        response = self._client().request(
            "env-reset",
            seed=episode_seed,
            options={"randomizeTargets": bool(self._cfg.randomize_targets)},
        )
        return self._observation(response)

    def step(self, action: int) -> BaseEnvTimestep:
        action_value = int(np.asarray(action).item())
        response = self._client().request("env-step", action=action_value)
        done = bool(response["done"])
        info: dict[str, Any] = {
            "turn": int(response["turn"]),
            "recommendation_score": int(response["recommendationScore"]),
            "final_score": int(response["finalScore"]),
        }
        if done:
            info["eval_episode_return"] = float(response["episodeReturn"])
        return BaseEnvTimestep(
            self._observation(response),
            np.asarray(float(response["reward"]), dtype=np.float32),
            done,
            info,
        )

    def seed(self, seed: int, dynamic_seed: bool = True) -> None:
        self._seed = int(seed)
        self._episode = 0
        self._dynamic_seed = bool(dynamic_seed)

    @property
    def action_space(self) -> gym.spaces.Discrete:
        return self._action_space

    @property
    def observation_space(self) -> gym.spaces.Box:
        return self._observation_space

    @property
    def reward_space(self) -> gym.spaces.Box:
        return self._reward_space

    def close(self) -> None:
        if self._native is not None:
            self._native.close()
            self._native = None

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass

    def __repr__(self) -> str:
        return "UmaShow LArc stochastic training environment"

    @staticmethod
    def create_collector_env_cfg(cfg: dict) -> list[dict]:
        value = copy.deepcopy(cfg)
        count = int(value.pop("collector_env_num"))
        value.pop("evaluator_env_num", None)
        value.pop("n_evaluator_episode", None)
        return [copy.deepcopy(value) for _ in range(count)]

    @staticmethod
    def create_evaluator_env_cfg(cfg: dict) -> list[dict]:
        value = copy.deepcopy(cfg)
        count = int(value.pop("evaluator_env_num"))
        value.pop("collector_env_num", None)
        value.pop("n_evaluator_episode", None)
        return [copy.deepcopy(value) for _ in range(count)]
