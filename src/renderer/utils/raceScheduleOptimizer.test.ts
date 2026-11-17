import {
  optimizeRaceSchedule,
  PlanningRace,
  ScheduleInput,
  FAN_MODEL,
} from './raceScheduleOptimizer';
import { recommendRaceInheritance } from './raceInheritanceRecommendation';
import { buildPlanningCalendar, PLANNER_CATALOG } from './racePlannerCatalog';
import { REFERENCE_WIN_RATE_MODEL_VERSION } from './raceWinRateModel';
import { JEWEL_MODEL_VERSION } from './raceJewelModel';
import rankings from '../data/race_planner_rankings.json';

const race: PlanningRace = {
  id: 1,
  programId: 1,
  turn: 1,
  name: '测试赛',
  grade: 100,
  ground: 'turf',
  distanceType: 'mile',
  distance: 1600,
  fans: 100,
  requiredFans: 0,
};
const input: ScheduleInput = {
  races: [race],
  startTurn: 1,
  endTurn: 72,
  aptitudes: { turf: 7, dirt: 1, short: 1, mile: 6, middle: 1, long: 1 },
  winRates: { '7:6': [0.2, 0.2, 0.2, 0.2, 0.2], '7:7': [1, 1, 1, 1, 1] },
  objective: 'jewels',
  gradeThreshold: 300,
  fanBonusPercent: 0,
  fixedRaces: {},
  blockedTurns: [],
  restTurns: [],
};

test('fans applies support bonus and the 1.10 correction once to regular and automatic races, with no outside scenario fans', () => {
  const result = optimizeRaceSchedule({
    ...input,
    startTurn: 24,
    endTurn: 24,
    races: [{ ...race, turn: 24 }],
    fixedRaces: { 24: [1] },
    fanBonusPercent: 50,
    automaticRaces: [{ turn: 24, name: 'GUR', fans: 700 }],
  });
  expect(result.steps[0].expectedFans).toBeCloseTo(100 * 0.2 * 1.5 * 1.1);
  expect(result.steps[0].totalExpectedFans).toBeCloseTo(33);
  expect(result.automaticRaces[0].expectedFans).toBeCloseTo(1155);
  expect(result.automaticRaces[0].totalExpectedFans).toBeCloseTo(1188);
  expect(result.expectedFans).toBeCloseTo(1188);
  expect(result.expectedDrops).toBeCloseTo(0.06);
  const empty = optimizeRaceSchedule({
    ...input,
    races: [],
    fanBonusPercent: 120,
  });
  expect(empty.expectedFans).toBe(0);
});

test('career goals add 10 points at the real streak while ordinary fixed and subsequent races receive no bonus', () => {
  const races = [1, 2, 3, 4, 5].map((turn) => ({
    ...race,
    id: turn,
    turn,
    isCareerGoal: turn === 4,
  }));
  const result = optimizeRaceSchedule({
    ...input,
    endTurn: 5,
    races,
    fixedRaces: Object.fromEntries(races.map((item) => [item.turn, [item.id]])),
    winRates: { '7:6': [0.8, 0.6, 0.4, 0.2, 0.1] },
  });
  expect(result.error).toBeUndefined();
  expect(result.steps.map((step) => step.winProbability)).toEqual([
    0.8, 0.8, 0.6, 0.5, 0.2,
  ]);
  expect(result.steps.map((step) => step.streak)).toEqual([1, 2, 3, 4, 5]);
  expect(result.expectedDrops).toBeCloseTo(0.117);
});

test('jewel optimization rests to reset the new drop rates', () => {
  const result = optimizeRaceSchedule({
    ...input,
    endTurn: 5,
    races: [1, 2, 3, 4, 5].map((turn) => ({ ...race, id: turn, turn })),
    winRates: { '7:6': [1, 1, 1, 1, 1] },
  });
  expect(result.steps.map((step) => step.streak)).toEqual([1, 2, 3, 0, 1]);
  expect(result.expectedDrops).toBeCloseTo(0.2);
});

test('forced sixth and later races give zero drops, including goals; resting restores the first-race rate', () => {
  const races = [1, 2, 3, 4, 5, 6, 7, 9].map((turn) => ({
    ...race,
    id: turn,
    turn,
    isCareerGoal: turn === 6,
  }));
  const result = optimizeRaceSchedule({
    ...input,
    endTurn: 9,
    races,
    fixedRaces: Object.fromEntries(races.map((item) => [item.turn, [item.id]])),
    winRates: { '7:6': [1, 1, 1, 1, 1] },
  });
  expect(result.steps.map((step) => step.streak)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 0, 1,
  ]);
  expect(result.expectedDrops).toBeCloseTo(0.22);
});

test('catalog marks career goals independently of manually fixed races and includes programGroup domestic races like Japan Cup', () => {
  const calendar = buildPlanningCalendar(1001, 5);
  const goalIds = Object.values(calendar.fixedRaces).flat();
  expect(goalIds.length).toBeGreaterThan(0);
  expect(
    calendar.races
      .filter((item) => item.isCareerGoal)
      .map((item) => item.id)
      .sort(),
  ).toEqual([...goalIds].sort());
  // Classic-year Japan Cup (turn 46) is not a mandatory goal for 1001, so it must appear as a selectable domestic GI.
  expect(calendar.races).toContainEqual(
    expect.objectContaining({
      turn: 46,
      programId: 79,
      name: '全国杯',
      grade: 100,
      fans: 30000,
    }),
  );
  // Senior-year Japan Cup (turn 70) uses story replacement 1081 for 1001 without leaving duplicate base 79 on turn 70.
  expect(
    calendar.races.filter((item) => item.turn === 70 && item.name === '全国杯'),
  ).toHaveLength(1);
  // Oguri Cap (1006) does not have senior Japan Cup as a mandatory goal, so both Classic and Senior 全国杯 are selectable.
  const oguriCalendar = buildPlanningCalendar(1006, 5);
  expect(
    oguriCalendar.races
      .filter((item) => item.name === '全国杯')
      .map((item) => item.turn),
  ).toEqual([46, 70]);
});

test('year-end races add three guaranteed wins and 0.15 drops without changing regular slots or streaks', () => {
  const calendar = buildPlanningCalendar(1001, 5);
  expect(calendar.automaticRaces.map((event) => event.turn)).toEqual([
    24, 48, 72,
  ]);
  const races = [23, 24, 25, 26, 48, 72].map((turn) => ({
    ...race,
    id: turn,
    turn,
  }));
  const baseline = optimizeRaceSchedule({
    ...input,
    races,
    fixedRaces: { 24: [24] },
  });
  const result = optimizeRaceSchedule({
    ...input,
    races,
    fixedRaces: { 24: [24] },
    automaticRaces: calendar.automaticRaces,
  });
  expect(
    result.steps.map((step) => [
      step.turn,
      step.race?.id,
      step.streak,
      step.winProbability,
    ]),
  ).toEqual(
    baseline.steps.map((step) => [
      step.turn,
      step.race?.id,
      step.streak,
      step.winProbability,
    ]),
  );
  expect(result.steps.find((step) => step.turn === 24)?.race?.id).toBe(24);
  expect(result.expectedDrops - baseline.expectedDrops).toBeCloseTo(0.15);
  expect(result.expectedWins - baseline.expectedWins).toBeCloseTo(3);
  expect(result.expectedFans - baseline.expectedFans).toBeCloseTo(33770);
  expect(result.automaticRaces.map((step) => step.expectedDrops)).toEqual([
    0.05, 0.05, 0.05,
  ]);
  expect(
    result.steps.find((step) => step.turn === 25)!.totalExpectedWins -
      baseline.steps.find((step) => step.turn === 25)!.totalExpectedWins,
  ).toBeCloseTo(1);
});

test('automatic races still pay on fixed rest dates with all ordinary win rates zero and respect the planning range', () => {
  const { automaticRaces } = buildPlanningCalendar(1001, 5);
  const result = optimizeRaceSchedule({
    ...input,
    races: [],
    restTurns: [24, 48, 72],
    automaticRaces,
  });
  expect(result.raceCount).toBe(0);
  expect(result.expectedDrops).toBeCloseTo(0.15);
  expect(result.expectedWins).toBe(3);
  const partial = optimizeRaceSchedule({
    ...input,
    races: [],
    startTurn: 25,
    endTurn: 48,
    automaticRaces,
  });
  expect(partial.automaticRaces.map((step) => step.turn)).toEqual([48]);
  expect(partial.expectedDrops).toBe(0.05);
});

test('inheritance recommends the minimum stars for an actual benefit and no factors for a tie', () => {
  const result = recommendRaceInheritance(input);
  expect(result.demands).toEqual([
    { type: 'mile', base: 6, target: 7, stars: 1, slots: 1 },
  ]);
  expect(result.schedule.expectedDrops).toBe(0.05);
  const tied = recommendRaceInheritance({
    ...input,
    winRates: { '7:6': [1, 1, 1, 1, 1], '7:7': [1, 1, 1, 1, 1] },
  });
  expect(tied.demands).toEqual([]);
  expect(tied.slots).toBe(0);
});

test.each(['fans', 'wins', 'jewels'] as const)(
  '%s prefers GI over GII and GIII when the main return is equal, regardless of input order',
  (objective) => {
    const races = [300, 200, 100].map((grade) => ({
      ...race,
      id: grade,
      grade,
    }));
    const result = optimizeRaceSchedule({
      ...input,
      objective,
      races,
      endTurn: 1,
    });
    expect(result.steps[0].race?.grade).toBe(100);
    const noGI = optimizeRaceSchedule({
      ...input,
      objective,
      races: races.slice(0, 2),
      endTurn: 1,
    });
    expect(noGI.steps[0].race?.grade).toBe(200);
  },
);

test('fans uses the actual winner reward and win probability before the grade preference', () => {
  const gi = { ...race, id: 100, grade: 100, fans: 10000 };
  const giii = {
    ...race,
    id: 300,
    grade: 300,
    distanceType: 'short' as const,
    fans: 3000,
  };
  const rates = { ...input.winRates, '7:1': [1, 1, 1, 1, 1] };
  const result = optimizeRaceSchedule({
    ...input,
    objective: 'fans',
    races: [gi, giii],
    winRates: rates,
    endTurn: 1,
    fanBonusPercent: 50,
  });
  expect(result.steps[0].race?.id).toBe(300);
  expect(result.expectedFans).toBeCloseTo(4950);
  const equalRates = optimizeRaceSchedule({
    ...input,
    objective: 'fans',
    races: [giii, gi],
    winRates: { ...rates, '7:6': [1, 1, 1, 1, 1] },
    endTurn: 1,
  });
  expect(equalRates.steps[0].race?.id).toBe(100);
  expect(equalRates.expectedFans).toBeCloseTo(11000);
});

test('jewels maximizes fans at equal drop return before preferring GI, but retains fixed races', () => {
  const gi = { ...race, id: 100, grade: 100 };
  const giii = { ...race, id: 300, grade: 300, fans: 1000 };
  const result = optimizeRaceSchedule({
    ...input,
    races: [giii, gi],
    endTurn: 1,
  });
  expect(result.steps[0].race?.id).toBe(300);
  expect(result.expectedFans).toBeCloseTo(220);
  const fixed = optimizeRaceSchedule({
    ...input,
    races: [giii, gi],
    endTurn: 1,
    fixedRaces: { 1: [100] },
  });
  expect(fixed.steps[0].race?.id).toBe(100);
});

test('jewels never trades away expected drops for a larger fan reward', () => {
  const highFans = { ...race, id: 100, fans: 30000 };
  const highDrops = {
    ...race,
    id: 300,
    grade: 300,
    distanceType: 'short' as const,
    fans: 3900,
  };
  const result = optimizeRaceSchedule({
    ...input,
    races: [highFans, highDrops],
    endTurn: 1,
    winRates: {
      '7:6': [0.9, 0.9, 0.9, 0.9, 0.9],
      '7:1': [1, 1, 1, 1, 1],
    },
  });
  expect(result.steps[0].race?.id).toBe(300);
  expect(result.expectedDrops).toBeCloseTo(0.05);
  expect(result.expectedFans).toBeCloseTo(3900 * 1.1);
});

test('jewels excludes OP and Pre-OP races on elective turns and gives zero drops on Debut and fixed OP goals while allowing SP races', () => {
  const debut = {
    ...race,
    id: 1,
    turn: 1,
    grade: 900,
    fans: 700,
    isCareerGoal: true,
  };
  const electiveOp = { ...race, id: 2, turn: 2, grade: 400, fans: 2500 };
  const electivePreOp = { ...race, id: 3, turn: 3, grade: 700, fans: 1000 };
  const spRace = { ...race, id: 4, turn: 4, grade: 1000, fans: 4000 };
  const fixedOpGoal = {
    ...race,
    id: 5,
    turn: 5,
    grade: 400,
    fans: 2000,
    isCareerGoal: true,
  };
  const g3AfterGoal = { ...race, id: 6, turn: 6, grade: 300, fans: 3800 };
  const result = optimizeRaceSchedule({
    ...input,
    startTurn: 1,
    endTurn: 6,
    races: [debut, electiveOp, electivePreOp, spRace, fixedOpGoal, g3AfterGoal],
    fixedRaces: { 1: [1], 5: [5] },
    winRates: { '7:6': [1, 1, 1, 1, 1] },
  });
  expect(result.steps.map((step) => step.race?.id ?? null)).toEqual([
    1,
    null,
    null,
    4,
    5,
    6,
  ]);
  expect(result.steps.map((step) => step.streak)).toEqual([1, 0, 0, 1, 2, 3]);
  // Only turn 4 (SP, streak 1 -> 0.05) and turn 6 (GIII, streak 3 -> 0.05) drop jewels; Debut (turn 1) and OP goal (turn 5) drop 0.
  expect(result.expectedDrops).toBeCloseTo(0.1);
});

test('jewels selects the highest-fan multi-turn schedule among distinct plans with equal maximum expected drops', () => {
  // Use win rates that make racing all 4 turns worse than taking one rest:
  // 0.05 + 0.05 + 0.8 * 0.05 + 0.7 * 0.01 = 0.147 drops.
  // [1, 2, rest, 4] and [1, rest, 3, 4] both achieve the strict maximum 0.15 drops;
  // resting on turn 2 instead of turn 3 preserves turn 3's 30,000-fan GI.
  const races = [
    { ...race, id: 1, turn: 1, grade: 200, fans: 5000 },
    { ...race, id: 2, turn: 2, grade: 200, fans: 6000 },
    { ...race, id: 3, turn: 3, grade: 100, fans: 30000 },
    { ...race, id: 4, turn: 4, grade: 100, fans: 10000 },
  ];
  const result = optimizeRaceSchedule({
    ...input,
    startTurn: 1,
    endTurn: 4,
    races,
    winRates: { '7:6': [1, 0.8, 0.7, 0.5, 0.3] },
  });
  expect(result.expectedDrops).toBeCloseTo(0.15);
  expect(result.steps.map((step) => step.race?.id ?? null)).toEqual([
    1,
    null,
    3,
    4,
  ]);
  expect(result.expectedFans).toBeCloseTo(45000 * 1.1);
});

test('jewel rankings prioritize fans when expected drops tie', () => {
  const entries = rankings.rankings.jewels;
  entries
    .slice(1)
    .map((entry, index) => ({ entry, previous: entries[index] }))
    .filter(
      ({ entry, previous }) =>
        Math.abs(entry.expectedDrops - previous.expectedDrops) <= 1e-9,
    )
    .forEach(({ entry, previous }) =>
      expect(previous.expectedFans + 1e-9).toBeGreaterThanOrEqual(
        entry.expectedFans,
      ),
    );
});

test('precomputed rankings cover every horse, match the catalog, and descend by each objective', () => {
  expect(rankings.masterSha256).toBe(PLANNER_CATALOG.masterSha256);
  expect(rankings.winRateModelVersion).toBe(REFERENCE_WIN_RATE_MODEL_VERSION);
  expect(rankings.jewelModelVersion).toBe(JEWEL_MODEL_VERSION);
  expect(rankings.fanModel).toEqual(FAN_MODEL);
  expect(rankings.gradeThreshold).toBe(100);
  const metrics = {
    fans: 'expectedFans',
    wins: 'expectedWins',
    jewels: 'expectedDrops',
  } as const;
  (Object.keys(metrics) as Array<keyof typeof metrics>).forEach((objective) => {
    const entries = rankings.rankings[objective];
    expect(entries.map((entry) => entry.charaId).sort()).toEqual(
      PLANNER_CATALOG.characters.map((character) => character.id).sort(),
    );
    // The optimizer treats sub-1e-9 floating point differences as ties.
    const values = entries.map((entry) =>
      Number(entry[metrics[objective]].toFixed(8)),
    );
    expect(values).toEqual([...values].sort((a, b) => b - a));
    entries.forEach((entry) => {
      expect(
        entry.demands.reduce((slots, demand) => slots + demand.slots, 0),
      ).toBeLessThanOrEqual(6);
      entry.demands.forEach((demand) => {
        expect(demand.target).toBeLessThanOrEqual(7);
        expect(demand.stars).toBe(
          [0, 1, 4, 7, 10][demand.target - demand.base],
        );
      });
    });
  });
});
