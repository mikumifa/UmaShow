#include "GraphSearch.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>
#include <memory>
#include <numeric>
#include <stdexcept>

#include "../Game/Game.h"

namespace umashow::graph {
namespace {

struct SearchSample
{
  DistributionSummary value;
  DistributionSummary score;
};

struct SearchNode;

struct SearchEdge
{
  GraphAction graphAction;
  double prior = 0.0;
  DistributionSummary initialValue;
  DistributionSummary initialScore;
  int visits = 0;
  double valueRiskTotal = 0.0;
  double valueMeanTotal = 0.0;
  double valueSecondMomentTotal = 0.0;
  double scoreMeanTotal = 0.0;
  double scoreSecondMomentTotal = 0.0;
  std::vector<std::unique_ptr<SearchNode>> outcomes;

  void add(const SearchSample& sample)
  {
    ++visits;
    valueRiskTotal += sample.value.riskAdjusted;
    valueMeanTotal += sample.value.mean;
    valueSecondMomentTotal +=
      sample.value.mean * sample.value.mean + sample.value.stdev * sample.value.stdev;
    scoreMeanTotal += sample.score.mean;
    scoreSecondMomentTotal +=
      sample.score.mean * sample.score.mean + sample.score.stdev * sample.score.stdev;
  }

  double searchValue() const
  {
    return visits > 0 ? valueRiskTotal / visits : initialValue.riskAdjusted;
  }
};

struct SearchNode
{
  Game game;
  int depth = 0;
  int visits = 0;
  bool expanded = false;
  DistributionSummary stateValue;
  DistributionSummary stateScore;
  std::vector<SearchEdge> edges;
  std::vector<int> selectableEdges;
};

struct GumbelRootState
{
  std::vector<double> noise;
  std::vector<int> consideredVisits;
};

std::vector<int> consideredVisitSequence(int actionCount, int simulations)
{
  std::vector<int> sequence;
  sequence.reserve(simulations);
  if (actionCount <= 1)
  {
    for (int visit = 0; visit < simulations; ++visit)
      sequence.push_back(visit);
    return sequence;
  }

  const int rounds = static_cast<int>(std::ceil(std::log2(actionCount)));
  std::vector<int> visits(actionCount, 0);
  int considered = actionCount;
  while (static_cast<int>(sequence.size()) < simulations)
  {
    const int extraVisits = std::max(
      1,
      simulations / (rounds * considered));
    for (int extra = 0;
         extra < extraVisits && static_cast<int>(sequence.size()) < simulations;
         ++extra)
    {
      for (int index = 0;
           index < considered && static_cast<int>(sequence.size()) < simulations;
           ++index)
      {
        sequence.push_back(visits[index]);
      }
      for (int index = 0; index < considered; ++index)
        ++visits[index];
    }
    considered = std::max(2, considered / 2);
  }
  return sequence;
}

GumbelRootState makeGumbelRootState(
  int actionCount,
  int consideredActionCount,
  int simulations,
  double scale,
  std::mt19937_64& random)
{
  GumbelRootState result;
  result.noise.resize(actionCount, 0.0);
  if (scale > 0.0)
  {
    for (double& value : result.noise)
    {
      const double uniform = std::clamp(
        std::generate_canonical<double, 53>(random),
        std::numeric_limits<double>::epsilon(),
        1.0 - std::numeric_limits<double>::epsilon());
      value = scale * -std::log(-std::log(uniform));
    }
  }
  result.consideredVisits = consideredVisitSequence(
    consideredActionCount,
    simulations);
  return result;
}

struct SearchContext
{
  GraphModel& model;
  const GraphSearchConfig& config;
  double radicalFactor = 0.0;
  int nodes = 1;
  const GumbelRootState* gumbelRoot = nullptr;

  void expand(SearchNode& node, bool root)
  {
    if (node.expanded || node.game.isEnd())
      return;
    const auto actions = enumerateLegalActions(node.game);
    if (actions.empty())
      throw std::runtime_error("模型搜索没有找到合法行动");
    const GraphFeatures features = buildGraphFeatures(node.game, actions);
    const GraphPrediction prediction = model.evaluate(features);
    if (prediction.priors.size() != actions.size() ||
        prediction.actionValues.size() != actions.size() ||
        prediction.actionScores.size() != actions.size())
    {
      throw std::runtime_error("模型返回的行动数量不正确");
    }

    node.stateValue = summarizeDistribution(prediction.stateValue, radicalFactor);
    node.stateScore = summarizeDistribution(prediction.stateScore, 0.0);
    if (prediction.valueIsRemainingReturn)
    {
      node.stateValue.mean += node.game.recommendationScore();
      node.stateValue.riskAdjusted += node.game.recommendationScore();
      node.stateScore.mean += node.game.finalScore();
      node.stateScore.riskAdjusted += node.game.finalScore();
    }
    node.edges.reserve(actions.size());
    for (std::size_t index = 0; index < actions.size(); ++index)
    {
      SearchEdge edge;
      edge.graphAction = actions[index];
      edge.prior = prediction.priors[index];
      edge.initialValue = summarizeDistribution(
        prediction.actionValues[index],
        radicalFactor);
      edge.initialScore = summarizeDistribution(prediction.actionScores[index], 0.0);
      if (prediction.valueIsRemainingReturn)
      {
        edge.initialValue.mean += node.game.recommendationScore();
        edge.initialValue.riskAdjusted += node.game.recommendationScore();
        edge.initialScore.mean += node.game.finalScore();
        edge.initialScore.riskAdjusted += node.game.finalScore();
      }
      node.edges.push_back(std::move(edge));
    }

    node.selectableEdges.resize(node.edges.size());
    std::iota(node.selectableEdges.begin(), node.selectableEdges.end(), 0);
    std::sort(
      node.selectableEdges.begin(),
      node.selectableEdges.end(),
      [&](int left, int right) {
        const auto quality = [](const SearchEdge& edge) {
          return edge.initialValue.riskAdjusted +
            500.0 * std::log(std::max(1e-9, edge.prior));
        };
        return quality(node.edges[left]) > quality(node.edges[right]);
      });
    if (!root && static_cast<int>(node.selectableEdges.size()) > config.topK)
      node.selectableEdges.resize(config.topK);
    node.expanded = true;
  }

  double gumbelRootScore(const SearchNode& node, int edgeIndex) const
  {
    if (!gumbelRoot || edgeIndex < 0 ||
        edgeIndex >= static_cast<int>(node.edges.size()))
    {
      return -std::numeric_limits<double>::infinity();
    }

    int maximumVisits = 0;
    for (const auto& edge : node.edges)
      maximumVisits = std::max(maximumVisits, edge.visits);

    double minimum = std::numeric_limits<double>::infinity();
    double maximum = -std::numeric_limits<double>::infinity();
    for (const auto& edge : node.edges)
    {
      // SparseGraph models expose an action-Q head, while the LightZero
      // compatibility path initializes every action from the state value.
      // searchValue() therefore preserves useful action-Q information when it
      // exists and naturally matches value completion when it does not.
      const double value = edge.searchValue();
      minimum = std::min(minimum, value);
      maximum = std::max(maximum, value);
    }
    const auto& edge = node.edges[edgeIndex];
    const double value = edge.searchValue();
    const double normalizedValue = maximum - minimum > 1e-8
      ? (value - minimum) / (maximum - minimum)
      : 0.0;
    const double valueScale = (50.0 + maximumVisits) * 0.1;
    return gumbelRoot->noise[edgeIndex] +
      std::log(std::max(1e-9, edge.prior)) +
      valueScale * normalizedValue;
  }

  SearchEdge& selectGumbelRootEdge(SearchNode& node)
  {
    if (!gumbelRoot || gumbelRoot->consideredVisits.empty())
      throw std::runtime_error("Gumbel 根搜索尚未初始化");
    const int simulation = std::min(
      node.visits,
      static_cast<int>(gumbelRoot->consideredVisits.size()) - 1);
    const int consideredVisit = gumbelRoot->consideredVisits[simulation];

    int bestIndex = -1;
    double bestScore = -std::numeric_limits<double>::infinity();
    for (int index = 0; index < static_cast<int>(node.edges.size()); ++index)
    {
      if (node.edges[index].visits != consideredVisit)
        continue;
      const double score = gumbelRootScore(node, index);
      if (score > bestScore)
      {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex < 0)
      throw std::runtime_error("Gumbel 根搜索无法选择后续行动");
    return node.edges[bestIndex];
  }

  SearchEdge& selectEdge(SearchNode& node)
  {
    if (node.depth == 0)
    {
      if (config.rootSelection == GraphRootSelection::GumbelSequentialHalving)
        return selectGumbelRootEdge(node);
      SearchEdge* bestUnvisited = nullptr;
      for (auto& edge : node.edges)
      {
        if (edge.visits == 0 &&
            (!bestUnvisited || edge.initialValue.riskAdjusted > bestUnvisited->initialValue.riskAdjusted))
        {
          bestUnvisited = &edge;
        }
      }
      if (bestUnvisited)
        return *bestUnvisited;
    }

    SearchEdge* best = nullptr;
    double bestScore = -std::numeric_limits<double>::infinity();
    const double parentVisits = std::sqrt(static_cast<double>(node.visits) + 1.0);
    for (const int index : node.selectableEdges)
    {
      auto& edge = node.edges[index];
      const double exploration = config.cpuct * 1000.0 * edge.prior *
        parentVisits / (1.0 + edge.visits);
      const double score = edge.searchValue() + exploration;
      if (score > bestScore)
      {
        best = &edge;
        bestScore = score;
      }
    }
    if (!best)
      throw std::runtime_error("模型搜索无法选择后续行动");
    return *best;
  }

  SearchSample terminalSample(const Game& game) const
  {
    const double recommendation = game.recommendationScore();
    const double score = game.finalScore();
    return {
      {recommendation, 0.0, recommendation},
      {score, 0.0, score},
    };
  }

  SearchSample simulate(SearchNode& node, std::mt19937_64& random)
  {
    if (node.game.isEnd())
      return terminalSample(node.game);

    expand(node, node.depth == 0);
    if (node.depth >= config.maxDepth)
      return {node.stateValue, node.stateScore};

    SearchEdge& edge = selectEdge(node);
    const int allowedOutcomes = std::min(
      config.maxChanceOutcomes,
      1 + static_cast<int>(std::sqrt(static_cast<double>(edge.visits) + 1.0)));

    SearchNode* child = nullptr;
    if (static_cast<int>(edge.outcomes.size()) < allowedOutcomes)
    {
      Game next = node.game;
      next.applyTrainingAndNextTurn(random, edge.graphAction.action);
      auto outcome = std::make_unique<SearchNode>();
      outcome->game = std::move(next);
      outcome->depth = node.depth + 1;
      child = outcome.get();
      edge.outcomes.push_back(std::move(outcome));
      ++nodes;
    }
    else
    {
      child = edge.outcomes[random() % edge.outcomes.size()].get();
    }

    SearchSample sample = simulate(*child, random);
    edge.add(sample);
    ++node.visits;
    return sample;
  }
};

double combinedStdev(double total, double secondMomentTotal, int count)
{
  if (count <= 0)
    return 0.0;
  const double mean = total / count;
  return std::sqrt(std::max(0.0, secondMomentTotal / count - mean * mean));
}

} // namespace

GraphSearch::GraphSearch(GraphModel& model, GraphSearchConfig config)
  : model_(model), config_(config)
{
  config_.nodeBudget = std::clamp(config_.nodeBudget, 16, 8192);
  config_.maxDepth = std::clamp(config_.maxDepth, 1, 16);
  config_.timeBudgetMs = std::clamp(config_.timeBudgetMs, 50, 30000);
  config_.topK = std::clamp(config_.topK, 1, 12);
  config_.maxChanceOutcomes = std::clamp(config_.maxChanceOutcomes, 1, 32);
  config_.cpuct = std::clamp(config_.cpuct, 0.0, 20.0);
  config_.radicalFactor = std::clamp(config_.radicalFactor, 0.0, 20.0);
  config_.rootDirichletAlpha = std::clamp(
    config_.rootDirichletAlpha,
    0.0,
    100.0);
  config_.rootNoiseFraction = std::clamp(
    config_.rootNoiseFraction,
    0.0,
    1.0);
  config_.rootGumbelMaxActions = std::clamp(
    config_.rootGumbelMaxActions,
    1,
    kMaxActions);
  config_.rootGumbelScale = std::clamp(config_.rootGumbelScale, 0.0, 10.0);
}

GraphSearchResult GraphSearch::run(const Game& game, std::mt19937_64& random)
{
  const auto startedAt = std::chrono::steady_clock::now();
  SearchNode root;
  root.game = game;
  SearchContext context {
    model_,
    config_,
    adjustedRadicalFactor(config_.radicalFactor, game.turn),
  };
  context.expand(root, true);
  if (config_.rootSelection == GraphRootSelection::Puct &&
      config_.rootDirichletAlpha > 0.0 &&
      config_.rootNoiseFraction > 0.0 &&
      !root.edges.empty())
  {
    std::gamma_distribution<double> noiseDistribution(
      config_.rootDirichletAlpha,
      1.0);
    std::vector<double> noise(root.edges.size());
    double noiseTotal = 0.0;
    for (double& value : noise)
    {
      value = noiseDistribution(random);
      noiseTotal += value;
    }
    if (noiseTotal <= 0.0 || !std::isfinite(noiseTotal))
    {
      std::fill(noise.begin(), noise.end(), 1.0 / noise.size());
    }
    else
    {
      for (double& value : noise)
        value /= noiseTotal;
    }
    for (std::size_t index = 0; index < root.edges.size(); ++index)
    {
      root.edges[index].prior =
        (1.0 - config_.rootNoiseFraction) * root.edges[index].prior +
        config_.rootNoiseFraction * noise[index];
    }
  }
  const int minimumSimulations = config_.rootSelection ==
      GraphRootSelection::GumbelSequentialHalving
    ? std::min(
        static_cast<int>(root.edges.size()),
        config_.rootGumbelMaxActions)
    : static_cast<int>(root.edges.size());
  const int simulationBudget = std::max(config_.nodeBudget, minimumSimulations);
  GumbelRootState gumbelRoot;
  if (config_.rootSelection == GraphRootSelection::GumbelSequentialHalving)
  {
    gumbelRoot = makeGumbelRootState(
      static_cast<int>(root.edges.size()),
      minimumSimulations,
      simulationBudget,
      config_.rootGumbelScale,
      random);
    context.gumbelRoot = &gumbelRoot;
  }

  int simulations = 0;
  while (simulations < simulationBudget)
  {
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - startedAt).count();
    if (simulations >= minimumSimulations && elapsed >= config_.timeBudgetMs)
      break;
    context.simulate(root, random);
    ++simulations;
  }

  GraphSearchResult result;
  result.simulations = simulations;
  result.nodes = context.nodes;
  result.elapsedMs = static_cast<int>(std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::steady_clock::now() - startedAt).count());
  result.actions.reserve(root.edges.size());
  int bestVisits = -1;
  double bestValue = -std::numeric_limits<double>::infinity();
  for (std::size_t index = 0; index < root.edges.size(); ++index)
  {
    const auto& edge = root.edges[index];
    GraphSearchActionResult actionResult;
    actionResult.graphAction = edge.graphAction;
    actionResult.visits = edge.visits;
    if (edge.visits > 0)
    {
      actionResult.scoreMean = edge.scoreMeanTotal / edge.visits;
      actionResult.scoreStdev = combinedStdev(
        edge.scoreMeanTotal,
        edge.scoreSecondMomentTotal,
        edge.visits);
      actionResult.value = edge.valueRiskTotal / edge.visits;
    }
    else
    {
      actionResult.scoreMean = edge.initialScore.mean;
      actionResult.scoreStdev = edge.initialScore.stdev;
      actionResult.value = edge.initialValue.riskAdjusted;
    }
    if (config_.rootSelection == GraphRootSelection::Puct &&
        (actionResult.visits > bestVisits ||
         (actionResult.visits == bestVisits && actionResult.value > bestValue)))
    {
      bestVisits = actionResult.visits;
      bestValue = actionResult.value;
      result.bestActionIndex = static_cast<int>(index);
    }
    result.actions.push_back(actionResult);
  }
  if (config_.rootSelection == GraphRootSelection::GumbelSequentialHalving)
  {
    for (const auto& edge : root.edges)
      bestVisits = std::max(bestVisits, edge.visits);
    double bestScore = -std::numeric_limits<double>::infinity();
    for (int index = 0; index < static_cast<int>(root.edges.size()); ++index)
    {
      if (root.edges[index].visits != bestVisits)
        continue;
      const double score = context.gumbelRootScore(root, index);
      if (score > bestScore)
      {
        bestScore = score;
        result.bestActionIndex = index;
      }
    }
  }
  return result;
}

} // namespace umashow::graph
