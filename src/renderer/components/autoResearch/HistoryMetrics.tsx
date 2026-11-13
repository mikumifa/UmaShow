import { CareerSessionRecord, CareerSessionRun } from './types';

export const historyMetrics = [
  { key: 'jewel_drop_count', label: '掉钻次数', unit: '次' },
  { key: 'jewels_earned', label: '掉钻数量', unit: '个' },
] as const;

type Metrics = Record<(typeof historyMetrics)[number]['key'], number | null>;

const knownNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;

export const runMetrics = (run: CareerSessionRun): Metrics => ({
  jewel_drop_count: knownNumber(run.jewel_drop_count),
  jewels_earned: knownNumber(run.jewels_earned),
});

export const totalRunMetrics = (records: CareerSessionRecord[]): Metrics =>
  Object.fromEntries(
    historyMetrics.map(({ key }) => {
      let total = 0;
      let samples = 0;
      records.forEach((record) => {
        if (record.metric_samples?.[key] !== undefined) {
          total += record.metric_totals?.[key] || 0;
          samples += record.metric_samples[key] || 0;
          return;
        }
        (record.runs || [])
          .filter((run) => run.completed)
          .forEach((run) => {
            const value = runMetrics(run)[key];
            if (value !== null) {
              total += value;
              samples += 1;
            }
          });
      });
      return [key, samples ? total : null];
    }),
  ) as Metrics;

export const formatHistoryMetric = (
  value: number | null,
  useGrouping = true,
) =>
  value === null
    ? '—'
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 1, useGrouping });

export default function HistoryMetrics({
  values,
  completedCount,
}: {
  values: Metrics;
  completedCount?: number;
}) {
  const metrics = historyMetrics.map((metric) => ({
    ...metric,
    value: values[metric.key],
  }));
  const displayedMetrics =
    completedCount === undefined
      ? metrics
      : [
          {
            key: 'completed_count',
            label: '总育成次数',
            unit: '次',
            value: completedCount,
          },
          ...metrics,
        ];
  return (
    <span
      className={`historyMetrics${completedCount === undefined ? '' : ' historyMetrics-summary'}`}
      role="group"
      aria-label={
        completedCount === undefined ? '本次育成指标' : '育成累计指标'
      }
    >
      {displayedMetrics.map(({ key, label, unit, value }) => (
        <span
          key={key}
          className={`historyMetric historyMetric-${key}`}
          title={`${label}：${value === null ? '未记录' : `${formatHistoryMetric(value)} ${unit}`}`}
        >
          <span className="historyMetricLabel">{label}</span>
          <span className="historyMetricValue">
            {value === null ? (
              <span className="historyMetricMissing">未记录</span>
            ) : (
              <>
                <strong>{formatHistoryMetric(value, false)}</strong>
                <span className="historyMetricUnit">{unit}</span>
              </>
            )}
          </span>
        </span>
      ))}
    </span>
  );
}
