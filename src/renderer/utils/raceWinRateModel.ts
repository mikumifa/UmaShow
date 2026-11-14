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

// User-provided reference image: aptitude ranks are evaluated by their sum.
// Representatives for each total rank deficit from AA: AA, AB, AC, AD, AE,
// AF, AG, BG, CG, DG, EG, FG, GG. Swap ground/distance without changing rates.
// Preserve 110%/105% in the underlying model, then clamp actual probabilities.
export const REFERENCE_WIN_RATE_MODEL_VERSION = 'aptitude-sum-streak-goal-v3';
const BASE_PERCENT_BY_DEFICIT = [
  110, 100, 90, 80, 70, 50, 20, 10, 0, 0, 0, 0, 0,
];
const STREAK_PENALTIES = [0, 5, 20, 30, 50];
const APTITUDE_RANKS = [7, 6, 5, 4, 3, 2, 1];
export const REFERENCE_WIN_RATES: WinRates = Object.fromEntries(
  APTITUDE_RANKS.flatMap((ground) =>
    APTITUDE_RANKS.map((distance) => [
      `${ground}:${distance}`,
      STREAK_PENALTIES.map(
        (penalty) =>
          Math.max(
            0,
            Math.min(
              100,
              BASE_PERCENT_BY_DEFICIT[14 - ground - distance] - penalty,
            ),
          ) / 100,
      ),
    ]),
  ),
);
