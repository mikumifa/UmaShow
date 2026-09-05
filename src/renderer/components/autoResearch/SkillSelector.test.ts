import {
  AutoResearchSkill,
  matchesSkillIconFamily,
  matchesSkillTagFilters,
} from './SkillSelector';

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

describe('skill running style and distance filters', () => {
  const runningStyleTags = [101, 102, 103, 104];
  const distanceTags = [201, 202, 203, 204];

  it('matches general skills only when the category has no limiting tag', () => {
    const generalSkill = { ...skill(20011), tags: [301] };
    const nigeSkill = { ...skill(20011), tags: [101] };
    const shortSkill = { ...skill(20011), tags: [201] };

    expect(matchesSkillTagFilters(generalSkill, [0], runningStyleTags)).toBe(
      true,
    );
    expect(matchesSkillTagFilters(nigeSkill, [0], runningStyleTags)).toBe(
      false,
    );
    expect(matchesSkillTagFilters(generalSkill, [0], distanceTags)).toBe(true);
    expect(matchesSkillTagFilters(shortSkill, [0], distanceTags)).toBe(false);
  });

  it('combines general and specific filters with OR semantics', () => {
    const generalSkill = skill(20011);
    const senkoSkill = { ...skill(20011), tags: [102] };
    const nigeSkill = { ...skill(20011), tags: [101] };

    expect(
      matchesSkillTagFilters(generalSkill, [0, 102], runningStyleTags),
    ).toBe(true);
    expect(matchesSkillTagFilters(senkoSkill, [0, 102], runningStyleTags)).toBe(
      true,
    );
    expect(matchesSkillTagFilters(nigeSkill, [0, 102], runningStyleTags)).toBe(
      false,
    );
  });
});
