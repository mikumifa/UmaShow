/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction } from 'react';
import { Gem, History, RefreshCw, Trash2, Trophy } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { horseIconPath } from './SelectionCards';
import { formatReportTime, panelClass } from './shared';
import {
  CareerSessionAttributes,
  CareerSessionRecord,
  CareerSessionRun,
  CareerSetting,
  Dashboard,
  G123RaceRecord,
  RaceOption,
} from './types';

type HistoryTabProps = {
  dashboard: Dashboard;
  selectedCareerRecords: CareerSessionRecord[] | null;
  setSelectedCareerRecords: Dispatch<
    SetStateAction<CareerSessionRecord[] | null>
  >;
  busy: string;
  historyCareerSetting?: CareerSetting;
  loadCareerHistory: (accountId: string) => Promise<void>;
  selectedAccountId: string;
  historyCareerSettingId: string;
  setHistoryCareerSettingId: Dispatch<SetStateAction<string>>;
  accountCareerSettings: CareerSetting[];
  historyCareerRecords: CareerSessionRecord[];
  deleteCareerHistory: (reportIds: string[]) => Promise<void>;
  races: RaceOption[];
};

const attributeItems = [
  ['speed', '速度'],
  ['stamina', '耐力'],
  ['power', '力量'],
  ['guts', '根性'],
  ['wit', '智力'],
] as const;

const emptyAttributes = (): CareerSessionAttributes => ({
  speed: 0,
  stamina: 0,
  power: 0,
  guts: 0,
  wit: 0,
});

const formatMetric = (value?: number) => {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
};

const raceCounts = (value?: Record<string, number>) => {
  const result: Record<string, number> = {};
  Object.entries(value || {}).forEach(([rawId, rawCount]) => {
    const raceId = Number(rawId);
    const count = Number(rawCount);
    if (Number.isInteger(raceId) && raceId > 0 && count > 0) {
      result[String(raceId)] = count;
    }
  });
  return result;
};

type AggregatedG123Race = {
  raceId: number;
  programId: number;
  turn: number;
  largeMarginCount: number;
  recordedAt: string;
};

const normalizedG123RaceRecords = (value?: G123RaceRecord[]) =>
  (Array.isArray(value) ? value : []).filter(
    (record) => Number(record?.program_id) > 0,
  );

const aggregateG123Races = (
  records: CareerSessionRecord[],
): AggregatedG123Race[] => {
  const aggregated = new Map<string, AggregatedG123Race>();
  records.forEach((record) => {
    const sources = [
      ...(record.runs || []),
      ...(record.current ? [record.current] : []),
    ];
    const raceRecords = sources.flatMap((source) =>
      normalizedG123RaceRecords(source.g123_race_records),
    );
    if (raceRecords.length) {
      raceRecords.forEach((raceRecord) => {
        const raceId = Number(raceRecord.race_id || 0);
        const programId = Number(raceRecord.program_id);
        const turn = Number(raceRecord.turn || 0);
        const key =
          raceId > 0 ? `race:${raceId}` : `program:${programId}:${turn}`;
        const previous = aggregated.get(key);
        aggregated.set(key, {
          raceId,
          programId,
          turn,
          largeMarginCount:
            (previous?.largeMarginCount || 0) +
            (raceRecord.large_margin ? 1 : 0),
          recordedAt:
            String(raceRecord.recorded_at || '') >
            String(previous?.recordedAt || '')
              ? String(raceRecord.recorded_at || '')
              : String(previous?.recordedAt || ''),
        });
      });
      return;
    }

    const sourceRows = sources.length ? sources : [record];
    const allRaceCounts: Record<string, number> = {};
    const largeCounts: Record<string, number> = {};
    sourceRows.forEach((source) => {
      Object.entries(raceCounts(source.g123_race_counts)).forEach(
        ([raceId, count]) => {
          allRaceCounts[raceId] = (allRaceCounts[raceId] || 0) + count;
        },
      );
      Object.entries(raceCounts(source.large_margin_race_counts)).forEach(
        ([raceId, count]) => {
          largeCounts[raceId] = (largeCounts[raceId] || 0) + count;
        },
      );
    });
    const raceIds = new Set([
      ...Object.keys(allRaceCounts),
      ...Object.keys(largeCounts),
    ]);
    raceIds.forEach((raceId) => {
      const programId = Number(raceId);
      const key = `${programId}:0`;
      const previous = aggregated.get(key);
      aggregated.set(key, {
        raceId: programId,
        programId,
        turn: 0,
        largeMarginCount:
          (previous?.largeMarginCount || 0) + (largeCounts[raceId] || 0),
        recordedAt: '',
      });
    });
  });
  return [...aggregated.values()].sort(
    (left, right) =>
      right.largeMarginCount - left.largeMarginCount ||
      left.turn - right.turn ||
      left.programId - right.programId,
  );
};

const runStatus = (run: CareerSessionRun, current = false) => {
  if (current) return { label: '暂停时', className: 'text-amber-600' };
  if (run.completed) return { label: '已完成', className: 'text-emerald-600' };
  if (run.discarded) return { label: '已放弃', className: 'text-slate-500' };
  return { label: '未完成', className: 'text-red-600' };
};

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const recordDateKey = (record: CareerSessionRecord) => {
  const timestamp = String(record.ended_at || record.started_at || '');
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10) || '未知日期';
  const shifted = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(shifted)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatRecordDate = (dateKey: string) => {
  if (dateKey === '未知日期') return dateKey;
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  const label = date.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return `${label} · 05:00–次日05:00`;
};

const groupRecordsByDate = (records: CareerSessionRecord[]) => {
  const groups = new Map<string, CareerSessionRecord[]>();
  [...records]
    .sort((left, right) =>
      String(right.ended_at || right.started_at || '').localeCompare(
        String(left.ended_at || left.started_at || ''),
      ),
    )
    .forEach((record) => {
      const key = recordDateKey(record);
      groups.set(key, [...(groups.get(key) || []), record]);
    });
  return [...groups.entries()];
};

const aggregateRecords = (records: CareerSessionRecord[]) => {
  const count = records.reduce(
    (sum, record) => sum + Number(record.count || 0),
    0,
  );
  const attributesTotal = emptyAttributes();
  records.forEach((record) => {
    attributeItems.forEach(([key]) => {
      const storedTotal = Number(record.attributes_total?.[key]);
      attributesTotal[key] += Number.isFinite(storedTotal)
        ? storedTotal
        : Number(record.attributes_average?.[key] || 0) *
          Number(record.count || 0);
    });
  });
  const attributesAverage = emptyAttributes();
  attributeItems.forEach(([key]) => {
    attributesAverage[key] = count
      ? Math.round((attributesTotal[key] / count) * 100) / 100
      : 0;
  });
  const sorted = [...records].sort((left, right) =>
    String(left.started_at || '').localeCompare(String(right.started_at || '')),
  );
  return {
    count,
    attributesAverage,
    cardId: Number(sorted.find((record) => record.card_id)?.card_id || 0),
    startedAt: String(sorted[0]?.started_at || ''),
    endedAt: String(sorted.at(-1)?.ended_at || ''),
    largeMarginCount: records.reduce(
      (sum, record) =>
        sum +
        Number(
          record.large_margin_count ||
            Object.values(raceCounts(record.large_margin_race_counts)).reduce(
              (raceTotal, value) => raceTotal + value,
              0,
            ),
        ),
      0,
    ),
    g123Races: aggregateG123Races(records),
    jewelDropCount: records.reduce(
      (sum, record) => sum + Number(record.jewel_drop_count || 0),
      0,
    ),
    jewelsEarned: records.reduce(
      (sum, record) => sum + Number(record.jewels_earned || 0),
      0,
    ),
    errors: [...new Set(records.map((record) => record.error).filter(Boolean))],
    rows: sorted.flatMap((record) => [
      ...(record.runs || []).map((run) => ({ run, current: false })),
      ...(record.current ? [{ run: record.current, current: true }] : []),
    ]),
  };
};

export default function HistoryTab({
  dashboard,
  selectedCareerRecords,
  setSelectedCareerRecords,
  busy,
  historyCareerSetting,
  loadCareerHistory,
  selectedAccountId,
  historyCareerSettingId,
  setHistoryCareerSettingId,
  accountCareerSettings,
  historyCareerRecords,
  deleteCareerHistory,
  races,
}: HistoryTabProps) {
  const raceByProgramId = new Map<number, RaceOption>();
  const raceByProgramAndTurn = new Map<string, RaceOption>();
  const raceById = new Map<number, RaceOption>();
  races.forEach((race) => {
    const programId = Number(race.program_id);
    if (programId > 0 && !raceByProgramId.has(programId)) {
      raceByProgramId.set(programId, race);
    }
    if (programId > 0) {
      raceByProgramAndTurn.set(`${programId}:${Number(race.turn || 0)}`, race);
    }
    raceById.set(Number(race.id), race);
  });

  if (selectedCareerRecords?.length) {
    const aggregate = aggregateRecords(selectedCareerRecords);
    const recordUma = dashboard.umas.find((uma) => uma.id === aggregate.cardId);
    const dateKey = recordDateKey(selectedCareerRecords[0]);

    return (
      <div className="space-y-4">
        <section className={panelClass('p-5')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedCareerRecords(null)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              ← 返回养马记录
            </button>
            <button
              type="button"
              disabled={busy === 'history-delete'}
              onClick={() => {
                if (
                  window.confirm(
                    `确定删除 ${formatRecordDate(dateKey)} 的全部养马记录吗？`,
                  )
                ) {
                  deleteCareerHistory(
                    selectedCareerRecords.map((record) => record.id),
                  );
                }
              }}
              className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={14} />
              删除当天记录
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100">
                {recordUma ? (
                  <AssetIcon
                    path={
                      horseIconPath(
                        recordUma.id,
                        recordUma.rarity,
                        recordUma.race_cloth_id,
                      ) || ''
                    }
                    alt={recordUma.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Trophy size={22} className="m-5 text-slate-300" />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-slate-900">
                  {historyCareerSetting?.name || '未命名详设'} ·{' '}
                  {formatRecordDate(dateKey)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {recordUma?.name || `育成马娘 ${aggregate.cardId || '-'}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatReportTime(aggregate.startedAt)} 至{' '}
                  {formatReportTime(aggregate.endedAt)} · 合并{' '}
                  {selectedCareerRecords.length} 次托管
                </p>
              </div>
            </div>
          </div>

          {aggregate.errors.length ? (
            <div className="mt-4 space-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {aggregate.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">完成次数</p>
              <strong className="mt-1 block text-xl text-slate-900">
                {aggregate.count}
              </strong>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">比赛大差</p>
              <strong className="mt-1 block text-xl text-amber-700">
                {aggregate.largeMarginCount} 次
              </strong>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">宝石掉落</p>
              <strong className="mt-1 block text-xl text-violet-700">
                {aggregate.jewelDropCount} 次 / {aggregate.jewelsEarned} 个
              </strong>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {attributeItems.map(([key, label]) => (
              <div
                key={key}
                className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-center"
              >
                <p className="text-xs text-indigo-500">平均{label}</p>
                <strong className="mt-1 block text-lg text-indigo-900">
                  {formatMetric(aggregate.attributesAverage[key])}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass('overflow-hidden')}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold">每次育成结果</h3>
            <p className="mt-1 text-xs text-slate-500">
              当天每次育成单独一行，仅显示静态结果。
            </p>
          </div>
          {aggregate.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">次数</th>
                    <th className="px-3 py-3 font-medium">状态</th>
                    {attributeItems.map(([key, label]) => (
                      <th key={key} className="px-3 py-3 font-medium">
                        {label}
                      </th>
                    ))}
                    <th className="px-3 py-3 font-medium">比赛大差</th>
                    <th className="px-3 py-3 font-medium">宝石掉落</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aggregate.rows.map(({ run, current }, index) => {
                    const status = runStatus(run, current);
                    return (
                      <tr key={run.run_id || `current-${index}`}>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {current ? '-' : index + 1}
                        </td>
                        <td className={`px-3 py-3 ${status.className}`}>
                          {status.label}
                          {run.last_error ? (
                            <span className="mt-1 block max-w-40 truncate text-xs text-red-500">
                              {run.last_error}
                            </span>
                          ) : null}
                        </td>
                        {attributeItems.map(([key]) => (
                          <td key={key} className="px-3 py-3 text-slate-700">
                            {run.attributes?.[key] || 0}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-amber-700">
                          {run.large_margin_count || 0} 次
                        </td>
                        <td className="px-3 py-3 text-violet-700">
                          {run.jewel_drop_count || 0} 次 /{' '}
                          {run.jewels_earned || 0} 个
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">
              当天没有可显示的育成结果
            </p>
          )}
        </section>

        <section className={panelClass('p-5')}>
          <h3 className="font-bold text-slate-900">同比赛的大差情况</h3>
          <p className="mt-1 text-xs text-slate-500">
            列出当天跑过的 G1、G2、G3；数字仅显示大差次数。
          </p>
          {aggregate.g123Races.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {aggregate.g123Races.map((raceRow) => {
                const race =
                  raceById.get(raceRow.raceId) ||
                  raceByProgramAndTurn.get(
                    `${raceRow.programId}:${raceRow.turn}`,
                  ) ||
                  raceByProgramId.get(raceRow.programId);
                return (
                  <div
                    key={`${raceRow.raceId}:${raceRow.programId}:${raceRow.turn}`}
                    className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-2"
                  >
                    {race?.thumbnail_id ? (
                      <AssetIcon
                        path={`race_thumb/${race.thumbnail_id}.png`}
                        alt={race.name}
                        className="h-11 w-16 shrink-0 rounded-md bg-slate-100 object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-white text-amber-500">
                        <Trophy size={20} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-700">
                        {race?.name || '未知比赛'}
                      </strong>
                      {race ? (
                        <span className="block truncate text-xs text-slate-500">
                          {race.date} · {race.type} · {race.terrain} ·{' '}
                          {race.distance}
                        </span>
                      ) : null}
                      {raceRow.recordedAt ? (
                        <span className="block truncate text-[11px] text-slate-400">
                          比赛时间 {formatReportTime(raceRow.recordedAt)}
                        </span>
                      ) : null}
                    </span>
                    <strong className="shrink-0 text-amber-700">
                      {raceRow.largeMarginCount} 次
                    </strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
              当天没有比赛大差记录
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <History size={19} className="text-indigo-600" />
            养马记录
            {historyCareerSetting ? ` · ${historyCareerSetting.name}` : ''}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            仅保留最近 3 个养马日；同一详设按天聚合五维、比赛大差
            次数、宝石掉落和完成次数；同比赛的大差情况可在每日详情底部查看。
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadCareerHistory(selectedAccountId)}
          disabled={busy === 'history'}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={busy === 'history' ? 'animate-spin' : ''}
          />
          刷新记录
        </button>
      </div>

      <label className="mt-5 block max-w-xl text-sm font-medium text-slate-700">
        选择详设
        <select
          value={historyCareerSettingId}
          onChange={(event) => setHistoryCareerSettingId(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">请选择详设后查看记录</option>
          {accountCareerSettings.map((setting) => (
            <option key={setting.id} value={setting.id}>
              {setting.name}
            </option>
          ))}
        </select>
      </label>

      {!historyCareerSetting ? (
        <p className="py-14 text-center text-sm text-slate-400">
          选择养马详设后，才会显示该详设的养马记录
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            {groupRecordsByDate(historyCareerRecords).map(
              ([dateKey, records]) => {
                const aggregate = aggregateRecords(records);
                const recordUma = dashboard.umas.find(
                  (uma) => uma.id === aggregate.cardId,
                );
                return (
                  <section
                    key={dateKey}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <h3 className="font-semibold text-slate-800">
                        {formatRecordDate(dateKey)}
                      </h3>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {aggregate.count} 次育成 · {records.length} 次托管
                        </span>
                        <button
                          type="button"
                          disabled={busy === 'history-delete'}
                          onClick={() => {
                            if (
                              window.confirm(
                                `确定删除 ${formatRecordDate(dateKey)} 的全部养马记录吗？`,
                              )
                            ) {
                              deleteCareerHistory(
                                records.map((record) => record.id),
                              );
                            }
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="删除当天记录"
                        >
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCareerRecords(records)}
                      className="grid w-full gap-4 px-4 py-3 text-left transition hover:bg-indigo-50/40 lg:grid-cols-[minmax(220px,1.2fr)_minmax(300px,1.6fr)_minmax(300px,1.5fr)] lg:items-center"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="h-14 w-14 flex-none overflow-hidden rounded-lg bg-slate-100">
                          {recordUma ? (
                            <AssetIcon
                              path={
                                horseIconPath(
                                  recordUma.id,
                                  recordUma.rarity,
                                  recordUma.race_cloth_id,
                                ) || ''
                              }
                              alt={recordUma.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Trophy
                              size={20}
                              className="m-[18px] text-slate-300"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-slate-900">
                            {recordUma?.name ||
                              `育成马娘 ${aggregate.cardId || '-'}`}
                          </strong>
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatReportTime(aggregate.startedAt)} 至{' '}
                            {formatReportTime(aggregate.endedAt)}
                          </span>
                          <span className="mt-1 block text-xs text-slate-400">
                            点击查看当天每一次育成结果
                          </span>
                        </span>
                      </span>

                      <span className="grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">
                        {attributeItems.map(([key, label]) => (
                          <span
                            key={key}
                            className="rounded bg-slate-50 px-1 py-1.5"
                          >
                            <strong className="block text-xs text-slate-700">
                              {formatMetric(aggregate.attributesAverage[key])}
                            </strong>
                            {label}
                          </span>
                        ))}
                      </span>

                      <span className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                        <span>
                          <strong className="block text-sm text-slate-800">
                            {aggregate.count}
                          </strong>
                          完成
                        </span>
                        <span>
                          <strong className="block text-sm text-amber-700">
                            {aggregate.largeMarginCount}
                          </strong>
                          大差
                        </span>
                        <span>
                          <strong className="flex items-center justify-center gap-1 text-sm text-violet-700">
                            <Gem size={12} />
                            {aggregate.jewelDropCount}/{aggregate.jewelsEarned}
                          </strong>
                          掉落/宝石
                        </span>
                      </span>
                    </button>
                  </section>
                );
              },
            )}
          </div>
          {!historyCareerRecords.length && busy !== 'history' ? (
            <p className="py-14 text-center text-sm text-slate-400">
              该详设暂无养马记录
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
