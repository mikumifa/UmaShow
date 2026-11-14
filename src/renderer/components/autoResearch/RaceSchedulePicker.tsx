/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, memo, SetStateAction, useMemo, useState } from 'react';
import { Coffee, LockKeyhole, Pin } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { PlannerButton } from 'renderer/components/succession/PlannerComponents';
import { SuccessionPickerDialog } from 'renderer/components/succession/SuccessionPicker';
import type { PlanningScenarioEvent } from 'renderer/utils/racePlannerCatalog';
import {
  compareRaces,
  MONTH_OPTIONS,
  normalizeRaceSelection,
  skillPurchaseTurn,
  skillPurchaseTurnLabel,
  SKILL_PURCHASE_YEAR_OPTIONS,
} from './shared';
import { RaceOption } from './types';

type Props = {
  id?: string;
  title: string;
  description?: string;
  notice?: string;
  step?: number;
  races: RaceOption[];
  selectedRaceIds: number[];
  setSelectedRaceIds?: Dispatch<SetStateAction<number[]>>;
  readOnly?: boolean;
  automaticRaces?: PlanningScenarioEvent[];
  lockedRaces?: Record<number, number[]>;
  planning?: {
    startTurn: number;
    endTurn: number;
    fixedRaces: Record<number, number[]>;
    fixedLabels: Record<number, string>;
    blockedTurns: number[];
    restTurns: number[];
    onChange?: (turn: number, action: number | 'rest' | 'auto') => void;
  };
};

function RaceSchedulePicker({
  id,
  title,
  description,
  notice,
  step,
  races,
  selectedRaceIds,
  setSelectedRaceIds,
  planning,
  readOnly = false,
  automaticRaces = [],
  lockedRaces,
}: Props) {
  const [selectedRaceTurn, setSelectedRaceTurn] = useState<number | null>(null);
  const racesByTurn = useMemo(() => {
    const result = new Map<number, RaceOption[]>();
    races.forEach((race) => {
      const turnRaces = result.get(race.turn) || [];
      turnRaces.push(race);
      result.set(race.turn, turnRaces);
    });
    return result;
  }, [races]);
  const selectedRaceIdSet = useMemo(
    () => new Set(selectedRaceIds),
    [selectedRaceIds],
  );
  const restTurnSet = useMemo(
    () => new Set(planning?.restTurns || []),
    [planning?.restTurns],
  );
  const blockedTurnSet = useMemo(
    () => new Set(planning?.blockedTurns || []),
    [planning?.blockedTurns],
  );
  const automaticRacesByTurn = useMemo(() => {
    const result = new Map<number, PlanningScenarioEvent[]>();
    automaticRaces.forEach((race) => {
      const list = result.get(race.turn) || [];
      list.push(race);
      result.set(race.turn, list);
    });
    return result;
  }, [automaticRaces]);
  const racesForSelectedDate = useMemo(
    () =>
      selectedRaceTurn
        ? [...(racesByTurn.get(selectedRaceTurn) || [])].sort(compareRaces)
        : [],
    [racesByTurn, selectedRaceTurn],
  );
  const fixedIds = selectedRaceTurn
    ? planning?.fixedRaces[selectedRaceTurn] || lockedRaces?.[selectedRaceTurn]
    : undefined;
  const lockedDate = Boolean(
    selectedRaceTurn && lockedRaces?.[selectedRaceTurn],
  );
  const showRaceDetails = Boolean(planning || lockedRaces);
  const isRest = Boolean(selectedRaceTurn && restTurnSet.has(selectedRaceTurn));
  const clearDate = () => {
    if (!selectedRaceTurn || readOnly || lockedDate) return;
    if (planning) planning.onChange?.(selectedRaceTurn, 'auto');
    else {
      const ids = new Set(racesForSelectedDate.map((race) => race.id));
      setSelectedRaceIds?.((current) =>
        current.filter((raceId) => !ids.has(raceId)),
      );
    }
  };
  let selectionSummary = `已选择 ${selectedRaceIds.length} 场`;
  if (planning)
    selectionSummary = `目标 ${Object.keys(planning.fixedRaces).length} 场 · 手动 ${selectedRaceIds.length} 场 · 休息 ${planning.restTurns.length} 回合`;
  if (readOnly)
    selectionSummary = `已安排 ${selectedRaceIds.length} 场 · 休息／训练 ${planning?.restTurns.length || 0} 回合`;
  if (automaticRaces.length)
    selectionSummary += ` · 剧本赛 ${automaticRaces.length} 场`;
  let dateDescription = `该日期最多选择一场比赛，共 ${racesForSelectedDate.length} 场可选`;
  if (fixedIds)
    dateDescription = `${planning?.fixedLabels[selectedRaceTurn!] || '目标赛'}必须参加，不能设为休息。${fixedIds.length > 1 ? '可在目标候选比赛中固定一场。' : ''}`;
  if (lockedDate) dateDescription = '生涯目标赛已锁定。';
  if (readOnly) dateDescription = '查看该日期的优化结果。';

  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {step ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
              {step}
            </span>
          ) : null}
          <h3 className="text-section font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="text-right">
          <p className="uma-prose text-data text-slate-500">
            {selectionSummary}
          </p>
        </div>
      </div>

      {description ? (
        <p className="uma-prose mt-2 text-data text-slate-600">{description}</p>
      ) : null}
      {notice ? (
        <p className="uma-prose mt-2 text-label text-amber-800">{notice}</p>
      ) : null}
      {planning ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-caption text-slate-600">
          <span className="inline-flex items-center gap-1">
            <LockKeyhole size={13} />
            目标赛
          </span>
          <span className="inline-flex items-center gap-1 text-indigo-700">
            <Pin size={13} />
            {readOnly ? '参赛' : '手动固定'}
          </span>
          <span className="inline-flex items-center gap-1 text-sky-800">
            <Coffee size={13} />
            {readOnly ? '休息／训练' : '固定休息'}
          </span>
          {!readOnly ? <span>空白日期由自动规划安排</span> : null}
        </div>
      ) : null}
      <div className="mt-4 space-y-5">
        {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
          <div key={year.offset}>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-data font-semibold text-slate-800">
                {year.label}
              </h4>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {MONTH_OPTIONS.map((month) => (
                <div
                  key={month}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                >
                  <p className="mb-1 text-center text-caption font-medium text-slate-500">
                    {month}月
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {([1, 2] as const).map((half) => {
                      const turn = skillPurchaseTurn(year.offset, month, half);
                      const selected = selectedRaceTurn === turn;
                      const turnRaces = racesByTurn.get(turn) || [];
                      const goals =
                        planning?.fixedRaces[turn] || lockedRaces?.[turn];
                      const selectedRace = turnRaces.find(
                        (race) =>
                          selectedRaceIdSet.has(race.id) &&
                          (!goals || goals.includes(race.id)),
                      );
                      const displayRace =
                        selectedRace ||
                        turnRaces.find((race) => goals?.includes(race.id));
                      const rest = restTurnSet.has(turn);
                      const outside =
                        planning &&
                        (turn < planning.startTurn || turn > planning.endTurn);
                      const blocked = blockedTurnSet.has(turn) && !goals;
                      let stateLabel = planning ? '自动规划' : '未选择比赛';
                      if (selectedRace)
                        stateLabel = `已选择${selectedRace.name}`;
                      if (rest)
                        stateLabel = readOnly ? '休息／训练' : '固定休息';
                      if (goals)
                        stateLabel = `${planning?.fixedLabels[turn] || (lockedRaces ? '生涯目标' : '目标赛')}，${turnRaces
                          .filter((race) => goals.includes(race.id))
                          .map((race) => race.name)
                          .join(' / ')}`;
                      if (blocked) stateLabel = '剧本禁赛';
                      if (outside) stateLabel = '规划范围外';
                      let tone =
                        'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700';
                      if (selectedRace) tone = 'bg-indigo-50 text-indigo-700';
                      if (goals) tone = 'bg-slate-100 text-slate-700';
                      if (rest) tone = 'bg-sky-50 text-sky-800';
                      if (selected)
                        tone =
                          'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500';
                      let emptyLabel = turnRaces.length ? '未选择' : '无赛事';
                      if (planning) emptyLabel = '自动';
                      if (blocked) emptyLabel = '禁赛';
                      if (outside) emptyLabel = '—';
                      return (
                        <button
                          key={half}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${skillPurchaseTurnLabel(turn)}，${stateLabel}`}
                          title={`${skillPurchaseTurnLabel(turn)} · ${stateLabel}`}
                          disabled={Boolean(
                            outside || blocked || lockedRaces?.[turn],
                          )}
                          onClick={() => setSelectedRaceTurn(turn)}
                          className={`relative flex min-w-0 flex-col overflow-hidden rounded text-caption transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed ${outside || blocked ? 'opacity-50' : ''} ${showRaceDetails ? 'min-h-16' : 'aspect-[2/1]'} ${tone}`}
                        >
                          {showRaceDetails ? (
                            <span className="flex w-full items-center justify-between px-1 pt-1 text-caption">
                              <span>{half === 1 ? '上半' : '下半'}</span>
                              {goals ? <LockKeyhole size={11} /> : null}
                              {!goals && selectedRace && !readOnly ? (
                                <Pin size={11} />
                              ) : null}
                            </span>
                          ) : null}
                          {displayRace ? (
                            <AssetIcon
                              path={`race_thumb/${displayRace.thumbnail_id}.png`}
                              alt={displayRace.name}
                              className={
                                showRaceDetails
                                  ? 'h-8 w-full object-contain'
                                  : 'absolute inset-0 h-full w-full object-contain'
                              }
                            />
                          ) : null}
                          {!displayRace && rest ? (
                            <span className="flex flex-1 items-center justify-center gap-1">
                              <Coffee size={14} />
                              {readOnly ? '休／练' : '休息'}
                            </span>
                          ) : null}
                          {!displayRace && !rest ? (
                            <span className="flex h-full w-full flex-1 items-center justify-center">
                              {emptyLabel}
                            </span>
                          ) : null}
                          {showRaceDetails && displayRace ? (
                            <span
                              className="w-full truncate px-1 pb-1"
                              title={displayRace.name}
                            >
                              {displayRace.name}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {(
                    automaticRacesByTurn.get(
                      skillPurchaseTurn(year.offset, month, 2),
                    ) || []
                  ).map((race) => (
                      <div
                        key={race.turn}
                        className="mt-1 flex items-center justify-center gap-1 rounded bg-slate-100 px-1 py-1 text-caption text-slate-700"
                        title="回合结束后自动参赛，必成功，掉落率 5%，不影响连战"
                      >
                        <LockKeyhole size={11} />
                        <AssetIcon
                          path={`race_thumb/${race.thumbnailId}.png`}
                          alt={race.name}
                          className="h-6 w-10 object-contain"
                        />
                        <span>{race.name} · 剧本</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedRaceTurn ? (
        <SuccessionPickerDialog
          ariaLabel={`${skillPurchaseTurnLabel(selectedRaceTurn)}比赛选择`}
          title={skillPurchaseTurnLabel(selectedRaceTurn)}
          description={dateDescription}
          onClose={() => setSelectedRaceTurn(null)}
          overlayClassName="plannerNestedOverlay"
          escapePriority
          dialogClassName="max-w-4xl"
          footer={
            <>
              {!readOnly ? (
                <span>
                  {planning
                    ? '设置即时生效，赛程自动重新计算'
                    : '选择后会自动替换同一天的其它比赛'}
                </span>
              ) : (
                <span>查看参赛与休息安排</span>
              )}
              <PlannerButton
                variant="primary"
                onClick={() => setSelectedRaceTurn(null)}
              >
                完成
              </PlannerButton>
            </>
          }
        >
          {planning && !fixedIds && !readOnly ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
              <PlannerButton
                variant={isRest ? 'primary' : 'secondary'}
                size="small"
                onClick={() => planning.onChange?.(selectedRaceTurn, 'rest')}
              >
                <Coffee size={14} />
                固定休息
              </PlannerButton>
              <PlannerButton
                variant="secondary"
                size="small"
                onClick={clearDate}
              >
                恢复自动规划
              </PlannerButton>
              <span role="status" className="text-caption text-slate-600">
                {isRest ? '本回合已固定休息，不安排比赛。' : null}
                {!isRest &&
                racesForSelectedDate.some((race) =>
                  selectedRaceIdSet.has(race.id),
                )
                  ? '本回合已手动固定比赛。'
                  : null}
                {!isRest &&
                !racesForSelectedDate.some((race) =>
                  selectedRaceIdSet.has(race.id),
                )
                  ? '本回合由自动规划安排。'
                  : null}
              </span>
            </div>
          ) : null}
          {racesForSelectedDate.some((race) => selectedRaceIdSet.has(race.id)) &&
          !readOnly &&
          !lockedDate &&
          (!planning || (fixedIds && fixedIds.length > 1)) ? (
            <div className="border-b border-slate-100 px-5 py-2 text-right">
              <button
                type="button"
                onClick={clearDate}
                className="text-caption text-slate-500 hover:text-slate-800"
              >
                {planning ? '恢复目标候选' : '取消该日选择'}
              </button>
            </div>
          ) : null}
          <div className="overflow-y-auto p-4">
            {racesForSelectedDate.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {racesForSelectedDate.map((race) => {
                  const checked =
                    selectedRaceIdSet.has(race.id) ||
                    Boolean(
                      fixedIds?.length === 1 && fixedIds.includes(race.id),
                    );
                  return (
                    <label
                      key={race.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-2 ${
                        checked
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-100 bg-white hover:border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`race-schedule-${id || 'picker'}-${selectedRaceTurn}`}
                        checked={checked}
                        disabled={
                          readOnly || lockedDate || fixedIds?.length === 1
                        }
                        onChange={() => {
                          if (planning) {
                            planning.onChange?.(selectedRaceTurn, race.id);
                            return;
                          }
                          const raceIdsForDate = new Set(
                            racesForSelectedDate.map((item) => item.id),
                          );
                          setSelectedRaceIds?.((current) =>
                            normalizeRaceSelection(
                              [
                                ...current.filter(
                                  (raceId) => !raceIdsForDate.has(raceId),
                                ),
                                race.id,
                              ],
                              races,
                            ),
                          );
                        }}
                        className="mt-1"
                      />
                      <AssetIcon
                        path={`race_thumb/${race.thumbnail_id}.png`}
                        alt={race.name}
                        className="h-10 w-20 shrink-0 rounded-lg object-contain"
                      />
                      <span className="min-w-0 text-caption">
                        <strong className="block truncate text-data">
                          {race.name}
                        </strong>
                        <span className="block text-slate-500">
                          {race.type} · {race.venue}
                        </span>
                        <span className="text-slate-500">
                          {race.terrain} · {race.distance}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-10 text-center text-data text-slate-600">
                {readOnly ? '本回合休息／训练，不参赛。' : '该日期没有可选比赛'}
              </p>
            )}
          </div>
        </SuccessionPickerDialog>
      ) : null}
    </section>
  );
}

export default memo(RaceSchedulePicker);
