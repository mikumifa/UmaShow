import {
  optimizeRaceSchedule,
  compareScheduleScores,
  PlanningAptitudes,
  ScheduleInput,
} from './raceScheduleOptimizer';

const APTITUDES = ['turf', 'dirt', 'short', 'mile', 'middle', 'long'] as const;
const STAR_THRESHOLDS = [0, 1, 4, 7, 10];
export type RaceInheritanceDemand = {
  type: (typeof APTITUDES)[number];
  base: number;
  target: number;
  stars: number;
  slots: number;
};

/** Compare all initial aptitude upgrades that fit six red-factor slots.
 * Each slot contributes at most three stars. Initial inheritance raises a rank
 * at 1/4/7/10 stars, up to four ranks and at most A; no mid-career RNG assumed.
 */
export function recommendRaceInheritance(input: ScheduleInput) {
  let best = {
    aptitudes: { ...input.aptitudes },
    demands: [] as RaceInheritanceDemand[],
    slots: 0,
    stars: 0,
    schedule: optimizeRaceSchedule(input),
  };
  const aptitudes: PlanningAptitudes = { ...input.aptitudes };
  const demands: RaceInheritanceDemand[] = [];
  const relevant = new Set(
    input.races.flatMap((race) => [race.ground, race.distanceType]),
  );
  const visit = (index: number, slots: number, stars: number) => {
    if (index === APTITUDES.length) {
      if (!slots) return;
      const schedule = optimizeRaceSchedule({ ...input, aptitudes });
      if (schedule.error) return;
      const score = compareScheduleScores(
        schedule,
        best.schedule,
        input.objective,
      );
      const tied = Math.abs(score) <= 1e-9;
      if (
        best.schedule.error ||
        score > 1e-9 ||
        (tied &&
          (slots < best.slots || (slots === best.slots && stars < best.stars)))
      ) {
        best = {
          aptitudes: { ...aptitudes },
          demands: [...demands],
          slots,
          stars,
          schedule,
        };
      }
      return;
    }
    const type = APTITUDES[index];
    const base = input.aptitudes[type];
    const maximumRaise = relevant.has(type)
      ? Math.max(0, Math.min(4, 7 - base))
      : 0;
    for (let raise = 0; raise <= maximumRaise; raise += 1) {
      const requiredStars = STAR_THRESHOLDS[raise];
      const requiredSlots = Math.ceil(requiredStars / 3);
      if (slots + requiredSlots > 6) break;
      aptitudes[type] = base + raise;
      if (raise)
        demands.push({
          type,
          base,
          target: base + raise,
          stars: requiredStars,
          slots: requiredSlots,
        });
      visit(index + 1, slots + requiredSlots, stars + requiredStars);
      if (raise) demands.pop();
    }
    aptitudes[type] = base;
  };
  visit(0, 0, 0);
  return best;
}
