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
  if (!noteStat || selectedIds.size === 0 || songStats.length === 0) {
    return new Set<number>();
  }

  const sellingIds = new Set(songStats.map((s) => s.id));
  const reservedSelling = Array.from(selectedIds).filter((id) =>
    sellingIds.has(id),
  );
  if (reservedSelling.length > 0) {
    return new Set(reservedSelling);
  }

  const reservedCost = sumSelectedCost(selectedIds);

  const candidates: Array<{ id: number; score: number }> = [];
  songStats.forEach((song) => {
    const costByNote = getSongCostByNote(song.id);
    const keys: NoteKey[] = ['da', 'pa', 'vo', 'vi', 'me'];
    const canAffordReserved = keys.every((key) => {
      const currentValue = noteStat[key]?.value ?? 0;
      return currentValue - costByNote[key] >= reservedCost[key];
    });
    if (!canAffordReserved) return;
    const score = keys.reduce((acc, key) => acc + costByNote[key], 0);
    candidates.push({ id: song.id, score });
  });

  if (candidates.length === 0) {
    return new Set<number>();
  }

  const minScore = Math.min(...candidates.map((c) => c.score));
  const minCandidates = candidates.filter((c) => c.score === minScore);
  return new Set(minCandidates.map((c) => c.id));
};
