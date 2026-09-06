#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <random>
#include <string>

#include "External/json.hpp"
#include "Game/Action.h"
#include "Game/Game.h"
#include "GameDatabase/GameDatabase.h"
#include "NeuralNet/Model.h"
#include "Search/Search.h"

using json = nlohmann::json;

namespace {

constexpr const char* kProtocolPrefix = "UMASHOW_JSON:";

void writeResponse(const json& response)
{
  std::cout << kProtocolPrefix << response.dump() << std::endl;
}

void loadUmaShowDatabase(const std::filesystem::path& path)
{
  std::ifstream input(path, std::ios::binary);
  if (!input)
    throw std::runtime_error("无法读取 UmaShow 蒙特卡洛数据: " + path.string());

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

int boundedInt(const json& options, const char* key, int fallback, int minimum, int maximum)
{
  const int value = options.value(key, fallback);
  return std::clamp(value, minimum, maximum);
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

json analyze(const json& request)
{
  const json options = request.value("options", json::object());
  const json state = request.at("state");

  Game game;
  if (!game.loadGameFromJson(state.dump()))
    throw std::runtime_error("凯旋门蒙特卡洛核心无法解析当前回合数据");

  const int samplingNum = boundedInt(options, "searchSingleMax", 4096, 1, 65536);
  const int threadNum = boundedInt(options, "threadNum", 8, 1, 32);
  const double radicalFactor = std::clamp(options.value("radicalFactor", 3.0), 0.0, 20.0);

  game.eventStrength = boundedInt(options, "eventStrength", game.eventStrength, 0, 1000);

  // BACKEND_NONE can only evaluate terminal states, so LArc must always search
  // through the remaining scenario instead of honoring a shallow maxDepth.
  SearchParam param { samplingNum, TOTAL_TURN, radicalFactor };
  Search search(nullptr, 1, threadNum, param);
  const auto seed = request.value("seed", std::random_device{}());
  std::mt19937_64 random(seed);
  const Action bestAction = search.runSearch(game, random);

  double bestValue = -1e30;
  double bestMean = -1e30;
  int bestActionId = -1;
  json actions = json::array();
  for (int choice = 0; choice < 4; ++choice)
  {
    for (int train = 0; train < 10; ++train)
    {
      const auto& result = search.allChoicesValue[choice][train];
      if (result.scoreMean <= -1e4)
        continue;
      Action action = Search::buyBuffAction(choice, game.turn);
      action.train = train;
      const int id = choice * 10 + train;
      if (result.value > bestValue)
      {
        bestValue = result.value;
        bestMean = result.scoreMean;
        bestActionId = id;
      }
      actions.push_back(actionJson(action, id, search.param.samplingNum, result, 0, game));
    }
  }
  for (auto& action : actions)
    action["deltaFromBest"] = bestValue - action.at("value").get<double>();
  std::sort(actions.begin(), actions.end(), [](const json& left, const json& right) {
    return left.at("value").get<double>() > right.at("value").get<double>();
  });

  return {
    {"ok", true},
    {"id", request.value("id", "")},
    {"scenarioId", 6},
    {"turn", game.turn},
    {"gameStage", 1},
    {"bestActionId", bestActionId},
    {"bestAction", actionLabel(bestAction, game)},
    {"bestValue", bestValue},
    {"predictedScore", bestMean},
    {"actions", actions},
    {"options", {
      {"searchSingleMax", search.param.samplingNum},
      {"threadNum", threadNum},
      {"radicalFactor", radicalFactor},
      {"maxDepth", TOTAL_TURN},
    }},
  };
}

} // namespace

int main(int argc, char** argv)
{
  std::ios::sync_with_stdio(false);
  std::cin.tie(nullptr);

  try
  {
    if (argc < 2)
      throw std::runtime_error("缺少 UmaShow 数据文件路径");
    loadUmaShowDatabase(std::filesystem::u8path(argv[1]));
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
      response = analyze(json::parse(line, nullptr, true, true));
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
