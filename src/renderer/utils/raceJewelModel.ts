/** Replace this conditional model when offline training data is available.
 * Initial assumption: wins only; 5%, falling to 4% from the fourth race.
 * The output is expected drop events, not a diamond quantity.
 */
export const JEWEL_MODEL_VERSION = 'win-streak-v1';
export const SCENARIO_RACE_DROP_RATE = 0.05;

export function jewelProbabilityGivenWin(streak: number): number {
  return streak > 3 ? 0.04 : 0.05;
}

export function expectedJewelDrops(winProbability: number, streak: number) {
  return winProbability * jewelProbabilityGivenWin(streak);
}
