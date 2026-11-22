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
export type SkillSourcesByGroup = ReadonlyMap<number, readonly SkillSource[]>;

function skillGroups(ids: number[] = []) {
  const groups = new Set<number>();
  for (const id of ids) {
    const group = localCatalog.skills[id]?.group_id;
    if (group) groups.add(group);
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
  const groups = new Map<number, SkillSource[]>();
  const add = (group: number, source: SkillSource) => {
    const existing = groups.get(group);
    if (!existing) groups.set(group, [source]);
    else if (!existing.some((item) => item.label === source.label && item.supportId === source.supportId)) {
      existing.push(source);
    }
  };
  if (uma) {
    localCatalog.available_skills_by_card[uma.id]?.forEach(({ need_rank, skill_id }) => {
      const group = localCatalog.skills[skill_id]?.group_id;
      if (group && need_rank <= uma.talent_level) {
        add(group, { label: need_rank ? `觉醒 Lv.${need_rank}` : '初始' });
      }
    });
    for (const group of skillGroups(events.uma[uma.id])) add(group, { label: '马娘事件' });
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
    for (const group of new Set([...training, ...event])) {
      const methods = [];
      if (training.has(group)) methods.push('训练');
      if (event.has(group)) methods.push('事件');
      add(group, { supportId, supportName, label: methods.join(' / ') });
    }
  }
  for (const group of skillGroups(events.scenario[scenarioId])) add(group, { label: '剧本事件' });
  return groups;
}
