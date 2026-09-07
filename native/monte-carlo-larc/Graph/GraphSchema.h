#pragma once

namespace umashow::graph {

inline constexpr int kSchemaVersion = 2;
inline constexpr int kGlobalFeatures = 96;
inline constexpr int kMaxPersons = 18;
inline constexpr int kPersonFeatures = 96;
inline constexpr int kTrainingCount = 5;
inline constexpr int kTrainingFeatures = 48;
inline constexpr int kMaxActions = 48;
inline constexpr int kActionFeatures = 32;
inline constexpr int kQuantiles = 32;
inline constexpr float kScoreScale = 50000.0F;

inline constexpr const char* kInputGlobal = "global_features";
inline constexpr const char* kInputPersons = "person_features";
inline constexpr const char* kInputTraining = "training_features";
inline constexpr const char* kInputPlacement = "placement";
inline constexpr const char* kInputActions = "action_features";
inline constexpr const char* kInputPersonMask = "person_mask";
inline constexpr const char* kInputActionMask = "action_mask";

inline constexpr const char* kOutputPolicy = "policy_logits";
inline constexpr const char* kOutputQ = "q_quantiles";
inline constexpr const char* kOutputActionScore = "action_score_quantiles";
inline constexpr const char* kOutputValue = "value_quantiles";
inline constexpr const char* kOutputStateScore = "state_score_quantiles";

} // namespace umashow::graph
