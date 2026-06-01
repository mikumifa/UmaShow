import { BrowserWindow, IpcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  TrainingHistoryAnalysis,
  TrainingHistoryTrainingContribution,
  TrainingHistoryTrainingEstimate,
  TrainingHistoryTrainingTargetEstimate,
  TrainingHistoryConfig,
  TrainingHistorySkill,
  TrainingHistorySkillTip,
  TrainingHistoryPacket,
  TrainingHistoryRecord,
  TrainingHistorySummary,
  TrainingHistoryTurnDelta,
  TrainingHistoryTurnSnapshot,
  TrainingHistoryTurn,
} from 'types/gameTypes';
import { isUMASingleModelResponse } from 'types/ingame/UMASingleModelResponse';
import { jsonReplacer } from 'main/util';
import { TRAINING_HISTORY_DIR } from 'main/paths';
import { UMDB } from './Data';
import {
  getSupportCardEffectRate,
  getSupportCardLevel,
} from 'utils/supportCardSpecialty';
import type { SupportCardSpecialtyUnique } from 'types/supportCard';
import { COMMAND_TARGET_TYPE_MAP, TARGET_TYPE } from 'types/gameTypes';

const CONFIG_FILE = 'training_history.config.json';
const ANALYSIS_VERSION = 6;
const DEFAULT_MAX_CACHED_RUNS = 50;
const TRAINING_COMMAND_IDS = new Set([
  101, 102, 103, 105, 106, 601, 602, 603, 604, 605,
]);
const TRAINING_STAT_EFFECT_TYPE_BY_TARGET: Partial<Record<number, string>> = {
  [TARGET_TYPE.SPEED]: '3',
  [TARGET_TYPE.STAMINA]: '4',
  [TARGET_TYPE.POWER]: '5',
  [TARGET_TYPE.GUTS]: '6',
  [TARGET_TYPE.WIZ]: '7',
  [TARGET_TYPE.SKILL_PTS]: '30',
};
const TRAINING_TARGET_TYPES = new Set<number>([
  TARGET_TYPE.SPEED,
  TARGET_TYPE.STAMINA,
  TARGET_TYPE.POWER,
  TARGET_TYPE.GUTS,
  TARGET_TYPE.WIZ,
  TARGET_TYPE.SKILL_PTS,
]);
const MOTIVATION_BASE_RATE: Record<number, number> = {
  1: -0.2,
  2: -0.1,
  3: 0,
  4: 0.1,
  5: 0.2,
};

type TrainingEffectContext = {
  commandId: number;
  commandTargetType: number;
  commandLevel: number;
  partnerCount: number;
  supportPartnerCount: number;
  supportTypeCount: number;
  fans: number;
  totalEvaluation: number;
  evaluation: number;
  vital: number;
  maxVital: number;
  skillTipCountByKind: Record<number, number>;
  totalTrainingLevel: number;
  isFriendshipActive: boolean;
};

function ensureTrainingHistoryDir() {
  if (!fs.existsSync(TRAINING_HISTORY_DIR)) {
    fs.mkdirSync(TRAINING_HISTORY_DIR, { recursive: true });
  }
}

function configPath() {
  return path.join(TRAINING_HISTORY_DIR, CONFIG_FILE);
}

function sanitizeRecordId(id: string) {
  return id.replace(/[^\w-]+/g, '_');
}

function recordPath(id: string) {
  return path.join(
    TRAINING_HISTORY_DIR,
    `training_history_${sanitizeRecordId(id)}.json`,
  );
}

function readConfig(): TrainingHistoryConfig {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(configPath(), 'utf-8'),
    ) as Partial<TrainingHistoryConfig>;
    const maxCachedRuns = Number(parsed.maxCachedRuns);
    return {
      maxCachedRuns:
        Number.isFinite(maxCachedRuns) && maxCachedRuns > 0
          ? Math.floor(maxCachedRuns)
          : DEFAULT_MAX_CACHED_RUNS,
    };
  } catch (error) {
    log.error('[TrainingHistory] Failed to read config:', error);
    return { maxCachedRuns: DEFAULT_MAX_CACHED_RUNS };
  }
}

function writeConfig(config: TrainingHistoryConfig) {
  ensureTrainingHistoryDir();
  fs.writeFileSync(
    configPath(),
    JSON.stringify(config, jsonReplacer, 2),
    'utf-8',
  );
}

function recordFiles() {
  ensureTrainingHistoryDir();
  return fs
    .readdirSync(TRAINING_HISTORY_DIR)
    .filter(
      (file) => file.startsWith('training_history_') && file.endsWith('.json'),
    )
    .map((file) => path.join(TRAINING_HISTORY_DIR, file));
}

function readRecord(file: string): TrainingHistoryRecord | null {
  try {
    const record = JSON.parse(
      fs.readFileSync(file, 'utf-8'),
    ) as TrainingHistoryRecord;
    record.fullPath = file;
    if (
      record.analysis?.version !== ANALYSIS_VERSION &&
      Array.isArray(record.packets)
    ) {
      record.analysis = buildAnalysis(record);
      record.summary = record.analysis.summary;
      fs.writeFileSync(file, JSON.stringify(record, jsonReplacer, 2), 'utf-8');
    }
    return record;
  } catch (error) {
    log.error('[TrainingHistory] Failed to parse record:', file, error);
    return null;
  }
}

function recomputeRecord(record: TrainingHistoryRecord) {
  record.analysis = buildAnalysis(record);
  record.summary = {
    ...record.analysis.summary,
    updatedAt: record.updatedAt,
  };
  writeRecord(record);
  return record;
}

function toClientRecord(record: TrainingHistoryRecord): TrainingHistoryRecord {
  return {
    ...record,
    packets: [],
  };
}

function normalizeSingleModeData(data: Record<string, any>) {
  const common = data.single_mode_load_common;
  if (!common || typeof common !== 'object') {
    return data;
  }

  const normalized = { ...common } as Record<string, any>;
  Object.keys(data)
    .filter(
      (key) => key.endsWith('_data_set') || key.endsWith('_data_set_load'),
    )
    .forEach((key) => {
      if (normalized[key] == null) {
        normalized[key] = data[key];
      }
    });

  return normalized;
}

function getPacketData(packet: TrainingHistoryPacket) {
  const payload = packet.payload as any;
  if (!isUMASingleModelResponse(payload)) return null;
  return normalizeSingleModeData(payload.data as Record<string, any>);
}

function hasCommandResult(commandResult: any) {
  if (!commandResult || typeof commandResult !== 'object') return false;
  return Object.keys(commandResult).length > 0;
}

function hasUncheckedEvents(uncheckedEventArray: any) {
  return Array.isArray(uncheckedEventArray) && uncheckedEventArray.length > 0;
}

function hasExplicitTurnEntry(data: any) {
  return (
    hasCommandResult(data?.command_result) ||
    hasUncheckedEvents(data?.unchecked_event_array)
  );
}

function buildSnapshot(chara: any, data?: any): TrainingHistoryTurnSnapshot {
  const venusDataSet = data?.venus_data_set;
  return {
    speed: Number(chara?.speed ?? 0),
    stamina: Number(chara?.stamina ?? 0),
    power: Number(chara?.power ?? 0),
    guts: Number(chara?.guts ?? 0),
    wiz: Number(chara?.wiz ?? 0),
    skillPoint: Number(chara?.skill_point ?? 0),
    motivation: Number(chara?.motivation ?? 0),
    vital: Number(chara?.vital ?? 0),
    maxVital: Number(chara?.max_vital ?? 0),
    effectIds: Array.isArray(chara?.chara_effect_id_array)
      ? chara.chara_effect_id_array
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isFinite(id))
      : [],
    skills: Array.isArray(chara?.skill_array)
      ? chara.skill_array.map(
          (skill: any): TrainingHistorySkill => ({
            skillId: Number(skill?.skill_id ?? 0),
            level: Number(skill?.level ?? 0),
          }),
        )
      : [],
    skillTips: Array.isArray(chara?.skill_tips_array)
      ? chara.skill_tips_array.map(
          (tip: any): TrainingHistorySkillTip => ({
            groupId: Number(tip?.group_id ?? 0),
            rarity: Number(tip?.rarity ?? 0),
            level: Number(tip?.level ?? 0),
          }),
        )
      : [],
    venusSpirits: Array.isArray(venusDataSet?.spirit_info_array)
      ? venusDataSet.spirit_info_array.map((item: any) => ({
          spiritNum: Number(item?.spirit_num ?? 0),
          spiritId: Number(item?.spirit_id ?? 0),
          effectGroupId: Number(item?.effect_group_id ?? 0),
        }))
      : [],
    venusGoddessLevels: Array.isArray(venusDataSet?.venus_chara_info_array)
      ? venusDataSet.venus_chara_info_array.map((item: any) => ({
          charaId: Number(item?.chara_id ?? 0),
          venusLevel: Number(item?.venus_level ?? 0),
        }))
      : [],
  };
}

function buildDelta(
  from: TrainingHistoryTurnSnapshot | null,
  to: TrainingHistoryTurnSnapshot | null,
): TrainingHistoryTurnDelta | null {
  if (!from || !to) return null;

  const fromEffects = new Set(from.effectIds ?? []);
  const toEffects = new Set(to.effectIds ?? []);
  const fromVenusSpiritList = from.venusSpirits ?? [];
  const toVenusSpiritList = to.venusSpirits ?? [];
  const fromVenusGoddessLevels = from.venusGoddessLevels ?? [];
  const toVenusGoddessLevels = to.venusGoddessLevels ?? [];
  const fromVenusSpirits = new Map(
    fromVenusSpiritList.map((item) => [item.spiritNum, item]),
  );
  const toVenusSpirits = new Map(
    toVenusSpiritList.map((item) => [item.spiritNum, item]),
  );
  const allGoddessIds = new Set([
    ...fromVenusGoddessLevels.map((item) => item.charaId),
    ...toVenusGoddessLevels.map((item) => item.charaId),
  ]);
  const fromGoddessLevels = new Map(
    fromVenusGoddessLevels.map((item) => [item.charaId, item.venusLevel]),
  );
  const toGoddessLevels = new Map(
    toVenusGoddessLevels.map((item) => [item.charaId, item.venusLevel]),
  );

  return {
    speed: to.speed - from.speed,
    stamina: to.stamina - from.stamina,
    power: to.power - from.power,
    guts: to.guts - from.guts,
    wiz: to.wiz - from.wiz,
    skillPoint: to.skillPoint - from.skillPoint,
    motivation: to.motivation - from.motivation,
    vital: to.vital - from.vital,
    addedEffectIds: (to.effectIds ?? []).filter((id) => !fromEffects.has(id)),
    removedEffectIds: (from.effectIds ?? []).filter((id) => !toEffects.has(id)),
    addedVenusSpirits: toVenusSpiritList.filter(
      (item) => !fromVenusSpirits.has(item.spiritNum),
    ),
    removedVenusSpirits: fromVenusSpiritList.filter(
      (item) => !toVenusSpirits.has(item.spiritNum),
    ),
    venusLevelChanges: Array.from(allGoddessIds)
      .map((charaId) => ({
        charaId,
        beforeLevel: fromGoddessLevels.get(charaId) ?? 0,
        afterLevel: toGoddessLevels.get(charaId) ?? 0,
      }))
      .filter((item) => item.beforeLevel !== item.afterLevel),
  };
}

function hasMeaningfulDelta(delta: TrainingHistoryTurnDelta | null) {
  if (!delta) return false;
  return (
    delta.speed !== 0 ||
    delta.stamina !== 0 ||
    delta.power !== 0 ||
    delta.guts !== 0 ||
    delta.wiz !== 0 ||
    delta.skillPoint !== 0 ||
    delta.motivation !== 0 ||
    delta.vital !== 0 ||
    delta.addedEffectIds.length > 0 ||
    delta.removedEffectIds.length > 0 ||
    delta.addedVenusSpirits.length > 0 ||
    delta.removedVenusSpirits.length > 0 ||
    delta.venusLevelChanges.length > 0
  );
}

function getEffectValue(
  supportCardId: number,
  effectType: string,
  limitBreak: number,
  exp: number,
) {
  const supportCard = UMDB.supportCards[supportCardId];
  if (!supportCard) return 0;
  const level = getSupportCardLevel({
    exp,
    rarity: supportCard.rarity,
    limitBreakCount: limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
  return getSupportCardEffectRate(
    supportCard.effectValues?.[effectType],
    level,
  );
}

function getSupportCardLevelForHistoryCard(card: {
  supportCardId: number;
  limitBreak: number;
  exp: number;
}) {
  const supportCard = UMDB.supportCards[card.supportCardId];
  if (!supportCard) return 0;
  return getSupportCardLevel({
    exp: card.exp,
    rarity: supportCard.rarity,
    limitBreakCount: card.limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
}

function getSkillTipKind(groupId: number) {
  const skill = UMDB.skills[Number(`${groupId}1`)] ?? UMDB.skills[groupId];
  const tags = skill?.tagId ?? [];
  if (tags.includes('401')) return 1;
  if (tags.includes('402')) return 3;
  return 0;
}

function collectSpecialUniqueContributions(
  unique: SupportCardSpecialtyUnique,
  supportCardId: number,
  context: TrainingEffectContext,
) {
  const supportBonusSources: TrainingHistoryTrainingContribution[] = [];
  const trainingEffectSources: TrainingHistoryTrainingContribution[] = [];
  const motivationSources: TrainingHistoryTrainingContribution[] = [];
  const friendshipSources: TrainingHistoryTrainingContribution[] = [];
  const notes: string[] = [];

  const pushEffect = (
    effectType: number | undefined,
    value: number | undefined,
  ) => {
    if (!effectType || !value) return;
    const source = `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`;
    if (effectType === 1) {
      friendshipSources.push({ source, value, supportCardId });
      return;
    }
    if (effectType === 2) {
      motivationSources.push({ source, value, supportCardId });
      return;
    }
    if (effectType === 8) {
      trainingEffectSources.push({ source, value, supportCardId });
      return;
    }
    const mappedTarget = Object.entries(
      TRAINING_STAT_EFFECT_TYPE_BY_TARGET,
    ).find(([, type]) => Number(type) === effectType);
    if (mappedTarget) {
      supportBonusSources.push({ source, value, supportCardId });
    }
  };

  switch (unique.type) {
    case 101:
      if (context.evaluation >= unique.value) {
        pushEffect(unique.value1, unique.value2);
        pushEffect(unique.value3, unique.value4);
      }
      break;
    case 102:
      if (
        context.evaluation >= unique.value &&
        context.commandTargetType !== TARGET_TYPE.GUTS
      ) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: unique.value1 ?? 0,
          supportCardId,
        });
      }
      break;
    case 103:
      if (context.supportTypeCount >= unique.value) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: unique.value1 ?? 0,
          supportCardId,
        });
      }
      break;
    case 104: {
      const step = Math.max(1, unique.value);
      const maxTimes = Math.max(0, unique.value1 ?? 0);
      const gain = Math.min(maxTimes, Math.floor(context.fans / step));
      if (gain > 0) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: gain,
          supportCardId,
        });
      }
      break;
    }
    case 106:
      if (
        context.isFriendshipActive &&
        (unique.value1 ?? 0) > 0 &&
        (unique.value2 ?? 0) > 0
      ) {
        pushEffect(unique.value1, unique.value2);
      }
      break;
    case 107: {
      const effectType = unique.value;
      const threshold = Math.max(0, unique.value2 ?? 0);
      const maxValue = Math.max(unique.value4 ?? 0, unique.value3 ?? 0);
      const baseValue = Math.max(0, unique.value4 ?? 0);
      let value = baseValue;
      if (threshold > 0 && context.vital <= threshold) {
        value = maxValue;
      } else if (threshold > 0 && context.vital < 100) {
        value = Math.round(
          baseValue +
            (maxValue - baseValue) *
              Math.max(0, (100 - context.vital) / (100 - threshold)),
        );
      }
      pushEffect(effectType, value);
      break;
    }
    case 108:
      if (unique.value === 8) {
        const gain = Math.min(20, Math.floor(context.maxVital / 4) * 3);
        if (gain > 0) {
          trainingEffectSources.push({
            source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
            value: gain,
            supportCardId,
          });
        }
      } else {
        notes.push('固有 108 仅对训练效果进行了近似处理');
      }
      break;
    case 109: {
      const gain = Math.min(20, Math.floor(context.totalEvaluation / 100));
      if (gain > 0) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: gain,
          supportCardId,
        });
      }
      break;
    }
    case 110:
      if ((unique.value1 ?? 0) > 0) {
        pushEffect(unique.value, context.partnerCount * (unique.value1 ?? 0));
      }
      break;
    case 111:
      if ((unique.value1 ?? 0) > 0) {
        pushEffect(unique.value, context.commandLevel * (unique.value1 ?? 0));
      }
      break;
    case 113:
      if (context.isFriendshipActive && (unique.value1 ?? 0) > 0) {
        pushEffect(unique.value, unique.value1);
      }
      break;
    case 114: {
      const gain = Math.round(Math.max(0, Math.min(100, context.vital)) / 5);
      if (gain > 0) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: gain,
          supportCardId,
        });
      }
      break;
    }
    case 116: {
      const skillKind = unique.value;
      const skillCount = Math.min(
        unique.value3 ?? 0,
        context.skillTipCountByKind[skillKind] ?? 0,
      );
      if (skillCount > 0 && (unique.value2 ?? 0) > 0) {
        pushEffect(unique.value1, skillCount * (unique.value2 ?? 0));
      }
      break;
    }
    case 117: {
      const gain = Math.min(20, context.totalTrainingLevel * 5);
      if (gain > 0) {
        trainingEffectSources.push({
          source: `${UMDB.supportCards[supportCardId]?.name ?? supportCardId} 固有`,
          value: gain,
          supportCardId,
        });
      }
      break;
    }
    default:
      break;
  }

  return {
    supportBonusSources,
    trainingEffectSources,
    motivationSources,
    friendshipSources,
    notes,
  };
}

function buildTrainingEstimate(
  commandResult: any,
  previousData: any,
): TrainingHistoryTrainingEstimate | undefined {
  const commandId = Number(commandResult?.command_id ?? 0);
  if (!TRAINING_COMMAND_IDS.has(commandId)) return undefined;

  const previewCommand = (
    previousData?.home_info?.command_info_array ?? []
  ).find((item: any) => Number(item?.command_id ?? 0) === commandId);
  const chara = previousData?.chara_info;
  if (!previewCommand || !chara) return undefined;

  const targetType = COMMAND_TARGET_TYPE_MAP[commandId];
  if (!targetType) return undefined;

  const evaluationMap = new Map<number, number>(
    (chara.evaluation_info_array ?? []).map((item: any) => [
      Number(item?.training_partner_id ?? 0),
      Number(item?.evaluation ?? 0),
    ]),
  );
  const supportCardMap = new Map<number, any>(
    (chara.support_card_array ?? []).map((item: any) => [
      Number(item?.position ?? 0),
      item,
    ]),
  );
  const supportCards = (chara.support_card_array ?? []).map((card: any) => ({
    position: Number(card?.position ?? 0),
    supportCardId: Number(card?.support_card_id ?? 0),
    limitBreak: Number(card?.limit_break_count ?? 0),
    exp: Number(card?.exp ?? 0),
  }));
  const supportTypeCount = new Set(
    supportCards
      .map((card) => UMDB.supportCards[card.supportCardId]?.commandId)
      .filter((value): value is number => Number.isFinite(value) && value > 0),
  ).size;
  const totalEvaluation = Array.from(evaluationMap.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const skillTipCountByKind: Record<number, number> = {};
  (chara.skill_tips_array ?? []).forEach((tip: any) => {
    const kind = getSkillTipKind(Number(tip?.group_id ?? 0));
    if (kind > 0) {
      skillTipCountByKind[kind] = (skillTipCountByKind[kind] ?? 0) + 1;
    }
  });
  const totalTrainingLevel = (chara.training_level_info_array ?? []).reduce(
    (sum: number, item: any) => sum + Number(item?.level ?? 0),
    0,
  );
  const partners = Array.isArray(previewCommand.training_partner_array)
    ? previewCommand.training_partner_array
        .map((value: unknown) => Number(value))
        .filter((value: number) => value > 0)
    : [];
  const partnerSupportCards = partners
    .map((position) => {
      const supportCard = supportCardMap.get(position);
      if (!supportCard) return null;
      return {
        position,
        supportCardId: Number(supportCard.support_card_id ?? 0),
        limitBreak: Number(supportCard.limit_break_count ?? 0),
        exp: Number(supportCard.exp ?? 0),
        evaluation: evaluationMap.get(position) ?? 0,
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        !!item && item.supportCardId > 0,
    );

  const motivationBase =
    MOTIVATION_BASE_RATE[Number(chara.motivation ?? 0)] ?? 0;
  const partnerCount = partners.length;
  const supportPartnerCount = partnerSupportCards.length;
  const growthRates = UMDB.cardTalentRates[Number(chara.card_id ?? 0)] ?? {
    speed: 0,
    stamina: 0,
    power: 0,
    guts: 0,
    wiz: 0,
  };
  const growthPercentByTarget: Partial<Record<number, number>> = {
    [TARGET_TYPE.SPEED]: growthRates.speed ?? 0,
    [TARGET_TYPE.STAMINA]: growthRates.stamina ?? 0,
    [TARGET_TYPE.POWER]: growthRates.power ?? 0,
    [TARGET_TYPE.GUTS]: growthRates.guts ?? 0,
    [TARGET_TYPE.WIZ]: growthRates.wiz ?? 0,
  };
  const notes = ['当前仅按训练预览的普通数值做推算，未额外拆分 bonus 项'];
  if (!UMDB.cardTalentRates[Number(chara.card_id ?? 0)]) {
    notes.push('未找到赛马娘成长率，按 0% 处理');
  }

  const targets: TrainingHistoryTrainingTargetEstimate[] = (
    previewCommand.params_inc_dec_info_array ?? []
  )
    .map((param: any) => ({
      targetType: Number(param?.target_type ?? 0),
      observed: Number(param?.value ?? 0),
    }))
    .filter(
      (param: { targetType: number; observed: number }) =>
        TRAINING_TARGET_TYPES.has(param.targetType) && param.observed !== 0,
    )
    .map(({ targetType: currentTargetType, observed }) => {
      const supportBonusSources: TrainingHistoryTrainingContribution[] = [];
      const friendshipSources: TrainingHistoryTrainingContribution[] = [];
      const trainingEffectSources: TrainingHistoryTrainingContribution[] = [];
      const motivationSources: TrainingHistoryTrainingContribution[] = [];

      partnerSupportCards.forEach((partner) => {
        const supportCard = UMDB.supportCards[partner.supportCardId];
        if (!supportCard) return;
        const level = getSupportCardLevelForHistoryCard(partner);
        const cardName = supportCard.name ?? `支援卡 ${partner.supportCardId}`;
        const isFriendshipActive =
          partner.evaluation >= 80 &&
          COMMAND_TARGET_TYPE_MAP[supportCard.commandId ?? 0] === targetType;
        const context: TrainingEffectContext = {
          commandId,
          commandTargetType: targetType,
          commandLevel: Number(previewCommand.level ?? 0),
          partnerCount,
          supportPartnerCount,
          supportTypeCount,
          fans: Number(chara.fans ?? 0),
          totalEvaluation,
          evaluation: partner.evaluation,
          vital: Number(chara.vital ?? 0),
          maxVital: Number(chara.max_vital ?? 0),
          skillTipCountByKind,
          totalTrainingLevel,
          isFriendshipActive,
        };
        const statEffectType =
          TRAINING_STAT_EFFECT_TYPE_BY_TARGET[currentTargetType];
        if (statEffectType) {
          const statValue = getSupportCardEffectRate(
            supportCard.effectValues?.[statEffectType],
            level,
          );
          if (statValue > 0) {
            supportBonusSources.push({
              source: cardName,
              value: statValue,
              supportCardId: partner.supportCardId,
            });
          }
        }
        const trainingEffect = getSupportCardEffectRate(
          supportCard.effectValues?.['8'],
          level,
        );
        if (trainingEffect > 0) {
          trainingEffectSources.push({
            source: cardName,
            value: trainingEffect,
            supportCardId: partner.supportCardId,
          });
        }
        const motivationEffect = getSupportCardEffectRate(
          supportCard.effectValues?.['2'],
          level,
        );
        if (motivationEffect > 0) {
          motivationSources.push({
            source: cardName,
            value: motivationEffect,
            supportCardId: partner.supportCardId,
          });
        }
        if (isFriendshipActive) {
          const friendship = getSupportCardEffectRate(
            supportCard.effectValues?.['1'],
            level,
          );
          if (friendship > 0) {
            friendshipSources.push({
              source: cardName,
              value: friendship,
              supportCardId: partner.supportCardId,
            });
          }
        }

        Object.values(supportCard.uniqueEffects ?? {})
          .filter((unique) => level >= unique.level)
          .forEach((unique) => {
            const special = collectSpecialUniqueContributions(
              unique,
              partner.supportCardId,
              context,
            );
            supportBonusSources.push(...special.supportBonusSources);
            trainingEffectSources.push(...special.trainingEffectSources);
            motivationSources.push(...special.motivationSources);
            friendshipSources.push(...special.friendshipSources);
            special.notes.forEach((note) => {
              if (!notes.includes(note)) {
                notes.push(note);
              }
            });
          });
      });

      const supportBonus = supportBonusSources.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      const trainingEffectPercent = trainingEffectSources.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      const motivationSupportPercent = motivationSources.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      const friendshipMultiplier = friendshipSources.reduce(
        (product, item) => product * (1 + item.value / 100),
        1,
      );
      const trainingEffectMultiplier = 1 + trainingEffectPercent / 100;
      const motivationMultiplier =
        1 + motivationBase * (1 + motivationSupportPercent / 100);
      const growthPercent = growthPercentByTarget[currentTargetType] ?? 0;
      const growthMultiplier = 1 + growthPercent / 100;
      const partnerMultiplier = 1 + partnerCount * 0.05;
      const totalMultiplier =
        friendshipMultiplier *
        trainingEffectMultiplier *
        motivationMultiplier *
        growthMultiplier *
        partnerMultiplier;
      const rawBase =
        totalMultiplier > 0 ? observed / totalMultiplier - supportBonus : 0;
      const approxScenarioBase = Math.max(0, Math.round(rawBase));
      const estimated = Math.floor(
        Math.max(0, approxScenarioBase + supportBonus) * totalMultiplier,
      );

      return {
        targetType: currentTargetType,
        observed,
        estimated,
        approxScenarioBase,
        supportBonus,
        supportBonusSources,
        friendshipMultiplier,
        friendshipSources,
        trainingEffectPercent,
        trainingEffectSources,
        motivationMultiplier,
        motivationBase,
        motivationSupportPercent,
        motivationSources,
        growthMultiplier,
        growthPercent,
        partnerMultiplier,
        partnerCount,
      };
    });

  if (targets.length === 0) {
    return undefined;
  }

  return {
    commandId,
    commandLevel: Number(previewCommand.level ?? 0),
    partnerCount,
    supportPartnerCount,
    targetType,
    presentSupportCardIds: partnerSupportCards.map(
      (item) => item.supportCardId,
    ),
    targets,
    notes,
  };
}

function buildAnalysis(
  record: Pick<TrainingHistoryRecord, 'packets' | 'updatedAt'>,
): TrainingHistoryAnalysis {
  let viewerId = 0;
  let singleModeCharaId = 0;
  let cardId = 0;
  let startTime: string | number | Date | undefined;
  let supportCards: TrainingHistorySummary['supportCards'] = [];
  const packetSnapshots = new Map<number, TrainingHistoryTurnSnapshot>();
  const packetTurns = new Map<number, number>();
  const packetPayloads = new Map<number, any>();
  const turnsByNumber = new Map<number, TrainingHistoryTurn>();

  record.packets.forEach((packet, packetIndex) => {
    const payload = packet.payload as any;
    if (isUMASingleModelResponse(payload)) {
      viewerId = payload.data_headers.viewer_id ?? viewerId;
    }

    const data = getPacketData(packet);
    const chara = data?.chara_info;
    if (!chara) return;

    singleModeCharaId = chara.single_mode_chara_id ?? singleModeCharaId;
    cardId = chara.card_id ?? cardId;
    startTime = chara.start_time ?? startTime;
    const snapshot = buildSnapshot(chara, data);
    packetSnapshots.set(packetIndex, snapshot);
    packetTurns.set(packetIndex, Number(chara.turn ?? 0));
    packetPayloads.set(packetIndex, data);
    supportCards = (chara.support_card_array ?? []).map((card: any) => ({
      position: card.position ?? 0,
      supportCardId: card.support_card_id ?? 0,
      limitBreak: card.limit_break_count ?? 0,
      exp: card.exp ?? 0,
    }));
  });

  record.packets.forEach((packet, packetIndex) => {
    const data = packetPayloads.get(packetIndex);
    const snapshot = packetSnapshots.get(packetIndex);
    const turnNumber = packetTurns.get(packetIndex);
    if (!data || !snapshot || turnNumber == null) return;

    const turn = turnsByNumber.get(turnNumber) ?? {
      turn: turnNumber,
      snapshot,
      entries: [],
    };

    if (hasCommandResult(data.command_result)) {
      const previousData = packetPayloads.get(packetIndex - 1);
      turn.entries.push({
        type: 'command',
        packetIndex,
        receivedAt: packet.receivedAt,
        commandResult: data.command_result,
        trainingEstimate: buildTrainingEstimate(
          data.command_result,
          previousData,
        ),
        delta: buildDelta(
          packetSnapshots.get(packetIndex - 1) ?? null,
          snapshot,
        ),
      });
    }

    const rawEvents = data.unchecked_event_array ?? [];

    rawEvents.forEach((event: any) => {
      turn.entries.push({
        type: 'event',
        packetIndex,
        receivedAt: packet.receivedAt,
        event,
        storyId: event?.story_id,
        delta: buildDelta(
          snapshot,
          packetSnapshots.get(packetIndex + 1) ?? null,
        ),
      });
    });
    const previousData = packetPayloads.get(packetIndex - 1);

    if (!hasExplicitTurnEntry(data) && !hasExplicitTurnEntry(previousData)) {
      const delta = buildDelta(
        packetSnapshots.get(packetIndex - 1) ?? null,
        snapshot,
      );
      if (hasMeaningfulDelta(delta)) {
        turn.entries.push({
          type: 'delta',
          packetIndex,
          receivedAt: packet.receivedAt,
          title: '变动内容',
          delta,
        });
      }
    }

    if (turn.entries.length > 0) {
      turnsByNumber.set(turnNumber, turn);
    }
  });

  const turns = Array.from(turnsByNumber.values()).sort(
    (a, b) => a.turn - b.turn,
  );
  const summary: TrainingHistorySummary = {
    viewerId,
    singleModeCharaId,
    cardId,
    startTime,
    updatedAt: record.updatedAt,
    packetCount: record.packets.length,
    turnCount: turns.length,
    supportCards,
  };

  return {
    version: ANALYSIS_VERSION,
    summary,
    turns,
  };
}

function writeRecord(record: TrainingHistoryRecord) {
  fs.writeFileSync(
    record.fullPath,
    JSON.stringify(record, jsonReplacer, 2),
    'utf-8',
  );
}

function trimRecords() {
  const config = readConfig();
  const records = recordFiles()
    .map(readRecord)
    .filter((record): record is TrainingHistoryRecord => !!record)
    .filter((record) => !record.favorite)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  records.slice(config.maxCachedRuns).forEach((record) => {
    try {
      fs.unlinkSync(record.fullPath);
    } catch (error) {
      log.error(
        '[TrainingHistory] Failed to trim record:',
        record.fullPath,
        error,
      );
    }
  });
}

export function handleTrainingHistoryInfo(
  decodedData: unknown,
  win: BrowserWindow,
) {
  if (!isUMASingleModelResponse(decodedData)) return;

  const normalizedData = normalizeSingleModeData(
    decodedData.data as Record<string, any>,
  );
  const chara = normalizedData.chara_info;
  const viewerId = decodedData.data_headers.viewer_id;
  const singleModeCharaId = chara?.single_mode_chara_id;
  if (viewerId == null || singleModeCharaId == null) return;

  ensureTrainingHistoryDir();
  const id = `${viewerId}_${singleModeCharaId}`;
  const fullPath = recordPath(id);
  const filename = path.basename(fullPath);
  const now = Date.now();
  const packet: TrainingHistoryPacket = {
    sequence: 0,
    receivedAt: now,
    payload: decodedData,
  };

  const existing = fs.existsSync(fullPath) ? readRecord(fullPath) : null;
  const record: TrainingHistoryRecord = existing ?? {
    id,
    filename,
    fullPath,
    createdAt: now,
    updatedAt: now,
    favorite: false,
    summary: {
      viewerId,
      singleModeCharaId,
      cardId: chara.card_id ?? 0,
      startTime: chara.start_time,
      updatedAt: now,
      packetCount: 0,
      turnCount: 0,
      supportCards: [],
    },
    analysis: {
      version: ANALYSIS_VERSION,
      summary: {
        viewerId,
        singleModeCharaId,
        cardId: chara.card_id ?? 0,
        startTime: chara.start_time,
        updatedAt: now,
        packetCount: 0,
        turnCount: 0,
        supportCards: [],
      },
      turns: [],
    },
    packets: [],
  };

  packet.sequence = record.packets.length;
  record.updatedAt = now;
  record.packets.push(packet);
  record.analysis = buildAnalysis(record);
  record.summary = record.analysis.summary;
  record.summary.updatedAt = now;

  try {
    writeRecord(record);
    trimRecords();
    win.webContents.send('training-history:new', toClientRecord(record));
  } catch (error) {
    log.error('[TrainingHistory] Save failed:', error);
  }
}

export function handleTrainingHistoryList(ipcMain: IpcMain) {
  ipcMain.handle('training-history:list', async () => {
    const records = recordFiles()
      .map(readRecord)
      .filter((record): record is TrainingHistoryRecord => !!record)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toClientRecord);
    return records;
  });

  ipcMain.handle('training-history:config-get', async () => readConfig());

  ipcMain.handle(
    'training-history:config-set',
    async (_, incoming: Partial<TrainingHistoryConfig>) => {
      const maxCachedRuns = Math.max(
        1,
        Math.floor(Number(incoming?.maxCachedRuns) || DEFAULT_MAX_CACHED_RUNS),
      );
      const config = { maxCachedRuns };
      writeConfig(config);
      trimRecords();
      return config;
    },
  );

  ipcMain.handle(
    'training-history:favorite',
    async (_, id: string, favorite: boolean) => {
      const file = recordPath(id);
      const record = fs.existsSync(file) ? readRecord(file) : null;
      if (!record) return null;
      record.favorite = !!favorite;
      writeRecord(record);
      trimRecords();
      return toClientRecord(record);
    },
  );

  ipcMain.handle('training-history:delete', async (_, ids: string[]) => {
    ids.forEach((id) => {
      const file = recordPath(id);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    return true;
  });

  ipcMain.handle('training-history:recalculate', async (_, ids?: string[]) => {
    const targetFiles =
      Array.isArray(ids) && ids.length > 0
        ? ids.map((id) => recordPath(id)).filter((file) => fs.existsSync(file))
        : recordFiles();

    const updatedRecords = targetFiles
      .map(readRecord)
      .filter((record): record is TrainingHistoryRecord => !!record)
      .map(recomputeRecord)
      .map(toClientRecord);

    return updatedRecords;
  });
}

export function ensureTrainingHistory() {
  ensureTrainingHistoryDir();
  if (!fs.existsSync(configPath())) {
    writeConfig({ maxCachedRuns: DEFAULT_MAX_CACHED_RUNS });
  }
}
