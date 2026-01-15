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

const getSongCostByNote = (songId: number) => {
  const cost: Record<NoteKey, number> = {
    da: 0,
    pa: 0,
    vo: 0,
    vi: 0,
    me: 0,
  };
  const square = LIVE_SQUARE_MAP[songId];
  if (!square) return cost;
  square.perfType.forEach((type, idx) => {
    const key = PERF_TYPE_TO_NOTE_KEY[type];
    if (!key) return;
    cost[key] += square.perfValue[idx] ?? 0;
  });
  return cost;
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
    const costByNote = getSongCostByNote(song.id);

    /** ① 是否能单独购买这首歌 */
    const canBuyAlone = keys.every((key) => {
      const currentValue = noteStat[key]?.value ?? 0;
      const cost = song.notes[key] ?? 0;
      return currentValue - cost >= 0;
    });

    /** 预约歌曲：能买就直接推荐 */
    if (selectedIds.has(song.id)) {
      if (canBuyAlone) {
        candidates.push(song.id);
      }
      return;
    }

    /** ② 非预约歌曲：检查是否还能覆盖预约消耗 */
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
