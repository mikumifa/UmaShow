/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  RotateCcw,
  Copy,
  CalendarDays,
  List,
  Trophy,
} from 'lucide-react';
import { copyText } from 'autouma/clipboard';
import {
  PlannerButton,
  PlannerPortrait,
  PlannerSelectionCard,
  PlannerFactorList,
} from 'renderer/components/succession/PlannerComponents';
import {
  SuccessionPickerDialog,
  SuccessionPickerTrigger,
} from 'renderer/components/succession/SuccessionPicker';
import { ScheduleInput } from 'renderer/utils/raceScheduleOptimizer';
import { recommendRaceInheritance } from 'renderer/utils/raceInheritanceRecommendation';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
  planningDate,
} from 'renderer/utils/racePlannerCatalog';
import { REFERENCE_WIN_RATES } from 'renderer/utils/raceWinRateModel';
import { expectedJewelDrops } from 'renderer/utils/raceJewelModel';
import {
  RACE_PLANNER_STORAGE_KEY as STORAGE_KEY,
  RACE_PLANNER_SETTINGS_VERSION as SETTINGS_VERSION,
  DEFAULT_PLANNER_FAN_BONUS,
  plannerFanBonus,
} from 'renderer/utils/racePlannerPreferences';
import RaceSchedulePicker from './RaceSchedulePicker';
import RacePlannerLeaderboard from './RacePlannerLeaderboard';
import { RaceOption } from './types';
import {
  getSharedStorageItem,
  panelClass,
  setSharedStorageItem,
  normalizeRaceSelection,
} from './shared';

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
const APTITUDE_LABELS = { turf: '草地', dirt: '泥地', ...DISTANCE_LABELS };
type Settings = {
  charaId: number;
  routeId: number;
  objective: 'fans' | 'wins' | 'jewels';
  gradeThreshold: 100 | 200 | 300;
  fanBonus: number;
  manualIds: number[];
  restTurns: number[];
};
const DEFAULT_SETTINGS: Settings = {
  charaId: 1001,
  routeId: 0,
  objective: 'fans',
  gradeThreshold: 100,
  fanBonus: DEFAULT_PLANNER_FAN_BONUS,
  manualIds: [],
  restTurns: [],
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
      routeId: Number(saved.routeId) || 0,
      objective:
        saved.objective === 'wins' || saved.objective === 'jewels'
          ? saved.objective
          : 'fans',
      gradeThreshold: [100, 200, 300].includes(saved.gradeThreshold)
        ? saved.gradeThreshold
        : 100,
      fanBonus: plannerFanBonus(saved),
      manualIds: Array.isArray(saved.manualIds)
        ? saved.manualIds.filter(Number.isInteger)
        : [],
      restTurns: Array.isArray(saved.restTurns)
        ? saved.restTurns.filter(Number.isInteger)
        : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
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
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [resultView, setResultView] = useState<'list' | 'calendar'>('list');
  const [copyStatus, setCopyStatus] = useState('');
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    try {
      setSharedStorageItem(
        STORAGE_KEY,
        JSON.stringify({ ...settings, version: SETTINGS_VERSION }),
      );
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
  const calendar = useMemo(
    () => buildPlanningCalendar(character.id, 5, settings.routeId),
    [character.id, settings.routeId],
  );
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
  const input = useMemo<ScheduleInput>(
    () => ({
      races: calendar.races,
      automaticRaces: calendar.automaticRaces,
      startTurn: calendar.startTurn,
      endTurn: calendar.scenario.endTurn,
      aptitudes: character.aptitudes,
      winRates: REFERENCE_WIN_RATES,
      objective: settings.objective,
      gradeThreshold:
        settings.objective === 'wins' ? settings.gradeThreshold : 100,
      fanBonusPercent: settings.fanBonus,
      fixedRaces: selection.fixed,
      blockedTurns: calendar.blockedTurns,
      restTurns: settings.restTurns,
    }),
    [
      calendar,
      character,
      settings.objective,
      settings.gradeThreshold,
      settings.fanBonus,
      selection.fixed,
      settings.restTurns,
    ],
  );
  const recommendation = useMemo(
    () => recommendRaceInheritance(input),
    [input],
  );
  const { aptitudes, schedule: result } = recommendation;
  const error = selection.errors[0] || result.error;
  const calendarOptions = useMemo<RaceOption[]>(
    () =>
      calendar.races
        .filter((race) =>
          calendar.fixedRaces[race.turn]
            ? calendar.fixedRaces[race.turn].includes(race.id)
            : !calendar.blockedTurns.includes(race.turn),
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
  const normalizedSearch = search.trim().toLowerCase();
  const matchedCharacters = PLANNER_CATALOG.characters.filter(
    (item) =>
      !normalizedSearch ||
      item.name.toLowerCase().includes(normalizedSearch) ||
      String(item.id).includes(normalizedSearch),
  );
  const planRows = result.steps.flatMap((step) => [
    {
      ...step,
      name: step.race?.name || '休息／训练',
      programId: step.race?.programId || '',
      gradeLabel: GRADE_LABELS[step.race?.grade || 0] || '',
      automatic: false,
      isRace: !!step.race,
      expectedDrops: step.race
        ? expectedJewelDrops(step.winProbability, step.streak)
        : 0,
      baseFans: step.race?.fans || 0,
    },
    ...result.automaticRaces
      .filter((race) => race.turn === step.turn)
      .map((race) => ({
        ...race,
        race: null,
        name: race.name,
        programId: '',
        gradeLabel: '剧本重赏',
        automatic: true,
        isRace: true,
        fixed: true,
        streak: 0,
        winProbability: 1,
        baseFans: race.fans,
      })),
  ]);
  const rows = planRows.filter((step) => step.isRace);
  const resultRaces = calendarOptions.filter((race) =>
    result.steps.some((step) => step.race?.id === race.id),
  );
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
            <h2 className="text-section font-bold text-slate-900">
              赛程规划{' '}
              <span className="ml-2 text-label font-medium text-slate-500">
                荣耀女神杯
              </span>
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <PlannerButton
              variant="secondary"
              size="small"
              onClick={() => setSettings(DEFAULT_SETTINGS)}
            >
              <RotateCcw size={14} />
              重置规划
            </PlannerButton>
            <PlannerButton
              variant="secondary"
              size="small"
              onClick={() => setLeaderboardOpen(true)}
            >
              <Trophy size={14} />
              排行榜
            </PlannerButton>
          </div>
        </div>
        {storageError ? (
          <p role="status" className="mt-2 text-amber-700">
            {storageError}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SuccessionPickerTrigger
            label="育成马娘"
            selected
            required
            portrait={
              <PlannerPortrait
                path={`chr_icon/${character.id}.png`}
                alt={character.name}
              />
            }
            onOpen={() => {
              setSearch('');
              setCharacterPickerOpen(true);
            }}
          >
            <strong>{character.name}</strong>
            <small>点击切换</small>
          </SuccessionPickerTrigger>
          <label className="text-label text-slate-700">
            优化目标
            <select
              aria-label="优化目标"
              value={settings.objective}
              onChange={(event) =>
                patch({
                  objective: event.target.value as Settings['objective'],
                  gradeThreshold: 100,
                })
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 p-2"
            >
              <option value="fans">期望粉丝数最多</option>
              <option value="wins">期望重赏胜场最多</option>
              <option value="jewels">期望掉钻次数最多</option>
            </select>
            {settings.objective === 'wins' ? (
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
                <option value={100}>仅 GI</option>
                <option value={200}>GII 及以上</option>
                <option value={300}>GIII 及以上</option>
              </select>
            ) : null}
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

      {leaderboardOpen ? (
        <RacePlannerLeaderboard
          objective={settings.objective}
          fanBonus={settings.fanBonus}
          onObjectiveChange={(objective) => patch({ objective })}
          onClose={() => setLeaderboardOpen(false)}
          onSelect={(entry) => {
            patch({
              charaId: entry.charaId,
              routeId: entry.routeId,
              manualIds: [],
              restTurns: [],
              gradeThreshold: 100,
            });
            setLeaderboardOpen(false);
          }}
        />
      ) : null}

      {characterPickerOpen ? (
        <SuccessionPickerDialog
          ariaLabel="选择规划马娘"
          title="选择育成马娘"
          description="选择角色后自动计算继承需求与赛程。切换角色会清空手动比赛和休息安排。"
          onClose={() => setCharacterPickerOpen(false)}
          searchValue={search}
          searchPlaceholder="搜索马娘名称"
          searchAriaLabel="搜索规划马娘"
          onSearchChange={setSearch}
          meta={<span>找到 {matchedCharacters.length} 位马娘</span>}
          bodyClassName="successionPickerGrid"
        >
          {matchedCharacters.length ? (
            matchedCharacters.map((item) => (
              <PlannerSelectionCard
                key={item.id}
                selected={character.id === item.id}
                portrait={
                  <PlannerPortrait
                    path={`chr_icon/${item.id}.png`}
                    alt={item.name}
                    size="large"
                  />
                }
                title={item.name}
                onClick={() => {
                  if (item.id !== character.id)
                    resetCalendar({
                      charaId: item.id,
                    });
                  setCharacterPickerOpen(false);
                }}
              />
            ))
          ) : (
            <div className="successionPickerEmpty">
              <strong>没有符合条件的马娘</strong>
              <p>尝试修改搜索词，或清空搜索。</p>
              <button type="button" onClick={() => setSearch('')}>
                清空搜索
              </button>
            </div>
          )}
        </SuccessionPickerDialog>
      ) : null}

      <section className={panelClass('p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-section font-semibold">需要继承的适应性</h3>
          <span className="text-caption text-slate-600">
            系统推荐 · 至少占用 {recommendation.slots} / 6 个红因子槽位
          </span>
        </div>
        {error ? (
          <p className="mt-3 text-caption text-amber-800">
            当前约束下无法生成完整方案，请调整固定赛程。
          </p>
        ) : null}
        {!error && recommendation.demands.length > 0 ? (
          <div className="mt-3 space-y-3">
            <PlannerFactorList
              factors={recommendation.demands.map((demand) => ({
                id: demand.type,
                name: APTITUDE_LABELS[demand.type],
                stars: demand.stars,
                tone: 'aptitude',
                title: `${RANKS[demand.base]} → ${RANKS[demand.target]}，同类红因子合计至少 ${demand.stars}★，至少 ${demand.slots} 个槽位`,
              }))}
            />
          </div>
        ) : null}
        {!error && !recommendation.demands.length ? (
          <p className="mt-3 text-data text-slate-600">
            当前初始适应性已满足最优方案，无需额外指定红因子。
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-data">
          {APTITUDES.map((key) => (
            <span key={key} className="inline-flex items-center gap-2">
              <span className="text-slate-500">{APTITUDE_LABELS[key]}</span>
              <strong>
                {RANKS[character.aptitudes[key]]}
                {character.aptitudes[key] !== aptitudes[key]
                  ? ` → ${RANKS[aptitudes[key]]}`
                  : ''}
              </strong>
            </span>
          ))}
        </div>
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
        <div className="mt-4">
          <RaceSchedulePicker
            key={`${character.id}:${settings.routeId}`}
            id="optimal-race-fixed"
            title="参赛与休息安排"
            races={calendarOptions}
            automaticRaces={calendar.automaticRaces}
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
            planning={{
              startTurn: calendar.startTurn,
              endTurn: calendar.scenario.endTurn,
              fixedRaces: calendar.fixedRaces,
              fixedLabels: calendar.fixedLabels,
              blockedTurns: calendar.blockedTurns,
              restTurns: settings.restTurns,
              onChange: (turn, action) => {
                if (calendar.fixedRaces[turn] && action === 'rest') return;
                if (
                  calendar.fixedRaces[turn] &&
                  typeof action === 'number' &&
                  !calendar.fixedRaces[turn].includes(action)
                )
                  return;
                setSettings((current) => ({
                  ...current,
                  manualIds: normalizeRaceSelection(
                    [
                      ...current.manualIds.filter(
                        (id) =>
                          calendar.races.find((race) => race.id === id)
                            ?.turn !== turn,
                      ),
                      ...(typeof action === 'number' ? [action] : []),
                    ],
                    calendarOptions,
                  ),
                  restTurns: [
                    ...current.restTurns.filter((value) => value !== turn),
                    ...(action === 'rest' ? [turn] : []),
                  ],
                }));
              },
            }}
          />
        </div>
        {settings.manualIds.length || settings.restTurns.length ? (
          <PlannerButton
            variant="secondary"
            size="small"
            className="mt-4"
            onClick={() => patch({ manualIds: [], restTurns: [] })}
          >
            <RotateCcw size={14} />
            清除手动安排
          </PlannerButton>
        ) : null}
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
      </section>

      <section className={panelClass('p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-section font-semibold">
            {
              {
                jewels: '期望掉钻最优赛程',
                fans: '期望粉丝最优赛程',
                wins: '期望重赏胜场最优赛程',
              }[settings.objective]
            }
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
                      '基础粉丝',
                      '期望粉丝',
                      '累计期望粉丝',
                      '累计期望重赏胜场',
                      '期望掉落次数',
                    ],
                    ...planRows.map((step) => [
                      character.name,
                      calendar.scenario.name,
                      `${planningDate(step.turn)}${step.automatic ? '结束后' : ''}`,
                      step.turn,
                      step.name,
                      step.programId,
                      step.gradeLabel,
                      step.automatic ? '剧本' : String(step.fixed),
                      step.automatic ? '' : step.streak,
                      step.isRace ? step.winProbability : '',
                      step.baseFans,
                      step.expectedFans,
                      step.totalExpectedFans,
                      step.totalExpectedWins,
                      step.expectedDrops,
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
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-y border-slate-200 py-3">
              {[
                ['期望粉丝', Math.round(result.expectedFans).toLocaleString()],
                [
                  `期望 ${GRADE_LABELS[input.gradeThreshold]}／剧本胜场`,
                  result.expectedWins.toFixed(2),
                ],
                [
                  '参赛次数',
                  String(result.raceCount + result.automaticRaces.length),
                ],
                ['期望掉落次数', result.expectedDrops.toFixed(2)],
                [
                  '休息／训练回合',
                  String(result.steps.length - result.raceCount),
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-28">
                  <dt className="text-caption text-slate-500">{label}</dt>
                  <dd className="mt-1 text-section font-semibold tabular-nums text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {entryWarnings.length ? (
              <p className="mt-3 text-caption text-amber-700">
                {entryWarnings.length}{' '}
                场比赛的报名粉丝门槛高于此前的期望粉丝数；实际报名条件需在游戏中确认。
              </p>
            ) : null}
            <div
              role="group"
              aria-label="赛程显示方式"
              className="mt-4 flex gap-2"
            >
              <PlannerButton
                size="small"
                variant={resultView === 'list' ? 'primary' : 'secondary'}
                aria-pressed={resultView === 'list'}
                onClick={() => setResultView('list')}
              >
                <List size={14} />
                列表
              </PlannerButton>
              <PlannerButton
                size="small"
                variant={resultView === 'calendar' ? 'primary' : 'secondary'}
                aria-pressed={resultView === 'calendar'}
                onClick={() => setResultView('calendar')}
              >
                <CalendarDays size={14} />
                赛程日历
              </PlannerButton>
            </div>
            {resultView === 'calendar' ? (
              <div className="mt-4">
                <RaceSchedulePicker
                  id="optimal-race-result"
                  title="最优赛程日历"
                  races={resultRaces}
                  automaticRaces={calendar.automaticRaces}
                  selectedRaceIds={resultRaces.map((race) => race.id)}
                  readOnly
                  planning={{
                    startTurn: calendar.startTurn,
                    endTurn: calendar.scenario.endTurn,
                    fixedRaces: calendar.fixedRaces,
                    fixedLabels: calendar.fixedLabels,
                    blockedTurns: [],
                    restTurns: result.steps
                      .filter((step) => !step.race)
                      .map((step) => step.turn),
                  }}
                />
              </div>
            ) : (
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
                        '基础粉丝',
                        '期望粉丝',
                        '累计期望胜场',
                        '期望掉落次数',
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
                      <tr
                        key={`${step.turn}:${step.automatic ? 'automatic' : 'regular'}`}
                      >
                        <td className="whitespace-nowrap p-3 text-caption">
                          {planningDate(step.turn)}
                          {step.automatic ? (
                            <span className="block text-slate-500">
                              回合结束后
                            </span>
                          ) : null}
                        </td>
                        <td className="min-w-40 p-3">
                          <strong className="font-medium">{step.name}</strong>
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
                          {step.automatic ? (
                            <span className="block text-caption text-slate-500">
                              剧本
                            </span>
                          ) : null}
                        </td>
                        <td className="p-3 tabular-nums">
                          {step.automatic ? '—' : step.streak || '—'}
                        </td>
                        <td className="p-3 tabular-nums">
                          {step.isRace
                            ? `${(step.winProbability * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="p-3 tabular-nums">
                          {step.baseFans.toLocaleString()}
                        </td>
                        <td className="p-3 tabular-nums">
                          {Math.round(step.expectedFans).toLocaleString()}
                        </td>
                        <td className="p-3 tabular-nums">
                          {step.totalExpectedWins.toFixed(2)}
                        </td>
                        <td className="p-3 tabular-nums">
                          {step.expectedDrops.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
