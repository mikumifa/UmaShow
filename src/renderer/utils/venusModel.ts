/* eslint-disable no-use-before-define */
import {
  COMMAND_NAME_MAP,
  type CharInfo,
  type TrainingCommand,
  type VenusData,
} from 'types/gameTypes';

export type VenusOnnxModelInfo = {
  loaded: boolean;
  manifestPath?: string;
  modelDir?: string;
  featureSize?: number;
  featureNames?: string[];
  actionIds?: number[];
  targetStatus?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type VenusModelAdvice = {
  actionId: number;
  rank: number;
  probability: number;
  normalizedProbability: number;
  value: number;
  label: string;
};

export type VenusModelPrediction = {
  value: number;
  recommendations: VenusModelAdvice[];
  wisdomRecommendations: VenusModelAdvice[];
  adviceByActionId: Map<number, VenusModelAdvice>;
};

export type VenusFragmentChoiceColor = 'red' | 'blue' | 'yellow';

export type VenusFragmentChoiceRecommendation = {
  color: VenusFragmentChoiceColor;
  probability: number;
  score: number;
  predictedWisdomColor: VenusFragmentChoiceColor | null;
  completesWisdom: boolean;
};

const RACE_ACTION_ID = 301;
const REST_ACTION_ID = 701;
const OUTING_ACTION_ID = 801;
const OUTING_COMMAND_IDS = [301, 302, 304, 801];
const OUTING_MODEL_ACTION_IDS = [304, OUTING_ACTION_ID];
const OUTING_ACTION_IDS = [OUTING_ACTION_ID];
const DEBUT_RACE_TURN = 12;
const SPECIAL_RACE_TURNS_WITHOUT_FRAGMENTS = new Set([24, 48, 72, 78]);
const DOUBLE_FRAGMENT_PROB_RACE_REST_OUTING = 0.2;
const VENUS_SUPPORT_CARD_ID = 30137;
const VENUS_SUPPORT_CARD_EVENT_BASE_PROBABILITY = 0.3;
const VENUS_PASSION_EFFECT_ID = 102;
const SUPPORT_CARD_SLOT_COUNT = 6;
const TRAINING_ACTION_TO_LOCATION = new Map<number, number>([
  [101, 0],
  [105, 1],
  [102, 2],
  [103, 3],
  [106, 4],
  [601, 0],
  [602, 1],
  [603, 2],
  [604, 3],
  [605, 4],
]);
const ACTION_IDS = [
  101,
  105,
  102,
  103,
  106,
  601,
  602,
  603,
  604,
  605,
  RACE_ACTION_ID,
  3909040,
  3909041,
  3909042,
  REST_ACTION_ID,
  OUTING_ACTION_ID,
];
const ACTION_RESULT_FEATURE_FIELDS = [
  'speed',
  'stamina',
  'power',
  'guts',
  'wiz',
  'skill_point',
  'vital_gain',
  'vital_cost',
  'failure_rate',
];
const VENUS_TREE_SLOTS = Array.from({ length: 15 }, (_, index) => index + 1);
const VENUS_RED_GODDESS_ID = 9040;
const VENUS_BLUE_GODDESS_ID = 9041;
const VENUS_YELLOW_GODDESS_ID = 9042;
const WISDOM_ACTION_BY_COLOR: Record<VenusFragmentChoiceColor, number> = {
  red: 3909040,
  blue: 3909041,
  yellow: 3909042,
};
const WISDOM_ACTION_IDS = Object.values(WISDOM_ACTION_BY_COLOR);

const modelActionId = (actionId: number) =>
  OUTING_MODEL_ACTION_IDS.includes(actionId) ? OUTING_ACTION_ID : actionId;

const uniqueModelActionIds = (actionIds: number[]) =>
  Array.from(new Set(actionIds.map(modelActionId)));

const isOutingCommand = (
  command: Pick<TrainingCommand, 'commandId' | 'commandType'>,
) =>
  OUTING_COMMAND_IDS.includes(command.commandId) && command.commandType !== 4;

export const openVenusOnnxModel = () =>
  window.electron.venusModel.open() as Promise<VenusOnnxModelInfo>;

export const getVenusOnnxModelInfo = () =>
  window.electron.venusModel.info() as Promise<VenusOnnxModelInfo>;

export const clearVenusOnnxModel = () =>
  window.electron.venusModel.clear() as Promise<VenusOnnxModelInfo>;

export const predictVenusActions = async (
  modelInfo: VenusOnnxModelInfo,
  charInfo: CharInfo,
): Promise<VenusModelPrediction> => {
  if (!modelInfo.loaded || !modelInfo.actionIds?.length) {
    throw new Error('尚未加载 Venus ONNX 模型');
  }
  const features = buildVenusFeatures(charInfo);
  if (features.length !== modelInfo.featureSize) {
    throw new Error(
      `模型输入维度 ${modelInfo.featureSize} 与当前前端特征 ${features.length} 不一致，需要重新训练并导出 ONNX`,
    );
  }

  const result = (await window.electron.venusModel.predict(features)) as {
    value: number[];
    logits: number[];
  };
  const modelActionIds = uniqueModelActionIds(modelInfo.actionIds);
  const availableActionIds = availableActions(charInfo, modelActionIds);
  const availableMainActionIds = availableActionIds.filter(
    (actionId) => !WISDOM_ACTION_IDS.includes(actionId),
  );
  const availableWisdomActionIds = availableWisdomActions(
    charInfo,
    modelActionIds,
  );
  const logitByAction = new Map<number, number>();
  modelInfo.actionIds.forEach((actionId, index) => {
    const canonicalActionId = modelActionId(actionId);
    logitByAction.set(
      canonicalActionId,
      Math.max(
        logitByAction.get(canonicalActionId) ?? Number.NEGATIVE_INFINITY,
        result.logits[index] ?? Number.NEGATIVE_INFINITY,
      ),
    );
  });
  const mainProbabilities = softmax(
    availableMainActionIds.map(
      (actionId) => logitByAction.get(actionId) ?? Number.NEGATIVE_INFINITY,
    ),
  );
  const probabilityByAction = new Map<number, number>();
  availableMainActionIds.forEach((actionId, index) => {
    probabilityByAction.set(actionId, mainProbabilities[index] ?? 0);
  });
  availableWisdomActionIds.forEach((actionId) => {
    probabilityByAction.set(
      actionId,
      sigmoid(logitByAction.get(actionId) ?? 0),
    );
  });
  const value = result.value[0] ?? 0;
  const recommendations = availableMainActionIds
    .map((actionId) => ({
      actionId,
      rank: 0,
      probability: probabilityByAction.get(actionId) ?? 0,
      normalizedProbability: probabilityByAction.get(actionId) ?? 0,
      value,
      label: actionLabel(actionId),
    }))
    .sort(
      (left, right) =>
        right.normalizedProbability - left.normalizedProbability ||
        right.probability - left.probability,
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const wisdomRecommendations = availableWisdomActionIds
    .map((actionId) => ({
      actionId,
      rank: 0,
      probability: probabilityByAction.get(actionId) ?? 0,
      normalizedProbability: probabilityByAction.get(actionId) ?? 0,
      value,
      label: actionLabel(actionId),
    }))
    .sort(
      (left, right) =>
        right.normalizedProbability - left.normalizedProbability ||
        right.probability - left.probability,
    )
    .map((item, index) => ({ ...item, rank: index + 1 }));
  const adviceByActionId = new Map<number, VenusModelAdvice>(
    modelActionIds
      .map((actionId) => ({
        actionId,
        rank: 0,
        probability: probabilityByAction.get(actionId) ?? 0,
        normalizedProbability: probabilityByAction.get(actionId) ?? 0,
        value,
        label: actionLabel(actionId),
      }))
      .sort(
        (left, right) =>
          right.normalizedProbability - left.normalizedProbability ||
          right.probability - left.probability,
      )
      .map((item, index) => [item.actionId, { ...item, rank: index + 1 }]),
  );
  recommendations.forEach((item) => {
    adviceByActionId.set(item.actionId, item);
  });
  wisdomRecommendations.forEach((item) => {
    adviceByActionId.set(item.actionId, item);
  });

  return {
    value,
    recommendations,
    wisdomRecommendations,
    adviceByActionId,
  };
};

export const recommendVenusFragmentChoices = (
  charInfo: CharInfo,
  prediction?: VenusModelPrediction | null,
): VenusFragmentChoiceRecommendation[] => {
  const choices: VenusFragmentChoiceColor[] = ['red', 'blue', 'yellow'];
  const projected = choices.map((color) =>
    scoreFragmentChoice(color, charInfo, prediction),
  );
  const maxScore = Math.max(...projected.map((item) => item.score));
  const expScores = projected.map((item) => Math.exp(item.score - maxScore));
  const total = expScores.reduce((sum, value) => sum + value, 0);
  return projected
    .map((item, index) => ({
      ...item,
      probability: expScores[index] / Math.max(total, Number.EPSILON),
    }))
    .sort((left, right) => right.probability - left.probability);
};

export const actionIdForCommand = (
  command: TrainingCommand,
  actionIds: number[],
): number | null => {
  const modelActionIds = uniqueModelActionIds(actionIds);
  if (isOutingCommand(command) && modelActionIds.includes(OUTING_ACTION_ID)) {
    return OUTING_ACTION_ID;
  }
  if (modelActionIds.includes(command.commandId)) {
    return command.commandId;
  }
  if (command.commandType === 4 && modelActionIds.includes(RACE_ACTION_ID)) {
    return RACE_ACTION_ID;
  }
  if (command.commandType === 7 && modelActionIds.includes(REST_ACTION_ID)) {
    return REST_ACTION_ID;
  }
  if (command.commandType === 3) {
    return modelActionIds.includes(OUTING_ACTION_ID) ? OUTING_ACTION_ID : null;
  }
  return null;
};

const buildVenusFeatures = (charInfo: CharInfo): number[] => {
  const { stats } = charInfo;
  const turn = charInfo.gameStats.turn ?? 0;
  const counts = venusFeatureCounts(charInfo.venusData);
  const levels = venusGoddessLevels(charInfo.venusData);
  const passionActive = isVenusPassionActive(charInfo);
  const venusAvailable = isVenusOutingAvailable(charInfo);
  const venusOutingCount = venusOutingStoryStep(charInfo);
  const motivation =
    typeof charInfo.gameStats.motivation === 'number'
      ? charInfo.gameStats.motivation
      : 3;

  return [
    turn / 78,
    stats.speed.value / 1200,
    stats.stamina.value / 1200,
    stats.power.value / 1200,
    stats.guts.value / 1200,
    stats.wiz.value / 1200,
    stats.skillPoint / 2000,
    stats.vital.value / Math.max(1, stats.vital.max),
    stats.vital.max / 120,
    motivation / 5,
    levels.red / 5,
    levels.blue / 5,
    levels.yellow / 5,
    counts.fragmentCount / 15,
    counts.redFragmentCount / 15,
    counts.blueFragmentCount / 15,
    counts.yellowFragmentCount / 15,
    counts.hasRedWisdom,
    counts.hasBlueWisdom,
    counts.hasYellowWisdom,
    Math.max(0, 15 - counts.fragmentCount) / 15,
    isSummerCampTurn(turn) ? 1 : 0,
    turnsToNextExtraRace(turn) / 24,
    turn >= 60 ? 1 : 0,
    isDecemberSecondHalf(turn) ? 1 : 0,
    passionActive ? 1 : 0,
    passionActive ? 1 : 0,
    venusAvailable ? 1 : 0,
    venusOutingCount / 5,
    ...venusSlotFeatures(charInfo.venusData),
    ...supportCardFeatures(charInfo),
    ...actionFragmentFeatures(charInfo),
    ...actionVenusSupportEventFeatures(charInfo),
    ...actionResultFeatures(charInfo),
  ];
};

const venusSlotFeatures = (venusData?: VenusData): number[] => {
  const bySlot = new Map(
    (venusData?.spiritInfo ?? []).map((item) => [item.spiritNum, item]),
  );
  return VENUS_TREE_SLOTS.flatMap((slot) => {
    const node = bySlot.get(slot);
    if (!node) {
      return Array.from({ length: 15 }, () => 0);
    }
    const charaId = charaIdForSpirit(node.spiritId);
    const bonusGroup = bonusGroupForSpirit(node.spiritId, node.effectGroupId);
    const bonusValue = directBonusValue(node.effectGroupId);
    return [
      1,
      charaId === VENUS_RED_GODDESS_ID ? 1 : 0,
      charaId === VENUS_BLUE_GODDESS_ID ? 1 : 0,
      charaId === VENUS_YELLOW_GODDESS_ID ? 1 : 0,
      bonusGroup === 1 ? 1 : 0,
      bonusGroup === 2 ? 1 : 0,
      bonusGroup === 3 ? 1 : 0,
      bonusGroup === 4 ? 1 : 0,
      bonusGroup === 5 ? 1 : 0,
      bonusGroup === 6 ? 1 : 0,
      bonusValue === 1 ? 1 : 0,
      bonusValue === 2 ? 1 : 0,
      bonusValue >= 3 ? 1 : 0,
      isMixedEffectGroup(node.effectGroupId) ? 1 : 0,
      slot === 15 && [9040, 9041, 9042].includes(node.spiritId) ? 1 : 0,
    ];
  });
};

const supportCardFeatures = (charInfo: CharInfo): number[] => {
  const friendshipByPosition = new Map(
    charInfo.partnerStats.map((partner) => [
      partner.position,
      Math.min(Math.max(partner.evaluation ?? 0, 0), 100),
    ]),
  );
  const locationByPosition = new Map<number, number>();
  const hintByPosition = new Set<number>();
  charInfo.commands.forEach((command) => {
    const location = TRAINING_ACTION_TO_LOCATION.get(command.commandId);
    if (location == null) {
      return;
    }
    command.trainingPartners.forEach((position) => {
      if (position >= 1 && position <= SUPPORT_CARD_SLOT_COUNT) {
        locationByPosition.set(position, location);
      }
    });
    command.tipsPartners.forEach((position) => {
      if (position >= 1 && position <= SUPPORT_CARD_SLOT_COUNT) {
        hintByPosition.add(position);
      }
    });
  });
  return Array.from({ length: SUPPORT_CARD_SLOT_COUNT }, (_, index) => {
    const position = index + 1;
    const location = locationByPosition.get(position);
    return [
      (friendshipByPosition.get(position) ?? 0) / 100,
      location == null ? 1 : 0,
      ...Array.from({ length: 5 }, (_unused, training) =>
        location === training ? 1 : 0,
      ),
      hintByPosition.has(position) ? 1 : 0,
    ];
  }).flat();
};

const venusFeatureCounts = (venusData?: VenusData) => {
  const counts = {
    fragmentCount: venusData?.spiritInfo?.length ?? 0,
    redFragmentCount: 0,
    blueFragmentCount: 0,
    yellowFragmentCount: 0,
    hasRedWisdom: 0,
    hasBlueWisdom: 0,
    hasYellowWisdom: 0,
  };
  (venusData?.spiritInfo ?? []).forEach((item) => {
    const charaId = charaIdForSpirit(item.spiritId);
    if (charaId === VENUS_RED_GODDESS_ID) counts.redFragmentCount += 1;
    if (charaId === VENUS_BLUE_GODDESS_ID) counts.blueFragmentCount += 1;
    if (charaId === VENUS_YELLOW_GODDESS_ID) counts.yellowFragmentCount += 1;
    if (item.spiritNum === 15 && item.spiritId === VENUS_RED_GODDESS_ID) {
      counts.hasRedWisdom = 1;
    }
    if (item.spiritNum === 15 && item.spiritId === VENUS_BLUE_GODDESS_ID) {
      counts.hasBlueWisdom = 1;
    }
    if (item.spiritNum === 15 && item.spiritId === VENUS_YELLOW_GODDESS_ID) {
      counts.hasYellowWisdom = 1;
    }
  });
  return counts;
};

const venusGoddessLevels = (venusData?: VenusData) => {
  const level = (charaId: number) =>
    venusData?.charaInfo.find((item) => item.charaId === charaId)?.venusLevel ??
    0;
  return {
    red: level(VENUS_RED_GODDESS_ID),
    blue: level(VENUS_BLUE_GODDESS_ID),
    yellow: level(VENUS_YELLOW_GODDESS_ID),
  };
};

export const isVenusPassionActive = (charInfo: CharInfo) =>
  (charInfo.charaEffects ?? []).some(
    (effect) => effect.id === VENUS_PASSION_EFFECT_ID,
  );

export const isVenusOutingAvailable = (charInfo: CharInfo) =>
  (venusSupportEvaluationInfo(charInfo)?.isOuting ?? 0) !== 0;

const venusOutingStoryStep = (charInfo: CharInfo) => {
  const evaluation = venusSupportEvaluationInfo(charInfo);
  if (!evaluation) {
    return 0;
  }
  const groupStep = (evaluation.groupOutingInfo ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.storyStep ?? 0),
    0,
  );
  return Math.min(5, Math.max(0, (evaluation.storyStep ?? 0) + groupStep));
};

const venusSupportEvaluationInfo = (charInfo: CharInfo) => {
  const venusPartner = charInfo.partnerStats.find(
    (partner) => partner.supportCardId === VENUS_SUPPORT_CARD_ID,
  );
  if (!venusPartner) {
    return undefined;
  }
  return charInfo.venusData?.evaluationInfo.find(
    (item) =>
      item.targetId === venusPartner.position ||
      item.trainingPartnerId === venusPartner.position,
  );
};

const availableActions = (charInfo: CharInfo, actionIds: number[]) => {
  const set = new Set<number>();
  const turn = charInfo.gameStats.turn ?? 0;
  charInfo.commands
    .filter((command) => command.isEnable !== 0)
    .forEach((command) => {
      const actionId = actionIdForCommand(command, actionIds);
      if (actionId != null) {
        if (actionId === RACE_ACTION_ID && turn < DEBUT_RACE_TURN) {
          return;
        }
        set.add(actionId);
      }
    });
  const hasEnabledOutingCommand = charInfo.commands.some(
    (command) =>
      command.isEnable !== 0 &&
      (isOutingCommand(command) || command.commandType === 3),
  );

  if (
    isVenusOutingAvailable(charInfo) &&
    actionIds.includes(OUTING_ACTION_ID)
  ) {
    set.add(OUTING_ACTION_ID);
  }
  if (
    hasEnabledOutingCommand &&
    !set.has(OUTING_ACTION_ID) &&
    actionIds.includes(OUTING_ACTION_ID)
  ) {
    set.add(OUTING_ACTION_ID);
  }

  return [...set].filter((actionId) => actionIds.includes(actionId));
};

const availableWisdomActions = (charInfo: CharInfo, actionIds: number[]) => {
  const counts = venusFeatureCounts(charInfo.venusData);
  const actions: number[] = [];
  if (counts.hasRedWisdom && actionIds.includes(3909040)) actions.push(3909040);
  if (counts.hasBlueWisdom && actionIds.includes(3909041)) {
    actions.push(3909041);
  }
  if (counts.hasYellowWisdom && actionIds.includes(3909042)) {
    actions.push(3909042);
  }
  return actions;
};

const scoreFragmentChoice = (
  color: VenusFragmentChoiceColor,
  charInfo: CharInfo,
  prediction?: VenusModelPrediction | null,
): VenusFragmentChoiceRecommendation => {
  const leaves = projectedLeafColors(charInfo.venusData, color);
  const turn = charInfo.gameStats.turn ?? 0;
  const counts = countColors(leaves);
  const currentCounts = countColors(projectedLeafColors(charInfo.venusData));
  const completesWisdom = leaves.length >= 8;
  const predictedWisdomColor = completesWisdom
    ? wisdomColorFromLeaves(leaves)
    : null;
  const wisdomColor = predictedWisdomColor ?? color;
  let score = 1;

  // 红女神在额外比赛前价值极高。
  if (wisdomColor === 'red') {
    const turnsToRace = turnsToNextExtraRace(turn);
    if (turnsToRace <= 2) score += 4.5;
    else if (turnsToRace <= 6) score += 2.5;
    else if (isDecemberSecondHalf(turn)) score += 3;
  }

  // 黄女神优先服务夏合宿友情爆发。
  if (wisdomColor === 'yellow') {
    if (isSummerCampTurn(turn)) score += 3.5;
    else if ((turn >= 33 && turn <= 36) || (turn >= 57 && turn <= 60)) {
      score += 2.25;
    }
  }

  // 蓝女神越早越容易滚事件和启发。
  if (wisdomColor === 'blue') {
    if (turn <= 24) score += 2.1;
    else if (turn <= 48) score += 1.1;
  }

  if (completesWisdom && predictedWisdomColor === color) {
    score += 1.25;
  } else if (predictedWisdomColor && predictedWisdomColor !== color) {
    score -= 0.5;
  }

  // 不让树过度偏色；同分时更偏向当前数量少的颜色。
  score += Math.max(0, 3 - (currentCounts[color] ?? 0)) * 0.35;

  // 如果模型已经认为某个女神睿智动作很强，把同色碎片稍微抬高。
  const wisdomAdvice = prediction?.adviceByActionId.get(
    WISDOM_ACTION_BY_COLOR[color],
  );
  if (wisdomAdvice) {
    score += wisdomAdvice.normalizedProbability * 2;
  }

  // 当前选择如果直接改变最终睿智颜色，则按目标色再给一点确定性。
  if (predictedWisdomColor && counts[predictedWisdomColor] >= 4) {
    score += 0.6;
  }

  return {
    color,
    probability: 0,
    score,
    predictedWisdomColor,
    completesWisdom,
  };
};

const projectedLeafColors = (
  venusData?: VenusData,
  addedColor?: VenusFragmentChoiceColor,
) => {
  const bySlot = new Map(
    (venusData?.spiritInfo ?? [])
      .filter((item) => item.spiritNum >= 1 && item.spiritNum <= 8)
      .map((item) => [
        item.spiritNum,
        colorForCharaId(charaIdForSpirit(item.spiritId)),
      ]),
  );
  if (addedColor) {
    const emptySlot = Array.from({ length: 8 }, (_, index) => index + 1).find(
      (slot) => !bySlot.has(slot),
    );
    if (emptySlot != null) {
      bySlot.set(emptySlot, addedColor);
    }
  }
  return Array.from({ length: 8 }, (_, index) => bySlot.get(index + 1)).filter(
    (color): color is VenusFragmentChoiceColor => !!color,
  );
};

const countColors = (colors: VenusFragmentChoiceColor[]) =>
  colors.reduce(
    (counts, color) => ({
      ...counts,
      [color]: counts[color] + 1,
    }),
    { red: 0, blue: 0, yellow: 0 },
  );

const wisdomColorFromLeaves = (leaves: VenusFragmentChoiceColor[]) => {
  const normalizedLeaves = leaves.slice(0, 8);
  if (normalizedLeaves.length < 8) {
    return null;
  }
  const crystals = [
    mergeSpiritColor(normalizedLeaves[0], normalizedLeaves[1]),
    mergeSpiritColor(normalizedLeaves[2], normalizedLeaves[3]),
    mergeSpiritColor(normalizedLeaves[4], normalizedLeaves[5]),
    mergeSpiritColor(normalizedLeaves[6], normalizedLeaves[7]),
  ];
  const upperCrystals = [
    mergeSpiritColor(crystals[0], crystals[1]),
    mergeSpiritColor(crystals[2], crystals[3]),
  ];
  if (upperCrystals[0] === upperCrystals[1]) {
    return upperCrystals[0];
  }
  const counts = countColors(normalizedLeaves);
  const sorted = (
    Object.entries(counts) as Array<[VenusFragmentChoiceColor, number]>
  ).sort((left, right) => right[1] - left[1]);
  return sorted[0][1] >= 4 ? sorted[0][0] : upperCrystals[0];
};

const mergeSpiritColor = (
  left: VenusFragmentChoiceColor,
  right: VenusFragmentChoiceColor,
) => (left === right ? left : left);

const colorForCharaId = (charaId: number): VenusFragmentChoiceColor | null => {
  if (charaId === VENUS_RED_GODDESS_ID) return 'red';
  if (charaId === VENUS_BLUE_GODDESS_ID) return 'blue';
  if (charaId === VENUS_YELLOW_GODDESS_ID) return 'yellow';
  return null;
};

const actionFragmentFeatures = (charInfo: CharInfo) => {
  const counts = new Map<number, number>();
  const probabilities = new Map<number, number>();
  const freeSlots = Math.max(
    0,
    15 - (charInfo.venusData?.spiritInfo?.length ?? 0),
  );
  charInfo.commands.forEach((command) => {
    const actionId = actionIdForCommand(command, ACTION_IDS);
    if (actionId == null || actionId >= 3909040) {
      return;
    }
    const [count, probability] = commandFragmentCount(
      command,
      actionId,
      charInfo.gameStats.turn ?? 0,
      charInfo.venusData,
    );
    counts.set(actionId, count);
    probabilities.set(actionId, probability);
  });
  [3909040, 3909041, 3909042].forEach((actionId) => {
    counts.set(actionId, 0);
    probabilities.set(actionId, 0);
  });
  const countFeatures = ACTION_IDS.map(
    (actionId) =>
      Math.min(Math.max(counts.get(actionId) ?? 0, 0), 2, freeSlots) / 2,
  );
  const probabilityFeatures = ACTION_IDS.map((actionId) =>
    freeSlots >= 2
      ? Math.min(Math.max(probabilities.get(actionId) ?? 0, 0), 1)
      : 0,
  );
  return [...countFeatures, ...probabilityFeatures];
};

const commandFragmentCount = (
  command: TrainingCommand,
  actionId: number,
  turn: number,
  venusData?: VenusData,
) => {
  const binding = findCommandSpiritBinding(
    command,
    venusData?.charaCommandInfo,
  );
  if (!binding?.spiritId) {
    return fallbackExpectedCommandFragmentCount(actionId, turn);
  }
  return binding.isBoost === 1 ? [2, 1] : [1, 0];
};

const fallbackExpectedCommandFragmentCount = (
  actionId: number,
  turn: number,
) => {
  if (actionId === RACE_ACTION_ID) {
    if (turn < DEBUT_RACE_TURN) return [0, 0];
    if (turn === DEBUT_RACE_TURN) return [2, 1];
    if (SPECIAL_RACE_TURNS_WITHOUT_FRAGMENTS.has(turn)) return [0, 0];
    return [1, DOUBLE_FRAGMENT_PROB_RACE_REST_OUTING];
  }
  if (actionId === REST_ACTION_ID || OUTING_ACTION_IDS.includes(actionId)) {
    return [1, DOUBLE_FRAGMENT_PROB_RACE_REST_OUTING];
  }
  if (ACTION_IDS.includes(actionId) && actionId < RACE_ACTION_ID) {
    return [1, 0];
  }
  return [0, 0];
};

const actionVenusSupportEventFeatures = (charInfo: CharInfo) => {
  const probabilities = new Map<number, number>();
  const blueEventBonus = blueAfterTrainingEventBonusPercent(charInfo.venusData);
  charInfo.commands.forEach((command) => {
    const actionId = actionIdForCommand(command, ACTION_IDS);
    if (actionId == null) {
      return;
    }
    probabilities.set(
      actionId,
      venusSupportEventProbabilityForCommand(command, charInfo, blueEventBonus),
    );
  });
  return ACTION_IDS.map((actionId) =>
    Math.min(Math.max(probabilities.get(actionId) ?? 0, 0), 1),
  );
};

const actionResultFeatures = (charInfo: CharInfo) => {
  const valuesByAction = new Map<number, number[]>();
  charInfo.commands
    .filter((command) => command.isEnable !== 0)
    .forEach((command) => {
      const actionId = actionIdForCommand(command, ACTION_IDS);
      if (actionId == null) {
        return;
      }
      valuesByAction.set(actionId, commandResultFeatureTuple(command));
    });
  if (
    isVenusOutingAvailable(charInfo) &&
    !valuesByAction.has(OUTING_ACTION_ID)
  ) {
    valuesByAction.set(OUTING_ACTION_ID, fixedRecoveryResultFeatureTuple(40));
  }

  return ACTION_RESULT_FEATURE_FIELDS.flatMap((_field, fieldIndex) =>
    ACTION_IDS.map(
      (actionId) => valuesByAction.get(actionId)?.[fieldIndex] ?? 0,
    ),
  );
};

const commandResultFeatureTuple = (command: TrainingCommand) => {
  const values = Array.from(
    { length: ACTION_RESULT_FEATURE_FIELDS.length },
    () => 0,
  );
  command.params.forEach((param) => {
    const value = param.value ?? 0;
    if (param.targetType >= 1 && param.targetType <= 5) {
      values[param.targetType - 1] += Math.max(0, value) / 120;
    } else if (param.targetType === 30) {
      values[5] += Math.max(0, value) / 120;
    } else if (param.targetType === 10) {
      if (value >= 0) {
        values[6] += value / 100;
      } else {
        values[7] += -value / 100;
      }
    }
  });
  values[8] = Math.min(Math.max((command.failureRate ?? 0) / 100, 0), 1);
  return values.map((value) => Math.min(Math.max(value, 0), 2));
};

const fixedRecoveryResultFeatureTuple = (vitalRecovery: number) => {
  const values = Array.from(
    { length: ACTION_RESULT_FEATURE_FIELDS.length },
    () => 0,
  );
  values[6] = Math.max(0, vitalRecovery) / 100;
  return values;
};

const venusSupportEventProbabilityForCommand = (
  command: TrainingCommand,
  charInfo: CharInfo,
  blueEventBonusPercent: number,
) => {
  if (!ACTION_IDS.includes(command.commandId) || command.commandType !== 1) {
    return 0;
  }
  const hasVenusSupport = command.trainingPartners.some((position) =>
    charInfo.partnerStats.some(
      (partner) =>
        partner.position === position &&
        partner.supportCardId === VENUS_SUPPORT_CARD_ID,
    ),
  );
  if (!hasVenusSupport) {
    return 0;
  }
  return Math.min(
    1,
    VENUS_SUPPORT_CARD_EVENT_BASE_PROBABILITY *
      (1 + blueEventBonusPercent / 100),
  );
};

const blueAfterTrainingEventBonusPercent = (venusData?: VenusData) => {
  const level =
    venusData?.charaInfo.find((item) => item.charaId === VENUS_BLUE_GODDESS_ID)
      ?.venusLevel ?? 0;
  switch (level) {
    case 1:
      return 20;
    case 2:
      return 25;
    case 3:
      return 30;
    case 4:
      return 33;
    case 5:
      return 35;
    default:
      return 0;
  }
};

const findCommandSpiritBinding = (
  command: Pick<TrainingCommand, 'commandType' | 'commandId'>,
  charaCommandInfo?: VenusData['charaCommandInfo'],
) => {
  let typed: VenusData['charaCommandInfo'][number] | undefined;
  const exact = (charaCommandInfo ?? []).find((item) => {
    if (item.commandType !== command.commandType) {
      return false;
    }
    if (item.commandId === command.commandId) {
      return true;
    }
    if (item.commandId === 0 && !typed) {
      typed = item;
    }
    return false;
  });
  return exact ?? typed;
};

const softmax = (values: number[]) => {
  if (values.length === 0) {
    return [];
  }
  const max = Math.max(...values);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / Math.max(sum, Number.EPSILON));
};

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const actionLabel = (actionId: number) => {
  if (actionId === 3909040) return '红女神睿智';
  if (actionId === 3909041) return '蓝女神睿智';
  if (actionId === 3909042) return '黄女神睿智';
  if (actionId === RACE_ACTION_ID) return '比赛';
  if (actionId === REST_ACTION_ID) return '休息';
  if (OUTING_ACTION_IDS.includes(actionId)) return '外出';
  return COMMAND_NAME_MAP[actionId] ?? `动作 ${actionId}`;
};

const charaIdForSpirit = (spiritId: number) => {
  if ([9040, 9041, 9042].includes(spiritId)) {
    return spiritId;
  }
  if (spiritId >= 1 && spiritId <= 6) return VENUS_RED_GODDESS_ID;
  if (spiritId >= 9 && spiritId <= 14) return VENUS_BLUE_GODDESS_ID;
  if (spiritId >= 17 && spiritId <= 22) return VENUS_YELLOW_GODDESS_ID;
  return 0;
};

const bonusGroupForSpirit = (spiritId: number, effectGroupId: number) => {
  if (effectGroupId >= 11 && effectGroupId <= 65) {
    return Math.floor(effectGroupId / 10);
  }
  if (spiritId >= 1 && spiritId <= 6) return spiritId;
  if (spiritId >= 9 && spiritId <= 14) return spiritId - 8;
  if (spiritId >= 17 && spiritId <= 22) return spiritId - 16;
  return 0;
};

const directBonusValue = (effectGroupId: number) => {
  const tail = effectGroupId % 10;
  if (tail === 1) return 1;
  if (tail === 2 || tail === 3) return 2;
  if (tail === 4 || tail === 5) return 3;
  return 0;
};

const isMixedEffectGroup = (effectGroupId: number) => {
  const tail = effectGroupId % 10;
  return tail === 4 || tail === 5;
};

const isSummerCampTurn = (turn: number) =>
  (turn >= 37 && turn <= 40) || (turn >= 61 && turn <= 64);

const turnsToNextExtraRace = (turn: number) => {
  const next = [24, 48, 72, 78].find((raceTurn) => raceTurn >= turn);
  return next == null ? 0 : next - turn;
};

const isDecemberSecondHalf = (turn: number) =>
  turn === 24 || turn === 48 || turn === 72;
