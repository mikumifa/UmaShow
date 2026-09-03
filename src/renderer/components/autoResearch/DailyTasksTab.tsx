import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  ChevronsUpDown,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  Save,
  ShoppingBag,
  Swords,
  Users,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import DailyHorsePicker, {
  aptitudeLabel,
  distanceAptitude,
  groundAptitude,
} from './DailyHorsePicker';
import { horseIconPath } from './SelectionCards';
import { formatAccountError, panelClass } from './shared';
import {
  DailyTaskResult,
  DailyTasksConfig,
  DailyTasksOptions,
  DailyTasksResponse,
} from './types';

type Props = {
  overview: DailyTasksResponse | null;
  loading: boolean;
  loadError: string;
  busy: string;
  locked: boolean;
  onRetry: () => void;
  onSave: (config: DailyTasksConfig) => Promise<void>;
  onRun: (config: DailyTasksConfig) => Promise<void>;
};

const emptyConfig = (): DailyTasksConfig => ({
  schema_version: 3,
  enabled: false,
  run_time: '05:10',
  daily_race: {
    enabled: false,
    daily_race_id: 0,
    trained_chara_id: 0,
    running_style: 0,
  },
  daily_legend_race: {
    enabled: false,
    daily_legend_race_id: 0,
    trained_chara_id: 0,
    running_style: 0,
  },
  team_stadium: { enabled: false, opponent_strength: 3 },
  limited_shop: { enabled: false, buy_all: true },
  circle: {
    donate_enabled: false,
    donate_item_ids: [],
    request_enabled: false,
    request_item_id: 0,
  },
});

const toggleClass = (enabled: boolean) =>
  `relative h-6 w-11 rounded-full transition-colors ${
    enabled ? 'bg-indigo-600' : 'bg-slate-300'
  }`;

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${toggleClass(checked)} disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-400';

const taskNames: Record<string, string> = {
  daily_race: '每日竞赛',
  daily_legend_race: '每日传奇赛事',
  team_stadium: '竞技场',
  limited_shop: '限时商店',
  circle: '社团',
};

type DailyHorse = DailyTasksOptions['trained_charas'][number];
type DailyRace =
  | DailyTasksOptions['daily_races'][number]
  | DailyTasksOptions['daily_legend_races'][number];

function HorseSelectButton({
  horse,
  race,
  disabled,
  onClick,
}: {
  horse?: DailyHorse;
  race?: DailyRace;
  disabled: boolean;
  onClick: () => void;
}) {
  const iconPath = horse
    ? horseIconPath(horse.card_id, horse.rarity, horse.race_cloth_id)
    : undefined;
  const label = horse?.name || (race && '点击选择已育成马娘') || '请先选择赛事';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${fieldClass} flex min-h-[42px] items-center gap-2 text-left disabled:cursor-not-allowed`}
    >
      {horse && iconPath ? (
        <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100">
          <AssetIcon
            path={iconPath}
            alt={horse.name}
            className="h-full w-full object-cover"
          />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {horse && race ? (
          <span className="block text-xs text-slate-400">
            评分 {horse.rank_score} · 距离{' '}
            {aptitudeLabel(distanceAptitude(horse, race))}
            {' · '}
            {race.ground_name} {aptitudeLabel(groundAptitude(horse, race))}
          </span>
        ) : null}
      </span>
      <ChevronsUpDown className="shrink-0 text-slate-400" size={16} />
    </button>
  );
}

const statusLabel: Record<string, string> = {
  disabled: '未启用',
  paused: '计划已暂停',
  waiting: '等待执行',
  waiting_busy: '等待自动育成结束',
  running: '执行中',
  completed: '已完成',
  completed_with_errors: '部分失败',
  skipped: '已跳过',
  error: '失败',
  interrupted: '已中断',
};

function formatScheduleTime(timestamp?: number) {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function AvailabilityNotice({
  available,
  canRunNow,
  reason,
  readyDetail,
}: {
  available?: boolean;
  canRunNow?: boolean;
  reason?: string;
  readyDetail?: string;
}) {
  if (available == null) return null;
  const ready = available && canRunNow;
  const message = ready ? readyDetail : reason;
  if (!message) return null;
  let color = 'border-red-200 bg-red-50 text-red-700';
  if (available) color = 'border-amber-200 bg-amber-50 text-amber-800';
  if (ready) color = 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${color}`}>
      {message}
    </div>
  );
}

function ResultCard({
  name,
  result,
}: {
  name: string;
  result: DailyTaskResult;
}) {
  const bad = result.status === 'error';
  return (
    <div
      className={`rounded-lg border p-3 ${
        bad ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">
          {taskNames[name] || name}
        </span>
        <span
          className={`text-xs font-medium ${bad ? 'text-red-600' : 'text-slate-500'}`}
        >
          {statusLabel[result.status] || result.status}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{result.detail}</p>
    </div>
  );
}

export default function DailyTasksTab({
  overview,
  loading,
  loadError,
  busy,
  locked,
  onRetry,
  onSave,
  onRun,
}: Props) {
  const [draft, setDraft] = useState<DailyTasksConfig>(emptyConfig);
  const [horsePicker, setHorsePicker] = useState<
    'daily_race' | 'daily_legend_race' | null
  >(null);

  useEffect(() => {
    if (overview?.daily_tasks) {
      setDraft(structuredClone(overview.daily_tasks));
    }
  }, [overview]);

  if (locked) return null;

  let loadStatus = '正在连接服务端日常任务…';
  if (loading) loadStatus = '正在读取服务端日常配置…';
  if (loadError) loadStatus = '每日日常加载失败';

  if (!overview) {
    return (
      <section
        className={panelClass(
          'flex min-h-48 items-center justify-center p-10 text-center text-sm text-slate-500',
        )}
      >
        <div>
          {loading ? (
            <RefreshCw
              className="mx-auto animate-spin text-indigo-400"
              size={30}
            />
          ) : (
            <CalendarCheck className="mx-auto text-slate-300" size={30} />
          )}
          <p className="mt-3 font-medium text-slate-700">{loadStatus}</p>
          {loadError ? (
            <>
              <p className="mt-1 max-w-xl text-xs leading-5 text-red-600">
                {formatAccountError(loadError)}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw size={14} />
                重新加载
              </button>
            </>
          ) : null}
        </div>
      </section>
    );
  }

  const options = overview.options || {};
  const dailyRaces = options.daily_races || [];
  const legendRaces = options.daily_legend_races || [];
  const trainedCharas = options.trained_charas || [];
  const requestItems = options.request_items || [];
  const { availability } = options;
  const dailyRaceAvailability = availability?.daily_race;
  const legendRaceAvailability = availability?.daily_legend_race;
  const stadiumAvailability = availability?.team_stadium;
  const circleAvailability = availability?.circle;
  const disabled = locked || busy === 'daily-save' || busy === 'daily-run';
  const taskResults = overview.daily_tasks.task_results || {};
  const selectedDailyRace = dailyRaces.find(
    (race) => race.id === draft.daily_race.daily_race_id,
  );
  const selectedLegendRace = legendRaces.find(
    (race) => race.id === draft.daily_legend_race.daily_legend_race_id,
  );
  const selectedDailyHorse = trainedCharas.find(
    (horse) => horse.trained_chara_id === draft.daily_race.trained_chara_id,
  );
  const selectedLegendHorse = trainedCharas.find(
    (horse) =>
      horse.trained_chara_id === draft.daily_legend_race.trained_chara_id,
  );
  let pickerRace: DailyRace | undefined;
  if (horsePicker === 'daily_race') pickerRace = selectedDailyRace;
  if (horsePicker === 'daily_legend_race') pickerRace = selectedLegendRace;
  const pickerSelectedId =
    horsePicker === 'daily_race'
      ? draft.daily_race.trained_chara_id
      : draft.daily_legend_race.trained_chara_id;
  const pickerRunningStyle =
    horsePicker === 'daily_race'
      ? draft.daily_race.running_style
      : draft.daily_legend_race.running_style;

  const setRace = (
    key: 'daily_race' | 'daily_legend_race',
    patch: Partial<DailyTasksConfig[typeof key]>,
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  return (
    <div className="space-y-4">
      <section className={panelClass('p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="text-indigo-600" size={20} />
              <h2 className="font-bold text-slate-800">每日日常计划</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">
              {draft.enabled ? '计划运行中' : '计划已暂停'}
            </span>
            <Toggle
              checked={draft.enabled}
              label={draft.enabled ? '暂停每日日常计划' : '开启每日日常计划'}
              disabled={disabled}
              onChange={(enabled) => {
                const next = { ...draft, enabled };
                setDraft(next);
                onSave(next).catch(() => undefined);
              }}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
          <label className="block" htmlFor="daily-task-run-time">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              每日计划启动时间（北京时间）
            </span>
            <input
              id="daily-task-run-time"
              type="time"
              value={draft.run_time}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  run_time: event.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            每日赛事每天执行一次；竞技场按 RP
            恢复时间继续清空。养马占用账号时会等待，并在本局结束后优先处理到期日常。
          </div>
        </div>
      </section>

      <section className={panelClass('p-5')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Swords className="text-amber-500" size={19} />
            <div>
              <h3 className="font-semibold text-slate-800">每日竞赛</h3>
              <p className="text-xs text-slate-500">
                使用所选马娘，一次打完全部现有入场券。
              </p>
            </div>
          </div>
          <Toggle
            checked={draft.daily_race.enabled}
            label="启用每日竞赛"
            disabled={
              dailyRaceAvailability?.available === false &&
              !draft.daily_race.enabled
            }
            onChange={(enabled) => setRace('daily_race', { enabled })}
          />
        </div>
        <AvailabilityNotice
          available={dailyRaceAvailability?.available}
          canRunNow={dailyRaceAvailability?.can_run_now}
          reason={dailyRaceAvailability?.reason}
          readyDetail={`当前有 ${dailyRaceAvailability?.ticket_count || 0} 张每日竞赛入场券`}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <select
            className={fieldClass}
            value={draft.daily_race.daily_race_id}
            disabled={
              !draft.daily_race.enabled ||
              dailyRaceAvailability?.available === false
            }
            onChange={(event) =>
              setRace('daily_race', {
                daily_race_id: Number(event.target.value),
                trained_chara_id: 0,
              })
            }
          >
            <option value={0}>选择每日竞赛</option>
            {dailyRaces.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name} · 难度 {race.difficulty} · {race.ground_name}{' '}
                {race.distance}m
              </option>
            ))}
          </select>
          <HorseSelectButton
            horse={selectedDailyHorse}
            race={selectedDailyRace}
            disabled={
              !draft.daily_race.enabled ||
              !selectedDailyRace ||
              dailyRaceAvailability?.available === false
            }
            onClick={() => setHorsePicker('daily_race')}
          />
          <select
            className={fieldClass}
            value={draft.daily_race.running_style}
            disabled={
              !draft.daily_race.enabled ||
              dailyRaceAvailability?.available === false
            }
            onChange={(event) =>
              setRace('daily_race', {
                running_style: Number(event.target.value),
              })
            }
          >
            <option value={0}>使用马娘默认跑法</option>
            <option value={1}>逃</option>
            <option value={2}>先行</option>
            <option value={3}>差</option>
            <option value={4}>追</option>
          </select>
        </div>
      </section>

      <section className={panelClass('p-5')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={19} />
            <div>
              <h3 className="font-semibold text-slate-800">每日传奇赛事</h3>
              <p className="text-xs text-slate-500">
                选择赛事与马娘，每个游戏日参加一次。
              </p>
            </div>
          </div>
          <Toggle
            checked={draft.daily_legend_race.enabled}
            label="启用每日传奇赛事"
            disabled={
              legendRaceAvailability?.available === false &&
              !draft.daily_legend_race.enabled
            }
            onChange={(enabled) => setRace('daily_legend_race', { enabled })}
          />
        </div>
        <AvailabilityNotice
          available={legendRaceAvailability?.available}
          canRunNow={legendRaceAvailability?.can_run_now}
          reason={legendRaceAvailability?.reason}
          readyDetail={`当前有 ${legendRaceAvailability?.ticket_count || 0} 张传奇赛事入场券`}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <select
            className={fieldClass}
            value={draft.daily_legend_race.daily_legend_race_id}
            disabled={
              !draft.daily_legend_race.enabled ||
              legendRaceAvailability?.available === false
            }
            onChange={(event) =>
              setRace('daily_legend_race', {
                daily_legend_race_id: Number(event.target.value),
                trained_chara_id: 0,
              })
            }
          >
            <option value={0}>选择传奇赛事</option>
            {legendRaces.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name} · 碎片 {race.owned_piece_count} · 难度{' '}
                {race.difficulty} · {race.ground_name} {race.distance}m
              </option>
            ))}
          </select>
          <HorseSelectButton
            horse={selectedLegendHorse}
            race={selectedLegendRace}
            disabled={
              !draft.daily_legend_race.enabled ||
              !selectedLegendRace ||
              legendRaceAvailability?.available === false
            }
            onClick={() => setHorsePicker('daily_legend_race')}
          />
          <select
            className={fieldClass}
            value={draft.daily_legend_race.running_style}
            disabled={
              !draft.daily_legend_race.enabled ||
              legendRaceAvailability?.available === false
            }
            onChange={(event) =>
              setRace('daily_legend_race', {
                running_style: Number(event.target.value),
              })
            }
          >
            <option value={0}>使用马娘默认跑法</option>
            <option value={1}>逃</option>
            <option value={2}>先行</option>
            <option value={3}>差</option>
            <option value={4}>追</option>
          </select>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={panelClass('p-5')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Swords className="text-rose-500" size={19} />
              <div>
                <h3 className="font-semibold text-slate-800">竞技场</h3>
                <p className="text-xs text-slate-500">
                  清空已有 RP，之后按每 2 小时一次的恢复事件继续处理。
                </p>
              </div>
            </div>
            <Toggle
              checked={draft.team_stadium.enabled}
              label="启用竞技场"
              disabled={
                stadiumAvailability?.available === false &&
                !draft.team_stadium.enabled
              }
              onChange={(enabled) =>
                setDraft((current) => ({
                  ...current,
                  team_stadium: { ...current.team_stadium, enabled },
                }))
              }
            />
          </div>
          <AvailabilityNotice
            available={stadiumAvailability?.available}
            canRunNow={stadiumAvailability?.can_run_now}
            reason={stadiumAvailability?.reason}
            readyDetail={`当前竞技场 RP：${stadiumAvailability?.current_rp || 0}`}
          />
          <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
            对手强度固定为高。
          </div>
        </section>

        <section className={panelClass('p-5')}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-violet-500" size={19} />
              <div>
                <h3 className="font-semibold text-slate-800">限时商店</h3>
                <p className="text-xs text-slate-500">
                  每次赛事或竞技场结束后检查，达到该来源每日刷新上限后停止。
                </p>
              </div>
            </div>
            <Toggle
              checked={draft.limited_shop.enabled}
              label="启用限时商店"
              onChange={(enabled) =>
                setDraft((current) => ({
                  ...current,
                  limited_shop: {
                    ...current.limited_shop,
                    enabled,
                    buy_all: true,
                  },
                }))
              }
            />
          </div>
          <div className="mt-4 rounded-lg bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-800">
            服务端会先计算全部未购买商品的总价。任一种货币不足时，一件也不购买；全部足够时才一次性全买。
          </div>
        </section>
      </div>

      <section className={panelClass('p-5')}>
        <div className="flex items-center gap-2">
          <Users className="text-cyan-600" size={19} />
          <div>
            <h3 className="font-semibold text-slate-800">社团物品</h3>
            <p className="text-xs text-slate-500">
              请求按服务端冷却时间调度；捐赠达到每日上限后等待次日 05:00 重置。
            </p>
          </div>
        </div>
        <AvailabilityNotice
          available={circleAvailability?.available}
          canRunNow={circleAvailability?.can_run_now}
          reason={circleAvailability?.reason}
          readyDetail="当前账号已加入社团，可以配置捐赠和物品请求"
        />
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">
                自动捐赠
              </span>
              <Toggle
                checked={draft.circle.donate_enabled}
                label="启用社团捐赠"
                disabled={
                  circleAvailability?.available === false &&
                  !draft.circle.donate_enabled
                }
                onChange={(donate_enabled) =>
                  setDraft((current) => ({
                    ...current,
                    circle: { ...current.circle, donate_enabled },
                  }))
                }
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">允许捐赠的物品</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-400"
                  disabled={
                    !draft.circle.donate_enabled ||
                    circleAvailability?.available === false
                  }
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      circle: {
                        ...current.circle,
                        donate_item_ids: requestItems.map((item) => item.id),
                      },
                    }))
                  }
                >
                  全选
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-400"
                  disabled={
                    !draft.circle.donate_enabled ||
                    circleAvailability?.available === false
                  }
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      circle: { ...current.circle, donate_item_ids: [] },
                    }))
                  }
                >
                  清空
                </button>
              </div>
            </div>
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {requestItems.map((item) => {
                const checked = draft.circle.donate_item_ids.includes(item.id);
                return (
                  <label
                    key={item.id}
                    htmlFor={`daily-donate-item-${item.id}`}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span className="truncate text-slate-700">{item.name}</span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      持有 {item.owned}
                      <input
                        id={`daily-donate-item-${item.id}`}
                        type="checkbox"
                        checked={checked}
                        disabled={
                          !draft.circle.donate_enabled ||
                          circleAvailability?.available === false
                        }
                        onChange={() =>
                          setDraft((current) => ({
                            ...current,
                            circle: {
                              ...current.circle,
                              donate_item_ids: checked
                                ? current.circle.donate_item_ids.filter(
                                    (id) => id !== item.id,
                                  )
                                : [...current.circle.donate_item_ids, item.id],
                            },
                          }))
                        }
                      />
                    </span>
                  </label>
                );
              })}
              {!requestItems.length ? (
                <p className="p-2 text-xs text-slate-400">暂无可选物品</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">
                自动请求物品
              </span>
              <Toggle
                checked={draft.circle.request_enabled}
                label="启用社团物品请求"
                disabled={
                  circleAvailability?.available === false &&
                  !draft.circle.request_enabled
                }
                onChange={(request_enabled) =>
                  setDraft((current) => ({
                    ...current,
                    circle: { ...current.circle, request_enabled },
                  }))
                }
              />
            </div>
            <label className="mt-3 block" htmlFor="daily-circle-request-item">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                请求物品
              </span>
              <select
                id="daily-circle-request-item"
                className={fieldClass}
                value={draft.circle.request_item_id}
                disabled={
                  !draft.circle.request_enabled ||
                  circleAvailability?.available === false
                }
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    circle: {
                      ...current.circle,
                      request_item_id: Number(event.target.value),
                    },
                  }))
                }
              >
                <option value={0}>选择请求物品</option>
                {requestItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · 持有 {item.owned}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
              <Clock3 className="mt-0.5 shrink-0" size={16} />
              仍有自己的有效请求或请求冷却未结束时，服务端不会重复发送。
            </div>
          </div>
        </div>
      </section>

      <section className={panelClass('p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">日常计划状态</h3>
            <p className="mt-1 text-sm text-slate-500">
              {statusLabel[overview.daily_tasks.status || ''] ||
                overview.daily_tasks.status ||
                '尚未执行'}
              {overview.daily_tasks.last_finished_at
                ? ` · 上次完成 ${overview.daily_tasks.last_finished_at}`
                : ''}
              {overview.daily_tasks.next_wake_at
                ? ` · 下次${overview.daily_tasks.next_wake_reason || '计划事件'} ${formatScheduleTime(overview.daily_tasks.next_wake_at)}`
                : ''}
            </p>
            {overview.daily_tasks.last_error ? (
              <p className="mt-1 text-sm text-red-600">
                {formatAccountError(overview.daily_tasks.last_error)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSave(draft)}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              <Save size={16} />
              {busy === 'daily-save' ? '保存中…' : '保存配置'}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRun(draft)}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Play size={16} />
              {busy === 'daily-run' ? '执行中…' : '立即执行'}
            </button>
          </div>
        </div>
        {Object.keys(taskResults).length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(taskResults).map(([name, result]) => (
              <ResultCard key={name} name={name} result={result} />
            ))}
          </div>
        ) : null}
      </section>
      {horsePicker && pickerRace ? (
        <DailyHorsePicker
          title={
            horsePicker === 'daily_race'
              ? '选择每日竞赛马娘'
              : '选择每日传奇赛事马娘'
          }
          race={pickerRace}
          horses={trainedCharas}
          selectedId={pickerSelectedId}
          runningStyle={pickerRunningStyle}
          onClose={() => setHorsePicker(null)}
          onSelect={(horse) => {
            setRace(horsePicker, {
              trained_chara_id: horse.trained_chara_id,
            });
            setHorsePicker(null);
          }}
        />
      ) : null}
    </div>
  );
}
