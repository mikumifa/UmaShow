/** Core schedule optimizer. Pure functions: no React, storage or game API.
 *
 * F(t, streak) is the best expected return after turn t. Rest resets streak;
 * racing advances it, capped at 6 because the supplied model is constant at 6+.
 * Forced races remove the rest transition. Backpointers recover the full plan.
 * Complexity: O(turns * 7 * racesPerTurn); no greedy decisions or beam pruning.
 *
 * Reference: https://tma.main.jp/uma/maximize_fan_independent_training.php
 * Fans use P(win) * winnerFans * support bonus * 1.10 empirical correction.
 * Non-race scenario fans are currently zero.
 * This model does not simulate fan-entry gates or non-race career objectives.
 */
/* eslint-disable no-restricted-syntax, no-continue */
import { expectedJewelDrops, SCENARIO_RACE_DROP_RATE } from './raceJewelModel';

export const FAN_MODEL = {
  empiricalCorrection: 1.1,
  nonRaceScenarioFans: 0,
} as const;

export type Ground = 'turf' | 'dirt';
export type Distance = 'short' | 'mile' | 'middle' | 'long';
export type PlanningAptitudes = Record<Ground | Distance, number>;
export type PlanningRace = {
  id: number;
  programId: number;
  turn: number;
  name: string;
  grade: number;
  ground: Ground;
  distanceType: Distance;
  distance: number;
  fans: number;
  requiredFans: number;
  /** Career goals ignore streak penalties when looking up win probability. */
  isCareerGoal?: boolean;
};
export type WinRates = Record<string, ReadonlyArray<number | null>>;
export type AutomaticPlanningRace = {
  turn: number;
  name: string;
  fans: number;
};
export type AutomaticRaceStep = AutomaticPlanningRace & {
  expectedFans: number;
  totalExpectedFans: number;
  totalExpectedWins: number;
  expectedDrops: number;
};
export type ScheduleInput = {
  races: readonly PlanningRace[];
  automaticRaces?: readonly AutomaticPlanningRace[];
  startTurn: number;
  endTurn: number;
  aptitudes: PlanningAptitudes;
  winRates: WinRates;
  objective: 'fans' | 'wins' | 'jewels';
  gradeThreshold: 100 | 200 | 300;
  fanBonusPercent: number;
  fixedRaces: Readonly<Record<number, readonly number[]>>;
  blockedTurns: readonly number[];
  restTurns: readonly number[];
};
export type ScheduleStep = {
  turn: number;
  race: PlanningRace | null;
  fixed: boolean;
  streak: number;
  winProbability: number;
  expectedFans: number;
  totalExpectedFans: number;
  totalExpectedWins: number;
};
export type ScheduleResult = {
  steps: ScheduleStep[];
  automaticRaces: AutomaticRaceStep[];
  expectedFans: number;
  expectedWins: number;
  expectedGradeWins: Record<100 | 200 | 300, number>;
  expectedDrops: number;
  raceCount: number;
  missingRatePairs: string[];
  error?: string;
};

type ScheduleScore = Pick<
  ScheduleResult,
  'expectedFans' | 'expectedWins' | 'expectedDrops' | 'expectedGradeWins'
>;

/** Jewels prioritize drops, then fans; grade preference breaks remaining ties. */
export function compareScheduleScores(
  candidate: ScheduleScore,
  current: ScheduleScore,
  objective: ScheduleInput['objective'],
) {
  const metric = {
    jewels: 'expectedDrops',
    fans: 'expectedFans',
    wins: 'expectedWins',
  } as const;
  const primary = candidate[metric[objective]] - current[metric[objective]];
  if (Math.abs(primary) > 1e-9) return primary;
  if (objective === 'jewels') {
    const fans = candidate.expectedFans - current.expectedFans;
    if (Math.abs(fans) > 1e-9) return fans;
  }
  for (const grade of [100, 200, 300] as const) {
    const difference =
      candidate.expectedGradeWins[grade] - current.expectedGradeWins[grade];
    if (Math.abs(difference) > 1e-9) return difference;
  }
  const secondary = objective === 'fans' ? 'expectedWins' : 'expectedFans';
  return candidate[secondary] - current[secondary];
}

export function rateKey(groundRank: number, distanceRank: number): string {
  // S has the same estimated win rate as A in the reference data.
  return `${Math.min(7, groundRank)}:${Math.min(7, distanceRank)}`;
}

export function streakBucket(streak: number): number {
  return Math.max(0, Math.min(4, streak - 2));
}

export function raceWinProbability(
  race: PlanningRace,
  streak: number,
  aptitudes: PlanningAptitudes,
  rates: WinRates,
): number | null {
  const value =
    rates[rateKey(aptitudes[race.ground], aptitudes[race.distanceType])]?.[
      streakBucket(race.isCareerGoal ? 1 : streak)
    ];
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

type Node = ScheduleScore & {
  count: number;
  streak: number;
  previous: Node | null;
  step: ScheduleStep | null;
};

function better(
  candidate: Node,
  current: Node | undefined,
  objective: ScheduleInput['objective'],
) {
  if (!current) return true;
  const score = compareScheduleScores(candidate, current, objective);
  if (Math.abs(score) > 1e-9) return score > 0;
  return candidate.count < current.count;
}

export function optimizeRaceSchedule(input: ScheduleInput): ScheduleResult {
  const empty = (error: string): ScheduleResult => ({
    steps: [],
    automaticRaces: [],
    expectedFans: 0,
    expectedWins: 0,
    expectedGradeWins: { 100: 0, 200: 0, 300: 0 },
    expectedDrops: 0,
    raceCount: 0,
    missingRatePairs: [],
    error,
  });
  if (
    !Number.isInteger(input.startTurn) ||
    !Number.isInteger(input.endTurn) ||
    input.startTurn < 1 ||
    input.endTurn < input.startTurn ||
    input.endTurn > 100
  ) {
    return empty('规划回合范围无效。');
  }
  if (!Number.isFinite(input.fanBonusPercent) || input.fanBonusPercent < 0)
    return empty('粉丝加成必须是非负数。');
  const fanMultiplier =
    (1 + input.fanBonusPercent / 100) * FAN_MODEL.empiricalCorrection;
  const byTurn = new Map<number, PlanningRace[]>();
  const seen = new Set<number>();
  for (const race of input.races) {
    if (seen.has(race.id))
      return empty(`比赛 ID ${race.id} 重复，请检查赛程数据。`);
    seen.add(race.id);
    if (
      !Number.isInteger(race.turn) ||
      !Number.isFinite(race.fans) ||
      race.fans < 0
    )
      return empty(`比赛 ${race.name} 的回合或粉丝奖励无效。`);
    if (race.turn < input.startTurn || race.turn > input.endTurn) continue;
    const races = byTurn.get(race.turn) || [];
    races.push(race);
    byTurn.set(race.turn, races);
  }
  const blocked = new Set(input.blockedTurns);
  const rest = new Set(input.restTurns);
  for (const [rawTurn, ids] of Object.entries(input.fixedRaces)) {
    const turn = Number(rawTurn);
    if (turn < input.startTurn || turn > input.endTurn)
      return empty(`第 ${turn} 回合的固定比赛超出剧本范围。`);
    if (rest.has(turn)) return empty(`第 ${turn} 回合同时固定了比赛和休息。`);
    if (
      !ids.length ||
      !ids.every((id) => byTurn.get(turn)?.some((race) => race.id === id))
    )
      return empty(`第 ${turn} 回合的固定比赛不存在或日期不匹配。`);
  }
  const missing = new Set<string>();
  let frontier = new Map<number, Node>([
    [
      0,
      {
        expectedFans: 0,
        expectedWins: 0,
        expectedDrops: 0,
        expectedGradeWins: { 100: 0, 200: 0, 300: 0 },
        count: 0,
        streak: 0,
        previous: null,
        step: null,
      },
    ],
  ]);
  for (let turn = input.startTurn; turn <= input.endTurn; turn += 1) {
    const next = new Map<number, Node>();
    const fixedIds = input.fixedRaces[turn];
    const candidates = (byTurn.get(turn) || []).filter((race) =>
      fixedIds
        ? fixedIds.includes(race.id)
        : !blocked.has(turn) && !rest.has(turn),
    );
    const accept = (node: Node) => {
      if (better(node, next.get(node.streak), input.objective))
        next.set(node.streak, node);
    };
    for (const previous of frontier.values()) {
      if (!fixedIds)
        accept({
          ...previous,
          streak: 0,
          previous,
          step: {
            turn,
            race: null,
            fixed: false,
            streak: 0,
            winProbability: 0,
            expectedFans: 0,
            totalExpectedFans: previous.expectedFans,
            totalExpectedWins: previous.expectedWins,
          },
        });
      for (const race of candidates) {
        const streak = Math.min(6, previous.streak + 1);
        const probability = raceWinProbability(
          race,
          streak,
          input.aptitudes,
          input.winRates,
        );
        if (probability === null) {
          missing.add(
            rateKey(
              input.aptitudes[race.ground],
              input.aptitudes[race.distanceType],
            ),
          );
          continue;
        }
        const expectedFans = race.fans * probability * fanMultiplier;
        const fans = previous.expectedFans + expectedFans;
        const wins =
          previous.expectedWins +
          (race.grade >= 100 && race.grade <= input.gradeThreshold
            ? probability
            : 0);
        const expectedGradeWins = { ...previous.expectedGradeWins };
        if (race.grade === 100 || race.grade === 200 || race.grade === 300)
          expectedGradeWins[race.grade] += probability;
        accept({
          expectedFans: fans,
          expectedWins: wins,
          expectedDrops:
            previous.expectedDrops + expectedJewelDrops(probability, streak),
          expectedGradeWins,
          count: previous.count + 1,
          streak,
          previous,
          step: {
            turn,
            race,
            fixed: !!fixedIds,
            streak,
            winProbability: probability,
            expectedFans,
            totalExpectedFans: fans,
            totalExpectedWins: wins,
          },
        });
      }
    }
    if (!next.size)
      return {
        ...empty(`第 ${turn} 回合无法安排固定比赛，请补齐该适应性组合的胜率。`),
        missingRatePairs: [...missing],
      };
    frontier = next;
  }
  let best: Node | undefined;
  for (const node of frontier.values())
    if (better(node, best, input.objective)) best = node;
  const steps: ScheduleStep[] = [];
  for (let cursor = best; cursor?.step; cursor = cursor.previous || undefined)
    steps.push(cursor.step);
  steps.reverse();
  // Keep the real streak in output; only the DP state is capped at 6.
  let actualStreak = 0;
  let automaticFans = 0;
  let automaticWins = 0;
  const automaticRaces: AutomaticRaceStep[] = [];
  steps.forEach((step) => {
    actualStreak = step.race ? actualStreak + 1 : 0;
    step.streak = actualStreak;
    step.totalExpectedFans += automaticFans;
    step.totalExpectedWins += automaticWins;
    let turnFans = step.totalExpectedFans;
    let turnWins = step.totalExpectedWins;
    // Goddess year-end races happen after the regular turn. Their fixed
    // returns cannot change the optimal path or advance/reset its race streak.
    for (const race of input.automaticRaces || []) {
      if (race.turn !== step.turn) continue;
      const expectedFans = race.fans * fanMultiplier;
      automaticFans += expectedFans;
      automaticWins += 1;
      turnFans += expectedFans;
      turnWins += 1;
      automaticRaces.push({
        ...race,
        expectedFans,
        totalExpectedFans: turnFans,
        totalExpectedWins: turnWins,
        expectedDrops: SCENARIO_RACE_DROP_RATE,
      });
    }
  });
  return {
    steps,
    automaticRaces,
    expectedFans:
      (best?.expectedFans || 0) + automaticFans + FAN_MODEL.nonRaceScenarioFans,
    expectedWins: (best?.expectedWins || 0) + automaticWins,
    expectedGradeWins: best?.expectedGradeWins || { 100: 0, 200: 0, 300: 0 },
    expectedDrops:
      (best?.expectedDrops || 0) +
      automaticRaces.length * SCENARIO_RACE_DROP_RATE,
    raceCount: best?.count || 0,
    missingRatePairs: [...missing],
  };
}
