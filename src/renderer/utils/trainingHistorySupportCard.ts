import {
  getSupportCardEffectRate,
  getSupportCardLevel,
  getSupportCardMaxLevel,
  getSupportCardSpecialtySummary,
} from 'utils/supportCardSpecialty';
import {
  SUPPORT_CARD_SPECIALTY_RATE_TYPE,
  type SupportCardSpecialtyUnique,
} from 'types/supportCard';
import { UMDB } from './umdb';

const SUPPORT_CARD_EFFECT_NAME_MAP: Record<string, string> = {
  '1': '友情加成',
  '2': '干劲效果提升',
  '3': '速度加成',
  '4': '耐力加成',
  '5': '力量加成',
  '6': '毅力加成',
  '7': '智力加成',
  '8': '训练效果提升',
  '9': '初始速度提升',
  '10': '初始耐力提升',
  '11': '初始力量提升',
  '12': '初始毅力提升',
  '13': '初始智力提升',
  '14': '初始友情槽提升',
  '15': '比赛加成',
  '16': '粉丝数加成',
  '17': '启发等级提升',
  '18': '启发出现率提升',
  '19': '擅长率提升',
  '25': '事件回复量提升',
  '26': '事件效果提升',
  '27': '失败率降低',
  '28': '体力消耗降低',
  '30': '技能点数加成',
  '31': '智力友情回复量提升',
};

const SPECIAL_UNIQUE_SKILL_KIND_MAP: Record<number, string> = {
  1: '速度技能',
  2: '加速技能',
  3: '回复技能',
};

type SupportCardUniqueFormatter = (
  effect: SupportCardSpecialtyUnique,
) => string[];

const SUPPORT_CARD_SPECIAL_UNIQUE_FORMATTERS: Record<
  number,
  SupportCardUniqueFormatter
> = {
  101: (effect) => {
    const parts = [`羁绊达到 ${effect.value} 时生效`];
    if ((effect.value1 ?? 0) > 0 && (effect.value2 ?? 0) > 0) {
      parts.push(
        `${supportCardEffectLabel(String(effect.value1))} +${effect.value2}`,
      );
    }
    if ((effect.value3 ?? 0) > 0 && (effect.value4 ?? 0) > 0) {
      parts.push(
        `${supportCardEffectLabel(String(effect.value3))} +${effect.value4}`,
      );
    }
    return [parts.join(' / ')];
  },
  102: (effect) => [
    `羁绊 >= ${effect.value} 时，除根性外训练效果 +${effect.value1 ?? 0}`,
  ],
  103: (effect) => [
    `编成支援卡类型 >= ${effect.value} 时，训练效果 +${effect.value1 ?? 0}`,
  ],
  104: (effect) => [
    `粉丝每增加 ${effect.value}，训练效果 +1，最多 +${effect.value1 ?? 0}`,
  ],
  105: (effect) => [
    `编入速/耐/力/根/智卡时，对应初始属性 +${effect.value}`,
    `编入其他类型卡时，所有初始属性 +${effect.value1 ?? 0}`,
  ],
  106: (effect) => [
    `友情训练时，${supportCardEffectLabel(String(effect.value1 ?? 0))} +${effect.value2 ?? 0}，最多叠加 ${effect.value} 次`,
  ],
  107: (effect) => [
    `体力越低 ${supportCardEffectLabel(String(effect.value))} 越高`,
    `基础 +${effect.value4 ?? 0}，最大 +${effect.value3 ?? 0}，体力 <= ${effect.value2 ?? 0} 时达到最大`,
  ],
  108: (effect) => [
    `体力最大值越高，${supportCardEffectLabel(String(effect.value))} 越高`,
    '体力最大值每 +4，训练设施提高 3，最多提高 20',
  ],
  109: () => ['支援卡羁绊总和越高，训练效果越高，最高 +20'],
  110: (effect) => [
    `同时训练支援卡每多 1 张，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  111: (effect) => [
    `训练设施每升 1 级，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  112: (effect) => [`参与训练时，有 ${effect.value}% 概率令失败率变为 0%`],
  113: (effect) => [
    `友情训练时，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  114: () => ['训练时体力越高训练效果越高，100 体力时最大训练效果 +20'],
  115: () => ['所有支援卡初始羁绊 +5'],
  116: (effect) => [
    `每个${SPECIAL_UNIQUE_SKILL_KIND_MAP[effect.value] ?? `类型${effect.value}技能`}提供 ${supportCardEffectLabel(String(effect.value1 ?? 0))} +${effect.value2 ?? 0}`,
    `最多按 ${effect.value3 ?? 0} 个技能计算`,
  ],
  117: () => ['总训练设施等级越高训练效果越高，每级 +5，最高 +20'],
  118: (effect) => [
    `羁绊 >= ${effect.value1 ?? effect.value} 时，训练可同时出现位置数量 +2`,
  ],
};

export function supportCardName(id: number) {
  return UMDB.supportCards[id]?.name ?? `支援卡 ${id}`;
}

export function supportCardEffectLabel(type: string) {
  return (
    UMDB.supportCardEffectTypes[type] ??
    SUPPORT_CARD_EFFECT_NAME_MAP[type] ??
    `效果 ${type}`
  );
}

export function formatSupportCardUniqueEffect(
  effect: SupportCardSpecialtyUnique,
) {
  const formatter = SUPPORT_CARD_SPECIAL_UNIQUE_FORMATTERS[effect.type];
  if (formatter) {
    return formatter(effect);
  }
  return [`${supportCardEffectLabel(String(effect.type))} +${effect.value}`];
}

export function getSupportCardDetailData({
  supportCardId,
  limitBreak,
  exp,
}: {
  supportCardId: number;
  limitBreak: number;
  exp: number;
}) {
  const supportCard = UMDB.supportCards[supportCardId];
  const level = getSupportCardLevel({
    exp,
    rarity: supportCard?.rarity,
    limitBreakCount: limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
  const maxLevel = getSupportCardMaxLevel(supportCard?.rarity, limitBreak);
  const specialtySummary = getSupportCardSpecialtySummary({
    supportCard,
    exp,
    limitBreakCount: limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
  const effectEntries = Object.entries(supportCard?.effectValues ?? {})
    .map(([type, values]) => ({
      type,
      label: supportCardEffectLabel(type),
      value: getSupportCardEffectRate(values, level),
    }))
    .filter(
      (item) =>
        item.value > 0 &&
        Number(item.type) !== SUPPORT_CARD_SPECIALTY_RATE_TYPE,
    )
    .sort((left, right) => Number(left.type) - Number(right.type));
  const uniqueEntries = Object.values(supportCard?.uniqueEffects ?? {})
    .filter(
      (item) =>
        level >= item.level &&
        item.value > 0 &&
        item.type !== SUPPORT_CARD_SPECIALTY_RATE_TYPE,
    )
    .sort((left, right) => left.type - right.type);
  const formattedUniqueEntries = uniqueEntries.flatMap((item) =>
    formatSupportCardUniqueEffect(item).map((text, index) => ({
      key: `${item.type}-${index}`,
      type: item.type,
      text,
    })),
  );

  return {
    supportCard,
    level,
    maxLevel,
    specialtySummary,
    effectEntries,
    formattedUniqueEntries,
  };
}
