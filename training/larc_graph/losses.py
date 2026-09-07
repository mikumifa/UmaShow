from __future__ import annotations

import torch
from torch import Tensor

try:
    from .schema import QUANTILES
except ImportError:
    from schema import QUANTILES  # type: ignore


def quantile_huber_loss(
    prediction: Tensor,
    target: Tensor,
    mask: Tensor | None = None,
    kappa: float = 1.0,
) -> Tensor:
    """Quantile regression against one sampled/scalar return per item."""

    error = target.unsqueeze(-1) - prediction
    absolute = error.abs()
    huber = torch.where(
        absolute <= kappa,
        0.5 * error.square(),
        kappa * (absolute - 0.5 * kappa),
    )
    tau = (
        (torch.arange(QUANTILES, device=prediction.device, dtype=prediction.dtype) + 0.5)
        / QUANTILES
    )
    weight = (tau - (error.detach() < 0).to(prediction.dtype)).abs()
    loss = weight * huber / kappa
    if mask is None:
        return loss.mean()
    expanded_mask = mask.unsqueeze(-1).to(loss.dtype)
    return (loss * expanded_mask).sum() / expanded_mask.sum().clamp_min(1.0)


def policy_cross_entropy(logits: Tensor, target: Tensor, action_mask: Tensor) -> Tensor:
    masked_logits = logits + (action_mask - 1.0) * 10_000.0
    log_probability = torch.log_softmax(masked_logits, dim=-1)
    normalized_target = target * action_mask
    normalized_target = normalized_target / normalized_target.sum(
        dim=-1, keepdim=True
    ).clamp_min(1e-6)
    return -(normalized_target * log_probability).sum(dim=-1).mean()
