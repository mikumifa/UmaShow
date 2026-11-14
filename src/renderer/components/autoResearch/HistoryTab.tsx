/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  Dispatch,
  memo,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ListTodo,
  LoaderCircle,
  RefreshCw,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import AssetTracking from './AssetTracking';
import useHistoryPages, {
  AssetMetric,
  LoadHistoryPage,
  LoadTrackingPage,
} from './useHistoryPages';
import useScrollLoadMore from './useScrollLoadMore';
import HistoryMetrics, {
  totalRunMetrics,
  formatHistoryMetric,
  historyMetrics,
  runMetrics,
} from './HistoryMetrics';
import './History.css';
import { characterIconPath, umaSkinIconPath } from './SelectionCards';
import {
  careerSettingModeBadgeClass,
  formatAccountError,
  formatReportTime,
  panelClass,
} from './shared';
import {
  CareerSessionRecord,
  CareerSessionRun,
  CareerSetting,
  DailyAssetSnapshot,
} from './types';

type HistoryTabProps = {
  readOnly?: boolean;
  selectedCareerRecords: CareerSessionRecord[] | null;
  setSelectedCareerRecords: Dispatch<
    SetStateAction<CareerSessionRecord[] | null>
  >;
  busy: string;
  loadCareerHistory?: (accountId: string) => Promise<void>;
  loadHistoryPage?: LoadHistoryPage;
  loadTrackingPage?: LoadTrackingPage;
  refreshRevision?: string | number;
  loadCareerHistoryDetail: (reportId: string) => Promise<CareerSessionRecord[]>;
  selectedAccountId: string;
  accountCareerSettings: CareerSetting[];
  careerHistory?: CareerSessionRecord[];
  assetSnapshots?: DailyAssetSnapshot[];
  downloadCareerSetting: (records: CareerSessionRecord[]) => Promise<void>;
  downloadTrainingHistory: (recordId: string) => Promise<void>;
  localTrainingHistoryIds: Set<string>;
  openTrainingHistory: (recordId: string) => void;
};

const EMPTY_HISTORY: CareerSessionRecord[] = [];
const EMPTY_SNAPSHOTS: DailyAssetSnapshot[] = [];

const runIdTimestamp = (runId?: string) => {
  const match = String(runId || '').match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
  );
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
};

const runTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const runDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const recordDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

const formatRunTime = (value?: string) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return runTimeFormatter.format(date);
};

const formatRunDateTime = (value?: string) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return runDateTimeFormatter.format(date);
};

const formatRunDuration = (startedAt?: string, endedAt?: string) => {
  if (!startedAt || !endedAt) return '';
  const started = new Date(startedAt).getTime();
  const ended = new Date(endedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return '';
  }
  const totalSeconds = Math.max(0, Math.round((ended - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}小时${minutes}分${seconds}秒`;
  if (minutes) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
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

const totalRaceCount = (value?: Record<string, number>) =>
  Object.values(raceCounts(value)).reduce((sum, count) => sum + count, 0);

const runStatus = (run: CareerSessionRun, current = false) => {
  if (current) {
    if (run.status === 'running' || run.in_progress) {
      return { label: '正在进行中', className: 'text-sky-600' };
    }
    return { label: '暂停时', className: 'text-amber-600' };
  }
  if (run.completed) return { label: '已完成', className: 'text-emerald-600' };
  if (run.discarded) return { label: '已放弃', className: 'text-slate-500' };
  if (run.status === 'continuing')
    return { label: '跨日育成', className: 'text-sky-600' };
  if (run.status === 'stopped' || run.status === 'paused')
    return { label: '已中断', className: 'text-amber-600' };
  return { label: '未完成', className: 'text-red-600' };
};

const currentDurationLabel = (run: CareerSessionRun) =>
  run.status === 'running' || run.in_progress ? '正在进行中' : '暂停时记录';

const businessDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const recordDateKey = (record: CareerSessionRecord) => {
  const dailySession = String(record.session_id || record.id || '').match(
    /^daily:(\d{4}-\d{2}-\d{2})$/,
  );
  if (dailySession) return dailySession[1];
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
  return recordDateFormatter.format(date);
};

const recordSettingName = (record?: CareerSessionRecord) =>
  String(record?.career_setting_name || record?.preset_name || '').trim() ||
  '未命名详设';

const recordCareerMode = (record?: CareerSessionRecord) => {
  if (record?.career_mode) return record.career_mode;
  if (record?.career_setting_snapshot?.mode) {
    return record.career_setting_snapshot.mode;
  }
  return record?.preset_name ? 'online' : 'offline';
};

const recordSettingKey = (record: CareerSessionRecord) =>
  String(record.career_setting_id || '').trim() ||
  `${recordSettingName(record)}:${record.card_id || 0}:${recordCareerMode(record)}`;

const recordLatestTime = (record: CareerSessionRecord) =>
  String(record.ended_at || record.started_at || '');

const taskPlanSummary = (record?: CareerSessionRecord) => {
  if (!record) return '';
  const cadence = record.cadence === 'daily' ? '每日计划' : '一次性计划';
  const runMode =
    record.run_mode || record.task_type || record.mode || 'single';
  const target = Math.max(1, Number(record.target || 1));
  const goal =
    runMode === 'continuous'
      ? '持续育成'
      : runMode === 'count'
        ? `完成 ${target} 次育成`
        : runMode === 'jewel_drops'
          ? `获得 ${target} 次宝石掉落`
          : runMode === 'mixed'
            ? '混合计划'
            : '单次育成';
  return `${cadence} · ${goal}`;
};

const groupRecordsBySettingAndDate = (records: CareerSessionRecord[]) => {
  const groups = new Map<
    string,
    {
      key: string;
      settingName: string;
      dateKey: string;
      records: CareerSessionRecord[];
    }
  >();
  [...records]
    .sort((left, right) =>
      String(right.ended_at || right.started_at || '').localeCompare(
        String(left.ended_at || left.started_at || ''),
      ),
    )
    .forEach((record) => {
      const dateKey = recordDateKey(record);
      const settingKey = recordSettingKey(record);
      const key =
        record.aggregation_type === 'day'
          ? record.id
          : `${settingKey}\u0000${dateKey}`;
      const group = groups.get(key);
      if (group) {
        group.records.push(record);
      } else {
        groups.set(key, {
          key,
          settingName: recordSettingName(record),
          dateKey,
          records: [record],
        });
      }
    });
  return [...groups.values()].sort((left, right) => {
    const leftLatest = left.records.reduce(
      (latest, record) =>
        Math.max(latest, Date.parse(recordLatestTime(record)) || 0),
      0,
    );
    const rightLatest = right.records.reduce(
      (latest, record) =>
        Math.max(latest, Date.parse(recordLatestTime(record)) || 0),
      0,
    );
    return (
      rightLatest - leftLatest || right.dateKey.localeCompare(left.dateKey)
    );
  });
};

const groupRecordsByTask = (records: CareerSessionRecord[]) => {
  const groups = new Map<string, CareerSessionRecord[]>();
  [...records]
    .sort((left, right) =>
      String(right.ended_at || right.started_at || '').localeCompare(
        String(left.ended_at || left.started_at || ''),
      ),
    )
    .forEach((record) => {
      const taskId = String(
        record.task_id || record.session_id || record.id || '',
      );
      const key = `task:${taskId}`;
      const group = groups.get(key);
      if (group) group.push(record);
      else groups.set(key, [record]);
    });
  return [...groups.entries()].map(([key, group]) => ({
    key,
    settingName: recordSettingName(group[0]),
    dateKey: recordDateKey(group[0]),
    records: group,
  }));
};

const hasLocalCareerSetting = (
  records: CareerSessionRecord[],
  settings: CareerSetting[],
) => {
  const record = records[0];
  if (!record) return false;
  const settingId = String(record.career_setting_id || '').trim();
  if (settingId) return settings.some((setting) => setting.id === settingId);
  const name = recordSettingName(record);
  return settings.some(
    (setting) => setting.name === name && setting.card_id === record.card_id,
  );
};

const hasCareerSettingSnapshot = (records: CareerSessionRecord[]) =>
  records.some((record) => Boolean(record.career_setting_snapshot?.setting));

const aggregateRecords = (records: CareerSessionRecord[]) => {
  const count = records.reduce((sum, record) => {
    const runs = (record.runs || []).filter((run) => run.completed);
    return (
      sum + (record.runs?.length ? runs.length : Number(record.count || 0))
    );
  }, 0);
  const sorted = [...records].sort((left, right) =>
    String(left.started_at || '').localeCompare(String(right.started_at || '')),
  );
  const chronologicalRows = sorted
    .flatMap((record) => {
      const recordRows = [
        ...(record.runs || []).map((run) => ({ run, current: false })),
        ...(record.current ? [{ run: record.current, current: true }] : []),
      ];
      return recordRows.map((row, index) => {
        const startedAt = row.run.timestamps_authoritative
          ? String(row.run.started_at || '')
          : String(row.run.started_at || '') ||
            runIdTimestamp(row.run.run_id) ||
            (index === 0 ? String(record.started_at || '') : '');
        const nextRun = recordRows[index + 1]?.run;
        const nextStartedAt = nextRun
          ? String(nextRun.started_at || '') || runIdTimestamp(nextRun.run_id)
          : '';
        const endedAt = row.current
          ? ''
          : row.run.timestamps_authoritative
            ? String(row.run.ended_at || '')
            : String(row.run.ended_at || '') ||
              nextStartedAt ||
              (index === recordRows.length - 1
                ? String(record.ended_at || '')
                : '');
        return { ...row, startedAt, endedAt };
      });
    })
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  let sequence = 0;
  const rows = chronologicalRows
    .map((row) => ({
      ...row,
      sequence: row.current ? null : ++sequence,
    }))
    .reverse();
  return {
    count,
    metricsTotal: totalRunMetrics(records),
    cardId: Number(sorted.find((record) => record.card_id)?.card_id || 0),
    startedAt: String(sorted[0]?.started_at || ''),
    endedAt: String(sorted.at(-1)?.ended_at || ''),
    errors: [...new Set(records.map((record) => record.error).filter(Boolean))],
    rows,
  };
};

function HistoryTab({
  readOnly = false,
  selectedCareerRecords,
  setSelectedCareerRecords,
  busy,
  loadCareerHistory,
  loadHistoryPage,
  loadTrackingPage,
  refreshRevision = 0,
  loadCareerHistoryDetail,
  selectedAccountId,
  accountCareerSettings,
  careerHistory: legacyHistory = EMPTY_HISTORY,
  assetSnapshots = EMPTY_SNAPSHOTS,
  downloadCareerSetting,
  downloadTrainingHistory,
  localTrainingHistoryIds,
  openTrainingHistory,
}: HistoryTabProps) {
  const [historyView, setHistoryView] = useState<'day' | 'task' | 'tracking'>(
    'day',
  );
  const [assetMetric, setAssetMetric] = useState<AssetMetric>('jewels');
  const historyPages = useHistoryPages({
    scope: selectedAccountId,
    activeKey: historyView === 'task' ? 'task' : 'day',
    enabled: Boolean(
      loadHistoryPage && historyView !== 'tracking' && !selectedCareerRecords,
    ),
    refreshRevision,
    load: async (view: 'day' | 'task', offset) => {
      const result = await loadHistoryPage!(view, offset);
      return { ...result, rows: result.reports };
    },
    identify: (record: CareerSessionRecord) => record.id,
  });
  const trackingPages = useHistoryPages({
    scope: selectedAccountId,
    activeKey: assetMetric,
    enabled: Boolean(
      loadTrackingPage && historyView === 'tracking' && !selectedCareerRecords,
    ),
    refreshRevision,
    load: (metric, offset) => loadTrackingPage!(metric, offset),
    identify: (row) => row.business_day,
  });
  const careerHistory = loadHistoryPage ? historyPages.rows : legacyHistory;
  const paged = historyView === 'tracking'
    ? Boolean(loadTrackingPage)
    : Boolean(loadHistoryPage);
  const activePage = historyView === 'tracking' ? trackingPages : historyPages;
  const historyLoading = paged ? activePage.loading : busy === 'history';
  const pageError = paged ? activePage.error : '';
  const refreshHistory = () =>
    paged ? activePage.refresh() : loadCareerHistory?.(selectedAccountId);
  const loadMoreSentinelRef = useScrollLoadMore({
    enabled: Boolean(
      paged &&
        !selectedCareerRecords?.length &&
        activePage.hasMore &&
        activePage.rows.length > 0 &&
        !pageError,
    ),
    loading: historyLoading,
    onLoadMore: activePage.loadMore,
    itemCount: activePage.rows.length,
    resetKey: `${selectedAccountId}:${refreshRevision}:${historyView}:${assetMetric}`,
  });
  const [umaDatabase, setUmaDatabase] = useState(UMDB.data);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRevision = useRef(0);
  useEffect(() => {
    detailRevision.current += 1;
    setDetailLoading(false);
    setDetailError('');
    return () => {
      detailRevision.current += 1;
    };
  }, [selectedAccountId, refreshRevision, historyView]);
  const openDetails = async (records: CareerSessionRecord[]) => {
    const revision = ++detailRevision.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const details = (
        await Promise.all(
          records.map((record) =>
            record.summary_only ||
            (!record.runs?.length &&
              !record.current &&
              Number(record.attempt_count || record.count || 0) > 0)
              ? loadCareerHistoryDetail(record.id)
              : Promise.resolve([record]),
          ),
        )
      ).flat();
      if (revision === detailRevision.current) {
        if (!details.length) throw new Error('记录已不存在，请刷新列表');
        if (
          details.some(
            (record) =>
              record.summary_only ||
              (!record.runs?.length &&
                !record.current &&
                Number(record.attempt_count || record.count || 0) > 0),
          )
        ) {
          throw new Error('服务器未返回育成详情，请刷新重试或更新服务器');
        }
        setSelectedCareerRecords(details);
      }
    } catch (caught) {
      if (revision === detailRevision.current)
        setDetailError(String((caught as Error).message || caught));
    } finally {
      if (revision === detailRevision.current) setDetailLoading(false);
    }
  };
  const canManageTrainingHistory =
    !readOnly &&
    !(
      typeof document !== 'undefined' &&
      document.documentElement.hasAttribute('data-autouma')
    );

  useEffect(() => {
    if (!window.electron?.utils?.getUmaDatabase) return undefined;
    let active = true;
    loadUMDB()
      .then((database) => {
        if (active) setUmaDatabase(database);
        return database;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const resolveRecordUma = (cardId: number) => {
    if (!cardId) return undefined;
    const charaId = Number(String(cardId).slice(0, 4));
    const cardName = umaDatabase?.cards?.[cardId]?.name;
    const charaName = umaDatabase?.charas?.[charaId]?.name;
    return {
      id: cardId,
      name:
        [cardName, charaName].filter(Boolean).join(' · ') ||
        `育成马娘 ${cardId}`,
      iconPath: umaSkinIconPath(cardId),
    };
  };

  const selectedAggregate = useMemo(
    () =>
      selectedCareerRecords?.length
        ? aggregateRecords(selectedCareerRecords)
        : null,
    [selectedCareerRecords],
  );
  const groups = useMemo(() => {
    if (historyView === 'tracking') return [];
    const grouped =
      historyView === 'task'
        ? groupRecordsByTask(
            careerHistory.filter((record) => record.aggregation_type !== 'day'),
          )
        : groupRecordsBySettingAndDate(
            careerHistory.filter(
              (record) => record.aggregation_type !== 'task',
            ),
          );
    return grouped.map((group) => ({
      ...group,
      aggregate: aggregateRecords(group.records),
    }));
  }, [careerHistory, historyView]);

  if (selectedCareerRecords?.length && selectedAggregate) {
    const aggregate = selectedAggregate;
    const recordUma = resolveRecordUma(aggregate.cardId);
    const dateKey = recordDateKey(selectedCareerRecords[0]);
    const settingName = recordSettingName(selectedCareerRecords[0]);
    const offlineHistory = selectedCareerRecords.every(
      (record) => recordCareerMode(record) === 'offline',
    );
    const settingDownloaded = hasLocalCareerSetting(
      selectedCareerRecords,
      accountCareerSettings,
    );
    const canDownloadSetting = hasCareerSettingSnapshot(selectedCareerRecords);
    const planSummary =
      historyView === 'task' ? taskPlanSummary(selectedCareerRecords[0]) : '';

    return (
      <div className="autoResearchHistory autoResearchHistoryDetail space-y-3 sm:space-y-4">
        <header className="autoResearchEditorToolbar">
          <div className="autoResearchEditorNav">
            <button
              type="button"
              aria-label="返回"
              className="autoResearchBackButton"
              onClick={() => setSelectedCareerRecords(null)}
            >
              <ChevronLeft size={20} strokeWidth={2.25} />
              <span className="autoResearchBackLabel">返回</span>
            </button>
            <span className="autoResearchEditorTitle">{settingName}</span>
          </div>
          <div className="autoResearchEditorActions">
            {!readOnly && canDownloadSetting ? (
              <button
                type="button"
                className="uma-clay-button inline-flex items-center gap-1.5 px-2.5 text-label font-semibold disabled:opacity-50"
                disabled={
                  settingDownloaded ||
                  busy.startsWith('history-setting-download:')
                }
                onClick={() => downloadCareerSetting(selectedCareerRecords)}
              >
                <Download size={14} />
                <span>{settingDownloaded ? '详设已保存' : '下载详设'}</span>
              </button>
            ) : null}
          </div>
        </header>
        <section className={panelClass('uma-task-card p-3 sm:p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="h-12 w-12 flex-none sm:h-16 sm:w-16">
                {recordUma ? (
                  <AssetIcon
                    path={recordUma.iconPath || ''}
                    fallback={
                      <AssetIcon
                        path={characterIconPath(recordUma.id) || ''}
                        alt={recordUma.name}
                        className="h-full w-full object-contain"
                      />
                    }
                    alt={recordUma.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Trophy size={22} className="m-5 text-slate-300" />
                )}
              </span>
              <div className="min-w-0">
                <h2 className="historyLongText text-section font-semibold text-slate-900">
                  {settingName} ·{' '}
                  {historyView === 'task'
                    ? '任务全量记录'
                    : formatRecordDate(dateKey)}
                </h2>
                <p className="uma-prose mt-1 text-label text-slate-600">
                  {offlineHistory
                    ? '离线详设'
                    : `在线详设 · 预设：${selectedCareerRecords[0]?.preset_name || '未命名'}`}
                  {planSummary ? ` · ${planSummary}` : ''}
                </p>
                <p className="historyLongText mt-1 text-caption text-slate-500">
                  {formatReportTime(aggregate.startedAt)} 至{' '}
                  {formatReportTime(aggregate.endedAt)} · 合并{' '}
                  {selectedCareerRecords.length} 次托管
                </p>
              </div>
            </div>
          </div>

          {aggregate.errors.length ? (
            <div className="historyLongText mt-4 space-y-1 rounded-lg bg-red-50 px-3 py-2 text-label text-red-700">
              {aggregate.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="historySummaryOverview">
            <HistoryMetrics
              values={aggregate.metricsTotal}
              completedCount={aggregate.count}
            />
          </div>
        </section>

        <section className={panelClass('uma-task-card overflow-hidden')}>
          <h3 className="border-b border-slate-200 p-3 text-data font-semibold text-slate-800">
            育成记录
          </h3>
          <div>
            {aggregate.rows.length ? (
              <>
                <div className="historyCompactRuns divide-y divide-slate-200">
                  {aggregate.rows.map(
                    ({ run, current, startedAt, endedAt, sequence }, index) => {
                      const status = runStatus(run, current);
                      const duration = run.ended_at_inferred
                        ? '结束时间未记录'
                        : formatRunDuration(startedAt, endedAt);
                      const trainingHistoryId = String(
                        run.training_history_id || '',
                      );
                      const downloaded =
                        !!trainingHistoryId &&
                        localTrainingHistoryIds.has(trainingHistoryId);
                      return (
                        <article
                          key={run.run_id || `mobile-current-${index}`}
                          className="historyRun px-3 py-4 sm:px-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <strong className="text-data text-slate-800">
                                {sequence ? `第 ${sequence} 次` : '当前进度'}
                              </strong>
                              <span
                                className={`ml-2 text-caption ${status.className}`}
                              >
                                {status.label}
                              </span>
                            </span>
                            <span className="max-w-[55%] text-right text-caption tabular-nums text-slate-500">
                              <span className="block">
                                {historyView === 'task'
                                  ? formatRunDateTime(startedAt)
                                  : formatRunTime(startedAt)}
                              </span>
                              <span className="block">
                                {duration ||
                                  (current
                                    ? currentDurationLabel(run)
                                    : '未知')}
                              </span>
                            </span>
                          </div>
                          {run.last_error ? (
                            <p className="historyLongText mt-2 text-caption text-red-700">
                              {formatAccountError(run.last_error)}
                            </p>
                          ) : null}
                          <div className="mt-3">
                            <HistoryMetrics values={runMetrics(run)} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-caption text-slate-500">
                            <span className="flex flex-wrap gap-x-3 gap-y-1">
                              {!offlineHistory ? (
                                <span className="text-amber-700">
                                  大差 {run.large_margin_count || 0}/
                                  {totalRaceCount(run.g123_race_counts)}
                                </span>
                              ) : null}
                              {!offlineHistory ? (
                                <span className="text-sky-700">
                                  闹钟 {run.clocks_used || 0}
                                </span>
                              ) : null}
                            </span>
                            {canManageTrainingHistory &&
                            !offlineHistory &&
                            trainingHistoryId ? (
                              <button
                                type="button"
                                disabled={
                                  busy ===
                                  `history-download:${trainingHistoryId}`
                                }
                                onClick={() => {
                                  if (downloaded) {
                                    openTrainingHistory(trainingHistoryId);
                                  } else {
                                    downloadTrainingHistory(trainingHistoryId);
                                  }
                                }}
                                className="historyAction shrink-0 rounded-md bg-indigo-50 px-3 font-medium text-indigo-700 disabled:opacity-50"
                              >
                                {downloaded ? '查看' : '下载记录'}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
                <div className="historyDesktopRuns overflow-x-auto">
                  <table className="historyTable w-full min-w-[980px] text-left text-label">
                    <thead className="bg-slate-50 text-caption text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">次数</th>
                        <th className="px-3 py-3 font-medium">状态</th>
                        {historyMetrics.map(({ key, label }) => (
                          <th key={key} className="px-3 py-3 font-medium">
                            {label}
                          </th>
                        ))}
                        {!offlineHistory ? (
                          <th className="px-3 py-3 font-medium">比赛大差</th>
                        ) : null}
                        {!offlineHistory ? (
                          <th className="px-3 py-3 font-medium">闹钟</th>
                        ) : null}
                        <th className="px-3 py-3 font-medium">开始</th>
                        <th className="px-3 py-3 font-medium">结束</th>
                        <th className="px-3 py-3 font-medium">持续</th>
                        {canManageTrainingHistory && !offlineHistory ? (
                          <th className="px-3 py-3 text-right font-medium">
                            养成记录
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aggregate.rows.map(
                        (
                          { run, current, startedAt, endedAt, sequence },
                          index,
                        ) => {
                          const status = runStatus(run, current);
                          const duration = run.ended_at_inferred
                            ? '结束时间未记录'
                            : formatRunDuration(startedAt, endedAt);
                          const trainingHistoryId = String(
                            run.training_history_id || '',
                          );
                          const downloaded =
                            !!trainingHistoryId &&
                            localTrainingHistoryIds.has(trainingHistoryId);
                          return (
                            <tr key={run.run_id || `current-${index}`}>
                              <td className="px-4 py-3 font-medium text-slate-700">
                                {sequence ?? '-'}
                              </td>
                              <td className={`px-3 py-3 ${status.className}`}>
                                {status.label}
                                {run.last_error ? (
                                  <span className="historyLongText mt-1 block max-w-40 text-caption text-red-700">
                                    {formatAccountError(run.last_error)}
                                  </span>
                                ) : null}
                              </td>
                              {historyMetrics.map(({ key }) => (
                                <td
                                  key={key}
                                  className="px-3 py-3 text-slate-700"
                                >
                                  {formatHistoryMetric(runMetrics(run)[key])}
                                </td>
                              ))}
                              {!offlineHistory ? (
                                <td className="px-3 py-3 text-amber-700">
                                  {run.large_margin_count || 0} /{' '}
                                  {totalRaceCount(run.g123_race_counts)} 场
                                </td>
                              ) : null}
                              {!offlineHistory ? (
                                <td className="px-3 py-3 text-sky-700">
                                  {run.clocks_used || 0} 次
                                </td>
                              ) : null}
                              <td className="whitespace-nowrap px-3 py-3 text-caption text-slate-600">
                                {historyView === 'task'
                                  ? formatRunDateTime(startedAt)
                                  : formatRunTime(startedAt)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-caption text-slate-600">
                                {current
                                  ? '未结束'
                                  : historyView === 'task'
                                    ? formatRunDateTime(endedAt)
                                    : formatRunTime(endedAt)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-3 text-caption text-slate-500">
                                {duration ||
                                  (current
                                    ? currentDurationLabel(run)
                                    : '未知')}
                              </td>
                              {canManageTrainingHistory && !offlineHistory ? (
                                <td className="px-3 py-3 text-right">
                                  {trainingHistoryId ? (
                                    <button
                                      type="button"
                                      disabled={
                                        busy ===
                                        `history-download:${trainingHistoryId}`
                                      }
                                      onClick={() => {
                                        if (downloaded) {
                                          openTrainingHistory(
                                            trainingHistoryId,
                                          );
                                        } else {
                                          downloadTrainingHistory(
                                            trainingHistoryId,
                                          );
                                        }
                                      }}
                                      className={`historyAction inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-caption font-medium disabled:opacity-50 ${
                                        downloaded
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                          : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                      }`}
                                      title={
                                        downloaded
                                          ? '打开本机养成记录'
                                          : '下载到本机养成记录'
                                      }
                                    >
                                      {downloaded ? (
                                        <ExternalLink size={14} />
                                      ) : (
                                        <Download
                                          size={14}
                                          className={
                                            busy ===
                                            `history-download:${trainingHistoryId}`
                                              ? 'animate-pulse'
                                              : ''
                                          }
                                        />
                                      )}
                                      {downloaded ? '查看记录' : '下载到本地'}
                                    </button>
                                  ) : (
                                    <span className="text-caption text-slate-500">
                                      无数据
                                    </span>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-data text-slate-600">
                当天没有可显示的育成结果
              </p>
            )}
          </div>
        </section>
      </div>
    );
  }

  const visibleGroups = historyView === 'tracking' ? [] : groups;
  return (
    <section
      className="autoResearchHistory"
      aria-busy={historyLoading || detailLoading}
    >
      {detailLoading
        ? createPortal(
            <div
              className="historyLoadingOverlay"
              role="status"
              aria-label="正在读取育成记录"
            >
              <div className="historyLoadingSpinner">
                <LoaderCircle
                  size={32}
                  className="animate-spin"
                  aria-hidden="true"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
      {detailError ? (
        <p role="alert" className="text-red-600">
          {detailError}
        </p>
      ) : null}
      <div className="historyContent">
        <div className="historyToolbar">
          <div
            className="historyViewSwitch"
            role="group"
            aria-label="历史聚合方式"
          >
            {(
              [
                ['day', '按日期', CalendarDays],
                ['task', '按任务', ListTodo],
                ['tracking', '追踪', TrendingUp],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={historyView === value}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-label font-semibold transition-colors sm:px-4 ${
                  historyView === value
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-800'
                }`}
                onClick={() => {
                  setHistoryView(value);
                  setSelectedCareerRecords(null);
                }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            disabled={historyLoading}
            className="uma-clay-button historyToolbarRefresh historyAction inline-flex shrink-0 items-center justify-center gap-1.5 px-3 py-2 text-label font-semibold disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={historyLoading ? 'animate-spin' : ''}
            />
            {historyLoading ? '刷新中…' : '刷新'}
          </button>
        </div>
        {historyView === 'tracking' ? (
          <AssetTracking
            snapshots={assetSnapshots}
            loading={historyLoading}
            metric={assetMetric}
            onMetricChange={setAssetMetric}
            pagedRows={loadTrackingPage ? trackingPages.rows : undefined}
            error={pageError}
          />
        ) : null}
        {visibleGroups.map(
          ({ key, settingName, dateKey, records, aggregate }) => {
            const recordUma = resolveRecordUma(aggregate.cardId);
          const offline = records.every(
            (record) => recordCareerMode(record) === 'offline',
          );
          const settingDownloaded = hasLocalCareerSetting(
            records,
            accountCareerSettings,
          );
          const canDownloadSetting = hasCareerSettingSnapshot(records);
          const planSummary =
            historyView === 'task' ? taskPlanSummary(records[0]) : '';
          return (
            <section key={key} className="historyGroup uma-task-card">
              <div className="historyGroupHeader">
                <div className="min-w-0 flex-1">
                  <h3 className="historyLongText text-data font-semibold text-slate-800">
                    {historyView === 'task'
                      ? settingName
                      : formatRecordDate(dateKey)}
                  </h3>
                  {planSummary ? (
                    <p className="mt-0.5 text-caption font-medium text-indigo-600">
                      {planSummary}
                    </p>
                  ) : null}
                </div>
                <span className="historyGroupActions">
                  <span className={careerSettingModeBadgeClass(offline)}>
                    {offline ? '离线' : '在线'}
                  </span>
                  <span className="text-caption text-slate-500">
                    {aggregate.count} 次育成 ·{' '}
                    {records.reduce(
                      (total, record) => total + (record.task_count || 1),
                      0,
                    )}{' '}
                    次托管
                  </span>
                  {!readOnly && canDownloadSetting ? (
                    <button
                      type="button"
                      disabled={
                        settingDownloaded ||
                        busy.startsWith('history-setting-download:')
                      }
                      onClick={() => downloadCareerSetting(records)}
                      className="historyAction inline-flex items-center gap-1.5 rounded-md px-2 text-caption font-medium text-indigo-700 hover:bg-indigo-50 disabled:text-slate-500 disabled:opacity-70"
                      title={
                        settingDownloaded
                          ? 'UmaShow 中已有这个详设'
                          : '将记录中的详设保存到 UmaShow'
                      }
                    >
                      <Download size={14} />
                      {settingDownloaded ? '详设已保存' : '下载详设'}
                    </button>
                  ) : null}
                </span>
              </div>
              <button
                type="button"
                disabled={detailLoading}
                onClick={() => {
                  void openDetails(records);
                }}
                className="historyRecordRow"
              >
                <span className="historyIdentity flex min-w-0 items-center gap-3">
                  <span className="h-12 w-12 flex-none">
                    {recordUma ? (
                      <AssetIcon
                        path={recordUma.iconPath || ''}
                        fallback={
                          <AssetIcon
                            path={characterIconPath(recordUma.id) || ''}
                            alt={settingName}
                            className="h-full w-full object-contain"
                          />
                        }
                        alt={settingName}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Trophy size={20} className="m-3.5 text-slate-300" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <strong className="historyLongText block text-data font-semibold text-slate-900">
                      {settingName}
                    </strong>
                    <span className="historyLongText mt-1 block text-caption text-slate-500">
                      {formatReportTime(aggregate.startedAt)} 至{' '}
                      {formatReportTime(aggregate.endedAt)}
                    </span>
                  </span>
                </span>

                <HistoryMetrics
                  values={aggregate.metricsTotal}
                  completedCount={aggregate.count}
                />

                <ChevronRight
                  size={16}
                  className="historyRowChevron text-slate-400"
                  aria-hidden="true"
                />
              </button>
            </section>
          );
          },
        )}
        {pageError ? (
          <div role="alert" className="py-4 text-center text-label text-red-600">
            <p>{pageError}</p>
            <button
              type="button"
              className="historyAction mt-2 px-3 py-2 font-semibold underline"
              disabled={historyLoading}
              onClick={() => void activePage.loadMore()}
            >
              重试
            </button>
          </div>
        ) : paged && activePage.hasMore && activePage.rows.length > 0 ? (
          <div
            ref={loadMoreSentinelRef}
            data-testid="history-scroll-sentinel"
            aria-live="polite"
            className="flex min-h-8 items-center justify-center py-2"
          >
            {historyLoading ? (
              <span
                role="status"
                aria-label="正在加载更多"
                className="inline-flex items-center justify-center text-emerald-600"
              >
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              </span>
            ) : null}
          </div>
        ) : null}
        {historyView !== 'tracking' && !groups.length && !pageError ? (
          historyLoading ? (
            <div
              role="status"
              className="uma-task-card flex min-h-48 flex-col items-center justify-center p-8 text-center text-data text-slate-600"
            >
              <RefreshCw
                className="mx-auto animate-spin text-emerald-600"
                size={28}
              />
              <p className="mt-3 font-medium text-slate-700">读取中…</p>
            </div>
          ) : (
            <p
              role="status"
              className="py-14 text-center text-data text-slate-600"
            >
              当前账号暂无养马记录
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}

export default memo(HistoryTab);
