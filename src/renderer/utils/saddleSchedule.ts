import type { buildPlanningCalendar } from './racePlannerCatalog';
import {
  raceWinProbability,
  type PlanningAptitudes,
  type PlanningRace,
} from './raceScheduleOptimizer';
import { REFERENCE_WIN_RATES } from './raceWinRateModel';

type Calendar = Pick<
  ReturnType<typeof buildPlanningCalendar>,
  'races' | 'fixedRaces' | 'blockedTurns' | 'errors'
>;
type Entry = { id: number; saddleId: number; probabilities: number[] };
type Slot = {
  turn: number;
  required: boolean;
  careerGoal: boolean;
  entries: Entry[];
};

function raceEntry(race: PlanningRace, aptitudes: PlanningAptitudes): Entry {
  const probabilities = Array.from({ length: 6 }, (_, i) => {
    const rate = raceWinProbability(
      race,
      i + 1,
      aptitudes,
      REFERENCE_WIN_RATES,
    );
    if (rate === null) throw new Error(`缺少「${race.name}」的离线胜率`);
    return rate;
  });
  return { id: race.id, saddleId: race.saddleId || 0, probabilities };
}

// Consecutive turns share a streak. Occurrences of a saddle share the
// probability of already owning it. All other components can be solved independently.
function connectedSlots(slots: Map<number, Slot>) {
  const bySaddle = new Map<number, number[]>();
  for (const slot of slots.values()) {
    for (const { saddleId } of slot.entries) {
      if (!saddleId) continue;
      if (!bySaddle.has(saddleId)) bySaddle.set(saddleId, []);
      bySaddle.get(saddleId)!.push(slot.turn);
    }
  }
  const components: Slot[][] = [];
  const visited = new Set<number>();
  for (const turn of slots.keys()) {
    if (visited.has(turn)) continue;
    const component: Slot[] = [];
    const pending = [turn];
    while (pending.length) {
      const t = pending.pop()!;
      const slot = slots.get(t);
      if (!slot || visited.has(t)) continue;
      visited.add(t);
      component.push(slot);
      pending.push(t - 1, t + 1);
      for (const { saddleId } of slot.entries)
        pending.push(...(bySaddle.get(saddleId) || []));
    }
    components.push(component.sort((a, b) => a.turn - b.turn));
  }
  return components;
}

function solveComponent(slots: Slot[]) {
  const failure = new Map<number, number>();
  const selected: number[] = [];
  let best = { score: -1, ids: [] as number[], streakCost: 0 };
  // One race per turn, even if all alternatives could win with certainty.
  const remaining = Array<number>(slots.length + 1).fill(0);
  for (let i = slots.length - 1; i >= 0; i--) {
    remaining[i] =
      remaining[i + 1] +
      Math.max(
        0,
        ...slots[i].entries.map((entry) =>
          entry.saddleId ? entry.probabilities[0] : 0,
        ),
      );
  }
  function visit(i: number, streak: number, score: number, streakCost: number) {
    if (score + remaining[i] < best.score - 1e-10) return;
    if (i === slots.length) {
      if (
        score > best.score + 1e-10 ||
        (Math.abs(score - best.score) <= 1e-10 &&
          (selected.length < best.ids.length ||
            (selected.length === best.ids.length && streakCost < best.streakCost)))
      ) {
        best = { score, ids: [...selected], streakCost };
      }
      return;
    }
    const { turn, entries, required, careerGoal } = slots[i];
    const nextStreak =
      i > 0 && turn === slots[i - 1].turn + 1 ? streak + 1 : 1;
    for (const { id, saddleId, probabilities } of entries) {
      const probability = probabilities[Math.min(nextStreak, probabilities.length) - 1];
      const miss = failure.get(saddleId) ?? 1;
      const gain = saddleId ? miss * probability : 0;
      if (!required && gain === 0) continue;
      if (saddleId) failure.set(saddleId, miss - gain);
      if (!careerGoal) selected.push(id);
      // Equal rewards and start counts favor shorter runs across both years.
      visit(i + 1, nextStreak, score + gain, streakCost + nextStreak - 1);
      if (!careerGoal) selected.pop();
      if (saddleId) failure.set(saddleId, miss);
    }
    if (!required) visit(i + 1, 0, score, streakCost);
  }
  visit(0, 0, 0, 0);
  return best;
}

/** Maximize the sum of P(at least one win) over distinct G1 saddle IDs. */
export function designSaddleSchedule(
  calendar: Calendar,
  aptitudes: PlanningAptitudes,
  fixedExtraIds: readonly number[] = [],
  onlyFixed = false,
) {
  if (calendar.errors.length) throw new Error(calendar.errors[0]);
  const byId = new Map(calendar.races.map((race) => [race.id, race]));
  const locked = new Map<number, number>();
  for (const id of fixedExtraIds) {
    const race = byId.get(id);
    if (
      !race ||
      calendar.fixedRaces[race.turn] ||
      calendar.blockedTurns.includes(race.turn) ||
      (locked.has(race.turn) && locked.get(race.turn) !== id)
    ) {
      throw new Error('固定比赛与当前马娘或剧本赛程冲突');
    }
    locked.set(race.turn, id);
  }
  const slots = new Map<number, Slot>();
  for (const race of calendar.races) {
    const goals = calendar.fixedRaces[race.turn];
    const fixed = locked.get(race.turn);
    if (
      goals
        ? !goals.includes(race.id)
        : calendar.blockedTurns.includes(race.turn)
    )
      continue;
    if (fixed && race.id !== fixed) continue;
    if (!goals && !fixed && (onlyFixed || !race.saddleId)) continue;
    let slot = slots.get(race.turn);
    if (!slot) {
      slot = {
        turn: race.turn,
        required: Boolean(goals || fixed),
        careerGoal: Boolean(goals),
        entries: [],
      };
      slots.set(race.turn, slot);
    }
    slot.entries.push(raceEntry(race, aptitudes));
  }
  // A goal can have several game-assigned venue variants. Their IDs are
  // interchangeable only for this conservative estimate: assume overlapping
  // variants repeat the same medal, and use the least favorable course rate.
  const variantReward = new Map<number, number>();
  for (const slot of slots.values()) {
    if (
      slot.careerGoal &&
      slot.entries.length > 1 &&
      slot.entries.every((entry) => entry.saddleId)
    ) {
      const shared = Math.min(...slot.entries.map((entry) => entry.saddleId));
      slot.entries.forEach((entry) =>
        variantReward.set(entry.saddleId, shared),
      );
    }
  }
  for (const slot of slots.values()) {
    for (const entry of slot.entries)
      entry.saddleId = variantReward.get(entry.saddleId) ?? entry.saddleId;
    if (!slot.careerGoal || slot.entries.length < 2) continue;
    const first = slot.entries[0];
    slot.entries = [
      {
        ...first,
        saddleId: slot.entries.every(
          (entry) => entry.saddleId === first.saddleId,
        )
          ? first.saddleId
          : 0,
        probabilities: first.probabilities.map((_, i) =>
          Math.min(...slot.entries.map((entry) => entry.probabilities[i])),
        ),
      },
    ];
  }
  const components = connectedSlots(slots).map(solveComponent);
  return {
    expectedSaddles: components.reduce(
      (sum, component) => sum + component.score,
      0,
    ),
    raceIds: components
      .flatMap((component) => component.ids)
      .sort((a, b) => byId.get(a)!.turn - byId.get(b)!.turn),
  };
}
