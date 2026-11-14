import { REFERENCE_WIN_RATES } from './raceWinRateModel';
import { raceWinProbability, PlanningRace } from './raceScheduleOptimizer';

// Image columns, ordered by 1–2 / 3 / 4 / 5 / 6+ consecutive races.
const imageColumns: Array<[string, number[]]> = [
  ['AA', [110, 105, 90, 80, 60]],
  ['AB', [100, 95, 80, 70, 50]],
  ['AC', [90, 85, 70, 60, 40]],
  ['AD', [80, 75, 60, 50, 30]],
  ['AE', [70, 65, 50, 40, 20]],
  ['AF', [50, 45, 30, 20, 0]],
  ['AG', [20, 15, 0, 0, 0]],
  ['BG', [10, 5, 0, 0, 0]],
  ['CG', [0, 0, 0, 0, 0]],
  ['DG', [0, 0, 0, 0, 0]],
  ['EG', [0, 0, 0, 0, 0]],
  ['FG', [0, 0, 0, 0, 0]],
  ['GG', [0, 0, 0, 0, 0]],
];

test.each(imageColumns)(
  '%s matches the supplied image, capped at 100%%',
  (pair, percentages) => {
    const ranks = [...pair].map((letter) => 7 - 'ABCDEFG'.indexOf(letter));
    expect(REFERENCE_WIN_RATES[ranks.join(':')]).toEqual(
      percentages.map((value) => Math.min(100, value) / 100),
    );
  },
);

test('all 49 aptitude pairs use the combined rank and are symmetric', () => {
  expect(Object.keys(REFERENCE_WIN_RATES)).toHaveLength(49);
  Object.entries(REFERENCE_WIN_RATES).forEach(([pair, rates]) => {
    const [ground, distance] = pair.split(':').map(Number);
    expect(rates).toEqual(REFERENCE_WIN_RATES[`${distance}:${ground}`]);
    const equivalent = Math.min(7, ground + distance - 1);
    expect(rates).toEqual(
      REFERENCE_WIN_RATES[`${equivalent}:${ground + distance - equivalent}`],
    );
  });
  expect(REFERENCE_WIN_RATES['6:3']).toEqual(REFERENCE_WIN_RATES['7:2']);
});

test('career goals add 10 percentage points to the actual streak rate, capped at 100%; other races do not', () => {
  const race: PlanningRace = {
    id: 1,
    programId: 1,
    turn: 6,
    name: '目标赛',
    grade: 100,
    ground: 'turf',
    distanceType: 'mile',
    distance: 1600,
    fans: 100,
    requiredFans: 0,
  };
  const aptitudes = { turf: 7, dirt: 1, short: 1, mile: 6, middle: 1, long: 1 };
  [
    [1, 1, 1],
    [2, 1, 1],
    [3, 0.95, 1],
    [4, 0.8, 0.9],
    [5, 0.7, 0.8],
    [6, 0.5, 0.6],
    [9, 0.5, 0.6],
  ].forEach(([streak, normal, goal]) => {
    expect(
      raceWinProbability(race, streak, aptitudes, REFERENCE_WIN_RATES),
    ).toBeCloseTo(normal);
    expect(
      raceWinProbability(
        { ...race, isCareerGoal: true },
        streak,
        aptitudes,
        REFERENCE_WIN_RATES,
      ),
    ).toBeCloseTo(goal);
  });
  [null, undefined, NaN, -0.1, 1.1, 0].forEach((value) => {
    const probability = raceWinProbability(
      { ...race, isCareerGoal: true },
      6,
      aptitudes,
      { '7:6': value === undefined ? [0.8] : [0.8, 0.7, 0.6, 0.5, value] },
    );
    if (value === 0) expect(probability).toBeCloseTo(0.1);
    else expect(probability).toBeNull();
  });
});
