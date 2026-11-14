/** Provisional conditional rates from offline training observations.
 * Wins only; consecutive starts 1–5: 4%, 4%, 3%, 1%, 1%; 6+: 0%.
 * The output is expected drop events, not a diamond quantity.
 */
export const JEWEL_MODEL_VERSION = 'win-streak-v2';
export const JEWEL_DROP_RATES = [0.04, 0.04, 0.03, 0.01, 0.01] as const;
// Year-end scenario events occur outside the regular race streak.
export const SCENARIO_RACE_DROP_RATE = 0.05;

export function jewelProbabilityGivenWin(streak: number): number {
  return JEWEL_DROP_RATES[streak - 1] ?? 0;
}

export function expectedJewelDrops(winProbability: number, streak: number) {
  return winProbability * jewelProbabilityGivenWin(streak);
}
