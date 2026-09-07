from __future__ import annotations

SCHEMA_VERSION = 2
SCENARIO_ID = 6

GLOBAL_FEATURES = 96
MAX_PERSONS = 18
PERSON_FEATURES = 96
TRAINING_COUNT = 5
TRAINING_FEATURES = 48
MAX_ACTIONS = 48
ACTION_FEATURES = 32
QUANTILES = 32
SCORE_SCALE = 50_000.0
LIGHTZERO_ACTIONS = 40
LIGHTZERO_OBSERVATION = (
    GLOBAL_FEATURES
    + MAX_PERSONS * PERSON_FEATURES
    + TRAINING_COUNT * TRAINING_FEATURES
    + TRAINING_COUNT * MAX_PERSONS
)
LIGHTZERO_MODEL_FAMILY = "larc_stochastic_muzero_initial_v1"
LIGHTZERO_MANIFEST = "umashow-model.json"
LIGHTZERO_COMMIT = "9ccf29b3c2174f65e06d21c3d0c51dc76853f37f"
LEARNED_CHANCE_GRADIENT = "ste_one_hot_v1"
LIGHTZERO_CHANCE_SEARCH = "configured_roots_v1"

INPUT_NAMES = (
    "global_features",
    "person_features",
    "training_features",
    "placement",
    "action_features",
    "person_mask",
    "action_mask",
)

OUTPUT_NAMES = (
    "policy_logits",
    "q_quantiles",
    "action_score_quantiles",
    "value_quantiles",
    "state_score_quantiles",
)

FEATURE_SHAPES = {
    "global_features": (GLOBAL_FEATURES,),
    "person_features": (MAX_PERSONS, PERSON_FEATURES),
    "training_features": (TRAINING_COUNT, TRAINING_FEATURES),
    "placement": (TRAINING_COUNT, MAX_PERSONS),
    "action_features": (MAX_ACTIONS, ACTION_FEATURES),
    "person_mask": (MAX_PERSONS,),
    "action_mask": (MAX_ACTIONS,),
}

TARGET_SHAPES = {
    "policy_target": (MAX_ACTIONS,),
    "q_target": (MAX_ACTIONS,),
    "action_score_target": (MAX_ACTIONS,),
    "value_target": (),
    "state_score_target": (),
}
