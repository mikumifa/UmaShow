import { WinRates } from './raceScheduleOptimizer';

// User-supplied empirical counts, not a guaranteed game formula.
// Columns: consecutive starts 1–2, 3, 4, 5, 6+.
// Null means unmeasured; do not interpolate it to zero or 100%.
export const WIN_RATE_SAMPLES: Record<
  string,
  ReadonlyArray<readonly [number, number] | null>
> = {
  '7:7': [
    [1404, 1404],
    [420, 420],
    [180, 210],
    [79, 105],
    [309, 525],
  ],
  '7:6': [
    [741, 741],
    [194, 210],
    [161, 210],
    [227, 315],
    [230, 420],
  ],
  '7:5': [
    [18, 20],
    [7, 10],
    [6, 10],
    [5, 10],
    [186, 510],
  ],
  '7:4': [
    [55, 68],
    [20, 32],
    [11, 20],
    [9, 16],
    [33, 88],
  ],
  '1:7': [
    [32, 121],
    [4, 10],
    [0, 25],
    [0, 5],
    [0, 10],
  ],
  '1:6': [[16, 105], null, null, null, null],
};

export const DEFAULT_WIN_RATES: WinRates = Object.fromEntries(
  Object.entries(WIN_RATE_SAMPLES).map(([key, cells]) => [
    key,
    cells.map((cell) => (cell ? cell[0] / cell[1] : null)),
  ]),
);

// Complete, rounded reference model (2026-07-26 revision), kept separate
// from the user's raw samples. These are estimates, not invented samples.
// https://tma.main.jp/uma/maximize_win_independent_training.php
const REFERENCE_GROUPS = [
  ['AA'],
  ['AB', 'BA'],
  ['AC', 'BB', 'CA'],
  ['AD', 'BC', 'CB', 'DA'],
  ['AE', 'BD', 'CC', 'DB'],
  ['BE', 'CD', 'DC', 'EA'],
  ['AF', 'CE', 'DD', 'EB', 'FA'],
  ['BF', 'DE', 'EC', 'FB'],
  ['CF', 'ED', 'FC'],
  ['AG', 'DF', 'EE', 'FD', 'GA'],
  ['BG', 'FE', 'GB'],
  ['CG', 'DG', 'EF', 'EG', 'FF', 'FG', 'GC', 'GD', 'GE', 'GF', 'GG'],
];
const REFERENCE_COLUMNS = [
  [100, 100, 90, 80, 60],
  [100, 95, 80, 70, 50],
  [90, 85, 70, 60, 40],
  [80, 75, 60, 50, 30],
  [70, 65, 50, 40, 20],
  [60, 55, 40, 30, 10],
  [50, 45, 30, 20, 0],
  [40, 35, 20, 10, 0],
  [30, 25, 10, 0, 0],
  [20, 15, 0, 0, 0],
  [10, 5, 0, 0, 0],
  [0, 0, 0, 0, 0],
];
export const REFERENCE_WIN_RATES: WinRates = Object.fromEntries(
  REFERENCE_GROUPS.flatMap((pairs, column) =>
    pairs.map((pair) => [
      `${7 - 'ABCDEFG'.indexOf(pair[0])}:${7 - 'ABCDEFG'.indexOf(pair[1])}`,
      REFERENCE_COLUMNS[column].map((percent) => percent / 100),
    ]),
  ),
);
