import { useState } from 'react';
import { UMDB } from 'renderer/utils/umdb';

type Horse = {
  trained_chara_id: number;
  card_id: number;
  rank_score: number;
  is_locked: number;
  use_type: number;
  create_time?: string;
};
type HallResponse = {
  success: boolean;
  removed_ids?: number[];
  data: {
    trained_chara_array: Horse[];
    trained_chara_favorite_array?: { trained_chara_id: number }[];
    room_match_entry_chara_id_array?: number[];
  };
};
type Props = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export default function TrainedCharactersTab({ request }: Props) {
  const [data, setData] = useState<HallResponse['data']>();
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const horses = data?.trained_chara_array || [];
  const name = (horse: Horse) =>
    UMDB.charaName(Math.floor(horse.card_id / 100)) || `角色 ${horse.card_id}`;
  const protectedIds = new Set([
    ...(data?.trained_chara_favorite_array || []).map(
      (row) => row.trained_chara_id,
    ),
    ...(data?.room_match_entry_chara_id_array || []),
  ]);
  const protectedHorse = (horse: Horse) =>
    Boolean(
      horse.is_locked ||
        horse.use_type ||
        protectedIds.has(horse.trained_chara_id),
    );
  const visible = horses.filter((horse) =>
    `${name(horse)} ${horse.trained_chara_id}`.includes(search.trim()),
  );
  const load = async () => {
    setBusy(true);
    setMessage('');
    setSelected([]);
    setConfirming(false);
    try {
      const response = await request<HallResponse>(
        '/api/account/trained-characters',
      );
      setData(response.data);
    } catch (error) {
      setData(undefined);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const transfer = async () => {
    setBusy(true);
    setConfirming(false);
    try {
      const result = await request<HallResponse>(
        '/api/account/trained-characters/transfer',
        {
          method: 'POST',
          body: JSON.stringify({ trained_chara_ids: selected }),
        },
      );
      setData(undefined);
      setSelected([]);
      setMessage(
        `已转队 ${result.removed_ids?.length || 0} 名马娘。请刷新列表。`,
      );
    } catch (error) {
      setData(undefined);
      setSelected([]);
      setMessage(`${(error as Error).message}；请刷新列表核实结果。`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto rounded-lg bg-white p-5">
      <h2 className="text-lg font-bold">殿堂马娘</h2>
      <p className="text-sm text-slate-600">
        先暂停养成并连接服务器账号。已收藏、正在使用或已报名的马娘不能转队。
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={load}
          className="rounded border px-4 py-2"
        >
          {busy ? '处理中…' : '刷新殿堂'}
        </button>
        <input
          aria-label="搜索殿堂马娘"
          value={search}
          disabled={busy || confirming}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索名称或殿堂 ID"
          className="rounded border px-3 py-2"
        />
        <button
          type="button"
          disabled={busy || confirming || !data}
          onClick={() =>
            setSelected(
              visible
                .filter((horse) => !protectedHorse(horse))
                .map((horse) => horse.trained_chara_id),
            )
          }
          className="rounded border px-3 py-2"
        >
          选择筛选结果
        </button>
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => setConfirming(true)}
          className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-40"
        >
          转队所选 {selected.length} 名
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-slate-700">
          {message}
        </p>
      )}
      {confirming && (
        <div
          role="alertdialog"
          aria-label="确认转队"
          className="rounded border border-red-300 bg-red-50 p-4"
        >
          <p>将永久转队以下 {selected.length} 名马娘，无法撤销：</p>
          <p className="my-3">
            {horses
              .filter((horse) => selected.includes(horse.trained_chara_id))
              .map((horse) => `${name(horse)} #${horse.trained_chara_id}`)
              .join('、')}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={transfer}
            className="mr-4 rounded bg-red-600 px-3 py-2 text-white"
          >
            确认转队
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            取消
          </button>
        </div>
      )}
      <p className="text-sm text-slate-500">
        {data
          ? `共 ${horses.length} 名，显示 ${visible.length} 名`
          : '点击刷新殿堂读取列表'}
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>选择</th>
            <th>马娘 / ID</th>
            <th>评分</th>
            <th>养成时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((horse) => (
            <tr key={horse.trained_chara_id} className="border-t">
              <td>
                <input
                  type="checkbox"
                  aria-label={`选择 ${name(horse)} #${horse.trained_chara_id}`}
                  disabled={busy || confirming || protectedHorse(horse)}
                  checked={selected.includes(horse.trained_chara_id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, horse.trained_chara_id]
                        : selected.filter(
                            (id) => id !== horse.trained_chara_id,
                          ),
                    )
                  }
                />
              </td>
              <td className="py-3">
                {name(horse)} #{horse.trained_chara_id}
              </td>
              <td>{horse.rank_score}</td>
              <td>{horse.create_time || '—'}</td>
              <td>{protectedHorse(horse) ? '受保护 / 使用中' : '可转队'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
