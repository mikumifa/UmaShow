import { useEffect, useRef, useState } from 'react';
import { DailyAssetSnapshot } from './types';
import './History.css';

const items = [
  ['jewels', '宝石'],
  ['support_tickets', '协助卡招募券'],
  ['character_tickets', '优俊少女招募券'],
  ['energy_drinks', '能量饮料'],
] as const;

type AssetKey = (typeof items)[number][0];
const dayNumber = (day: string) =>
  Date.parse(`${day}T00:00:00+08:00`) / 86400000;

export function assetHistoryRows(
  snapshots: DailyAssetSnapshot[],
  key: AssetKey,
) {
  const ordered = [...snapshots].sort((a, b) =>
    a.business_day.localeCompare(b.business_day),
  );
  return ordered.map((snapshot, index) => {
    const previous = ordered[index - 1];
    const consecutive =
      previous &&
      dayNumber(snapshot.business_day) - dayNumber(previous.business_day) === 1;
    return {
      ...snapshot,
      value: snapshot[key],
      delta: consecutive ? snapshot[key] - previous[key] : null,
    };
  });
}

const formatDelta = (delta: number | null) =>
  delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString()}`;

export default function AssetTracking({
  snapshots,
  loading,
}: {
  snapshots: DailyAssetSnapshot[];
  loading: boolean;
}) {
  const [selected, setSelected] = useState<AssetKey>('jewels');
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(320);
  const hasSnapshots = snapshots.length > 0;
  useEffect(() => {
    const element = chartRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setChartWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasSnapshots]);
  const rows = assetHistoryRows(snapshots, selected);
  const latest = rows.at(-1);
  const name = items.find(([key]) => key === selected)![1];
  const maximum = Math.max(
    2,
    Math.ceil(Math.max(0, ...rows.map((row) => row.value)) / 2) * 2,
  );
  const plotLeft = 54;
  const plotRight = chartWidth - 16;
  const plotTop = 20;
  const plotBottom = 192;
  const firstDay = rows.length ? dayNumber(rows[0].business_day) : 0;
  const span = latest ? dayNumber(latest.business_day) - firstDay : 0;
  const points = rows.map((row) => ({
    x: span
      ? plotLeft +
        ((dayNumber(row.business_day) - firstDay) / span) *
          (plotRight - plotLeft)
      : (plotLeft + plotRight) / 2,
    y: plotBottom - (row.value / maximum) * (plotBottom - plotTop),
  }));

  return (
    <section
      className="historyTracking"
      data-asset={selected}
      aria-busy={loading}
    >
      <div
        className="historyAssetSwitch"
        role="group"
        aria-label="选择追踪物品"
      >
        {items.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
            className={`rounded-lg border px-3 py-2 text-label font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              selected === key
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {latest ? (
        <>
          <div className="historyAssetOverview">
            <div className="historyAssetBalance">
              <h3 className="text-section font-semibold text-slate-800">
                {name}持有量
              </h3>
              <p className="mt-2 text-title font-semibold tabular-nums text-indigo-700">
                {latest.value.toLocaleString()}
              </p>
              <p className="mt-1 text-caption text-slate-500">
                最新记录 · {latest.business_day}
              </p>
              <p className="mt-3 text-label text-slate-600">
                较前日{' '}
                <strong className="tabular-nums text-slate-700">
                  {formatDelta(latest.delta)}
                </strong>
              </p>
            </div>
            <div className="historyAssetChart" ref={chartRef}>
              <svg
                viewBox={`0 0 ${chartWidth} 232`}
                height="232"
                className="w-full"
                role="img"
                aria-label={`${name}每日持有量趋势`}
              >
                <title>{`${name}每日持有量趋势，详细数量见下方表格`}</title>
                {[0, 0.5, 1].map((ratio) => (
                  <g key={ratio}>
                    <line
                      x1={plotLeft}
                      x2={plotRight}
                      y1={plotBottom - ratio * (plotBottom - plotTop)}
                      y2={plotBottom - ratio * (plotBottom - plotTop)}
                      className="historyChartGrid"
                    />
                    <text
                      x={plotLeft - 10}
                      y={plotBottom - ratio * (plotBottom - plotTop)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="historyChartLabel"
                    >
                      {(maximum * ratio).toLocaleString('zh-CN', {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      })}
                    </text>
                  </g>
                ))}
                {rows.map((row, index) => {
                  const point = points[index];
                  const previous = points[index - 1];
                  return (
                    <g key={row.business_day}>
                      {previous && row.delta !== null ? (
                        <line
                          x1={previous.x}
                          y1={previous.y}
                          x2={point.x}
                          y2={point.y}
                          className="historyChartLine"
                          strokeWidth="2.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        className="historyChartPoint"
                      >
                        <title>
                          {`${row.business_day}：${row.value.toLocaleString()}，较前日 ${formatDelta(row.delta)}`}
                        </title>
                      </circle>
                    </g>
                  );
                })}
                <text
                  x={span ? plotLeft : points[0].x}
                  y="219"
                  textAnchor={span ? 'start' : 'middle'}
                  className="historyChartLabel"
                >
                  {rows[0].business_day.slice(5).replace('-', '/')}
                </text>
                {rows.length > 1 ? (
                  <text
                    x={plotRight}
                    y="219"
                    textAnchor="end"
                    className="historyChartLabel"
                  >
                    {latest.business_day.slice(5).replace('-', '/')}
                  </text>
                ) : null}
              </svg>
              <p className="historyChartNote">
                按游戏日记录 · 缺失日期不连线，详细数量见下表
              </p>
            </div>
          </div>
          <div className="historyAssetTableScroll">
            <table className="historyAssetTable">
              <caption className="sr-only">{name}每日持有量与变化</caption>
              <thead className="border-y border-slate-200 bg-slate-50 text-caption text-slate-600">
                <tr>
                  <th scope="col">游戏日</th>
                  <th scope="col" className="text-right">
                    持有量
                  </th>
                  <th scope="col" className="text-right">
                    较前日
                  </th>
                  <th scope="col" className="historyAssetCapture text-right">
                    记录时间（北京）
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((row) => (
                  <tr
                    key={row.business_day}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="text-slate-600">
                      {row.business_day}
                      <span className="historyAssetCaptureMobile">
                        {new Date(row.captured_at).toLocaleString('zh-CN', {
                          timeZone: 'Asia/Shanghai',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}{' '}
                        北京
                      </span>
                    </td>
                    <td className="text-right font-semibold tabular-nums text-slate-800">
                      {row.value.toLocaleString()}
                    </td>
                    <td
                      className={`text-right font-semibold tabular-nums ${row.delta && row.delta > 0 ? 'text-emerald-700' : row.delta && row.delta < 0 ? 'text-rose-700' : 'text-slate-600'}`}
                    >
                      {formatDelta(row.delta)}
                    </td>
                    <td className="historyAssetCapture text-right text-caption text-slate-600">
                      {new Date(row.captured_at).toLocaleString('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        hour12: false,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p role="status" className="py-14 text-center text-data text-slate-600">
          {loading
            ? '正在读取追踪记录…'
            : '暂无追踪记录，下次启动任务时会自动记录。'}
        </p>
      )}
    </section>
  );
}
