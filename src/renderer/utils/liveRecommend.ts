import { LIVE_SQUARE_MAP } from 'constant/live/liveSchedule';
import type { NoteStat, SongStat } from 'types/gameTypes';

type NoteKey = keyof NoteStat;

const PERF_TYPE_TO_NOTE_KEY: Record<number, NoteKey> = {
  1: 'da',
  2: 'pa',
  3: 'vo',
  4: 'vi',
  5: 'me',
};

const sumSelectedCost = (selectedIds: Set<number>) => {
  const total: Record<NoteKey, number> = {
    da: 0,
    pa: 0,
    vo: 0,
    vi: 0,
    me: 0,
  };
  selectedIds.forEach((id) => {
    const square = LIVE_SQUARE_MAP[id];
    if (!square) return;
    square.perfType.forEach((type, idx) => {
      const key = PERF_TYPE_TO_NOTE_KEY[type];
      if (!key) return;
      total[key] += square.perfValue[idx] ?? 0;
    });
  });
  return total;
};

export const getRecommendedSongIds = ({
  selectedIds,
  noteStat,
  songStats,
}: {
  selectedIds: Set<number>;
  noteStat?: NoteStat | null;
  songStats: SongStat[];
}) => {
  if (!noteStat || songStats.length === 0) {
    return new Set<number>();
  }

  const reservedCost = sumSelectedCost(selectedIds);
  const keys: NoteKey[] = ['da', 'pa', 'vo', 'vi', 'me'];

  const candidates: number[] = [];

  songStats.forEach((song) => {
    /* 歌曲 */
    if (song.id in LIVE_SQUARE_MAP) {
      // 只推荐已选择的歌曲中能单独购买的
      if (selectedIds.has(song.id)) {
        candidates.push(song.id);
      }
      return;
    }

    /** ② 课程：检查是否还能覆盖预约消耗 */
    const canAffordReserved = keys.every((key) => {
      const currentValue = noteStat[key]?.value ?? 0;
      const cost = song.notes[key] ?? 0;
      if (cost === 0) return true;
      return currentValue - cost >= reservedCost[key];
    });

    if (!canAffordReserved) return;

    candidates.push(song.id);
  });

  return new Set(candidates);
};
