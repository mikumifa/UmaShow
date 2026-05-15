export const VENUS_EFFECT_GROUP_MAP: Record<number, string> = {
  11: '训练时的速度增加量+1',
  12: '训练时的速度增加量+2',
  13: '训练时的速度增加量+2',
  14: '训练时的速度增加量+3',
  15: '训练时的速度增加量+3',
  21: '训练时的耐力增加量+1',
  22: '训练时的耐力增加量+2',
  23: '训练时的耐力增加量+2',
  24: '训练时的耐力增加量+3',
  25: '训练时的耐力增加量+3',
  31: '训练时的力量增加量+1',
  32: '训练时的力量增加量+2',
  33: '训练时的力量增加量+2',
  34: '训练时的力量增加量+3',
  35: '训练时的力量增加量+3',
  41: '训练时的毅力增加量+1',
  42: '训练时的毅力增加量+2',
  43: '训练时的毅力增加量+2',
  44: '训练时的毅力增加量+3',
  45: '训练时的毅力增加量+3',
  51: '训练时的智力增加量+1',
  52: '训练时的智力增加量+2',
  53: '训练时的智力增加量+2',
  54: '训练时的智力增加量+3',
  55: '训练时的智力增加量+3',
  61: '训练时的技能点数增加量+1',
  62: '训练时的技能点数增加量+2',
  63: '训练时的技能点数增加量+2',
  64: '训练时的技能点数增加量+3',
  65: '训练时的技能点数增加量+3',
  71: '训练后事件出现率提升+10',
  72: '训练后事件出现率提升+15',
  73: '训练后事件出现率提升+20',
  74: '训练后事件出现率提升+20',
  75: '训练后事件出现率提升+25',
  401: '回复体力，干劲提升\n所有的训练效果\n将变为超越等级5的训练\n通过比赛可获得的属性提升',
  411: '友人或团体类型的协助卡\n训练后事件和启发事件的\n出现率及效果提升',
  421: '协助卡的优俊少女\n在所有的训练中\n都可触发友情训练',
  4001: '训练体力消耗降低+10%',
  4002: '训练体力消耗降低+15%',
  4003: '训练体力消耗降低+18%',
  4004: '训练体力消耗降低+20%',
  4005: '训练体力消耗降低+23%',
  4101: '启发出现率提升+20%',
  4102: '启发出现率提升+25%',
  4103: '启发出现率提升+30%',
  4104: '启发出现率提升+33%',
  4105: '启发出现率提升+35%',
  4201: '协助卡事件的参数增加量+10%',
  4202: '协助卡事件的参数增加量+15%',
  4203: '协助卡事件的参数增加量+20%',
  4204: '协助卡事件的参数增加量+23%',
  4205: '协助卡事件的参数增加量+25%',
};

export const getVenusEffectDescription = (effectGroupId?: number | null) => {
  if (effectGroupId == null) {
    return null;
  }
  return VENUS_EFFECT_GROUP_MAP[effectGroupId] ?? `effect_group_id=${effectGroupId}`;
};

export type VenusTrainingModifierSummary = {
  speedBonus: number;
  staminaBonus: number;
  powerBonus: number;
  gutsBonus: number;
  wizBonus: number;
  skillPointBonus: number;
  trainingVitalCostCutPercent: number;
  notes: string[];
};

const VENUS_TRAINING_BONUS_VALUE_MAP: Record<number, number> = {
  11: 1,
  12: 2,
  13: 2,
  14: 3,
  15: 3,
  21: 1,
  22: 2,
  23: 2,
  24: 3,
  25: 3,
  31: 1,
  32: 2,
  33: 2,
  34: 3,
  35: 3,
  41: 1,
  42: 2,
  43: 2,
  44: 3,
  45: 3,
  51: 1,
  52: 2,
  53: 2,
  54: 3,
  55: 3,
  61: 1,
  62: 2,
  63: 2,
  64: 3,
  65: 3,
};

const VENUS_TRAINING_BONUS_KEY_MAP: Partial<
  Record<keyof typeof VENUS_TRAINING_BONUS_VALUE_MAP, keyof Pick<VenusTrainingModifierSummary, 'speedBonus' | 'staminaBonus' | 'powerBonus' | 'gutsBonus' | 'wizBonus' | 'skillPointBonus'>>
> = {
  11: 'speedBonus',
  12: 'speedBonus',
  13: 'speedBonus',
  14: 'speedBonus',
  15: 'speedBonus',
  21: 'staminaBonus',
  22: 'staminaBonus',
  23: 'staminaBonus',
  24: 'staminaBonus',
  25: 'staminaBonus',
  31: 'powerBonus',
  32: 'powerBonus',
  33: 'powerBonus',
  34: 'powerBonus',
  35: 'powerBonus',
  41: 'gutsBonus',
  42: 'gutsBonus',
  43: 'gutsBonus',
  44: 'gutsBonus',
  45: 'gutsBonus',
  51: 'wizBonus',
  52: 'wizBonus',
  53: 'wizBonus',
  54: 'wizBonus',
  55: 'wizBonus',
  61: 'skillPointBonus',
  62: 'skillPointBonus',
  63: 'skillPointBonus',
  64: 'skillPointBonus',
  65: 'skillPointBonus',
};

export const getVenusTrainingModifierSummary = (
  effectGroupIds: Array<number | null | undefined>,
): VenusTrainingModifierSummary => {
  const summary: VenusTrainingModifierSummary = {
    speedBonus: 0,
    staminaBonus: 0,
    powerBonus: 0,
    gutsBonus: 0,
    wizBonus: 0,
    skillPointBonus: 0,
    trainingVitalCostCutPercent: 0,
    notes: [],
  };

  effectGroupIds.forEach((effectGroupId) => {
    const trainingBonusKey =
      effectGroupId != null
        ? VENUS_TRAINING_BONUS_KEY_MAP[
            effectGroupId as keyof typeof VENUS_TRAINING_BONUS_KEY_MAP
          ]
        : undefined;
    const trainingBonusValue =
      effectGroupId != null
        ? VENUS_TRAINING_BONUS_VALUE_MAP[effectGroupId] ?? 0
        : 0;

    if (trainingBonusKey && trainingBonusValue > 0) {
      summary[trainingBonusKey] += trainingBonusValue;
      return;
    }

    switch (effectGroupId) {
      case 4001:
        summary.trainingVitalCostCutPercent += 10;
        break;
      case 4002:
        summary.trainingVitalCostCutPercent += 15;
        break;
      case 4003:
        summary.trainingVitalCostCutPercent += 18;
        break;
      case 4004:
        summary.trainingVitalCostCutPercent += 20;
        break;
      case 4005:
        summary.trainingVitalCostCutPercent += 23;
        break;
      case 71:
      case 72:
      case 73:
      case 74:
      case 75:
      case 401:
      case 411:
      case 421:
      case 4101:
      case 4102:
      case 4103:
      case 4104:
      case 4105:
      case 4201:
      case 4202:
      case 4203:
      case 4204:
      case 4205: {
        const description = getVenusEffectDescription(effectGroupId);
        if (description) {
          summary.notes.push(description);
        }
        break;
      }
      default:
        break;
    }
  });

  return summary;
};
