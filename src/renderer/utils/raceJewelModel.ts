/** Provisional conditional rates from offline training observations.
 * Wins only; consecutive starts 1–5: 5%, 5%, 5%, 1%, 1%; 6+: 0%.
 * Only GI/GII/GIII, SP (EX) and Goddess Cup scenario races can drop jewels;
 * OP, Pre-OP, Maiden and Debut races never drop jewels.
 * The output is expected drop events, not a diamond quantity.
 */
export const JEWEL_MODEL_VERSION = 'win-streak-grade-v4';
export const JEWEL_DROP_RATES = [0.05, 0.05, 0.05, 0.01, 0.01] as const;
export const JEWEL_ELIGIBLE_GRADES = [100, 200, 300, 1000] as const;
// Year-end scenario events occur outside the regular race streak.
export const SCENARIO_RACE_DROP_RATE = 0.05;

export function canRaceDropJewels(grade: number): boolean {
  return (JEWEL_ELIGIBLE_GRADES as readonly number[]).includes(grade);
}

export function jewelProbabilityGivenWin(streak: number, grade = 100): number {
  if (!canRaceDropJewels(grade)) return 0;
  return JEWEL_DROP_RATES[streak - 1] ?? 0;
}

export function expectedJewelDrops(
  winProbability: number,
  streak: number,
  grade = 100,
) {
  return winProbability * jewelProbabilityGivenWin(streak, grade);
}
