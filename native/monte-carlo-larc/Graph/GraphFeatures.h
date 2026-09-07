#pragma once

#include <array>
#include <vector>

#include "GraphSchema.h"
#include "../Game/Action.h"

struct Game;

namespace umashow::graph {

struct GraphAction
{
  Action action {};
  int id = -1;
};

struct GraphFeatures
{
  std::array<float, kGlobalFeatures> global {};
  std::array<float, kMaxPersons * kPersonFeatures> persons {};
  std::array<float, kTrainingCount * kTrainingFeatures> training {};
  std::array<float, kTrainingCount * kMaxPersons> placement {};
  std::array<float, kMaxActions * kActionFeatures> actions {};
  std::array<float, kMaxPersons> personMask {};
  std::array<float, kMaxActions> actionMask {};
  std::array<int, kMaxActions> actionIds {};
  int actionCount = 0;
};

std::vector<GraphAction> enumerateLegalActions(const Game& game);
GraphFeatures buildGraphFeatures(
  const Game& game,
  const std::vector<GraphAction>& legalActions);

} // namespace umashow::graph
