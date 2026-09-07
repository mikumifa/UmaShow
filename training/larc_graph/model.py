from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import torch
from torch import Tensor, nn

try:
    from .schema import (
        ACTION_FEATURES,
        GLOBAL_FEATURES,
        MAX_ACTIONS,
        MAX_PERSONS,
        PERSON_FEATURES,
        QUANTILES,
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
        QUANTILES,
        TRAINING_COUNT,
        TRAINING_FEATURES,
    )


@dataclass(frozen=True)
class ModelConfig:
    hidden_dim: int = 128
    message_layers: int = 2
    attention_heads: int = 4
    mlp_ratio: int = 3
    dropout: float = 0.05

    def to_dict(self) -> dict[str, int | float]:
        return asdict(self)


class FeedForward(nn.Module):
    def __init__(self, input_dim: int, output_dim: int, width: int, dropout: float):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, width),
            nn.SiLU(),
            nn.Dropout(dropout),
            nn.Linear(width, output_dim),
        )

    def forward(self, value: Tensor) -> Tensor:
        return self.layers(value)


class SparseGraphBlock(nn.Module):
    """Only passes messages along person-training placement edges."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        hidden = config.hidden_dim
        heads = config.attention_heads
        if hidden % heads:
            raise ValueError("hidden_dim must be divisible by attention_heads")
        self.heads = heads
        self.head_dim = hidden // heads
        self.scale = 1.0 / math.sqrt(self.head_dim)

        self.training_query = nn.Linear(hidden, hidden, bias=False)
        self.person_key = nn.Linear(hidden, hidden, bias=False)
        self.person_value = nn.Linear(hidden, hidden, bias=False)
        self.training_attention_output = nn.Linear(hidden, hidden, bias=False)

        width = hidden * config.mlp_ratio
        self.person_update = FeedForward(hidden * 3, hidden, width, config.dropout)
        self.training_update = FeedForward(hidden * 3, hidden, width, config.dropout)
        self.global_update = FeedForward(hidden * 3, hidden, width, config.dropout)
        self.person_norm = nn.LayerNorm(hidden)
        self.training_norm = nn.LayerNorm(hidden)
        self.global_norm = nn.LayerNorm(hidden)

    @staticmethod
    def _masked_mean(values: Tensor, mask: Tensor) -> Tensor:
        weights = mask.unsqueeze(-1)
        return (values * weights).sum(dim=1) / weights.sum(dim=1).clamp_min(1.0)

    def forward(
        self,
        global_token: Tensor,
        person_tokens: Tensor,
        training_tokens: Tensor,
        placement: Tensor,
        person_mask: Tensor,
    ) -> tuple[Tensor, Tensor, Tensor]:
        batch = global_token.shape[0]
        valid_edges = placement * person_mask.unsqueeze(1)

        queries = self.training_query(training_tokens).reshape(
            batch, TRAINING_COUNT, self.heads, self.head_dim
        )
        keys = self.person_key(person_tokens).reshape(
            batch, MAX_PERSONS, self.heads, self.head_dim
        )
        values = self.person_value(person_tokens).reshape(
            batch, MAX_PERSONS, self.heads, self.head_dim
        )
        queries = queries.permute(0, 2, 1, 3)
        keys = keys.permute(0, 2, 1, 3)
        values = values.permute(0, 2, 1, 3)
        attention_logits = torch.matmul(queries, keys.transpose(-2, -1)) * self.scale
        edge_mask = valid_edges.unsqueeze(1)
        attention = torch.softmax(
            attention_logits.masked_fill(edge_mask < 0.5, -10_000.0), dim=-1
        )
        attention = attention * edge_mask
        attention = attention / attention.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        person_messages = torch.matmul(attention, values)
        person_messages = person_messages.permute(0, 2, 1, 3).reshape(
            batch, TRAINING_COUNT, -1
        )
        person_messages = self.training_attention_output(person_messages)

        person_to_training = valid_edges.transpose(1, 2)
        person_to_training = person_to_training / person_to_training.sum(
            dim=-1, keepdim=True
        ).clamp_min(1.0)
        training_messages = torch.bmm(person_to_training, training_tokens)

        expanded_global_for_person = global_token.unsqueeze(1).expand(
            -1, MAX_PERSONS, -1
        )
        expanded_global_for_training = global_token.unsqueeze(1).expand(
            -1, TRAINING_COUNT, -1
        )
        next_person = self.person_norm(
            person_tokens
            + self.person_update(
                torch.cat(
                    [person_tokens, training_messages, expanded_global_for_person], dim=-1
                )
            )
        )
        next_person = next_person * person_mask.unsqueeze(-1)
        next_training = self.training_norm(
            training_tokens
            + self.training_update(
                torch.cat(
                    [training_tokens, person_messages, expanded_global_for_training],
                    dim=-1,
                )
            )
        )
        next_global = self.global_norm(
            global_token
            + self.global_update(
                torch.cat(
                    [
                        global_token,
                        self._masked_mean(next_person, person_mask),
                        next_training.mean(dim=1),
                    ],
                    dim=-1,
                )
            )
        )
        return next_global, next_person, next_training


class LArcGraphNetwork(nn.Module):
    def __init__(self, config: ModelConfig | None = None):
        super().__init__()
        self.config = config or ModelConfig()
        hidden = self.config.hidden_dim
        width = hidden * self.config.mlp_ratio

        self.global_input = nn.Sequential(
            nn.Linear(GLOBAL_FEATURES, hidden), nn.LayerNorm(hidden), nn.SiLU()
        )
        self.person_input = nn.Sequential(
            nn.Linear(PERSON_FEATURES, hidden), nn.LayerNorm(hidden), nn.SiLU()
        )
        self.training_input = nn.Sequential(
            nn.Linear(TRAINING_FEATURES, hidden), nn.LayerNorm(hidden), nn.SiLU()
        )
        self.action_input = nn.Sequential(
            nn.Linear(ACTION_FEATURES, hidden), nn.LayerNorm(hidden), nn.SiLU()
        )
        self.graph_blocks = nn.ModuleList(
            SparseGraphBlock(self.config) for _ in range(self.config.message_layers)
        )
        self.action_update = FeedForward(hidden * 3, hidden, width, self.config.dropout)
        self.action_norm = nn.LayerNorm(hidden)
        self.state_update = FeedForward(hidden * 4, hidden, width, self.config.dropout)
        self.state_norm = nn.LayerNorm(hidden)

        self.policy_head = nn.Linear(hidden, 1)
        self.q_head = nn.Linear(hidden, QUANTILES)
        self.action_score_head = nn.Linear(hidden, QUANTILES)
        self.value_head = nn.Linear(hidden, QUANTILES)
        self.state_score_head = nn.Linear(hidden, QUANTILES)

    @staticmethod
    def _masked_mean(values: Tensor, mask: Tensor) -> Tensor:
        weights = mask.unsqueeze(-1)
        return (values * weights).sum(dim=1) / weights.sum(dim=1).clamp_min(1.0)

    def forward(
        self,
        global_features: Tensor,
        person_features: Tensor,
        training_features: Tensor,
        placement: Tensor,
        action_features: Tensor,
        person_mask: Tensor,
        action_mask: Tensor,
    ) -> tuple[Tensor, Tensor, Tensor, Tensor, Tensor]:
        global_token = self.global_input(global_features)
        person_tokens = self.person_input(person_features) * person_mask.unsqueeze(-1)
        training_tokens = self.training_input(training_features)
        action_tokens = self.action_input(action_features) * action_mask.unsqueeze(-1)

        for block in self.graph_blocks:
            global_token, person_tokens, training_tokens = block(
                global_token,
                person_tokens,
                training_tokens,
                placement,
                person_mask,
            )

        action_training_selector = action_features[:, :, 1:6]
        selected_training = torch.bmm(action_training_selector, training_tokens)
        expanded_global = global_token.unsqueeze(1).expand(-1, MAX_ACTIONS, -1)
        action_tokens = self.action_norm(
            action_tokens
            + self.action_update(
                torch.cat(
                    [action_tokens, selected_training, expanded_global], dim=-1
                )
            )
        )
        action_tokens = action_tokens * action_mask.unsqueeze(-1)

        state_token = self.state_norm(
            global_token
            + self.state_update(
                torch.cat(
                    [
                        global_token,
                        self._masked_mean(person_tokens, person_mask),
                        training_tokens.mean(dim=1),
                        self._masked_mean(action_tokens, action_mask),
                    ],
                    dim=-1,
                )
            )
        )

        policy_logits = self.policy_head(action_tokens).squeeze(-1)
        policy_logits = policy_logits + (action_mask - 1.0) * 10_000.0
        q_quantiles = self.q_head(action_tokens)
        action_score_quantiles = self.action_score_head(action_tokens)
        value_quantiles = self.value_head(state_token)
        state_score_quantiles = self.state_score_head(state_token)
        return (
            policy_logits,
            q_quantiles,
            action_score_quantiles,
            value_quantiles,
            state_score_quantiles,
        )

    def parameter_count(self) -> int:
        return sum(parameter.numel() for parameter in self.parameters())
