/* eslint-disable no-nested-ternary, jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction } from 'react';
import {
  CircleStop,
  Gem,
  ListChecks,
  Play,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { panelClass, runModeLabel } from './shared';
import { CareerSetting, Runner, RunMode } from './types';

type AutomationControlCardProps = {
  automationActive: boolean;
  hasCurrentCareer: boolean;
  runner?: Runner;
  runnerStopping: boolean;
  busy: string;
  runMode: RunMode;
  setRunMode: Dispatch<SetStateAction<RunMode>>;
  runCountTarget: number;
  setRunCountTarget: Dispatch<SetStateAction<number>>;
  dailyRunTarget: number;
  setDailyRunTarget: Dispatch<SetStateAction<number>>;
  jewelDropTarget: number;
  setJewelDropTarget: Dispatch<SetStateAction<number>>;
  dailyRunCount: number;
  remainingJewelDrops: number;
  updateRunningAutomation: () => Promise<void>;
  stopCareer: () => Promise<void>;
  activeSetting?: CareerSetting;
  matchingSettings: CareerSetting[];
  editPreset: (settingId: string) => void;
  continueWithSetting: (settingId: string) => void;
};

const modeOptions = [
  { id: 'single' as const, label: '单次', icon: Play },
  { id: 'continuous' as const, label: '持续', icon: RefreshCw },
  { id: 'count' as const, label: '完成 X 次', icon: ListChecks },
  { id: 'daily_count' as const, label: '今日 X 次', icon: ListChecks },
  { id: 'jewel_drops' as const, label: '获得 X 次宝石', icon: Gem },
];

export default function AutomationControlCard({
  automationActive,
  hasCurrentCareer,
  runner,
  runnerStopping,
  busy,
  runMode,
  setRunMode,
  runCountTarget,
  setRunCountTarget,
  dailyRunTarget,
  setDailyRunTarget,
  jewelDropTarget,
  setJewelDropTarget,
  dailyRunCount,
  remainingJewelDrops,
  updateRunningAutomation,
  stopCareer,
  activeSetting,
  matchingSettings,
  editPreset,
  continueWithSetting,
}: AutomationControlCardProps) {
  const selectedTarget =
    runMode === 'count'
      ? runCountTarget
      : runMode === 'daily_count'
        ? dailyRunTarget
        : runMode === 'jewel_drops'
          ? jewelDropTarget
          : 1;
  const currentMode =
    runner?.run_plan?.mode || runner?.control?.request?.run_mode;
  const currentTarget =
    runner?.run_plan?.target || runner?.control?.request?.run_target || 1;
  const planChanged = Boolean(
    automationActive &&
      currentMode &&
      (currentMode !== runMode ||
        (['count', 'daily_count', 'jewel_drops'].includes(runMode) &&
          currentTarget !== selectedTarget)),
  );

  return (
    <section className={panelClass('border-indigo-200 p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">运行计划</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                automationActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {runnerStopping
                ? '正在暂停…'
                : automationActive
                  ? runModeLabel(
                      runner?.daily_jewel_schedule?.enabled
                        ? 'daily_jewel_schedule'
                        : runner?.run_plan?.mode,
                    )
                  : hasCurrentCareer
                    ? '已暂停'
                    : '等待开始'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {automationActive
              ? '运行中可修改；保存预设后从下一次决策开始生效。'
              : hasCurrentCareer
                ? '当前育成已保留，可选择详设继续。'
                : '先在这里选择运行计划，再从下方进入养马详设开始育成。'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {activeSetting ? (
            <button
              type="button"
              onClick={() => editPreset(activeSetting.id)}
              className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <Settings2 size={14} />
              编辑预设
            </button>
          ) : null}
          {automationActive ? (
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
              {runnerStopping ? '正在暂停…' : '暂停运行'}
            </button>
          ) : null}
          {planChanged ? (
            <button
              type="button"
              onClick={updateRunningAutomation}
              disabled={
                Boolean(busy) ||
                (runMode === 'daily_count' && dailyRunCount >= 100) ||
                (runMode === 'jewel_drops' && remainingJewelDrops <= 0)
              }
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={14} />
              {busy === 'update-runner' ? '正在应用…' : '应用计划'}
            </button>
          ) : null}
        </div>
      </div>

      {automationActive || !hasCurrentCareer ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {modeOptions.map((option) => {
              const Icon = option.icon;
              const disabled =
                (option.id === 'daily_count' && dailyRunCount >= 100) ||
                (option.id === 'jewel_drops' && remainingJewelDrops <= 0);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setRunMode(option.id);
                    if (option.id === 'daily_count') {
                      setDailyRunTarget((current) =>
                        Math.max(current, dailyRunCount + 1),
                      );
                    }
                    if (option.id === 'jewel_drops') {
                      setJewelDropTarget(
                        Math.max(1, Math.min(remainingJewelDrops, 20)),
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

          {runMode === 'count' ? (
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

          {runMode === 'daily_count' ? (
            <label className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
              今天总计完成
              <input
                type="number"
                min={Math.min(100, dailyRunCount + 1)}
                max={100}
                value={dailyRunTarget}
                onChange={(event) =>
                  setDailyRunTarget(
                    Math.max(
                      Math.min(100, dailyRunCount + 1),
                      Math.min(100, Number(event.target.value)),
                    ),
                  )
                }
                className="w-16 rounded border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-800"
              />
              次（今日已完成 {dailyRunCount} 次）
            </label>
          ) : null}

          {runMode === 'jewel_drops' ? (
            <label className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50/60 px-2.5 py-1.5 text-xs text-violet-700">
              从现在起获得
              <input
                type="number"
                min={1}
                max={Math.max(1, remainingJewelDrops)}
                value={jewelDropTarget}
                onChange={(event) =>
                  setJewelDropTarget(
                    Math.max(
                      1,
                      Math.min(
                        Math.max(1, remainingJewelDrops),
                        Number(event.target.value),
                      ),
                    ),
                  )
                }
                className="w-16 rounded border border-violet-200 bg-white px-2 py-1 font-semibold text-slate-800"
              />
              次宝石掉落（本周期剩余 {remainingJewelDrops} 次）
            </label>
          ) : null}

          {!automationActive ? (
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
              运行方式已经选好。请在下方选择或新建养马详设，点击“保存并开始”后生效。
            </p>
          ) : null}
        </>
      ) : matchingSettings.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {matchingSettings.map((setting) => (
            <article
              key={setting.id}
              className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5"
            >
              <strong className="block truncate text-sm text-slate-800">
                {setting.name}
              </strong>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                {setting.preset_name}
              </span>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => editPreset(setting.id)}
                  className="rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  编辑预设
                </button>
                <button
                  type="button"
                  onClick={() => continueWithSetting(setting.id)}
                  disabled={Boolean(busy)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play size={14} />
                  继续育成
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          没有找到与当前马娘匹配的养马详设，请先创建或调整养马详设。
        </p>
      )}
    </section>
  );
}
