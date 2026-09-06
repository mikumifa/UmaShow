import type { BrowserWindow } from 'electron';
import type { MonteCarloCapturedState } from 'types/monteCarlo';

type PacketObject = Record<string, unknown>;

type PendingChoice = {
  commandId: number;
  currentTurn: number;
  friendAtTrain: boolean;
};

type RunTracker = {
  runKey: string;
  scenarioId: number;
  lastTurn: number;
  lastTrainingLevels: number[];
  trainingLevelRemainders: number[];
  friendClicked: boolean;
  friendPersonId: number;
  personDistribution: number[][];
  pendingChoice: PendingChoice | null;
  lastProcessedAction: string;
  lastProcessedSsEvent: string;
  larcNonSssWins: number;
  larcSpecialBuffs: Map<number, number>;
};

const MECHA_DEFAULT_STATUS_LIMITS = [2300, 2200, 1800, 1400, 1400];
const LARC_DEFAULT_STATUS_LIMITS = [2000, 2000, 1800, 1800, 1400];
const MECHA_TRAIN_IDS = [901, 105, 902, 103, 906];
const LARC_TRAIN_IDS = [101, 105, 102, 103, 106];
const LARC_LESSON_MAPPING = [2, 5, 1, 4, 6, 3, 7, 8, 9, 10];
const LARC_ZUOYUE_CARD_IDS = new Set([30160, 10094]);
const FRIEND_CARD_IDS = new Set([30207, 10109, 30188, 10104]);

const TRAIN_INDEX = new Map<number, number>([
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
  [901, 0],
  [902, 2],
  [906, 4],
  [1101, 0],
  [1102, 1],
  [1103, 2],
  [1104, 3],
  [1105, 4],
  [2101, 0],
  [2201, 0],
  [2301, 0],
  [2102, 1],
  [2202, 1],
  [2302, 1],
  [2103, 2],
  [2203, 2],
  [2303, 2],
  [2104, 3],
  [2204, 3],
  [2304, 3],
  [2105, 4],
  [2205, 4],
  [2305, 4],
]);

let latestState: MonteCarloCapturedState | null = null;
let latestStateSignature = '';
let tracker: RunTracker | null = null;
let captureSequence = 0;

const asObject = (value: unknown): PacketObject | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as PacketObject)
    : null;

const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const booleanValue = (value: unknown) =>
  value === true || value === 1 || value === '1';

const reviseOver1200 = (value: unknown) => {
  const parsed = numberValue(value);
  return parsed > 1200 ? parsed * 2 - 1200 : parsed;
};

const normalizedSingleModeData = (decoded: unknown): PacketObject | null => {
  const root = asObject(decoded);
  const data = asObject(root?.data);
  if (!data) return null;

  const common =
    asObject(data.single_mode_load_common) ??
    asObject(data.single_mode_start_common);
  if (!common) return data;

  const normalized: PacketObject = { ...common };
  Object.entries(data).forEach(([key, value]) => {
    if (
      (key.endsWith('_data_set') || key.endsWith('_data_set_load')) &&
      normalized[key] == null
    ) {
      normalized[key] = value;
    }
  });
  return normalized;
};

const runKeyFromChara = (chara: PacketObject) => {
  const charaId = numberValue(chara.single_mode_chara_id);
  const startTime = chara.start_time == null ? '' : String(chara.start_time);
  return `${charaId}:${startTime}:${numberValue(chara.card_id)}`;
};

const readTrainingLevels = (chara: PacketObject, scenarioId: number) => {
  const levelByCommand = new Map<number, number>();
  asArray(chara.training_level_info_array).forEach((item) => {
    const info = asObject(item);
    if (!info) return;
    levelByCommand.set(
      numberValue(info.command_id),
      numberValue(info.level, 1),
    );
  });
  const trainIds = scenarioId === 6 ? LARC_TRAIN_IDS : MECHA_TRAIN_IDS;
  return trainIds.map((commandId) => levelByCommand.get(commandId) ?? 1);
};

const createTracker = (
  runKey: string,
  scenarioId: number,
  turn: number,
  trainingLevels: number[],
): RunTracker => ({
  runKey,
  scenarioId,
  lastTurn: turn,
  lastTrainingLevels: trainingLevels,
  trainingLevelRemainders: [0, 0, 0, 0, 0],
  friendClicked: false,
  friendPersonId: -1,
  personDistribution: Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => -1),
  ),
  pendingChoice: null,
  lastProcessedAction: '',
  lastProcessedSsEvent: '',
  larcNonSssWins: 0,
  larcSpecialBuffs: new Map<number, number>(),
});

const syncTracker = (data: PacketObject, chara: PacketObject): RunTracker => {
  const runKey = runKeyFromChara(chara);
  const scenarioId = numberValue(chara.scenario_id);
  const turn = numberValue(chara.turn, 1);
  const trainingLevels = readTrainingLevels(chara, scenarioId);

  if (
    !tracker ||
    tracker.runKey !== runKey ||
    tracker.scenarioId !== scenarioId ||
    turn < tracker.lastTurn
  ) {
    tracker = createTracker(runKey, scenarioId, turn, trainingLevels);
    return tracker;
  }

  if (turn > tracker.lastTurn + 1) {
    tracker.trainingLevelRemainders.fill(0);
  }

  const commandResult = asObject(data.command_result);
  if (commandResult && Object.keys(commandResult).length > 0) {
    const commandId = numberValue(
      commandResult.command_id,
      tracker.pendingChoice?.commandId ?? 0,
    );
    const actionTurn =
      tracker.pendingChoice?.currentTurn ?? Math.max(1, tracker.lastTurn);
    const actionKey = `${runKey}:${actionTurn}:${commandId}`;
    if (commandId > 0 && actionKey !== tracker.lastProcessedAction) {
      const trainIndex = TRAIN_INDEX.get(commandId);
      const succeeded = numberValue(commandResult.result_state) !== 1;
      const isSummerCamp =
        scenarioId === 6
          ? (actionTurn >= 37 && actionTurn <= 43) ||
            (actionTurn >= 61 && actionTurn <= 67)
          : (actionTurn >= 37 && actionTurn <= 40) ||
            (actionTurn >= 61 && actionTurn <= 64);

      if (trainIndex != null && succeeded && !isSummerCamp) {
        tracker.trainingLevelRemainders[trainIndex] += 1;
        if (tracker.trainingLevelRemainders[trainIndex] >= 4) {
          tracker.trainingLevelRemainders[trainIndex] = 0;
        }
      }
      if (
        trainIndex != null &&
        succeeded &&
        (tracker.pendingChoice?.friendAtTrain ||
          tracker.personDistribution[trainIndex]?.includes(
            tracker.friendPersonId,
          ))
      ) {
        tracker.friendClicked = true;
      }
      tracker.lastProcessedAction = actionKey;
    }
    tracker.pendingChoice = null;
  }

  trainingLevels.forEach((level, index) => {
    if (level >= 5 || level < tracker!.lastTrainingLevels[index]) {
      tracker!.trainingLevelRemainders[index] = 0;
    }
  });
  tracker.lastTurn = turn;
  tracker.lastTrainingLevels = trainingLevels;
  return tracker;
};

const captureCommandRequest = (decoded: unknown) => {
  if (!tracker) return;
  const root = asObject(decoded);
  const request = asObject(root?.data) ?? root;
  if (!request) return;
  const commandId = numberValue(request.command_id);
  const currentTurn = numberValue(request.current_turn);
  if (commandId <= 0 || currentTurn <= 0) return;
  const trainIndex = TRAIN_INDEX.get(commandId);
  tracker.pendingChoice = {
    commandId,
    currentTurn,
    friendAtTrain:
      trainIndex != null &&
      tracker.friendPersonId >= 0 &&
      tracker.personDistribution[trainIndex]?.includes(tracker.friendPersonId),
  };
};

const supportCards = (chara: PacketObject) => {
  const cardIds = [0, 0, 0, 0, 0, 0];
  asArray(chara.support_card_array).forEach((item) => {
    const card = asObject(item);
    if (!card) return;
    const position = numberValue(card.position) - 1;
    if (position < 0 || position >= cardIds.length) return;
    cardIds[position] =
      numberValue(card.support_card_id) * 10 +
      numberValue(card.limit_break_count);
  });
  return cardIds;
};

const evaluations = (chara: PacketObject) => {
  const result = new Map<number, PacketObject>();
  asArray(chara.evaluation_info_array).forEach((item) => {
    const evaluation = asObject(item);
    if (!evaluation) return;
    result.set(numberValue(evaluation.target_id), evaluation);
  });
  return result;
};

const buildPersons = (
  cardIds: number[],
  evaluationByTarget: Map<number, PacketObject>,
) =>
  cardIds.map((cardId, index) => ({
    personType: FRIEND_CARD_IDS.has(Math.floor(cardId / 10)) ? 1 : 2,
    charaId: 0,
    friendship: numberValue(evaluationByTarget.get(index + 1)?.evaluation),
    isHint: false,
    cardRecord: 0,
  }));

const personIdForUmaAi = (partnerId: number) => {
  if (partnerId === 102) return 6;
  if (partnerId === 103) return 7;
  if (partnerId >= 1000) return 8;
  return partnerId - 1;
};

const buildPersonDistribution = (
  home: PacketObject | null,
  persons: Array<{ isHint: boolean }>,
) => {
  const distribution = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => -1),
  );
  asArray(home?.command_info_array).forEach((item) => {
    const command = asObject(item);
    if (!command) return;
    const trainIndex = TRAIN_INDEX.get(numberValue(command.command_id));
    if (trainIndex == null) return;

    asArray(command.training_partner_array)
      .slice(0, 5)
      .forEach((partner, partnerIndex) => {
        const partnerId = numberValue(partner);
        distribution[trainIndex][partnerIndex] = personIdForUmaAi(partnerId);
      });
    asArray(command.tips_event_partner_array).forEach((partner) => {
      const personIndex = numberValue(partner) - 1;
      if (personIndex >= 0 && personIndex < persons.length) {
        persons[personIndex].isHint = true;
      }
    });
  });
  return distribution;
};

const resolveLockedTrainingId = (home: PacketObject | null) => {
  let hasLockedTraining = false;
  let enabledId = -1;
  asArray(home?.command_info_array).forEach((item) => {
    const command = asObject(item);
    if (!command || !TRAIN_INDEX.has(numberValue(command.command_id))) return;
    if (numberValue(command.is_enable) !== 1) {
      hasLockedTraining = true;
    } else {
      enabledId = numberValue(command.command_id) % 10;
    }
  });
  return hasLockedTraining ? enabledId : -1;
};

const resolveRacing = (home: PacketObject | null) => {
  const commands = asArray(home?.command_info_array)
    .map(asObject)
    .filter((command): command is PacketObject => command != null)
    .filter((command) => TRAIN_INDEX.has(numberValue(command.command_id)));
  if (commands.length < 5) return false;
  return commands.every((command) => numberValue(command.is_enable) === 0);
};

const resolveBlueFactors = (fiveStatusLimit: number[], turn: number) => {
  let factor = 16;
  if (turn >= 54) factor = 22;
  else if (turn >= 30) factor = 19;
  return fiveStatusLimit.map((limit, index) => {
    const divisor = MECHA_DEFAULT_STATUS_LIMITS[index] >= 1200 ? 2 : 1;
    const count = Math.round(
      (limit - MECHA_DEFAULT_STATUS_LIMITS[index]) / divisor / factor,
    );
    return Math.max(0, Math.min(6, count)) * 3;
  });
};

const resolveLArcBlueFactors = (fiveStatusLimit: number[], turn: number) => {
  let factor = 16;
  if (turn >= 54) factor = 22;
  else if (turn >= 30) factor = 19;
  return fiveStatusLimit.map((limit, index) => {
    const count = Math.round(
      (limit - LARC_DEFAULT_STATUS_LIMITS[index]) / 2 / factor,
    );
    return Math.max(0, Math.min(6, count)) * 3;
  });
};

const buildMechaUpgrade = (mecha: PacketObject) => {
  const result = Array.from({ length: 3 }, () => [0, 0, 0]);
  asArray(mecha.board_info_array).forEach((item, fallbackIndex) => {
    const board = asObject(item);
    if (!board) return;
    const boardIndex = numberValue(board.board_id, fallbackIndex + 1) - 1;
    if (boardIndex < 0 || boardIndex >= result.length) return;
    const chips = asArray(board.chip_info_array)
      .map(asObject)
      .filter((chip): chip is PacketObject => chip != null);
    const normalChips = chips.filter(
      (chip) => numberValue(chip.chip_id) < 2000,
    );
    (normalChips.length >= 3 ? normalChips : chips)
      .slice(0, 3)
      .forEach((chip, chipIndex) => {
        result[boardIndex][chipIndex] = numberValue(chip.point);
      });
  });
  return result;
};

const resolveMechaEnergy = (mecha: PacketObject) =>
  asArray(mecha.board_info_array).reduce<number>((total, item) => {
    const board = asObject(item);
    const specialChip = asArray(board?.chip_info_array)
      .map(asObject)
      .find((chip) => chip != null && numberValue(chip.chip_id) > 2000);
    return total + numberValue(specialChip?.point);
  }, numberValue(mecha.tuning_point));

const resolveMechaGear = (mecha: PacketObject) => {
  const gear = [false, false, false, false, false];
  asArray(mecha.command_info_array).forEach((item) => {
    const command = asObject(item);
    if (!command) return;
    const trainIndex = TRAIN_INDEX.get(numberValue(command.command_id));
    if (trainIndex != null) {
      gear[trainIndex] = booleanValue(command.is_recommend);
    }
  });
  return gear;
};

const resolveMechaWinHistory = (mecha: PacketObject) => {
  const history = [0, 0, 0, 0, 0];
  asArray(mecha.upgrade_race_result_array).forEach((item) => {
    const race = asObject(item);
    if (!race) return;
    const index = numberValue(race.schedule_id) - 1;
    if (index >= 0 && index < history.length) {
      history[index] = numberValue(race.result_type) - 1;
    }
  });
  return history;
};

const arcDataSetFrom = (data: PacketObject) =>
  asObject(data.arc_data_set) ?? asObject(data.arc_data_set_load);

const updateLArcHistory = (
  data: PacketObject,
  chara: PacketObject,
  currentTracker: RunTracker,
) => {
  if (numberValue(chara.scenario_id) !== 6) return;
  const arc = arcDataSetFrom(data);
  if (!arc) return;

  currentTracker.larcSpecialBuffs.set(1014, 9);
  currentTracker.larcSpecialBuffs.set(1007, 8);
  asArray(arc.arc_rival_array).forEach((item) => {
    const rival = asObject(item);
    if (!rival || asArray(rival.selection_peff_array).length === 0) return;
    const charaId = numberValue(rival.chara_id);
    if (charaId <= 0) return;
    asArray(rival.selection_peff_array).forEach((effectValue) => {
      const effect = asObject(effectValue);
      const effectId = numberValue(effect?.effect_group_id);
      if (effectId === 0 || effectId === 1 || effectId === 11) return;
      const previous = currentTracker.larcSpecialBuffs.get(charaId) ?? 0;
      if (previous === 0 || (previous === 7 && effectId === 9)) {
        currentTracker.larcSpecialBuffs.set(charaId, effectId);
      }
    });
  });

  const hasSsEvent = asArray(data.unchecked_event_array).some(
    (item) => numberValue(asObject(item)?.story_id) === 400006112,
  );
  if (!hasSsEvent) return;
  const eventKey = `${currentTracker.runKey}:${numberValue(
    chara.turn,
  )}:400006112`;
  if (eventKey === currentTracker.lastProcessedSsEvent) return;
  currentTracker.lastProcessedSsEvent = eventKey;

  const selection = asObject(arc.selection_info);
  const selectedCount = asArray(selection?.selection_rival_info_array).length;
  if (numberValue(selection?.is_special_match) === 1) {
    currentTracker.larcNonSssWins = 0;
  } else {
    currentTracker.larcNonSssWins += selectedCount;
  }
};

const emptyLArcPerson = () => ({
  personType: 0,
  charaId: 0,
  cardIdInGame: -1,
  friendship: 0,
  isHint: false,
  cardRecord: 0,
  larc_charge: 0,
  larc_statusType: -1,
  larc_specialBuff: 0,
  larc_level: 0,
  larc_buffLevel: 0,
  larc_nextThreeBuffs: [0, 0, 0],
});

const buildLArcTrainingValues = (
  chara: PacketObject,
  home: PacketObject | null,
  arc: PacketObject,
) => {
  const trainValue = Array.from({ length: 5 }, () =>
    Array.from({ length: 7 }, () => 0),
  );
  const failRate = [0, 0, 0, 0, 0];
  const rawStatus = [
    numberValue(chara.speed),
    numberValue(chara.stamina),
    numberValue(chara.power),
    numberValue(chara.guts),
    numberValue(chara.wiz),
  ];
  const currentVital = numberValue(chara.vital);
  const maxVital = numberValue(chara.max_vital);
  const homeCommands = asArray(home?.command_info_array)
    .map(asObject)
    .filter((command): command is PacketObject => command != null);
  const allCommands = [
    ...homeCommands,
    ...asArray(arc.command_info_array)
      .map(asObject)
      .filter((command): command is PacketObject => command != null),
  ];

  for (let trainIndex = 0; trainIndex < 5; trainIndex += 1) {
    const params = new Map<number, number>();
    [1, 2, 3, 4, 5, 30, 10].forEach((target) => params.set(target, 0));
    allCommands.forEach((command) => {
      if (TRAIN_INDEX.get(numberValue(command.command_id)) !== trainIndex)
        return;
      asArray(command.params_inc_dec_info_array).forEach((paramValue) => {
        const param = asObject(paramValue);
        const target = numberValue(param?.target_type);
        if (!params.has(target)) return;
        params.set(
          target,
          (params.get(target) ?? 0) + numberValue(param?.value),
        );
      });
    });

    const abroadCommandId = 1101 + trainIndex;
    const baseCommandId = LARC_TRAIN_IDS[trainIndex];
    const failureCommand =
      homeCommands.find(
        (command) => numberValue(command.command_id) === abroadCommandId,
      ) ??
      homeCommands.find(
        (command) => numberValue(command.command_id) === baseCommandId,
      ) ??
      homeCommands.find(
        (command) =>
          TRAIN_INDEX.get(numberValue(command.command_id)) === trainIndex,
      );
    failRate[trainIndex] = numberValue(failureCommand?.failure_rate);

    for (let statusIndex = 0; statusIndex < 5; statusIndex += 1) {
      const gain = params.get(statusIndex + 1) ?? 0;
      trainValue[trainIndex][statusIndex] =
        reviseOver1200(rawStatus[statusIndex] + gain) -
        reviseOver1200(rawStatus[statusIndex]);
    }
    trainValue[trainIndex][5] = params.get(30) ?? 0;
    trainValue[trainIndex][6] = Math.max(
      -currentVital,
      Math.min(maxVital - currentVital, params.get(10) ?? 0),
    );
  }
  return { trainValue, failRate };
};

const buildLArcState = (
  data: PacketObject,
  chara: PacketObject,
  currentTracker: RunTracker,
): Record<string, unknown> | null => {
  const turnNumber = numberValue(chara.turn, 1);
  const turn = turnNumber - 1;
  const arc = arcDataSetFrom(data) ?? {};
  if (turnNumber >= 3 && Object.keys(arc).length === 0) return null;

  const home = asObject(data.home_info);
  const cardIds = supportCards(chara);
  if (
    numberValue(chara.card_id) <= 0 ||
    cardIds.some((cardId) => cardId <= 0)
  ) {
    return null;
  }

  const persons = Array.from({ length: 18 }, emptyLArcPerson);
  const headIdConvert = new Map<number, number>();
  const targetByPerson = new Map<number, number>();
  let normalCardCount = 0;
  let zuoyueCardIndex = -1;
  cardIds.forEach((cardId, cardIndex) => {
    const targetId = cardIndex + 1;
    if (LARC_ZUOYUE_CARD_IDS.has(Math.floor(cardId / 10))) {
      zuoyueCardIndex = cardIndex;
      persons[17].cardIdInGame = cardIndex;
      headIdConvert.set(targetId, 17);
      targetByPerson.set(17, targetId);
      return;
    }
    persons[normalCardCount].cardIdInGame = cardIndex;
    headIdConvert.set(targetId, normalCardCount);
    targetByPerson.set(normalCardCount, targetId);
    normalCardCount += 1;
  });

  for (let index = 0; index < normalCardCount; index += 1)
    persons[index].personType = 2;
  for (let index = normalCardCount; index < 15; index += 1)
    persons[index].personType = 3;
  persons[15].personType = 4;
  persons[16].personType = 5;
  persons[17].personType = zuoyueCardIndex >= 0 ? 1 : 6;
  headIdConvert.set(102, 15);
  headIdConvert.set(103, 16);
  targetByPerson.set(15, 102);
  targetByPerson.set(16, 103);
  if (zuoyueCardIndex < 0) {
    headIdConvert.set(110, 17);
    targetByPerson.set(17, 110);
  }

  const arcEvaluations = asArray(arc.evaluation_info_array)
    .map(asObject)
    .filter((evaluation): evaluation is PacketObject => evaluation != null);
  if (turnNumber >= 3) {
    let nextNpc = normalCardCount;
    arcEvaluations.forEach((evaluation) => {
      const charaId = numberValue(evaluation.chara_id);
      const targetId = numberValue(evaluation.target_id);
      if (
        charaId <= 0 ||
        charaId !== targetId ||
        headIdConvert.has(targetId) ||
        nextNpc >= 15
      ) {
        return;
      }
      headIdConvert.set(targetId, nextNpc);
      targetByPerson.set(nextNpc, targetId);
      persons[nextNpc].charaId = charaId;
      nextNpc += 1;
    });
    if (nextNpc !== 15) return null;
  }

  const evaluationByTarget = evaluations(chara);
  evaluationByTarget.forEach((evaluation, targetId) => {
    const personId = headIdConvert.get(targetId);
    if (personId != null)
      persons[personId].friendship = numberValue(evaluation.evaluation);
  });

  const rivalByChara = new Map<number, PacketObject>();
  asArray(arc.arc_rival_array).forEach((item) => {
    const rival = asObject(item);
    if (rival) rivalByChara.set(numberValue(rival.chara_id), rival);
  });
  if (turnNumber >= 3) {
    for (let personId = 0; personId < 15; personId += 1) {
      const targetId = targetByPerson.get(personId);
      const arcEvaluation = arcEvaluations.find(
        (evaluation) => numberValue(evaluation.target_id) === targetId,
      );
      const charaId = numberValue(arcEvaluation?.chara_id);
      const rival = rivalByChara.get(charaId);
      if (!targetId || !arcEvaluation || !rival) return null;
      persons[personId].charaId = charaId;
      persons[personId].larc_charge = numberValue(rival.rival_boost);
      persons[personId].larc_statusType =
        TRAIN_INDEX.get(numberValue(rival.command_id)) ?? -1;
      persons[personId].larc_specialBuff =
        currentTracker.larcSpecialBuffs.get(charaId) || 11;
      persons[personId].larc_level = numberValue(rival.star_lv) + 1;
      const effects = asArray(rival.selection_peff_array)
        .map(asObject)
        .filter((effect): effect is PacketObject => effect != null);
      const effectNumbers = effects
        .map((effect) => numberValue(effect.effect_num))
        .filter((effectNumber) => effectNumber > 0);
      const buffLevel =
        effectNumbers.length > 0 ? Math.min(...effectNumbers) : 0;
      persons[personId].larc_buffLevel = buffLevel;
      persons[personId].larc_nextThreeBuffs = Array.from(
        { length: 3 },
        (_, offset) =>
          numberValue(
            effects.find(
              (effect) => numberValue(effect.effect_num) === buffLevel + offset,
            )?.effect_group_id,
            11,
          ) || 11,
      );
    }
  }

  const personDistribution = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => -1),
  );
  asArray(home?.command_info_array).forEach((item) => {
    const command = asObject(item);
    const trainIndex = TRAIN_INDEX.get(numberValue(command?.command_id));
    if (!command || trainIndex == null) return;
    asArray(command.training_partner_array)
      .slice(0, 5)
      .forEach((partner, partnerIndex) => {
        const personId = headIdConvert.get(numberValue(partner));
        if (personId != null)
          personDistribution[trainIndex][partnerIndex] = personId;
      });
    asArray(command.tips_event_partner_array).forEach((partner) => {
      const personId = headIdConvert.get(numberValue(partner));
      if (personId != null) persons[personId].isHint = true;
    });
  });
  currentTracker.friendPersonId = zuoyueCardIndex >= 0 ? 17 : -1;
  currentTracker.personDistribution = personDistribution;

  const selection = asObject(arc.selection_info);
  const selectedRivals = asArray(selection?.selection_rival_info_array)
    .map(asObject)
    .filter((rival): rival is PacketObject => rival != null);
  const larcSsPersons = [-1, -1, -1, -1, -1];
  selectedRivals.slice(0, 5).forEach((selected, index) => {
    const charaId = numberValue(selected.chara_id);
    const arcEvaluation = arcEvaluations.find(
      (evaluation) => numberValue(evaluation.chara_id) === charaId,
    );
    const personId = headIdConvert.get(
      numberValue(arcEvaluation?.target_id, -1),
    );
    if (personId != null) larcSsPersons[index] = personId;
  });

  const arcInfo = asObject(arc.arc_info);
  const potentialLevels = new Map<number, number>();
  asArray(arcInfo?.potential_array).forEach((item) => {
    const potential = asObject(item);
    if (potential)
      potentialLevels.set(
        numberValue(potential.potential_id),
        numberValue(potential.level),
      );
  });
  const fiveStatus = [
    reviseOver1200(chara.speed),
    reviseOver1200(chara.stamina),
    reviseOver1200(chara.power),
    reviseOver1200(chara.guts),
    reviseOver1200(chara.wiz),
  ];
  const fiveStatusLimit = [
    reviseOver1200(chara.max_speed),
    reviseOver1200(chara.max_stamina),
    reviseOver1200(chara.max_power),
    reviseOver1200(chara.max_guts),
    reviseOver1200(chara.max_wiz),
  ];
  const effectIds = new Set(
    asArray(chara.chara_effect_id_array).map((effect) => numberValue(effect)),
  );
  let failureRateBias = 0;
  if (effectIds.has(6)) failureRateBias = 2;
  if (effectIds.has(10)) failureRateBias = -2;
  const trainingLevels = readTrainingLevels(chara, 6);
  const { trainValue, failRate } = buildLArcTrainingValues(chara, home, arc);
  const arcRivals = Array.from(rivalByChara.values());
  const zuoyueEvaluation =
    zuoyueCardIndex < 0
      ? null
      : (evaluationByTarget.get(zuoyueCardIndex + 1) ?? null);

  return {
    scenarioId: 6,
    umaId: numberValue(chara.card_id) + numberValue(chara.rarity) * 1000000,
    umaStar: numberValue(chara.rarity),
    turn,
    gameStage: 1,
    vital: numberValue(chara.vital),
    maxVital: numberValue(chara.max_vital),
    isQieZhe: effectIds.has(7),
    isAiJiao: effectIds.has(8),
    failureRateBias,
    fiveStatus,
    fiveStatusLimit,
    skillPt: numberValue(chara.skill_point),
    skillScore: 0,
    motivation: numberValue(chara.motivation),
    isPositiveThinking: effectIds.has(25),
    trainLevelCount: trainingLevels.map((level, index) =>
      level >= 5
        ? 16
        : (level - 1) * 4 + currentTracker.trainingLevelRemainders[index],
    ),
    zhongMaBlueCount: resolveLArcBlueFactors(fiveStatusLimit, turn),
    zhongMaExtraBonus: [10, 10, 30, 0, 10, 70],
    normalCardCount,
    cardId: cardIds,
    persons,
    motivationDropCount: 0,
    larc_isAbroad:
      (turnNumber >= 37 && turnNumber <= 43) ||
      (turnNumber >= 61 && turnNumber <= 67),
    larc_supportPtAll: arcRivals.reduce(
      (total, rival) => total + numberValue(rival.approval_point),
      0,
    ),
    larc_shixingPt: numberValue(arcInfo?.global_exp),
    larc_levels: LARC_LESSON_MAPPING.map(
      (potentialId) => potentialLevels.get(potentialId) ?? 0,
    ),
    larc_isSSS: numberValue(selection?.is_special_match) === 1,
    larc_ssWin: arcRivals.reduce(
      (total, rival) => total + numberValue(rival.star_lv),
      0,
    ),
    larc_ssWinSinceLastSSS: currentTracker.larcNonSssWins,
    larc_zuoyueFirstClick: currentTracker.friendClicked,
    larc_zuoyueOutgoingUnlocked: numberValue(zuoyueEvaluation?.is_outing) === 1,
    larc_zuoyueOutgoingRefused: false,
    larc_zuoyueOutgoingUsed: numberValue(zuoyueEvaluation?.story_step),
    personDistribution,
    larc_ssPersonsCount: selectedRivals.length,
    larc_ssPersons: larcSsPersons,
    trainValue,
    failRate,
  };
};

export const buildMonteCarloState = (
  decoded: unknown,
): Record<string, unknown> | null => {
  const data = normalizedSingleModeData(decoded);
  const chara = asObject(data?.chara_info);
  if (!data || !chara) return null;

  const currentTracker = syncTracker(data, chara);
  updateLArcHistory(data, chara, currentTracker);
  if (
    asArray(data.unchecked_event_array).length > 0 ||
    data.race_start_info != null
  ) {
    return null;
  }

  const scenarioId = numberValue(chara.scenario_id);
  if (scenarioId === 6 || arcDataSetFrom(data)) {
    return buildLArcState(data, chara, currentTracker);
  }

  const mecha =
    asObject(data.mecha_data_set) ?? asObject(data.mecha_data_set_load);
  if (!mecha) return null;

  const playingState = numberValue(chara.playing_state);
  let gameStage = 0;
  if (playingState === 1) gameStage = 1;
  else if (playingState === 26) gameStage = 2;
  if (gameStage === 0) return null;

  const overdriveInfo = asObject(mecha.overdrive_info);
  const mechaOverdriveEnabled =
    numberValue(overdriveInfo?.over_drive_state) > 0;
  if (
    gameStage === 1 &&
    numberValue(overdriveInfo?.is_overdrive_burst) > 0 &&
    !mechaOverdriveEnabled
  ) {
    return null;
  }

  const home = asObject(data.home_info);
  const turn = numberValue(chara.turn, 1) - 1;
  const cardIds = supportCards(chara);
  if (
    numberValue(chara.card_id) <= 0 ||
    cardIds.some((cardId) => cardId <= 0)
  ) {
    return null;
  }
  const evaluationByTarget = evaluations(chara);
  const persons = buildPersons(cardIds, evaluationByTarget);
  const personDistribution = buildPersonDistribution(home, persons);
  const friendPersonId = cardIds.findIndex((cardId) =>
    FRIEND_CARD_IDS.has(Math.floor(cardId / 10)),
  );
  const friendEvaluation = evaluationByTarget.get(friendPersonId + 1);
  let friendStage = 0;
  if (friendPersonId >= 0) {
    if (numberValue(friendEvaluation?.is_outing) === 1) friendStage = 2;
    else if (currentTracker.friendClicked) friendStage = 1;
  }

  currentTracker.friendPersonId = friendPersonId;
  currentTracker.personDistribution = personDistribution;

  const effectIds = new Set(
    asArray(chara.chara_effect_id_array).map((effect) => numberValue(effect)),
  );
  const fiveStatus = [
    reviseOver1200(chara.speed),
    reviseOver1200(chara.stamina),
    reviseOver1200(chara.power),
    reviseOver1200(chara.guts),
    reviseOver1200(chara.wiz),
  ];
  const fiveStatusLimit = [
    reviseOver1200(chara.max_speed),
    reviseOver1200(chara.max_stamina),
    reviseOver1200(chara.max_power),
    reviseOver1200(chara.max_guts),
    reviseOver1200(chara.max_wiz),
  ];
  const trainingLevels = readTrainingLevels(chara, scenarioId);
  const rivalInfo = asObject(mecha.rival_info);
  let failureRateBias = 0;
  if (effectIds.has(6)) failureRateBias = 2;
  else if (effectIds.has(10)) failureRateBias = -2;

  return {
    scenarioId: scenarioId || 9,
    umaId: numberValue(chara.card_id),
    umaStar: numberValue(chara.rarity),
    islegal: true,
    turn,
    gameStage,
    vital: numberValue(chara.vital),
    maxVital: numberValue(chara.max_vital),
    motivation: numberValue(chara.motivation),
    fiveStatus,
    fiveStatusLimit,
    skillPt: numberValue(chara.skill_point),
    skillScore: 0,
    trainLevelCount: trainingLevels.map((level, index) =>
      level >= 5
        ? 16
        : (level - 1) * 4 + currentTracker.trainingLevelRemainders[index],
    ),
    ptScoreRate: 2,
    failureRateBias,
    isQieZhe: effectIds.has(7),
    isAiJiao: effectIds.has(8),
    isPositiveThinking: effectIds.has(25),
    isRefreshMind: effectIds.has(32),
    zhongMaBlueCount: resolveBlueFactors(fiveStatusLimit, turn),
    zhongMaExtraBonus: [10, 10, 30, 0, 10, 70],
    saihou: 0,
    isRacing: resolveRacing(home),
    cardId: cardIds,
    persons,
    personDistribution,
    lockedTrainingId: resolveLockedTrainingId(home),
    friendship_noncard_yayoi: numberValue(
      evaluationByTarget.get(102)?.evaluation,
    ),
    friendship_noncard_reporter: numberValue(
      evaluationByTarget.get(103)?.evaluation,
    ),
    friend_stage: friendStage,
    friend_outgoingUsed:
      friendPersonId < 0 ? 0 : numberValue(friendEvaluation?.story_step),
    playing_state: playingState,
    mecha_rivalLv: [
      numberValue(rivalInfo?.speed),
      numberValue(rivalInfo?.stamina),
      numberValue(rivalInfo?.power),
      numberValue(rivalInfo?.guts),
      numberValue(rivalInfo?.wiz),
    ],
    mecha_overdrive_energy:
      numberValue(overdriveInfo?.remain_num) * 3 +
      numberValue(overdriveInfo?.energy_num),
    mecha_overdrive_enabled: mechaOverdriveEnabled,
    mecha_EN: resolveMechaEnergy(mecha),
    mecha_upgrade: buildMechaUpgrade(mecha),
    mecha_hasGear: resolveMechaGear(mecha),
    mecha_win_history: resolveMechaWinHistory(mecha),
  };
};

export const captureMonteCarloState = (
  decoded: unknown,
  mainWindow: BrowserWindow,
) => {
  const state = buildMonteCarloState(decoded);
  if (!state) return null;
  const signature = `${tracker?.runKey ?? ''}:${JSON.stringify(state)}`;
  if (signature === latestStateSignature) return null;
  latestStateSignature = signature;
  latestState = {
    sequence: (captureSequence += 1),
    capturedAt: Date.now(),
    scenarioId: numberValue(state.scenarioId),
    turn: numberValue(state.turn),
    gameStage: numberValue(state.gameStage),
    state,
  };
  if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('monte-carlo:state-captured', latestState);
  }
  return latestState;
};

export const captureMonteCarloPacket = (
  decoded: unknown,
  packetType: 'request' | 'response',
  mainWindow: BrowserWindow,
) => {
  if (packetType === 'request') {
    captureCommandRequest(decoded);
    return null;
  }
  return captureMonteCarloState(decoded, mainWindow);
};

export const getLatestMonteCarloState = () => latestState;
