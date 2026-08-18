import {
  capturedFactorBaseProbability,
  capturedFactorInheritanceProbability,
  capturedFactorTargetProbability,
  capturedBlueFactorMinimumsSatisfied,
  capturedBlueFactorMinimumSlotCount,
  capturedBlueFactorTotals,
  capturedMemberMatchesSlotConstraint,
  capturedReuseCombinationValid,
  capturedSelectedSkillFactorCount,
  capturedUmaMatchesGeneratedCandidate,
  combinedSkillTargetProbability,
  compareCombinedProbabilityPriority,
  detailedCommonG1Count,
  mergeScannedSuccessionPlayers,
  normalizeSuccessionIndex,
  probabilityAtLeastOnce,
  winSaddleCompatibilityBonus,
} from './SuccessionPlanner';

describe('compareCombinedProbabilityPriority', () => {
  test('includes configured skills in the comprehensive probability', () => {
    expect(combinedSkillTargetProbability(0.5, [0.2, 0.4])).toBeCloseTo(0.04);
    expect(combinedSkillTargetProbability(0.4, [0.8])).toBeCloseTo(0.32);
  });

  test('compares the comprehensive probability including configured skills', () => {
    expect(compareCombinedProbabilityPriority(0.6, [0.1], 0.5, [1])).toBe(1);
  });

  test('uses configured skill order when comprehensive probabilities tie', () => {
    expect(
      compareCombinedProbabilityPriority(0.5, [0.4, 0.1], 0.5, [0.3, 0.9]),
    ).toBe(1);
    expect(
      compareCombinedProbabilityPriority(0.5, [0.4, 0.2], 0.5, [0.4, 0.1]),
    ).toBe(1);
    expect(compareCombinedProbabilityPriority(0.5, [0.4], 0.5, [0.4])).toBe(0);
  });
});

describe('winSaddleCompatibilityBonus', () => {
  test('adds the two parent comparisons instead of doubling one estimate', () => {
    expect(winSaddleCompatibilityBonus([2, 5])).toBe(21);
    expect(winSaddleCompatibilityBonus([0, 5])).toBe(15);
  });
});

const trainedUma = (
  trainedCharaId: number,
  cardId: number,
  factorId: number,
  parents: any[] = [],
  winSaddleIds: number[] = [],
) => ({
  trained_chara_id: trainedCharaId,
  card_id: cardId,
  factor_info_array: [{ factor_id: factorId }],
  succession_chara_array: parents,
  win_saddle_id_array: winSaddleIds,
});

describe('capturedReuseCombinationValid', () => {
  const branch = (
    parentId: number,
    parentSource: 'own' | 'rental' | 'planned',
    selectionIds: string[],
    sources: Array<'own' | 'rental'>,
    umaIds: number[],
  ) => ({ parentId, parentSource, selectionIds, sources, umaIds });

  test('rejects only two borrowed direct parents', () => {
    expect(
      capturedReuseCombinationValid(
        branch(1001, 'own', ['own:0:1'], ['own'], [1001, 1002, 1003]),
        branch(1004, 'rental', ['rental:9:2'], ['rental'], [1004, 1005, 1006]),
      ),
    ).toBe(true);
    expect(
      capturedReuseCombinationValid(
        branch(1001, 'rental', ['rental:8:1'], ['rental'], [1001, 1002, 1003]),
        branch(1004, 'rental', ['rental:9:2'], ['rental'], [1004, 1005, 1006]),
      ),
    ).toBe(false);
    expect(
      capturedReuseCombinationValid(
        branch(1001, 'planned', ['rental:8:1'], ['rental'], [1001, 1002, 1003]),
        branch(1004, 'rental', ['rental:9:2'], ['rental'], [1004, 1005, 1006]),
      ),
    ).toBe(true);
    expect(
      capturedReuseCombinationValid(
        branch(1001, 'own', ['own:0:1'], ['own'], [1001, 1002, 1003]),
        branch(1004, 'rental', ['rental:9:2'], ['rental'], [1004, 1002, 1006]),
      ),
    ).toBe(false);
  });
});

describe('captured slot constraints', () => {
  test('a selected position fixes the character type but not the outfit', () => {
    expect(
      capturedMemberMatchesSlotConstraint(
        { umaId: 1001, cardId: 100102 },
        { targetId: 1002, fixedUmaId: 1001, trainedUmaId: 1001 },
      ),
    ).toBe(true);
    expect(
      capturedMemberMatchesSlotConstraint(
        { umaId: 1003, cardId: 100301 },
        { targetId: 1002, fixedUmaId: 1001, trainedUmaId: 1001 },
      ),
    ).toBe(false);
  });

  test('fixed outfit additionally matches the exact card id', () => {
    expect(
      capturedMemberMatchesSlotConstraint(
        { umaId: 1001, cardId: 100102 },
        {
          targetId: 1002,
          fixedUmaId: 1001,
          trainedUmaId: 1001,
          fixedDressCardId: 100101,
        },
      ),
    ).toBe(false);
    expect(
      capturedMemberMatchesSlotConstraint(
        { umaId: 1001, cardId: 100101 },
        {
          targetId: 1002,
          fixedUmaId: 1001,
          trainedUmaId: 1001,
          fixedDressCardId: 100101,
        },
      ),
    ).toBe(true);
  });

  test('filters by the total blue factor stars across all six positions', () => {
    const paternal = capturedBlueFactorTotals([
      {
        blueFactor: {
          id: 103,
          type: 'speed',
          name: '速度',
          stars: 3,
        },
      },
      {
        blueFactor: {
          id: 102,
          type: 'speed',
          name: '速度',
          stars: 2,
        },
      },
      {
        blueFactor: {
          id: 203,
          type: 'stamina',
          name: '耐力',
          stars: 3,
        },
      },
    ]);
    const maternal = capturedBlueFactorTotals([
      {
        blueFactor: {
          id: 101,
          type: 'speed',
          name: '速度',
          stars: 1,
        },
      },
      {
        blueFactor: {
          id: 303,
          type: 'power',
          name: '力量',
          stars: 3,
        },
      },
      { blueFactor: null },
    ]);
    const minimums = {
      speed: 6,
      stamina: 3,
      power: 3,
      guts: 0,
      wisdom: 0,
    };

    expect(
      capturedBlueFactorMinimumsSatisfied(minimums, [paternal, maternal]),
    ).toBe(true);
    expect(
      capturedBlueFactorMinimumsSatisfied({ ...minimums, speed: 7 }, [
        paternal,
        maternal,
      ]),
    ).toBe(false);
    expect(
      capturedBlueFactorMinimumSlotCount({
        speed: 4,
        stamina: 7,
        power: 3,
        guts: 0,
        wisdom: 0,
      }),
    ).toBe(6);
    expect(
      capturedBlueFactorMinimumSlotCount({
        speed: 4,
        stamina: 7,
        power: 3,
        guts: 1,
        wisdom: 0,
      }),
    ).toBe(7);
  });
});

describe('captured candidate matching', () => {
  const candidate = {
    umaId: 1001,
    factor: { type: 'mile', stars: 3 },
    parents: [
      { factor: { type: 'turf', stars: 2 } },
      { factor: { type: 'long', stars: 1 } },
    ],
    lineageFactors: [
      { type: 'turf', stars: 2 },
      { type: 'long', stars: 1 },
      { type: 'dirt', stars: 2 },
      { type: 'dirt', stars: 1 },
      { type: 'turf', stars: 2 },
      { type: 'short', stars: 1 },
    ],
  } as any;

  const position = {
    uma: { id: 1001 },
    factor: { type: 'mile', stars: 2 },
    minimumDemand: { turf: 2 },
    cumulativeDemand: { turf: 2, dirt: 3 },
  } as any;

  test('matches the character, self factor, direct parents, and all six lineage factors', () => {
    expect(capturedUmaMatchesGeneratedCandidate(candidate, position)).toBe(
      true,
    );
    expect(
      capturedUmaMatchesGeneratedCandidate(
        { ...candidate, umaId: 1002 },
        position,
      ),
    ).toBe(false);
    expect(
      capturedUmaMatchesGeneratedCandidate(
        { ...candidate, factor: { type: 'mile', stars: 1 } },
        position,
      ),
    ).toBe(false);
  });

  test('requires minimum demand from direct parents and combined demand from the lineage', () => {
    expect(
      capturedUmaMatchesGeneratedCandidate(
        {
          ...candidate,
          parents: [
            { factor: { type: 'long', stars: 2 } },
            { factor: { type: 'short', stars: 1 } },
          ],
        },
        position,
      ),
    ).toBe(false);
    expect(
      capturedUmaMatchesGeneratedCandidate(
        {
          ...candidate,
          lineageFactors: candidate.lineageFactors.filter(
            (factor: any) => factor.type !== 'dirt',
          ),
        },
        position,
      ),
    ).toBe(false);
  });

  test('does not constrain the self red factor for a free slot', () => {
    expect(
      capturedUmaMatchesGeneratedCandidate(
        { ...candidate, factor: { type: 'short', stars: 1 } },
        { ...position, factor: { ...position.factor, free: true } },
      ),
    ).toBe(true);
  });
});

describe('captured factor probability', () => {
  const factorMeta = {
    1001203: {
      id: 1001203,
      groupId: 10012,
      stars: 3 as const,
      factorType: 5 as const,
      name: '宝冢纪念',
      skillGroupIds: [20018],
    },
    2001803: {
      id: 2001803,
      groupId: 20018,
      stars: 3 as const,
      factorType: 4 as const,
      name: '夏季优俊少女○',
      skillGroupIds: [20018],
    },
    10010102: {
      id: 10010102,
      groupId: 100101,
      stars: 2 as const,
      factorType: 3 as const,
      name: '璀璨流星',
      skillGroupIds: [90001],
    },
  };

  test('uses the configured 1/2/3-star base probabilities', () => {
    expect(capturedFactorBaseProbability(5, 3)).toBeCloseTo(0.03);
    expect(capturedFactorBaseProbability(4, 3)).toBeCloseTo(0.09);
    expect(capturedFactorBaseProbability(3, 3)).toBeCloseTo(0.15);
    expect(probabilityAtLeastOnce(0.03)).toBeCloseTo(0.0591);
  });

  test('applies compatibility to green, skill, and race factors', () => {
    expect(capturedFactorInheritanceProbability(3, 3, 50)).toBeCloseTo(0.225);
    expect(capturedFactorInheritanceProbability(4, 3, 50)).toBeCloseTo(0.135);
    expect(capturedFactorInheritanceProbability(5, 3, 50)).toBeCloseTo(0.045);
  });

  test('combines race and skill factors as alternative skill sources', () => {
    const probability = capturedFactorTargetProbability(
      [
        {
          factor: { id: 1001203, groupId: 10012, stars: 3 },
          generation: 2,
          compatibility: 50,
        },
        {
          factor: { id: 2001803, groupId: 20018, stars: 3 },
          generation: 1,
          compatibility: 20,
        },
      ],
      { kind: 'skill', groupId: 20018 },
      factorMeta,
    );
    const raceProbability = probabilityAtLeastOnce(0.03 * 1.5);
    const skillProbability = probabilityAtLeastOnce(0.09 * 1.2);
    expect(probability).toBeCloseTo(
      1 - (1 - raceProbability) * (1 - skillProbability),
    );
  });

  test('counts factor sources matching the configured skills', () => {
    expect(
      capturedSelectedSkillFactorCount(
        [
          { id: 1001203, groupId: 10012, stars: 3 },
          { id: 2001803, groupId: 20018, stars: 3 },
          { id: 10010102, groupId: 100101, stars: 2 },
        ],
        [{ kind: 'skill', groupId: 20018 }],
        factorMeta,
      ),
    ).toBe(2);
  });

  test('treats a green factor as a skill source: direct parent guaranteed, ancestor rolled twice', () => {
    const factor = { id: 10010102, groupId: 100101, stars: 2 as const };
    expect(
      capturedFactorTargetProbability(
        [{ factor, generation: 1, compatibility: 50 }],
        { kind: 'skill', groupId: 90001 },
        factorMeta,
      ),
    ).toBe(1);
    expect(
      capturedFactorTargetProbability(
        [{ factor, generation: 2, compatibility: 50 }],
        { kind: 'skill', groupId: 90001 },
        factorMeta,
      ),
    ).toBeCloseTo(probabilityAtLeastOnce(0.15));
  });
});

describe('normalizeSuccessionIndex', () => {
  test('applies factor research upgrades to each lineage position', () => {
    const normalized = normalizeSuccessionIndex({
      receivedAt: '2026-08-19T00:00:00.000Z',
      data: {
        trained_chara: [
          {
            trained_chara_id: 675758571247,
            card_id: 100101,
            factor_info_array: [
              { factor_id: 302 },
              { factor_id: 3202 },
              { factor_id: 2003302 },
            ],
            factor_extend_array: [
              { position_id: 1, base_factor_id: 2003302, factor_id: 2003303 },
              { position_id: 10, base_factor_id: 302, factor_id: 303 },
              {
                position_id: 10,
                base_factor_id: 10040202,
                factor_id: 10040203,
              },
              { position_id: 20, base_factor_id: 202, factor_id: 203 },
              {
                position_id: 20,
                base_factor_id: 2004502,
                factor_id: 2004503,
              },
            ],
            succession_chara_array: [
              {
                position_id: 10,
                card_id: 100201,
                factor_info_array: [
                  { factor_id: 302 },
                  { factor_id: 1202 },
                  { factor_id: 10040202 },
                ],
              },
              {
                position_id: 20,
                card_id: 100301,
                factor_info_array: [
                  { factor_id: 202 },
                  { factor_id: 2102 },
                  { factor_id: 2004502 },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(normalized).toHaveLength(1);
    expect(normalized[0].blueFactor?.stars).toBe(2);
    expect(
      normalized[0].parents.map((parent) => parent.blueFactor?.stars),
    ).toEqual([3, 3]);
    expect(normalized[0].inheritanceFactors).toEqual(
      expect.arrayContaining([{ id: 2003303, groupId: 20033, stars: 3 }]),
    );
    expect(normalized[0].parents[0].inheritanceFactors).toEqual(
      expect.arrayContaining([
        { id: 303, groupId: 3, stars: 3 },
        { id: 10040203, groupId: 100402, stars: 3 },
      ]),
    );
    expect(normalized[0].parents[1].inheritanceFactors).toEqual(
      expect.arrayContaining([
        { id: 203, groupId: 2, stars: 3 },
        { id: 2004503, groupId: 20045, stars: 3 },
      ]),
    );
  });

  test('merges persisted scanned players into rental candidates', () => {
    const practicePartner = {
      viewer_id: 245749415802,
      trained_chara_id: 99,
      card_id: 100101,
      rank_score: 20000,
      factor_info_array: [{ factor_id: 3203 }],
      succession_chara_array: [
        {
          position_id: 10,
          card_id: 100201,
          factor_info_array: [{ factor_id: 1202 }],
        },
        {
          position_id: 20,
          card_id: 100401,
          factor_info_array: [{ factor_id: 2202 }],
        },
      ],
    };
    const merged = mergeScannedSuccessionPlayers(null, [
      {
        viewerId: '245749415802',
        name: '测试玩家',
        fetchedAt: '2026-08-18T12:00:00.000Z',
        userInfo: { viewer_id: 245749415802, name: '测试玩家' },
        practicePartner,
      },
    ]);
    const normalized = normalizeSuccessionIndex(merged);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      source: 'rental',
      viewerId: 245749415802,
      ownerName: '测试玩家',
      trainedCharaId: 99,
    });
  });

  test('builds own and rental three-generation records from load/index', () => {
    const ownParents = [
      {
        position_id: 10,
        card_id: 100201,
        factor_info_array: [{ factor_id: 1102 }],
        win_saddle_id_array: [1, 2, 2, 0],
      },
      {
        position_id: 20,
        card_id: 100301,
        factor_info_array: [{ factor_id: 2101 }],
        win_saddle_id_array: [2, 3],
      },
      {
        position_id: 11,
        factor_info_array: [{ factor_id: 3201 }],
      },
      {
        position_id: 12,
        factor_info_array: [{ factor_id: 3202 }],
      },
      {
        position_id: 21,
        factor_info_array: [{ factor_id: 3101 }],
      },
      {
        position_id: 22,
        factor_info_array: [{ factor_id: 3402 }],
      },
    ];
    const rentalParents = [
      {
        position_id: 10,
        card_id: 100501,
        factor_info_array: [{ factor_id: 3103 }],
      },
      {
        position_id: 20,
        card_id: 100601,
        factor_info_array: [{ factor_id: 3402 }],
      },
    ];
    const result = normalizeSuccessionIndex({
      receivedAt: '2026-08-18T00:00:00.000Z',
      data: {
        trained_chara: [
          {
            ...trainedUma(1, 100101, 3203, ownParents, [1, 3, 3]),
            chara_id: 100102,
            factor_info_array: [
              { factor_id: 402 },
              { factor_id: 3203 },
              { factor_id: 1003402 },
              { factor_id: 10190101 },
            ],
          },
        ],
        succession_trained_chara_data: {
          summary_user_info_array: [{ viewer_id: 9, name: '好友' }],
          succession_trained_chara_array: [
            {
              ...trainedUma(2, 100401, 1203, rentalParents),
              viewer_id: 9,
              factor_info_array: [
                { factor_id: 503 },
                { factor_id: 1203 },
                { factor_id: 1000302 },
                { factor_id: 1000401 },
                { factor_id: 10040102 },
              ],
            },
          ],
        },
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      source: 'own',
      trainedCharaId: 1,
      cardId: 100101,
      umaId: 1001,
      factor: { type: 'mile', stars: 3 },
      blueFactor: { name: '毅力', stars: 2 },
      uniqueFactorStars: 1,
      whiteFactorCount: 1,
      inheritanceFactors: expect.arrayContaining([
        { id: 1003402, groupId: 10034, stars: 2 },
        { id: 10190101, groupId: 101901, stars: 1 },
      ]),
      winSaddleIds: [1, 3],
      parents: [
        {
          umaId: 1002,
          factor: { type: 'turf', stars: 2 },
          winSaddleIds: [1, 2],
        },
        {
          umaId: 1003,
          factor: { type: 'nige', stars: 1 },
          winSaddleIds: [2, 3],
        },
      ],
      lineageFactors: expect.arrayContaining([
        expect.objectContaining({ type: 'turf', stars: 2 }),
        expect.objectContaining({ type: 'nige', stars: 1 }),
        expect.objectContaining({ type: 'mile', stars: 1 }),
        expect.objectContaining({ type: 'mile', stars: 2 }),
        expect.objectContaining({ type: 'short', stars: 1 }),
        expect.objectContaining({ type: 'long', stars: 2 }),
      ]),
    });
    expect(result[0].lineageFactors).toHaveLength(6);
    expect(result[1]).toMatchObject({
      source: 'rental',
      viewerId: 9,
      ownerName: '好友',
      factor: { type: 'dirt', stars: 3 },
      blueFactor: { name: '智力', stars: 3 },
      uniqueFactorStars: 2,
      whiteFactorCount: 2,
    });
  });

  test('uses the exact shared G1 saddle intersection when details exist', () => {
    expect(
      detailedCommonG1Count([1, 2, 3, 3, 9], [2, 3, 4], [1, 2, 3, 4]),
    ).toBe(2);
  });

  test('falls back when either detailed saddle list is missing', () => {
    expect(detailedCommonG1Count([], [2, 3], [1, 2, 3])).toBeUndefined();
    expect(detailedCommonG1Count([1, 2], [2, 3], [])).toBeUndefined();
  });
});
