from __future__ import annotations

import torch
from torch import Tensor

from lzero.model.stochastic_muzero_model_mlp import StochasticMuZeroModelMLP
from lzero.model.utils import renormalize


_PENDING_CHANCE_ONE_HOT = "_umashow_pending_chance_one_hot"


class LArcStochasticMuZeroModelMLP(StochasticMuZeroModelMLP):
    """Stochastic MuZero MLP with a working learned-chance gradient path.

    The pinned LightZero policy converts the chance encoder output through
    ``argmax().long()`` before recurrent inference.  Its MLP dynamics then
    constructs a fresh one-hot tensor with ``scatter_``.  That produces the
    correct forward value, but disconnects reward/value/policy losses from the
    chance encoder.

    LightZero's commitment loss has a second independent issue: both
    ``chance_encoding`` and its straight-through one-hot target participate in
    autograd.  Because the straight-through estimator has an identity
    backward, the two MSE gradients cancel exactly.

    During a serial learner step, ``chance_encode`` is immediately followed by
    chance dynamics.  Preserve the differentiable straight-through one-hot for
    that call, while returning a detached copy for the policy and commitment
    targets.  The forward dynamics input remains exactly the same hard one-hot
    vector as upstream LightZero.  Collect/evaluate calls use the unchanged
    integer-index fallback.

    This transient hand-off assumes LightZero's current serial
    ``train_muzero`` learner.  It should be revisited before enabling an
    asynchronous, re-entrant, DDP, or ``torch.compile`` learner.
    """

    def chance_encode(self, observation: Tensor) -> tuple[Tensor, Tensor]:
        # Do not retain a graph if a previous call failed before dynamics.
        self.__dict__.pop(_PENDING_CHANCE_ONE_HOT, None)
        chance_encoding, chance_one_hot = super().chance_encode(observation)
        if self.training and torch.is_grad_enabled():
            setattr(self, _PENDING_CHANCE_ONE_HOT, chance_one_hot)

        # This detached hard target gives commitment loss a real gradient with
        # respect to chance_encoding.  The original STE tensor is retained
        # above for task-loss gradients through dynamics.
        return chance_encoding, chance_one_hot.detach()

    def _dynamics(
        self, latent_state: Tensor, action: Tensor
    ) -> tuple[Tensor, Tensor]:
        chance_one_hot = self.__dict__.pop(_PENDING_CHANCE_ONE_HOT, None)
        if chance_one_hot is None:
            # MCTS, evaluation, true-label inference, and any ordinary direct
            # model call continue to use LightZero's integer chance code path.
            return super()._dynamics(latent_state, action)

        expected_shape = (latent_state.shape[0], self.chance_space_size)
        if tuple(chance_one_hot.shape) != expected_shape:
            raise RuntimeError(
                "learned chance one-hot shape mismatch: "
                f"got {tuple(chance_one_hot.shape)}, expected {expected_shape}"
            )

        action_encoding = chance_one_hot.to(
            device=latent_state.device, dtype=latent_state.dtype
        )
        state_action_encoding = torch.cat((latent_state, action_encoding), dim=1)
        next_latent_state, reward = self.dynamics_network(state_action_encoding)
        if self.state_norm:
            next_latent_state = renormalize(next_latent_state)
        return next_latent_state, reward
