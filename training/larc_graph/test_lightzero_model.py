from __future__ import annotations

import unittest

import torch
from lzero.model.stochastic_muzero_model_mlp import StochasticMuZeroModelMLP

from training.larc_graph.lightzero_model import (
    LArcStochasticMuZeroModelMLP,
    _PENDING_CHANCE_ONE_HOT,
)


class LArcStochasticMuZeroModelTest(unittest.TestCase):
    @staticmethod
    def model_config() -> dict[str, object]:
        return {
            "observation_shape": 8,
            "action_space_size": 4,
            "chance_space_size": 3,
            "latent_state_dim": 16,
            "reward_head_hidden_channels": [8],
            "value_head_hidden_channels": [8],
            "policy_head_hidden_channels": [8],
            "reward_support_range": [-1.0, 1.1, 0.1],
            "value_support_range": [-1.0, 1.1, 0.1],
            "self_supervised_learning_loss": False,
            "norm_type": "LN",
            "state_norm": True,
            "res_connection_in_dynamics": True,
        }

    def setUp(self) -> None:
        torch.manual_seed(7)
        self.model = LArcStochasticMuZeroModelMLP(**self.model_config())
        self.model.train()

    def transition(self) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        observation = torch.randn(4, 8)
        next_observation = torch.randn(4, 8)
        latent_state = self.model.initial_inference(observation).latent_state
        actions = torch.tensor([[0], [1], [2], [3]])
        afterstate = self.model.recurrent_inference(
            latent_state, actions, afterstate=False
        ).latent_state
        concatenated = torch.cat((observation, next_observation), dim=1)
        return afterstate, concatenated, actions

    def chance_encoder_grad_norm(self) -> float:
        squared = 0.0
        for parameter in self.model.chance_encoder.parameters():
            if parameter.grad is not None:
                squared += parameter.grad.detach().square().sum().item()
        return squared**0.5

    def test_task_loss_reaches_chance_encoder(self) -> None:
        afterstate, concatenated, _ = self.transition()
        chance_encoding, chance_target = self.model.chance_encode(concatenated)
        self.assertFalse(chance_target.requires_grad)
        chance_code = chance_encoding.argmax(dim=1, keepdim=True).long()
        output = self.model.recurrent_inference(
            afterstate, chance_code, afterstate=True
        )

        self.model.zero_grad(set_to_none=True)
        output.latent_state.square().mean().backward()
        self.assertGreater(self.chance_encoder_grad_norm(), 1e-8)
        self.assertFalse(hasattr(self.model, _PENDING_CHANCE_ONE_HOT))

    def test_commitment_loss_has_nonzero_gradient(self) -> None:
        _, concatenated, _ = self.transition()
        chance_encoding, chance_target = self.model.chance_encode(concatenated)
        self.model.__dict__.pop(_PENDING_CHANCE_ONE_HOT, None)

        self.model.zero_grad(set_to_none=True)
        torch.nn.functional.mse_loss(chance_encoding, chance_target).backward()
        self.assertGreater(self.chance_encoder_grad_norm(), 1e-8)

    def test_ste_forward_matches_integer_chance_path(self) -> None:
        afterstate, concatenated, _ = self.transition()
        chance_encoding, chance_target = self.model.chance_encode(concatenated)
        chance_code = chance_encoding.argmax(dim=1, keepdim=True).long()

        ste_output = self.model.recurrent_inference(
            afterstate, chance_code, afterstate=True
        )
        integer_output = self.model.recurrent_inference(
            afterstate, chance_code, afterstate=True
        )

        torch.testing.assert_close(
            chance_target.argmax(dim=1, keepdim=True), chance_code
        )
        torch.testing.assert_close(
            ste_output.latent_state, integer_output.latent_state
        )
        torch.testing.assert_close(ste_output.reward, integer_output.reward)

    def test_no_grad_uses_integer_fallback(self) -> None:
        self.model.eval()
        with torch.no_grad():
            afterstate, concatenated, _ = self.transition()
            chance_encoding, _ = self.model.chance_encode(concatenated)
            self.assertFalse(hasattr(self.model, _PENDING_CHANCE_ONE_HOT))
            chance_code = chance_encoding.argmax(dim=1, keepdim=True).long()
            output = self.model.recurrent_inference(
                afterstate, chance_code, afterstate=True
            )
        self.assertEqual(output.latent_state.shape, afterstate.shape)

    def test_state_dict_is_upstream_compatible(self) -> None:
        upstream = StochasticMuZeroModelMLP(**self.model_config())
        upstream.load_state_dict(self.model.state_dict(), strict=True)
        self.model.load_state_dict(upstream.state_dict(), strict=True)


if __name__ == "__main__":
    unittest.main()
