import { useState } from 'react';
import rankings from 'renderer/data/race_planner_rankings.json';
import {
  PlannerButton,
  PlannerFactorList,
  PlannerPortrait,
} from 'renderer/components/succession/PlannerComponents';
import { SuccessionPickerDialog } from 'renderer/components/succession/SuccessionPicker';
import type { ScheduleInput } from 'renderer/utils/raceScheduleOptimizer';

type Objective = ScheduleInput['objective'];
type Entry = (typeof rankings.rankings.fans)[number];
const OBJECTIVES = {
  jewels: '期望掉钻',
  fans: '期望粉丝',
  wins: '期望 GI／剧本胜场',
};
const FACTORS: Record<string, string> = {
  turf: '草地',
  dirt: '泥地',
  short: '短距离',
  mile: '英里',
  middle: '中距离',
  long: '长距离',
};

export default function RacePlannerLeaderboard({
  objective,
  fanBonus,
  onObjectiveChange,
  onSelect,
  onClose,
}: {
  objective: Objective;
  fanBonus: number;
  onObjectiveChange: (value: Objective) => void;
  onSelect: (entry: Entry) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const entries = rankings.rankings[objective];
  const fanScale = (1 + fanBonus / 100) / (1 + rankings.fanBonus / 100);
  const matches = entries
    .map((entry, index) => ({ entry, rank: index + 1 }))
    .filter(
      ({ entry }) =>
        entry.name.includes(search.trim()) ||
        String(entry.charaId).includes(search.trim()),
    );
  return (
    <SuccessionPickerDialog
      ariaLabel="赛程排行榜"
      title="赛程排行榜"
      onClose={onClose}
      searchValue={search}
      searchPlaceholder="搜索马娘名称或 ID"
      searchAriaLabel="搜索排行榜马娘"
      onSearchChange={setSearch}
      bodyClassName="min-h-0 overflow-y-auto p-4 sm:p-5"
      meta={
        <span>
          荣耀女神杯 · 参考胜率 · 粉丝加成 {fanBonus}% · 1.10 修正 ·{' '}
          {entries.length} 位
        </span>
      }
    >
      <div
        role="group"
        aria-label="排行榜优化目标"
        className="mb-4 flex flex-wrap gap-2"
      >
        {Object.entries(OBJECTIVES).map(([value, label]) => (
          <PlannerButton
            key={value}
            size="small"
            variant={objective === value ? 'primary' : 'secondary'}
            aria-pressed={objective === value}
            onClick={() => onObjectiveChange(value as Objective)}
          >
            {label}
          </PlannerButton>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-data" aria-label="马娘赛程排名">
          <thead className="border-b border-slate-200 text-caption text-slate-500">
            <tr>
              {[
                '排名',
                '马娘',
                OBJECTIVES[objective],
                ...(objective === 'fans' ? [] : ['期望粉丝']),
                '推荐红因子',
                '',
              ].map((label) => (
                <th key={label} className="whitespace-nowrap p-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matches.map(({ entry, rank }) => (
              <tr key={entry.charaId}>
                <td className="p-3 font-semibold tabular-nums">{rank}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <PlannerPortrait
                      path={`chr_icon/${entry.charaId}.png`}
                      alt={entry.name}
                    />
                    <strong>{entry.name}</strong>
                  </div>
                </td>
                <td className="p-3 font-semibold tabular-nums">
                  {objective === 'fans'
                    ? Math.round(entry.expectedFans * fanScale).toLocaleString()
                    : (objective === 'wins'
                        ? entry.expectedWins
                        : entry.expectedDrops
                      ).toFixed(2)}
                </td>
                {objective !== 'fans' ? (
                  <td className="p-3 font-semibold tabular-nums">
                    {Math.round(entry.expectedFans * fanScale).toLocaleString()}
                  </td>
                ) : null}
                <td className="min-w-40 p-3">
                  {entry.demands.length ? (
                    <PlannerFactorList
                      factors={entry.demands.map((demand) => ({
                        id: demand.type,
                        name: FACTORS[demand.type],
                        stars: demand.stars,
                        tone: 'aptitude',
                      }))}
                    />
                  ) : (
                    <span className="text-slate-500">无需改造</span>
                  )}
                </td>
                <td className="p-3">
                  <PlannerButton
                    size="small"
                    variant="secondary"
                    aria-label={`使用${entry.name}的排名方案`}
                    onClick={() => onSelect(entry)}
                  >
                    使用方案
                  </PlannerButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!matches.length ? (
          <p className="p-6 text-center text-slate-500">没有符合条件的马娘</p>
        ) : null}
      </div>
    </SuccessionPickerDialog>
  );
}
