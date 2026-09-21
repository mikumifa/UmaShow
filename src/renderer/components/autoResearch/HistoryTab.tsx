/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  Dispatch,
  SetStateAction,
  TouchEvent as ReactTouchEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Download,
  ExternalLink,
  Gem,
  ListTodo,
  RefreshCw,
  Trash2,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { PlannerButton } from 'renderer/components/succession/PlannerComponents';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import AssetTracking from './AssetTracking';
import './History.css';
import { characterIconPath, umaSkinIconPath } from './SelectionCards';
import {
  careerSettingModeBadgeClass,
  formatAccountError,
  formatReportTime,
  panelClass,
} from './shared';
import {
  CareerSessionAttributes,
  CareerSessionRecord,
  CareerSessionRun,
  CareerSetting,
  G123RaceRecord,
  RaceOption,
  DailyAssetSnapshot,
} from './types';

type HistoryTabProps = {
  readOnly?: boolean;
  canDelete?: boolean;
  selectedCareerRecords: CareerSessionRecord[] | null;
  setSelectedCareerRecords: Dispatch<
    SetStateAction<CareerSessionRecord[] | null>
  >;
  busy: string;
  loadCareerHistory: (accountId: string) => Promise<void>;
  loadCareerHistoryDetail: (reportId: string) => Promise<CareerSessionRecord[]>;
  selectedAccountId: string;
  accountCareerSettings: CareerSetting[];
  careerHistory: CareerSessionRecord[];
  assetSnapshots: DailyAssetSnapshot[];
  downloadCareerSetting: (records: CareerSessionRecord[]) => Promise<void>;
  deleteCareerHistory: (reportIds: string[]) => Promise<void>;
  downloadTrainingHistory: (recordId: string) => Promise<void>;
  localTrainingHistoryIds: Set<string>;
  openTrainingHistory: (recordId: string) => void;
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

const runIdTimestamp = (runId?: string) => {
  const match = String(runId || '').match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
  );
  if (!match) return '';
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+08:00`;
};

const formatRunTime = (value?: string) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatRunDateTime = (value?: string) => {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

const recordStatisticSources = (record: CareerSessionRecord) => {
  const sources: Array<CareerSessionRun | CareerSessionRecord> = [
    ...(record.runs || []),
    ...(record.current ? [record.current] : []),
  ];
  return sources.length ? sources : [record];
};

type AggregatedG123Race = {
  raceId: number;
  programId: number;
  turn: number;
  raceName: string;
  largeMarginCount: number;
  raceCount: number;
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
    const sources = recordStatisticSources(record);
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
          raceName:
            String(raceRecord.race_name || '').trim() ||
            previous?.raceName ||
            '',
          largeMarginCount:
            (previous?.largeMarginCount || 0) +
            (raceRecord.large_margin ? 1 : 0),
          raceCount: (previous?.raceCount || 0) + 1,
          recordedAt:
            String(raceRecord.recorded_at || '') >
            String(previous?.recordedAt || '')
              ? String(raceRecord.recorded_at || '')
              : String(previous?.recordedAt || ''),
        });
      });
      return;
    }

    const allRaceCounts: Record<string, number> = {};
    const largeCounts: Record<string, number> = {};
    sources.forEach((source) => {
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
        raceName: previous?.raceName || '',
        largeMarginCount:
          (previous?.largeMarginCount || 0) + (largeCounts[raceId] || 0),
        raceCount: (previous?.raceCount || 0) + (allRaceCounts[raceId] || 0),
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
  const label = date.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return `${label} · 05:00–次日05:00`;
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
      const key = `${record.task_id || record.session_id || record.id}\u0000${settingKey}\u0000${dateKey}`;
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
  const statisticSources = records.flatMap(recordStatisticSources);
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
    attributesAverage,
    cardId: Number(sorted.find((record) => record.card_id)?.card_id || 0),
    startedAt: String(sorted[0]?.started_at || ''),
    endedAt: String(sorted.at(-1)?.ended_at || ''),
    largeMarginCount: statisticSources.reduce(
      (sum, source) =>
        sum +
        Number(
          source.large_margin_count ||
            Object.values(raceCounts(source.large_margin_race_counts)).reduce(
              (raceTotal, value) => raceTotal + value,
              0,
            ),
        ),
      0,
    ),
    g123RaceCount: statisticSources.reduce(
      (sum, source) => sum + totalRaceCount(source.g123_race_counts),
      0,
    ),
    g123Races: aggregateG123Races(records),
    jewelDropCount: statisticSources.reduce(
      (sum, source) => sum + Number(source.jewel_drop_count || 0),
      0,
    ),
    jewelsEarned: statisticSources.reduce(
      (sum, source) => sum + Number(source.jewels_earned || 0),
      0,
    ),
    clocksUsed: statisticSources.reduce(
      (sum, source) => sum + Number(source.clocks_used || 0),
      0,
    ),
    errors: [...new Set(records.map((record) => record.error).filter(Boolean))],
    rows,
  };
};

export default function HistoryTab({
  readOnly = false,
  canDelete = !readOnly,
  selectedCareerRecords,
  setSelectedCareerRecords,
  busy,
  loadCareerHistory,
  loadCareerHistoryDetail,
  selectedAccountId,
  accountCareerSettings,
  careerHistory,
  assetSnapshots,
  downloadCareerSetting,
  deleteCareerHistory,
  downloadTrainingHistory,
  localTrainingHistoryIds,
  openTrainingHistory,
  races,
}: HistoryTabProps) {
  const [historyView, setHistoryView] = useState<'day' | 'task' | 'tracking'>(
    'day',
  );
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
  }, [selectedAccountId, careerHistory]);
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
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const mobilePullToRefresh =
    document.documentElement.hasAttribute('data-autouma') &&
    window.matchMedia('(max-width: 639px)').matches;

  const updatePullDistance = (distance: number) => {
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  };

  const beginPull = (event: ReactTouchEvent<HTMLElement>) => {
    if (!mobilePullToRefresh || busy === 'history') return;
    const scrollContainer = event.currentTarget.closest(
      '.autoResearchContentGrid',
    ) as HTMLElement | null;
    if ((scrollContainer?.scrollTop || 0) > 0) return;
    pullStartY.current = event.touches[0]?.clientY ?? null;
  };

  const continuePull = (event: ReactTouchEvent<HTMLElement>) => {
    if (pullStartY.current === null) return;
    const scrollContainer = event.currentTarget.closest(
      '.autoResearchContentGrid',
    ) as HTMLElement | null;
    if ((scrollContainer?.scrollTop || 0) > 0) {
      pullStartY.current = null;
      updatePullDistance(0);
      return;
    }
    const distance = (event.touches[0]?.clientY || 0) - pullStartY.current;
    if (distance <= 0) {
      updatePullDistance(0);
      return;
    }
    event.preventDefault();
    updatePullDistance(Math.min(96, distance * 0.55));
  };

  const finishPull = () => {
    const shouldRefresh =
      mobilePullToRefresh &&
      pullDistanceRef.current >= 56 &&
      busy !== 'history' &&
      Boolean(selectedAccountId);
    pullStartY.current = null;
    updatePullDistance(0);
    if (shouldRefresh) {
      void loadCareerHistory(selectedAccountId);
    }
  };

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
    const planSummary = taskPlanSummary(selectedCareerRecords[0]);

    return (
      <div className="autoResearchHistory autoResearchHistoryDetail space-y-4">
        <section className={panelClass('p-3 sm:p-5')}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <PlannerButton
              variant="secondary"
              size="small"
              className="historyAction"
              onClick={() => setSelectedCareerRecords(null)}
            >
              <ArrowLeft size={14} />
              返回
            </PlannerButton>
            <div className="flex items-center gap-2">
              {!readOnly && canDownloadSetting ? (
                <PlannerButton
                  variant="secondary"
                  size="small"
                  className="historyAction"
                  disabled={
                    settingDownloaded ||
                    busy.startsWith('history-setting-download:')
                  }
                  onClick={() => downloadCareerSetting(selectedCareerRecords)}
                >
                  <Download size={14} />
                  {settingDownloaded ? '详设已保存' : '下载详设'}
                </PlannerButton>
              ) : null}
              {canDelete ? (
                <PlannerButton
                  variant="danger"
                  size="small"
                  className="historyAction"
                  disabled={busy === 'history-delete'}
                  onClick={() => {
                    if (
                      window.confirm(
                        `确定删除「${settingName}」${historyView === 'task' ? '的全部' : `在 ${formatRecordDate(dateKey)} 的`}养马记录吗？`,
                      )
                    ) {
                      deleteCareerHistory(
                        historyView === 'task'
                          ? [
                              `task:${selectedCareerRecords[0]?.task_id || selectedCareerRecords[0]?.session_id || ''}`,
                            ]
                          : selectedCareerRecords.map((record) => record.id),
                      );
                    }
                  }}
                >
                  <Trash2 size={14} />
                  删除
                </PlannerButton>
              ) : null}
            </div>
          </div>
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

          <div className="historySummary">
            <div>
              <p className="text-caption text-slate-500 sm:text-caption">
                完成次数
              </p>
              <strong className="mt-1 block text-section text-slate-900">
                {aggregate.count}
              </strong>
            </div>
            {!offlineHistory ? (
              <div>
                <p className="text-caption text-slate-500 sm:text-caption">
                  比赛大差
                </p>
                <strong className="mt-1 block text-section text-amber-700">
                  {aggregate.largeMarginCount} / {aggregate.g123RaceCount} 场
                </strong>
              </div>
            ) : null}
            {!offlineHistory ? (
              <div>
                <p className="text-caption text-slate-500 sm:text-caption">
                  使用闹钟
                </p>
                <strong className="mt-1 block text-section text-sky-700">
                  {aggregate.clocksUsed} 次
                </strong>
              </div>
            ) : null}
            <div>
              <p className="text-caption text-slate-500 sm:text-caption">
                宝石掉落
              </p>
              <strong className="mt-1 block text-section text-violet-700">
                {aggregate.jewelDropCount} 次 / {aggregate.jewelsEarned} 个
              </strong>
            </div>
          </div>
          <div className="historyAttributes mt-4">
            {attributeItems.map(([key, label]) => (
              <div key={key} className="min-w-0 text-center">
                <p className="truncate text-caption text-slate-500 sm:text-caption">
                  <span className="hidden sm:inline">平均</span>
                  {label}
                </p>
                <strong className="mt-1 block text-data font-semibold text-slate-900">
                  {formatMetric(aggregate.attributesAverage[key])}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className={panelClass('overflow-hidden')}>
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
                                (current ? currentDurationLabel(run) : '未知')}
                            </span>
                          </span>
                        </div>
                        {run.last_error ? (
                          <p className="historyLongText mt-2 text-caption text-red-700">
                            {formatAccountError(run.last_error)}
                          </p>
                        ) : null}
                        <div className="historyAttributes mt-3">
                          {attributeItems.map(([key, label]) => (
                            <span key={key} className="min-w-0 text-center">
                              <strong className="block text-label font-semibold text-slate-800">
                                {run.attributes?.[key] || 0}
                              </strong>
                              <span className="text-caption text-slate-500">
                                {label}
                              </span>
                            </span>
                          ))}
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
                            <span className="text-violet-700">
                              宝石 {run.jewel_drop_count || 0}/
                              {run.jewels_earned || 0}
                            </span>
                          </span>
                          {!readOnly && !offlineHistory && trainingHistoryId ? (
                            <button
                              type="button"
                              disabled={
                                busy === `history-download:${trainingHistoryId}`
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
                      {attributeItems.map(([key, label]) => (
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
                      <th className="px-3 py-3 font-medium">宝石掉落</th>
                      <th className="px-3 py-3 font-medium">开始</th>
                      <th className="px-3 py-3 font-medium">结束</th>
                      <th className="px-3 py-3 font-medium">持续</th>
                      {!readOnly && !offlineHistory ? (
                        <th className="px-3 py-3 text-right font-medium">
                          Training History
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
                            {attributeItems.map(([key]) => (
                              <td
                                key={key}
                                className="px-3 py-3 text-slate-700"
                              >
                                {run.attributes?.[key] || 0}
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
                            <td className="px-3 py-3 text-violet-700">
                              {run.jewel_drop_count || 0} 次 /{' '}
                              {run.jewels_earned || 0} 个
                            </td>
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
                                (current ? currentDurationLabel(run) : '未知')}
                            </td>
                            {!readOnly && !offlineHistory ? (
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
                                        openTrainingHistory(trainingHistoryId);
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
                                        ? '打开本机 Training History 记录'
                                        : '下载到本机 Training History'
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
        </section>

        {!offlineHistory ? (
          <section className={panelClass('p-3 sm:p-5')}>
            <h3 className="text-section font-semibold text-slate-900">
              大差情况
            </h3>
            {aggregate.g123Races.length ? (
              <div className="historyRaces mt-3">
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
                      className="flex min-w-0 items-center gap-3 border-b border-slate-100 py-3"
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
                        <strong className="historyLongText block text-data font-semibold text-slate-700">
                          {race?.name || raceRow.raceName || '未知比赛'}
                        </strong>
                        {race ? (
                          <span className="block text-caption text-slate-500">
                            {race.date} · {race.type} · {race.terrain} ·{' '}
                            {race.distance}
                          </span>
                        ) : null}
                        {raceRow.recordedAt ? (
                          <span className="block text-caption text-slate-500">
                            比赛时间 {formatReportTime(raceRow.recordedAt)}
                          </span>
                        ) : null}
                      </span>
                      <strong className="shrink-0 text-label tabular-nums text-amber-700">
                        {raceRow.largeMarginCount} / {raceRow.raceCount} 场
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-data text-slate-600">
                当天没有 G1、G2、G3、EX 比赛记录
              </p>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  const groups =
    historyView === 'task'
      ? groupRecordsByTask(
          careerHistory.filter((record) => record.aggregation_type !== 'day'),
        )
      : groupRecordsBySettingAndDate(
          careerHistory.filter((record) => record.aggregation_type !== 'task'),
        );
  const visibleGroups = historyView === 'tracking' ? [] : groups;
  return (
    <section
      className="autoResearchHistory"
      aria-busy={busy === 'history'}
      onTouchStart={beginPull}
      onTouchMove={continuePull}
      onTouchEnd={finishPull}
      onTouchCancel={finishPull}
    >
      {detailLoading ? <p role="status">正在读取记录详情…</p> : null}
      {detailError ? (
        <p role="alert" className="text-red-600">
          {detailError}
        </p>
      ) : null}
      {mobilePullToRefresh && (pullDistance > 0 || busy === 'history') ? (
        <div
          className="flex items-center justify-center overflow-hidden text-caption font-medium text-slate-500"
          style={{ height: busy === 'history' ? 40 : pullDistance }}
        >
          <RefreshCw
            size={15}
            className={busy === 'history' ? 'mr-2 animate-spin' : 'mr-2'}
            style={{
              transform:
                busy === 'history'
                  ? undefined
                  : `rotate(${Math.min(180, pullDistance * 3)}deg)`,
            }}
          />
          {busy === 'history'
            ? '正在刷新记录…'
            : pullDistance >= 56
              ? '松开刷新'
              : '下拉刷新'}
        </div>
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
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-label font-semibold transition-colors ${
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
          {busy === 'history' && !mobilePullToRefresh ? (
            <span
              role="status"
              className="flex items-center gap-2 text-caption text-slate-500"
            >
              <RefreshCw size={14} className="animate-spin" />
              正在刷新记录…
            </span>
          ) : null}
          {!mobilePullToRefresh ? (
            <button
              type="button"
              onClick={() => loadCareerHistory(selectedAccountId)}
              disabled={busy === 'history'}
              className="historyAction inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-label text-gray-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={busy === 'history' ? 'animate-spin' : ''}
              />
              刷新记录
            </button>
          ) : null}
        </div>
        {historyView === 'tracking' ? (
          <AssetTracking
            snapshots={assetSnapshots}
            loading={busy === 'history'}
          />
        ) : null}
        {visibleGroups.map(({ key, settingName, dateKey, records }) => {
          const aggregate = aggregateRecords(records);
          const recordUma = resolveRecordUma(aggregate.cardId);
          const offline = records.every(
            (record) => recordCareerMode(record) === 'offline',
          );
          const settingDownloaded = hasLocalCareerSetting(
            records,
            accountCareerSettings,
          );
          const canDownloadSetting = hasCareerSettingSnapshot(records);
          const planSummary = taskPlanSummary(records[0]);
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
                    {aggregate.count} 次育成 · {records.length} 次托管
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
                  {canDelete ? (
                    <button
                      type="button"
                      disabled={busy === 'history-delete'}
                      onClick={() => {
                        if (
                          window.confirm(
                            `确定删除「${settingName}」${historyView === 'task' ? '的全部' : `在 ${formatRecordDate(dateKey)} 的`}养马记录吗？`,
                          )
                        ) {
                          deleteCareerHistory(
                            historyView === 'task'
                              ? [
                                  `task:${records[0]?.task_id || records[0]?.session_id || ''}`,
                                ]
                              : records.map((record) => record.id),
                          );
                        }
                      }}
                      className="historyAction inline-flex w-9 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="删除"
                      aria-label="删除"
                    >
                      <Trash2 size={15} />
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

                <span className="historyAttributes text-center text-caption text-slate-500">
                  {attributeItems.map(([attributeKey, label]) => (
                    <span key={attributeKey} className="min-w-0">
                      <strong className="block text-data font-semibold text-slate-700">
                        {formatMetric(
                          aggregate.attributesAverage[attributeKey],
                        )}
                      </strong>
                      {label}
                    </span>
                  ))}
                </span>

                <span className="historyResults grid grid-cols-3 gap-2 text-center text-caption text-slate-500">
                  <span>
                    <strong className="block text-data text-slate-800">
                      {aggregate.count}
                    </strong>
                    完成
                  </span>
                  <span>
                    <strong className="block text-data text-amber-700">
                      {aggregate.largeMarginCount}
                    </strong>
                    大差
                  </span>
                  <span>
                    <strong className="flex items-center justify-center gap-1 text-data text-violet-700">
                      <Gem size={12} />
                      {aggregate.jewelDropCount}/{aggregate.jewelsEarned}
                    </strong>
                    掉落/宝石
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="historyRowChevron text-slate-400"
                  aria-hidden="true"
                />
              </button>
            </section>
          );
        })}
        {historyView !== 'tracking' && !groups.length && busy !== 'history' ? (
          <p
            role="status"
            className="py-14 text-center text-data text-slate-600"
          >
            当前账号暂无养马记录
          </p>
        ) : null}
      </div>
    </section>
  );
}
