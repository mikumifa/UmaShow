import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { horseIconPath } from './SelectionCards';
import { DailyTasksOptions } from './types';

type Horse = DailyTasksOptions['trained_charas'][number];
type Race =
  | DailyTasksOptions['daily_races'][number]
  | DailyTasksOptions['daily_legend_races'][number];

type SortKey =
  | 'suitability'
  | 'rank_score'
  | 'speed'
  | 'stamina'
  | 'power'
  | 'guts'
  | 'wit';

type MinimumGrade = 'auto' | '0' | '4' | '5' | '6' | '7' | '8';

type Props = {
  title: string;
  race: Race;
  horses: Horse[];
  selectedId: number;
  runningStyle: number;
  onSelect: (horse: Horse) => void;
  onClose: () => void;
};

const distanceLabels = {
  short: '短距离',
  mile: '英里',
  middle: '中距离',
  long: '长距离',
};

const gradeLabels = ['-', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

const gradeClass = (grade: number) => {
  if (grade >= 8) return 'border-pink-200 bg-pink-50 text-pink-700';
  if (grade >= 7) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (grade >= 6) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (grade >= 5) return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-slate-200 bg-slate-50 text-slate-500';
};

export const aptitudeLabel = (grade: number) =>
  gradeLabels[Math.max(0, Math.min(8, Number(grade) || 0))];

export const distanceAptitude = (horse: Horse, race: Race) =>
  Number(horse[`proper_distance_${race.distance_type}`] || 0);

export const groundAptitude = (horse: Horse, race: Race) =>
  Number(
    race.ground === 2 ? horse.proper_ground_dirt : horse.proper_ground_turf,
  );

const runningStyleAptitude = (horse: Horse, runningStyle: number) => {
  if (runningStyle === 1) return horse.proper_running_style_nige;
  if (runningStyle === 2) return horse.proper_running_style_senko;
  if (runningStyle === 3) return horse.proper_running_style_sashi;
  if (runningStyle === 4) return horse.proper_running_style_oikomi;
  return Math.max(
    horse.proper_running_style_nige,
    horse.proper_running_style_senko,
    horse.proper_running_style_sashi,
    horse.proper_running_style_oikomi,
  );
};

const automaticMinimum = (values: number[]) => {
  const best = Math.max(0, ...values);
  return best >= 7 ? 7 : best;
};

const resolvedMinimum = (value: MinimumGrade, automatic: number) =>
  value === 'auto' ? automatic : Number(value);

export default function DailyHorsePicker({
  title,
  race,
  horses,
  selectedId,
  runningStyle,
  onSelect,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('suitability');
  const [distanceMinimum, setDistanceMinimum] = useState<MinimumGrade>('auto');
  const [groundMinimum, setGroundMinimum] = useState<MinimumGrade>('auto');

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const autoSuitabilityMinimum = useMemo(
    () =>
      automaticMinimum(
        horses.map((horse) =>
          Math.min(distanceAptitude(horse, race), groundAptitude(horse, race)),
        ),
      ),
    [horses, race],
  );
  const visibleHorses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('zh-CN');
    const distanceLimit = resolvedMinimum(
      distanceMinimum,
      autoSuitabilityMinimum,
    );
    const groundLimit = resolvedMinimum(groundMinimum, autoSuitabilityMinimum);
    return horses
      .filter(
        (horse) =>
          (!query || horse.name.toLocaleLowerCase('zh-CN').includes(query)) &&
          distanceAptitude(horse, race) >= distanceLimit &&
          groundAptitude(horse, race) >= groundLimit,
      )
      .sort((left, right) => {
        if (sortKey === 'suitability') {
          const leftDistance = distanceAptitude(left, race);
          const rightDistance = distanceAptitude(right, race);
          const leftGround = groundAptitude(left, race);
          const rightGround = groundAptitude(right, race);
          const jointDifference =
            Math.min(rightDistance, rightGround) -
            Math.min(leftDistance, leftGround);
          if (jointDifference) return jointDifference;
          const totalDifference =
            rightDistance + rightGround - leftDistance - leftGround;
          if (totalDifference) return totalDifference;
          const styleDifference =
            runningStyleAptitude(right, runningStyle) -
            runningStyleAptitude(left, runningStyle);
          if (styleDifference) return styleDifference;
          return right.rank_score - left.rank_score;
        }
        return (
          right[sortKey] - left[sortKey] || right.rank_score - left.rank_score
        );
      });
  }, [
    autoSuitabilityMinimum,
    distanceMinimum,
    groundMinimum,
    horses,
    race,
    runningStyle,
    search,
    sortKey,
  ]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-800">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {race.name} · {race.ground_name} · {race.distance}m ·{' '}
              {distanceLabels[race.distance_type]}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭马娘选择"
            onClick={onClose}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
            <label className="relative block" htmlFor="daily-horse-search">
              <Search
                size={15}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                id="daily-horse-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索已育成马娘"
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"
              />
            </label>
            <label className="block" htmlFor="daily-horse-distance-filter">
              <span className="sr-only">距离适应性</span>
              <select
                id="daily-horse-distance-filter"
                value={distanceMinimum}
                onChange={(event) =>
                  setDistanceMinimum(event.target.value as MinimumGrade)
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="auto">
                  {distanceLabels[race.distance_type]}：自动（≥
                  {aptitudeLabel(autoSuitabilityMinimum)}）
                </option>
                <option value="8">距离适应性 S</option>
                <option value="7">距离适应性 A 以上</option>
                <option value="6">距离适应性 B 以上</option>
                <option value="5">距离适应性 C 以上</option>
                <option value="4">距离适应性 D 以上</option>
                <option value="0">距离不限</option>
              </select>
            </label>
            <label className="block" htmlFor="daily-horse-ground-filter">
              <span className="sr-only">场地适应性</span>
              <select
                id="daily-horse-ground-filter"
                value={groundMinimum}
                onChange={(event) =>
                  setGroundMinimum(event.target.value as MinimumGrade)
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="auto">
                  {race.ground_name}：自动（≥
                  {aptitudeLabel(autoSuitabilityMinimum)}）
                </option>
                <option value="8">场地适应性 S</option>
                <option value="7">场地适应性 A 以上</option>
                <option value="6">场地适应性 B 以上</option>
                <option value="5">场地适应性 C 以上</option>
                <option value="4">场地适应性 D 以上</option>
                <option value="0">场地不限</option>
              </select>
            </label>
            <label className="relative block" htmlFor="daily-horse-sort">
              <SlidersHorizontal
                size={15}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <select
                id="daily-horse-sort"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
              >
                <option value="suitability">按赛事适配度</option>
                <option value="rank_score">按评分</option>
                <option value="speed">按速度</option>
                <option value="stamina">按耐力</option>
                <option value="power">按力量</option>
                <option value="guts">按根性</option>
                <option value="wit">按智力</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            自动筛选优先要求 A 适应性；没有 A
            时会放宽到当前账号能够达到的最高等级。当前显示{' '}
            {visibleHorses.length}/{horses.length} 匹。
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleHorses.map((horse) => {
              const iconPath = horseIconPath(
                horse.card_id,
                horse.rarity,
                horse.race_cloth_id,
              );
              const distanceGrade = distanceAptitude(horse, race);
              const groundGrade = groundAptitude(horse, race);
              const styleGrade = runningStyleAptitude(horse, runningStyle);
              const selected = horse.trained_chara_id === selectedId;
              return (
                <button
                  key={horse.trained_chara_id}
                  type="button"
                  onClick={() => onSelect(horse)}
                  className={`rounded-lg border p-3 text-left transition ${
                    selected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {iconPath ? (
                        <AssetIcon
                          path={iconPath}
                          alt={horse.name}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {horse.name}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        评分 {horse.rank_score}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-xs font-bold ${gradeClass(distanceGrade)}`}
                        >
                          {distanceLabels[race.distance_type]}{' '}
                          {aptitudeLabel(distanceGrade)}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-xs font-bold ${gradeClass(groundGrade)}`}
                        >
                          {race.ground_name} {aptitudeLabel(groundGrade)}
                        </span>
                        {runningStyle > 0 ? (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-xs font-bold ${gradeClass(styleGrade)}`}
                          >
                            跑法 {aptitudeLabel(styleGrade)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                  <span className="mt-3 grid grid-cols-5 gap-1 rounded-md bg-slate-50 p-2 text-center">
                    {[
                      ['速', horse.speed],
                      ['耐', horse.stamina],
                      ['力', horse.power],
                      ['根', horse.guts],
                      ['智', horse.wit],
                    ].map(([label, value]) => (
                      <span key={label} className="text-[11px] text-slate-500">
                        <span className="block">{label}</span>
                        <span className="block font-semibold text-slate-700">
                          {value}
                        </span>
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          {!visibleHorses.length ? (
            <div className="py-16 text-center text-sm text-slate-400">
              没有符合当前筛选条件的已育成马娘，请降低适应性要求。
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
