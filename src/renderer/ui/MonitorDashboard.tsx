/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
import { useEffect, useState, useRef } from 'react';
import log from 'electron-log';
import { CharInfo, mergeCharInfo } from 'types/gameTypes';
import GameStartScreen from 'renderer/components/GameStartScreen';
import { loadUMDB } from 'renderer/utils/umdb';
import IdolCupPanel from 'renderer/components/scenarios/idolCup/IdolCupPanel';
import VenusCupPanel from 'renderer/components/scenarios/venusCup/VenusCupPanel';

const renderScenarioPanel = (charInfo: CharInfo) => {
  switch (charInfo.scenarioType) {
    case 'venusCup':
      return <VenusCupPanel charInfo={charInfo} />;
    case 'idolCup':
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
  const [showPhonePanel, setShowPhonePanel] = useState(false);
  const [autoPhonePanel, setAutoPhonePanel] = useState(false);
  const [phonePanelWidth, setPhonePanelWidth] = useState(360);
  const resizingRef = useRef(false);

  useEffect(() => {
    const removeCharInfoListener = window.electron.packetListener.onCharInfo(
      (incoming: CharInfo) =>
        setCharInfo((prev) => {
          if (!prev) return incoming;
          return mergeCharInfo(prev, incoming);
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
      };
      if (typeof parsed.width === 'number') {
        setPhonePanelWidth(parsed.width);
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
        }),
      );
    } catch (err) {
      log.warn('Failed to save phone panel cache:', err);
    }
  }, [phonePanelWidth]);

  return ready && charInfo ? (
    <div className="min-h-screen p-4">
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {renderScenarioPanel(charInfo)}
        </div>
        <aside className="shrink-0 hidden xl:block">
          {showPhonePanel ? (
            <div className="relative">
              <div
                className="sticky top-4 rounded-xl border-2 border-dashed border-gray-300 bg-white/70 h-[calc(100vh-2rem)]"
                style={{ width: phonePanelWidth }}
              >
                <div className="px-3 py-2 text-sm font-semibold text-gray-500">
                  {'模拟器预留区'}
                </div>
                <div className="px-3 pb-3 text-xs text-gray-600">
                  {'用于在宽屏布局中预留模拟器显示区域。'}
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
