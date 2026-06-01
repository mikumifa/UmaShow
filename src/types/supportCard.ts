import type { SupportCard as BaseSupportCard } from 'umdb/data_pb';

export const SUPPORT_CARD_SPECIALTY_RATE_TYPE = 19;

export const SUPPORT_CARD_EFFECT_LEVELS = [
  1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50,
] as const;

export interface SupportCardSpecialtyUnique {
  type: number;
  level: number;
  value: number;
  value1?: number;
  value2?: number;
  value3?: number;
  value4?: number;
}

export interface SupportCardMeta {
  rarity?: number;
  effectValues?: Record<string, Record<string, number>>;
  uniqueEffects?: Record<string, SupportCardSpecialtyUnique>;
  specialtyRateEffectValues?: Record<string, number>;
  specialtyRateUnique?: SupportCardSpecialtyUnique | null;
}

export type SupportCardWithMeta = BaseSupportCard & SupportCardMeta;

export interface SupportCardMetaFile {
  supportCardMeta: Record<string, SupportCardMeta>;
  supportCardEffectTypes?: Record<string, string>;
  supportCardLevels: Record<string, Record<string, number>>;
}
