/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { WandSparkles } from 'lucide-react';
import {
  PlannerButton,
  PlannerFactorBadge,
} from 'renderer/components/succession/PlannerComponents';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  RACE_PLANNER_STORAGE_KEY,
  storedPlannerFanBonus,
} from 'renderer/utils/racePlannerPreferences';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
  planningDate,
} from 'renderer/utils/racePlannerCatalog';
import {
  designOfflineCareer,
  isOwnDesignParent,
  recommendOfflineLineages,
  OfflineDesign,
} from 'renderer/utils/offlineCareerDesign';
import { Dashboard, RaceOption } from './types';
import RaceSchedulePicker from './RaceSchedulePicker';
import { getSharedStorageItem } from './shared';

type Props = {
  design: OfflineDesign;
  setDesign: Dispatch<SetStateAction<OfflineDesign>>;
  charaId: number;
  changeScenario: (id: number) => void;
  parents: Dashboard['parents'];
  selectedParent1: string;
  selectedParent2: string;
  setParents: (first: string, second: string) => void;
  busy: string;
};

export function OfflineCustomSchedule({
  design,
  setDesign,
  charaId,
  scenarioId,
  disabled = false,
}: Pick<Props, 'design' | 'setDesign' | 'charaId'> & {
  scenarioId: number;
  disabled?: boolean;
}) {
  const calendar = useMemo(
    () => buildPlanningCalendar(charaId, scenarioId || 5, design.routeId),
    [charaId, scenarioId, design.routeId],
  );
  const options = useMemo<RaceOption[]>(
    () =>
      calendar.races
        .filter((race) => !calendar.blockedTurns.includes(race.turn))
        .map((race) => ({
          id: race.id,
          program_id: race.programId,
          turn: race.turn,
          name: race.name,
          date: planningDate(race.turn),
          type:
            (
              {
                100: 'GI',
                200: 'GII',
                300: 'GIII',
                400: 'OP',
                700: 'PRE-OP',
                800: '未胜利',
                900: '出道',
                1000: 'EX',
              } as Record<number, string>
            )[race.grade] || '其他',
          terrain: race.ground === 'turf' ? '草地' : '泥地',
          distance: {
            short: '短距离',
            mile: '英里',
            middle: '中距离',
            long: '长距离',
          }[race.distanceType],
          venue: '',
          thumbnail_id:
            PLANNER_CATALOG.programs[String(race.programId)]?.thumbnailId || 0,
        })),
    [calendar],
  );
  if (!charaId) {
    return <p className="text-label text-gray-500">先选择育成马娘</p>;
  }
  return (
    <RaceSchedulePicker
      title="参赛计划"
      races={options}
      lockedRaces={calendar.fixedRaces}
      selectedRaceIds={design.raceIds}
      setSelectedRaceIds={
        disabled
          ? undefined
          : (value) => {
              setDesign((current) => ({
                ...current,
                raceIds:
                  typeof value === 'function' ? value(current.raceIds) : value,
              }));
            }
      }
    />
  );
}

export default function OfflineDesignSettings({
  design,
  setDesign,
  charaId,
  changeScenario,
  parents,
  selectedParent1,
  selectedParent2,
  setParents,
  busy,
}: Props) {
  const [result, setResult] = useState<ReturnType<
    typeof designOfflineCareer
  > | null>(null);
  const [error, setError] = useState('');
  const [designing, setDesigning] = useState(false);
  useEffect(() => {
    if (
      result &&
      (design.source !== 'custom' ||
        design.raceIds !== result.raceIds ||
        (result.best &&
          (result.best.parents[0].selection_id !== selectedParent1 ||
            result.best.parents[1].selection_id !== selectedParent2)))
    )
      setResult(null);
  }, [result, selectedParent1, selectedParent2, design.source, design.raceIds]);
  const character = PLANNER_CATALOG.characters.find(
    (item) => item.id === charaId,
  );
  const patch = (values: Partial<OfflineDesign>) => {
    setDesign((current) => ({ ...current, ...values }));
    setResult(null);
    setError('');
  };
  const oneClick = async () => {
    if (!character) return;
    setDesigning(true);
    setError('');
    // Allow the button's pending state to paint before the local search.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
    try {
      const next = designOfflineCareer(
        character,
        design,
        parents.filter(isOwnDesignParent),
        storedPlannerFanBonus(getSharedStorageItem(RACE_PLANNER_STORAGE_KEY)),
      );
      changeScenario(5);
      setParents(
        next.best?.parents[0].selection_id || '',
        next.best?.parents[1].selection_id || '',
      );
      setDesign((current) => ({
        ...current,
        source: 'custom',
        raceIds: next.raceIds,
        inheritance: next.demands.map((demand) => demand.key),
        targets: Object.fromEntries(
          next.demands.map((demand) => [demand.key, demand.target]),
        ),
      }));
      setResult(next);
    } catch (caught) {
      setResult(null);
      setError((caught as Error).message);
    } finally {
      setDesigning(false);
    }
  };
  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="mr-1 text-section">养成目标</strong>
          {(
            [
              ['breeding', '种马'],
              ['jewels', '挂钻'],
              ['fans', '刷粉丝'],
            ] as const
          ).map(([goal, label]) => (
            <button
              key={goal}
              type="button"
              disabled={!!busy || designing}
              aria-pressed={design.goal === goal}
              className={`rounded-lg border px-3 py-1.5 text-data ${design.goal === goal ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'}`}
              onClick={() => {
                patch({ goal });
                if (goal !== 'breeding') changeScenario(5);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {design.goal !== 'breeding' && (
          <PlannerButton
            onClick={oneClick}
            disabled={!character || !!busy || designing}
          >
            <WandSparkles size={15} />
            {designing ? '设计中…' : '一键设计'}
          </PlannerButton>
        )}
      </div>
      {design.goal !== 'breeding' && (
        <p className="text-caption text-gray-500">
          普通赛程获胜后掉钻率：第 1～5 连战为 4%、4%、3%、1%、1%，第 6
          连战及以后为 0%；生涯目标赛在当前连战胜率上加 10 个百分点，最高 100%。
        </p>
      )}
      {error && (
        <p role="alert" className="text-label text-red-600">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-2 text-label">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-indigo-700">
            <strong>
              {result.best ? '已填入种马与赛程' : '赛程已生成 · 待补齐种马'}
            </strong>
            <span>{result.schedule.raceCount} 场（含目标赛）</span>
            <span>
              {design.goal === 'jewels'
                ? `期望掉落 ${result.schedule.expectedDrops.toFixed(2)} 次`
                : `期望粉丝 ${Math.round(result.schedule.expectedFans).toLocaleString()}`}
            </span>
          </div>
          {!result.best && (
            <div className="rounded-lg border border-rose-200 bg-white p-3">
              <strong className="text-rose-700">
                推荐种马因子 · 两侧及祖辈合计
              </strong>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.demands.map((demand) => (
                  <span
                    key={demand.key}
                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-700"
                  >
                    <AssetIcon
                      path={`succession/aptitude/${demand.icon}.png`}
                      alt={demand.label}
                      className="h-5 w-5"
                    />
                    {demand.label} ≥ {demand.stars}★ ·{' '}
                    {Math.ceil(demand.stars / 3)} 槽
                  </span>
                ))}
                {['速度', '耐力', '力量', '毅力', '智力'].map((name) => (
                  <PlannerFactorBadge
                    key={name}
                    factor={{ id: name, name, stars: 3, tone: 'stat' }}
                  />
                ))}
              </div>
              <p className="mt-2 text-gray-500">
                {result.demands.length
                  ? '按上述红因子组合寻找种马，蓝因子任选。'
                  : '需要两位不同角色的自有继承马娘。'}
              </p>
              <details className="mt-2" open>
                <summary className="cursor-pointer text-rose-700">
                  可选组合 · 每侧含父辈与两位祖辈
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {recommendOfflineLineages(result.demands).map(
                    (plan, index) => (
                      <div
                        key={JSON.stringify(plan)}
                        className="rounded-lg border border-rose-100 p-2"
                      >
                        <span className="text-gray-500">方案 {index + 1}</span>
                        {[plan.first, plan.second].map((slots, side) => (
                          <div
                            key={side}
                            className="mt-1 flex flex-wrap items-center gap-1"
                          >
                            <span className="text-gray-500">
                              种马 {side + 1}
                            </span>
                            {slots.map((slot) => (
                              <PlannerFactorBadge
                                key={slot.label}
                                factor={{
                                  id: slot.label,
                                  name: slot.label,
                                  stars: 3,
                                  count: slot.count,
                                  tone: 'aptitude',
                                }}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
