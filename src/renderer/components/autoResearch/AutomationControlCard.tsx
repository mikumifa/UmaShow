/* eslint-disable no-nested-ternary, jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction } from 'react';
import {
  CalendarClock,
  CircleStop,
  Gem,
  ListChecks,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { runModeLabel, statusBadgeClass } from './shared';
import {
  AccountAutomation,
  CareerSetting,
  RunMode,
  ScheduleTiming,
} from './types';
import RunTargetInput from './RunTargetInput';

type AutomationControlCardProps = {
  automation?: AccountAutomation;
  runnerStopping: boolean;
  runnerPaused: boolean;
  busy: string;
  runMode: RunMode;
  setRunMode: Dispatch<SetStateAction<RunMode>>;
  runCountTarget: number;
  setRunCountTarget: Dispatch<SetStateAction<number>>;
  jewelDropTarget: number;
  setJewelDropTarget: Dispatch<SetStateAction<number>>;
  remainingJewelDrops: number;
  repeatDaily: boolean;
  scheduleStartTime: string;
  setScheduleStartTime: Dispatch<SetStateAction<string>>;
  scheduleEndTime: string;
  setScheduleEndTime: Dispatch<SetStateAction<string>>;
  scheduleTiming: ScheduleTiming;
  setScheduleTiming: Dispatch<SetStateAction<ScheduleTiming>>;
  scheduledStartAt: string;
  setScheduledStartAt: Dispatch<SetStateAction<string>>;
  runDailyTasksWithCareer: boolean;
  updateRunningAutomation: () => Promise<void>;
  pauseCareer: () => Promise<void>;
  resumeCareer: () => Promise<void>;
  closeCareerPlan: () => Promise<void>;
  activeSetting?: CareerSetting;
  editPreset: (settingId: string) => void;
  canAppendCareerPlan: boolean;
  openAppendCareerPlan: () => void;
};

const modeOptions = [
  { id: 'single' as const, label: '单次', icon: Play },
  { id: 'continuous' as const, label: '持续', icon: RefreshCw },
  { id: 'count' as const, label: '完成 X 次', icon: ListChecks },
  { id: 'jewel_drops' as const, label: '获得 X 次', icon: Gem },
];

const defaultScheduledDateTime = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const itemGoalLabel = (
  goal: 'single' | 'continuous' | 'count' | 'jewel_drops',
  target: number,
  daily: boolean,
) => {
  if (goal === 'single') return '单次';
  if (goal === 'continuous') return '持续';
  if (goal === 'jewel_drops') {
    return `${daily ? '今日' : '目标'} ${target} 钻`;
  }
  return `${target} 次`;
};

export default function AutomationControlCard({
  automation,
  runnerStopping,
  runnerPaused,
  busy,
  runMode,
  setRunMode,
  runCountTarget,
  setRunCountTarget,
  jewelDropTarget,
  setJewelDropTarget,
  remainingJewelDrops,
  repeatDaily,
  scheduleStartTime,
  setScheduleStartTime,
  scheduleEndTime,
  setScheduleEndTime,
  scheduleTiming,
  setScheduleTiming,
  scheduledStartAt,
  setScheduledStartAt,
  runDailyTasksWithCareer,
  updateRunningAutomation,
  pauseCareer,
  resumeCareer,
  closeCareerPlan,
  activeSetting,
  editPreset,
  canAppendCareerPlan,
  openAppendCareerPlan,
}: AutomationControlCardProps) {
  const schedule = automation?.schedule;
  const observation = automation?.observation;
  const runnerClosing = busy === 'stop';
  const selectedTarget =
    runMode === 'count'
      ? runCountTarget
      : runMode === 'jewel_drops'
        ? jewelDropTarget
        : 1;
  const activeItemIndex = Math.max(0, observation?.current_index ?? 0);
  const activeItem = schedule?.items[activeItemIndex] || schedule?.items[0];
  const activeProgress = observation?.item_progress.find(
    (progress) => progress.id === activeItem?.id,
  );
  const daily = schedule?.cadence === 'daily';
  const countProgress =
    activeItem?.goal === 'count'
      ? {
          completed: activeProgress?.completed_runs || 0,
          target: activeItem.target,
        }
      : null;
  const editableSingleItem = schedule?.items.length === 1;
  const scheduleHasDelayedStart = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(
    String(schedule?.start_time || ''),
  );
  const scheduledStartChanged =
    !repeatDaily &&
    (scheduleTiming === 'scheduled'
      ? !scheduleHasDelayedStart ||
        String(schedule?.start_time || '').slice(0, 16) !== scheduledStartAt
      : scheduleHasDelayedStart);
  const scheduledStartValid =
    scheduleTiming !== 'scheduled' ||
    (Boolean(scheduledStartAt) &&
      new Date(scheduledStartAt).getTime() > Date.now());
  const scheduledStartLabel = scheduleHasDelayedStart
    ? new Date(String(schedule?.start_time)).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';
  const planChanged = Boolean(
    editableSingleItem &&
      activeItem &&
      (activeItem.goal !== runMode ||
        (['count', 'jewel_drops'].includes(runMode) &&
          activeItem.target !== selectedTarget) ||
        daily !== repeatDaily ||
        scheduledStartChanged ||
        (repeatDaily &&
          (schedule.start_time !== scheduleStartTime ||
            schedule.end_time !== scheduleEndTime))),
  );

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={statusBadgeClass(
                runnerStopping ||
                  runnerPaused ||
                  observation?.phase === 'blocked' ||
                  observation?.phase === 'recovering'
                  ? 'amber'
                  : observation?.phase === 'completed'
                    ? 'slate'
                    : 'emerald',
              )}
            >
              {runnerStopping
                ? runnerClosing
                  ? '正在关闭…'
                  : '正在暂停…'
                : runnerPaused
                  ? '已暂停'
                  : observation?.phase === 'blocked'
                    ? '需要处理'
                    : observation?.phase === 'recovering'
                      ? '正在恢复'
                      : observation?.phase === 'waiting'
                        ? '等待调度'
                        : observation?.phase === 'completed'
                          ? '已完成'
                          : schedule && schedule.items.length > 1
                            ? `计划 ${Math.min(activeItemIndex + 1, schedule.items.length)}/${schedule.items.length}`
                            : runModeLabel(activeItem?.goal)}
            </span>
            {countProgress ? (
              <span className={statusBadgeClass('sky')}>
                {countProgress.completed}/{countProgress.target} 次
              </span>
            ) : null}
            {daily ? (
              <span className={statusBadgeClass('violet')}>每日任务</span>
            ) : null}
            {runDailyTasksWithCareer ? (
              <span className={statusBadgeClass('sky')}>日常</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {scheduleHasDelayedStart && observation?.phase === 'waiting'
              ? `计划于 ${scheduledStartLabel} 启动 · ${activeItem?.career_setting_name || '当前详设'}`
              : activeItem
              ? `正在执行：${activeItem.career_setting_name || '当前详设'} · ${itemGoalLabel(
                  activeItem.goal,
                  activeItem.target,
                  daily,
                )}`
              : activeSetting?.mode === 'offline'
                ? '离线技能与因子配置已由服务器接管执行。'
                : observation?.reason || '等待调度器选择下一次育成。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={openAppendCareerPlan}
            disabled={!canAppendCareerPlan || runnerStopping || runnerPaused}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            <Plus size={14} />
            添加后续
          </button>
          {activeSetting && activeSetting.mode !== 'offline' ? (
            <button
              type="button"
              onClick={() => editPreset(activeSetting.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Settings2 size={14} />
              编辑预设
            </button>
          ) : null}
          {runnerPaused ? (
            <button
              type="button"
              onClick={resumeCareer}
              disabled={Boolean(busy)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Play size={14} />
              {busy === 'resume' ? '正在恢复…' : '恢复原计划'}
            </button>
          ) : (
            <button
              type="button"
              onClick={pauseCareer}
              disabled={runnerStopping || busy === 'pause'}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              {runnerStopping ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Pause size={14} />
              )}
              {runnerStopping && !runnerClosing ? '正在暂停…' : '暂停'}
            </button>
          )}
          <button
            type="button"
            onClick={closeCareerPlan}
            disabled={runnerStopping || Boolean(busy)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <CircleStop size={14} />
            {runnerClosing ? '正在关闭…' : '关闭'}
          </button>
          {planChanged && !runnerPaused ? (
            <button
              type="button"
              onClick={updateRunningAutomation}
              disabled={
                Boolean(busy) ||
                (runMode === 'jewel_drops' &&
                  !repeatDaily &&
                  remainingJewelDrops <= 0) ||
                !scheduledStartValid
              }
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={14} />
              {busy === 'update-schedule' ? '正在应用…' : '应用计划'}
            </button>
          ) : null}
        </div>
      </div>

      {editableSingleItem ? (
        <div className="mt-3 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const disabled =
              option.id === 'jewel_drops' &&
              !repeatDaily &&
              remainingJewelDrops <= 0;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setRunMode(option.id);
                  if (option.id === 'jewel_drops') {
                    setJewelDropTarget(
                      repeatDaily
                        ? 20
                        : Math.max(1, Math.min(remainingJewelDrops, 20)),
                    );
                  }
                }}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-left text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  runMode === option.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white/90 hover:text-slate-800'
                }`}
              >
                <Icon size={14} className="flex-none" />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {editableSingleItem && !repeatDaily ? (
        <div className="mt-2 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setScheduleTiming('now')}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 ${
              scheduleTiming === 'now'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white/90 hover:text-slate-800'
            }`}
          >
            <Play size={14} /> 立即启动
          </button>
          <button
            type="button"
            onClick={() => {
              setScheduleTiming('scheduled');
              if (!scheduledStartAt) {
                setScheduledStartAt(defaultScheduledDateTime());
              }
            }}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 ${
              scheduleTiming === 'scheduled'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:bg-white/90 hover:text-slate-800'
            }`}
          >
            <CalendarClock size={14} /> 定时启动
          </button>
          {scheduleTiming === 'scheduled' ? (
            <input
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(event) => setScheduledStartAt(event.target.value)}
              aria-label="定时启动日期和时间"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          ) : null}
        </div>
      ) : null}

      {schedule && schedule.items.length > 1 ? (
        <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {schedule.items.map((item, index) => {
            const progress = observation?.item_progress.find(
              (candidate) => candidate.id === item.id,
            );
            return (
              <li
                key={item.id}
                className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs ${
                  index === activeItemIndex
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                <span className="min-w-0 truncate">
                  {index + 1}. {item.career_setting_name || '未命名详设'}
                </span>
                <span className="flex-none font-medium">
                  {item.goal === 'count'
                    ? `${progress?.completed_runs || 0}/${item.target} 次`
                    : item.goal === 'jewel_drops'
                      ? `${progress?.jewel_drops || 0}/${item.target} 钻`
                      : itemGoalLabel(item.goal, item.target, daily)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {editableSingleItem && runMode === 'count' ? (
        <RunTargetInput
          compact
          className="mt-2 w-fit"
          prefix={repeatDaily ? '每天完成' : '从现在起完成'}
          value={runCountTarget}
          max={100}
          suffix="次育成"
          onValueChange={setRunCountTarget}
        />
      ) : null}

      {editableSingleItem && runMode === 'jewel_drops' ? (
        <RunTargetInput
          compact
          className="mt-2 w-fit"
          prefix={repeatDaily ? '每天累计达到' : '从现在起获得'}
          value={jewelDropTarget}
          max={repeatDaily ? 20 : Math.max(1, remainingJewelDrops)}
          suffix="次宝石掉落"
          hint={
            repeatDaily
              ? '当天已有的宝石掉落会计入目标'
              : `本周期剩余 ${remainingJewelDrops} 次`
          }
          onValueChange={setJewelDropTarget}
        />
      ) : null}

      {editableSingleItem && repeatDaily ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 text-xs text-slate-600">
          <label>
            <span className="mb-1 block">每日启动</span>
            <input
              type="time"
              value={scheduleStartTime}
              onChange={(event) => setScheduleStartTime(event.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="mb-1 block">每日结束</span>
            <input
              type="time"
              value={scheduleEndTime}
              onChange={(event) => setScheduleEndTime(event.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <span className="pb-2 text-slate-400">
            时段外等待；相同时间表示完整的一天周期
          </span>
        </div>
      ) : null}
    </section>
  );
}
