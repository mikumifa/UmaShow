import {
  SUPPORT_CARD_EFFECT_LEVELS,
  type SupportCardMeta,
} from 'types/supportCard';
import { COMMAND_TARGET_TYPE_MAP, TARGET_TYPE } from 'types/gameTypes';

const BASE_MAX_LEVEL_BY_RARITY: Record<number, number> = {
  1: 20,
  2: 25,
  3: 30,
};

export interface SupportCardSpecialtySummary {
  level: number;
  maxLevel: number;
  baseRate: number;
  uniqueRate: number;
  liveBonusRate: number;
  totalRate: number;
  targetAppearanceRate: number;
  otherAppearanceRate: number;
  absentRate: number;
}

export const getSupportCardMaxLevel = (
  rarity: number | undefined,
  limitBreakCount: number,
) => {
  const baseMaxLevel = BASE_MAX_LEVEL_BY_RARITY[rarity ?? 0] ?? 0;
  if (baseMaxLevel === 0) {
    return 0;
  }
  return baseMaxLevel + Math.max(0, limitBreakCount) * 5;
};

export const getSupportCardLevel = ({
  exp,
  rarity,
  limitBreakCount,
  supportCardLevels,
}: {
  exp: number;
  rarity: number | undefined;
  limitBreakCount: number;
  supportCardLevels: Record<string, Record<string, number>>;
}) => {
  if (!rarity) {
    return 0;
  }
  const levels = supportCardLevels[String(rarity)] ?? {};
  const maxLevel = getSupportCardMaxLevel(rarity, limitBreakCount);
  let currentLevel = 1;

  Object.entries(levels).forEach(([levelText, totalExp]) => {
    const level = Number(levelText);
    if (level > maxLevel) {
      return;
    }
    if (exp >= totalExp && level > currentLevel) {
      currentLevel = level;
    }
  });

  return currentLevel;
};

export const getSupportCardEffectRate = (
  effectValues: Record<string, number> | undefined,
  level: number,
) => {
  if (!effectValues) {
    return 0;
  }

  let result = 0;
  SUPPORT_CARD_EFFECT_LEVELS.forEach((milestoneLevel) => {
    if (milestoneLevel > level) {
      return;
    }
    const value = effectValues[String(milestoneLevel)];
    if (typeof value === 'number' && value >= 0) {
      result = value;
    }
  });

  return result;
};

export const getSupportCardSpecialtySummary = ({
  supportCard,
  exp,
  limitBreakCount,
  supportCardLevels,
  liveSpecialtyRateBonus,
}: {
  supportCard: SupportCardMeta | undefined;
  exp: number;
  limitBreakCount: number;
  supportCardLevels: Record<string, Record<string, number>>;
  liveSpecialtyRateBonus?: number;
}): SupportCardSpecialtySummary => {
  const level = getSupportCardLevel({
    exp,
    rarity: supportCard?.rarity,
    limitBreakCount,
    supportCardLevels,
  });
  const maxLevel = getSupportCardMaxLevel(supportCard?.rarity, limitBreakCount);
  const baseRate = getSupportCardEffectRate(
    supportCard?.specialtyRateEffectValues,
    level,
  );
  const uniqueRate =
    supportCard?.specialtyRateUnique &&
    level >= supportCard.specialtyRateUnique.level
      ? supportCard.specialtyRateUnique.value
      : 0;
  const supportTargetType =
    COMMAND_TARGET_TYPE_MAP[supportCard?.commandId ?? 0];
  const canApplyLiveSpecialty =
    supportTargetType === TARGET_TYPE.SPEED ||
    supportTargetType === TARGET_TYPE.STAMINA ||
    supportTargetType === TARGET_TYPE.POWER ||
    supportTargetType === TARGET_TYPE.GUTS ||
    supportTargetType === TARGET_TYPE.WIZ;
  const liveBonusRate = canApplyLiveSpecialty
    ? Math.max(0, liveSpecialtyRateBonus ?? 0)
    : 0;

  const totalMultiplier =
    (1 + baseRate / 100) * (1 + uniqueRate / 100) * (1 + liveBonusRate / 100);
  const totalRate = totalMultiplier - 1;
  const denominator = 5.5 + totalRate;

  return {
    level,
    maxLevel,
    baseRate,
    uniqueRate,
    liveBonusRate,
    totalRate: Math.round(totalRate * 100),
    targetAppearanceRate: denominator > 0 ? (1 + totalRate) / denominator : 0,
    otherAppearanceRate: denominator > 0 ? 1 / denominator : 0,
    absentRate: denominator > 0 ? 0.5 / denominator : 0,
  };
};
