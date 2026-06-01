export interface GameTime {
  year: number;
  month: number; // 1 - 12
  half: 'upper' | 'lower'; // 上半 or 下半
}

export type TrainingPeriod = 'junior' | 'classic' | 'senior' | 'ura';

export interface TrainingTurnInfo {
  period: TrainingPeriod;
  periodLabel: string;
  month?: number;
  half?: 'upper' | 'lower';
  timeLabel: string;
  eventLabel: string;
}

const HALF_LABEL_MAP: Record<GameTime['half'], string> = {
  upper: '前半',
  lower: '后半',
};

const TRAINING_PERIOD_LABEL_MAP: Record<TrainingPeriod, string> = {
  junior: 'ジュニア级',
  classic: 'クラシック级',
  senior: 'シニア级',
  ura: 'URA',
};

function buildMonthHalfLabel(
  period: Exclude<TrainingPeriod, 'ura'>,
  month: number,
  half: GameTime['half'],
) {
  return `${month}月${HALF_LABEL_MAP[half]}`;
}

/**
 * turn 从 1 开始
 */
export function getGameTimeByTurn(turn: number): GameTime {
  if (turn < 1) {
    throw new Error('turn must be >= 1');
  }
  const monthIndex = Math.floor((turn - 1) / 2);
  const year = Math.floor(monthIndex / 12) + 1;
  const month = (monthIndex % 12) + 1;
  const half = turn % 2 === 1 ? 'upper' : 'lower';

  return { year, month, half };
}

/**
 * 按育成流程翻译 turn。
 * 约定：
 * - 1 - 12   -> ジュニア级 7月前半 ~ 12月后半
 * - 13 - 36  -> クラシック级 1月前半 ~ 12月后半
 * - 37 - 60  -> シニア级 1月前半 ~ 12月后半
 * - 61 以后  -> URA 阶段
 */
export function getTrainingTurnInfo(turn: number): TrainingTurnInfo {
  if (turn < 1) {
    throw new Error('turn must be >= 1');
  }

  if (turn <= 12) {
    const monthOffset = Math.floor((turn - 1) / 2);
    const month = monthOffset + 7;
    const half = turn % 2 === 1 ? 'upper' : 'lower';
    const timeLabel = buildMonthHalfLabel('junior', month, half);

    return {
      period: 'junior',
      periodLabel: TRAINING_PERIOD_LABEL_MAP.junior,
      month,
      half,
      timeLabel,
      eventLabel: turn === 1 ? `育成开始` : timeLabel,
    };
  }

  if (turn <= 36) {
    const phaseTurn = turn - 13;
    const month = Math.floor(phaseTurn / 2) + 1;
    const half = phaseTurn % 2 === 0 ? 'upper' : 'lower';
    const timeLabel = buildMonthHalfLabel('classic', month, half);

    return {
      period: 'classic',
      periodLabel: TRAINING_PERIOD_LABEL_MAP.classic,
      month,
      half,
      timeLabel,
      eventLabel: timeLabel,
    };
  }

  if (turn <= 60) {
    const phaseTurn = turn - 37;
    const month = Math.floor(phaseTurn / 2) + 1;
    const half = phaseTurn % 2 === 0 ? 'upper' : 'lower';
    const timeLabel = buildMonthHalfLabel('senior', month, half);

    return {
      period: 'senior',
      periodLabel: TRAINING_PERIOD_LABEL_MAP.senior,
      month,
      half,
      timeLabel,
      eventLabel: timeLabel,
    };
  }

  const uraPhase = turn - 60;
  const uraEventLabelMap: Record<number, string> = {
    1: 'URA总决赛预赛',
    2: 'URA总决赛预赛后',
    3: 'URA总决赛半决赛',
    4: 'URA总决赛半决赛后',
    5: 'URA总决赛决赛',
    6: 'URA总决赛决赛后',
  };
  const eventLabel = uraEventLabelMap[uraPhase] ?? `URA阶段 Turn ${uraPhase}`;

  return {
    period: 'ura',
    periodLabel: TRAINING_PERIOD_LABEL_MAP.ura,
    timeLabel: eventLabel,
    eventLabel,
  };
}

export function getTrainingEventLabelByTurn(turn: number) {
  return getTrainingTurnInfo(turn).eventLabel;
}
