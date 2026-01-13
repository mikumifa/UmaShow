export interface GameTime {
  year: number;
  month: number; // 1 - 12
  half: 'upper' | 'lower'; // 上半 or 下半
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
