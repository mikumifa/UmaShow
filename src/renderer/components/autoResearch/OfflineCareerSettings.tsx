/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction, useMemo } from 'react';
import { Check, Download, Save } from 'lucide-react';
import { compareRaces } from './shared';
import { OfflineSingleModeSetup, RaceOption } from './types';
import RaceSchedulePicker from './RaceSchedulePicker';

type Props = {
  setup: OfflineSingleModeSetup | null;
  races: RaceOption[];
  selectedDeckNum: number;
  setSelectedDeckNum: Dispatch<SetStateAction<number>>;
  deckName: string;
  setDeckName: Dispatch<SetStateAction<string>>;
  selectedRaceIds: number[];
  setSelectedRaceIds: Dispatch<SetStateAction<number[]>>;
  challengeMode: boolean;
  setChallengeMode: Dispatch<SetStateAction<boolean>>;
  busy: string;
  prepare: () => Promise<void>;
  saveDeck: () => Promise<void>;
};

const raceKey = (year: number, programId: number) => year * 100000 + programId;

export default function OfflineCareerSettings({
  setup,
  races,
  selectedDeckNum,
  setSelectedDeckNum,
  deckName,
  setDeckName,
  selectedRaceIds,
  setSelectedRaceIds,
  challengeMode,
  setChallengeMode,
  busy,
  prepare,
  saveDeck,
}: Props) {
  const raceById = useMemo(
    () => new Map(races.map((race) => [race.id, race])),
    [races],
  );
  const requiredRaces = (setup?.required_race_array || [])
    .map((item) => ({
      ...item,
      id: raceKey(item.year, item.program_id),
      race: raceById.get(raceKey(item.year, item.program_id)),
    }))
    .sort((left, right) => {
      if (left.race && right.race) return compareRaces(left.race, right.race);
      return left.id - right.id;
    });

  const selectDeck = (deckNum: number) => {
    const deck = setup?.race_decks.find((item) => item.deck_num === deckNum);
    if (!deck) return;
    setSelectedDeckNum(deckNum);
    setDeckName(deck.deck_name || `我的参赛计划${deckNum}`);
    setSelectedRaceIds(
      deck.race_array.map((item) => raceKey(item.year, item.program_id)),
    );
  };

  return (
    <section className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sky-950">游戏离线自动育成</h3>
          <p className="mt-1 text-xs text-sky-700">
            读取游戏内 8 个赛程槽位，服务器会自动补入当前马娘和剧本的必跑比赛。
          </p>
        </div>
        <button
          type="button"
          onClick={prepare}
          disabled={Boolean(busy)}
          className="flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
        >
          <Download size={15} />
          {busy === 'idle-prepare' ? '正在读取…' : '读取游戏赛程'}
        </button>
      </div>

      {setup ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-sky-100 bg-white p-3 text-sm">
              <span className="text-slate-500">当前主剧本</span>
              <strong className="ml-2 text-slate-900">
                剧本 {setup.scenario_id}
              </strong>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-sky-100 bg-white p-3 text-sm">
              <input
                type="checkbox"
                checked={challengeMode}
                disabled={!setup.training_challenge.available}
                onChange={(event) => setChallengeMode(event.target.checked)}
                className="mt-1"
              />
              <span>
                <strong className="block text-slate-900">参加活动模式</strong>
                <span className="text-xs text-slate-500">
                  {setup.training_challenge.available
                    ? `检测到当前育成挑战（活动 ${setup.training_challenge.id}）`
                    : '当前没有可参加的育成挑战活动'}
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">游戏赛程槽位</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {setup.race_decks.map((deck) => (
                <button
                  key={deck.deck_num}
                  type="button"
                  onClick={() => selectDeck(deck.deck_num)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedDeckNum === deck.deck_num
                      ? 'border-sky-400 bg-sky-100 text-sky-950'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <strong className="block truncate">
                    {deck.deck_num}. {deck.deck_name || '空槽位'}
                  </strong>
                  <span className="text-xs text-slate-500">
                    {deck.race_array.length} 场
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selectedDeckNum ? (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <label className="text-sm text-slate-700">
                  槽位名称
                  <input
                    value={deckName}
                    maxLength={20}
                    onChange={(event) => setDeckName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveDeck}
                  disabled={Boolean(busy)}
                  className="mt-5 flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  <Save size={15} />
                  {busy === 'idle-race-deck' ? '正在覆盖…' : '覆盖保存到游戏'}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-800">
                  必跑比赛（自动加入）
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {requiredRaces.length ? (
                    requiredRaces.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800"
                      >
                        <Check size={12} />{' '}
                        {item.race
                          ? `${item.race.date} · ${item.race.name}`
                          : `第 ${item.year} 年 · 比赛 ${item.program_id}`}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">暂无固定比赛</span>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <RaceSchedulePicker
                  id="offline-races"
                  title="离线育成比赛"
                  description="参照预设比赛，先选择育成日期，再选择该日期要参加的一场比赛。"
                  notice="必跑比赛由服务器自动补入，不需要重复选择"
                  races={races}
                  selectedRaceIds={selectedRaceIds}
                  setSelectedRaceIds={setSelectedRaceIds}
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
