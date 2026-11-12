import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SimulationStatus } from 'types/practiceRaceSimulation';

// The main process owns the task; this shared snapshot survives route changes.
let snapshot: SimulationStatus = { running: false, stopping: false };
const listeners = new Set<() => void>();
let disconnect: (() => void) | undefined;

function update(next: SimulationStatus) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!disconnect) {
    let active = true;
    let updated = false;
    const unsubscribe = window.electron.race.onRepeatSimulationStatus(
      (next) => {
        updated = true;
        update(next);
      },
    );
    window.electron.race
      .getRepeatSimulationStatus()
      .then((next) => {
        if (active && !updated) update(next);
        return undefined;
      })
      .catch(console.error);
    disconnect = () => {
      active = false;
      unsubscribe();
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      disconnect?.();
      disconnect = undefined;
    }
  };
}

export function usePracticeRaceSimulation() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export default function PracticeRaceSimulationStatus() {
  const status = usePracticeRaceSimulation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [stopError, setStopError] = useState('');
  const wasRunning = useRef(false);
  useEffect(() => {
    if (status.running && !wasRunning.current) {
      setDismissed(false);
      setStopError('');
    }
    wasRunning.current = status.running;
  }, [status.running]);
  if (!status.progress || (!status.running && dismissed)) return null;
  const archiveId = status.result?.archiveId ?? status.progress.archiveId;
  const stop = async () => {
    try {
      setStopError('');
      await window.electron.race.stopRepeatSimulation();
    } catch (error) {
      setStopError(`停止失败：${(error as Error).message}`);
    }
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
      <span className="flex min-w-0 flex-1 items-center gap-2" role="status">
        {status.running && (
          <Loader2 size={15} className="shrink-0 animate-spin" />
        )}
        <span className="break-words">
          重复模拟 · {status.progress.archiveName} ·{' '}
          {status.stopping
            ? '正在停止，等待当前操作结束…'
            : status.progress.detail}{' '}
          （{status.progress.current ?? 0}/{status.progress.total ?? 0}）
        </span>
      </span>
      {stopError && (
        <span role="alert" className="text-red-700">
          {stopError}
        </span>
      )}
      {archiveId && (
        <button
          type="button"
          className="rounded px-2 py-1 text-blue-700 hover:bg-blue-50"
          onClick={() => navigate('/races', { state: { archiveId } })}
        >
          查看存档
        </button>
      )}
      {status.running ? (
        <button
          type="button"
          disabled={status.stopping}
          onClick={stop}
          className="rounded px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {status.stopping ? '正在退出…' : '退出模拟'}
        </button>
      ) : (
        <button
          type="button"
          aria-label="收起模拟结果"
          onClick={() => setDismissed(true)}
          className="rounded p-1 hover:bg-slate-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
