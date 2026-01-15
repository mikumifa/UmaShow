/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable promise/always-return */
/* eslint-disable no-nested-ternary */
/* eslint-disable promise/catch-or-return */
import { useState, useEffect, useMemo, useRef } from 'react';
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
import TrainingCard from 'renderer/components/TrainingCard';
import EventCard from 'renderer/components/EventCard';
import EventDetailRow, {
  type EventDetailOption,
} from 'renderer/components/EventDetailRow';
import GameStartScreen from 'renderer/components/GameStartScreen';
import SongStatusCard, {
  type NoteType,
} from 'renderer/components/SongStatusCard';
import LivePlan from 'renderer/components/LivePlan';
import { loadUMDB } from 'renderer/utils/umdb';
import { getRecommendedSongIds } from 'renderer/utils/liveRecommend';

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
  const [liveSelectedIds, setLiveSelectedIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [showPhonePanel, setShowPhonePanel] = useState(false);
  const [autoPhonePanel, setAutoPhonePanel] = useState(false);
  const [phonePanelWidth, setPhonePanelWidth] = useState(360);
  const resizingRef = useRef(false);
  const [windowList, setWindowList] = useState<
    Array<{ id: number; title: string; pid: number }>
  >([]);
  const [selectedWindowId, setSelectedWindowId] = useState<number | ''>('');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [windowLoading, setWindowLoading] = useState(false);

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

  const previewNoteStat = useMemo(() => {
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

  const recommendedIds = useMemo(() => {
    if (!charInfo) return new Set<number>();
    const effectiveNoteStat = previewNoteStat ?? charInfo.noteStat;
    return getRecommendedSongIds({
      selectedIds: liveSelectedIds,
      noteStat: effectiveNoteStat,
      songStats: charInfo.songStats ?? [],
    });
  }, [charInfo, liveSelectedIds, previewNoteStat]);

  const livePoolIds = useMemo(() => {
    if (!charInfo) return [];
    const ids = getLivePoolIdsByTurn(charInfo.gameStats.turn);
    const purchased = new Set(charInfo.livePurchasedIds ?? []);
    return ids.filter((id) => !purchased.has(id));
  }, [charInfo]);

  useEffect(() => {
    if (livePoolIds.length === 0) return;
    setLiveSelectedIds((prev) => {
      const next = new Set<number>(prev);
      const purchasedSet = new Set(charInfo?.livePurchasedIds ?? []);
      purchasedSet.forEach((id) => next.delete(id));

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
  }, [livePoolIds, charInfo?.livePurchasedIds]);

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
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,max-content))] justify-items-start justify-content-start">
              {(charInfo.songStats ?? []).map((song) => (
                // eslint-disable-next-line react/jsx-props-no-spreading
                <SongStatusCard
                  key={song.id}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...song}
                  noteStat={charInfo.noteStat}
                  previewNoteStat={previewNoteStat ?? undefined}
                  recommended={recommendedIds.has(song.id)}
                  recommendedReason={
                    recommendedIds.has(song.id)
                      ? liveSelectedIds.has(song.id)
                        ? '当前为预购歌曲'
                        : '购买当前课程不影响预购歌曲的购买'
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
                />
              ))}
              {/* =================== LIVE PLAN =================== */}
              <section>
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
