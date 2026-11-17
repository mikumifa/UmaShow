import {
  canRaceDropJewels,
  expectedJewelDrops,
  jewelProbabilityGivenWin,
} from './raceJewelModel';

test.each([
  [1, 0.05],
  [2, 0.05],
  [3, 0.05],
  [4, 0.01],
  [5, 0.01],
  [6, 0],
  [7, 0],
  [72, 0],
])('streak %i has conditional drop probability %f', (streak, probability) => {
  expect(jewelProbabilityGivenWin(streak)).toBe(probability);
  [100, 200, 300, 1000].forEach((grade) => {
    expect(canRaceDropJewels(grade)).toBe(true);
    expect(jewelProbabilityGivenWin(streak, grade)).toBe(probability);
    expect(expectedJewelDrops(0.8, streak, grade)).toBeCloseTo(
      0.8 * probability,
    );
  });
  expect(expectedJewelDrops(0, streak)).toBe(0);
});

test.each([400, 700, 800, 900])(
  'non-eligible grade %i (OP, Pre-OP, Maiden, Debut) never drops jewels',
  (grade) => {
    expect(canRaceDropJewels(grade)).toBe(false);
    [1, 2, 3, 4, 5].forEach((streak) => {
      expect(jewelProbabilityGivenWin(streak, grade)).toBe(0);
      expect(expectedJewelDrops(1, streak, grade)).toBe(0);
    });
  },
);
