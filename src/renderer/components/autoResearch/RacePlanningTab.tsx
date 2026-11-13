/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useMemo, useState } from 'react';
import { Download, RotateCcw, Copy, CalendarDays } from 'lucide-react';
import { copyText } from 'autouma/clipboard';
import {
  InheritanceAptitudes,
  inheritanceAllocation,
  FactorKey,
  InheritanceTargets,
} from 'renderer/ui/SuccessionPlanner';
import { PlannerButton } from 'renderer/components/succession/PlannerComponents';
import {
  optimizeRaceSchedule,
  rateKey,
  ScheduleInput,
  WinRates,
} from 'renderer/utils/raceScheduleOptimizer';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
  PLANNING_SCENARIOS,
  planningDate,
} from 'renderer/utils/racePlannerCatalog';
import {
  DEFAULT_WIN_RATES,
  REFERENCE_WIN_RATES,
  WIN_RATE_SAMPLES,
} from 'renderer/utils/raceWinRateModel';
import RaceSchedulePicker from './RaceSchedulePicker';
import { RaceOption } from './types';
import {
  getSharedStorageItem,
  panelClass,
  setSharedStorageItem,
} from './shared';

const STORAGE_KEY = 'uma-race-planner-v1';
const RANKS = ['—', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
const GRADE_LABELS: Record<number, string> = {
  100: 'GI',
  200: 'GII',
  300: 'GIII',
  400: 'OP',
  700: 'PRE-OP',
  800: '未胜利',
  900: '出道',
  1000: 'EX',
};
const DISTANCE_LABELS = {
  short: '短距离',
  mile: '英里',
  middle: '中距离',
  long: '长距离',
};
const APTITUDES = ['turf', 'dirt', 'short', 'mile', 'middle', 'long'] as const;
const BUCKETS = ['1–2 连战', '3 连战', '4 连战', '5 连战', '6+ 连战'];
type Settings = {
  charaId: number;
  scenarioId: number;
  routeId: number;
  objective: 'fans' | 'wins' | 'jewels';
  gradeThreshold: 100 | 200 | 300;
  fanBonus: number;
  inheritance: FactorKey[];
  targets: InheritanceTargets;
  manualIds: number[];
  restTurns: number[];
  rateOverrides: Record<string, string>;
  rateModel: 'reference' | 'samples';
};
const DEFAULT_SETTINGS: Settings = {
  charaId: 1001,
  scenarioId: 1,
  routeId: 0,
  objective: 'fans',
  gradeThreshold: 300,
  fanBonus: 0,
  inheritance: [],
  targets: {},
  manualIds: [],
  restTurns: [],
  rateOverrides: {},
  rateModel: 'reference',
};

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(getSharedStorageItem(STORAGE_KEY) || 'null');
    if (
      !saved ||
      !PLANNER_CATALOG.characters.some((chara) => chara.id === saved.charaId)
    )
      return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      charaId: saved.charaId,
      scenarioId: PLANNING_SCENARIOS.some(
        (scenario) => scenario.id === saved.scenarioId,
      )
        ? saved.scenarioId
        : 1,
      routeId: Number(saved.routeId) || 0,
      objective:
        saved.objective === 'wins' || saved.objective === 'jewels'
          ? saved.objective
          : 'fans',
      gradeThreshold: [100, 200, 300].includes(saved.gradeThreshold)
        ? saved.gradeThreshold
        : 300,
      fanBonus:
        Number.isFinite(saved.fanBonus) && saved.fanBonus >= 0
          ? saved.fanBonus
          : 0,
      inheritance: Array.isArray(saved.inheritance)
        ? saved.inheritance.filter((key: FactorKey) =>
            [...APTITUDES, 'nige', 'senko', 'sashi', 'oikomi'].includes(key),
          )
        : [],
      targets:
        saved.targets && typeof saved.targets === 'object' ? saved.targets : {},
      manualIds: Array.isArray(saved.manualIds)
        ? saved.manualIds.filter(Number.isInteger)
        : [],
      restTurns: Array.isArray(saved.restTurns)
        ? saved.restTurns.filter(Number.isInteger)
        : [],
      rateOverrides:
        saved.rateOverrides && typeof saved.rateOverrides === 'object'
          ? saved.rateOverrides
          : {},
      rateModel: saved.rateModel === 'samples' ? 'samples' : 'reference',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function pairLabel(key: string) {
  const [ground, distance] = key.split(':').map(Number);
  return `场地 ${RANKS[ground]} / 距离 ${RANKS[distance]}`;
}

function saveCsv(rows: Array<Array<string | number>>, name: string) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function RacePlanningTab() {
  const [settings, setSettings] = useState(loadSettings);
  const [search, setSearch] = useState('');
  const [restTurn, setRestTurn] = useState(13);
  const [showRest, setShowRest] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    try {
      setSharedStorageItem(STORAGE_KEY, JSON.stringify(settings));
      setStorageError('');
    } catch {
      setStorageError('当前浏览器无法保存规划设置，关闭页面后设置会丢失。');
    }
    setCopyStatus('');
  }, [settings]);

  const patch = (value: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...value }));
  const character =
    PLANNER_CATALOG.characters.find((item) => item.id === settings.charaId) ||
    PLANNER_CATALOG.characters[0];
  const target = useMemo(
    () => ({ ...character, relationTypes: [] }),
    [character],
  );
  const calendar = useMemo(
    () =>
      buildPlanningCalendar(
        character.id,
        settings.scenarioId,
        settings.routeId,
      ),
    [character.id, settings.scenarioId, settings.routeId],
  );
  const aptitudes = useMemo(() => {
    const result = { ...target.aptitudes };
    inheritanceAllocation(
      target,
      settings.inheritance,
      settings.targets,
    ).forEach((item) => {
      result[item.type] = item.target;
    });
    return result;
  }, [target, settings.inheritance, settings.targets]);
  const pairKeys = useMemo(
    () =>
      [
        ...new Set(
          calendar.races.map((race) =>
            rateKey(aptitudes[race.ground], aptitudes[race.distanceType]),
          ),
        ),
      ]
        .sort()
        .reverse(),
    [calendar.races, aptitudes],
  );
  const baseRates =
    settings.rateModel === 'samples' ? DEFAULT_WIN_RATES : REFERENCE_WIN_RATES;
  const rates = useMemo<WinRates>(() => {
    const values: Record<string, Array<number | null>> = Object.fromEntries(
      pairKeys.map((key) => [
        key,
        [...(baseRates[key] || [null, null, null, null, null])],
      ]),
    );
    Object.entries(settings.rateOverrides).forEach(([key, value]) => {
      const index = key.lastIndexOf(':');
      const pair = key.slice(0, index);
      const bucket = Number(key.slice(index + 1));
      if (
        !values[pair] ||
        !Number.isInteger(bucket) ||
        bucket < 0 ||
        bucket > 4
      )
        return;
      const number = Number(value);
      values[pair][bucket] =
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(number) &&
        number >= 0 &&
        number <= 100
          ? number / 100
          : null;
    });
    return values;
  }, [pairKeys, settings.rateOverrides, baseRates]);
  const selection = useMemo(() => {
    const fixed = { ...calendar.fixedRaces };
    const errors = [...calendar.errors];
    settings.manualIds.forEach((id) => {
      const race = calendar.races.find((item) => item.id === id);
      if (!race) {
        errors.push(`固定比赛 ${id} 不在当前剧本赛历内，请清除或重新选择。`);
        return;
      }
      if (fixed[race.turn] && !fixed[race.turn].includes(id))
        errors.push(`${planningDate(race.turn)}的手动比赛与生涯目标冲突。`);
      else fixed[race.turn] = [id];
    });
    return { fixed, errors };
  }, [calendar, settings.manualIds]);
  const restOptions = useMemo(
    () =>
      Array.from(
        { length: calendar.scenario.endTurn - calendar.startTurn + 1 },
        (_, index) => calendar.startTurn + index,
      ).filter((turn) => !selection.fixed[turn]),
    [calendar, selection.fixed],
  );
  const selectedRestTurn = restOptions.includes(restTurn)
    ? restTurn
    : restOptions[0];
  const input = useMemo<ScheduleInput>(
    () => ({
      races: calendar.races,
      startTurn: calendar.startTurn,
      endTurn: calendar.scenario.endTurn,
      aptitudes,
      winRates: rates,
      objective: settings.objective,
      gradeThreshold: settings.gradeThreshold,
      fanBonusPercent: settings.fanBonus,
      fixedRaces: selection.fixed,
      blockedTurns: calendar.blockedTurns,
      restTurns: settings.restTurns,
    }),
    [
      calendar,
      aptitudes,
      rates,
      settings.objective,
      settings.gradeThreshold,
      settings.fanBonus,
      selection.fixed,
      settings.restTurns,
    ],
  );
  const result = useMemo(() => optimizeRaceSchedule(input), [input]);
  const error = selection.errors[0] || result.error;
  const electiveOptions = useMemo<RaceOption[]>(
    () =>
      calendar.races
        .filter(
          (race) =>
            !calendar.fixedRaces[race.turn] &&
            !calendar.blockedTurns.includes(race.turn),
        )
        .map((race) => ({
          id: race.id,
          program_id: race.programId,
          turn: race.turn,
          name: race.name,
          date: planningDate(race.turn),
          type: GRADE_LABELS[race.grade] || '其他',
          terrain: race.ground === 'turf' ? '草地' : '泥地',
          distance: DISTANCE_LABELS[race.distanceType],
          venue: '',
          thumbnail_id:
            PLANNER_CATALOG.programs[String(race.programId)]?.thumbnailId || 0,
        })),
    [calendar],
  );
  const matchedCharacters = PLANNER_CATALOG.characters.filter(
    (item) =>
      !search ||
      item.name.includes(search) ||
      String(item.id).includes(search) ||
      item.id === character.id,
  );
  const fixedTurns = Object.keys(calendar.fixedRaces)
    .map(Number)
    .sort((a, b) => a - b);
  const unknownPairs = pairKeys.filter((key) =>
    rates[key].some((value) => value === null),
  );
  const rows = result.steps.filter((step) => step.race || showRest);
  const entryWarnings = result.steps.filter(
    (step) =>
      step.race &&
      step.race.requiredFans > step.totalExpectedFans - step.expectedFans,
  );
  const resetCalendar = (value: Partial<Settings>) =>
    patch({ ...value, manualIds: [], restTurns: [], routeId: 0 });
  const hasResult = !error && result.steps.length > 0;

  return (
    <div className="racePlanningTab successionPickerTheme space-y-4">
      <section className={panelClass('p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-section font-bold text-slate-900">赛程规划</h2>
            <p className="mt-1 text-caption text-slate-500">
              选择马娘与适应性改造，规划整个剧本内的参赛和休息安排。修改设置后自动重新计算。
            </p>
          </div>
          <PlannerButton
            variant="secondary"
            size="small"
            onClick={() => setSettings(DEFAULT_SETTINGS)}
          >
            <RotateCcw size={14} />
            重置规划
          </PlannerButton>
        </div>
        {storageError ? (
          <p role="status" className="mt-2 text-amber-700">
            {storageError}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-label text-slate-700">
            育成马娘
            <input
              aria-label="搜索规划马娘"
              placeholder="搜索名称或编号"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-data"
            />
            <select
              aria-label="规划马娘"
              value={character.id}
              onChange={(event) => {
                resetCalendar({
                  charaId: Number(event.target.value),
                  inheritance: [],
                  targets: {},
                });
                setSearch('');
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 p-2"
            >
              {matchedCharacters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-label text-slate-700">
            剧本
            <select
              aria-label="规划剧本"
              value={settings.scenarioId}
              onChange={(event) =>
                resetCalendar({ scenarioId: Number(event.target.value) })
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2"
            >
              {PLANNING_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-caption text-slate-500">
              截至{planningDate(calendar.scenario.endTurn)}
              {settings.scenarioId === 6
                ? '；海外期间只安排固定目标赛。'
                : '；不含之后的决赛。'}
            </span>
          </label>
          <label className="text-label text-slate-700">
            优化目标
            <select
              aria-label="优化目标"
              value={settings.objective}
              onChange={(event) =>
                patch({
                  objective: event.target.value as Settings['objective'],
                })
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2"
            >
              <option value="fans">期望粉丝数最多</option>
              <option value="wins">期望重赏胜场最多</option>
              <option value="jewels">期望掉钻次数最多</option>
            </select>
            <select
              aria-label="胜场统计级别"
              value={settings.gradeThreshold}
              onChange={(event) =>
                patch({
                  gradeThreshold: Number(
                    event.target.value,
                  ) as Settings['gradeThreshold'],
                })
              }
              className="mt-2 block w-full rounded-lg border border-slate-200 p-2"
            >
              <option value={300}>GIII 及以上</option>
              <option value={200}>GII 及以上</option>
              <option value={100}>仅 GI</option>
            </select>
          </label>
          <label className="text-label text-slate-700">
            粉丝加成（%）
            <input
              type="number"
              min={0}
              max={1000}
              aria-label="粉丝加成百分比"
              value={settings.fanBonus}
              onChange={(event) =>
                patch({
                  fanBonus: Math.max(
                    0,
                    Math.min(1000, Number(event.target.value) || 0),
                  ),
                })
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2"
            />
            <span className="mt-2 block text-caption text-slate-500">
              按输入的加成统一计算冠军粉丝奖励。
            </span>
          </label>
        </div>
      </section>

      <section className={panelClass('p-4 sm:p-5')}>
        <InheritanceAptitudes
          target={target}
          selected={settings.inheritance}
          targets={settings.targets}
          onToggle={(type) =>
            patch({
              inheritance: settings.inheritance.includes(type)
                ? settings.inheritance.filter((key) => key !== type)
                : [...settings.inheritance, type],
            })
          }
          onConfigure={(type, rank) =>
            patch({
              inheritance: [...new Set([...settings.inheritance, type])],
              targets: { ...settings.targets, [type]: rank },
            })
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {APTITUDES.map((key) => (
            <span
              key={key}
              className="rounded-lg bg-slate-50 px-3 py-2 text-data"
            >
              {key === 'turf'
                ? '草地'
                : key === 'dirt'
                  ? '泥地'
                  : DISTANCE_LABELS[key]}{' '}
              <strong>
                {RANKS[target.aptitudes[key]]}
                {target.aptitudes[key] !== aptitudes[key]
                  ? ` → ${RANKS[aptitudes[key]]}`
                  : ''}
              </strong>
            </span>
          ))}
        </div>
        <p className="mt-2 text-caption text-slate-500">
          沿用继承规划的红因子槽位限制。胜率模型使用场地和距离适应性，S 暂按 A
          计算；跑法不影响本模型。
        </p>
      </section>

      <section className={panelClass('p-4 sm:p-5')}>
        <h3 className="text-section font-semibold">固定赛程</h3>
        {calendar.routes.length > 1 ? (
          <label className="mt-2 block text-label">
            生涯目标路线
            <select
              value={settings.routeId || calendar.routes[0].id}
              onChange={(event) =>
                patch({
                  routeId: Number(event.target.value),
                  manualIds: [],
                  restTurns: [],
                })
              }
              className="ml-2 rounded border p-2"
            >
              {calendar.routes.map((route) => (
                <option key={route.id} value={route.id}>
                  路线 {route.id}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fixedTurns.map((turn) => (
            <div key={turn} className="rounded-lg border border-slate-200 p-3">
              <span className="block text-caption text-slate-500">
                {planningDate(turn)} · {calendar.fixedLabels[turn]}
              </span>
              <strong className="text-data">
                {calendar.fixedRaces[turn]
                  .map(
                    (id) =>
                      calendar.races.find((race) => race.id === id)?.name || id,
                  )
                  .join(' / ')}
              </strong>
            </div>
          ))}
        </div>
        {calendar.notes.length ? (
          <details className="mt-3 text-caption text-slate-600">
            <summary className="cursor-pointer">
              其他生涯目标（{calendar.notes.length} 项，不作为固定比赛）
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {calendar.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        ) : null}
        <details className="mt-4 rounded-lg border border-slate-200 p-3">
          <summary className="cursor-pointer text-label font-semibold">
            手动固定比赛（{settings.manualIds.length} 场）
          </summary>
          <div className="mt-3">
            <RaceSchedulePicker
              id="optimal-race-fixed"
              title="选择必须参加的比赛"
              description="生涯目标所在日期和剧本禁赛日期不可另外安排比赛。"
              races={electiveOptions}
              selectedRaceIds={settings.manualIds}
              setSelectedRaceIds={(value) =>
                setSettings((current) => ({
                  ...current,
                  manualIds:
                    typeof value === 'function'
                      ? value(current.manualIds)
                      : value,
                }))
              }
            />
          </div>
          {settings.manualIds.length ? (
            <button
              type="button"
              onClick={() => patch({ manualIds: [] })}
              className="mt-3 text-caption text-slate-500 underline"
            >
              清除手动固定比赛
            </button>
          ) : null}
        </details>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="text-label">
            固定休息
            <select
              aria-label="固定休息日期"
              value={selectedRestTurn ?? ''}
              onChange={(event) => setRestTurn(Number(event.target.value))}
              className="ml-2 rounded-lg border border-slate-200 p-2"
            >
              {restOptions.map((turn) => (
                <option key={turn} value={turn}>
                  {planningDate(turn)}
                </option>
              ))}
            </select>
          </label>
          <PlannerButton
            size="small"
            variant="secondary"
            disabled={selectedRestTurn === undefined}
            onClick={() => {
              if (selectedRestTurn !== undefined)
                patch({
                  restTurns: [
                    ...new Set([...settings.restTurns, selectedRestTurn]),
                  ],
                });
            }}
          >
            固定休息
          </PlannerButton>
          {settings.restTurns.map((turn) => (
            <button
              type="button"
              key={turn}
              onClick={() =>
                patch({
                  restTurns: settings.restTurns.filter(
                    (value) => value !== turn,
                  ),
                })
              }
              className="rounded-lg bg-sky-50 px-2 py-1 text-caption text-sky-800"
              aria-label={`取消${planningDate(turn)}固定休息`}
            >
              {planningDate(turn)} ×
            </button>
          ))}
        </div>
      </section>

      <section className={panelClass('p-4 sm:p-5')}>
        <label className="mb-3 block text-label font-semibold">
          胜率数据来源
          <select
            aria-label="胜率数据来源"
            value={settings.rateModel}
            onChange={(event) =>
              patch({
                rateModel: event.target.value as Settings['rateModel'],
                rateOverrides: {},
              })
            }
            className="ml-2 rounded-lg border border-slate-200 p-2"
          >
            <option value="reference">参考站点完整表（2026-07-26）</option>
            <option value="samples">截图实测样本表</option>
          </select>
        </label>
        <details open={!!error && unknownPairs.length > 0}>
          <summary className="cursor-pointer text-label font-semibold">
            胜率模型 · 可编辑
            {unknownPairs.length
              ? `（${unknownPairs.length} 种组合存在缺失数据）`
              : ''}
          </summary>
          <p className="mt-2 text-caption text-slate-500">
            {settings.rateModel === 'samples'
              ? '采用截图中的实测胜场／出赛数，未测组合保留空白。'
              : '采用参考站点的完整估计表，覆盖所有场地与距离适应性组合。'}
            输入 0–100
            的百分比，空白表示未知；未知的组合与连战次数不会被自动选用。悬停输入框可查看样本量。
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-caption">
              <thead>
                <tr>
                  <th className="min-w-36 p-2">适应性组合</th>
                  {BUCKETS.map((label) => (
                    <th key={label} className="min-w-24 p-2">
                      {label}（%）
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pairKeys.map((key) => (
                  <tr key={key} className="border-t border-slate-100">
                    <th className="p-2 font-medium">{pairLabel(key)}</th>
                    {BUCKETS.map((label, index) => {
                      const field = `${key}:${index}`;
                      const sample =
                        settings.rateModel === 'samples'
                          ? WIN_RATE_SAMPLES[key]?.[index]
                          : null;
                      const defaultRate = baseRates[key]?.[index];
                      return (
                        <td key={label} className="p-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            aria-label={`${pairLabel(key)} ${label}胜率`}
                            title={
                              sample
                                ? `实测 ${sample[0]} 胜 / ${sample[1]} 场`
                                : settings.rateModel === 'reference'
                                  ? '参考站点完整估计表'
                                  : '暂无实测样本'
                            }
                            value={
                              settings.rateOverrides[field] ??
                              (defaultRate == null
                                ? ''
                                : (defaultRate * 100).toFixed(2))
                            }
                            placeholder="未知"
                            onChange={(event) =>
                              patch({
                                rateOverrides: {
                                  ...settings.rateOverrides,
                                  [field]: event.target.value,
                                },
                              })
                            }
                            className="w-24 rounded border border-slate-200 p-2"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => patch({ rateOverrides: {} })}
            className="mt-2 text-caption text-slate-500 underline"
          >
            恢复所选来源的胜率
          </button>
        </details>
      </section>

      <section className={panelClass('p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-section font-semibold">
            {settings.objective === 'jewels'
              ? '期望掉钻最优赛程'
              : settings.objective === 'fans'
                ? '期望粉丝最优赛程'
                : '期望重赏胜场最优赛程'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <PlannerButton
              variant="secondary"
              size="small"
              disabled={!hasResult}
              onClick={() => {
                const schedule = result.steps.filter(
                  (step) => step.race && !calendar.fixedRaces[step.turn],
                );
                copyText(
                  JSON.stringify(
                    {
                      extra_race_list: schedule.map((step) => step.race!.id),
                      offline_race_array: schedule.map((step) => ({
                        year: Math.floor((step.turn - 1) / 24) + 1,
                        program_id: step.race!.programId,
                      })),
                    },
                    null,
                    2,
                  ),
                )
                  .then(() =>
                    setCopyStatus('已复制参赛计划，含在线比赛 ID 和离线赛程。'),
                  )
                  .catch((caught) => setCopyStatus(String(caught)));
              }}
            >
              <Copy size={14} />
              复制参赛计划
            </PlannerButton>
            <PlannerButton
              variant="secondary"
              size="small"
              disabled={!hasResult}
              onClick={() =>
                saveCsv(
                  [
                    [
                      '马娘',
                      '剧本',
                      '日期',
                      '回合',
                      '比赛',
                      '比赛ID',
                      '级别',
                      '固定',
                      '连续出赛',
                      '胜率',
                      '期望粉丝',
                      '累计期望粉丝',
                      '累计期望重赏胜场',
                    ],
                    ...result.steps.map((step) => [
                      character.name,
                      calendar.scenario.name,
                      planningDate(step.turn),
                      step.turn,
                      step.race?.name || '休息／训练',
                      step.race?.programId || '',
                      GRADE_LABELS[step.race?.grade || 0] || '',
                      step.fixed ? '是' : '',
                      step.streak,
                      step.race ? step.winProbability : '',
                      step.expectedFans,
                      step.totalExpectedFans,
                      step.totalExpectedWins,
                    ]),
                  ],
                  `${character.name}-${calendar.scenario.name}-最优赛程.csv`,
                )
              }
            >
              <Download size={14} />
              导出 CSV
            </PlannerButton>
          </div>
        </div>
        {copyStatus ? (
          <p role="status" className="mt-2 text-caption text-sky-700">
            {copyStatus}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-red-700"
          >
            {error}
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['期望粉丝', Math.round(result.expectedFans).toLocaleString()],
                [
                  `${GRADE_LABELS[settings.gradeThreshold]}及以上期望胜场`,
                  result.expectedWins.toFixed(2),
                ],
                ['参赛次数', String(result.raceCount)],
                ['期望掉落次数', result.expectedDrops.toFixed(2)],
                [
                  '休息／训练回合',
                  String(result.steps.length - result.raceCount),
                ],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <span className="block text-caption text-slate-500">
                    {label}
                  </span>
                  <strong className="mt-1 block text-section text-indigo-700">
                    {value}
                  </strong>
                </div>
              ))}
            </div>
            {result.missingRatePairs.length ? (
              <p className="mt-3 text-caption text-amber-700">
                部分候选比赛缺少胜率，已排除未知的出赛选项。结果是在当前已知胜率范围内的最优解；可展开胜率模型补充。
              </p>
            ) : null}
            {entryWarnings.length ? (
              <p className="mt-3 text-caption text-amber-700">
                {entryWarnings.length}{' '}
                场比赛的报名粉丝门槛高于此前的期望粉丝数；实际报名条件需在游戏中确认。
              </p>
            ) : null}
            <label className="mt-4 flex items-center gap-2 text-caption">
              <input
                type="checkbox"
                checked={showRest}
                onChange={(event) => setShowRest(event.target.checked)}
              />
              显示休息／训练回合
            </label>
            <div className="mt-2 overflow-x-auto">
              <table
                className="w-full text-left text-data"
                aria-label="最优赛程"
              >
                <thead className="border-b border-slate-200 text-caption text-slate-500">
                  <tr>
                    {[
                      '日期',
                      '比赛',
                      '连续出赛',
                      '胜率',
                      '期望粉丝',
                      '累计期望胜场',
                    ].map((label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap p-3 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((step) => (
                    <tr key={step.turn}>
                      <td className="whitespace-nowrap p-3 text-caption">
                        {planningDate(step.turn)}
                      </td>
                      <td className="min-w-40 p-3">
                        <strong className="font-medium">
                          {step.race?.name || '休息／训练'}
                        </strong>
                        {step.race ? (
                          <span className="block text-caption text-slate-500">
                            {GRADE_LABELS[step.race.grade] || '其他'} ·{' '}
                            {step.race.ground === 'turf' ? '草地' : '泥地'} ·{' '}
                            {step.race.distance}m
                            {step.fixed
                              ? ` · ${calendar.fixedLabels[step.turn] || '手动固定'}`
                              : ''}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 tabular-nums">{step.streak || '—'}</td>
                      <td className="p-3 tabular-nums">
                        {step.race
                          ? `${(step.winProbability * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="p-3 tabular-nums">
                        {Math.round(step.expectedFans).toLocaleString()}
                      </td>
                      <td className="p-3 tabular-nums">
                        {step.totalExpectedWins.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <section className={panelClass('p-4 text-caption text-slate-500')}>
        <p className="flex items-center gap-2 font-semibold text-slate-700">
          <CalendarDays size={15} />
          规划口径
        </p>
        <p className="mt-2">
          以回合和连续出赛次数做动态规划；休息会重置连战，固定目标赛必须参加。期望粉丝采用胜率
          × 冠军粉丝奖励，非冠军粉丝近似为 0。胜场仅计所选重赏级别，EX 不算 GIII
          以上。
        </p>
        <p className="mt-2">
          这是离线育成的期望收益模型，不模拟属性成长、训练效果、目标通关概率或报名门槛；常规剧本的赛后决赛、自动事件赛不计入。资料未覆盖的胜率保留为未知，不作保证。
        </p>
        <p className="mt-2">
          方法参考：
          <a
            className="underline"
            href="https://tma.main.jp/uma/maximize_fan_independent_training.php"
            target="_blank"
            rel="noreferrer"
          >
            自主训练最优粉丝赛程
          </a>{' '}
          ·{' '}
          <a
            className="underline"
            href="https://tma.main.jp/uma/maximize_win_independent_training.php"
            target="_blank"
            rel="noreferrer"
          >
            胜场优化与完整胜率表
          </a>{' '}
          ·{' '}
          <a
            className="underline"
            href="https://ja.wikipedia.org/wiki/%E5%8B%95%E7%9A%84%E8%A8%88%E7%94%BB%E6%B3%95"
            target="_blank"
            rel="noreferrer"
          >
            动态规划
          </a>
          。赛历、冠军粉丝数和生涯目标来自本地国服主数据库。
        </p>
      </section>
    </div>
  );
}
