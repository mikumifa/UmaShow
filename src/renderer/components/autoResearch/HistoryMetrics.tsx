import {
  CareerHistoryMetric,
  CareerSessionRecord,
  CareerSessionRun,
} from './types';

export const historyMetrics = [
  { key: 'chara_score', label: '总评分', unit: '分' },
  { key: 'jewel_drop_count', label: '掉钻次数', unit: '次' },
  { key: 'win_count', label: '胜场', unit: '场' },
  { key: 'race_count', label: '总比赛场次', unit: '场' },
  { key: 'jewels_earned', label: '掉钻数量', unit: '个' },
] as const;

type Metrics = Record<CareerHistoryMetric, number | null>;

const knownNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;

export const runMetrics = (run: CareerSessionRun): Metrics => {
  const races = run.g123_race_records || [];
  return {
    chara_score:
      run.chara_score && run.chara_score > 0 ? run.chara_score : null,
    jewel_drop_count: knownNumber(run.jewel_drop_count),
    jewels_earned: knownNumber(run.jewels_earned),
    // Include every recorded race, including debut/goal races outside G1–G3.
    race_count: knownNumber(run.race_count) ?? (races.length || null),
    win_count:
      knownNumber(run.win_count) ??
      (races.length && races.every((race) => Number(race.rank) > 0)
        ? races.filter((race) => race.rank === 1).length
        : null),
  };
};

export const averageRunMetrics = (records: CareerSessionRecord[]): Metrics =>
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
      return [key, samples ? total / samples : null];
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
  average = false,
  pending = false,
}: {
  values: Metrics;
  average?: boolean;
  pending?: boolean;
}) {
  return (
    <span
      className="historyMetrics"
      role="group"
      aria-label={average ? '每次育成平均指标' : '本次育成指标'}
    >
      {historyMetrics.map(({ key, label, unit }) => (
        <span
          key={key}
          className={`historyMetric historyMetric-${key}`}
          title={`${average ? '平均' : ''}${label}：${values[key] === null ? (pending && key === 'chara_score' ? '待结算' : '未记录') : `${formatHistoryMetric(values[key])} ${unit}`}`}
        >
          <span className="historyMetricLabel">
            {key === 'race_count' ? '比赛场次' : label}
          </span>
          <span className="historyMetricValue">
            {values[key] === null ? (
              <span className="historyMetricMissing">
                {pending && key === 'chara_score' ? '待结算' : '未记录'}
              </span>
            ) : (
              <>
                <strong>{formatHistoryMetric(values[key], false)}</strong>
                <span className="historyMetricUnit">{unit}</span>
              </>
            )}
          </span>
        </span>
      ))}
    </span>
  );
}
