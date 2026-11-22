import type {
  CareerSetting,
  OfflineFactorSelection,
  OfflineFactorTarget,
} from './types';
import { isInheritedUniqueSkill } from './SkillSelector';
import {
  localAutoResearchSkillById,
  localAutoResearchSkillByName,
  localAutoResearchSkills,
} from './catalog';
import {
  buildOfflinePrioritySkillArray,
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
  normalizeOfflinePrioritySkillIds,
} from './shared';

const inheritedGroups = new Set(
  localAutoResearchSkills
    .filter(isInheritedUniqueSkill)
    .map((skill) => skill.group_id),
);

export function isInheritedSkillTarget(target?: OfflineFactorTarget) {
  return (
    target?.kind === 'skill' &&
    inheritedGroups.has(Number(target.factor_group_id))
  );
}

// Older settings can contain skills only in the two former editors.
export function offlineFactorsFromSetting(
  setting: Pick<
    CareerSetting,
    | 'factor_selection'
    | 'offline_factor_selection'
    | 'offline_priority_skill_ids'
    | 'offline_skill_settings'
  >,
): OfflineFactorSelection {
  const selection =
    setting.factor_selection ||
    setting.offline_factor_selection ||
    createDefaultOfflineFactorSelection();
  const storedTargets = Array.isArray(selection.targets)
    ? selection.targets
    : [];
  if (storedTargets.some((target) => target?.kind === 'skill')) {
    const targets = storedTargets.filter(
      (target) => !isInheritedSkillTarget(target),
    );
    return { ...selection, targets };
  }

  const legacyGroups = setting.offline_skill_settings?.learn_skill_list;
  const legacySkills = [
    ...normalizeOfflinePrioritySkillIds(setting.offline_priority_skill_ids).map(
      (id) => localAutoResearchSkillById.get(id),
    ),
    ...(Array.isArray(legacyGroups) ? legacyGroups : [])
      .flat()
      .map((name) => localAutoResearchSkillByName.get(name)),
  ];
  const groups = new Set(
    storedTargets.map((target) => target?.factor_group_id),
  );
  const migrated = legacySkills.flatMap((skill) => {
    if (!skill || isInheritedUniqueSkill(skill)) return [];
    const group = skill.group_id || Math.floor(skill.id / 10);
    if (groups.has(group)) return [];
    groups.add(group);
    return [
      {
        kind: 'skill' as const,
        factor_group_id: group,
        name: skill.name,
        weight: 1,
      },
    ];
  });
  return { ...selection, targets: [...storedTargets, ...migrated] };
}

export function offlineSkillRequest(selection: OfflineFactorSelection) {
  const targets = (selection.targets || []).filter(
    (target) =>
      target?.kind === 'skill' &&
      target.name &&
      !isInheritedSkillTarget(target),
  );
  if (selection.evaluation_mode === 'ancestor') {
    targets.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  }
  const names = [...new Set(targets.map((target) => target.name))];
  const ids = names.flatMap((name) => {
    const skill = localAutoResearchSkillByName.get(name);
    return skill ? [skill.id] : [];
  });
  return {
    priority_skill_array: buildOfflinePrioritySkillArray(ids),
    offline_skill_settings: {
      ...createDefaultOfflineSkillSettings(),
      learn_skill_list: names.map((name) => [name]),
      learn_skill_group_labels: names,
    },
  };
}
