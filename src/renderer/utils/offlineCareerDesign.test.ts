import type { Dashboard } from 'renderer/components/autoResearch/types';
import { PLANNER_CATALOG } from './racePlannerCatalog';
import * as catalog from './racePlannerCatalog';
import { optimizeRaceSchedule, ScheduleInput } from './raceScheduleOptimizer';
import { REFERENCE_WIN_RATES } from './raceWinRateModel';
import { storedPlannerFanBonus } from './racePlannerPreferences';
import {
  chooseOfflineParents,
  designOfflineCareer,
  inheritedCareerAptitudes,
  normalizeOfflineDesign,
} from './offlineCareerDesign';

type Parent = Dashboard['parents'][number];
const character = PLANNER_CATALOG.characters[0];
const parent = (
  id: string,
  charaId: number,
  source: Parent['source'],
  stars: number,
): Parent => ({
  selection_id: id,
  chara_id: charaId,
  source,
  viewer_id: source === 'rental' ? 123 : 0,
  owner_name: '',
  instance_id: 1,
  card_id: charaId * 100 + 1,
  name: id,
  rank: 1,
  rank_score: 100,
  rarity: 3,
  talent_level: 5,
  race_cloth_id: 0,
  scenario_id: 5,
  running_style: 1,
  stats: { speed: 100, stamina: 100, power: 100, guts: 100, wiz: 100 },
  factor_summary: { stat: null, distance: null, unique: null, white_count: 0 },
  ancestors: [],
  factors: [
    {
      id: 1,
      name: '速度',
      factor_group_id: 1,
      factor_type: 1,
      category: 'stat',
      stars,
    },
  ],
});

const aptitudeCharacter = {
  ...character,
  aptitudes: { ...character.aptitudes, turf: 7, mile: 6 },
};
const planningInput: ScheduleInput = {
  races: [
    {
      id: 1,
      programId: 1,
      turn: 1,
      name: '测试 GI',
      grade: 100,
      ground: 'turf',
      distanceType: 'mile',
      distance: 1600,
      fans: 1000,
      requiredFans: 0,
    },
  ],
  startTurn: 1,
  endTurn: 1,
  aptitudes: aptitudeCharacter.aptitudes,
  winRates: { '7:6': [0.2, 0.2, 0.2, 0.2, 0.2], '7:7': [1, 1, 1, 1, 1] },
  objective: 'fans',
  gradeThreshold: 100,
  fanBonusPercent: 120,
  fixedRaces: {},
  blockedTurns: [],
  restTurns: [],
};

test.each(['fans', 'jewels'] as const)(
  'one-click evaluates attainable schedule %s instead of maximizing star totals',
  (objective) => {
    const blue1 = parent('blue1', character.id + 1, 'own', 9);
    const blue2 = parent('blue2', character.id + 2, 'own', 8);
    const mile = parent('mile', character.id + 3, 'own', 1);
    mile.factors = [
      {
        ...mile.factors[0],
        factor_group_id: 32,
        factor_type: 2,
        category: 'distance',
      },
    ];
    const rental = {
      ...mile,
      selection_id: 'rental:1',
      source: 'rental' as const,
      viewer_id: 1,
    };
    const { best } = chooseOfflineParents(
      aptitudeCharacter,
      normalizeOfflineDesign({ goal: objective }),
      [blue1, blue2, mile, rental],
      { ...planningInput, objective },
    );
    expect(best?.parents).toEqual([blue1, mile]);
    expect(best?.schedule.expectedFans).toBeCloseTo(1000 * 2.2 * 1.1);
    expect(best?.demands).toEqual([
      expect.objectContaining({ key: 'mile', base: 6, target: 7, stars: 1 }),
    ]);
  },
);

test('one-click shares planning model, bonus and mandatory/script races, exporting only extra races', () => {
  const original = catalog.buildPlanningCalendar(character.id, 5, 0);
  const races = [
    { ...planningInput.races[0], isCareerGoal: true },
    { ...planningInput.races[0], id: 2, turn: 2 },
  ];
  const calendar = {
    ...original,
    races,
    startTurn: 1,
    fixedRaces: { 1: [1] },
    blockedTurns: [],
    automaticRaces: [
      { turn: 2, name: 'GUR', fans: 700, thumbnailId: 0, programIds: [] },
    ],
    errors: [],
  };
  const spy = jest
    .spyOn(catalog, 'buildPlanningCalendar')
    .mockReturnValue(calendar);
  try {
    const own1 = parent('own1', character.id + 1, 'own', 3);
    const own2 = parent('own2', character.id + 2, 'own', 3);
    const result = designOfflineCareer(
      aptitudeCharacter,
      normalizeOfflineDesign({ goal: 'jewels' }),
      [own1, own2],
      80,
    );
    const expected = optimizeRaceSchedule({
      ...planningInput,
      races,
      endTurn: calendar.scenario.endTurn,
      objective: 'jewels',
      fanBonusPercent: 80,
      winRates: REFERENCE_WIN_RATES,
      fixedRaces: calendar.fixedRaces,
      automaticRaces: calendar.automaticRaces,
    });
    expect(result.schedule).toEqual(expected);
    expect(result.raceIds).toEqual([2]);
    expect(result.schedule.automaticRaces).toHaveLength(1);
    const defaultBonus = designOfflineCareer(
      aptitudeCharacter,
      normalizeOfflineDesign({ goal: 'jewels' }),
      [own1, own2],
    );
    expect(
      defaultBonus.schedule.expectedFans / result.schedule.expectedFans,
    ).toBeCloseTo(2.2 / 1.8);
    const theoretical = designOfflineCareer(
      {
        ...aptitudeCharacter,
        aptitudes: { ...aptitudeCharacter.aptitudes, mile: 5 },
      },
      normalizeOfflineDesign({ goal: 'fans' }),
      [],
    );
    expect(theoretical.best).toBeUndefined();
    expect(theoretical.demands).toContainEqual(
      expect.objectContaining({ key: 'mile', target: 6, stars: 1 }),
    );
  } finally {
    spy.mockRestore();
  }
});

test('one-click uses persisted planner bonus including zero and migrates legacy zero', () => {
  expect(storedPlannerFanBonus(null)).toBe(120);
  expect(storedPlannerFanBonus('{')).toBe(120);
  expect(storedPlannerFanBonus('{"fanBonus":0}')).toBe(120);
  expect(storedPlannerFanBonus('{"version":2,"fanBonus":0}')).toBe(0);
  expect(storedPlannerFanBonus('{"version":2,"fanBonus":80}')).toBe(80);
});

test('one-click applies goal bonus at the actual streak and zero drops after five consecutive races', () => {
  const original = catalog.buildPlanningCalendar(character.id, 5, 0);
  const races = [1, 2, 3, 4, 5, 6, 7].map((turn) => ({
    ...planningInput.races[0],
    id: turn,
    turn,
    isCareerGoal: turn === 4,
  }));
  const extraIds = [1, 2, 3, 5, 6, 7];
  const spy = jest.spyOn(catalog, 'buildPlanningCalendar').mockReturnValue({
    ...original,
    races,
    startTurn: 1,
    fixedRaces: { 4: [4] },
    blockedTurns: [],
    automaticRaces: [],
    errors: [],
  });
  try {
    const result = designOfflineCareer(
      aptitudeCharacter,
      normalizeOfflineDesign({ goal: 'jewels', fixedIds: extraIds }),
      [
        parent('own1', character.id + 1, 'own', 3),
        parent('own2', character.id + 2, 'own', 3),
      ],
    );
    expect(result.best).toBeDefined();
    expect(result.raceIds).toEqual(extraIds);
    const steps = result.schedule.steps.filter((step) => step.race);
    expect(steps.map((step) => step.streak)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps[3].winProbability).toBeCloseTo(0.9);
    expect(steps[5].winProbability).toBeCloseTo(0.5);
    expect(result.schedule.expectedDrops).toBeCloseTo(0.1245);
  } finally {
    spy.mockRestore();
  }
});

test('one-click parent selection excludes rentals even when they have better factors', () => {
  const own1 = parent('own-1', character.id + 1, 'own', 1);
  const own2 = parent('own-2', character.id + 2, 'own', 1);
  const rental = parent('rental', character.id + 3, 'rental', 3);
  const legacyRental = {
    ...parent('legacy-rental', character.id + 4, 'own', 3),
    viewer_id: 456,
  };
  const mismatchedSource = parent('rental:789:1', character.id + 5, 'own', 3);
  const { best } = chooseOfflineParents(character, normalizeOfflineDesign(), [
    own1,
    own2,
    rental,
    legacyRental,
    mismatchedSource,
  ]);
  expect(best?.parents).toEqual([own1, own2]);
});

test('initial aptitude upgrades count both parents and all four ancestors, cap at A, and reset when cleared', () => {
  const first = parent('own-1', character.id + 1, 'own', 3);
  const second = parent('own-2', character.id + 2, 'own', 3);
  [first, second].forEach((lineage) => {
    lineage.factors[0] = {
      id: 32,
      name: '英里',
      factor_group_id: 32,
      factor_type: 2,
      category: 'distance',
      stars: 2,
    };
    lineage.ancestors = [1, 2].map((position) => ({
      position_id: position,
      card_id: 100201,
      chara_id: 1002,
      rarity: 3,
      race_cloth_id: 0,
      name: `祖辈 ${position}`,
      factors: [...lineage.factors],
      factor_summary: lineage.factor_summary,
    }));
  });
  const base = { ...character.aptitudes, mile: 1, turf: 7, dirt: 8 };
  const inherited = inheritedCareerAptitudes(base, [first, second]);
  expect(inherited.mile).toBe(5);
  expect(inherited.turf).toBe(7);
  expect(inherited.dirt).toBe(8);
  expect(
    inheritedCareerAptitudes({ ...base, mile: 6 }, [first, second]).mile,
  ).toBe(7);
  expect(inheritedCareerAptitudes(base, [first]).mile).toBe(3);
  expect(inheritedCareerAptitudes(base, [])).toEqual(base);
});

test('one-click selection leaves parents unfilled when only a rental can complete the pair', () => {
  const { best } = chooseOfflineParents(character, normalizeOfflineDesign(), [
    parent('own', character.id + 1, 'own', 1),
    parent('rental', character.id + 2, 'rental', 3),
  ]);
  expect(best).toBeUndefined();
});
