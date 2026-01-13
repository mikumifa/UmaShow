import { useState, useEffect, useMemo } from 'react';
import { Battery } from 'lucide-react';
import log from 'electron-log';
import { type NoteStat, CharInfo, mergeCharInfo } from 'types/gameTypes';
import {
  getLivePoolIdsByTurn,
  LIVE_SQUARE_MAP,
} from 'constant/live/liveSchedule';
import TrainingCard from 'renderer/components/TrainingCard';
import EventCard from 'renderer/components/EventCard';
import GameStartScreen from 'renderer/components/GameStartScreen';
import SongStatusCard, {
  type NoteType,
} from 'renderer/components/SongStatusCard';
import LivePlan from 'renderer/components/LivePlan';
import { loadUMDB } from 'renderer/utils/umdb';

export default function MonitorDashboard() {
  const [charInfo, setCharInfo] = useState<CharInfo | null>(() => {
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

  const livePoolIds = useMemo(() => {
    if (!charInfo) return [];
    const ids = getLivePoolIdsByTurn(charInfo.gameStats.turn);
    const purchased = new Set(charInfo.livePurchasedIds ?? []);
    return ids.filter((id) => !purchased.has(id));
  }, [charInfo]);

  useEffect(() => {
    if (livePoolIds.length === 0) return;
    setLiveSelectedIds((prev) => {
      const next = new Set<number>();
      livePoolIds.forEach((id) => {
        if (prev.has(id)) next.add(id);
      });
      if (next.size === 0) {
        livePoolIds.forEach((id) => {
          const song = LIVE_SQUARE_MAP[id];
          if (song && song.weight >= 4) {
            next.add(id);
          }
        });
      }
      return next;
    });
  }, [livePoolIds]);

  useEffect(() => {
    const removeCharInfoListener = window.electron.packetListener.onCharInfo(
      (incoming: CharInfo) =>
        setCharInfo((prev) => {
          if (!prev) return incoming;
          const ret = mergeCharInfo(prev, incoming);
          return ret;
        }),
    );
    loadUMDB()
      .then(() => setReady(true))
      .catch((err) => {
        log.error('UMDB load failed:', err);
      });
    return () => {
      removeCharInfoListener?.();
    };
  }, []);

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

  return ready && charInfo ? (
    <div className="p-4 flex flex-col gap-4 bg-gray-100 min-h-screen">
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
                    : (charInfo.stats.vital.value / charInfo.stats.vital.max) *
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
              trainingCommandIds={(() => {
                const noteKeys = Object.keys(song.notes) as Array<
                  keyof NoteStat
                >;
                const ids = noteKeys
                  .filter((key) => (song.notes[key] ?? 0) > 0)
                  .flatMap((key) =>
                    Array.from(trainingCommandsByNote.get(key) ?? []),
                  );
                return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
              })()}
              trainingCommandsByNote={(() => {
                const noteKeys = Object.keys(song.notes) as Array<NoteType>;
                const perNote: Partial<Record<NoteType, number[]>> = {};
                noteKeys.forEach((key) => {
                  const ids = Array.from(trainingCommandsByNote.get(key) ?? []);
                  if (ids.length > 0) {
                    perNote[key] = ids;
                  }
                });
                return Object.keys(perNote).length > 0 ? perNote : undefined;
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
    </div>
  ) : (
    <GameStartScreen />
  );
}
