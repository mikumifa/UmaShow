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

// Older targets have no explicit rank and each occupies its own tier.
function factorPriorityRanks(targets: OfflineFactorTarget[]) {
  let rank = 0;
  return targets.map((target, index) => {
    if (!index || !target.priority || target.priority !== targets[index - 1].priority) {
      rank++;
    }
    return rank;
  });
}

export type FactorPriorityGroup = { id: number; targets: OfflineFactorTarget[] };

export function readPriorityGroups(selection: OfflineFactorSelection): FactorPriorityGroup[] {
  const ids = selection.priority_group_ids;
  const targets = selection.targets;
  if (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(ids).size !== ids.length) {
    const groups: FactorPriorityGroup[] = [];
    factorPriorityRanks(targets).forEach((rank, index) => {
      if (rank > groups.length) groups.push({ id: rank, targets: [] });
      groups[rank - 1].targets.push(targets[index]);
    });
    return groups;
  }
  const groups = ids.map((id): FactorPriorityGroup => ({ id, targets: [] }));
  let nextId = Math.max(0, ...ids) + 1;
  for (const target of targets) {
    const group = target.priority && target.priority <= ids.length
      ? groups[target.priority - 1] : undefined;
    if (group) group.targets.push(target);
    else groups.push({ id: nextId++, targets: [target] });
  }
  return groups;
}

export function writePriorityGroups(groups: FactorPriorityGroup[]) {
  return {
    priority_group_ids: groups.map((group) => group.id),
    targets: groups.flatMap((group, index) =>
      group.targets.map((target) => ({ ...target, priority: index + 1 })),
    ),
  };
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
  if (Array.isArray(selection.priority_group_ids) || storedTargets.some((target) => target?.kind === 'skill')) {
    const targets = storedTargets.filter(
      (target) => !isInheritedSkillTarget(target),
    );
    return { ...selection, targets };
  }

  const legacyGroups = setting.offline_skill_settings?.learn_skill_list;
  const legacyTiers = [
    ...normalizeOfflinePrioritySkillIds(setting.offline_priority_skill_ids).map(
      (id) => [localAutoResearchSkillById.get(id)],
    ),
    ...(Array.isArray(legacyGroups) ? legacyGroups : []).map((group) =>
      (Array.isArray(group) ? group : [group]).map((name) => localAutoResearchSkillByName.get(name)),
    ),
  ];
  const groups = new Set(
    storedTargets.map((target) => target?.factor_group_id),
  );
  const lastRank = Math.max(0, ...storedTargets.map((target) => target.priority || 0));
  const migrated: OfflineFactorTarget[] = [];
  legacyTiers.forEach((tier, index) => {
    for (const skill of tier) {
      if (!skill || isInheritedUniqueSkill(skill)) continue;
      const group = skill.group_id || Math.floor(skill.id / 10);
      if (groups.has(group)) continue;
      groups.add(group);
      migrated.push({
        kind: 'skill', factor_group_id: group, name: skill.name,
        weight: 1, priority: lastRank + index + 1,
      });
    }
  });
  return { ...selection, targets: [...storedTargets, ...migrated] };
}

export function usesOfflineFactorTargets(selection: OfflineFactorSelection) {
  return selection.enabled !== false && selection.transfer_mode !== 'direct';
}

export function offlineSkillRequest(selection: OfflineFactorSelection) {
  const targets = usesOfflineFactorTargets(selection) ? [...(selection.targets || [])] : [];
  const weighted = selection.evaluation_mode === 'ancestor';
  if (weighted) {
    targets.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
  }
  const ranks = factorPriorityRanks(targets);
  const tiers = new Map<number, string[]>();
  const seen = new Set<string>();
  targets.forEach((target, index) => {
    if (target.kind !== 'skill' || !target.name || seen.has(target.name) || isInheritedSkillTarget(target)) {
      return;
    }
    seen.add(target.name);
    const rank = weighted ? index + 1 : ranks[index];
    if (!tiers.has(rank)) tiers.set(rank, []);
    tiers.get(rank)!.push(target.name);
  });
  const groups = [...tiers.values()];
  return {
    priority_skill_array: groups.flatMap((group, index) =>
      group.flatMap((name) => {
        const skill = localAutoResearchSkillByName.get(name);
        return skill ? [{ skill_id: skill.id, priority: index + 1 }] : [];
      }),
    ),
    offline_skill_settings: {
      ...createDefaultOfflineSkillSettings(),
      learn_skill_list: groups,
      learn_skill_group_labels: groups.map((group) => group.join(' / ')),
    },
  };
}
