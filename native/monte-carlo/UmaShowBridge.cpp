#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <random>
#include <sstream>
#include <string>

#include "External/json.hpp"
#include "Game/Action.h"
#include "Game/Game.h"
#include "GameDatabase/GameConfig.h"
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

json actionJson(const Action& action, int id, const SearchResult& result, double bestValue, const Game& game)
{
  json output = {
    {"id", id},
    {"label", action.toString()},
    {"type", action.type},
    {"train", action.train},
    {"overdrive", action.overdrive},
    {"searches", result.num},
    {"scoreMean", result.lastCalculate.scoreMean},
    {"scoreStdev", result.lastCalculate.scoreStdev},
    {"value", result.lastCalculate.value},
    {"deltaFromBest", bestValue - result.lastCalculate.value},
  };
  if (action.type == 2)
  {
    output["mechaHead"] = action.mechaHead * 3;
    output["mechaChest"] = action.mechaChest * 3;
    output["mechaFoot"] = (game.mecha_EN / 3 - action.mechaHead - action.mechaChest) * 3;
  }
  return output;
}

json analyze(const json& request)
{
  const json options = request.value("options", json::object());
  const json state = request.at("state");

  Game game;
  if (!game.loadGameFromJson(state.dump()))
    throw std::runtime_error("蒙特卡洛核心无法解析当前回合数据");

  const int searchSingleMax = boundedInt(options, "searchSingleMax", 4096, 16, 65536);
  const int threadNum = boundedInt(options, "threadNum", 8, 1, 32);
  const int searchGroupSize = boundedInt(options, "searchGroupSize", 128, std::min(4096, threadNum * 16), 4096);
  const int searchTotalMax = boundedInt(options, "searchTotalMax", 0, 0, 10000000);
  const int maxDepth = boundedInt(options, "maxDepth", 2 * TOTAL_TURN, 1, 2 * TOTAL_TURN);
  const double radicalFactor = std::clamp(options.value("radicalFactor", 3.0), 0.0, 20.0);
  const double searchCpuct = std::clamp(options.value("searchCpuct", 4.0), 0.0, 50.0);

  game.eventStrength = options.value("eventStrength", GameConfig::eventStrength);
  game.ptScoreRate = options.value("scorePtRate", game.ptScoreRate);
  game.scoringMode = options.value("scoringMode", GameConfig::scoringMode);

  SearchParam param(
    searchSingleMax,
    searchTotalMax,
    searchGroupSize,
    searchCpuct,
    maxDepth,
    radicalFactor
  );
  Search search(nullptr, 1, threadNum, param);
  const auto seed = request.value("seed", std::random_device{}());
  std::mt19937_64 random(seed);
  const Action bestAction = search.runSearch(game, random);

  double bestValue = -1e30;
  double bestMean = -1e30;
  for (const auto& result : search.allActionResults)
  {
    if (!result.isLegal)
      continue;
    bestValue = std::max(bestValue, static_cast<double>(result.lastCalculate.value));
    bestMean = std::max(bestMean, static_cast<double>(result.lastCalculate.scoreMean));
  }

  json actions = json::array();
  for (int id = 0; id < Action::MAX_ACTION_TYPE; ++id)
  {
    const auto& result = search.allActionResults[id];
    if (!result.isLegal)
      continue;
    actions.push_back(actionJson(Action(id), id, result, bestValue, game));
  }
  std::sort(actions.begin(), actions.end(), [](const json& left, const json& right) {
    return left.at("value").get<double>() > right.at("value").get<double>();
  });

  return {
    {"ok", true},
    {"id", request.value("id", "")},
    {"turn", game.turn},
    {"gameStage", game.gameStage},
    {"bestActionId", bestAction.toInt()},
    {"bestAction", bestAction.toString()},
    {"bestValue", bestValue},
    {"predictedScore", bestMean},
    {"actions", actions},
    {"options", {
      {"searchSingleMax", search.param.searchSingleMax},
      {"searchTotalMax", search.param.searchTotalMax},
      {"searchGroupSize", search.param.searchGroupSize},
      {"threadNum", threadNum},
      {"radicalFactor", radicalFactor},
      {"searchCpuct", searchCpuct},
      {"maxDepth", maxDepth},
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
    SearchResult::initNormDistributionCdfTable();
    writeResponse({{"ok", true}, {"type", "ready"}});
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
      response = {{"ok", false}, {"error", "蒙特卡洛计算发生未知错误"}};
    }
    writeResponse(response);
  }
  return 0;
}
