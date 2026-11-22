import {
  offlineFactorsFromSetting,
  offlineSkillRequest,
} from './offlineCareerSkills';
import {
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
} from './shared';
import type { OfflineFactorSelection } from './types';

const selection: OfflineFactorSelection = {
  ...createDefaultOfflineFactorSelection(),
  targets: [
    { kind: 'skill', factor_group_id: 20001, name: '顺时针○', weight: 1 },
    { kind: 'aptitude', factor_group_id: 11, name: '草地', weight: 9 },
    { kind: 'skill', factor_group_id: 20002, name: '逆时针○', weight: 3 },
    { kind: 'skill', factor_group_id: 20003, name: '东京赛场○', weight: 3 },
  ],
};

test('omits inherited uniques from saved targets and legacy skills', () => {
  const inherited = {
    kind: 'skill' as const,
    factor_group_id: 90001,
    name: '璀璨流星',
    weight: 5,
  };
  const saved = offlineFactorsFromSetting({
    factor_selection: {
      ...selection,
      targets: [inherited, ...selection.targets],
    },
  });
  expect(saved.targets).toEqual(selection.targets);
  const legacy = offlineFactorsFromSetting({
    offline_priority_skill_ids: [900011, 200012],
    offline_skill_settings: {
      ...createDefaultOfflineSkillSettings(),
      learn_skill_list: [['璀璨流星']],
    },
  });
  expect(legacy.targets.map((target) => target.name)).toEqual(['顺时针○']);
});

test.each([
  [
    'parent' as const,
    [200012, 200022, 200032],
    ['顺时针○', '逆时针○', '东京赛场○'],
  ],
  [
    'ancestor' as const,
    [200022, 200032, 200012],
    ['逆时针○', '东京赛场○', '顺时针○'],
  ],
])(
  'uses the same %s priority for event hints and final purchases',
  (evaluation_mode, ids, names) => {
    const factors = offlineFactorsFromSetting({
      factor_selection: { ...selection, evaluation_mode },
      offline_priority_skill_ids: [200011],
    });
    const request = offlineSkillRequest(factors);
    expect(request.priority_skill_array).toEqual(
      ids.map((skill_id, i) => ({ skill_id, priority: i + 1 })),
    );
    expect(request.offline_skill_settings.learn_skill_list).toEqual(
      names.map((name) => [name]),
    );
    expect(request.offline_skill_settings.learn_skill_group_labels).toEqual(
      names,
    );
  },
);

test('imports legacy skills once and a subsequently cleared list stays empty', () => {
  const factors = offlineFactorsFromSetting({
    offline_factor_selection: { ...selection, targets: [selection.targets[1]] },
    offline_priority_skill_ids: [200012],
    offline_skill_settings: {
      ...createDefaultOfflineSkillSettings(),
      learn_skill_list: [['顺时针○', '逆时针○']],
    },
  });
  expect(factors.targets.map((target) => target.name)).toEqual([
    '草地',
    '顺时针○',
    '逆时针○',
  ]);
  const cleared = offlineFactorsFromSetting({
    factor_selection: { ...factors, targets: [selection.targets[1]] },
  });
  expect(offlineSkillRequest(cleared)).toEqual({
    priority_skill_array: [],
    offline_skill_settings: createDefaultOfflineSkillSettings(),
  });
});
