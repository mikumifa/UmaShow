/* eslint-disable no-nested-ternary */
import {
  Activity,
  CircleStop,
  Database,
  Gem,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  dailyJewelScheduleStatusLabel,
  describeLogAction,
  describeLogDetail,
  describeRunnerAction,
  formatDailyJewelScheduleWindow,
  HIDDEN_RUNNER_LOG_ACTIONS,
  panelClass,
  runModeLabel,
  turnDateLabel,
  waitTimeLabel,
} from './shared';
import { Dashboard, Runner, RunnerStats, SessionAccount } from './types';

type ProgressTabProps = {
  currentCareerActive: boolean;
  activeCareerIconPath?: string;
  activeCareer?: SessionAccount['career'];
  currentCareerUma?: Dashboard['umas'][number];
  runner?: Runner;
  runnerStopping: boolean;
  runnerSessionWaiting: boolean;
  automationActive: boolean;
  currentRunnerStats: RunnerStats;
  busy: string;
  releaseSessionWait: () => Promise<void>;
  dailyJewelSchedule?: Runner['daily_jewel_schedule'];
  hasRunPlan: boolean;
  abandonCareer: () => Promise<void>;
};

export default function ProgressTab({
  currentCareerActive,
  activeCareerIconPath,
  activeCareer,
  currentCareerUma,
  runner,
  runnerStopping,
  runnerSessionWaiting,
  automationActive,
  currentRunnerStats,
  busy,
  releaseSessionWait,
  dailyJewelSchedule,
  hasRunPlan,
  abandonCareer,
}: ProgressTabProps) {
  const liveActivity = runner?.live_activity;
  const queuedControl = Boolean(
    runner?.control?.desired_state === 'running' &&
      !runner?.running &&
      ['queued', 'reconnect_wait'].includes(runner?.control?.status || ''),
  );
  const liveActivityLabel =
    automationActive && liveActivity?.endpoint
      ? `Endpoint: ${liveActivity.endpoint}${liveActivity.delay > 0 ? ` · Delay: ${liveActivity.delay.toFixed(3)}s` : ''}${liveActivity.detail ? ` · ${liveActivity.detail}` : ''}`
      : '';
  return currentCareerActive ? (
    <div className="min-h-[calc(100vh-170px)] space-y-4">
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
                  className={`rounded-full px-2.5 py-1 text-xs ${runnerStopping || runnerSessionWaiting ? 'bg-amber-100 text-amber-700' : automationActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {runnerStopping
                    ? '正在暂停…'
                    : runnerSessionWaiting
                      ? '等待重新登录'
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
                {turnDateLabel(runner?.turn || activeCareer?.turn)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                {runnerStopping || runnerSessionWaiting ? (
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
                  ? '正在终止独立育成进程'
                  : runnerSessionWaiting
                    ? `账号可能正在其他位置操作，${waitTimeLabel(runner?.session_wait_seconds)}后重新登录`
                    : queuedControl
                      ? runner?.control?.status === 'reconnect_wait'
                        ? runner?.control?.detail?.last_error ||
                          '等待后台 Worker 重新连接账号'
                        : '启动请求已提交，正在等待后台 Worker 接手'
                      : liveActivityLabel ||
                        describeRunnerAction(runner?.last_action)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  体力 {currentRunnerStats.hp ?? activeCareer?.vital ?? 0}/
                  {currentRunnerStats.max_hp ?? activeCareer?.max_vital ?? 100}
                </span>
                <span>干劲 {currentRunnerStats.motivation ?? '-'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={abandonCareer}
              disabled={busy === 'abandon'}
              className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {busy === 'abandon' ? '正在放弃…' : '放弃本次育成'}
            </button>
          </div>
        </div>

        {runner?.last_error ? (
          <div className="mt-4 flex items-start gap-2 border-t border-red-100 pt-4 text-sm text-red-700">
            <CircleStop size={16} className="mt-0.5 flex-none" />
            <span>{runner.last_error}</span>
          </div>
        ) : null}

        {runnerStopping ? (
          <div className="mt-4 border-t border-amber-100 pt-4 text-sm text-amber-700">
            自动育成运行在独立进程中，暂停会立即结束自动操作；当前育成不会被放弃，之后仍可继续。
          </div>
        ) : null}

        {runnerSessionWaiting ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 pt-4 text-sm text-amber-700">
            <span>
              错误码 217 再次出现，自动操作已暂停。将在{' '}
              {waitTimeLabel(runner?.session_wait_seconds)}
              后重新登录并继续当前养马。
            </span>
            <button
              type="button"
              onClick={releaseSessionWait}
              disabled={busy === 'release-session-wait'}
              className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={
                  busy === 'release-session-wait' ? 'animate-spin' : ''
                }
              />
              {busy === 'release-session-wait' ? '正在重新登录…' : '立即继续'}
            </button>
          </div>
        ) : null}

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

        {dailyJewelSchedule?.enabled ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-4 text-sm">
            <div>
              <span className="font-semibold text-violet-800">
                每日宝石计划
              </span>
              <span className="ml-2 text-xs text-violet-600">
                {`${formatDailyJewelScheduleWindow(
                  dailyJewelSchedule.start_time,
                  dailyJewelSchedule.end_time,
                )} · 今日 ${dailyJewelSchedule.daily_jewel_drop_count}/${dailyJewelSchedule.target} 次`}
              </span>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
              {dailyJewelScheduleStatusLabel(dailyJewelSchedule.status)}
            </span>
          </div>
        ) : null}

        {runner?.run_plan && hasRunPlan ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
            <div>
              <span className="font-semibold text-slate-800">
                {runModeLabel(runner.run_plan.mode)}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                {runner.run_plan.mode === 'single'
                  ? `完成 ${runner.run_plan.completed_runs}/1 局`
                  : runner.run_plan.mode === 'continuous'
                    ? `已连续完成 ${runner.run_plan.completed_runs} 局`
                    : runner.run_plan.mode === 'count'
                      ? `本次 ${runner.run_plan.completed_runs}/${runner.run_plan.target} 局`
                      : runner.run_plan.mode === 'daily_count'
                        ? `今日 ${runner.run_plan.daily_completed_runs}/${runner.run_plan.target} 局`
                        : `本次 ${runner.run_plan.completed_jewel_drops}/${runner.run_plan.target} 次掉落`}
              </span>
            </div>
            {automationActive && runnerSessionWaiting ? (
              <button
                type="button"
                onClick={releaseSessionWait}
                disabled={busy === 'release-session-wait'}
                className="rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {busy === 'release-session-wait' ? '正在继续…' : '立即继续'}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

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
          {(runner?.log || [])
            .filter((row) => !HIDDEN_RUNNER_LOG_ACTIONS.has(row.action))
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
          {!(runner?.log || []).some(
            (row) => !HIDDEN_RUNNER_LOG_ACTIONS.has(row.action),
          ) ? (
            <p className="p-10 text-center text-sm text-slate-400">
              暂无流程记录
            </p>
          ) : null}
        </div>
      </section>
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
              ? '今日宝石目标已完成'
              : `每日宝石计划：${dailyJewelScheduleStatusLabel(
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
              )} 运行，今天 ${dailyJewelSchedule.daily_jewel_drop_count}/${dailyJewelSchedule.target} 次掉落。`
            : runner?.run_plan?.active
              ? '新的育成开始后，这里会显示实时状态。'
              : '开始或继续育成后，这里会显示当前属性和流程。'}
        </p>
        {dailyJewelSchedule?.last_error ? (
          <p className="mt-2 text-xs text-red-500">
            {dailyJewelSchedule.last_error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
