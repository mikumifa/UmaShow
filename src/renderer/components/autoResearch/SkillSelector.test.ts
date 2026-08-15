import { AutoResearchSkill, matchesSkillIconFamily } from './SkillSelector';

function skill(iconId: number): AutoResearchSkill {
  return {
    id: iconId,
    name: String(iconId),
    rarity: iconId % 10 === 2 ? 2 : 1,
    group_id: 0,
    grade_value: 0,
    need_skill_point: 100,
    disable_singlemode: 0,
    tags: [],
    icon_id: iconId,
    skill_category: 0,
  };
}

describe('skill effect icon filters', () => {
  it('matches both white and gold variants', () => {
    expect(matchesSkillIconFamily(skill(20011), 20011)).toBe(true);
    expect(matchesSkillIconFamily(skill(20012), 20011)).toBe(true);
  });

  it('does not mix unique or negative variants into the normal filter', () => {
    expect(matchesSkillIconFamily(skill(20013), 20011)).toBe(false);
    expect(matchesSkillIconFamily(skill(20014), 20011)).toBe(false);
  });
});
