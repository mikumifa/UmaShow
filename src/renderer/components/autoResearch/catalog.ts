import autoResearchCatalog from '../../../../assets/data/auto_research_catalog.json';
import type { AutoResearchSkill } from './SkillSelector';
import type { RaceOption, SkillOption } from './types';

export const localCatalog = autoResearchCatalog as {
  running_style_by_card: Record<string, number>;
  skills: Record<string, SkillOption>;
  available_skills_by_card: Record<string, { skill_id: number; need_rank: number }[]>;
  support_hint_skills: Record<string, number[]>;
  races: RaceOption[];
};

const zhCollator = new Intl.Collator('zh-CN');

export const localAutoResearchSkills = (() => {
  const byName = new Map<string, AutoResearchSkill>();
  Object.entries(localCatalog.skills).forEach(([rawId, rawSkill]) => {
    const name = String(rawSkill.name || '').trim();
    const needSkillPoint = Number(rawSkill.need_skill_point || 0);
    if (!name || needSkillPoint <= 0 || name.endsWith('×')) return;
    if (!byName.has(name)) {
      byName.set(name, {
        id: Number(rawId),
        name,
        description: rawSkill.description,
        rarity: Number(rawSkill.rarity || 0),
        group_id: Number(rawSkill.group_id || 0),
        grade_value: Number(rawSkill.grade_value || 0),
        need_skill_point: needSkillPoint,
        disable_singlemode: Number(rawSkill.disable_singlemode || 0),
        tags: Array.isArray(rawSkill.tags)
          ? rawSkill.tags.map(Number).filter(Number.isFinite)
          : [],
        icon_id: Number(rawSkill.icon_id || 0),
        skill_category: Number(rawSkill.skill_category || 0),
      });
    }
  });
  return [...byName.values()].sort(
    (left, right) =>
      right.rarity - left.rarity ||
      left.skill_category - right.skill_category ||
      zhCollator.compare(left.name, right.name),
  );
})();

export const localAutoResearchSkillById = new Map(
  localAutoResearchSkills.map((skill) => [skill.id, skill]),
);
export const localAutoResearchSkillByName = new Map(
  localAutoResearchSkills.map((skill) => [skill.name, skill]),
);
