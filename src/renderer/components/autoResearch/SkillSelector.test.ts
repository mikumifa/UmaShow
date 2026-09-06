import {
  AutoResearchSkill,
  isInheritedUniqueSkill,
  matchesSkillIconFamily,
  matchesSkillTagFilters,
  skillEffectFilterId,
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

  it('maps negative speed, stamina, acceleration and temptation families correctly', () => {
    expect(skillEffectFilterId(skill(30011))).toBe('hindrance_speed');
    expect(skillEffectFilterId(skill(30012))).toBe('hindrance_speed');
    expect(skillEffectFilterId(skill(30051))).toBe('hindrance_stamina');
    expect(skillEffectFilterId(skill(30052))).toBe('hindrance_stamina');
    expect(skillEffectFilterId(skill(30021))).toBe('hindrance_acceleration');
    expect(skillEffectFilterId(skill(30022))).toBe('hindrance_acceleration');
    expect(skillEffectFilterId(skill(30041))).toBe('hindrance_temptation');
  });
});

describe('skill kind filters', () => {
  it('recognizes learnable inherited unique skills by category and rarity', () => {
    expect(
      isInheritedUniqueSkill({
        ...skill(20011),
        id: 900011,
        rarity: 1,
        skill_category: 5,
      }),
    ).toBe(true);
  });

  it('does not mix normal or base unique skills into inherited unique skills', () => {
    expect(isInheritedUniqueSkill(skill(20011))).toBe(false);
    expect(
      isInheritedUniqueSkill({
        ...skill(20011),
        rarity: 3,
        skill_category: 5,
      }),
    ).toBe(false);
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
