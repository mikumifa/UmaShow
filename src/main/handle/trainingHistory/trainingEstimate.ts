import {
  COMMAND_TARGET_TYPE_MAP,
  TARGET_TYPE,
  TrainingHistoryTrainingContribution,
  TrainingHistoryTrainingEstimate,
  TrainingHistoryTrainingTargetEstimate,
} from 'types/gameTypes';
import { UMDB } from '../Data';
import {
  getSupportCardEffectRate,
  getSupportCardLevel,
} from 'utils/supportCardSpecialty';
import type { SupportCardSpecialtyUnique } from 'types/supportCard';
import { resolveVenusBaseTrainingValues } from './trainingBase';

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
    const mappedTarget = Object.entries(TRAINING_STAT_EFFECT_TYPE_BY_TARGET).find(
      ([, type]) => Number(type) === effectType,
    );
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

export function buildTrainingEstimate(
  commandResult: any,
  previousData: any,
): TrainingHistoryTrainingEstimate | undefined {
  const commandId = Number(commandResult?.command_id ?? 0);
  if (!TRAINING_COMMAND_IDS.has(commandId)) return undefined;

  const previewCommand = (previousData?.home_info?.command_info_array ?? []).find(
    (item: any) => Number(item?.command_id ?? 0) === commandId,
  );
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

  const { baseTrainingValues, notes: baseNotes } = resolveVenusBaseTrainingValues(
    previousData,
    commandId,
    Number(previewCommand.level ?? 0),
  );
  notes.push(...baseNotes);

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
      const tableBaseValue = baseTrainingValues?.[currentTargetType];
      const approxScenarioBase = Number.isFinite(tableBaseValue)
        ? Number(tableBaseValue)
        : Math.max(0, Math.round(rawBase));
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
