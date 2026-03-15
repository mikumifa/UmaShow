/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable promise/always-return */
/* eslint-disable no-nested-ternary */
/* eslint-disable promise/catch-or-return */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Battery } from 'lucide-react';
import log from 'electron-log';
import {
  type NoteStat,
  CharInfo,
  COMMAND_TARGET_TYPE_MAP,
  mergeCharInfo,
  TARGET_TYPE,
} from 'types/gameTypes';
import {
  getLivePoolIdsByTurn,
  LIVE_SQUARE_MAP,
} from 'constant/live/liveSchedule';
import { getGameTimeByTurn } from 'constant/gameStat';
import TrainingCard from 'renderer/components/TrainingCard';
import EventCard from 'renderer/components/EventCard';
import EventDetailRow, {
  type EventDetailOption,
} from 'renderer/components/EventDetailRow';
import GameStartScreen from 'renderer/components/GameStartScreen';
import LiveRefreshTracker, {
  normalizeSequenceProgress,
  parseSequence,
} from 'renderer/components/LiveRefreshTracker';
import SongStatusCard from 'renderer/components/SongStatusCard';
import { type NoteType } from 'renderer/components/NoteStyles';
import LivePlan from 'renderer/components/LivePlan';
import { getMissingNoteTypes } from 'renderer/components/MinNoteTransfer';
import { type DoubleLessonYear } from 'renderer/utils/liveCourseProbability';
import { loadUMDB } from 'renderer/utils/umdb';
import { getRecommendedSongIds } from 'renderer/utils/liveRecommend';

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

export default function MonitorDashboard() {
  const [charInfo, setCharInfo] = useState<CharInfo | null>(() => {
    if (
      process.env.NODE_ENV !== 'development' &&
      process.env.DEBUG_PROD !== 'true'
    ) {
      return null;
    }
    try {
      const cached = localStorage.getItem('monitorDashboard.charInfo');
      return cached ? (JSON.parse(cached) as CharInfo) : null;
    } catch (err) {
      log.warn('Failed to load cached charInfo:', err);
      return null;
    }
  });
  const [ready, setReady] = useState(false);
  const [hoveredCommandId, setHoveredCommandId] = useState<number | null>(null);
  const [hoveredSongId, setHoveredSongId] = useState<number | null>(null);
  const [liveSelectedIds, setLiveSelectedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [showPhonePanel, setShowPhonePanel] = useState(false);
  const [autoPhonePanel, setAutoPhonePanel] = useState(false);
  const [phonePanelWidth, setPhonePanelWidth] = useState(360);
  const resizingRef = useRef(false);
  const autoSelectPoolKeyRef = useRef<string | null>(null);
  const lastTurnRef = useRef<number | null>(null);
  const lastStartTimeRef = useRef<string | null>(null);
  const liveRefreshTrackerRef = useRef<
    Partial<Record<LivePhaseKey, LiveRefreshPhaseState>>
  >({});
  const [windowList, setWindowList] = useState<
    Array<{ id: number; title: string; pid: number }>
  >([]);
  const [selectedWindowId, setSelectedWindowId] = useState<number | ''>('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [windowLoading, setWindowLoading] = useState(false);
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
    if (!charInfo) return null;
    return getDoubleLessonYearByTurn(charInfo.gameStats.turn);
  }, [charInfo]);

  const trainingCommandsByNote = useMemo(() => {
    const map = new Map<keyof NoteStat, Set<number>>();
    if (!charInfo?.liveCommands) return map;
    const performanceTypeMap: Record<number, keyof NoteStat> = {
      1: 'da',
      2: 'pa',
      3: 'vo',
      4: 'vi',
      5: 'me',
    };
    charInfo.liveCommands.forEach((live) => {
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
  }, [charInfo?.liveCommands]);

  const trainingLabelsByNote = useMemo(() => {
    const trainingLabelMap: Record<number, string> = {
      [TARGET_TYPE.SPEED]: '\u901f',
      [TARGET_TYPE.POWER]: '\u529b',
      [TARGET_TYPE.WIZ]: '\u667a',
      [TARGET_TYPE.GUTS]: '\u6bc5',
      [TARGET_TYPE.STAMINA]: '\u8010',
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
    if (!charInfo?.noteStat || !charInfo?.liveCommands) return null;
    if (!hoveredCommandId) return null;
    const liveCommand = charInfo.liveCommands.find(
      (live) => live.commandId === hoveredCommandId,
    );
    if (!liveCommand?.performance?.length) return null;
    const next = {
      da: { ...charInfo.noteStat.da },
      pa: { ...charInfo.noteStat.pa },
      vo: { ...charInfo.noteStat.vo },
      vi: { ...charInfo.noteStat.vi },
      me: { ...charInfo.noteStat.me },
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
  }, [charInfo?.noteStat, charInfo?.liveCommands, hoveredCommandId]);

  const previewNoteStat = useMemo(() => {
    const baseNoteStat = trainingPreviewNoteStat ?? charInfo?.noteStat;
    if (!baseNoteStat || hoveredSongId == null) {
      return trainingPreviewNoteStat;
    }
    const hoveredSong = charInfo?.songStats?.find(
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
  }, [
    charInfo?.noteStat,
    charInfo?.songStats,
    hoveredSongId,
    trainingPreviewNoteStat,
  ]);

  const recommendedIds = useMemo(() => {
    if (!charInfo) return new Set<number>();
    const effectiveNoteStat = trainingPreviewNoteStat ?? charInfo.noteStat;
    return getRecommendedSongIds({
      selectedIds: liveSelectedIds,
      noteStat: effectiveNoteStat,
      songStats: charInfo.songStats ?? [],
    });
  }, [charInfo, liveSelectedIds, trainingPreviewNoteStat]);

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

  const plannedMissingNoteTypes = useMemo(
    () => getMissingNoteTypes(charInfo?.noteStat, selectedNoteCosts),
    [charInfo?.noteStat, selectedNoteCosts],
  );

  const livePoolIds = useMemo(() => {
    if (!charInfo) return [];
    const ids = getLivePoolIdsByTurn(charInfo.gameStats.turn);
    const purchased = new Set(charInfo.livePurchasedIds ?? []);
    return ids.filter((id) => !purchased.has(id));
  }, [charInfo]);

  useEffect(() => {
    if (!charInfo) return;
    setLiveSelectedIds((prev) => {
      const next = new Set<number>(prev);
      const purchasedSet = new Set(charInfo.livePurchasedIds ?? []);
      purchasedSet.forEach((id) => next.delete(id));
      return next;
    });
  }, [charInfo]);

  useEffect(() => {
    const startTime = charInfo?.gameStats.startTime;
    if (startTime == null) return;

    const startTimeKey = String(startTime);
    if (
      lastStartTimeRef.current != null &&
      lastStartTimeRef.current !== startTimeKey
    ) {
      resetRunScopedState();
    }
    lastStartTimeRef.current = startTimeKey;
  }, [charInfo?.gameStats.startTime, resetRunScopedState]);

  useEffect(() => {
    const startTime = charInfo?.gameStats.startTime;
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
  }, [charInfo?.gameStats.startTime, getLiveRefreshCacheKey]);

  useEffect(() => {
    if (!charInfo) return;

    const phaseKey = getLivePhaseKey(charInfo.gameStats.turn);
    const offeringIds = (charInfo.songStats ?? [])
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
  }, [charInfo, charInfo?.gameStats.turn, charInfo?.songStats]);

  useEffect(() => {
    const startTime = charInfo?.gameStats.startTime;
    if (startTime == null) return;
    try {
      localStorage.setItem(
        getLiveRefreshCacheKey(String(startTime)),
        JSON.stringify(liveRefreshTrackerRef.current),
      );
    } catch (err) {
      log.warn('Failed to cache live refresh tracker:', err);
    }
  }, [charInfo?.gameStats.startTime, getLiveRefreshCacheKey, liveRefreshHint]);

  useEffect(() => {
    if (!charInfo || livePoolIds.length === 0) return;
    const { turn } = charInfo.gameStats;
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
  }, [charInfo, livePoolIds]);

  useEffect(() => {
    const removeCharInfoListener = window.electron.packetListener.onCharInfo(
      (incoming: CharInfo) =>
        setCharInfo((prev) => {
          if (!prev) return incoming;
          const ret = mergeCharInfo(prev, incoming);
          return ret;
        }),
    );
    const removePhonePanelToggle = window.electron.utils.ui.onTogglePhonePanel(
      () => {
        setAutoPhonePanel(false);
        setShowPhonePanel((prev) => !prev);
      },
    );
    const removeFullscreenChanged =
      window.electron.utils.ui.onFullscreenChanged((fullScreen) => {
        if (fullScreen) {
          setAutoPhonePanel(true);
          setShowPhonePanel(true);
        } else if (autoPhonePanel) {
          setShowPhonePanel(false);
          setAutoPhonePanel(false);
        }
      });
    loadUMDB()
      .then(() => setReady(true))
      .catch((err) => {
        log.error('UMDB load failed:', err);
      });
    return () => {
      removeCharInfoListener?.();
      removePhonePanelToggle?.();
      removeFullscreenChanged?.();
    };
  }, [autoPhonePanel]);

  useEffect(() => {
    if (!charInfo) return;
    try {
      localStorage.setItem(
        'monitorDashboard.charInfo',
        JSON.stringify(charInfo),
      );
    } catch (err) {
      log.warn('Failed to cache charInfo:', err);
    }
  }, [charInfo]);

  const refreshWindowList = () => {
    setWindowLoading(true);
    window.electron.utils.windowControl
      .listWindows()
      .then((list) => {
        setWindowList(Array.isArray(list) ? list : []);
      })
      .finally(() => {
        setWindowLoading(false);
      });
  };

  useEffect(() => {
    if (showPhonePanel) {
      refreshWindowList();
    }
  }, [showPhonePanel]);

  useEffect(() => {
    if (selectedWindowId === '') return;
    window.electron.utils.windowControl.setTopmost(
      Number(selectedWindowId),
      pinEnabled,
    );
  }, [selectedWindowId, pinEnabled]);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!resizingRef.current) return;
      const nextWidth = window.innerWidth - event.clientX - 16;
      setPhonePanelWidth(Math.max(0, nextWidth));
    };
    const handleUp = () => {
      resizingRef.current = false;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('monitorDashboard.phonePanel');
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        width?: number;
        windowId?: number;
        pinEnabled?: boolean;
      };
      if (typeof parsed.width === 'number') {
        setPhonePanelWidth(parsed.width);
      }
      if (typeof parsed.windowId === 'number') {
        setSelectedWindowId(parsed.windowId);
      }
      if (typeof parsed.pinEnabled === 'boolean') {
        setPinEnabled(parsed.pinEnabled);
      }
    } catch (err) {
      log.warn('Failed to load phone panel cache:', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'monitorDashboard.phonePanel',
        JSON.stringify({
          width: phonePanelWidth,
          windowId: selectedWindowId === '' ? undefined : selectedWindowId,
          pinEnabled,
        }),
      );
    } catch (err) {
      log.warn('Failed to save phone panel cache:', err);
    }
  }, [phonePanelWidth, selectedWindowId, pinEnabled]);

  const eventDetailRows = (charInfo?.gameEvents ?? [])
    .map((event) => {
      const detail = charInfo?.eventDetails?.[event.eventId];
      if (!detail) {
        return null;
      }
      const options: EventDetailOption[] = detail.optionList.map((opt) => ({
        option: opt.option,
        gainList: opt.gainList,
      }));
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        options: options.filter((opt) => opt.gainList.length > 0),
      };
    })
    .filter(
      (
        row,
      ): row is {
        eventId: number;
        eventName: string;
        options: EventDetailOption[];
      } => !!row && row.options.length > 0,
    );

  return ready && charInfo ? (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* =================== VITAL =================== */}
          <div className="flex items-center gap-3 w-full">
            <section className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-green-600 font-bold shrink-0">
                  <Battery size={22} />
                  <span>体力</span>
                </div>

                <div className="flex-1 relative h-5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                  <div
                    className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                      // eslint-disable-next-line no-nested-ternary
                      (charInfo.stats.vital.value / charInfo.stats.vital.max) *
                        100 >
                      50
                        ? 'bg-gradient-to-r from-green-500 to-green-400'
                        : (charInfo.stats.vital.value /
                              charInfo.stats.vital.max) *
                              100 >
                            30
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-400'
                          : 'bg-gradient-to-r from-red-500 to-red-400'
                    }`}
                    style={{
                      width: `${(charInfo.stats.vital.value / charInfo.stats.vital.max) * 100}%`,
                    }}
                  />
                </div>

                <div className="text-base font-black text-gray-700 shrink-0 min-w-[70px] text-right">
                  {charInfo.stats.vital.value}
                  <span className="text-[10px] text-gray-400 font-normal">
                    /{charInfo.stats.vital.max}
                  </span>
                </div>
              </div>
            </section>
          </div>
          {/* =================== SONG STATUS =================== */}
          <section className="mt-2">
            <div className="grid items-start justify-start gap-3 lg:grid-cols-[max-content_minmax(360px,1fr)]">
              <div className="max-w-full">
                <LiveRefreshTracker
                  pattern={liveRefreshPattern}
                  progress={liveRefreshHint?.purchasesSinceLastRefresh ?? 0}
                  onJump={(index) => {
                    if (!charInfo) return;
                    const phaseKey = getLivePhaseKey(charInfo.gameStats.turn);
                    const offeringSignature = (charInfo.songStats ?? [])
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
                  {(charInfo.songStats ?? []).map((song) => (
                    <SongStatusCard
                      key={song.id}
                      id={song.id}
                      title={song.title}
                      attributes={song.attributes}
                      notes={song.notes}
                      noteStat={charInfo.noteStat}
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
                      trainingCommandIds={(() => {
                        const noteKeys = Object.keys(song.notes) as Array<
                          keyof NoteStat
                        >;
                        const ids = noteKeys
                          .filter((key) => (song.notes[key] ?? 0) > 0)
                          .flatMap((key) =>
                            Array.from(trainingCommandsByNote.get(key) ?? []),
                          );
                        return ids.length > 0
                          ? Array.from(new Set(ids))
                          : undefined;
                      })()}
                      trainingCommandsByNote={(() => {
                        const noteKeys = Object.keys(
                          song.notes,
                        ) as Array<NoteType>;
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
                      purchaseProbabilityYear={doubleLessonYear ?? undefined}
                      hidePurchaseProbability={
                        liveRefreshHint?.isCurrentProgressPurple ?? false
                      }
                    />
                  ))}
                </div>
              </div>
              <section className="h-full">
                <LivePlan
                  turn={charInfo.gameStats.turn}
                  noteStat={charInfo.noteStat}
                  previewNoteStat={previewNoteStat ?? null}
                  purchasedLiveIds={charInfo.livePurchasedIds}
                  selectedIds={liveSelectedIds}
                  sellingIds={
                    new Set((charInfo.songStats ?? []).map((s) => s.id))
                  }
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
          {/* =================== TRAINING COMMANDS =================== */}
          <section className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {charInfo.commands
                .filter((cmd) => {
                  return (
                    cmd.trainingPartners?.length > 0 ||
                    cmd.tipsPartners?.length > 0 ||
                    cmd.params?.length > 0
                  );
                })
                .map((cmd) => (
                  <TrainingCard
                    key={cmd.commandId}
                    command={cmd}
                    partnerStats={charInfo.partnerStats}
                    liveCommands={charInfo.liveCommands}
                    currentStats={charInfo.stats}
                    currentNoteStat={charInfo.noteStat}
                    warningNoteTypes={plannedMissingNoteTypes}
                    liveSpecialtyRateBonus={
                      charInfo.gameStats.specialtyLiveEffectRate ?? 0
                    }
                    onHoverChange={(command, isHovering) =>
                      setHoveredCommandId(isHovering ? command.commandId : null)
                    }
                  />
                ))}
              {charInfo.gameEvents.map((ev) => (
                <EventCard key={ev.eventId} event={ev} />
              ))}
            </div>
          </section>

          {eventDetailRows.length > 0 && (
            <section className="mt-2 space-y-3">
              {eventDetailRows.map((row) => (
                <EventDetailRow
                  key={row.eventId}
                  eventName={row.eventName}
                  options={row.options}
                />
              ))}
            </section>
          )}
        </div>
        <aside className="shrink-0 hidden xl:block">
          {showPhonePanel ? (
            <div className="relative">
              <div
                className="sticky top-4 rounded-xl border-2 border-dashed border-gray-300 bg-white/70 h-[calc(100vh-2rem)]"
                style={{ width: phonePanelWidth }}
              >
                <div className="px-3 py-2 text-sm font-semibold text-gray-500">
                  {'\u6a21\u62df\u5668\u9884\u7559\u533a'}
                </div>
                <div className="px-3 pb-3 text-xs text-gray-600 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 max-w-[260px] rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                      value={selectedWindowId}
                      onChange={(event) =>
                        setSelectedWindowId(
                          event.target.value === ''
                            ? ''
                            : Number(event.target.value),
                        )
                      }
                    >
                      <option value="">
                        {'\u9009\u62e9\u6a21\u62df\u5668\u7a97\u53e3...'}
                      </option>
                      {windowList.map((win) => (
                        <option key={win.id} value={win.id}>
                          {win.title} (PID {win.pid})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={refreshWindowList}
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                      disabled={windowLoading}
                    >
                      {windowLoading ? '\u52a0\u8f7d\u4e2d' : '\u5237\u65b0'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinEnabled((prev) => !prev)}
                    className={`w-full rounded border px-2 py-1 text-xs font-semibold ${
                      pinEnabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                    disabled={selectedWindowId === ''}
                  >
                    {pinEnabled
                      ? '\u53d6\u6d88\u7f6e\u9876\u6240\u9009\u7a97\u53e3'
                      : '\u7f6e\u9876\u6240\u9009\u7a97\u53e3'}
                  </button>
                </div>
              </div>
              <div
                className="absolute left-0 top-4 -translate-x-1/2 h-[calc(100vh-2rem)] w-3 cursor-col-resize"
                onMouseDown={() => {
                  resizingRef.current = true;
                }}
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  ) : (
    <GameStartScreen />
  );
}
