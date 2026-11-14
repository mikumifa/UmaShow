import { expectedJewelDrops, jewelProbabilityGivenWin } from './raceJewelModel';

test.each([
  [1, 0.04],
  [2, 0.04],
  [3, 0.03],
  [4, 0.01],
  [5, 0.01],
  [6, 0],
  [7, 0],
  [72, 0],
])('streak %i has conditional drop probability %f', (streak, probability) => {
  expect(jewelProbabilityGivenWin(streak)).toBe(probability);
  expect(expectedJewelDrops(0.8, streak)).toBeCloseTo(0.8 * probability);
  expect(expectedJewelDrops(0, streak)).toBe(0);
});
