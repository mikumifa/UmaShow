import { isInterferenceSkill } from 'renderer/utils/skillConditionEvaluator';
import {
  getCharaSkillImpactSummary,
  getExternalSkillTargetFrameOrders,
} from './RaceDataUtils';
import { RaceSimulateEventData_SimulateEventType } from './race_data_pb';

describe('race skill targets', () => {
  test('extracts only targets other than the skill caster', () => {
    const event = {
      type: RaceSimulateEventData_SimulateEventType.SKILL,
      paramCount: 6,
      param: [4, 201082, 30000, 0, 205, 0],
    } as any;

    expect(getExternalSkillTargetFrameOrders(event, 9)).toEqual([
      0, 2, 3, 6, 7,
    ]);
  });

  test('aggregates activation and affected-horse counts per skill', () => {
    const raceData = {
      horseResult: Array.from({ length: 9 }, () => ({})),
      event: [
        {
          event: {
            type: RaceSimulateEventData_SimulateEventType.SKILL,
            paramCount: 6,
            param: [4, 201082, 30000, 0, 205, 0],
          },
        },
        {
          event: {
            type: RaceSimulateEventData_SimulateEventType.SKILL,
            paramCount: 6,
            param: [4, 201082, 30000, 0, 17, 0],
          },
        },
      ],
    } as any;

    expect(getCharaSkillImpactSummary(raceData, 4).get(201082)).toEqual({
      activationCount: 2,
      affectedHorseCount: 6,
    });
  });

  test('distinguishes interference skills from self buffs', () => {
    expect(isInterferenceSkill(201082)).toBe(true);
    expect(isInterferenceSkill(201072)).toBe(false);
  });
});
