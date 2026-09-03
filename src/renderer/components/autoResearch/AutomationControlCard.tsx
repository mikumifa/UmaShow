/* eslint-disable no-nested-ternary, jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction } from 'react';
import {
  CircleStop,
  Gem,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { panelClass, runModeLabel } from './shared';
import { CareerSetting, Runner, RunMode } from './types';

type AutomationControlCardProps = {
  runner?: Runner;
  runnerStopping: boolean;
  busy: string;
  runMode: RunMode;
  setRunMode: Dispatch<SetStateAction<RunMode>>;
  runCountTarget: number;
  setRunCountTarget: Dispatch<SetStateAction<number>>;
  jewelDropTarget: number;
  setJewelDropTarget: Dispatch<SetStateAction<number>>;
  remainingJewelDrops: number;
  repeatDaily: boolean;
  updateRunningAutomation: () => Promise<void>;
  stopCareer: () => Promise<void>;
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

export default function AutomationControlCard({
  runner,
  runnerStopping,
  busy,
  runMode,
  setRunMode,
  runCountTarget,
  setRunCountTarget,
  jewelDropTarget,
  setJewelDropTarget,
  remainingJewelDrops,
  repeatDaily,
  updateRunningAutomation,
  stopCareer,
  activeSetting,
  editPreset,
  canAppendCareerPlan,
  openAppendCareerPlan,
}: AutomationControlCardProps) {
  const selectedTarget =
    runMode === 'count'
      ? runCountTarget
      : runMode === 'jewel_drops'
        ? jewelDropTarget
        : 1;
  const rawCurrentMode =
    runner?.daily_jewel_schedule?.enabled &&
    runner.daily_jewel_schedule.mode !== 'queue'
      ? runner.daily_jewel_schedule.mode
      : runner?.run_plan?.mode || runner?.control?.request?.run_mode;
  const currentMode =
    rawCurrentMode === 'daily_count'
      ? 'count'
      : rawCurrentMode === 'daily_jewel_drops' ||
          rawCurrentMode === 'daily_jewel_schedule'
        ? 'jewel_drops'
        : rawCurrentMode;
  const currentTarget =
    runner?.run_plan?.target || runner?.control?.request?.run_target || 1;
  const queue =
    runner?.run_plan?.queue || runner?.control?.detail?.run_queue || undefined;
  const queueCurrent = queue?.items?.[queue.current_index];
  const planChanged = Boolean(
    !queue?.active &&
      !repeatDaily &&
      currentMode &&
      (currentMode !== runMode ||
        (['count', 'jewel_drops'].includes(runMode) &&
          currentTarget !== selectedTarget)),
  );

  return (
    <section className={panelClass('border-indigo-200 p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">运行计划</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              {runnerStopping
                ? '正在暂停…'
                : queue?.active
                  ? `队列 ${Math.min(queue.current_index + 1, queue.items.length)}/${queue.items.length}`
                  : runModeLabel(currentMode)}
            </span>
            {repeatDaily ? (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                每日任务
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {queue?.active && queueCurrent
              ? `正在执行：${queueCurrent.career_setting_name} · ${
                  queueCurrent.goal === 'single'
                    ? '单次'
                    : queueCurrent.goal === 'continuous'
                      ? '持续'
                      : queueCurrent.goal === 'jewel_drops'
                        ? `${repeatDaily ? '今日累计达到' : '获得'} ${queueCurrent.target} 次钻石`
                        : `完成 ${queueCurrent.target} 次育成`
                }`
              : activeSetting?.mode === 'offline'
                ? '离线技能与因子配置已由服务器接管执行。'
                : '服务器独占游戏 API；运行中修改的预设会从下一次决策开始生效。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={openAppendCareerPlan}
            disabled={!canAppendCareerPlan || runnerStopping}
            className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
          >
            <Plus size={14} />
            添加后续计划
          </button>
          {activeSetting && activeSetting.mode !== 'offline' ? (
            <button
              type="button"
              onClick={() => editPreset(activeSetting.id)}
              className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Settings2 size={14} />
              编辑预设
            </button>
          ) : null}
          <button
            type="button"
            onClick={stopCareer}
            disabled={runnerStopping || busy === 'stop'}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {runnerStopping ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <CircleStop size={14} />
            )}
            {runnerStopping ? '正在停止托管…' : '停止服务器托管'}
          </button>
          {planChanged ? (
            <button
              type="button"
              onClick={updateRunningAutomation}
              disabled={
                Boolean(busy) ||
                (runMode === 'jewel_drops' &&
                  !repeatDaily &&
                  remainingJewelDrops <= 0)
              }
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={14} />
              {busy === 'update-runner' ? '正在应用…' : '应用计划'}
            </button>
          ) : null}
        </div>
      </div>

      {!queue?.active && !repeatDaily ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const disabled =
              Boolean(queue?.active) ||
              (option.id === 'jewel_drops' &&
                !repeatDaily &&
                remainingJewelDrops <= 0);
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
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  runMode === option.id
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40'
                }`}
              >
                <Icon size={14} className="flex-none" />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {queue?.items?.length ? (
        <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {queue.items.map((item, index) => (
            <li
              key={item.id}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs ${
                index === queue.current_index
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <span className="min-w-0 truncate">
                {index + 1}. {item.career_setting_name}
              </span>
              <span className="flex-none font-medium">
                {item.status === 'completed'
                  ? '已完成'
                  : item.status === 'skipped'
                    ? '已跳过'
                    : item.goal === 'single'
                      ? '单次'
                      : item.goal === 'continuous'
                        ? '持续'
                        : item.goal === 'jewel_drops'
                          ? `${repeatDaily ? '今日' : '目标'} ${item.target} 钻`
                          : `${item.completed_runs || 0}/${item.target} 次`}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {!queue?.active && !repeatDaily && runMode === 'count' ? (
        <label className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          从现在起完成
          <input
            type="number"
            min={1}
            max={100}
            value={runCountTarget}
            onChange={(event) =>
              setRunCountTarget(
                Math.max(1, Math.min(100, Number(event.target.value))),
              )
            }
            className="w-16 rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800"
          />
          次育成
        </label>
      ) : null}

      {!queue?.active && !repeatDaily && runMode === 'jewel_drops' ? (
        <label className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50/60 px-2.5 py-1.5 text-xs text-violet-700">
          {repeatDaily ? '每天累计达到' : '从现在起获得'}
          <input
            type="number"
            min={1}
            max={repeatDaily ? 20 : Math.max(1, remainingJewelDrops)}
            value={jewelDropTarget}
            onChange={(event) =>
              setJewelDropTarget(
                Math.max(
                  1,
                  Math.min(
                    repeatDaily ? 20 : Math.max(1, remainingJewelDrops),
                    Number(event.target.value),
                  ),
                ),
              )
            }
            className="w-16 rounded border border-violet-200 bg-white px-2 py-1 font-semibold text-slate-800"
          />
          次宝石掉落
          {repeatDaily
            ? '（今天已有数量会计入）'
            : `（本周期剩余 ${remainingJewelDrops} 次）`}
        </label>
      ) : null}
    </section>
  );
}
