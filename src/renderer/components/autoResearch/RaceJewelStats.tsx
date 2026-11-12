import { CareerSessionRecord, RaceOption } from './types';

export function aggregateRaceJewels(records: CareerSessionRecord[]) {
  const rows = new Map<
    string,
    {
      key: string;
      programId: number;
      turn: number;
      raceName: string;
      source: string;
      races: number;
      drops: number;
      jewels: number;
      unknown: number;
    }
  >();
  const seen = new Set<string>();
  const seenRaces = new Set<string>();
  let missingRuns = 0;
  let unattributedJewels = 0;
  records.forEach((record) => {
    const runs = [
      ...(record.runs || []),
      ...(record.current ? [record.current] : []),
    ];
    runs.forEach((run) => {
      const runKey = `${record.uid}:${run.run_id || `${record.id}:${run.started_at}`}`;
      const sliceKey = `${record.id}:${runKey}`;
      if (seen.has(sliceKey)) return;
      seen.add(sliceKey);
      unattributedJewels += run.unattributed_jewels || 0;
      const races = run.g123_race_records || [];
      if (!races.length && (run.completed || run.discarded)) missingRuns += 1;
      races.forEach((race) => {
        if (!(race.program_id > 0)) return;
        const source = race.source || 'online';
        const key = `${source}:${race.program_id}:${race.turn}`;
        const occurrenceKey = `${runKey}:${key}`;
        if (seenRaces.has(occurrenceKey)) return;
        seenRaces.add(occurrenceKey);
        const row = rows.get(key) || {
          key,
          programId: race.program_id,
          turn: race.turn,
          raceName: race.race_name || '',
          source,
          races: 0,
          drops: 0,
          jewels: 0,
          unknown: 0,
        };
        row.races += 1;
        if (race.jewel_amount == null) {
          row.unknown += 1;
        } else {
          row.drops += race.jewel_amount > 0 ? 1 : 0;
          row.jewels += race.jewel_amount;
        }
        rows.set(key, row);
      });
    });
  });
  return {
    missingRuns,
    unattributedJewels,
    rows: [...rows.values()].sort(
      (a, b) =>
        a.turn - b.turn ||
        a.programId - b.programId ||
        a.source.localeCompare(b.source),
    ),
  };
}

export default function RaceJewelStats({
  records,
  races,
}: {
  records: CareerSessionRecord[];
  races: RaceOption[];
}) {
  const stats = aggregateRaceJewels(records);
  return (
    <div className="p-3 sm:p-5">
      <h3 className="text-section font-semibold text-slate-900">
        比赛钻石掉落统计
      </h3>
      <p className="mt-2 text-caption text-slate-500">
        掉落率 = 掉钻的比赛次数 ÷ 参赛次数。每场最多计 1 次掉落，0
        钻比赛也计入参赛次数。
      </p>
      {stats.missingRuns > 0 ? (
        <p className="mt-2 text-caption text-amber-700">
          {stats.missingRuns}{' '}
          次历史育成缺少逐场比赛记录，未计入下表；无法还原这些育成的逐场掉落率。
        </p>
      ) : null}
      {stats.unattributedJewels > 0 ? (
        <p className="mt-2 text-caption text-amber-700">
          另有 {stats.unattributedJewels} 钻缺少对应的比赛明细，未计入逐场统计。
        </p>
      ) : null}
      {stats.rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table
            className="w-full text-left text-data"
            aria-label="比赛钻石掉落统计"
          >
            <thead className="border-b border-slate-200 text-caption text-slate-500">
              <tr>
                <th scope="col" className="py-3 pr-2 font-medium">
                  比赛
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  掉落次数
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  参赛次数
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap py-3 pl-2 text-right font-medium"
                >
                  掉落率
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.rows.map((row) => {
                const race =
                  races.find(
                    (item) =>
                      item.program_id === row.programId &&
                      item.turn === row.turn,
                  ) || races.find((item) => item.program_id === row.programId);
                return (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      className="py-3 pr-2 font-medium text-slate-800"
                    >
                      {race?.name || row.raceName || `比赛 ${row.programId}`}
                      <span className="mt-1 block text-caption font-normal text-slate-500">
                        {row.source === 'offline' ? '离线' : '在线'} ·{' '}
                        {row.turn > 0 ? `第 ${row.turn} 回合` : '回合未知'}
                        {race?.date ? ` · ${race.date}` : ''}
                      </span>
                      {row.unknown > 0 ? (
                        <span className="block text-caption font-normal text-amber-700">
                          {row.unknown} 场奖励明细缺失
                        </span>
                      ) : null}
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums text-violet-700">
                      {row.unknown ? `≥${row.drops}` : row.drops}
                      <span className="block whitespace-nowrap text-caption text-slate-500">
                        {row.unknown ? '≥' : ''}
                        {row.jewels} 钻
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {row.races}
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums font-semibold text-violet-700">
                      {row.unknown
                        ? '—'
                        : `${((row.drops / row.races) * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-10 text-center text-data text-slate-500">
          暂无逐场比赛记录。新版采集完成的育成会在这里显示统计。
        </p>
      )}
    </div>
  );
}
