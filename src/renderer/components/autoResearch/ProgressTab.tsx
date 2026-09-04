/* eslint-disable no-nested-ternary */
import {
  Activity,
  CircleStop,
  Database,
  Gem,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Trophy,
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
  turnDateLabel,
} from './shared';
import { Dashboard, Runner, RunnerStats, SessionAccount } from './types';

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
  pauseCareer: () => Promise<void>;
  resumeCareer: () => Promise<void>;
  dailyJewelSchedule?: Runner['daily_jewel_schedule'];
  offlineMode: boolean;
  serverHostedMode: boolean;
  idleSingleMode?: SessionAccount['idle_single_mode'];
  abandonCareer: () => Promise<void>;
};

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
  pauseCareer,
  resumeCareer,
  dailyJewelSchedule,
  offlineMode,
  serverHostedMode,
  idleSingleMode,
  abandonCareer,
}: ProgressTabProps) {
  const liveActivity = runner?.live_activity;
  const runnerLog = visibleRunnerLog(runner);
  const runnerErrors = [runner?.last_error, runner?.control?.detail?.last_error]
    .map(formatAccountError)
    .filter(
      (message, index, messages) =>
        Boolean(message) && messages.indexOf(message) === index,
    );
  const runnerG123RaceCount = Object.values(
    runner?.g123_race_counts || {},
  ).reduce((sum, count) => sum + Number(count || 0), 0);
  const queuedControl = Boolean(
    runner?.control?.desired_state === 'running' &&
      !runner?.running &&
      ['queued', 'reconnect_wait'].includes(runner?.control?.status || ''),
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
                  {activeCareer?.name || currentCareerUma?.name || '当前养马'}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${runnerStopping || runnerPaused ? 'bg-amber-100 text-amber-700' : automationActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {runnerStopping
                    ? '正在暂停…'
                    : runnerPaused
                      ? '计划已暂停'
                      : offlineMode
                        ? idleSingleMode?.active ||
                          runner?.control?.status === 'running'
                          ? '离线育成中'
                          : runner?.control?.status === 'reconnect_wait'
                            ? '等待重新连接'
                            : '等待后台 Worker 启动'
                        : queuedControl
                          ? runner?.control?.status === 'reconnect_wait'
                            ? '等待重新连接'
                            : '等待后台 Worker 启动'
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
                      ? `游戏服务器正在执行离线育成 · 预计结束：${idleSingleMode.ends_at}`
                      : '游戏服务器正在执行离线育成 · 等待服务器返回结束时间'
                    : '离线育成启动队列'
                  : turnDateLabel(runner?.turn || activeCareer?.turn)}
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
                ) : (
                  <Activity size={15} className="text-indigo-500" />
                )}
                {runnerStopping
                  ? '正在等待服务器 Worker 确认暂停'
                  : runnerPaused
                    ? 'Worker 与自动重登已停止，其他设备现在可以登录'
                    : offlineMode
                      ? runner?.control?.status === 'reconnect_wait'
                        ? liveActivityLabel || '等待后台 Worker 重新连接账号'
                        : idleSingleMode?.active ||
                            runner?.control?.status === 'running'
                          ? '任务已交给游戏服务器，完成后会自动处理结果并开始下一局'
                          : '启动请求已提交，正在等待后台 Worker 接手'
                      : queuedControl
                        ? runner?.control?.status === 'reconnect_wait'
                          ? liveActivityLabel || '等待后台 Worker 重新连接账号'
                          : '启动请求已提交，正在等待后台 Worker 接手'
                        : liveActivityLabel ||
                          describeRunnerAction(runner?.last_action)}
              </p>
              {!offlineMode ? (
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
          <div className="flex flex-wrap gap-2">
            {runnerPaused ? (
              <button
                type="button"
                onClick={resumeCareer}
                disabled={Boolean(busy)}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play size={16} />
                {busy === 'resume' ? '正在恢复…' : '恢复原计划'}
              </button>
            ) : serverHostedMode ? (
              <button
                type="button"
                onClick={pauseCareer}
                disabled={runnerStopping || busy === 'pause'}
                className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                <Pause size={16} />
                {runnerStopping ? '正在暂停…' : '暂停当前计划'}
              </button>
            ) : (
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
            )}
          </div>
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
            正在保存计划进度并停止服务器
            Worker。暂停不会放弃当前育成；完成后其他设备可以登录。
          </div>
        ) : null}

        {runnerPaused ? (
          <div className="mt-4 border-t border-amber-100 pt-4 text-sm text-amber-700">
            原计划及已完成进度已保留。恢复时会重新登录，并从游戏中的当前育成状态继续执行。
          </div>
        ) : null}

        {!offlineMode ? (
          <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['速度', currentRunnerStats.speed],
              ['耐力', currentRunnerStats.stamina],
              ['力量', currentRunnerStats.power],
              ['毅力', currentRunnerStats.guts],
              ['智力', currentRunnerStats.wit],
              ['PT', currentRunnerStats.skill_point],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="border-b border-r border-slate-100 px-4 py-3 last:border-r-0 sm:border-b-0"
              >
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-800">
                  {value ?? '-'}
                </p>
              </div>
            ))}
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

      {!offlineMode ? (
        <section className={panelClass('overflow-hidden')}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="font-bold text-slate-900">当前流程</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                按游戏日期显示训练、事件和比赛结果。
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-500" />
                比赛大差 {runner?.large_margin_count || 0}/{runnerG123RaceCount}{' '}
                场
              </span>
              <span className="flex items-center gap-1.5">
                <Gem size={14} className="text-violet-500" />
                本局 {runner?.jewel_drop_count || 0} 次 /{' '}
                {runner?.jewels_earned || 0} 个
              </span>
              <span>
                今天 {runner?.daily_jewel_drop_count || 0}/
                {runner?.daily_jewel_drop_limit || 20} 次
              </span>
            </div>
          </div>
          <div className="max-h-[560px] cursor-text select-text overflow-auto">
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
        'flex min-h-[calc(100vh-170px)] items-center justify-center p-8 text-center',
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
