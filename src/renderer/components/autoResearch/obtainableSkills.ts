import eventSkills from '../../../../assets/data/auto_research_event_skills.json';
import { localCatalog } from './catalog';
import type { Dashboard, FactorInfo } from './types';

type SkillSources = Record<number, number[]>;
const events: Record<keyof typeof eventSkills, SkillSources> = eventSkills;
type Factor = Pick<FactorInfo, 'id' | 'factor_group_id' | 'stars'>;
type Lineage = { factors?: Factor[]; ancestors?: { factors?: Factor[] }[] };

export type SkillSource = {
  label: string;
  supportId?: number;
  supportName?: string;
};
type TierSources = { white: SkillSource[]; gold: SkillSource[] };
export type SkillSourcesByGroup = ReadonlyMap<number, TierSources>;

function skillGroups(ids: number[] = []) {
  const groups = new Map<number, boolean>();
  for (const id of ids) {
    const skill = localCatalog.skills[id];
    if (skill?.group_id) groups.set(skill.group_id, skill.rarity === 2 || groups.get(skill.group_id) === true);
  }
  return groups;
}

export function obtainableSkillGroups({
  uma,
  parents,
  supportIds,
  supports = [],
  scenarioId,
  factorMeta,
}: {
  uma?: Pick<Dashboard['umas'][number], 'id' | 'talent_level'>;
  parents: (Lineage | undefined)[];
  supportIds: number[];
  supports?: Pick<Dashboard['supports'][number], 'id' | 'name'>[];
  scenarioId: number;
  factorMeta?: Record<number, { skillGroupIds: number[] }>;
}) {
  const groups = new Map<number, TierSources>();
  const add = (group: number, source: SkillSource, tier: keyof TierSources = 'white') => {
    if (!groups.has(group)) groups.set(group, { white: [], gold: [] });
    const existing = groups.get(group)![tier];
    if (!existing.some((item) => item.label === source.label && item.supportId === source.supportId)) {
      existing.push(source);
    }
  };
  const addHints = (ids: number[] | undefined, source: SkillSource) => {
    for (const [group, hasGold] of skillGroups(ids)) {
      add(group, source);
      if (hasGold) add(group, source, 'gold');
    }
  };
  if (uma) {
    localCatalog.available_skills_by_card[uma.id]?.forEach(({ need_rank, skill_id }) => {
      if (need_rank <= uma.talent_level) {
        addHints([skill_id], { label: need_rank ? `觉醒 Lv.${need_rank}` : '初始' });
      }
    });
    addHints(events.uma[uma.id], { label: '马娘事件' });
  }
  for (const parent of parents) {
    if (!parent) continue;
    for (const member of [parent, ...(parent.ancestors || [])]) {
      for (const factor of member.factors || []) {
        const id = factor.id || factor.factor_group_id * 100 + factor.stars;
        factorMeta?.[id]?.skillGroupIds.forEach((group) => add(group, { label: '种马' }));
      }
    }
  }
  for (const supportId of new Set(supportIds)) {
    const training = skillGroups(localCatalog.support_hint_skills[supportId]);
    const event = skillGroups(events.support[supportId]);
    const supportName = supports.find((card) => card.id === supportId)?.name || `支援卡 ${supportId}`;
    for (const group of new Set([...training.keys(), ...event.keys()])) {
      for (const tier of ['white', 'gold'] as const) {
        const methods = [];
        if (tier === 'gold' ? training.get(group) : training.has(group)) methods.push('训练');
        if (tier === 'gold' ? event.get(group) : event.has(group)) methods.push('事件');
        if (methods.length) add(group, { supportId, supportName, label: methods.join(' / ') }, tier);
      }
    }
  }
  addHints(events.scenario[scenarioId], { label: '剧本事件' });
  return groups;
}
