/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
import { useEffect, useState } from 'react';
import log from 'electron-log';
import { CharInfo, mergeCharInfo } from 'types/gameTypes';
import GameStartScreen from 'renderer/components/GameStartScreen';
import { loadUMDB } from 'renderer/utils/umdb';
import IdolCupPanel from 'renderer/components/scenarios/idolCup/IdolCupPanel';
import VenusCupPanel from 'renderer/components/scenarios/venusCup/VenusCupPanel';
import ArcPanel from 'renderer/components/scenarios/arc/ArcPanel';

const renderScenarioPanel = (charInfo: CharInfo) => {
  switch (charInfo.scenarioType) {
    case 'venusCup':
      return <VenusCupPanel charInfo={charInfo} />;
    case 'idolCup':
      return <IdolCupPanel charInfo={charInfo} />;
    case 'arc':
      return <ArcPanel charInfo={charInfo} />;
    case 'unknown':
    default:
      return <IdolCupPanel charInfo={charInfo} />;
  }
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
    <div className="min-h-screen p-4">
      <div className="flex min-w-0 flex-col gap-4">
        {renderScenarioPanel(charInfo)}
      </div>
    </div>
  ) : (
    <GameStartScreen />
  );
}
