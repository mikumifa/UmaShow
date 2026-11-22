import { buildPlanningCalendar, PLANNER_CATALOG } from './racePlannerCatalog';
import type { PlanningRace } from './raceScheduleOptimizer';
import { designSaddleSchedule } from './saddleSchedule';

const ranks = { turf: 7, dirt: 1, short: 7, mile: 7, middle: 5, long: 7 };
function race(
  turn: number,
  id: number,
  saddleId?: number,
  goal = false,
): PlanningRace {
  return {
    turn,
    id,
    saddleId,
    programId: id,
    name: String(id),
    grade: 100,
    ground: 'turf',
    distanceType: 'middle',
    distance: 2000,
    fans: 0,
    requiredFans: 0,
    isCareerGoal: goal,
  };
}
function calendar(
  races: PlanningRace[],
  fixedRaces: Record<number, number[]> = {},
) {
  return { races, fixedRaces, errors: [], blockedTurns: [] };
}

test('takes a different saddle this year when a later career goal awards the same saddle', () => {
  const result = designSaddleSchedule(
    calendar([race(36, 1, 12), race(36, 2, 17), race(60, 3, 12, true)], {
      60: [3],
    }),
    ranks,
  );
  expect(result.raceIds).toEqual([2]);
  expect(result.expectedSaddles).toBeCloseTo(1.9);
});

test('two independent 90% attempts earn 0.99 expected medals, two certain attempts need only one start', () => {
  const plan = calendar([race(30, 1, 10), race(54, 2, 10)]);
  expect(designSaddleSchedule(plan, ranks).expectedSaddles).toBeCloseTo(0.99);
  expect(
    designSaddleSchedule(plan, { ...ranks, middle: 7 }).raceIds,
  ).toHaveLength(1);
});

test('mandatory starts affect the next streak even without a saddle, and a blocked date is unavailable', () => {
  const plan = calendar(
    [race(1, 1), race(2, 2), race(3, 3, 10), race(5, 4, 11)],
    { 1: [1], 2: [2] },
  );
  const scoped = { ...plan, blockedTurns: [5] };
  expect(designSaddleSchedule(scoped, ranks).expectedSaddles).toBeCloseTo(0.85);
  expect(() => designSaddleSchedule(scoped, ranks, [4])).toThrow();
});

test('inherited dirt aptitude changes which race to choose before a repeated turf goal', () => {
  const plan = calendar([
    race(36, 1, 10),
    { ...race(36, 2, 11), ground: 'dirt' },
    race(60, 3, 10, true),
  ], { 60: [3] });
  const base = { ...ranks, middle: 4 };
  expect(designSaddleSchedule(plan, base).raceIds).toEqual([1]);
  expect(designSaddleSchedule(plan, { ...base, dirt: 7 }).raceIds).toEqual([2]);
});

test('leaves a date free when adding its saddle costs more expected wins in later goals', () => {
  const extra: PlanningRace = { ...race(3, 3, 10), ground: 'dirt', distanceType: 'long' };
  const plan = calendar(
    [race(1, 1), race(2, 2), extra, race(4, 4, 11, true), race(5, 5, 12, true)],
    { 1: [1], 2: [2], 4: [4], 5: [5] },
  );
  expect(designSaddleSchedule(plan, ranks)).toEqual({ raceIds: [], expectedSaddles: 2 });
  expect(designSaddleSchedule(plan, ranks, [3]).expectedSaddles).toBeLessThan(2);
});

test('moves an equally valuable saddle to the other year to break a streak', () => {
  const plan = calendar([race(31, 1, 10), race(32, 2, 11, true), race(55, 3, 10)], { 32: [2] });
  expect(designSaddleSchedule(plan, { ...ranks, middle: 7 })).toEqual({
    raceIds: [3], expectedSaddles: 2,
  });
});

test('Kitasan Black earns slightly more expected distinct saddles by keeping the seven-start finish', () => {
  const plan = buildPlanningCalendar(1068, 5);
  const inherited = { turf: 7, dirt: 4, short: 3, mile: 6, middle: 7, long: 7 };
  const best = designSaddleSchedule(plan, inherited);
  expect(best.expectedSaddles).toBeCloseTo(20.82);
  const optionalFinish = [66, 67, 69, 71];
  const turns = plan.races.filter((r) => best.raceIds.includes(r.id)).map((r) => r.turn);
  expect(turns).toEqual(expect.arrayContaining(optionalFinish));
  const withBreak = optionalFinish.map((turn) =>
    designSaddleSchedule({ ...plan, blockedTurns: [...plan.blockedTurns, turn] }, inherited),
  );
  expect(Math.max(...withBreak.map((result) => result.expectedSaddles))).toBeCloseTo(20.75);
});

test('two Arc career goals award distinct medals even though they match the same inheritance group', () => {
  const plan = buildPlanningCalendar(1001, 6);
  const goals = plan.races.filter(
    (r) =>
      r.isCareerGoal &&
      r.saddleId &&
      PLANNER_CATALOG.saddleGroups[r.saddleId] === 168,
  );
  expect(goals.map((r) => r.saddleId)).toEqual([185, 186]);
  const fixed = Object.fromEntries(goals.map((r) => [r.turn, [r.id]]));
  expect(designSaddleSchedule(calendar(goals, fixed), ranks)).toEqual({
    raceIds: [],
    expectedSaddles: 2,
  });
});
