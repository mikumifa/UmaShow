/* eslint-disable no-nested-ternary */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  CircleStop,
  Database,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  dailyJewelScheduleStatusLabel,
  describeLogAction,
  describeLogDetail,
  describeRunnerAction,
  formatAccountError,
  formatDailyJewelScheduleWindow,
  HIDDEN_RUNNER_LOG_ACTIONS,
  panelClass,
  runModeLabel,
  statusBadgeClass,
  turnDateLabel,
} from './shared';
import {
  CareerSetting,
  Dashboard,
  Runner,
  RunnerStats,
  SessionAccount,
} from './types';

type ProgressTabProps = {
  currentCareerActive: boolean;
  activeCareerIconPath?: string;
  activeCareer?: SessionAccount['career'];
  currentCareerUma?: Dashboard['umas'][number];
  runner?: Runner;
  runnerStopping: boolean;
  runnerPaused: boolean;
  automationActive: boolean;
  currentRunnerStats: RunnerStats;
  busy: string;
  activeSetting?: CareerSetting;
  dailyJewelSchedule?: Runner['daily_jewel_schedule'];
  offlineMode: boolean;
  serverHostedMode: boolean;
  idleSingleMode?: SessionAccount['idle_single_mode'];
  abandonCareer: () => Promise<void>;
};

type StatDelta = {
  id: number;
  amount: number;
};

type AnimatedStatValueProps = {
  label: string;
  value?: number;
  resetKey: string;
  tone?: 'sky' | 'rose' | 'amber' | 'pink' | 'emerald' | 'indigo';
};

type AnimatedStatNumberProps = {
  value?: number;
  resetKey: string;
  className?: string;
};

function FloatingStatDelta({
  delta,
  onFinished,
}: {
  delta: StatDelta;
  onFinished: (id: number) => void;
}) {
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion) {
      const timeout = window.setTimeout(() => onFinished(delta.id), 650);
      return () => window.clearTimeout(timeout);
    }

    const animation = element.animate(
      [
        { opacity: 0, transform: 'translate(-50%, 6px) scale(0.85)' },
        {
          opacity: 1,
          offset: 0.12,
          transform: 'translate(-50%, -1px) scale(1)',
        },
        {
          opacity: 1,
          offset: 0.38,
          transform: 'translate(-50%, -4px) scale(1)',
        },
        {
          opacity: 1,
          offset: 0.78,
          transform: 'translate(-50%, -20px) scale(1)',
        },
        { opacity: 0, transform: 'translate(-50%, -30px) scale(0.94)' },
      ],
      {
        duration: 2800,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'forwards',
      },
    );
    const finish = () => onFinished(delta.id);
    animation.addEventListener('finish', finish);
    return () => {
      animation.removeEventListener('finish', finish);
      animation.cancel();
    };
  }, [delta.id, onFinished]);

  return (
    <span
      ref={elementRef}
      className={`pointer-events-none absolute bottom-3 left-1/2 z-10 whitespace-nowrap text-lg font-black tabular-nums drop-shadow-sm ${
        delta.amount > 0 ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {delta.amount > 0 ? '+' : ''}
      {delta.amount}
    </span>
  );
}

function AnimatedStatNumber({
  value,
  resetKey,
  className,
}: AnimatedStatNumberProps) {
  const normalizedValue =
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const [displayedValue, setDisplayedValue] = useState(normalizedValue);
  const [deltas, setDeltas] = useState<StatDelta[]>([]);
  const resetKeyRef = useRef(resetKey);
  const targetValueRef = useRef(normalizedValue);
  const displayedValueRef = useRef(normalizedValue);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const deltaIdRef = useRef(0);
  const valueElementRef = useRef<HTMLSpanElement>(null);

  const removeDelta = useCallback((id: number) => {
    setDeltas((current) => current.filter((delta) => delta.id !== id));
  }, []);

  useEffect(() => {
    const reset = resetKeyRef.current !== resetKey;
    const previousTarget = targetValueRef.current;
    resetKeyRef.current = resetKey;
    targetValueRef.current = normalizedValue;

    if (animationFrameRef.current !== undefined) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    if (
      reset ||
      previousTarget === undefined ||
      normalizedValue === undefined
    ) {
      displayedValueRef.current = normalizedValue;
      setDisplayedValue(normalizedValue);
      setDeltas([]);
      return undefined;
    }

    const amount = normalizedValue - previousTarget;
    if (!amount) {
      displayedValueRef.current = normalizedValue;
      setDisplayedValue(normalizedValue);
      return undefined;
    }

    deltaIdRef.current += 1;
    setDeltas((current) => [
      ...current.slice(-2),
      { id: deltaIdRef.current, amount },
    ]);

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion) {
      displayedValueRef.current = normalizedValue;
      setDisplayedValue(normalizedValue);
      return undefined;
    }

    valueElementRef.current?.animate(
      [
        { transform: 'translateY(2px) scale(0.92)', opacity: 0.65 },
        { transform: 'translateY(-1px) scale(1.08)', opacity: 1 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 720, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );

    const from = displayedValueRef.current ?? previousTarget;
    const startedAt = performance.now();
    const duration = 950;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const nextDisplayedValue = Math.round(
        from + (normalizedValue - from) * eased,
      );
      displayedValueRef.current = nextDisplayedValue;
      setDisplayedValue(nextDisplayedValue);
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = undefined;
      }
    };
    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [normalizedValue, resetKey]);

  return (
    <span className="relative inline-flex min-h-7 items-end">
      {deltas.map((delta) => (
        <FloatingStatDelta
          key={delta.id}
          delta={delta}
          onFinished={removeDelta}
        />
      ))}
      <span
        ref={valueElementRef}
        className={
          className ||
          'origin-bottom text-xl font-bold tabular-nums text-slate-800'
        }
      >
        {displayedValue ?? '-'}
      </span>
    </span>
  );
}

const STAT_TONE_CLASSES = {
  sky: {
    container: 'bg-sky-50/80',
    label: 'text-sky-600',
    value: 'text-sky-950',
  },
  rose: {
    container: 'bg-rose-50/80',
    label: 'text-rose-600',
    value: 'text-rose-950',
  },
  amber: {
    container: 'bg-amber-50/80',
    label: 'text-amber-600',
    value: 'text-amber-950',
  },
  pink: {
    container: 'bg-pink-50/80',
    label: 'text-pink-600',
    value: 'text-pink-950',
  },
  emerald: {
    container: 'bg-emerald-50/80',
    label: 'text-emerald-600',
    value: 'text-emerald-950',
  },
  indigo: {
    container: 'bg-indigo-50/90',
    label: 'text-indigo-600',
    value: 'text-indigo-950',
  },
};

function AnimatedStatValue({
  label,
  value,
  resetKey,
  tone = 'sky',
}: AnimatedStatValueProps) {
  const toneClasses = STAT_TONE_CLASSES[tone];
  return (
    <div
      className={`relative min-w-[92px] flex-1 rounded-lg px-3 py-2.5 ${toneClasses.container}`}
    >
      <p className={`text-[11px] font-semibold ${toneClasses.label}`}>
        {label}
      </p>
      <div className="mt-0.5">
        <AnimatedStatNumber
          value={value}
          resetKey={resetKey}
          className={`origin-bottom text-2xl font-bold tabular-nums ${toneClasses.value}`}
        />
      </div>
    </div>
  );
}

function visibleRunnerLog(runner?: Runner) {
  const visibleRows = (runner?.log || []).filter(
    (row) => !HIDDEN_RUNNER_LOG_ACTIONS.has(row.action),
  );

  return visibleRows.filter((row, index) => {
    if (row.action !== 'skills' || index === 0) return true;
    const previous = visibleRows[index - 1];
    return !(
      previous.action === row.action &&
      previous.turn === row.turn &&
      previous.detail === row.detail
    );
  });
}

function dailyPlanGoalLabel(
  schedule: NonNullable<Runner['daily_jewel_schedule']>,
  dailyJewelDropCount?: number,
) {
  switch (schedule.mode) {
    case 'single':
      return '每天单次';
    case 'continuous':
      return '每天持续';
    case 'count':
      return `每天完成 ${schedule.target} 次`;
    case 'queue':
      return '每天执行完整队列';
    case 'jewel_drops':
    default:
      return `今日钻石 ${schedule.daily_jewel_drop_count ?? dailyJewelDropCount ?? 0}/${schedule.target} 次`;
  }
}

function currentRunPlanLabel(runner?: Runner) {
  const queue = runner?.run_plan?.queue;
  const queueItem = queue?.items?.[queue.current_index];
  const mode = queueItem?.goal || runner?.run_plan?.mode;
  const target = queueItem?.target || runner?.run_plan?.target || 1;

  switch (mode) {
    case 'count':
      return `完成 ${target} 次`;
    case 'jewel_drops':
      return `获得 ${target} 次钻石`;
    case 'daily_count':
      return `每日完成 ${target} 次`;
    case 'daily_jewel_drops':
    case 'daily_jewel_schedule':
      return `每日获得 ${target} 次钻石`;
    default:
      return runModeLabel(mode);
  }
}

function WaitingCareerStartCard({
  currentSettingName,
  offlineMode,
}: {
  currentSettingName: string;
  offlineMode: boolean;
}) {
  return (
    <section
      className={panelClass(
        'relative isolate overflow-hidden border-indigo-100 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/80 p-6',
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 -z-10 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-44 w-44 rounded-full bg-violet-200/35 blur-3xl" />

      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <div className="relative flex h-16 w-16 flex-none items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-300/25" />
          <span className="absolute inset-1 rounded-full border border-indigo-200 bg-white/80 shadow-sm" />
          <RefreshCw
            size={28}
            className="relative animate-spin text-indigo-600"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-lg font-bold text-slate-900">
              正在等待育成开始
            </h3>
            <span className={statusBadgeClass('violet')}>准备中</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-indigo-700">
              {currentSettingName}
            </span>
            {offlineMode
              ? ' 已提交，服务端正在分配离线育成任务。'
              : ' 已进入执行队列，正在准备游戏会话。'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            育成开始后将自动切换为实时属性与当前流程，无需手动刷新。
          </p>
        </div>

        <div className="flex flex-none items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-2 w-2 animate-pulse rounded-full bg-indigo-400"
              style={{ animationDelay: `${index * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ProgressTab({
  currentCareerActive,
  activeCareerIconPath,
  activeCareer,
  currentCareerUma,
  runner,
  runnerStopping,
  runnerPaused,
  automationActive,
  currentRunnerStats,
  busy,
  activeSetting,
  dailyJewelSchedule,
  offlineMode,
  serverHostedMode,
  idleSingleMode,
  abandonCareer,
}: ProgressTabProps) {
  const runnerClosing = busy === 'stop';
  const liveActivity = runner?.live_activity;
  const runnerLog = visibleRunnerLog(runner);
  const statAnimationResetKey =
    runner?.run_id ||
    runner?.state_epoch ||
    `${activeCareer?.card_id || currentCareerUma?.id || 'career'}:${activeCareer?.scenario_id || 0}`;
  const activeQueue = runner?.run_plan?.queue;
  const activeQueueItem = activeQueue?.items?.[activeQueue.current_index];
  const currentSettingName =
    activeSetting?.name ||
    activeQueueItem?.career_setting_name ||
    activeCareer?.name ||
    currentCareerUma?.name ||
    '当前详设';
  const liveRunnerTurn = [
    runner?.turn,
    runner?.current_turn,
    ...(runner?.action_history || []).map((row) => row.turn),
    ...(runner?.log || []).map((row) => row.turn),
  ].reduce((latest, value) => {
    const turn = Number(value);
    return Number.isFinite(turn) && turn > latest ? turn : latest;
  }, 0);
  const currentCareerTurn = liveRunnerTurn || activeCareer?.turn;
  const runnerErrors = [runner?.last_error]
    .map(formatAccountError)
    .filter(
      (message, index, messages) =>
        Boolean(message) && messages.indexOf(message) === index,
    );
  const runnerG123RaceCount = Object.values(
    runner?.g123_race_counts || {},
  ).reduce((sum, count) => sum + Number(count || 0), 0);
  const queuedPlan = Boolean(runner?.run_plan?.active && !runner?.running);
  const waitingForCareerStart = Boolean(
    currentCareerActive &&
      automationActive &&
      !runnerStopping &&
      !runnerPaused &&
      !runner?.running &&
      !idleSingleMode?.active &&
      !runner?.finished,
  );
  const liveActivityLabel =
    automationActive && liveActivity?.endpoint
      ? `Endpoint: ${liveActivity.endpoint}${liveActivity.delay > 0 ? ` · Delay: ${liveActivity.delay.toFixed(3)}s` : ''}${liveActivity.detail && !runnerErrors.includes(formatAccountError(liveActivity.detail)) ? ` · ${liveActivity.detail}` : ''}`
      : '';
  return currentCareerActive ? (
    <div className="space-y-4">
      <section className={panelClass('p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-gray-100">
              {activeCareerIconPath ? (
                <AssetIcon
                  path={activeCareerIconPath}
                  alt={
                    activeCareer?.name || currentCareerUma?.name || '当前育成'
                  }
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <Database size={28} className="m-6 text-gray-300" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-bold text-slate-900">
                  {currentSettingName} · {currentRunPlanLabel(runner)}
                </h2>
                <span
                  className={statusBadgeClass(
                    runnerStopping || runnerPaused
                      ? 'amber'
                      : automationActive
                        ? 'emerald'
                        : 'slate',
                  )}
                >
                  {runnerStopping
                    ? runnerClosing
                      ? '正在关闭…'
                      : '正在暂停…'
                    : runnerPaused
                      ? '计划已暂停'
                      : offlineMode
                        ? idleSingleMode?.active
                          ? '离线育成中'
                          : '等待服务端调度'
                        : queuedPlan
                          ? '等待服务端调度'
                          : automationActive
                            ? '自动育成中'
                            : runner?.run_plan?.stop_reason ||
                              (runner?.finished ? '本次已完成' : '等待开始')}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-indigo-600">
                {offlineMode
                  ? idleSingleMode?.active
                    ? idleSingleMode.ends_at
                      ? `${idleSingleMode.ends_at} 完成`
                      : '等待服务器返回结束时间'
                    : '离线育成启动队列'
                  : turnDateLabel(currentCareerTurn)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                {runnerStopping || runnerPaused ? (
                  <RefreshCw
                    size={15}
                    className={
                      runnerStopping
                        ? 'animate-spin text-amber-500'
                        : 'text-amber-500'
                    }
                  />
                ) : waitingForCareerStart ? (
                  <RefreshCw
                    size={15}
                    className="animate-spin text-indigo-500"
                  />
                ) : (
                  <Activity size={15} className="text-indigo-500" />
                )}
                {runnerStopping
                  ? runnerClosing
                    ? '正在等待服务端关闭计划'
                    : '正在等待服务端保存暂停状态'
                  : runnerPaused
                    ? '计划进度已保存，恢复时会重新创建育成执行器'
                    : offlineMode
                      ? idleSingleMode?.active
                        ? '任务由服务端跟踪，完成后会处理结果并推进下一次计划'
                        : '计划已提交，正在等待服务端开始离线育成'
                      : queuedPlan
                        ? liveActivityLabel || '计划已提交，等待服务端推进'
                        : liveActivityLabel ||
                          describeRunnerAction(runner?.last_action)}
              </p>
              {!offlineMode && !waitingForCareerStart ? (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    体力 {currentRunnerStats.hp ?? activeCareer?.vital ?? 0}/
                    {currentRunnerStats.max_hp ??
                      activeCareer?.max_vital ??
                      100}
                  </span>
                  <span>干劲 {currentRunnerStats.motivation ?? '-'}</span>
                </div>
              ) : null}
            </div>
          </div>
          {!serverHostedMode && !runnerPaused ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={abandonCareer}
                disabled={[
                  'abandon',
                  'stop',
                  'idle-single-mode-abandon',
                ].includes(busy)}
                className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {['abandon', 'stop', 'idle-single-mode-abandon'].includes(busy)
                  ? '正在放弃…'
                  : '放弃本次育成'}
              </button>
            </div>
          ) : null}
        </div>

        {runnerErrors.length ? (
          <div className="mt-4 flex items-start gap-2 border-t border-red-100 pt-4 text-sm text-red-700">
            <CircleStop size={16} className="mt-0.5 flex-none" />
            <div className="min-w-0 space-y-1">
              {runnerErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        ) : null}

        {runnerStopping ? (
          <div className="mt-4 border-t border-amber-100 pt-4 text-sm text-amber-700">
            {runnerClosing
              ? '正在关闭计划。游戏中的当前育成不会被主动放弃。'
              : '正在保存计划进度并暂停执行。暂停不会放弃当前育成。'}
          </div>
        ) : null}

        {!offlineMode && !waitingForCareerStart ? (
          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(440px,0.65fr)]">
            <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
              {[
                ['速度', currentRunnerStats.speed, 'sky'],
                ['耐力', currentRunnerStats.stamina, 'rose'],
                ['力量', currentRunnerStats.power, 'amber'],
                ['毅力', currentRunnerStats.guts, 'pink'],
                ['智力', currentRunnerStats.wit, 'emerald'],
                ['PT', currentRunnerStats.skill_point, 'indigo'],
              ].map(([label, value, tone]) => (
                <AnimatedStatValue
                  key={String(label)}
                  label={String(label)}
                  value={typeof value === 'number' ? value : undefined}
                  resetKey={statAnimationResetKey}
                  tone={tone as AnimatedStatValueProps['tone']}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold text-amber-700">大差</p>
                <div className="mt-1 flex min-h-7 items-end gap-1 whitespace-nowrap text-amber-700">
                  <AnimatedStatNumber
                    value={runner?.large_margin_count || 0}
                    resetKey={statAnimationResetKey}
                    className="origin-bottom text-2xl font-bold tabular-nums text-amber-800"
                  />
                  <span className="pb-0.5 text-xs">/</span>
                  <span className="pb-px text-lg font-bold tabular-nums text-amber-950">
                    {runnerG123RaceCount}
                  </span>
                  <span className="pb-0.5 text-xs">场</span>
                </div>
              </div>

              <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold text-violet-700">
                  本局宝石
                </p>
                <div className="mt-1 flex min-h-7 items-end gap-1 whitespace-nowrap text-violet-600">
                  <AnimatedStatNumber
                    value={runner?.jewel_drop_count || 0}
                    resetKey={statAnimationResetKey}
                    className="origin-bottom text-2xl font-bold tabular-nums text-violet-800"
                  />
                  <span className="pb-0.5 text-xs">次 /</span>
                  <AnimatedStatNumber
                    value={runner?.jewels_earned || 0}
                    resetKey={statAnimationResetKey}
                    className="origin-bottom text-lg font-bold tabular-nums text-violet-800"
                  />
                  <span className="pb-0.5 text-xs">个</span>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold text-indigo-700">
                  今日宝石
                </p>
                <div className="mt-1 flex min-h-7 items-end gap-1 whitespace-nowrap text-indigo-600">
                  <AnimatedStatNumber
                    value={runner?.daily_jewel_drop_count || 0}
                    resetKey={statAnimationResetKey}
                    className="origin-bottom text-2xl font-bold tabular-nums text-indigo-800"
                  />
                  <span className="pb-0.5 text-xs">次</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {dailyJewelSchedule?.enabled ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-4 text-sm">
            <div>
              <span className="font-semibold text-violet-800">
                每日运行计划
              </span>
              <span className="ml-2 text-xs text-violet-600">
                {`${formatDailyJewelScheduleWindow(
                  dailyJewelSchedule.start_time,
                  dailyJewelSchedule.end_time,
                )} · ${dailyPlanGoalLabel(
                  dailyJewelSchedule,
                  runner?.daily_jewel_drop_count,
                )}`}
              </span>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
              {dailyJewelScheduleStatusLabel(dailyJewelSchedule.status)}
            </span>
          </div>
        ) : null}
      </section>

      {waitingForCareerStart ? (
        <WaitingCareerStartCard
          currentSettingName={currentSettingName}
          offlineMode={offlineMode}
        />
      ) : !offlineMode ? (
        <section className={panelClass('overflow-hidden')}>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-bold text-slate-900">当前流程</h3>
          </div>
          <div className="cursor-text select-text">
            {runnerLog
              .slice()
              .reverse()
              .map((row) => (
                <div
                  key={`${runner?.run_id || 'legacy'}:${row.id}`}
                  className="grid gap-1 border-b border-slate-50 px-5 py-3 text-sm last:border-0 md:grid-cols-[210px_110px_minmax(0,1fr)] md:gap-3"
                >
                  <span className="whitespace-nowrap font-medium text-indigo-600">
                    {turnDateLabel(row.turn)}
                  </span>
                  <span className="font-semibold text-slate-700">
                    {describeLogAction(row.action)}
                  </span>
                  <span className="text-slate-500">
                    {describeLogDetail(row.detail)}
                  </span>
                </div>
              ))}
            {!runnerLog.length ? (
              <p className="p-10 text-center text-sm text-slate-400">
                暂无流程记录
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  ) : (
    <section
      className={panelClass(
        'flex min-h-[320px] items-center justify-center p-8 text-center',
      )}
    >
      <div>
        <Activity
          size={38}
          className={`mx-auto ${automationActive ? 'animate-pulse text-indigo-300' : 'text-slate-300'}`}
        />
        <h2 className="mt-4 font-bold text-slate-700">
          {dailyJewelSchedule?.enabled
            ? dailyJewelSchedule.status === 'completed'
              ? '今日运行计划已完成'
              : `每日运行计划：${dailyJewelScheduleStatusLabel(
                  dailyJewelSchedule.status,
                )}`
            : runner?.run_plan?.active
              ? '正在准备下一次育成'
              : '当前没有进行中的养马'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {dailyJewelSchedule?.enabled
            ? `每日 ${formatDailyJewelScheduleWindow(
                dailyJewelSchedule.start_time,
                dailyJewelSchedule.end_time,
              )} 运行，${dailyPlanGoalLabel(
                dailyJewelSchedule,
                runner?.daily_jewel_drop_count,
              )}。`
            : runner?.run_plan?.active
              ? '新的育成开始后，这里会显示实时状态。'
              : '开始或继续育成后，这里会显示当前属性和流程。'}
        </p>
        {dailyJewelSchedule?.last_error ? (
          <p className="mt-2 text-xs text-red-500">
            {formatAccountError(dailyJewelSchedule.last_error)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
