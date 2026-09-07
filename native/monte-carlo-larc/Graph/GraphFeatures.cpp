#include "GraphFeatures.h"

#include <algorithm>
#include <cassert>
#include <cmath>

#include "../Game/Game.h"
#include "../Search/Search.h"

namespace umashow::graph {
namespace {

float normalized(double value, double scale)
{
  if (scale == 0.0)
    return 0.0F;
  return static_cast<float>(std::clamp(value / scale, -4.0, 4.0));
}

float flag(bool value)
{
  return value ? 1.0F : 0.0F;
}

float futureDistance(int turn, int target)
{
  if (turn >= target)
    return 0.0F;
  return normalized(target - turn, TOTAL_TURN);
}

int personCountAtTraining(const Game& game, int training)
{
  int count = 0;
  for (int slot = 0; slot < 5; ++slot)
  {
    if (game.personDistribution[training][slot] < 0)
      break;
    ++count;
  }
  return count;
}

int purchaseCost(const Game& game, const Action& action)
{
  int cost = 0;
  const auto addCost = [&](int potential) {
    const int value = game.buyUpgradeCost(potential, 3);
    if (value > 0)
      cost += value;
  };
  if (action.buy50p && action.train >= 0 && action.train < 5)
    addCost(action.train);
  if (action.buyPt10)
    addCost(5);
  if (action.buyVital20)
    addCost(6);
  if (action.buyFriend20)
    addCost(7);
  return cost;
}

} // namespace

std::vector<GraphAction> enumerateLegalActions(const Game& game)
{
  std::vector<GraphAction> result;
  const int choiceCount = Search::buyBuffChoiceNum(game.turn);
  if (choiceCount <= 0)
    return result;

  for (int choice = 0; choice < choiceCount; ++choice)
  {
    const Action base = Search::buyBuffAction(choice, game.turn);
    const int trainCount = choice == 0 ? 10 : (base.buyVital20 ? 4 : 5);
    for (int train = 0; train < trainCount; ++train)
    {
      Action action = base;
      action.train = static_cast<int8_t>(train);
      if (!game.isLegal(action))
        continue;
      result.push_back({action, choice * 10 + train});
      if (static_cast<int>(result.size()) >= kMaxActions)
        return result;
    }
  }
  return result;
}

GraphFeatures buildGraphFeatures(
  const Game& game,
  const std::vector<GraphAction>& legalActions)
{
  GraphFeatures result;
  result.actionIds.fill(-1);

  auto& global = result.global;
  global[0] = 1.0F;
  global[1] = normalized(game.turn, TOTAL_TURN - 1);
  global[2] = normalized(TOTAL_TURN - game.turn, TOTAL_TURN);
  global[3] = normalized(game.stageInTurn, 2);
  global[4] = normalized(game.vital, 120);
  global[5] = normalized(game.maxVital, 120);
  global[6] = normalized(game.motivation, 5);
  global[7] = flag(game.isQieZhe);
  global[8] = flag(game.isAiJiao);
  global[9] = normalized(game.failureRateBias, 10);
  global[10] = flag(game.isPositiveThinking);
  global[11] = flag(game.isRacing);
  global[12] = flag(game.larc_isAbroad);
  global[13] = normalized(game.eventStrength, 100);
  global[14] = normalized(game.saihou, 100);
  global[15] = normalized(game.skillPt, 3000);
  global[16] = normalized(game.skillScore, kScoreScale);
  global[17] = normalized(game.normalCardCount, 6);
  global[18] = normalized(game.motivationDropCount, 5);
  global[19] = normalized(game.larc_supportPtAll, 30000);
  global[20] = normalized(game.larc_shixingPt, 3000);
  global[21] = normalized(game.larc_trainBonus, 100);
  global[22] = normalized(game.larc_ssPersonsCount, 5);
  global[23] = flag(game.larc_isSSS);
  global[24] = normalized(game.larc_ssWin, 30);
  global[25] = normalized(game.larc_ssWinSinceLastSSS, 8);
  global[26] = static_cast<float>(game.sssProb(game.larc_ssWinSinceLastSSS));
  global[27] = normalized(game.larc_zuoyueType, 2);
  global[28] = flag(game.larc_zuoyueFirstClick);
  global[29] = flag(game.larc_zuoyueOutgoingUnlocked);
  global[30] = flag(game.larc_zuoyueOutgoingRefused);
  global[31] = normalized(game.larc_zuoyueOutgoingUsed, 5);
  global[32] = normalized(game.larc_zuoyueVitalBonus, 2);
  global[33] = normalized(game.larc_zuoyueStatusBonus, 2);
  global[34] = futureDistance(game.turn, 29);
  global[35] = futureDistance(game.turn, 53);
  global[36] = futureDistance(game.turn, 36);
  global[37] = futureDistance(game.turn, 60);
  global[38] = futureDistance(game.turn, TOTAL_TURN);
  global[39] = flag(game.turn < 36);

  for (int status = 0; status < 5; ++status)
  {
    const int target = game.fiveStatusTarget[status] > 0
      ? std::min<int>(game.fiveStatusTarget[status], game.fiveStatusLimit[status])
      : game.fiveStatusLimit[status];
    global[40 + status] = normalized(game.fiveStatus[status], 3000);
    global[45 + status] = normalized(game.fiveStatusLimit[status], 3000);
    global[50 + status] = normalized(target, 3000);
    global[55 + status] = normalized(
      std::max(0, target - game.fiveStatus[status]),
      3000);
    global[60 + status] = normalized(game.fiveStatusBonus[status], 100);
    global[65 + status] = normalized(game.getTrainingLevel(status) + 1, 6);
    global[70 + status] = normalized(game.trainLevelCount[status], 16);
    global[75 + status] = normalized(game.zhongMaBlueCount[status], 6);
  }
  for (int index = 0; index < 6; ++index)
    global[80 + index] = normalized(game.zhongMaExtraBonus[index], 500);
  for (int index = 0; index < 10; ++index)
    global[86 + index] = normalized(game.larc_levels[index], 3);

  for (int personIndex = 0; personIndex < kMaxPersons; ++personIndex)
  {
    const auto& person = game.persons[personIndex];
    float* features = result.persons.data() + personIndex * kPersonFeatures;
    result.personMask[personIndex] = 1.0F;
    features[0] = 1.0F;
    if (person.personType >= 1 && person.personType <= 6)
      features[person.personType] = 1.0F;
    features[7] = normalized(person.friendship, 100);
    features[8] = normalized(std::max(0, 60 - person.friendship), 60);
    features[9] = normalized(std::max(0, 80 - person.friendship), 80);
    features[10] = flag(person.isShining);
    features[11] = flag(person.isHint);
    features[12] = normalized(person.cardRecord, 10);
    features[13] = flag(person.larc_isLinkCard);
    features[14] = normalized(person.larc_charge, 3);
    features[15] = normalized(person.larc_level, 15);
    features[16] = normalized(person.larc_buffLevel, 15);
    if (person.larc_statusType >= 0 && person.larc_statusType < 5)
      features[17 + person.larc_statusType] = 1.0F;
    if (person.larc_specialBuff >= 0 && person.larc_specialBuff <= 12)
      features[22 + person.larc_specialBuff] = 1.0F;
    for (int offset = 0; offset < 3; ++offset)
    {
      const int buff = person.larc_nextThreeBuffs[offset];
      if (buff >= 0 && buff <= 12)
        features[35 + offset * 13 + buff] = 1.0F;
    }

    if (person.cardIdInGame >= 0 && person.cardIdInGame < 6)
    {
      const auto& card = game.cardParam[person.cardIdInGame];
      if (card.cardType >= 0 && card.cardType <= 6)
        features[74 + card.cardType] = 1.0F;
      features[81] = normalized(card.initialJiBan, 100);
      features[82] = normalized(card.deYiLv, 200);
      features[83] = normalized(card.youQingBasic, 100);
      features[84] = normalized(card.ganJingBasic, 100);
      features[85] = normalized(card.xunLianBasic, 100);
      for (int status = 0; status < 6; ++status)
        features[86 + status] = normalized(card.bonusBasic[status], 50);
      features[92] = normalized(card.wizVitalBonusBasic, 20);
      features[93] = normalized(card.saiHou, 100);
      features[94] = normalized(card.failRateDrop, 100);
      features[95] = normalized(card.vitalCostDrop, 100);
    }
  }

  for (int trainingIndex = 0; trainingIndex < kTrainingCount; ++trainingIndex)
  {
    float* features = result.training.data() + trainingIndex * kTrainingFeatures;
    features[trainingIndex] = 1.0F;
    features[5] = normalized(game.getTrainingLevel(trainingIndex) + 1, 6);
    for (int status = 0; status < 5; ++status)
      features[6 + status] = normalized(game.trainValue[trainingIndex][status], 200);
    features[11] = normalized(game.trainValue[trainingIndex][5], 200);
    features[12] = normalized(game.trainValue[trainingIndex][6], 100);
    features[13] = normalized(game.failRate[trainingIndex], 100);
    features[14] = normalized(game.trainShiningNum[trainingIndex], 5);

    int supportCount = 0;
    int npcCount = 0;
    int hintCount = 0;
    int chargeableCount = 0;
    int totalCharge = 0;
    bool hasFriend = false;
    for (int slot = 0; slot < 5; ++slot)
    {
      const int personIndex = game.personDistribution[trainingIndex][slot];
      if (personIndex < 0 || personIndex >= kMaxPersons)
        break;
      result.placement[trainingIndex * kMaxPersons + personIndex] = 1.0F;
      const auto& person = game.persons[personIndex];
      supportCount += person.personType == 1 || person.personType == 2;
      npcCount += person.personType == 3;
      hintCount += person.isHint;
      hasFriend = hasFriend || person.personType == 1;
      if ((person.personType == 2 || person.personType == 3) && person.larc_charge < 3)
        ++chargeableCount;
      totalCharge += std::clamp<int>(person.larc_charge, 0, 3);
    }
    const int people = personCountAtTraining(game, trainingIndex);
    features[15] = normalized(people, 5);
    features[16] = normalized(supportCount, 5);
    features[17] = normalized(npcCount, 5);
    features[18] = flag(hasFriend);
    features[19] = normalized(hintCount, 5);
    features[20] = normalized(chargeableCount, 5);
    features[21] = normalized(totalCharge, 15);
    features[22] = normalized(game.larc_shixingPtGainAbroad[trainingIndex], 300);
    features[23] = flag(game.larc_isAbroad);
    for (int status = 0; status < 5; ++status)
    {
      const int target = game.fiveStatusTarget[status] > 0
        ? std::min<int>(game.fiveStatusTarget[status], game.fiveStatusLimit[status])
        : game.fiveStatusLimit[status];
      const int after = game.fiveStatus[status] + game.trainValue[trainingIndex][status];
      features[24 + status] = normalized(std::max(0, target - after), 3000);
      features[29 + status] = normalized(std::max(0, after - target), 500);
      features[34 + status] = normalized(game.fiveStatusBonus[status], 100);
    }
    features[39] = normalized(game.vital + game.trainValue[trainingIndex][6], 120);
    features[40] = normalized(game.larc_trainBonus, 100);
    features[41] = normalized(game.larc_staticBonus[trainingIndex], 100);
    features[42] = normalized(game.trainLevelCount[trainingIndex], 16);
    features[43] = normalized(game.larc_levels[trainingIndex], 3);
    features[44] = normalized(game.larc_supportPtAll, 30000);
    features[45] = normalized(game.larc_shixingPt, 3000);
    features[46] = flag(game.turn >= 60);
    features[47] = flag(game.turn >= 36 && game.turn <= 42);
  }

  result.actionCount = std::min<int>(legalActions.size(), kMaxActions);
  for (int actionIndex = 0; actionIndex < result.actionCount; ++actionIndex)
  {
    const auto& graphAction = legalActions[actionIndex];
    const auto& action = graphAction.action;
    float* features = result.actions.data() + actionIndex * kActionFeatures;
    result.actionMask[actionIndex] = 1.0F;
    result.actionIds[actionIndex] = graphAction.id;
    features[0] = 1.0F;
    if (action.train >= 0 && action.train < 10)
      features[1 + action.train] = 1.0F;
    features[11] = flag(action.buy50p);
    features[12] = flag(action.buyPt10);
    features[13] = flag(action.buyFriend20);
    features[14] = flag(action.buyVital20);
    features[15] = flag(action.train >= 0 && action.train < 5);
    features[16] = flag(action.train == 6);
    features[17] = flag(action.train == 5);
    features[18] = flag(action.train == 7);
    features[19] = flag(action.train == 8);
    features[20] = flag(action.train == 9);
    if (action.train >= 0 && action.train < 5)
    {
      double weightedGain = 0.0;
      double totalGain = 0.0;
      double targetUsefulGain = 0.0;
      for (int status = 0; status < 5; ++status)
      {
        const double gain = game.trainValue[action.train][status];
        weightedGain += gain * (status == 2 ? 1.4 : status >= 3 ? 1.2 : 1.0);
        totalGain += gain;
        const int target = game.fiveStatusTarget[status] > 0
          ? std::min<int>(game.fiveStatusTarget[status], game.fiveStatusLimit[status])
          : game.fiveStatusLimit[status];
        targetUsefulGain += std::min<double>(gain, std::max(0, target - game.fiveStatus[status]));
      }
      features[21] = normalized(weightedGain, 300);
      features[22] = normalized(totalGain, 300);
      features[23] = normalized(game.trainValue[action.train][5], 200);
      features[24] = normalized(game.trainValue[action.train][6], 100);
      features[25] = normalized(game.failRate[action.train], 100);
      features[26] = normalized(game.trainShiningNum[action.train], 5);
      features[27] = normalized(personCountAtTraining(game, action.train), 5);
      features[28] = normalized(game.larc_shixingPtGainAbroad[action.train], 300);
      features[30] = normalized(targetUsefulGain, 300);
    }
    features[29] = normalized(purchaseCost(game, action), 1000);
    features[31] = normalized(actionIndex, kMaxActions - 1);
  }

  return result;
}

} // namespace umashow::graph
