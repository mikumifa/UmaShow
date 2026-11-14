import { memo, useMemo, useState } from 'react';
import { UMDB } from 'renderer/utils/umdb';
import { CareerSessionRecord, RaceOption, RaceTrainingMetadata } from './types';

const SCENARIO_LABELS: Record<number, string> = {
  1: 'URA',
  2: '青春杯',
  3: '巅峰杯',
  4: '偶像杯',
  5: '荣耀女神杯',
  6: '凯旋门',
};
const resolveCardLabel = (cardId?: number) => {
  if (!cardId) return '未知马娘';
  const charaId = Math.floor(cardId / 100);
  return (
    UMDB.charas?.[charaId]?.name ||
    UMDB.cards?.[cardId]?.name ||
    '未知马娘'
  );
};
const resolveScenarioLabel = (scenarioId?: number) =>
  (scenarioId ? SCENARIO_LABELS[scenarioId] : undefined) || '未知剧本';

const rankLabel = (rank?: number | null) =>
  rank == null
    ? '未知'
    : ['—', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'][rank] || '未知';
const GRADES: Record<number, string> = {
  100: 'GI',
  200: 'GII',
  300: 'GIII',
  400: 'OP',
  700: 'PRE-OP',
  800: '未胜利',
  900: '出道',
  1000: 'EX',
};
const DISTANCES: Record<string, string> = {
  short: '短距离',
  mile: '英里',
  middle: '中距离',
  long: '长距离',
};
const gradeLabel = (grade?: number) => GRADES[grade || 0] || '级别未知';
const percent = (count: number, total: number) =>
  total ? `${((count / total) * 100).toFixed(1)}%` : '—';

export function aggregateRaceJewels(
  records: CareerSessionRecord[],
  byFeatures = false,
) {
  const rows = new Map<
    string,
    {
      key: string;
      programId: number;
      turn: number;
      raceName: string;
      source: string;
      races: number;
      drops: number;
      jewels: number;
      unknown: number;
      wins: number;
      knownRanks: number;
      winningDrops: number;
      knownWinningRewards: number;
      metadata?: RaceTrainingMetadata;
      aptitudeSamples: number;
    }
  >();
  const seen = new Set<string>();
  const seenRaces = new Set<string>();
  let missingRuns = 0;
  let unattributedJewels = 0;
  records.forEach((record) => {
    const runs = [
      ...(record.runs || []),
      ...(record.current ? [record.current] : []),
    ];
    runs.forEach((run) => {
      const runKey = `${record.uid}:${run.run_id || `${record.id}:${run.started_at}`}`;
      const sliceKey = `${record.id}:${runKey}`;
      if (seen.has(sliceKey)) return;
      seen.add(sliceKey);
      unattributedJewels += run.unattributed_jewels || 0;
      const races = run.g123_race_records || [];
      if (!races.length && (run.completed || run.discarded)) missingRuns += 1;
      races.forEach((race) => {
        if (!(race.program_id > 0)) return;
        const source = race.source || 'online';
        const meta = race.metadata;
        const raceKey = `${source}:${race.program_id}:${race.turn}`;
        const featureKey = JSON.stringify([
          source,
          meta?.card_id,
          meta?.scenario_id,
          meta?.grade,
          meta?.ground,
          meta?.distance_type,
          meta?.ground_aptitude,
          meta?.distance_aptitude,
          meta?.aptitude_source,
          meta?.consecutive_races_before,
          meta?.history_complete,
          meta?.is_goal_race,
          meta?.goal_source,
        ]);
        const key = byFeatures ? featureKey : raceKey;
        const occurrenceKey = `${runKey}:${raceKey}`;
        if (seenRaces.has(occurrenceKey)) return;
        seenRaces.add(occurrenceKey);
        const row = rows.get(key) || {
          key,
          programId: race.program_id,
          turn: race.turn,
          raceName: race.race_name || '',
          source,
          races: 0,
          drops: 0,
          jewels: 0,
          unknown: 0,
          wins: 0,
          knownRanks: 0,
          winningDrops: 0,
          knownWinningRewards: 0,
          metadata: meta,
          aptitudeSamples: 0,
        };
        row.races += 1;
        if (race.rank != null && race.rank > 0) {
          row.knownRanks += 1;
          row.wins += race.rank === 1 ? 1 : 0;
        }
        if (meta?.ground_aptitude != null && meta?.distance_aptitude != null)
          row.aptitudeSamples += 1;
        if (race.jewel_amount == null) {
          row.unknown += 1;
        } else {
          row.drops += race.jewel_amount > 0 ? 1 : 0;
          row.jewels += race.jewel_amount;
          if (race.rank === 1) {
            row.knownWinningRewards += 1;
            row.winningDrops += race.jewel_amount > 0 ? 1 : 0;
          }
        }
        rows.set(key, row);
      });
    });
  });
  return {
    missingRuns,
    unattributedJewels,
    rows: [...rows.values()].sort(
      (a, b) =>
        a.turn - b.turn ||
        a.programId - b.programId ||
        a.source.localeCompare(b.source),
    ),
  };
}

function RaceJewelStats({
  records,
  races,
}: {
  records: CareerSessionRecord[];
  races: RaceOption[];
}) {
  const [byFeatures, setByFeatures] = useState(false);
  const stats = useMemo(
    () => aggregateRaceJewels(records, byFeatures),
    [byFeatures, records],
  );
  const { raceByProgramTurn, raceByProgram } = useMemo(() => {
    const byTurn = new Map<string, RaceOption>();
    const byProgram = new Map<number, RaceOption>();
    races.forEach((item) => {
      byTurn.set(`${item.program_id}:${item.turn}`, item);
      if (!byProgram.has(item.program_id)) byProgram.set(item.program_id, item);
    });
    return { raceByProgramTurn: byTurn, raceByProgram: byProgram };
  }, [races]);
  return (
    <div className="p-3 sm:p-5">
      <h3 className="text-section font-semibold text-slate-900">
        比赛胜率与钻石掉落统计
      </h3>
      <p className="mt-1.5 text-caption text-slate-500">
        仅统计名次或奖励已知的场次（含 0 钻），每场最多计 1 次掉落。
      </p>
      <label className="mt-3 flex items-center gap-2 text-caption">
        <input
          type="checkbox"
          checked={byFeatures}
          onChange={(event) => setByFeatures(event.target.checked)}
        />
        按马娘、剧本、级别、适应性、连战和目标赛分组
      </label>
      {stats.missingRuns > 0 ? (
        <p className="mt-2 text-caption text-amber-700">
          {stats.missingRuns} 次育成缺少逐场记录，未计入下表。
        </p>
      ) : null}
      {stats.unattributedJewels > 0 ? (
        <p className="mt-2 text-caption text-amber-700">
          另有 {stats.unattributedJewels} 钻缺少对应的比赛明细，未计入逐场统计。
        </p>
      ) : null}
      {stats.rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table
            className="w-full text-left text-data"
            aria-label="比赛钻石掉落统计"
          >
            <thead className="border-b border-slate-200 text-caption text-slate-500">
              <tr>
                <th scope="col" className="py-3 pr-2 font-medium">
                  {byFeatures ? '样本条件' : '比赛'}
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  掉落次数
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  参赛次数
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap py-3 pl-2 text-right font-medium"
                >
                  掉落率
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  胜场／已知名次
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  胜率
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  胜利时掉钻率
                </th>
                <th
                  scope="col"
                  className="whitespace-nowrap px-2 py-3 text-right font-medium"
                >
                  平均每场钻石
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.rows.map((row) => {
                const race =
                  raceByProgramTurn.get(`${row.programId}:${row.turn}`) ||
                  raceByProgram.get(row.programId);
                return (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      className="py-3 pr-2 font-medium text-slate-800"
                    >
                      {byFeatures
                        ? `${resolveCardLabel(row.metadata?.card_id)} · ${resolveScenarioLabel(row.metadata?.scenario_id)} · ${gradeLabel(row.metadata?.grade)}`
                        : race?.name || row.raceName || '未知比赛'}
                      <span className="mt-1 block text-caption font-normal text-slate-500">
                        {row.source === 'offline' ? '离线' : '在线'} ·{' '}
                        {byFeatures
                          ? `${row.metadata?.ground === 'turf' ? '草地' : row.metadata?.ground === 'dirt' ? '泥地' : '场地未知'} ${rankLabel(row.metadata?.ground_aptitude)} / ${DISTANCES[row.metadata?.distance_type || ''] || '距离未知'} ${rankLabel(row.metadata?.distance_aptitude)}`
                          : row.turn > 0
                            ? `第 ${row.turn} 回合`
                            : '回合未知'}
                        {!byFeatures && race?.date ? ` · ${race.date}` : ''}
                      </span>
                      {byFeatures ? (
                        <span className="block text-caption font-normal text-slate-500">
                          此前连战{' '}
                          {row.metadata?.consecutive_races_before ?? '未知'} 场
                          {row.metadata?.history_complete !== true
                            ? '（日志完整性未确认）'
                            : ''}
                          {' · '}
                          {row.metadata?.is_goal_race == null
                            ? '目标赛未知'
                            : row.metadata.is_goal_race
                              ? '目标赛'
                              : '非目标赛'}
                        </span>
                      ) : null}
                      <span className="block text-caption font-normal text-slate-500">
                        比赛时适应性已记录：{row.aptitudeSamples}/{row.races}
                      </span>
                      {row.unknown > 0 ? (
                        <span className="block text-caption font-normal text-amber-700">
                          {row.unknown} 场奖励明细缺失
                        </span>
                      ) : null}
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums text-violet-700">
                      {row.unknown ? `≥${row.drops}` : row.drops}
                      <span className="block whitespace-nowrap text-caption text-slate-500">
                        {row.unknown ? '≥' : ''}
                        {row.jewels} 钻
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {row.races}
                    </td>
                    <td className="py-3 pl-2 text-right tabular-nums font-semibold text-violet-700">
                      {percent(row.drops, row.races - row.unknown)}
                      <span className="block text-caption font-normal text-slate-500">
                        {row.races - row.unknown} 场有效
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {row.wins}/{row.knownRanks}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {percent(row.wins, row.knownRanks)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {percent(row.winningDrops, row.knownWinningRewards)}
                      <span className="block text-caption text-slate-500">
                        {row.knownWinningRewards} 场有效
                      </span>
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {row.races > row.unknown
                        ? (row.jewels / (row.races - row.unknown)).toFixed(2)
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-10 text-center text-data text-slate-500">
          暂无逐场比赛记录
        </p>
      )}
    </div>
  );
}

export default memo(RaceJewelStats);
