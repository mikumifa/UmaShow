#include <algorithm>
#include <array>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <memory>
#include <random>
#include <string>
#include <unordered_set>
#include <vector>

#include "External/json.hpp"
#include "Graph/GraphFeatures.h"
#include "Graph/GraphModel.h"
#include "Graph/GraphSearch.h"
#include "Game/Action.h"
#include "Game/Game.h"
#include "GameDatabase/GameDatabase.h"
#include "NeuralNet/Model.h"
#include "Search/Search.h"

using json = nlohmann::json;

namespace {

constexpr const char* kProtocolPrefix = "UMASHOW_JSON:";

std::string pathToUtf8(const std::filesystem::path& path)
{
  const auto value = path.u8string();
  return {reinterpret_cast<const char*>(value.data()), value.size()};
}

std::filesystem::path pathFromUtf8(const std::string& value)
{
  const auto* begin = reinterpret_cast<const char8_t*>(value.data());
  return std::filesystem::path(std::u8string(begin, begin + value.size()));
}

void writeResponse(const json& response)
{
  std::cout << kProtocolPrefix << response.dump() << std::endl;
}

void loadUmaShowDatabase(const std::filesystem::path& path)
{
  std::ifstream input(path, std::ios::binary);
  if (!input)
    throw std::runtime_error("无法读取 UmaShow 蒙特卡洛数据: " + pathToUtf8(path));

  json data = json::parse(input, nullptr, true, true);
  GameDatabase::AllUmas.clear();
  GameDatabase::AllCards.clear();
  GameDatabase::DBCards.clear();

  for (auto& entry : data.at("umas").items())
  {
    const int id = std::stoi(entry.key());
    GameDatabase::AllUmas[id] = entry.value().get<UmaData>();
  }
  for (auto& entry : data.at("supportCards").items())
  {
    for (int breakIndex = 0; breakIndex < 5; ++breakIndex)
    {
      SupportCard card;
      card.load_from_json(entry.value(), breakIndex);
      card.isDBCard = true;
      GameDatabase::AllCards[card.cardID] = card;
    }
  }
  if (GameDatabase::AllUmas.empty() || GameDatabase::AllCards.empty())
    throw std::runtime_error("UmaShow 蒙特卡洛数据为空");
}

int boundedInt(
  const json& options,
  const char* key,
  int fallback,
  int minimum,
  int maximum);
void applyStatusTargets(Game& game, const json& options);

bool randomChance(std::mt19937_64& random, double probability)
{
  return std::generate_canonical<double, 53>(random) <
    std::clamp(probability, 0.0, 1.0);
}

struct SelfplayCardPools
{
  std::array<std::vector<int>, 5> regular;
  std::array<std::vector<int>, 5> regularFullBreak;
  std::vector<int> friendCards;
  std::vector<int> friendFullBreak;
};

SelfplayCardPools buildSelfplayCardPools()
{
  SelfplayCardPools result;
  for (const auto& [cardId, card] : GameDatabase::AllCards)
  {
    if (!card.filled)
      continue;
    if (card.cardType >= 0 && card.cardType < 5)
    {
      result.regular[card.cardType].push_back(cardId);
      if (cardId % 10 == 4)
        result.regularFullBreak[card.cardType].push_back(cardId);
      continue;
    }

    const int baseCardId = cardId / 10;
    if (baseCardId == 30160 || baseCardId == 10094)
    {
      result.friendCards.push_back(cardId);
      if (cardId % 10 == 4)
        result.friendFullBreak.push_back(cardId);
    }
  }

  for (auto& pool : result.regular)
    std::sort(pool.begin(), pool.end());
  for (auto& pool : result.regularFullBreak)
    std::sort(pool.begin(), pool.end());
  std::sort(result.friendCards.begin(), result.friendCards.end());
  std::sort(result.friendFullBreak.begin(), result.friendFullBreak.end());
  for (int type = 0; type < 5; ++type)
  {
    if (result.regular[type].empty())
      throw std::runtime_error("自博弈找不到完整的支援卡类型");
  }
  return result;
}

bool cardCanJoinDeck(
  int cardId,
  const std::unordered_set<int>& usedBaseCards,
  const std::unordered_set<int>& usedCharacters,
  const std::unordered_set<int>& usedLinkEffects)
{
  const auto& card = GameDatabase::AllCards.at(cardId);
  if (usedBaseCards.contains(cardId / 10))
    return false;
  if (card.charaId > 0 && usedCharacters.contains(card.charaId))
    return false;
  return card.larc_linkSpecialEffect <= 0 ||
    !usedLinkEffects.contains(card.larc_linkSpecialEffect);
}

int chooseSelfplayCard(
  std::mt19937_64& random,
  const std::vector<int>& allCards,
  const std::vector<int>& fullBreakCards,
  const std::unordered_set<int>& usedBaseCards,
  const std::unordered_set<int>& usedCharacters,
  const std::unordered_set<int>& usedLinkEffects)
{
  for (int phase = 0; phase < 2; ++phase)
  {
    const bool preferFullBreak = phase == 0 &&
      !fullBreakCards.empty() && randomChance(random, 0.9);
    const auto& pool = preferFullBreak ? fullBreakCards : allCards;
    for (int attempt = 0; attempt < 512; ++attempt)
    {
      const int cardId = pool[random() % pool.size()];
      if (cardCanJoinDeck(
            cardId,
            usedBaseCards,
            usedCharacters,
            usedLinkEffects))
      {
        return cardId;
      }
    }
  }
  throw std::runtime_error("自博弈无法生成不重复的支援卡组");
}

void rememberDeckCard(
  int cardId,
  std::unordered_set<int>& usedBaseCards,
  std::unordered_set<int>& usedCharacters,
  std::unordered_set<int>& usedLinkEffects)
{
  const auto& card = GameDatabase::AllCards.at(cardId);
  usedBaseCards.insert(cardId / 10);
  if (card.charaId > 0)
    usedCharacters.insert(card.charaId);
  if (card.larc_linkSpecialEffect > 0)
    usedLinkEffects.insert(card.larc_linkSpecialEffect);
}

std::array<int, 6> randomSelfplayDeck(
  std::mt19937_64& random,
  const SelfplayCardPools& pools)
{
  std::array<int, 5> typeCounts {};
  const bool includeFriend = !pools.friendCards.empty() &&
    randomChance(random, 0.875);
  const int regularCount = includeFriend ? 5 : 6;
  const int archetype = static_cast<int>(random() % 100);
  if (archetype < 35)
    typeCounts = {1, 0, 0, 3, 1};
  else if (archetype < 65)
    typeCounts = {2, 2, 0, 0, 1};
  else if (archetype < 85)
    typeCounts = {2, 0, 2, 0, 1};
  else
  {
    for (int index = 0; index < 5; ++index)
      ++typeCounts[random() % typeCounts.size()];
  }
  if (regularCount == 6)
    ++typeCounts[random() % typeCounts.size()];

  std::array<int, 6> result {};
  int next = 0;
  std::unordered_set<int> usedBaseCards;
  std::unordered_set<int> usedCharacters;
  std::unordered_set<int> usedLinkEffects;
  if (includeFriend)
  {
    const int cardId = chooseSelfplayCard(
      random,
      pools.friendCards,
      pools.friendFullBreak,
      usedBaseCards,
      usedCharacters,
      usedLinkEffects);
    result[next++] = cardId;
    rememberDeckCard(cardId, usedBaseCards, usedCharacters, usedLinkEffects);
  }
  for (int type = 0; type < 5; ++type)
  {
    for (int count = 0; count < typeCounts[type]; ++count)
    {
      const int cardId = chooseSelfplayCard(
        random,
        pools.regular[type],
        pools.regularFullBreak[type],
        usedBaseCards,
        usedCharacters,
        usedLinkEffects);
      result[next++] = cardId;
      rememberDeckCard(cardId, usedBaseCards, usedCharacters, usedLinkEffects);
    }
  }
  if (next != static_cast<int>(result.size()))
    throw std::runtime_error("自博弈生成的支援卡数量不正确");
  std::shuffle(result.begin(), result.end(), random);
  return result;
}

std::array<int, 5> randomBlueInheritance(std::mt19937_64& random)
{
  std::array<int, 5> result {};
  std::discrete_distribution<int> typeDistribution({35, 15, 30, 5, 15});
  std::discrete_distribution<int> starDistribution({8, 22, 70});
  for (int factor = 0; factor < 6; ++factor)
    result[typeDistribution(random)] += starDistribution(random) + 1;
  return result;
}

std::array<int, 6> randomExtraInheritance(std::mt19937_64& random)
{
  std::array<int, 6> result {};
  std::discrete_distribution<int> scenarioDistribution({1, 1, 2});
  std::discrete_distribution<int> starDistribution({10, 30, 60});
  for (int factor = 0; factor < 6; ++factor)
  {
    const int scenario = scenarioDistribution(random);
    const int stars = starDistribution(random) + 1;
    const int bonus = stars == 3 ? 8 : stars == 2 ? 4 : 2;
    if (scenario == 0)
    {
      result[2] += bonus;
      result[4] += bonus;
    }
    else if (scenario == 1)
    {
      result[0] += bonus;
      result[2] += bonus;
    }
    else
    {
      result[1] += bonus;
      result[2] += bonus;
    }
  }
  std::exponential_distribution<double> skillFactor(1.0 / 70.0);
  result[5] = std::min(300, static_cast<int>(std::round(skillFactor(random))));
  return result;
}

void randomizeSelfplayTargets(
  Game& game,
  std::mt19937_64& random,
  const json& options)
{
  static const char* targetKeys[5] = {
    "targetSpeed", "targetStamina", "targetPower", "targetGuts", "targetWisdom"
  };
  bool hasExplicitTargets = false;
  for (const char* key : targetKeys)
    hasExplicitTargets = hasExplicitTargets || options.contains(key);
  if (hasExplicitTargets)
  {
    applyStatusTargets(game, options);
    return;
  }
  if (!options.value("randomizeTargets", true) || !randomChance(random, 0.5))
    return;

  std::uniform_real_distribution<double> ratio(0.65, 0.95);
  const int cappedStatusCount = randomChance(random, 0.25) ? 2 : 1;
  std::array<int, 5> indices {0, 1, 2, 3, 4};
  std::shuffle(indices.begin(), indices.end(), random);
  for (int index = 0; index < cappedStatusCount; ++index)
  {
    const int status = indices[index];
    game.fiveStatusTarget[status] = std::clamp(
      static_cast<int>(std::round(game.fiveStatusLimit[status] * ratio(random))),
      1000,
      static_cast<int>(game.fiveStatusLimit[status]));
  }
}

struct SelfplayOpening
{
  Game game;
  json metadata;
};

SelfplayOpening randomSelfplayOpening(
  std::mt19937_64& random,
  const SelfplayCardPools& pools,
  const json& options)
{
  std::vector<int> umaIds;
  umaIds.reserve(GameDatabase::AllUmas.size());
  for (const auto& [umaId, uma] : GameDatabase::AllUmas)
  {
    if (uma.gameId > 0)
      umaIds.push_back(umaId);
  }
  if (umaIds.empty())
    throw std::runtime_error("自博弈找不到可用的育成角色");
  std::sort(umaIds.begin(), umaIds.end());

  const int umaId = umaIds[random() % umaIds.size()];
  const int maximumStars = std::clamp(GameDatabase::AllUmas.at(umaId).star, 3, 5);
  const int starRoll = static_cast<int>(random() % 10);
  const int umaStars = std::min(maximumStars, starRoll < 7 ? 5 : starRoll < 9 ? 4 : 3);
  auto deck = randomSelfplayDeck(random, pools);
  auto blueInheritance = randomBlueInheritance(random);
  auto extraInheritance = randomExtraInheritance(random);

  SelfplayOpening result;
  try
  {
    result.game.newGame(
      random,
      false,
      umaId,
      umaStars,
      deck.data(),
      blueInheritance.data(),
      extraInheritance.data());
  }
  catch (const std::string& error)
  {
    throw std::runtime_error(error);
  }
  std::normal_distribution<double> eventStrengthNoise(0.0, 4.0);
  result.game.eventStrength = std::clamp(
    result.game.eventStrength + static_cast<int>(std::round(eventStrengthNoise(random))),
    0,
    50);
  const int debuffProfile = static_cast<int>(random() % 4);
  result.game.larc_allowedDebuffsFirstLarc[4] = debuffProfile == 1 || debuffProfile == 3;
  result.game.larc_allowedDebuffsFirstLarc[6] = debuffProfile == 2 || debuffProfile == 3;
  randomizeSelfplayTargets(result.game, random, options);

  result.metadata = {
    {"umaId", umaId},
    {"umaStars", umaStars},
    {"cards", deck},
    {"blueInheritance", blueInheritance},
    {"extraInheritance", extraInheritance},
    {"targets", std::vector<int>(
      result.game.fiveStatusTarget,
      result.game.fiveStatusTarget + 5)},
  };
  return result;
}

int boundedInt(const json& options, const char* key, int fallback, int minimum, int maximum)
{
  const int value = options.value(key, fallback);
  return std::clamp(value, minimum, maximum);
}

constexpr int displayedStatusToInternal(int value)
{
  return value > 1200 ? value * 2 - 1200 : value;
}

static_assert(displayedStatusToInternal(1200) == 1200);
static_assert(displayedStatusToInternal(1600) == 2000);

void applyStatusTargets(Game& game, const json& options)
{
  static const char* keys[5] = {
    "targetSpeed", "targetStamina", "targetPower", "targetGuts", "targetWisdom"
  };
  for (int i = 0; i < 5; i++)
  {
    const int displayedTarget = boundedInt(options, keys[i], 0, 0, 3000);
    game.fiveStatusTarget[i] = displayedTarget == 0
      ? game.fiveStatusLimit[i]
      : std::min<int>(game.fiveStatusLimit[i], displayedStatusToInternal(displayedTarget));
  }
}

std::string actionLabel(const Action& action, const Game& game)
{
  static const char* labels[] = {
    "速度训练", "耐力训练", "力量训练", "毅力训练", "智力训练",
    "SS/SSS 对战", "休息", "佐岳外出", "普通外出", "比赛"
  };
  std::string label = action.train >= 0 && action.train < 10
    ? labels[action.train]
    : "未知行动";
  if (action.train == 6 && game.larc_isAbroad)
    label = "吃法棍";
  if (action.buy50p)
    label += " + 训练效果 50%";
  if (action.buyPt10)
    label += " + 技能点 10";
  if (action.buyFriend20)
    label += " + 友情 20%";
  if (action.buyVital20)
    label += " + 体力消耗 -20%";
  return label;
}

json actionJson(
  const Action& action,
  int id,
  int searches,
  const ModelOutputValueV1& result,
  double bestValue,
  const Game& game)
{
  return {
    {"id", id},
    {"label", actionLabel(action, game)},
    {"type", 0},
    {"train", action.train},
    {"overdrive", false},
    {"buy50p", action.buy50p},
    {"buyPt10", action.buyPt10},
    {"buyFriend20", action.buyFriend20},
    {"buyVital20", action.buyVital20},
    {"searches", searches},
    {"scoreMean", result.scoreMean},
    {"scoreStdev", result.scoreStdev},
    {"value", result.value},
    {"deltaFromBest", bestValue - result.value},
  };
}

struct ActionEvaluation
{
  Action action {};
  int id = -1;
  int searches = 0;
  double scoreMean = 0.0;
  double scoreStdev = 0.0;
  double value = 0.0;
};

struct RecommendationComputation
{
  std::vector<ActionEvaluation> actions;
  Action bestAction {};
  int bestActionId = -1;
  double bestValue = -1e30;
  double predictedScore = -1e30;
  std::string backend = "builtin";
  int simulations = 0;
  int nodes = 0;
  int elapsedMs = 0;
};

class GraphModelCache
{
public:
  umashow::graph::GraphModel& get(const std::string& utf8Path)
  {
    const auto requestedPath = pathFromUtf8(utf8Path);
    if (!std::filesystem::is_regular_file(requestedPath))
      throw std::runtime_error("找不到选择的模型文件");
    const auto modified = std::filesystem::last_write_time(requestedPath);
    if (model_ && requestedPath == path_ && modified == modified_)
      return *model_;
    if (!error_.empty() && requestedPath == path_ && modified == modified_)
      throw std::runtime_error(error_);

    path_ = requestedPath;
    modified_ = modified;
    model_.reset();
    error_.clear();
    try
    {
      model_ = std::make_unique<umashow::graph::GraphModel>(requestedPath);
    }
    catch (const std::exception& exception)
    {
      error_ = exception.what();
      throw;
    }
    return *model_;
  }

private:
  std::filesystem::path path_;
  std::filesystem::file_time_type modified_ {};
  std::unique_ptr<umashow::graph::GraphModel> model_;
  std::string error_;
};

GraphModelCache& graphModelCache()
{
  static GraphModelCache cache;
  return cache;
}

RecommendationComputation runBuiltinRecommendation(
  const Game& game,
  std::mt19937_64& random,
  int samplingNum,
  int threadNum,
  double radicalFactor)
{
  SearchParam param {samplingNum, TOTAL_TURN, radicalFactor};
  Search search(nullptr, 1, threadNum, param);
  const Action bestAction = search.runSearch(game, random);

  RecommendationComputation computation;
  computation.bestAction = bestAction;
  for (int choice = 0; choice < 4; ++choice)
  {
    for (int train = 0; train < 10; ++train)
    {
      const auto& result = search.allChoicesValue[choice][train];
      if (result.scoreMean <= -1e4)
        continue;
      Action action = Search::buyBuffAction(choice, game.turn);
      action.train = static_cast<int8_t>(train);
      const int id = choice * 10 + train;
      computation.actions.push_back({
        action,
        id,
        search.param.samplingNum,
        result.scoreMean,
        result.scoreStdev,
        result.value,
      });
      if (result.value > computation.bestValue)
      {
        computation.bestValue = result.value;
        computation.predictedScore = result.scoreMean;
        computation.bestActionId = id;
      }
    }
  }
  computation.simulations = search.param.samplingNum *
    static_cast<int>(computation.actions.size());
  return computation;
}

RecommendationComputation runGraphRecommendation(
  const Game& game,
  std::mt19937_64& random,
  umashow::graph::GraphModel& model,
  const json& options,
  double radicalFactor)
{
  umashow::graph::GraphSearchConfig config;
  config.nodeBudget = boundedInt(options, "graphSearchNodes", 384, 16, 8192);
  config.maxDepth = boundedInt(options, "graphSearchDepth", 5, 1, 16);
  config.timeBudgetMs = boundedInt(options, "graphSearchTimeMs", 900, 50, 30000);
  config.topK = boundedInt(options, "graphSearchTopK", 4, 1, 12);
  config.maxChanceOutcomes = boundedInt(
    options,
    "graphSearchChanceOutcomes",
    8,
    1,
    32);
  config.cpuct = std::clamp(
    options.value("graphSearchCpuct", 1.5),
    0.0,
    20.0);
  config.radicalFactor = radicalFactor;

  umashow::graph::GraphSearch search(model, config);
  const auto searchResult = search.run(game, random);
  if (searchResult.bestActionIndex < 0 ||
      searchResult.bestActionIndex >= static_cast<int>(searchResult.actions.size()))
  {
    throw std::runtime_error("模型搜索没有产生推荐行动");
  }

  RecommendationComputation computation;
  computation.backend = "graph";
  computation.simulations = searchResult.simulations;
  computation.nodes = searchResult.nodes;
  computation.elapsedMs = searchResult.elapsedMs;
  for (const auto& result : searchResult.actions)
  {
    computation.actions.push_back({
      result.graphAction.action,
      result.graphAction.id,
      result.visits,
      result.scoreMean,
      result.scoreStdev,
      result.value,
    });
  }
  const auto& best = computation.actions[searchResult.bestActionIndex];
  computation.bestAction = best.action;
  computation.bestActionId = best.id;
  computation.bestValue = best.value;
  computation.predictedScore = best.scoreMean;
  return computation;
}

RecommendationComputation computeRecommendation(
  const Game& game,
  std::mt19937_64& random,
  const json& options,
  std::string& fallbackReason)
{
  const int samplingNum = boundedInt(
    options,
    "searchSingleMax",
    4096,
    1,
    65536);
  const int threadNum = boundedInt(options, "threadNum", 8, 1, 32);
  const double radicalFactor = std::clamp(
    options.value("radicalFactor", 3.0),
    0.0,
    20.0);
  const std::string modelPath = options.value("modelPath", "");

  RecommendationComputation computation;
  if (!modelPath.empty())
  {
    try
    {
      auto& model = graphModelCache().get(modelPath);
      computation = runGraphRecommendation(
        game,
        random,
        model,
        options,
        radicalFactor);
    }
    catch (const std::exception& exception)
    {
      fallbackReason = std::string("模型不可用，已使用内置推荐逻辑：") +
        exception.what();
    }
  }
  if (computation.actions.empty())
  {
    computation = runBuiltinRecommendation(
      game,
      random,
      samplingNum,
      threadNum,
      radicalFactor);
  }
  return computation;
}

json recommendationActionsJson(
  const RecommendationComputation& computation,
  const Game& game)
{
  json actions = json::array();
  for (const auto& result : computation.actions)
  {
    actions.push_back({
      {"id", result.id},
      {"label", actionLabel(result.action, game)},
      {"type", 0},
      {"train", result.action.train},
      {"overdrive", false},
      {"buy50p", result.action.buy50p},
      {"buyPt10", result.action.buyPt10},
      {"buyFriend20", result.action.buyFriend20},
      {"buyVital20", result.action.buyVital20},
      {"searches", result.searches},
      {"scoreMean", result.scoreMean},
      {"scoreStdev", result.scoreStdev},
      {"value", result.value},
      {"deltaFromBest", computation.bestValue - result.value},
    });
  }
  std::sort(actions.begin(), actions.end(), [](const json& left, const json& right) {
    return left.at("value").get<double>() > right.at("value").get<double>();
  });
  return actions;
}

json graphFeaturesJson(
  const umashow::graph::GraphFeatures& features,
  const std::vector<umashow::graph::GraphAction>& actions)
{
  json persons = json::array();
  for (int person = 0; person < umashow::graph::kMaxPersons; ++person)
  {
    persons.push_back(std::vector<float>(
      features.persons.begin() + person * umashow::graph::kPersonFeatures,
      features.persons.begin() + (person + 1) * umashow::graph::kPersonFeatures));
  }
  json training = json::array();
  for (int index = 0; index < umashow::graph::kTrainingCount; ++index)
  {
    training.push_back(std::vector<float>(
      features.training.begin() + index * umashow::graph::kTrainingFeatures,
      features.training.begin() + (index + 1) * umashow::graph::kTrainingFeatures));
  }
  json placement = json::array();
  for (int index = 0; index < umashow::graph::kTrainingCount; ++index)
  {
    placement.push_back(std::vector<float>(
      features.placement.begin() + index * umashow::graph::kMaxPersons,
      features.placement.begin() + (index + 1) * umashow::graph::kMaxPersons));
  }
  json actionFeatures = json::array();
  for (int index = 0; index < umashow::graph::kMaxActions; ++index)
  {
    actionFeatures.push_back(std::vector<float>(
      features.actions.begin() + index * umashow::graph::kActionFeatures,
      features.actions.begin() + (index + 1) * umashow::graph::kActionFeatures));
  }
  std::vector<int> actionIds;
  actionIds.reserve(actions.size());
  for (const auto& action : actions)
    actionIds.push_back(action.id);
  return {
    {"schemaVersion", umashow::graph::kSchemaVersion},
    {"globalFeatures", features.global},
    {"personFeatures", persons},
    {"trainingFeatures", training},
    {"placement", placement},
    {"actionFeatures", actionFeatures},
    {"personMask", features.personMask},
    {"actionMask", features.actionMask},
    {"actionIds", actionIds},
  };
}

const ActionEvaluation& selectSelfplayAction(
  const RecommendationComputation& computation,
  const Game& game,
  std::mt19937_64& random,
  const json& options)
{
  if (computation.actions.empty())
    throw std::runtime_error("自博弈搜索没有产生可用行动");
  const double explorationRate = std::clamp(
    options.value("playExploration", 0.08),
    0.0,
    1.0);
  if (randomChance(random, explorationRate))
    return computation.actions[random() % computation.actions.size()];

  const double baseTemperature = std::max(
    0.0,
    options.value("playTemperature", 120.0));
  if (baseTemperature <= 1e-9)
  {
    return *std::max_element(
      computation.actions.begin(),
      computation.actions.end(),
      [](const ActionEvaluation& left, const ActionEvaluation& right) {
        return left.value < right.value;
      });
  }

  const double remainingRatio = std::clamp(
    static_cast<double>(TOTAL_TURN - game.turn) / TOTAL_TURN,
    0.0,
    1.0);
  const double temperature = std::max(
    10.0,
    baseTemperature * (0.35 + 0.65 * remainingRatio));
  double bestValue = -std::numeric_limits<double>::infinity();
  for (const auto& action : computation.actions)
    bestValue = std::max(bestValue, action.value);
  std::vector<double> weights;
  weights.reserve(computation.actions.size());
  for (const auto& action : computation.actions)
  {
    const double logWeight = std::clamp(
      (action.value - bestValue) / temperature,
      -60.0,
      0.0);
    weights.push_back(std::exp(logWeight));
  }
  std::discrete_distribution<std::size_t> selection(
    weights.begin(),
    weights.end());
  return computation.actions[selection(random)];
}

json selfplaySampleJson(
  const Game& game,
  const RecommendationComputation& computation,
  int playedActionId,
  int gameIndex)
{
  const auto legalActions = umashow::graph::enumerateLegalActions(game);
  return {
    {"scenarioId", 6},
    {"gameIndex", gameIndex},
    {"turn", game.turn},
    {"playedActionId", playedActionId},
    {"bestActionId", computation.bestActionId},
    {"bestValue", computation.bestValue},
    {"predictedScore", computation.predictedScore},
    {"backend", computation.backend},
    {"actions", recommendationActionsJson(computation, game)},
    {"graphFeatures", graphFeaturesJson(
      umashow::graph::buildGraphFeatures(game, legalActions),
      legalActions)},
  };
}

json generateSelfplay(const json& request)
{
  const json options = request.value("options", json::object());
  const int gameCount = boundedInt(options, "gameCount", 1, 1, 16);
  const auto seed = request.value("seed", std::random_device{}());
  std::mt19937_64 random(seed);
  const auto cardPools = buildSelfplayCardPools();
  json samples = json::array();
  json games = json::array();
  int fallbackCount = 0;

  for (int gameIndex = 0; gameIndex < gameCount; ++gameIndex)
  {
    auto opening = randomSelfplayOpening(random, cardPools, options);
    Game game = std::move(opening.game);
    const std::size_t firstSample = samples.size();
    int decisions = 0;
    while (!game.isEnd())
    {
      if (decisions > TOTAL_TURN + 4)
        throw std::runtime_error("自博弈回合推进没有正常结束");
      std::string fallbackReason;
      const auto computation = computeRecommendation(
        game,
        random,
        options,
        fallbackReason);
      if (!fallbackReason.empty())
        ++fallbackCount;
      const auto& selected = selectSelfplayAction(
        computation,
        game,
        random,
        options);
      samples.push_back(selfplaySampleJson(
        game,
        computation,
        selected.id,
        gameIndex));
      game.applyTrainingAndNextTurn(random, selected.action);
      ++decisions;
    }
    opening.metadata["decisions"] = decisions;
    opening.metadata["samples"] = samples.size() - firstSample;
    opening.metadata["finalScore"] = game.finalScore();
    opening.metadata["recommendationScore"] = game.recommendationScore();
    games.push_back(std::move(opening.metadata));
  }

  return {
    {"ok", true},
    {"id", request.value("id", "")},
    {"type", "selfplay"},
    {"scenarioId", 6},
    {"gameCount", gameCount},
    {"sampleCount", samples.size()},
    {"fallbackCount", fallbackCount},
    {"games", std::move(games)},
    {"samples", std::move(samples)},
  };
}

json analyze(const json& request)
{
  const json options = request.value("options", json::object());
  const json state = request.at("state");

  Game game;
  if (!game.loadGameFromJson(state.dump()))
    throw std::runtime_error("凯旋门蒙特卡洛核心无法解析当前回合数据");

  game.eventStrength = boundedInt(options, "eventStrength", game.eventStrength, 0, 1000);
  applyStatusTargets(game, options);

  const auto seed = request.value("seed", std::random_device{}());
  std::mt19937_64 random(seed);
  const int samplingNum = boundedInt(options, "searchSingleMax", 4096, 1, 65536);
  const int threadNum = boundedInt(options, "threadNum", 8, 1, 32);
  const double radicalFactor = std::clamp(
    options.value("radicalFactor", 3.0),
    0.0,
    20.0);
  const std::string modelPath = options.value("modelPath", "");
  std::string fallbackReason;
  const auto computation = computeRecommendation(
    game,
    random,
    options,
    fallbackReason);

  json response = {
    {"ok", true},
    {"id", request.value("id", "")},
    {"scenarioId", 6},
    {"turn", game.turn},
    {"gameStage", 1},
    {"bestActionId", computation.bestActionId},
    {"bestAction", actionLabel(computation.bestAction, game)},
    {"bestValue", computation.bestValue},
    {"predictedScore", computation.predictedScore},
    {"actions", recommendationActionsJson(computation, game)},
    {"backend", computation.backend},
    {"modelLoaded", computation.backend == "graph"},
    {"modelPath", modelPath},
    {"fallbackReason", fallbackReason},
    {"searchStats", {
      {"simulations", computation.simulations},
      {"nodes", computation.nodes},
      {"elapsedMs", computation.elapsedMs},
    }},
    {"options", {
      {"searchSingleMax", samplingNum},
      {"threadNum", threadNum},
      {"radicalFactor", radicalFactor},
      {"maxDepth", computation.backend == "graph"
        ? boundedInt(options, "graphSearchDepth", 5, 1, 16)
        : TOTAL_TURN},
      {"modelPath", modelPath},
      {"graphSearchNodes", boundedInt(options, "graphSearchNodes", 384, 16, 8192)},
      {"graphSearchDepth", boundedInt(options, "graphSearchDepth", 5, 1, 16)},
      {"graphSearchTimeMs", boundedInt(options, "graphSearchTimeMs", 900, 50, 30000)},
      {"graphSearchTopK", boundedInt(options, "graphSearchTopK", 4, 1, 12)},
      {"graphSearchCpuct", std::clamp(options.value("graphSearchCpuct", 1.5), 0.0, 20.0)},
      {"targetSpeed", options.value("targetSpeed", 0)},
      {"targetStamina", options.value("targetStamina", 0)},
      {"targetPower", options.value("targetPower", 0)},
      {"targetGuts", options.value("targetGuts", 0)},
      {"targetWisdom", options.value("targetWisdom", 0)},
    }},
  };
  if (options.value("exportGraphFeatures", false))
  {
    const auto legalActions = umashow::graph::enumerateLegalActions(game);
    response["graphFeatures"] = graphFeaturesJson(
      umashow::graph::buildGraphFeatures(game, legalActions),
      legalActions);
  }
  return response;
}

json handleRequest(const json& request)
{
  const std::string command = request.value("command", "analyze");
  if (command == "analyze")
    return analyze(request);
  if (command == "selfplay")
    return generateSelfplay(request);
  throw std::runtime_error("未知的推荐组件命令: " + command);
}

} // namespace

int wmain(int argc, wchar_t** argv)
{
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  try
  {
    if (argc < 2)
      throw std::runtime_error("缺少 UmaShow 数据文件路径");
    loadUmaShowDatabase(std::filesystem::path(argv[1]));
    writeResponse({{"ok", true}, {"type", "ready"}, {"scenarioId", 6}});
  }
  catch (const std::exception& error)
  {
    writeResponse({{"ok", false}, {"type", "fatal"}, {"error", error.what()}});
    return 1;
  }

  std::string line;
  while (std::getline(std::cin, line))
  {
    if (line.empty())
      continue;
    json response;
    try
    {
      response = handleRequest(json::parse(line, nullptr, true, true));
    }
    catch (const std::exception& error)
    {
      response = {{"ok", false}, {"error", error.what()}};
      try
      {
        const json request = json::parse(line, nullptr, false, true);
        if (!request.is_discarded())
          response["id"] = request.value("id", "");
      }
      catch (...)
      {
      }
    }
    catch (...)
    {
      response = {{"ok", false}, {"error", "凯旋门蒙特卡洛计算发生未知错误"}};
    }
    writeResponse(response);
  }
  return 0;
}
