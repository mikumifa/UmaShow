from __future__ import annotations

import os
from typing import Any

from training.larc_graph.schema import LIGHTZERO_CHANCE_SEARCH


CHANCE_SEARCH_PATCH = LIGHTZERO_CHANCE_SEARCH


def configure_stochastic_muzero_chance_space(
    chance_space_size: int,
) -> dict[str, object]:
    """Make LightZero MCTS use the model's configured chance space.

    The pinned LightZero revision constructs stochastic-MuZero roots without
    forwarding ``cfg.model.chance_space_size``.  Both its C++ and Python trees
    therefore silently fall back to two chance outcomes.  The policy stores the
    MCTS classes as module globals, so install process-local adapters before a
    policy is created.

    This patch is intentionally parameter-free: it changes only tree
    construction and does not alter checkpoint tensor names or shapes.
    """

    size = int(chance_space_size)
    if size <= 0:
        raise ValueError("chance_space_size must be positive")

    os.environ.setdefault("PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION", "python")
    import lzero.policy.stochastic_muzero as policy_module
    from lzero.mcts.ptree import ptree_stochastic_mz

    original_ctree = getattr(
        policy_module,
        "_umashow_original_mcts_ctree",
        policy_module.MCTSCtree,
    )
    setattr(policy_module, "_umashow_original_mcts_ctree", original_ctree)

    class ConfiguredChanceMCTSCtree(original_ctree):  # type: ignore[misc, valid-type]
        _umashow_chance_space_size = size

        @classmethod
        def roots(
            cls,
            active_env_num: int,
            legal_actions: list[Any],
            chance_space_size: int | None = None,
        ) -> Any:
            configured_size = (
                cls._umashow_chance_space_size
                if chance_space_size is None
                else int(chance_space_size)
            )
            return original_ctree.roots(
                active_env_num,
                legal_actions,
                configured_size,
            )

    ConfiguredChanceMCTSCtree.__name__ = original_ctree.__name__
    ConfiguredChanceMCTSCtree.__qualname__ = original_ctree.__qualname__
    policy_module.MCTSCtree = ConfiguredChanceMCTSCtree

    original_node = getattr(
        ptree_stochastic_mz,
        "_umashow_original_node",
        ptree_stochastic_mz.Node,
    )
    setattr(ptree_stochastic_mz, "_umashow_original_node", original_node)

    class ConfiguredChanceNode(original_node):  # type: ignore[misc, valid-type]
        def __init__(
            self,
            prior: float,
            legal_actions: list[Any] | None = None,
            action_space_size: int = 9,
            is_chance: bool = False,
            chance_space_size: int = size,
        ) -> None:
            super().__init__(
                prior,
                legal_actions=legal_actions,
                action_space_size=action_space_size,
                is_chance=is_chance,
                chance_space_size=chance_space_size,
            )

    ConfiguredChanceNode.__name__ = original_node.__name__
    ConfiguredChanceNode.__qualname__ = original_node.__qualname__
    ptree_stochastic_mz.Node = ConfiguredChanceNode

    return {
        "patch": CHANCE_SEARCH_PATCH,
        "chance_space_size": size,
        "ctree": True,
        "ptree": True,
    }
