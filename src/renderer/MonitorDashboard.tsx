import { useState, useEffect } from 'react';
import { Battery, Trophy } from 'lucide-react';
import './App.css';
import { CharInfo, mergeCharInfo } from '../types/gameTypes';
import StatBox from '../components/StatBox';
import TrainingCard from '../components/TrainingCard';
import EventCard from '../components/EventCard';

export default function MonitorDashboard() {
  const [charInfo, setCharInfo] = useState<CharInfo | null>(null);

  useEffect(() => {
    const removeCharInfoListener = window.electron.packetListener.onCharInfo(
      (incoming: CharInfo) =>
        setCharInfo((prev) => {
          if (!prev) return incoming;
          return mergeCharInfo(prev, incoming);
        }),
    );
    return () => {
      removeCharInfoListener?.();
    };
  }, []);

  return (
    <div className="p-4 flex flex-col gap-4 bg-gray-100 min-h-screen">
      {/* =================== HEADER =================== */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          <h1 className="text-xl font-bold text-gray-800">UmaShow</h1>
        </div>
        {charInfo && (
          <div className="bg-white px-4 py-2 rounded-full shadow-sm text-sm text-gray-600">
            Turn:{' '}
            <span className="font-bold text-blue-600">
              {charInfo.gameStats.turn}
            </span>
          </div>
        )}
      </header>

      {/* =================== VITAL =================== */}
      {charInfo && (
        <section className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
          <div className="flex items-center gap-2 text-green-600 font-bold">
            <Battery size={24} />
            <span>体力</span>
          </div>

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

          <div className="text-xl font-black text-gray-700">
            {charInfo.stats.vital.value}
            <span className="text-xs text-gray-400">
              /{charInfo.stats.vital.max}
            </span>
          </div>
        </section>
      )}

      {/* =================== STATS GRID =================== */}
      {charInfo && (
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
      )}
      {/* =================== TRAINING COMMANDS =================== */}
      {charInfo && (
        <section className="mt-4">
          <h2 className="text-lg font-bold text-gray-700 mb-3">🏋️ 训练选项</h2>

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
      )}

      {/* =================== EVENT DISPLAY =================== */}
      {/* <section className="event-only-container">
        <h2 className="section-title">🎯 Event</h2>

        {!currentEvent && <div className="event-placeholder">等待事件...</div>}

        {currentEvent && (
          <div className="card-details">
            {currentEvent.details.map((detail) => (
              <div key={detail.index} className="detail-row">
                <span className="opt-label">选项 {detail.index}</span>
                <span className="opt-values">
                  选: {detail.actual} / 正: {detail.expected}
                </span>
                <span className="opt-result">
                  {detail.isCorrect ? '✅' : '❌'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section> */}
    </div>
  );
}
