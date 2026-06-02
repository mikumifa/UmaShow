import { TARGET_TYPE } from 'types/gameTypes';

export const VENUS_RED_WISDOM_CHARA_ID = 9040;

const VENUS_BASE_TRAINING_TABLE: Partial<
  Record<number, Record<number, Partial<Record<number, number>>>>
> = {
  101: {
    1: {
      [TARGET_TYPE.SPEED]: 10,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 3,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -19,
    },
    2: {
      [TARGET_TYPE.SPEED]: 11,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 3,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -20,
    },
    3: {
      [TARGET_TYPE.SPEED]: 12,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 3,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -21,
    },
    4: {
      [TARGET_TYPE.SPEED]: 13,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 4,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -23,
    },
    5: {
      [TARGET_TYPE.SPEED]: 14,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 5,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -25,
    },
    6: {
      [TARGET_TYPE.SPEED]: 15,
      [TARGET_TYPE.STAMINA]: 0,
      [TARGET_TYPE.POWER]: 6,
      [TARGET_TYPE.GUTS]: 0,
      [TARGET_TYPE.WIZ]: 0,
      [TARGET_TYPE.SKILL_PTS]: 5,
      [TARGET_TYPE.VITAL]: -25,
    },
  },
};

export function resolveVenusBaseTrainingValues(
  previousData: any,
  commandId: number,
  commandLevel: number,
) {
  const isVenusScenario = previousData?.venus_data_set != null;
  if (!isVenusScenario) {
    return {
      baseTrainingLevel: commandLevel,
      baseTrainingValues: undefined,
      notes: [] as string[],
      hasVenusRedWisdom: false,
    };
  }

  const venusActiveEffectIds = new Set<number>(
    (previousData?.venus_data_set?.venus_spirit_active_effect_info_array ?? [])
      .map((item: any) => Number(item?.chara_id ?? 0))
      .filter((value: number) => value > 0),
  );
  const hasVenusRedWisdom = venusActiveEffectIds.has(VENUS_RED_WISDOM_CHARA_ID);
  const baseTrainingLevel =
    commandId === 101 && hasVenusRedWisdom ? 6 : commandLevel;
  const baseTrainingValues =
    commandId === 101
      ? VENUS_BASE_TRAINING_TABLE[101]?.[baseTrainingLevel]
      : undefined;
  const notes: string[] = [];

  if (commandId === 101) {
    notes.push(
      hasVenusRedWisdom
        ? '基础训练值使用女神杯速度训练 红睿智 表'
        : `基础训练值使用女神杯速度训练 Lv${baseTrainingLevel} 表`,
    );
  } else {
    notes.push('当前仅内置了女神杯速度训练基础表，其他训练仍使用反推基础项');
  }

  return {
    baseTrainingLevel,
    baseTrainingValues,
    notes,
    hasVenusRedWisdom,
  };
}
