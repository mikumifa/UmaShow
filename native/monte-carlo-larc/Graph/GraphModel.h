#pragma once

#include <array>
#include <filesystem>
#include <memory>
#include <vector>

#include "GraphFeatures.h"

namespace umashow::graph {

struct QuantileDistribution
{
  std::array<double, kQuantiles> values {};
};

struct GraphPrediction
{
  std::vector<double> priors;
  std::vector<QuantileDistribution> actionValues;
  std::vector<QuantileDistribution> actionScores;
  QuantileDistribution stateValue;
  QuantileDistribution stateScore;
  bool valueIsRemainingReturn = false;
};

struct DistributionSummary
{
  double mean = 0.0;
  double stdev = 0.0;
  double riskAdjusted = 0.0;
};

double adjustedRadicalFactor(double maximum, int turn);
DistributionSummary summarizeDistribution(
  const QuantileDistribution& distribution,
  double radicalFactor);

class GraphModel
{
public:
  explicit GraphModel(const std::filesystem::path& path);
  ~GraphModel();

  GraphModel(const GraphModel&) = delete;
  GraphModel& operator=(const GraphModel&) = delete;
  GraphModel(GraphModel&&) noexcept;
  GraphModel& operator=(GraphModel&&) noexcept;

  GraphPrediction evaluate(const GraphFeatures& features);
  const std::filesystem::path& path() const;

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace umashow::graph
