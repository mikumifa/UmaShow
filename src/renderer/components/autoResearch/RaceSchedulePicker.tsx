/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
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
  races: RaceOption[];
  selectedRaceIds: number[];
  setSelectedRaceIds: Dispatch<SetStateAction<number[]>>;
};

export default function RaceSchedulePicker({
  id,
  title,
  races,
  selectedRaceIds,
  setSelectedRaceIds,
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
  const racesForSelectedDate = selectedRaceTurn
    ? [...(racesByTurn.get(selectedRaceTurn) || [])].sort(compareRaces)
    : [];

  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">
            已选择 {selectedRaceIds.length} 场
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
          <div key={year.offset}>
            <div className="mb-2 flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {year.label}
              </h4>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {MONTH_OPTIONS.map((month) => (
                <div
                  key={month}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                >
                  <p className="mb-1 text-center text-[11px] font-medium text-slate-500">
                    {month}月
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {([1, 2] as const).map((half) => {
                      const turn = skillPurchaseTurn(year.offset, month, half);
                      const selected = selectedRaceTurn === turn;
                      const turnRaces = racesByTurn.get(turn) || [];
                      const selectedRace = turnRaces.find((race) =>
                        selectedRaceIds.includes(race.id),
                      );
                      return (
                        <button
                          key={half}
                          type="button"
                          aria-pressed={selected}
                          aria-label={`${skillPurchaseTurnLabel(turn)}${
                            selectedRace
                              ? `，已选择${selectedRace.name}`
                              : '，未选择比赛'
                          }`}
                          onClick={() => setSelectedRaceTurn(turn)}
                          className={`relative aspect-[2/1] min-w-0 overflow-hidden rounded text-[10px] transition ${
                            selected
                              ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500'
                              : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {selectedRace ? (
                            <AssetIcon
                              path={`race_thumb/${selectedRace.thumbnail_id}.png`}
                              alt={selectedRace.name}
                              title={selectedRace.name}
                              className="absolute inset-0 h-full w-full object-contain"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center opacity-50">
                              {half === 1 ? '上半' : '下半'} ·{' '}
                              {turnRaces.length ? '未选择' : '无赛事'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedRaceTurn ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${skillPurchaseTurnLabel(selectedRaceTurn)}比赛选择`}
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-bold text-slate-900">
                  {skillPurchaseTurnLabel(selectedRaceTurn)}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  该日期最多选择一场比赛，共 {racesForSelectedDate.length}{' '}
                  场可选
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRaceTurn(null)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                完成
              </button>
            </div>
            {racesForSelectedDate.some((race) =>
              selectedRaceIds.includes(race.id),
            ) ? (
              <div className="border-b border-slate-100 px-5 py-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    const raceIdsForDate = new Set(
                      racesForSelectedDate.map((race) => race.id),
                    );
                    setSelectedRaceIds((current) =>
                      current.filter((raceId) => !raceIdsForDate.has(raceId)),
                    );
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  取消该日选择
                </button>
              </div>
            ) : null}
            <div className="overflow-y-auto p-4">
              {racesForSelectedDate.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {racesForSelectedDate.map((race) => {
                    const checked = selectedRaceIds.includes(race.id);
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
                          onChange={() => {
                            const raceIdsForDate = new Set(
                              racesForSelectedDate.map((item) => item.id),
                            );
                            setSelectedRaceIds((current) =>
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
                        <span className="min-w-0 text-xs">
                          <strong className="block truncate text-sm">
                            {race.name}
                          </strong>
                          <span className="block text-slate-500">
                            {race.type} · {race.venue}
                          </span>
                          <span className="text-slate-400">
                            {race.terrain} · {race.distance}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-10 text-center text-sm text-slate-400">
                  该日期没有可选比赛
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
