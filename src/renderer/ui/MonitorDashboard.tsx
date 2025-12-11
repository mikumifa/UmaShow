import { useState, useEffect } from 'react';
import { Battery } from 'lucide-react';
import log from 'electron-log';
import { CharInfo, mergeCharInfo } from 'types/gameTypes';
import StatBox from 'renderer/components/StatBox';
import TrainingCard from 'renderer/components/TrainingCard';
import EventCard from 'renderer/components/EventCard';
import GameStartScreen from 'renderer/components/GameStartScreen';
import { loadUMDB } from 'renderer/utils/umdb';

export default function MonitorDashboard() {
  const [charInfo, setCharInfo] = useState<CharInfo | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const removeCharInfoListener = window.electron.packetListener.onCharInfo(
      (incoming: CharInfo) =>
        setCharInfo((prev) => {
          if (!prev) return incoming;
          return mergeCharInfo(prev, incoming);
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

  return ready && charInfo ? (
    <div className="p-4 flex flex-col gap-4 bg-gray-100 min-h-screen">
      {/* =================== VITAL =================== */}
      <div className="flex items-center gap-3 w-full">
        <div className="shrink-0 bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center justify-center min-w-[100px]">
          <span className="text-gray-500 mr-2 text-sm font-medium">Turn</span>
          <span className="font-bold text-blue-600 text-2xl">
            {charInfo.gameStats.turn}
          </span>
        </div>
        <section className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
          {/* 图标和标题 */}
          <div className="flex items-center gap-2 text-green-600 font-bold shrink-0">
            <Battery size={24} />
            <span>体力</span>
          </div>

          {/* 进度条容器 */}
          <div className="flex-1 relative h-6 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
            <div
              className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                // eslint-disable-next-line no-nested-ternary
                (charInfo.stats.vital.value / charInfo.stats.vital.max) * 100 >
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

          {/* 数值显示 */}
          <div className="text-xl font-black text-gray-700 shrink-0 min-w-[80px] text-right">
            {charInfo.stats.vital.value}
            <span className="text-xs text-gray-400 font-normal">
              /{charInfo.stats.vital.max}
            </span>
          </div>
        </section>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-4 bg-gray-200 rounded-xl shadow-inner border border-gray-300">
        <StatBox
          keyName="speed"
          value={charInfo.stats.speed.value}
          max={charInfo.stats.speed.max}
        />
        <StatBox
          keyName="stamina"
          value={charInfo.stats.stamina.value}
          max={charInfo.stats.stamina.max}
        />
        <StatBox
          keyName="power"
          value={charInfo.stats.power.value}
          max={charInfo.stats.power.max}
        />
        <StatBox
          keyName="guts"
          value={charInfo.stats.guts.value}
          max={charInfo.stats.guts.max}
        />
        <StatBox
          keyName="wiz"
          value={charInfo.stats.wiz.value}
          max={charInfo.stats.wiz.max}
        />
        <StatBox
          keyName="skillPoint"
          value={charInfo.stats.skillPoint}
          max={9999}
        />
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
