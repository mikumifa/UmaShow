#include "GraphModel.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <string>

#include <onnxruntime_cxx_api.h>

#include "../GameDatabase/GameConstants.h"

namespace umashow::graph {
namespace {

Ort::Env& environment()
{
  static Ort::Env value(ORT_LOGGING_LEVEL_WARNING, "UmaShowRecommendation");
  return value;
}

std::string metadataValue(Ort::Session& session, const char* key)
{
  Ort::AllocatorWithDefaultOptions allocator;
  auto metadata = session.GetModelMetadata();
  auto value = metadata.LookupCustomMetadataMapAllocated(key, allocator);
  return value ? std::string(value.get()) : std::string();
}

void validateTensorShape(
  Ort::Session& session,
  bool input,
  std::size_t index,
  const char* expectedName,
  const std::vector<int64_t>& expectedShape)
{
  Ort::AllocatorWithDefaultOptions allocator;
  auto name = input
    ? session.GetInputNameAllocated(index, allocator)
    : session.GetOutputNameAllocated(index, allocator);
  if (!name || std::string(name.get()) != expectedName)
  {
    throw std::runtime_error(
      std::string("模型张量名称不匹配：需要 ") + expectedName);
  }
  const auto typeInfo = input
    ? session.GetInputTypeInfo(index)
    : session.GetOutputTypeInfo(index);
  const auto tensorInfo = typeInfo.GetTensorTypeAndShapeInfo();
  if (tensorInfo.GetElementType() != ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT)
  {
    throw std::runtime_error(
      std::string("模型张量必须为 float32：") + expectedName);
  }
  const auto shape = tensorInfo.GetShape();
  if (shape.size() != expectedShape.size())
  {
    throw std::runtime_error(
      std::string("模型张量维度不匹配：") + expectedName);
  }
  for (std::size_t dimension = 0; dimension < shape.size(); ++dimension)
  {
    if (expectedShape[dimension] >= 0 &&
        shape[dimension] >= 0 &&
        shape[dimension] != expectedShape[dimension])
    {
      throw std::runtime_error(
        std::string("模型张量形状不匹配：") + expectedName);
    }
  }
}

void validateFinite(const float* values, std::size_t count, const char* name)
{
  for (std::size_t index = 0; index < count; ++index)
  {
    if (!std::isfinite(values[index]))
      throw std::runtime_error(std::string("模型输出包含无效数值：") + name);
  }
}

} // namespace

struct GraphModel::Impl
{
  enum class Family
  {
    SparseGraph,
    StochasticMuZero,
  };

  explicit Impl(const std::filesystem::path& modelPath)
    : path(modelPath), session(nullptr)
  {
    if (!std::filesystem::is_regular_file(path))
      throw std::runtime_error("找不到模型文件");

    options.SetGraphOptimizationLevel(GraphOptimizationLevel::ORT_ENABLE_ALL);
    options.SetExecutionMode(ExecutionMode::ORT_SEQUENTIAL);
    options.SetIntraOpNumThreads(1);
    options.SetInterOpNumThreads(1);
    session = Ort::Session(environment(), path.c_str(), options);

    const std::string modelFamily = metadataValue(session, "umashow.model_family");
    if (modelFamily == kStochasticModelFamily)
    {
      family = Family::StochasticMuZero;
      if (session.GetInputCount() != 1 || session.GetOutputCount() != 2)
        throw std::runtime_error("多回合模型输入输出数量不符合推荐模型协议");
      validateTensorShape(
        session,
        true,
        0,
        kInputStochasticObservation,
        {-1, kStochasticObservationFeatures});
      validateTensorShape(
        session,
        false,
        0,
        kOutputPolicy,
        {-1, kStochasticActionSpace});
      validateTensorShape(
        session,
        false,
        1,
        kOutputStochasticValue,
        {-1, 1});
    }
    else if (modelFamily.empty() || modelFamily == kSparseGraphModelFamily)
    {
      family = Family::SparseGraph;
      if (session.GetInputCount() != 7 || session.GetOutputCount() != 5)
        throw std::runtime_error("模型输入输出数量不符合推荐模型协议");
      validateTensorShape(session, true, 0, kInputGlobal, {-1, kGlobalFeatures});
      validateTensorShape(session, true, 1, kInputPersons, {-1, kMaxPersons, kPersonFeatures});
      validateTensorShape(session, true, 2, kInputTraining, {-1, kTrainingCount, kTrainingFeatures});
      validateTensorShape(session, true, 3, kInputPlacement, {-1, kTrainingCount, kMaxPersons});
      validateTensorShape(session, true, 4, kInputActions, {-1, kMaxActions, kActionFeatures});
      validateTensorShape(session, true, 5, kInputPersonMask, {-1, kMaxPersons});
      validateTensorShape(session, true, 6, kInputActionMask, {-1, kMaxActions});
      validateTensorShape(session, false, 0, kOutputPolicy, {-1, kMaxActions});
      validateTensorShape(session, false, 1, kOutputQ, {-1, kMaxActions, kQuantiles});
      validateTensorShape(session, false, 2, kOutputActionScore, {-1, kMaxActions, kQuantiles});
      validateTensorShape(session, false, 3, kOutputValue, {-1, kQuantiles});
      validateTensorShape(session, false, 4, kOutputStateScore, {-1, kQuantiles});
    }
    else
    {
      throw std::runtime_error("无法识别选择的推荐模型类型");
    }

    const std::string schema = metadataValue(session, "umashow.graph_schema");
    if (schema != std::to_string(kSchemaVersion))
      throw std::runtime_error("模型协议版本不兼容，请重新导出模型");
    if (metadataValue(session, "umashow.scenario_id") != "6")
      throw std::runtime_error("该模型不是凯旋门推荐模型");
    const std::string scale = metadataValue(session, "umashow.score_scale");
    if (scale.empty() || std::abs(std::stof(scale) - kScoreScale) > 0.5F)
      throw std::runtime_error("模型评分缩放参数不兼容");
  }

  std::filesystem::path path;
  Ort::SessionOptions options;
  Ort::Session session;
  Family family = Family::SparseGraph;
};

GraphModel::GraphModel(const std::filesystem::path& path)
  : impl_(std::make_unique<Impl>(path))
{
}

GraphModel::~GraphModel() = default;
GraphModel::GraphModel(GraphModel&&) noexcept = default;
GraphModel& GraphModel::operator=(GraphModel&&) noexcept = default;

const std::filesystem::path& GraphModel::path() const
{
  return impl_->path;
}

GraphPrediction GraphModel::evaluate(const GraphFeatures& features)
{
  if (impl_->family == Impl::Family::StochasticMuZero)
  {
    std::array<float, kStochasticObservationFeatures> observation {};
    auto destination = observation.begin();
    destination = std::copy(
      features.global.begin(),
      features.global.end(),
      destination);
    destination = std::copy(
      features.persons.begin(),
      features.persons.end(),
      destination);
    destination = std::copy(
      features.training.begin(),
      features.training.end(),
      destination);
    std::copy(
      features.placement.begin(),
      features.placement.end(),
      destination);

    constexpr std::array<const char*, 1> inputNames = {
      kInputStochasticObservation,
    };
    constexpr std::array<const char*, 2> outputNames = {
      kOutputPolicy,
      kOutputStochasticValue,
    };
    constexpr std::array<int64_t, 2> observationShape = {
      1,
      kStochasticObservationFeatures,
    };
    auto memory = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
    std::array<Ort::Value, 1> inputs = {
      Ort::Value::CreateTensor<float>(
        memory,
        observation.data(),
        observation.size(),
        observationShape.data(),
        observationShape.size()),
    };
    auto outputs = impl_->session.Run(
      Ort::RunOptions {nullptr},
      inputNames.data(),
      inputs.data(),
      inputs.size(),
      outputNames.data(),
      outputNames.size());
    const float* policy = outputs[0].GetTensorData<float>();
    const float* value = outputs[1].GetTensorData<float>();
    validateFinite(policy, kStochasticActionSpace, kOutputPolicy);
    validateFinite(value, 1, kOutputStochasticValue);

    GraphPrediction result;
    result.valueIsRemainingReturn = true;
    result.priors.resize(features.actionCount);
    result.actionValues.resize(features.actionCount);
    result.actionScores.resize(features.actionCount);
    if (features.actionCount > 0)
    {
      float maximum = -std::numeric_limits<float>::infinity();
      for (int action = 0; action < features.actionCount; ++action)
      {
        const int actionId = features.actionIds[action];
        if (actionId < 0 || actionId >= kStochasticActionSpace)
          throw std::runtime_error("当前合法行动超出多回合模型的行动空间");
        maximum = std::max(maximum, policy[actionId]);
      }
      double total = 0.0;
      for (int action = 0; action < features.actionCount; ++action)
      {
        const int actionId = features.actionIds[action];
        result.priors[action] = std::exp(
          std::clamp<double>(policy[actionId] - maximum, -80.0, 0.0));
        total += result.priors[action];
      }
      if (!std::isfinite(total) || total <= 0.0)
      {
        const double uniform = 1.0 / features.actionCount;
        std::fill(result.priors.begin(), result.priors.end(), uniform);
      }
      else
      {
        for (double& prior : result.priors)
          prior /= total;
      }
    }

    const double remainingReturn = value[0] * kScoreScale;
    result.stateValue.values.fill(remainingReturn);
    result.stateScore.values.fill(remainingReturn);
    for (int action = 0; action < features.actionCount; ++action)
    {
      result.actionValues[action].values.fill(remainingReturn);
      result.actionScores[action].values.fill(remainingReturn);
    }
    return result;
  }

  constexpr std::array<const char*, 7> inputNames = {
    kInputGlobal,
    kInputPersons,
    kInputTraining,
    kInputPlacement,
    kInputActions,
    kInputPersonMask,
    kInputActionMask,
  };
  constexpr std::array<const char*, 5> outputNames = {
    kOutputPolicy,
    kOutputQ,
    kOutputActionScore,
    kOutputValue,
    kOutputStateScore,
  };
  constexpr std::array<int64_t, 2> globalShape = {1, kGlobalFeatures};
  constexpr std::array<int64_t, 3> personShape = {1, kMaxPersons, kPersonFeatures};
  constexpr std::array<int64_t, 3> trainingShape = {1, kTrainingCount, kTrainingFeatures};
  constexpr std::array<int64_t, 3> placementShape = {1, kTrainingCount, kMaxPersons};
  constexpr std::array<int64_t, 3> actionShape = {1, kMaxActions, kActionFeatures};
  constexpr std::array<int64_t, 2> personMaskShape = {1, kMaxPersons};
  constexpr std::array<int64_t, 2> actionMaskShape = {1, kMaxActions};

  auto memory = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
  std::array<Ort::Value, 7> inputs = {
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.global.data()), features.global.size(), globalShape.data(), globalShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.persons.data()), features.persons.size(), personShape.data(), personShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.training.data()), features.training.size(), trainingShape.data(), trainingShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.placement.data()), features.placement.size(), placementShape.data(), placementShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.actions.data()), features.actions.size(), actionShape.data(), actionShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.personMask.data()), features.personMask.size(), personMaskShape.data(), personMaskShape.size()),
    Ort::Value::CreateTensor<float>(memory, const_cast<float*>(features.actionMask.data()), features.actionMask.size(), actionMaskShape.data(), actionMaskShape.size()),
  };

  auto outputs = impl_->session.Run(
    Ort::RunOptions {nullptr},
    inputNames.data(),
    inputs.data(),
    inputs.size(),
    outputNames.data(),
    outputNames.size());

  const float* policy = outputs[0].GetTensorData<float>();
  const float* qValues = outputs[1].GetTensorData<float>();
  const float* actionScores = outputs[2].GetTensorData<float>();
  const float* stateValue = outputs[3].GetTensorData<float>();
  const float* stateScore = outputs[4].GetTensorData<float>();
  validateFinite(policy, kMaxActions, kOutputPolicy);
  validateFinite(qValues, kMaxActions * kQuantiles, kOutputQ);
  validateFinite(actionScores, kMaxActions * kQuantiles, kOutputActionScore);
  validateFinite(stateValue, kQuantiles, kOutputValue);
  validateFinite(stateScore, kQuantiles, kOutputStateScore);

  GraphPrediction result;
  result.priors.resize(features.actionCount);
  result.actionValues.resize(features.actionCount);
  result.actionScores.resize(features.actionCount);
  if (features.actionCount > 0)
  {
    const float maximum = *std::max_element(policy, policy + features.actionCount);
    double total = 0.0;
    for (int action = 0; action < features.actionCount; ++action)
    {
      result.priors[action] = std::exp(
        std::clamp<double>(policy[action] - maximum, -80.0, 0.0));
      total += result.priors[action];
    }
    if (!std::isfinite(total) || total <= 0.0)
      total = static_cast<double>(features.actionCount);
    for (double& prior : result.priors)
      prior = total == static_cast<double>(features.actionCount) && prior <= 0.0
        ? 1.0 / total
        : prior / total;
  }

  for (int action = 0; action < features.actionCount; ++action)
  {
    for (int quantile = 0; quantile < kQuantiles; ++quantile)
    {
      result.actionValues[action].values[quantile] =
        qValues[action * kQuantiles + quantile] * kScoreScale;
      result.actionScores[action].values[quantile] =
        actionScores[action * kQuantiles + quantile] * kScoreScale;
    }
  }
  for (int quantile = 0; quantile < kQuantiles; ++quantile)
  {
    result.stateValue.values[quantile] = stateValue[quantile] * kScoreScale;
    result.stateScore.values[quantile] = stateScore[quantile] * kScoreScale;
  }
  return result;
}

double adjustedRadicalFactor(double maximum, int turn)
{
  const double remaining = turn >= 65 ? 1.0 : 65.0 - turn;
  const double factor = (remaining <= 5.0 ? 5.0 * remaining : remaining + 20.0) / 87.0;
  return std::max(0.0, maximum) * factor;
}

DistributionSummary summarizeDistribution(
  const QuantileDistribution& distribution,
  double radicalFactor)
{
  std::array<double, kQuantiles> sorted = distribution.values;
  std::sort(sorted.begin(), sorted.end());
  DistributionSummary result;
  result.mean = std::accumulate(sorted.begin(), sorted.end(), 0.0) / kQuantiles;
  double squareTotal = 0.0;
  double weightTotal = 0.0;
  double weightedValue = 0.0;
  for (int index = 0; index < kQuantiles; ++index)
  {
    const double delta = sorted[index] - result.mean;
    squareTotal += delta * delta;
    const double rank = (index + 0.5) / kQuantiles;
    const double weight = std::pow(rank, std::max(0.0, radicalFactor));
    weightTotal += weight;
    weightedValue += weight * sorted[index];
  }
  result.stdev = std::sqrt(squareTotal / kQuantiles);
  result.riskAdjusted = weightTotal > 0.0
    ? weightedValue / weightTotal
    : result.mean;
  return result;
}

} // namespace umashow::graph
