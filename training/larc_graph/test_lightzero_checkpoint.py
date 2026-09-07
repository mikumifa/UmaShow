from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import torch

from training.larc_graph.lightzero_checkpoint import (
    PRETRAIN_FORMAT,
    PRETRAINED_COMPONENTS,
    load_pretrain_checkpoint,
    save_pretrain_checkpoint,
)
from training.larc_graph.lightzero_model import LArcStochasticMuZeroModelMLP


def small_model_config() -> dict[str, object]:
    return {
        "model_type": "mlp",
        "observation_shape": 12,
        "action_space_size": 5,
        "chance_space_size": 4,
        "latent_state_dim": 16,
        "reward_head_hidden_channels": [8],
        "value_head_hidden_channels": [8],
        "policy_head_hidden_channels": [8],
        "reward_support_range": [-1.0, 1.01, 0.01],
        "value_support_range": [-2.0, 3.01, 0.02],
        "categorical_distribution": True,
        "self_supervised_learning_loss": False,
        "discrete_action_encoding_type": "one_hot",
        "norm_type": "LN",
        "state_norm": True,
        "res_connection_in_dynamics": True,
        "frame_stack_num": 1,
    }


def make_model(config: dict[str, object]) -> LArcStochasticMuZeroModelMLP:
    settings = dict(config)
    settings.pop("model_type")
    settings.pop("frame_stack_num")
    return LArcStochasticMuZeroModelMLP(**settings)


class LightZeroCheckpointTest(unittest.TestCase):
    def test_round_trip_loads_only_model_weights(self) -> None:
        config = small_model_config()
        source = make_model(config)
        destination = make_model(config)
        with torch.no_grad():
            for parameter in source.parameters():
                parameter.fill_(0.125)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(
                path,
                source,
                config,
                metadata={"epochs": 2, "source": "legacy-v0.pt"},
            )
            raw = torch.load(path, map_location="cpu", weights_only=True)
            self.assertEqual(raw["format"], PRETRAIN_FORMAT)
            self.assertNotIn("optimizer", raw)
            self.assertNotIn("target_model", raw)
            info = load_pretrain_checkpoint(path, destination, config)

        self.assertEqual(info["pretrained_components"], list(PRETRAINED_COMPONENTS))
        self.assertEqual(info["metadata"]["epochs"], 2)
        for key, value in source.state_dict().items():
            self.assertTrue(torch.equal(value, destination.state_dict()[key]), key)

    def test_rejects_model_config_mismatch_before_loading(self) -> None:
        config = small_model_config()
        source = make_model(config)
        destination = make_model(config)
        original = {
            key: value.detach().clone()
            for key, value in destination.state_dict().items()
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(path, source, config)
            incompatible = dict(config)
            incompatible["action_space_size"] = 6
            with self.assertRaisesRegex(ValueError, "action_space_size"):
                load_pretrain_checkpoint(path, destination, incompatible)
        for key, value in original.items():
            self.assertTrue(torch.equal(value, destination.state_dict()[key]), key)

    def test_rejects_semantic_compatibility_mismatch(self) -> None:
        config = small_model_config()
        model = make_model(config)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(path, model, config)
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
            checkpoint["compatibility"]["graph_schema"] += 1
            torch.save(checkpoint, path)
            with self.assertRaisesRegex(ValueError, "graph_schema"):
                load_pretrain_checkpoint(path, make_model(config), config)

    def test_rejects_incomplete_model_state(self) -> None:
        config = small_model_config()
        model = make_model(config)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(path, model, config)
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
            checkpoint["model"].pop(next(iter(checkpoint["model"])))
            torch.save(checkpoint, path)
            with self.assertRaisesRegex(ValueError, "missing keys"):
                load_pretrain_checkpoint(path, make_model(config), config)

    def test_rejects_non_finite_model_state(self) -> None:
        config = small_model_config()
        model = make_model(config)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pretrain.pth.tar"
            save_pretrain_checkpoint(path, model, config)
            checkpoint = torch.load(path, map_location="cpu", weights_only=True)
            key = next(
                name
                for name, value in checkpoint["model"].items()
                if value.is_floating_point() and value.numel() > 0
            )
            checkpoint["model"][key].reshape(-1)[0] = torch.nan
            torch.save(checkpoint, path)
            with self.assertRaisesRegex(ValueError, "non-finite tensors"):
                load_pretrain_checkpoint(path, make_model(config), config)

    def test_rejects_legacy_graph_checkpoint_shape(self) -> None:
        config = small_model_config()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.pt"
            torch.save(
                {
                    "schema_version": 2,
                    "model_config": {},
                    "model_state": {},
                },
                path,
            )
            with self.assertRaisesRegex(ValueError, "cannot be loaded directly"):
                load_pretrain_checkpoint(path, make_model(config), config)


if __name__ == "__main__":
    unittest.main()
