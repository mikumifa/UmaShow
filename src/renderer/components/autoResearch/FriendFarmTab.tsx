/* global RequestInit */
import { useEffect, useId, useRef, useState } from 'react';

type FarmState = {
  status: 'running' | 'paused' | 'stopped';
  stage: string;
  target_viewer_id: number;
  viewer_id: number;
  runs: number;
  rebuilds: number;
  retry_at: number;
  message: string;
  tp: number;
  potions: number;
  jewels: number;
};
type Response = { success: boolean; data: FarmState };
type Props = { request: <T>(path: string, init?: RequestInit) => Promise<T> };

export default function FriendFarmTab({ request }: Props) {
  const targetId = useId();
  const [state, setState] = useState<FarmState>();
  const [target, setTarget] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const api = useRef(request);
  api.current = request;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api.current<Response>('/api/account/friend-farm');
        if (alive) {
          setState(result.data);
          setTarget(
            (value) => value || String(result.data.target_viewer_id || ''),
          );
          setError('');
        }
      } catch (cause) {
        if (alive) setError((cause as Error).message);
      } finally {
        if (alive) timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  const control = async (action: 'start' | 'pause' | 'resume' | 'stop') => {
    setBusy(true);
    setError('');
    try {
      const result = await api.current<Response>('/api/account/friend-farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target_viewer_id: Number(target) }),
      });
      setState(result.data);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const active = state?.status === 'running' || state?.status === 'paused';
  const remaining = Math.max(
    0,
    Math.ceil((state?.retry_at || 0) - Date.now() / 1000),
  );
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">刷友情点</h2>
      <p className="text-sm text-red-500">
        当前选择的账号将作为消耗用小号：用完体力、体力药和可用于恢复的钻石后删除游戏资料，重新建号并循环。请勿选择要保留的账号。
      </p>
      <label htmlFor={targetId} className="block text-sm">
        接收友情点的大号游戏 ID
        <input
          id={targetId}
          aria-label="大号游戏 ID"
          className="ml-3 rounded border bg-transparent p-2"
          inputMode="numeric"
          value={target}
          disabled={active || busy}
          onChange={(event) => setTarget(event.target.value.replace(/\D/g, ''))}
        />
      </label>
      {!active && (
        <label
          htmlFor={`${targetId}-accepted`}
          className="flex items-center gap-2 text-sm"
        >
          <input
            id={`${targetId}-accepted`}
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          当前账号是可删除的废弃小号，允许耗尽资源并反复删除游戏资料
        </label>
      )}
      <div className="flex gap-3">
        {!active && (
          <button
            type="button"
            disabled={busy || !accepted || !Number(target) || !state}
            className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-40"
            onClick={() => control('start')}
          >
            开始循环
          </button>
        )}
        {state?.status === 'running' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => control('pause')}
          >
            暂停
          </button>
        )}
        {state?.status === 'paused' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => control('resume')}
          >
            继续
          </button>
        )}
        {active && (
          <button type="button" disabled={busy} onClick={() => control('stop')}>
            停止
          </button>
        )}
      </div>
      {state && (
        <>
          <p>
            状态：
            {
              { running: '运行中', paused: '已暂停', stopped: '已停止' }[
                state.status
              ]
            }
            {remaining > 0 ? ` · 等待 ${remaining} 秒` : ''}
          </p>
          <p>{state.message || '等待开始'}</p>
          <p className="text-sm">
            已完成借卡开局并放弃 {state.runs} 次 · 重建 {state.rebuilds} 次
          </p>
          <p className="text-sm">
            体力 {state.tp} · 体力药 {state.potions} · 钻石 {state.jewels}
          </p>
          <p className="text-xs opacity-70">
            次数为小号完成操作的记录；实际友情点到账以大号为准。暂停或停止在当前步骤结束后生效。
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
