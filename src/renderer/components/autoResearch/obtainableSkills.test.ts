import { obtainableSkillGroups } from './obtainableSkills';
import { localCatalog } from './catalog';

const empty = { supportIds: [], parents: [], scenarioId: 0 };

test('uses the selected outfit, its events and its unlocked awakening ranks', () => {
  const uma = { id: 100101, talent_level: 1 };
  const groups = obtainableSkillGroups({ ...empty, uma });
  expect(groups.has(20135)).toBe(true); // Starting skill
  expect(groups.has(20003)).toBe(true); // Event
  expect(groups.get(20003)?.white).toEqual([{ label: '马娘事件' }]);
  expect(groups.get(20135)).toEqual({ white: [{ label: '初始' }], gold: [] });
  expect(groups.has(20016)).toBe(false); // Awakening 2
  expect(obtainableSkillGroups({ ...empty, uma: { ...uma, talent_level: 2 } }).has(20016)).toBe(true);
  expect(obtainableSkillGroups({ ...empty, uma: { ...uma, talent_level: 3 } }).get(20135)).toEqual({
    white: [{ label: '初始' }, { label: '觉醒 Lv.3' }], gold: [{ label: '觉醒 Lv.3' }],
  });
  expect(obtainableSkillGroups(empty).size).toBe(0);
});

test('combines training hints, card events including the borrowed card, and scenario events', () => {
  const deck = obtainableSkillGroups({ ...empty, supportIds: [30001] });
  expect(deck.has(20154)).toBe(true); // Training
  expect(deck.has(20076)).toBe(true); // Event
  expect(deck.get(20051)?.white).toEqual([{ label: '训练 / 事件', supportId: 30001, supportName: '支援卡 30001' }]);
  expect(deck.get(20051)?.gold).toEqual([{ label: '事件', supportId: 30001, supportName: '支援卡 30001' }]);
  expect(deck.has(20119)).toBe(false);
  expect(deck.has(21028)).toBe(false);
  const combined = obtainableSkillGroups({ ...empty, scenarioId: 5, supportIds: [30001, 30027] });
  expect(combined.has(20119)).toBe(true);
  expect(combined.has(21028)).toBe(true);
  expect(combined.get(21028)?.white).toEqual([{ label: '剧本事件' }]);
  expect(localCatalog.skills[201191].description).toBe('在赛事中期领先一段距离时\n速度提升<长距离>');
});

test('looks up the skill rewards of factors on both sides and their ancestors', () => {
  const factor = (group: number, id = group * 100 + 1) => ({ id, factor_group_id: group, stars: 1 });
  const groups = obtainableSkillGroups({
    ...empty,
    parents: [
      { factors: [factor(10001)], ancestors: [{ factors: [factor(20001, 0)] }] },
      { factors: [factor(20002)], ancestors: [{ factors: [factor(20003), factor(11)] }] },
    ],
    factorMeta: {
      1000101: { skillGroupIds: [20020] }, // February Stakes factor
      2000101: { skillGroupIds: [20001] },
      2000201: { skillGroupIds: [20002] },
      2000301: { skillGroupIds: [20003] },
    },
  });
  expect(new Set(groups.keys())).toEqual(new Set([20020, 20001, 20002, 20003]));
  expect(groups.get(20020)).toEqual({ white: [{ label: '种马' }], gold: [] });
});
