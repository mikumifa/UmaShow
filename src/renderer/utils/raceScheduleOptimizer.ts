/** Core schedule optimizer. Pure functions: no React, storage or game API.
 *
 * F(t, streak) is the best expected return after turn t. Rest resets streak;
 * racing advances it, capped at 6 because the supplied model is constant at 6+.
 * Forced races remove the rest transition. Backpointers recover the full plan.
 * Complexity: O(turns * 7 * racesPerTurn); no greedy decisions or beam pruning.
 *
 * Reference: https://tma.main.jp/uma/maximize_fan_independent_training.php
 * Fans use P(win) * winnerFans; non-winning prizes are approximated as zero.
 * This model does not simulate fan-entry gates or non-race career objectives.
 */
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
};
export type WinRates = Record<string, ReadonlyArray<number | null>>;
export type ScheduleInput = {
  races: readonly PlanningRace[];
  startTurn: number;
  endTurn: number;
  aptitudes: PlanningAptitudes;
  winRates: WinRates;
  objective: 'fans' | 'wins';
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
  expectedFans: number;
  expectedWins: number;
  raceCount: number;
  missingRatePairs: string[];
  error?: string;
};

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
      streakBucket(streak)
    ];
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

type Node = {
  fans: number;
  wins: number;
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
  const primary =
    objective === 'fans'
      ? candidate.fans - current.fans
      : candidate.wins - current.wins;
  if (Math.abs(primary) > 1e-9) return primary > 0;
  const secondary =
    objective === 'fans'
      ? candidate.wins - current.wins
      : candidate.fans - current.fans;
  if (Math.abs(secondary) > 1e-9) return secondary > 0;
  return candidate.count < current.count;
}

export function optimizeRaceSchedule(input: ScheduleInput): ScheduleResult {
  const empty = (error: string): ScheduleResult => ({
    steps: [],
    expectedFans: 0,
    expectedWins: 0,
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
    [0, { fans: 0, wins: 0, count: 0, streak: 0, previous: null, step: null }],
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
            totalExpectedFans: previous.fans,
            totalExpectedWins: previous.wins,
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
        const expectedFans =
          race.fans * probability * (1 + input.fanBonusPercent / 100);
        const fans = previous.fans + expectedFans;
        const wins =
          previous.wins +
          (race.grade >= 100 && race.grade <= input.gradeThreshold
            ? probability
            : 0);
        accept({
          fans,
          wins,
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
  steps.forEach((step) => {
    actualStreak = step.race ? actualStreak + 1 : 0;
    step.streak = actualStreak;
  });
  return {
    steps,
    expectedFans: best?.fans || 0,
    expectedWins: best?.wins || 0,
    raceCount: best?.count || 0,
    missingRatePairs: [...missing],
  };
}
