import type {
  Dashboard,
  CareerSetting,
} from 'renderer/components/autoResearch/types';
import type {
  FactorKey,
  InheritanceTargets,
} from 'renderer/ui/SuccessionPlanner';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
  PLANNING_SCENARIOS,
} from './racePlannerCatalog';
import {
  optimizeRaceSchedule,
  PlanningAptitudes,
} from './raceScheduleOptimizer';
import { REFERENCE_WIN_RATES } from './raceWinRateModel';

export type OfflineDesign = {
  goal: 'breeding' | 'jewels' | 'fans';
  source: 'api' | 'custom';
  raceIds: number[];
  fixedIds: number[];
  routeId: number;
  inheritance: FactorKey[];
  targets: InheritanceTargets;
};
export const FACTOR_TYPES: Array<{
  key: FactorKey;
  group: number;
  label: string;
  icon: string;
}> = [
  { key: 'turf', group: 11, label: '草地', icon: 'turf' },
  { key: 'dirt', group: 12, label: '泥地', icon: 'dirt' },
  { key: 'short', group: 31, label: '短距离', icon: 'short' },
  { key: 'mile', group: 32, label: '英里', icon: 'mile' },
  { key: 'middle', group: 33, label: '中距离', icon: 'middle' },
  { key: 'long', group: 34, label: '长距离', icon: 'long' },
  { key: 'nige', group: 21, label: '领跑', icon: 'front' },
  { key: 'senko', group: 22, label: '跟前', icon: 'pace' },
  { key: 'sashi', group: 23, label: '居中', icon: 'late' },
  { key: 'oikomi', group: 24, label: '后追', icon: 'end' },
];
const STAR_THRESHOLDS = [0, 1, 4, 7, 10];
type Character = (typeof PLANNER_CATALOG.characters)[number];
type Parent = Dashboard['parents'][number];

export function normalizeOfflineDesign(
  value?: Partial<OfflineDesign>,
): OfflineDesign {
  const ids = (items?: number[]) =>
    Array.isArray(items)
      ? [...new Set(items.filter((id) => Number.isInteger(id) && id > 0))]
      : [];
  return {
    goal:
      value?.goal === 'jewels' || value?.goal === 'fans'
        ? value.goal
        : 'breeding',
    source: value?.source === 'custom' ? 'custom' : 'api',
    raceIds: ids(value?.raceIds),
    fixedIds: ids(value?.fixedIds),
    routeId: Number(value?.routeId) || 0,
    inheritance: Array.isArray(value?.inheritance)
      ? [
          ...new Set(
            value.inheritance.filter((key) =>
              FACTOR_TYPES.some((type) => type.key === key),
            ),
          ),
        ]
      : [],
    targets: value?.targets || {},
  };
}

export function offlineRaceRequest(design?: Partial<OfflineDesign>) {
  const config = normalizeOfflineDesign(design);
  return {
    race_source: config.source,
    ...(config.source === 'custom'
      ? {
          race_array: config.raceIds.map((id) => ({
            year: Math.floor(id / 100000),
            program_id: id % 100000,
          })),
        }
      : {}),
  };
}

export function offlineScheduleError(
  setting: Pick<
    CareerSetting,
    | 'offline_design'
    | 'offline_race_deck_num'
    | 'offline_scenario_id'
    | 'card_id'
  >,
): string {
  const design = normalizeOfflineDesign(setting.offline_design);
  if (design.source === 'api')
    return setting.offline_race_deck_num ? '' : '请选择一个游戏赛程槽位';
  if (!setting.offline_scenario_id) return '自定义赛程请先选择育成剧本';
  if (
    !PLANNING_SCENARIOS.some(
      (scenario) => scenario.id === setting.offline_scenario_id,
    )
  )
    return '当前剧本暂无本地赛历，请选择其他剧本或读取游戏 API';
  const calendar = buildPlanningCalendar(
    Math.floor(setting.card_id / 100),
    setting.offline_scenario_id,
    design.routeId,
  );
  if (calendar.errors.length) return calendar.errors[0];
  if (design.fixedIds.some((id) => !design.raceIds.includes(id)))
    return '赛程未包含手动固定比赛，请重新设计或补齐参赛计划';
  const turns = new Set<number>();
  for (const id of design.raceIds) {
    const race = calendar.races.find((item) => item.id === id);
    if (!race || calendar.blockedTurns.includes(race.turn))
      return '赛程含当前马娘或剧本不可用的比赛，请重新设计';
    if (calendar.fixedRaces[race.turn])
      return '自定义赛程与生涯目标冲突，请重新设计';
    if (turns.has(race.turn)) return '同一回合只能安排一场比赛';
    turns.add(race.turn);
  }
  return '';
}

export function inheritanceDemands(
  character: Character,
  design: OfflineDesign,
) {
  return design.inheritance.map((key) => {
    const type = FACTOR_TYPES.find((item) => item.key === key)!;
    const base = character.aptitudes[key];
    const target =
      base >= 7
        ? base
        : Math.max(base + 1, Number(design.targets[key]) || base + 1);
    const stars = base >= 7 ? 1 : STAR_THRESHOLDS[target - base];
    return { ...type, base, target, stars: stars ?? Infinity };
  });
}

/** All distinct ways to split required 3-star red slots over two lineages.
 * Each side has one parent and two ancestors; remaining red slots are free.
 */
export function recommendOfflineLineages(
  demands: ReturnType<typeof inheritanceDemands>,
) {
  type Slot = { label: string; count: number };
  const plans: Array<{ first: Slot[]; second: Slot[] }> = [];
  const seen = new Set<string>();
  const visit = (
    index: number,
    first: Slot[],
    second: Slot[],
    left: number,
    right: number,
  ) => {
    if (index === demands.length) {
      const key = [JSON.stringify(first), JSON.stringify(second)]
        .sort()
        .join('|');
      if (seen.has(key)) return;
      seen.add(key);
      plans.push({
        first: [
          ...first,
          ...(left ? [{ label: '其他红因子', count: left }] : []),
        ],
        second: [
          ...second,
          ...(right ? [{ label: '其他红因子', count: right }] : []),
        ],
      });
      return;
    }
    const demand = demands[index];
    const count = Math.ceil(demand.stars / 3);
    for (
      let a = Math.max(0, count - right);
      a <= Math.min(count, left);
      a += 1
    ) {
      const b = count - a;
      visit(
        index + 1,
        [...first, ...(a ? [{ label: demand.label, count: a }] : [])],
        [...second, ...(b ? [{ label: demand.label, count: b }] : [])],
        left - a,
        right - b,
      );
    }
  };
  visit(0, [], [], 3, 3);
  return plans;
}

function parentStars(parent: Parent) {
  const red: Record<number, number> = {};
  let blue = 0;
  // Each parent and its two ancestors contributes once (six slots per pair).
  [parent, ...parent.ancestors].forEach((slot) => {
    slot.factors.forEach((factor) => {
      if (FACTOR_TYPES.some((type) => type.group === factor.factor_group_id))
        red[factor.factor_group_id] =
          (red[factor.factor_group_id] || 0) + factor.stars;
      else if (factor.factor_type === 1 || factor.category === 'stat')
        blue += factor.stars;
    });
  });
  return { red, blue, redTotal: Object.values(red).reduce((a, b) => a + b, 0) };
}

export function chooseOfflineParents(
  character: Character,
  design: OfflineDesign,
  parents: Parent[],
) {
  const demands = inheritanceDemands(character, design);
  const candidates = parents
    .filter(
      (parent) =>
        parent.chara_id !== character.id &&
        (parent.source === 'own' ||
          parent.friend_state === undefined ||
          [1, 3].includes(parent.friend_state)),
    )
    .map((parent) => ({ parent, ...parentStars(parent) }));
  let best:
    | {
        parents: [Parent, Parent];
        red: Record<number, number>;
        blue: number;
        redTotal: number;
        score: number;
      }
    | undefined;
  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i];
    for (let j = i + 1; j < candidates.length; j += 1) {
      const b = candidates[j];
      if (
        a.parent.chara_id === b.parent.chara_id ||
        a.parent.selection_id === b.parent.selection_id ||
        (a.parent.source === 'rental' && b.parent.source === 'rental')
      )
        continue;
      if (
        !demands.every(
          (demand) =>
            (a.red[demand.group] || 0) + (b.red[demand.group] || 0) >=
            demand.stars,
        )
      )
        continue;
      const blue = a.blue + b.blue;
      const redTotal = a.redTotal + b.redTotal;
      const score = blue + redTotal;
      if (
        best &&
        (score < best.score || (score === best.score && blue <= best.blue))
      )
        continue;
      const red = Object.fromEntries(
        FACTOR_TYPES.map((type) => [
          type.group,
          (a.red[type.group] || 0) + (b.red[type.group] || 0),
        ]),
      );
      best = { parents: [a.parent, b.parent], red, blue, redTotal, score };
    }
  }
  return { best, demands };
}

/** One-click orchestration. Schedule optimization remains in raceScheduleOptimizer. */
export function designOfflineCareer(
  character: Character,
  design: OfflineDesign,
  parents: Parent[],
) {
  const calendar = buildPlanningCalendar(character.id, 5, design.routeId);
  if (calendar.errors.length) throw new Error(calendar.errors[0]);
  const { best, demands } = chooseOfflineParents(character, design, parents);
  if (demands.reduce((sum, demand) => sum + Math.ceil(demand.stars / 3), 0) > 6)
    throw new Error('适应性改造超过 6 个因子槽位，请减少目标');
  const aptitudes = { ...character.aptitudes };
  if (best) {
    FACTOR_TYPES.forEach(({ key, group }) => {
      const stars = best.red[group] || 0;
      const raise =
        STAR_THRESHOLDS.filter((threshold) => threshold <= stars).length - 1;
      aptitudes[key] = Math.max(
        aptitudes[key],
        Math.min(7, aptitudes[key] + raise),
      );
    });
  } else
    demands.forEach((demand) => {
      aptitudes[demand.key] = demand.target;
    });
  const fixedRaces = { ...calendar.fixedRaces };
  design.fixedIds.forEach((id) => {
    const race = calendar.races.find((item) => item.id === id);
    if (!race || (fixedRaces[race.turn] && !fixedRaces[race.turn].includes(id)))
      throw new Error('固定比赛与女神杯生涯目标冲突，请调整');
    fixedRaces[race.turn] = [id];
  });
  const schedule = optimizeRaceSchedule({
    races: calendar.races,
    startTurn: calendar.startTurn,
    endTurn: calendar.scenario.endTurn,
    aptitudes: aptitudes as PlanningAptitudes,
    winRates: REFERENCE_WIN_RATES,
    objective: design.goal === 'jewels' ? 'jewels' : 'fans',
    gradeThreshold: 300,
    fanBonusPercent: 0,
    fixedRaces,
    blockedTurns: calendar.blockedTurns,
    restTurns: [],
  });
  if (schedule.error) throw new Error(schedule.error);
  const raceIds = schedule.steps.flatMap((step) =>
    step.race && !calendar.fixedRaces[step.turn] ? [step.race.id] : [],
  );
  return { best, demands, schedule, raceIds, notes: calendar.notes };
}
