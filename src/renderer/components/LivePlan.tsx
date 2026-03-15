/* eslint-disable no-nested-ternary */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  LIVE_SQUARE_MAP,
  getLivePoolIdsByTurn,
  type LiveSquare,
} from 'constant/live/liveSchedule';
import { NOTE_STYLES, type NoteType } from 'renderer/components/NoteStyles';
import type { NoteStat } from 'types/gameTypes';

interface LivePlanProps {
  turn: number;
  noteStat?: NoteStat;
  previewNoteStat?: NoteStat | null;
  purchasedLiveIds?: number[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  trainingLabelsByNote?: Partial<Record<NoteType, string[]>>;
  sellingIds?: Set<number>;
}

const PERF_TYPE_TO_NOTE_KEY: Record<number, NoteType> = {
  1: 'da',
  2: 'pa',
  3: 'vo',
  4: 'vi',
  5: 'me',
};

const SONG_WEIGHT_BORDER: Record<number, string> = {
  4: 'border-amber-300',
  3: 'border-purple-300',
  1: 'border-slate-300',
};

const SONG_WEIGHT_BG: Record<number, string> = {
  4: 'bg-amber-50',
  3: 'bg-purple-50',
  1: 'bg-slate-50',
};

export default function LivePlan({
  turn,
  noteStat,
  previewNoteStat,
  purchasedLiveIds,
  selectedIds,
  onToggleSelect,
  trainingLabelsByNote,
  sellingIds,
}: LivePlanProps) {
  const [showFuture, setShowFuture] = useState(false);
  const [hoveredLiveId, setHoveredLiveId] = useState<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const effectivePreviewNoteStat = useMemo(() => {
    const baseNoteStat = previewNoteStat ?? noteStat;
    if (hoveredLiveId == null || !baseNoteStat) {
      return previewNoteStat ?? null;
    }
    const hoveredLive = LIVE_SQUARE_MAP[hoveredLiveId];
    if (!hoveredLive) {
      return previewNoteStat ?? null;
    }
    const next = {
      da: { ...baseNoteStat.da },
      pa: { ...baseNoteStat.pa },
      vo: { ...baseNoteStat.vo },
      vi: { ...baseNoteStat.vi },
      me: { ...baseNoteStat.me },
    };
    hoveredLive.perfType.forEach((type, idx) => {
      const key = PERF_TYPE_TO_NOTE_KEY[type];
      if (!key) return;
      next[key].value -= hoveredLive.perfValue[idx] ?? 0;
    });
    return next;
  }, [hoveredLiveId, noteStat, previewNoteStat]);
  const minCurrencyKeys = useMemo(() => {
    const activeNoteStat = effectivePreviewNoteStat ?? noteStat;
    if (!activeNoteStat) return null;
    const keys = Object.keys(NOTE_STYLES) as NoteType[];
    let minValue = Number.POSITIVE_INFINITY;
    keys.forEach((key) => {
      const value = activeNoteStat[key]?.value ?? 0;
      if (value < minValue) {
        minValue = value;
      }
    });
    const minKeys = keys.filter(
      (key) => (activeNoteStat[key]?.value ?? 0) === minValue,
    );
    return minKeys.length > 0 ? minKeys : null;
  }, [effectivePreviewNoteStat, noteStat]);
  const purchasedSet = useMemo(
    () => new Set(purchasedLiveIds ?? []),
    [purchasedLiveIds],
  );
  const pool = useMemo(() => {
    const resultIds = getLivePoolIdsByTurn(turn);
    const filteredIds = resultIds.filter((id) => !purchasedSet.has(id));
    const list = filteredIds
      .map((id) => LIVE_SQUARE_MAP[id])
      .filter(Boolean) as LiveSquare[];
    return list;
  }, [turn, purchasedSet]);
  const poolIdSet = useMemo(() => new Set(pool.map((song) => song.id)), [pool]);
  const futureSongs = useMemo(() => {
    const allSongs = Object.values(LIVE_SQUARE_MAP);
    return allSongs
      .filter((song) => !poolIdSet.has(song.id))
      .filter((song) => !purchasedSet.has(song.id));
  }, [poolIdSet, purchasedSet]);

  const totalCostByNote = useMemo(() => {
    const total = { da: 0, pa: 0, vo: 0, vi: 0, me: 0 };
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
  }, [selectedIds]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setHoveredLiveId(null);
    };
  }, []);

  const openFuturePanel = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowFuture(true);
  };

  const scheduleCloseFuturePanel = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setHoveredLiveId(null);
      setShowFuture(false);
      closeTimerRef.current = null;
    }, 220);
  };

  return (
    <section className="relative bg-white rounded-lg border border-purple-200 shadow-sm overflow-visible p-2">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(NOTE_STYLES) as NoteType[]).map((key) => {
          const style = NOTE_STYLES[key];
          const currentValue = noteStat?.[key]?.value ?? null;
          const previewValue =
            effectivePreviewNoteStat?.[key]?.value ?? currentValue;
          const targetValue = totalCostByNote[key];
          const diffCurrent =
            currentValue == null ? null : targetValue - currentValue;
          const diffPreview =
            previewValue == null ? null : targetValue - previewValue;
          const isMetCurrent = diffCurrent != null && diffCurrent <= 0;
          const isMetPreview = diffPreview != null && diffPreview <= 0;
          const hasPreview =
            effectivePreviewNoteStat != null &&
            currentValue != null &&
            previewValue != null &&
            previewValue !== currentValue;
          const displayNeed = targetValue;
          const displayCurrentValue =
            currentValue == null ? '--' : `${currentValue}`;
          const displayPreviewValue =
            previewValue == null ? '--' : `${previewValue}`;
          const displayCurrentDelta =
            diffCurrent == null ? '--' : `${Math.abs(diffCurrent)}`;
          const displayPreviewDelta =
            diffPreview == null ? '--' : `${Math.abs(diffPreview)}`;
          return (
            <div
              key={key}
              className={`relative flex h-[74px] w-[90px] min-w-[90px] shrink-0 overflow-visible rounded-lg border shadow-sm transition-all ${
                isMetPreview
                  ? 'border-emerald-200 bg-emerald-50'
                  : `${style.border} ${style.bg}`
              }`}
            >
              {minCurrencyKeys?.includes(key) ? (
                <div className="pointer-events-none absolute -inset-1 z-0 rounded-[12px]">
                  <div className="h-full w-full rounded-[12px] border-[3px] border-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.75)]" />
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[95%] text-[9px] font-black leading-none text-rose-500">
                    最小
                  </span>
                </div>
              ) : null}

              <div className="flex h-full w-full">
                <div className="flex w-[44px] shrink-0 flex-col items-center justify-center border-r border-dashed border-slate-200 px-1">
                  {trainingLabelsByNote?.[key]?.length ? (
                    <span className="mb-0.5 text-[9px] font-black leading-none text-slate-500">
                      {trainingLabelsByNote[key]!.join('')}
                    </span>
                  ) : (
                    <span className="mb-0.5 text-[11px] font-black leading-none text-rose-500">
                      {'\u00d7'}
                    </span>
                  )}
                  <span
                    className={`mb-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-black ring-2 ${style.border} ${style.text} ${style.ring}`}
                  >
                    {style.label}
                  </span>
                  <span
                    className={`text-[13px] font-black leading-none tabular-nums ${style.text}`}
                  >
                    {displayNeed}
                  </span>
                </div>

                <div
                  className={`flex min-w-0 flex-1 flex-col justify-between px-0.5 py-1 ${
                    isMetPreview ? 'bg-emerald-100/50' : style.accent
                  }`}
                >
                  <div className="flex items-center justify-center border-b border-dashed border-slate-200/70 pb-0.5">
                    {hasPreview && isMetCurrent !== isMetPreview ? (
                      <div className="flex items-center gap-0.5">
                        {isMetCurrent ? (
                          <CheckCircle2
                            size={12}
                            className="text-emerald-400"
                          />
                        ) : (
                          <XCircle size={12} className="text-red-400" />
                        )}
                        <span className="text-[10px] text-slate-400">
                          {'\u2192'}
                        </span>
                        {isMetPreview ? (
                          <CheckCircle2
                            size={12}
                            className="text-emerald-600"
                          />
                        ) : (
                          <XCircle size={12} className="text-red-600" />
                        )}
                      </div>
                    ) : isMetPreview ? (
                      <CheckCircle2 size={12} className="text-emerald-600" />
                    ) : (
                      <XCircle size={12} className="text-red-600" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-center leading-none">
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold text-slate-500">
                        {'\u73b0\u6709'}
                      </div>
                      {hasPreview ? (
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <span className="text-[11px] font-black text-slate-700 tabular-nums">
                            {displayCurrentValue}
                          </span>
                          <span className="text-[9px] text-slate-400 line-through tabular-nums">
                            {displayPreviewValue}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <span className="text-[11px] font-black text-slate-700 tabular-nums">
                            {displayCurrentValue}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold text-slate-500">
                        {isMetPreview ? '\u591a\u51fa' : '\u8fd8\u5dee'}
                      </div>
                      {hasPreview ? (
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <span
                            className={`text-[11px] font-black tabular-nums ${
                              isMetPreview ? 'text-emerald-700' : style.text
                            }`}
                          >
                            {displayPreviewDelta}
                          </span>
                          <span className="text-[9px] text-slate-400 line-through tabular-nums">
                            {displayCurrentDelta}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`mt-0.5 flex items-center justify-center text-[11px] font-black tabular-nums ${
                            isMetPreview ? 'text-emerald-700' : style.text
                          }`}
                        >
                          {displayPreviewDelta}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {pool.map((song) => {
          const isSelected = selectedIds.has(song.id);
          const weightBorder =
            SONG_WEIGHT_BORDER[song.weight ?? 0] ?? 'border-slate-200';
          const weightBg = SONG_WEIGHT_BG[song.weight ?? 0] ?? 'bg-white';
          const isSelling = sellingIds?.has(song.id) ?? false;
          const isPurchasable =
            noteStat != null &&
            song.perfType.every((type, idx) => {
              const key = PERF_TYPE_TO_NOTE_KEY[type];
              if (!key) return true;
              const targetValue = song.perfValue[idx] ?? 0;
              const currentValue = noteStat?.[key]?.value ?? 0;
              return currentValue >= targetValue;
            });
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => onToggleSelect(song.id)}
              onMouseEnter={() => setHoveredLiveId(song.id)}
              onMouseLeave={() =>
                setHoveredLiveId((prev) => (prev === song.id ? null : prev))
              }
              className={`relative shrink-0 w-20 min-w-25 h-20 text-left rounded-lg px-2 py-1.5 transition-all overflow-visible bg-emerald-50 ${
                isSelected
                  ? `border-2 border-emerald-500 ${weightBg} shadow-sm`
                  : `${weightBorder} ${weightBg} hover:border-slate-300 hover:shadow-sm`
              }`}
            >
              {isPurchasable ? (
                <span className="absolute right-0 top-0 rounded bg-emerald-500 px-1 py-0 text-[8px] font-black text-white">
                  {'\u53ef\u8d2d'}
                </span>
              ) : null}
              {isSelling ? (
                <span className="absolute right-0 bottom-0 rounded bg-sky-500 px-0 py-0 text-[8px] font-black text-white">
                  {'\u53ef\u552e'}
                </span>
              ) : null}
              <div className="text-[11px] font-bold text-slate-800 truncate">
                {song.name}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-600 truncate">
                {song.description}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-emerald-600 truncate">
                {song.liveBonus}
              </div>
            </button>
          );
        })}
        {futureSongs.length > 0 ? (
          <button
            type="button"
            onMouseEnter={openFuturePanel}
            onMouseLeave={scheduleCloseFuturePanel}
            className={`relative shrink-0 w-20 min-w-25 h-20 text-left rounded-lg px-2 py-1.5 transition-all overflow-visible border-dashed bg-amber-50 ${
              showFuture
                ? 'border-2 border-emerald-500 shadow-sm'
                : 'border-amber-300 hover:border-amber-400 hover:shadow-sm'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-800 truncate">
              {'\u672a\u51fa\u73b0'}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-600 truncate">
              {'\u6b4c\u66f2\u5217\u8868'}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold text-amber-700 truncate">
              {futureSongs.length} {'\u9996'}
            </div>
          </button>
        ) : null}
      </div>

      {showFuture && futureSongs.length > 0 ? (
        <div
          className="absolute right-2 top-full mt-2 z-20 w-[460px] max-w-[85vw] border-2 border-dashed border-amber-300 bg-amber-50 rounded-lg p-2 shadow-lg"
          onMouseEnter={openFuturePanel}
          onMouseLeave={scheduleCloseFuturePanel}
        >
          <div className="mb-1 text-[11px] font-bold text-amber-700">
            {'\u672a\u51fa\u73b0\u533a\u57df'}
          </div>
          <div className="flex flex-wrap gap-2">
            {futureSongs.map((song) => {
              const isSelected = selectedIds.has(song.id);
              const weightBorder =
                SONG_WEIGHT_BORDER[song.weight ?? 0] ?? 'border-slate-200';
              const weightBg = SONG_WEIGHT_BG[song.weight ?? 0] ?? 'bg-white';
              const isSelling = sellingIds?.has(song.id) ?? false;
              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => onToggleSelect(song.id)}
                  onMouseEnter={() => setHoveredLiveId(song.id)}
                  onMouseLeave={() =>
                    setHoveredLiveId((prev) => (prev === song.id ? null : prev))
                  }
                  className={`relative shrink-0 w-20 min-w-25 h-20 text-left rounded-lg px-2 py-1.5 transition-all overflow-visible border-dashed bg-amber-50 ${
                    isSelected
                      ? `border-2 border-emerald-500 ${weightBg} shadow-sm`
                      : `${weightBorder} ${weightBg} hover:border-slate-300 hover:shadow-sm`
                  }`}
                >
                  {isSelling ? (
                    <span className="absolute right-0 bottom-0 rounded bg-sky-500 px-0 py-0 text-[8px] font-black text-white">
                      {'\u53ef\u552e'}
                    </span>
                  ) : null}
                  <div className="text-[11px] font-bold text-slate-800 truncate">
                    {song.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-600 truncate">
                    {song.description}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-emerald-600 truncate">
                    {song.liveBonus}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
