#pragma once

#include <random>
#include <vector>

#include "GraphModel.h"

struct Game;

namespace umashow::graph {

struct GraphSearchConfig
{
  int nodeBudget = 384;
  int maxDepth = 5;
  int timeBudgetMs = 900;
  int topK = 4;
  int maxChanceOutcomes = 8;
  double cpuct = 1.5;
  double radicalFactor = 3.0;
};

struct GraphSearchActionResult
{
  GraphAction graphAction;
  int visits = 0;
  double scoreMean = 0.0;
  double scoreStdev = 0.0;
  double value = 0.0;
};

struct GraphSearchResult
{
  std::vector<GraphSearchActionResult> actions;
  int bestActionIndex = -1;
  int simulations = 0;
  int nodes = 0;
  int elapsedMs = 0;
};

class GraphSearch
{
public:
  GraphSearch(GraphModel& model, GraphSearchConfig config);
  GraphSearchResult run(const Game& game, std::mt19937_64& random);

private:
  GraphModel& model_;
  GraphSearchConfig config_;
};

} // namespace umashow::graph
