/* eslint-disable no-nested-ternary */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import log from 'electron-log';
import {
  type NoteStat,
  COMMAND_TARGET_TYPE_MAP,
  TARGET_TYPE,
  type CharInfo,
} from 'types/gameTypes';
import {
  getLivePoolIdsByTurn,
  LIVE_SQUARE_MAP,
} from 'constant/live/liveSchedule';
import { getGameTimeByTurn } from 'constant/gameStat';
import LiveRefreshTracker, {
  normalizeSequenceProgress,
  parseSequence,
} from 'renderer/components/scenarios/idolCup/LiveRefreshTracker';
import SongStatusCard from 'renderer/components/scenarios/idolCup/SongStatusCard';
import { type NoteType } from 'renderer/components/scenarios/idolCup/NoteStyles';
import LivePlan from 'renderer/components/scenarios/idolCup/LivePlan';
import { getMissingNoteTypes } from 'renderer/components/scenarios/idolCup/MinNoteTransfer';
import {
  getReservedSongAffordableProbabilityAfterCurrent,
  type DoubleLessonYear,
} from 'renderer/utils/liveCourseProbability';
import { getRecommendedSongIds } from 'renderer/utils/liveRecommend';
import {
  TrainingEventsSection,
  VitalPanel,
} from 'renderer/components/monitor/SharedSections';

type LivePhaseKey = 'year1' | 'year2_h1' | 'year2_h2' | 'year3_h1' | 'year3_h2';

interface LiveRefreshPhaseState {
  currentProgress: number;
  lastOfferingSignature: string;
}

const LIVE_REFRESH_CACHE_PREFIX = 'monitorDashboard.liveRefreshTracker';

const LIVE_REFRESH_PATTERN_BY_PHASE: Record<LivePhaseKey, number[]> = {
  year1: [1, 2, 3, 4, 4, 2],
  year2_h1: [2, 2, 2, 4, 5, 2],
  year2_h2: [2, 2, 2, 4, 5, 2],
  year3_h1: [2, 2, 2, 4, 5, 2],
  year3_h2: [2, 2, 2, 4, 3, 2],
};

const getObservedStepsByProgress = (
  phaseKey: LivePhaseKey,
  progress: number,
) => {
  const counts = LIVE_REFRESH_PATTERN_BY_PHASE[phaseKey];
  const sequenceData = parseSequence(counts.join(''));
  const normalizedProgress = normalizeSequenceProgress(progress, sequenceData);
  let cursor = 0;
  return counts.filter((count) => {
    cursor += count;
    const purpleIndex = cursor;
    cursor += 1;
    return normalizedProgress >= purpleIndex;
  });
};

const getRemainingCoursesToRefresh = (
  phaseKey: LivePhaseKey,
  progress: number,
) => {
  const sequenceData = parseSequence(
    LIVE_REFRESH_PATTERN_BY_PHASE[phaseKey].join(''),
  );
  if (sequenceData.fullList.length === 0) return 0;
  const normalizedProgress = normalizeSequenceProgress(progress, sequenceData);
  let remaining = 0;
  const getWrappedIndex = (index: number) => {
    if (index < sequenceData.fullList.length) {
      return index;
    }
    return (
      sequenceData.loopStartIndex +
      ((index - sequenceData.loopStartIndex) % sequenceData.loopLength)
    );
  };
  for (let step = 1; step <= sequenceData.fullList.length; step += 1) {
    const nextIndex = getWrappedIndex(normalizedProgress + step);
    const nextItem = sequenceData.fullList[nextIndex];
    if (nextItem.type === 'purple') {
      return remaining;
    }
    remaining += 1;
  }
  return remaining;
};

const isPurpleProgress = (phaseKey: LivePhaseKey, progress: number) => {
  const sequenceData = parseSequence(
    LIVE_REFRESH_PATTERN_BY_PHASE[phaseKey].join(''),
  );
  if (sequenceData.fullList.length === 0) return false;
  const normalizedProgress = normalizeSequenceProgress(progress, sequenceData);
  return sequenceData.fullList[normalizedProgress]?.type === 'purple';
};

const getCoursesToRefreshFromCurrent = (
  phaseKey: LivePhaseKey,
  progress: number,
) => {
  if (isPurpleProgress(phaseKey, progress)) {
    return 0;
  }
  return getRemainingCoursesToRefresh(phaseKey, progress) + 1;
};

const buildLiveRefreshHint = (
  phaseKey: LivePhaseKey,
  currentProgress: number,
) => {
  const sequenceData = parseSequence(
    LIVE_REFRESH_PATTERN_BY_PHASE[phaseKey].join(''),
  );
  const normalizedProgress = normalizeSequenceProgress(
    currentProgress,
    sequenceData,
  );
  return {
    phaseKey,
    observedSteps: getObservedStepsByProgress(phaseKey, currentProgress),
    purchasesSinceLastRefresh: normalizedProgress,
    remainingCoursesToRefresh: getRemainingCoursesToRefresh(
      phaseKey,
      currentProgress,
    ),
    coursesToRefreshFromCurrent: getCoursesToRefreshFromCurrent(
      phaseKey,
      currentProgress,
    ),
    isCurrentProgressPurple: isPurpleProgress(phaseKey, currentProgress),
  };
};

const getDoubleLessonYearByTurn = (turn: number): DoubleLessonYear => {
  const { year } = getGameTimeByTurn(turn);
  if (year <= 1) return 1;
  if (year === 2) return 2;
  return 3;
};

const getLivePhaseKey = (turn: number): LivePhaseKey => {
  const { year, month } = getGameTimeByTurn(turn);
  if (year <= 1) {
    return 'year1';
  }
  if (year === 2 && month <= 6) {
    return 'year2_h1';
  }
  if (year === 2) {
    return 'year2_h2';
  }
  if (year === 3 && month <= 6) {
    return 'year3_h1';
  }
  return 'year3_h2';
};

export default function IdolCupPanel({ charInfo }: { charInfo: CharInfo }) {
  const { gameStats } = charInfo;
  const { turn, startTime, specialtyLiveEffectRate } = gameStats;
  const {
    liveCommands,
    livePurchasedIds,
    noteStat,
    songStats,
  } = charInfo;
  const [hoveredCommandId, setHoveredCommandId] = useState<number | null>(null);
  const [hoveredSongId, setHoveredSongId] = useState<number | null>(null);
  const [liveSelectedIds, setLiveSelectedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const autoSelectPoolKeyRef = useRef<string | null>(null);
  const lastTurnRef = useRef<number | null>(null);
  const lastStartTimeRef = useRef<string | null>(null);
  const liveRefreshTrackerRef = useRef<
    Partial<Record<LivePhaseKey, LiveRefreshPhaseState>>
  >({});
  const [liveRefreshHint, setLiveRefreshHint] = useState<{
    phaseKey: LivePhaseKey;
    observedSteps: number[];
    purchasesSinceLastRefresh: number;
    remainingCoursesToRefresh: number;
    coursesToRefreshFromCurrent: number;
    isCurrentProgressPurple: boolean;
  } | null>(null);

  const getLiveRefreshCacheKey = useCallback((startTime: string) => {
    return `${LIVE_REFRESH_CACHE_PREFIX}.${startTime}`;
  }, []);

  const resetRunScopedState = useCallback(() => {
    autoSelectPoolKeyRef.current = null;
    lastTurnRef.current = null;
    liveRefreshTrackerRef.current = {};
    setLiveSelectedIds(new Set());
    setHoveredCommandId(null);
    setHoveredSongId(null);
    setLiveRefreshHint(null);
  }, []);

  const liveRefreshPattern = useMemo(() => {
    if (!liveRefreshHint) return '';
    return LIVE_REFRESH_PATTERN_BY_PHASE[liveRefreshHint.phaseKey].join('');
  }, [liveRefreshHint]);

  const doubleLessonYear = useMemo(() => {
    return getDoubleLessonYearByTurn(turn);
  }, [turn]);

  const trainingCommandsByNote = useMemo(() => {
    const map = new Map<keyof NoteStat, Set<number>>();
    if (!liveCommands) return map;
    const performanceTypeMap: Record<number, keyof NoteStat> = {
      1: 'da',
      2: 'pa',
      3: 'vo',
      4: 'vi',
      5: 'me',
    };
    liveCommands.forEach((live) => {
      (live.performance ?? []).forEach((p) => {
        if (p.value === 0) return;
        const key = performanceTypeMap[p.performanceType];
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, new Set());
        }
        map.get(key)!.add(live.commandId);
      });
    });
    return map;
  }, [liveCommands]);

  const trainingLabelsByNote = useMemo(() => {
    const trainingLabelMap: Record<number, string> = {
      [TARGET_TYPE.SPEED]: '速',
      [TARGET_TYPE.POWER]: '力',
      [TARGET_TYPE.WIZ]: '智',
      [TARGET_TYPE.GUTS]: '毅',
      [TARGET_TYPE.STAMINA]: '耐',
    };
    const noteKeys: NoteType[] = ['da', 'pa', 'vo', 'vi', 'me'];
    const result: Partial<Record<NoteType, string[]>> = {};
    noteKeys.forEach((key) => {
      const ids = Array.from(trainingCommandsByNote.get(key) ?? []);
      const labels = ids
        .map(
          (commandId) => trainingLabelMap[COMMAND_TARGET_TYPE_MAP[commandId]],
        )
        .filter(Boolean);
      if (labels.length > 0) {
        result[key] = Array.from(new Set(labels));
      }
    });
    return result;
  }, [trainingCommandsByNote]);

  const trainingPreviewNoteStat = useMemo(() => {
    if (!noteStat || !liveCommands) return null;
    if (!hoveredCommandId) return null;
    const liveCommand = liveCommands.find(
      (live) => live.commandId === hoveredCommandId,
    );
    if (!liveCommand?.performance?.length) return null;
    const next = {
      da: { ...noteStat.da },
      pa: { ...noteStat.pa },
      vo: { ...noteStat.vo },
      vi: { ...noteStat.vi },
      me: { ...noteStat.me },
    };
    const performanceTypeMap: Record<number, keyof NoteStat> = {
      1: 'da',
      2: 'pa',
      3: 'vo',
      4: 'vi',
      5: 'me',
    };
    liveCommand.performance.forEach((p) => {
      const key = performanceTypeMap[p.performanceType];
      if (!key) return;
      next[key].value += p.value;
    });
    return next;
  }, [hoveredCommandId, liveCommands, noteStat]);

  const previewNoteStat = useMemo(() => {
    const baseNoteStat = trainingPreviewNoteStat ?? noteStat;
    if (!baseNoteStat || hoveredSongId == null) {
      return trainingPreviewNoteStat;
    }
    const hoveredSong = songStats?.find(
      (song) => song.id === hoveredSongId,
    );
    if (!hoveredSong) {
      return trainingPreviewNoteStat;
    }
    const next = {
      da: { ...baseNoteStat.da },
      pa: { ...baseNoteStat.pa },
      vo: { ...baseNoteStat.vo },
      vi: { ...baseNoteStat.vi },
      me: { ...baseNoteStat.me },
    };
    (Object.keys(hoveredSong.notes) as Array<keyof NoteStat>).forEach((key) => {
      next[key].value -= hoveredSong.notes[key] ?? 0;
    });
    return next;
  }, [hoveredSongId, noteStat, songStats, trainingPreviewNoteStat]);

  const recommendedIds = useMemo(() => {
    const effectiveNoteStat = trainingPreviewNoteStat ?? noteStat;
    return getRecommendedSongIds({
      selectedIds: liveSelectedIds,
      noteStat: effectiveNoteStat,
      songStats: songStats ?? [],
    });
  }, [liveSelectedIds, noteStat, songStats, trainingPreviewNoteStat]);

  const selectedNoteCosts = useMemo(() => {
    const total: Partial<Record<NoteType, number>> = {
      da: 0,
      pa: 0,
      vo: 0,
      vi: 0,
      me: 0,
    };
    liveSelectedIds.forEach((id) => {
      const song = LIVE_SQUARE_MAP[id];
      if (!song) return;
      song.perfType.forEach((type, idx) => {
        const keyMap: Record<number, NoteType> = {
          1: 'da',
          2: 'pa',
          3: 'vo',
          4: 'vi',
          5: 'me',
        };
        const key = keyMap[type];
        if (!key) return;
        total[key] = (total[key] ?? 0) + (song.perfValue[idx] ?? 0);
      });
    });
    return total;
  }, [liveSelectedIds]);

  const reserveProbabilityBySongId = useMemo(() => {
    if (!noteStat || !liveRefreshHint?.coursesToRefreshFromCurrent) {
      return new Map<number, number>();
    }
    if (liveSelectedIds.size === 0) {
      return new Map<number, number>();
    }

    const currentInventory = {
      da: noteStat.da.value,
      pa: noteStat.pa.value,
      vo: noteStat.vo.value,
      vi: noteStat.vi.value,
      me: noteStat.me.value,
    };

    const result = new Map<number, number>();
    (songStats ?? []).forEach((song) => {
      const reservedCost = {
        da:
          (selectedNoteCosts.da ?? 0) -
          (liveSelectedIds.has(song.id) ? (song.notes.da ?? 0) : 0),
        pa:
          (selectedNoteCosts.pa ?? 0) -
          (liveSelectedIds.has(song.id) ? (song.notes.pa ?? 0) : 0),
        vo:
          (selectedNoteCosts.vo ?? 0) -
          (liveSelectedIds.has(song.id) ? (song.notes.vo ?? 0) : 0),
        vi:
          (selectedNoteCosts.vi ?? 0) -
          (liveSelectedIds.has(song.id) ? (song.notes.vi ?? 0) : 0),
        me:
          (selectedNoteCosts.me ?? 0) -
          (liveSelectedIds.has(song.id) ? (song.notes.me ?? 0) : 0),
      };

      result.set(
        song.id,
        getReservedSongAffordableProbabilityAfterCurrent({
          inventory: currentInventory,
          currentLessonCost: song.notes,
          reservedCost: {
            da: Math.max(reservedCost.da, 0),
            pa: Math.max(reservedCost.pa, 0),
            vo: Math.max(reservedCost.vo, 0),
            vi: Math.max(reservedCost.vi, 0),
            me: Math.max(reservedCost.me, 0),
          },
          totalPurchaseCount: liveRefreshHint.coursesToRefreshFromCurrent,
          year: doubleLessonYear,
        }),
      );
    });

    return result;
  }, [
    doubleLessonYear,
    liveRefreshHint?.coursesToRefreshFromCurrent,
    liveSelectedIds,
    noteStat,
    selectedNoteCosts,
    songStats,
  ]);

  const plannedMissingNoteTypes = useMemo(
    () => getMissingNoteTypes(noteStat, selectedNoteCosts),
    [noteStat, selectedNoteCosts],
  );

  const livePoolIds = useMemo(() => {
    const ids = getLivePoolIdsByTurn(turn);
    const purchased = new Set(livePurchasedIds ?? []);
    return ids.filter((id) => !purchased.has(id));
  }, [livePurchasedIds, turn]);

  useEffect(() => {
    setLiveSelectedIds((prev) => {
      const next = new Set<number>(prev);
      const purchasedSet = new Set(livePurchasedIds ?? []);
      purchasedSet.forEach((id) => next.delete(id));
      return next;
    });
  }, [livePurchasedIds]);

  useEffect(() => {
    if (startTime == null) return;

    const startTimeKey = String(startTime);
    if (
      lastStartTimeRef.current != null &&
      lastStartTimeRef.current !== startTimeKey
    ) {
      resetRunScopedState();
    }
    lastStartTimeRef.current = startTimeKey;
  }, [resetRunScopedState, startTime]);

  useEffect(() => {
    if (startTime == null) return;

    try {
      const cached = localStorage.getItem(
        getLiveRefreshCacheKey(String(startTime)),
      );
      if (!cached) return;
      liveRefreshTrackerRef.current = JSON.parse(cached) as Partial<
        Record<LivePhaseKey, LiveRefreshPhaseState>
      >;
    } catch (err) {
      log.warn('Failed to restore live refresh tracker cache:', err);
    }
  }, [getLiveRefreshCacheKey, startTime]);

  useEffect(() => {
    const phaseKey = getLivePhaseKey(turn);
    const offeringIds = (songStats ?? [])
      .map((song) => song.id)
      .sort((a, b) => a - b);
    const offeringSignature = offeringIds.join(',');

    const tracker =
      liveRefreshTrackerRef.current[phaseKey] ??
      ({
        currentProgress: 0,
        lastOfferingSignature: offeringSignature,
      } satisfies LiveRefreshPhaseState);

    if (
      tracker.lastOfferingSignature &&
      tracker.lastOfferingSignature !== offeringSignature
    ) {
      tracker.currentProgress += 1;
      tracker.lastOfferingSignature = offeringSignature;
    } else if (!tracker.lastOfferingSignature) {
      tracker.lastOfferingSignature = offeringSignature;
    }

    liveRefreshTrackerRef.current[phaseKey] = tracker;
    setLiveRefreshHint(buildLiveRefreshHint(phaseKey, tracker.currentProgress));
  }, [songStats, turn]);

  useEffect(() => {
    if (startTime == null) return;
    try {
      localStorage.setItem(
        getLiveRefreshCacheKey(String(startTime)),
        JSON.stringify(liveRefreshTrackerRef.current),
      );
    } catch (err) {
      log.warn('Failed to cache live refresh tracker:', err);
    }
  }, [getLiveRefreshCacheKey, liveRefreshHint, startTime]);

  useEffect(() => {
    if (livePoolIds.length === 0) return;
    if (lastTurnRef.current != null && turn < lastTurnRef.current) {
      autoSelectPoolKeyRef.current = null;
    }
    lastTurnRef.current = turn;
    const { year, month } = getGameTimeByTurn(turn);
    const poolKey =
      year <= 1
        ? 'year1'
        : year === 2 && month <= 6
          ? 'year2_h1'
          : year === 2
            ? 'year2_h2'
            : 'year3';
    if (autoSelectPoolKeyRef.current === poolKey) return;
    autoSelectPoolKeyRef.current = poolKey;
    setLiveSelectedIds((prev) => {
      const next = new Set<number>(prev);
      let maxWeight = 0;
      livePoolIds.forEach((id) => {
        const song = LIVE_SQUARE_MAP[id];
        const weight = song?.weight ?? 0;
        if (weight > maxWeight) maxWeight = weight;
      });
      livePoolIds.forEach((id) => {
        const song = LIVE_SQUARE_MAP[id];
        if (song && song.weight === maxWeight) {
          next.add(id);
        }
      });
      return next;
    });
  }, [livePoolIds, turn]);

  return (
    <>
      <VitalPanel charInfo={charInfo} />

      <section className="mt-2">
        <div className="grid items-start justify-start gap-3 lg:grid-cols-[max-content_minmax(360px,1fr)]">
          <div className="max-w-full">
            <LiveRefreshTracker
              pattern={liveRefreshPattern}
              progress={liveRefreshHint?.purchasesSinceLastRefresh ?? 0}
              onJump={(index) => {
                const phaseKey = getLivePhaseKey(turn);
                const offeringSignature = (songStats ?? [])
                  .map((song) => song.id)
                  .sort((a, b) => a - b)
                  .join(',');
                liveRefreshTrackerRef.current[phaseKey] = {
                  currentProgress: index,
                  lastOfferingSignature: offeringSignature,
                };
                setLiveRefreshHint(buildLiveRefreshHint(phaseKey, index));
              }}
            />
            <div className="mt-3 grid grid-cols-3 gap-3 justify-items-start justify-content-start">
              {(songStats ?? []).map((song) => (
                <SongStatusCard
                  key={song.id}
                  id={song.id}
                  title={song.title}
                  attributes={song.attributes}
                  notes={song.notes}
                  noteStat={noteStat}
                  previewNoteStat={trainingPreviewNoteStat ?? undefined}
                  onHoverChange={(id, isHovering) =>
                    setHoveredSongId((prev) => {
                      if (isHovering) return id;
                      return prev === id ? null : prev;
                    })
                  }
                  recommended={recommendedIds.has(song.id)}
                  recommendedReason={
                    recommendedIds.has(song.id)
                      ? liveSelectedIds.has(song.id)
                        ? '预购歌曲'
                        : '不影响其他歌曲'
                      : undefined
                  }
                  trainingCommandsByNote={(() => {
                    const noteKeys = Object.keys(song.notes) as Array<NoteType>;
                    const perNote: Partial<Record<NoteType, number[]>> = {};
                    noteKeys.forEach((key) => {
                      const ids = Array.from(
                        trainingCommandsByNote.get(key) ?? [],
                      );
                      if (ids.length > 0) {
                        perNote[key] = ids;
                      }
                    });
                    return Object.keys(perNote).length > 0
                      ? perNote
                      : undefined;
                  })()}
                  remainingPurchasesToRefresh={
                    liveRefreshHint?.coursesToRefreshFromCurrent
                  }
                  purchaseProbabilityYear={doubleLessonYear}
                  hidePurchaseProbability={
                    liveRefreshHint?.isCurrentProgressPurple ?? false
                  }
                  reserveProbability={
                    reserveProbabilityBySongId.get(song.id) ?? null
                  }
                />
              ))}
            </div>
          </div>
          <section className="h-full">
            <LivePlan
              turn={turn}
              noteStat={noteStat}
              previewNoteStat={previewNoteStat ?? null}
              purchasedLiveIds={livePurchasedIds}
              selectedIds={liveSelectedIds}
              sellingIds={new Set((songStats ?? []).map((s) => s.id))}
              trainingLabelsByNote={trainingLabelsByNote}
              onToggleSelect={(id) =>
                setLiveSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) {
                    next.delete(id);
                  } else {
                    next.add(id);
                  }
                  return next;
                })
              }
            />
          </section>
        </div>
      </section>

      <TrainingEventsSection
        charInfo={charInfo}
        currentNoteStat={noteStat}
        warningNoteTypes={plannedMissingNoteTypes}
        liveSpecialtyRateBonus={specialtyLiveEffectRate ?? 0}
        onTrainingHoverChange={setHoveredCommandId}
      />
    </>
  );
}
