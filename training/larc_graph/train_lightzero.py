from __future__ import annotations

import argparse
import importlib
import json
import os
import platform
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from easydict import EasyDict

from training.larc_graph.schema import (
    LEARNED_CHANCE_GRADIENT,
    LIGHTZERO_ACTIONS,
    LIGHTZERO_CHANCE_SEARCH,
    LIGHTZERO_COMMIT,
    LIGHTZERO_MANIFEST,
    LIGHTZERO_MODEL_FAMILY,
    LIGHTZERO_OBSERVATION,
    SCENARIO_ID,
    SCHEMA_VERSION,
    SCORE_SCALE,
)


# The native LightZero environment exposes exactly 60 decision steps per game.
# Keep both the full-return TD horizon and --games conversion aligned with the
# observed environment trajectory length.
TOTAL_TURNS = 60
RECOMMENDATION_EXECUTABLE = (
    "UmaShowMonteCarloLArc.exe" if os.name == "nt" else "UmaShowMonteCarloLArc"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train the LArc recommendation model with LightZero Stochastic MuZero"
    )
    parser.add_argument("--games", type=int, default=100_000)
    parser.add_argument("--collector-envs", type=int, default=8)
    parser.add_argument("--evaluator-envs", type=int, default=4)
    parser.add_argument("--simulations", type=int, default=128)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--updates-per-collect", type=int, default=64)
    parser.add_argument("--replay-buffer-size", type=int, default=250_000)
    parser.add_argument("--reanalyze-ratio", type=float, default=0.25)
    parser.add_argument("--chance-space-size", type=int, default=32)
    parser.add_argument("--latent-state-dim", type=int, default=256)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--eval-freq", type=int, default=1_000)
    parser.add_argument("--seed", type=int, default=20260907)
    parser.add_argument(
        "--experiment-dir",
        type=Path,
        default=REPOSITORY_ROOT / "training/larc_graph/runs/stochastic-muzero",
    )
    initialization = parser.add_mutually_exclusive_group()
    initialization.add_argument(
        "--resume",
        "--model-path",
        dest="resume",
        type=Path,
        help="continue from a full LightZero .pth.tar checkpoint",
    )
    initialization.add_argument(
        "--init-weights",
        "--warm-start",
        dest="init_weights",
        type=Path,
        help=(
            "start a fresh run from weights produced by "
            "pretrain_lightzero_from_legacy.py"
        ),
    )
    parser.add_argument("--checkpoint-every", type=int, default=1_000)
    parser.add_argument("--no-random-targets", action="store_true")
    parser.add_argument("--cpu", action="store_true")
    parser.add_argument(
        "--no-ctree",
        action="store_true",
        help="use the slower Python MCTS implementation",
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


def model_config(args: argparse.Namespace) -> dict:
    return dict(
        model_type="mlp",
        observation_shape=LIGHTZERO_OBSERVATION,
        action_space_size=LIGHTZERO_ACTIONS,
        chance_space_size=args.chance_space_size,
        latent_state_dim=args.latent_state_dim,
        reward_head_hidden_channels=[128],
        value_head_hidden_channels=[128],
        policy_head_hidden_channels=[128],
        reward_support_range=[-1.0, 1.01, 0.01],
        value_support_range=[-2.0, 3.01, 0.02],
        categorical_distribution=True,
        self_supervised_learning_loss=True,
        discrete_action_encoding_type="one_hot",
        norm_type="LN",
        state_norm=True,
        res_connection_in_dynamics=True,
        frame_stack_num=1,
    )


def model_manifest(args: argparse.Namespace) -> dict:
    return {
        "formatVersion": 1,
        "algorithm": "stochastic_muzero",
        "modelFamily": LIGHTZERO_MODEL_FAMILY,
        "graphSchema": SCHEMA_VERSION,
        "scenarioId": SCENARIO_ID,
        "scoreScale": SCORE_SCALE,
        "learnedChanceGradient": LEARNED_CHANCE_GRADIENT,
        "chanceSearch": LIGHTZERO_CHANCE_SEARCH,
        "observationFeatures": LIGHTZERO_OBSERVATION,
        "actionSpaceSize": LIGHTZERO_ACTIONS,
        "lightZeroCommit": LIGHTZERO_COMMIT,
        "model": model_config(args),
    }


def write_model_manifest(args: argparse.Namespace, experiment_dir: Path) -> Path:
    path = experiment_dir / LIGHTZERO_MANIFEST
    manifest = model_manifest(args)
    if path.is_file():
        existing = json.loads(path.read_text(encoding="utf-8"))
        if existing != manifest:
            raise ValueError(
                f"training model settings differ from existing manifest: {path}"
            )
        return path
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def build_config(args: argparse.Namespace) -> tuple[EasyDict, EasyDict]:
    experiment_dir = args.experiment_dir.resolve()
    # LightZero prefixes log/checkpoint paths with ``./``.  Passing an absolute
    # path therefore turns ``/root/...`` into the repository-local
    # ``.//root/...``.  Always give it a path relative to the launch directory;
    # ``os.path.relpath`` also supports experiment directories outside the repo.
    lightzero_experiment_dir = os.path.relpath(experiment_dir, Path.cwd())
    main_config = EasyDict(
        dict(
            exp_name=lightzero_experiment_dir,
            env=dict(
                env_id="umashow_larc",
                stop_value=10.0,
                executable=str(args.executable.resolve()),
                database=str(args.database.resolve()),
                randomize_targets=not args.no_random_targets,
                collector_env_num=args.collector_envs,
                evaluator_env_num=args.evaluator_envs,
                n_evaluator_episode=args.evaluator_envs,
                manager=dict(shared_memory=False),
            ),
            policy=dict(
                model=model_config(args),
                model_path=None,
                cuda=not args.cpu,
                mcts_ctree=not args.no_ctree,
                env_type="not_board_games",
                # Every LArc turn exposes a different subset of the 40 actions.
                # LightZero stores MCTS visits only for legal actions, so these
                # distributions must be expanded back to the full action space
                # before they are assembled into a training batch.
                action_type="varied_action_space",
                battle_mode="play_with_bot_mode",
                use_ture_chance_label_in_chance_encoder=False,
                game_segment_length=80,
                collector_env_num=args.collector_envs,
                evaluator_env_num=args.evaluator_envs,
                n_episode=args.collector_envs,
                num_simulations=args.simulations,
                update_per_collect=args.updates_per_collect,
                batch_size=args.batch_size,
                replay_buffer_size=args.replay_buffer_size,
                reanalyze_ratio=args.reanalyze_ratio,
                num_unroll_steps=5,
                td_steps=TOTAL_TURNS,
                discount_factor=1.0,
                optim_type="Adam",
                learning_rate=args.learning_rate,
                weight_decay=1e-4,
                target_update_freq=100,
                grad_clip_value=5.0,
                reward_loss_weight=1.0,
                value_loss_weight=0.5,
                policy_loss_weight=1.0,
                afterstate_policy_loss_weight=1.0,
                afterstate_value_loss_weight=0.5,
                commitment_loss_weight=1.0,
                ssl_loss_weight=1.0,
                use_priority=True,
                use_max_priority_for_new_data=True,
                priority_prob_alpha=0.6,
                priority_prob_beta=0.4,
                root_dirichlet_alpha=0.3,
                root_noise_weight=0.25,
                manual_temperature_decay=True,
                threshold_training_steps_for_final_temperature=100_000,
                fixed_temperature_value=0.25,
                eval_freq=args.eval_freq,
                random_collect_episode_num=0,
                # The pinned LightZero stochastic policy always reads its
                # ``td_data`` logging tuple.  That tuple is only constructed
                # when extra statistics are enabled in this revision.
                monitor_extra_statistics=True,
                analyze_chance_distribution=False,
                use_wandb=False,
                learn=dict(
                    learner=dict(
                        hook=dict(save_ckpt_after_iter=args.checkpoint_every),
                    ),
                ),
            ),
        )
    )
    create_config = EasyDict(
        dict(
            env=dict(
                type="umashow_larc",
                import_names=["training.larc_graph.lightzero_env"],
            ),
            env_manager=dict(type="subprocess"),
            policy=dict(
                type="stochastic_muzero",
                import_names=["lzero.policy.stochastic_muzero"],
            ),
        )
    )
    return main_config, create_config


def train_with_stable_experiment_dir(
    train_muzero: object,
    configs: list[EasyDict],
    *,
    model: object,
    seed: int,
    model_path: str | None,
    max_env_step: int,
) -> object:
    """Run LightZero without silently redirecting an existing run directory."""
    train_module = importlib.import_module("lzero.entry.train_muzero")
    original_compile_config = train_module.compile_config

    def compile_config_without_renew(*args: object, **kwargs: object) -> EasyDict:
        # The manifest is intentionally written before training, which means the
        # experiment directory already exists.  DI-engine otherwise appends a
        # timestamp and sends logs/checkpoints to a directory unknown to us.
        kwargs["renew_dir"] = False
        return original_compile_config(*args, **kwargs)

    train_module.compile_config = compile_config_without_renew
    try:
        return train_muzero(
            configs,
            seed=seed,
            model=model,
            model_path=model_path,
            max_env_step=max_env_step,
        )
    finally:
        train_module.compile_config = original_compile_config


def main() -> None:
    args = parse_args()
    if args.games <= 0:
        raise ValueError("--games must be positive")
    if args.collector_envs <= 0 or args.evaluator_envs <= 0:
        raise ValueError("environment counts must be positive")
    if args.checkpoint_every <= 0:
        raise ValueError("--checkpoint-every must be positive")
    if args.resume is not None and not args.resume.is_file():
        raise FileNotFoundError(f"checkpoint not found: {args.resume}")
    if args.init_weights is not None and not args.init_weights.is_file():
        raise FileNotFoundError(
            f"pretrained weights not found: {args.init_weights}"
        )
    if not args.executable.is_file():
        raise FileNotFoundError(f"recommendation executable not found: {args.executable}")
    if not args.database.is_file():
        raise FileNotFoundError(f"recommendation database not found: {args.database}")

    # DI-engine imports its legacy WandB dependency even when use_wandb is false.
    # WandB 0.12 contains old generated protobuf files, while UmaShow uses
    # protobuf 6 for its current database definitions. This compatibility mode
    # is used only for the disabled WandB import, not for model computation or
    # simulator communication.
    os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"

    try:
        import torch
    except Exception as exception:
        if sys.platform.startswith("linux") and "libcudnn.so.9" in str(exception):
            raise RuntimeError(
                "PyTorch CUDA runtime is incomplete: libcudnn.so.9 is missing. "
                "A plain `uv sync` can leave a damaged environment unchanged when "
                "the package metadata still exists. Move `.venv` aside, then run "
                "`uv venv --python 3.10` and `uv sync --extra larc-graph`; start "
                "training with `env -u LD_LIBRARY_PATH .venv/bin/python ...`, not "
                "`uv run`. To repair in place, run `uv sync --extra larc-graph "
                "--reinstall-package nvidia-cudnn-cu12 --reinstall-package torch`."
            ) from exception
        raise RuntimeError(
            "PyTorch failed to load. Recreate .venv and run "
            "`uv sync --extra larc-graph`; do not reuse a mixed CUDA environment."
        ) from exception

    if (
        not args.cpu
        and sys.platform.startswith("linux")
        and platform.machine().lower() in {"amd64", "x86_64"}
    ):
        if torch.__version__ != "2.6.0+cu124" or torch.version.cuda != "12.4":
            raise RuntimeError(
                "Linux GPU training requires torch 2.6.0+cu124. "
                f"Current torch={torch.__version__}, CUDA={torch.version.cuda}. "
                "Recreate .venv and run `uv sync --extra larc-graph`."
            )
        if not torch.cuda.is_available():
            raise RuntimeError(
                "CUDA is unavailable. Check the NVIDIA driver and start training with "
                "`env -u LD_LIBRARY_PATH .venv/bin/python ...`."
            )
        print(f"training device: {torch.cuda.get_device_name(0)}")

    try:
        from lzero.entry import train_muzero
        from training.larc_graph.lightzero_checkpoint import (
            load_pretrain_checkpoint,
        )
        from training.larc_graph.lightzero_model import (
            LArcStochasticMuZeroModelMLP,
        )
        from training.larc_graph.lightzero_runtime import (
            configure_stochastic_muzero_chance_space,
        )
    except Exception as exception:
        raise RuntimeError(
            "LightZero failed to import. Run `uv sync --extra larc-graph` after "
            "updating the repository; do not manually downgrade UmaShow's protobuf."
        ) from exception

    search_patch = configure_stochastic_muzero_chance_space(
        args.chance_space_size
    )
    print(
        "configured stochastic MCTS chance space: "
        f"{search_patch['chance_space_size']} ({search_patch['patch']})"
    )
    main_config, create_config = build_config(args)
    settings = model_config(args)
    model = LArcStochasticMuZeroModelMLP(**settings)
    if args.init_weights is not None:
        initialization = load_pretrain_checkpoint(
            args.init_weights.resolve(), model, settings
        )
        print(
            "initialized LightZero weights: "
            f"{args.init_weights.resolve()} "
            f"({', '.join(initialization['pretrained_components'])})"
        )
    args.experiment_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = write_model_manifest(args, args.experiment_dir.resolve())
    policy = train_with_stable_experiment_dir(
        train_muzero,
        [main_config, create_config],
        model=model,
        seed=args.seed,
        model_path=str(args.resume.resolve()) if args.resume else None,
        max_env_step=args.games * TOTAL_TURNS,
    )
    checkpoint_dir = args.experiment_dir.resolve() / "ckpt"
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    final_checkpoint = checkpoint_dir / "ckpt_final.pth.tar"
    torch.save(policy.learn_mode.state_dict(), final_checkpoint)
    print(f"final checkpoint: {final_checkpoint}")
    print(f"model manifest: {manifest_path}")


if __name__ == "__main__":
    main()
