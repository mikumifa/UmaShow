import data from 'renderer/data/race_planner_data.json';
import { PlanningRace, Ground, Distance } from './raceScheduleOptimizer';

export type RaceProgram = Omit<PlanningRace, 'id' | 'turn'> & {
  ground: Ground;
  distanceType: Distance;
  thumbnailId: number;
  permission: number;
  month: number;
  half: number;
  baseId: number;
  programGroup: number;
};
export type CareerGoal = {
  id: number;
  turn: number;
  programIds: number[];
  conditionType: number;
  conditionId: number;
  value: number;
  value2: number;
};
export type GoalRoute = {
  id: number;
  charaId: number;
  scenarioId: number;
  goals: CareerGoal[];
};
export const PLANNER_CATALOG = data as unknown as {
  masterSha256: string;
  programs: Record<string, RaceProgram>;
  characters: Array<{
    id: number;
    name: string;
    aptitudes: Record<
      Ground | Distance | 'nige' | 'senko' | 'sashi' | 'oikomi',
      number
    >;
  }>;
  routes: GoalRoute[];
};

export const PLANNING_SCENARIOS = [
  { id: 1, name: 'URA总决赛', endTurn: 72, characterGoals: true },
  { id: 2, name: '青春杯', endTurn: 72, characterGoals: true },
  { id: 3, name: '闪耀舞台', endTurn: 72, characterGoals: true },
  { id: 4, name: '巅峰杯', endTurn: 72, characterGoals: false },
  { id: 5, name: '荣耀女神杯', endTurn: 72, characterGoals: true },
  { id: 6, name: '凯旋门', endTurn: 67, characterGoals: false },
] as const;

const YEAR_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [24],
  3: [24, 48],
  4: [48],
};

export function planningDate(turn: number) {
  const year = Math.floor((turn - 1) / 24);
  const month = Math.floor(((turn - 1) % 24) / 2) + 1;
  return `${['初级年', '经典年', '高级年'][year] || '决赛'} ${month}月${turn % 2 ? '上半' : '下半'}`;
}

export function planningRace(program: RaceProgram, turn: number): PlanningRace {
  return {
    ...program,
    turn,
    id: (Math.floor((turn - 1) / 24) + 1) * 100000 + program.programId,
  };
}

export function buildPlanningCalendar(
  charaId: number,
  scenarioId: number,
  routeId?: number,
) {
  const scenario =
    PLANNING_SCENARIOS.find((item) => item.id === scenarioId) ||
    PLANNING_SCENARIOS[0];
  const routes = PLANNER_CATALOG.routes.filter(
    (route) => route.scenarioId === 0 && route.charaId === charaId,
  );
  const characterRoute =
    routes.find((route) => route.id === routeId) || routes[0];
  const debut = characterRoute?.goals.find(
    (goal) => goal.conditionType === 1 && goal.programIds.length,
  );
  const scenarioRoute = PLANNER_CATALOG.routes.find(
    (route) => route.scenarioId === scenarioId && route.charaId === 0,
  );
  const goals =
    (scenario.characterGoals
      ? characterRoute?.goals
      : scenarioId === 6
        ? scenarioRoute?.goals
        : debut
          ? [debut]
          : []) || [];
  const blockedTurns =
    scenarioId === 6
      ? [37, 38, 39, 40, 41, 42, 43, 61, 62, 63, 64, 65, 66, 67]
      : [];
  const races = new Map<number, PlanningRace>();
  const startTurn = debut?.turn || 12;
  Object.values(PLANNER_CATALOG.programs).forEach((program) => {
    // Exclude debut/maiden pools, scenario-only races, and replacement programs
    // from freely selectable domestic races. Mandatory goals are added below.
    if (
      program.baseId ||
      program.programGroup ||
      program.programId >= 2000 ||
      ![100, 200, 300, 400, 700].includes(program.grade)
    )
      return;
    (YEAR_OFFSETS[program.permission] || []).forEach((offset) => {
      const turn = offset + (program.month - 1) * 2 + program.half;
      if (
        turn < startTurn ||
        turn > scenario.endTurn ||
        blockedTurns.includes(turn)
      )
        return;
      const race = planningRace(program, turn);
      races.set(race.id, race);
    });
  });
  const fixedRaces: Record<number, number[]> = {};
  const notes: string[] = [];
  const errors: string[] = [];
  const fixedLabels: Record<number, string> = {};
  if (!debut) errors.push('主数据库缺少这位马娘的出道赛目标，暂时无法规划。');
  goals
    .filter((goal) => goal.turn <= scenario.endTurn)
    .forEach((goal) => {
      const ids =
        goal.conditionType === 8 ? debut?.programIds || [] : goal.programIds;
      if (goal.conditionType === 1 || goal.conditionType === 8) {
        const candidates = ids.flatMap((id) => {
          const program = PLANNER_CATALOG.programs[String(id)];
          if (!program) return [];
          const race = planningRace(program, goal.turn);
          races.set(race.id, race);
          return [race.id];
        });
        if (!candidates.length)
          errors.push(`${planningDate(goal.turn)}的生涯目标比赛资料缺失。`);
        if (fixedRaces[goal.turn]) {
          fixedRaces[goal.turn] = fixedRaces[goal.turn].filter((id) =>
            candidates.includes(id),
          );
          if (!fixedRaces[goal.turn].length)
            errors.push(`${planningDate(goal.turn)}存在互斥的目标比赛。`);
        } else fixedRaces[goal.turn] = candidates;
        fixedLabels[goal.turn] = scenarioId === 6 ? '剧本目标' : '生涯目标';
      } else {
        const label =
          goal.conditionType === 3
            ? `粉丝达到 ${goal.value.toLocaleString()}`
            : goal.conditionType === 11
              ? `支持者点数达到 ${goal.value.toLocaleString()}`
              : `非固定赛目标（类型 ${goal.conditionType}，条件 ${goal.value}/${goal.value2}）`;
        notes.push(`${planningDate(goal.turn)}：${label}，需另行确认达成。`);
      }
    });
  return {
    scenario,
    races: [...races.values()].sort(
      (a, b) => a.turn - b.turn || a.programId - b.programId,
    ),
    fixedRaces,
    fixedLabels,
    blockedTurns,
    routes,
    notes,
    errors,
    startTurn,
  };
}
