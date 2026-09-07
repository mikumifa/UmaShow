from __future__ import annotations

import argparse
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
    LIGHTZERO_ACTIONS,
    LIGHTZERO_COMMIT,
    LIGHTZERO_MANIFEST,
    LIGHTZERO_MODEL_FAMILY,
    LIGHTZERO_OBSERVATION,
    SCENARIO_ID,
    SCHEMA_VERSION,
    SCORE_SCALE,
)


TOTAL_TURNS = 65
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
    parser.add_argument(
        "--resume",
        "--model-path",
        dest="resume",
        type=Path,
        help="continue from a LightZero .pth.tar checkpoint",
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
    main_config = EasyDict(
        dict(
            exp_name=str(experiment_dir),
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
                action_type="fixed_action_space",
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
                monitor_extra_statistics=False,
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
    except Exception as exception:
        raise RuntimeError(
            "LightZero failed to import. Run `uv sync --extra larc-graph` after "
            "updating the repository; do not manually downgrade UmaShow's protobuf."
        ) from exception

    main_config, create_config = build_config(args)
    args.experiment_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = write_model_manifest(args, args.experiment_dir.resolve())
    policy = train_muzero(
        [main_config, create_config],
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
