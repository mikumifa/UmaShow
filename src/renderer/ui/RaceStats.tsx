import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RaceArchive, RaceHorseInfo, RaceRecord } from 'types/gameTypes';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import * as UMDatabaseUtils from 'umdb/UMDatabaseUtils';

type HorseStatusItem = {
  label: string;
  value: string | number;
};

type HorseProperGroup = {
  label: string;
  items: HorseStatusItem[];
};

type HorseSummaryData = {
  key: string;
  name: string;
  trainerName: string;
  status: HorseStatusItem[];
  properGroups: HorseProperGroup[];
  finalHpTotal: number;
  finalHpCount: number;
  winFinalHpTotal: number;
  winFinalHpCount: number;
  iconPath?: string;
};

type HorseEntry = {
  identityKey: string;
  typeKey: string;
  summary: HorseSummaryData;
  finalHp?: number;
  isWin: boolean;
};

type StatRow = {
  key: string;
  label: string;
  horses: HorseSummaryData[];
  wins: number;
  total: number;
  winRate: number;
};

type StatConfig = {
  key: 'single' | 'double' | 'triple';
  title: string;
  size: number;
};

const statConfigs: StatConfig[] = [
  { key: 'single', title: '单马', size: 1 },
  { key: 'double', title: '双马组合', size: 2 },
  { key: 'triple', title: '三马组合', size: 3 },
];

const iconUrlCache = new Map<string, Promise<string | null>>();
const fallbackArchives: RaceArchive[] = [
  {
    id: 'default',
    name: '默认',
    createdAt: 0,
  },
];

function numberValue(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function horseField(horse: RaceHorseInfo, field: string): unknown {
  return horse[field];
}

function resolveFrameOrder(horse: RaceHorseInfo, fallbackIndex: number) {
  const frameOrder = numberValue(horseField(horse, 'frame_order'));
  if (frameOrder != null && frameOrder > 0) return frameOrder - 1;

  const rank = numberValue(horseField(horse, 'rank'));
  return rank != null && rank > 0 ? rank - 1 : fallbackIndex;
}

function getHorseWinFromFields(horse: RaceHorseInfo): boolean {
  const rank =
    numberValue(horseField(horse, 'rank')) ??
    numberValue(horseField(horse, 'result_rank')) ??
    numberValue(horseField(horse, 'final_rank'));
  return rank === 1;
}

function getHorseLabel(horse: RaceHorseInfo) {
  const charaId = numberValue(horseField(horse, 'chara_id'));
  const cardId = numberValue(horseField(horse, 'card_id'));
  const charaName = charaId != null ? UMDB.charas[charaId]?.name : undefined;
  const cardName = cardId != null ? UMDB.cards[cardId]?.name : undefined;

  if (charaName && cardName) return `${charaName} / ${cardName}`;
  if (charaName) return charaName;
  if (cardName) return cardName;

  const singleModeCharaId = numberValue(
    horseField(horse, 'single_mode_chara_id'),
  );
  return `Unknown ${singleModeCharaId ?? cardId ?? charaId ?? '-'}`;
}

function properRank(value: unknown) {
  const rank = numberValue(value);
  return rank == null ? '-' : (UMDatabaseUtils.charaProperLabels[rank] ?? '-');
}

function getHorseStatusItems(horse: RaceHorseInfo): HorseStatusItem[] {
  return [
    { label: '速', value: numberValue(horseField(horse, 'speed')) ?? '-' },
    { label: '耐', value: numberValue(horseField(horse, 'stamina')) ?? '-' },
    {
      label: '力',
      value:
        numberValue(horseField(horse, 'pow')) ??
        numberValue(horseField(horse, 'power')) ??
        '-',
    },
    { label: '根', value: numberValue(horseField(horse, 'guts')) ?? '-' },
    { label: '智', value: numberValue(horseField(horse, 'wiz')) ?? '-' },
  ];
}

function getHorseProperGroups(horse: RaceHorseInfo): HorseProperGroup[] {
  return [
    {
      label: '距',
      items: [
        {
          label: '短',
          value: properRank(horseField(horse, 'proper_distance_short')),
        },
        {
          label: '英',
          value: properRank(horseField(horse, 'proper_distance_mile')),
        },
        {
          label: '中',
          value: properRank(horseField(horse, 'proper_distance_middle')),
        },
        {
          label: '长',
          value: properRank(horseField(horse, 'proper_distance_long')),
        },
      ],
    },
    {
      label: '脚',
      items: [
        {
          label: '逃',
          value: properRank(horseField(horse, 'proper_running_style_nige')),
        },
        {
          label: '先',
          value: properRank(horseField(horse, 'proper_running_style_senko')),
        },
        {
          label: '差',
          value: properRank(horseField(horse, 'proper_running_style_sashi')),
        },
        {
          label: '追',
          value: properRank(horseField(horse, 'proper_running_style_oikomi')),
        },
      ],
    },
    {
      label: '场',
      items: [
        {
          label: '草',
          value: properRank(horseField(horse, 'proper_ground_turf')),
        },
        {
          label: '泥',
          value: properRank(horseField(horse, 'proper_ground_dirt')),
        },
      ],
    },
  ];
}

function getHorseIconPath(charaId?: number, raceDressId?: number) {
  if (charaId == null || raceDressId == null) return undefined;
  return `trained_chr_icon/${charaId}_${raceDressId}.png`;
}

function getHorseSummary(
  horse: RaceHorseInfo,
  identityKey: string,
  charaId?: number,
  raceDressId?: number,
): HorseSummaryData {
  return {
    key: identityKey,
    name: getHorseLabel(horse),
    trainerName: String(
      horseField(horse, 'owner_trainer_name') ||
        horseField(horse, 'trainer_name'),
    ),
    status: getHorseStatusItems(horse),
    properGroups: getHorseProperGroups(horse),
    finalHpTotal: 0,
    finalHpCount: 0,
    winFinalHpTotal: 0,
    winFinalHpCount: 0,
    iconPath: getHorseIconPath(charaId, raceDressId),
  };
}

function getHorseEntries(item: RaceRecord): HorseEntry[] {
  if (!Array.isArray(item.horses) || item.horses.length === 0) return [];

  let finishOrderByFrame = new Map<number, number>();
  let finalHpByFrame = new Map<number, number>();
  if (item.scenario) {
    try {
      const raceData = deserializeFromBase64(item.scenario.trim());
      finishOrderByFrame = new Map(
        raceData.horseResult.map((result, frameOrder) => [
          frameOrder,
          result.finishOrder ?? -1,
        ]),
      );
      const lastFrame = raceData.frame[raceData.frame.length - 1];
      finalHpByFrame = new Map(
        (lastFrame?.horseFrame ?? []).map((horseFrame, frameOrder) => [
          frameOrder,
          horseFrame.hp ?? 0,
        ]),
      );
    } catch {
      finishOrderByFrame = new Map<number, number>();
      finalHpByFrame = new Map<number, number>();
    }
  }

  return item.horses.flatMap((horse, index) => {
    const viewerId =
      numberValue(horseField(horse, 'viewer_id')) ??
      numberValue(horseField(horse, 'owner_viewer_id'));
    const trainedCharaId = numberValue(horseField(horse, 'trained_chara_id'));
    const charaId = numberValue(horseField(horse, 'chara_id'));
    const cardId = numberValue(horseField(horse, 'card_id')) ?? trainedCharaId;
    const raceDressId = numberValue(horseField(horse, 'race_dress_id'));

    if (viewerId == null || trainedCharaId == null) return [];

    const frameOrder = resolveFrameOrder(horse, index);
    const finishOrder = finishOrderByFrame.get(frameOrder);
    const finalHp = finalHpByFrame.get(frameOrder);
    const identityKey = `${viewerId}|${trainedCharaId}`;

    return [
      {
        identityKey,
        typeKey: `${charaId ?? 'unknown'}|${cardId ?? trainedCharaId}`,
        summary: getHorseSummary(horse, identityKey, charaId, raceDressId),
        finalHp,
        isWin: finishOrder === 0 || getHorseWinFromFields(horse),
      },
    ];
  });
}

function combineEntries(entries: HorseEntry[], size: number) {
  const results: HorseEntry[][] = [];

  const walk = (start: number, selected: HorseEntry[]) => {
    if (selected.length === size) {
      results.push(selected);
      return;
    }

    for (let i = start; i < entries.length; i += 1) {
      walk(i + 1, [...selected, entries[i]]);
    }
  };

  walk(0, []);
  return results;
}

function hasDistinctHorseTypes(entries: HorseEntry[]) {
  return new Set(entries.map((entry) => entry.typeKey)).size === entries.length;
}

function rowLabel(entries: HorseEntry[]) {
  return entries.map((entry) => entry.summary.name).join(' + ');
}

function toSortedRows(stats: Map<string, StatRow>) {
  return [...stats.values()]
    .map((row) => ({
      ...row,
      winRate: row.total > 0 ? row.wins / row.total : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total);
}

function buildStatsForSize(items: RaceRecord[], size: number) {
  const stats = new Map<string, StatRow>();

  items.forEach((item) => {
    const entries = getHorseEntries(item);
    const combinations = combineEntries(entries, size).filter(
      hasDistinctHorseTypes,
    );

    combinations.forEach((combination) => {
      const sorted = [...combination].sort((a, b) =>
        a.identityKey.localeCompare(b.identityKey),
      );
      const key = sorted.map((entry) => entry.identityKey).join(' + ');
      const isWin = sorted.some((entry) => entry.isWin);
      const row = stats.get(key) ?? {
        key,
        label: rowLabel(sorted),
        horses: sorted.map((entry) => ({ ...entry.summary })),
        wins: 0,
        total: 0,
        winRate: 0,
      };

      row.total += 1;
      if (isWin) {
        row.wins += 1;
      }
      sorted.forEach((entry, index) => {
        if (entry.finalHp == null) return;
        const horse = row.horses[index];
        horse.finalHpTotal += entry.finalHp;
        horse.finalHpCount += 1;
        if (isWin) {
          horse.winFinalHpTotal += entry.finalHp;
          horse.winFinalHpCount += 1;
        }
      });
      stats.set(key, row);
    });
  });

  return toSortedRows(stats);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function average(total: number, count: number) {
  return count > 0 ? total / count : undefined;
}

function hpText(value: number | undefined) {
  return value == null ? '-' : Math.round(value).toString();
}

function valueTone(value: string | number) {
  if (typeof value === 'number') return 'text-blue-700';

  return (
    {
      S: 'text-yellow-700',
      A: 'text-orange-600',
      B: 'text-amber-600',
      C: 'text-lime-700',
      D: 'text-emerald-700',
      E: 'text-cyan-700',
      F: 'text-sky-700',
      G: 'text-gray-500',
    }[value] ?? 'text-gray-700'
  );
}

function valueBadgeTone(value: string | number) {
  return value === 'S'
    ? 'bg-yellow-300 text-yellow-900 ring-1 ring-yellow-500'
    : '';
}

function getIconUrl(path: string) {
  const cached = iconUrlCache.get(path);
  if (cached) return cached;

  const promise = window.electron.utils.getFile(path) as Promise<string | null>;
  iconUrlCache.set(path, promise);
  return promise;
}

function HorseIcon({ path, name }: { path?: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!path) {
      setUrl(null);
      return () => {
        mounted = false;
      };
    }

    getIconUrl(path)
      .then((value) => {
        if (mounted) setUrl(value);
        return undefined;
      })
      .catch(() => {
        if (mounted) setUrl(null);
      });

    return () => {
      mounted = false;
    };
  }, [path]);

  if (!url) {
    return (
      <div className="w-14 h-14 rounded-md bg-gray-100 border border-gray-200 shrink-0" />
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="w-14 h-14 rounded-md border border-gray-200 bg-gray-100 object-cover shrink-0"
    />
  );
}

function StatPill({ item }: { item: HorseStatusItem }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5">
      <span className="text-gray-500">{item.label}</span>
      <span
        className={`rounded px-1 font-mono font-semibold ${valueTone(
          item.value,
        )} ${valueBadgeTone(item.value)}`}
      >
        {item.value}
      </span>
    </span>
  );
}

function HorseSummary({
  horse,
  groupSize,
}: {
  horse: HorseSummaryData;
  groupSize: number;
}) {
  let widthClass = 'min-w-[280px] max-w-[360px]';
  if (groupSize === 1) {
    widthClass = 'min-w-[520px] max-w-[820px] flex-1';
  } else if (groupSize === 2) {
    widthClass = 'min-w-[360px] max-w-[520px] flex-1';
  }

  return (
    <div
      className={`${widthClass} rounded-md border border-gray-200 bg-white p-2`}
    >
      <div className="flex gap-2">
        <HorseIcon path={horse.iconPath} name={horse.name} />
        <div className="min-w-0 flex-1">
          <div
            className="font-medium text-gray-900 truncate"
            title={horse.name}
          >
            {horse.name}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {horse.trainerName || '-'}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {horse.status.map((item) => (
              <StatPill key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs">
        {horse.properGroups.map((group) => (
          <div key={group.label} className="flex items-center gap-1.5">
            <span className="w-4 text-gray-400">{group.label}</span>
            <div className="flex flex-wrap gap-1">
              {group.items.map((item) => (
                <StatPill key={`${group.label}-${item.label}`} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
        <div className="rounded bg-violet-50 px-2 py-1">
          <div className="text-gray-500">平均HP</div>
          <div className="font-mono font-bold text-violet-700">
            {hpText(average(horse.finalHpTotal, horse.finalHpCount))}
          </div>
        </div>
        <div className="rounded bg-fuchsia-50 px-2 py-1">
          <div className="text-gray-500">胜场HP</div>
          <div className="font-mono font-bold text-fuchsia-700">
            {hpText(average(horse.winFinalHpTotal, horse.winFinalHpCount))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTable({ rows }: { rows: StatRow[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium">对象</th>
              <th className="px-3 py-2 text-right font-medium">胜率</th>
              <th className="px-3 py-2 text-right font-medium">胜/场</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.key} className="align-top hover:bg-gray-50">
                <td className="px-3 py-3 text-gray-700">
                  <div className="flex flex-wrap gap-2" title={row.label}>
                    {row.horses.map((horse) => (
                      <HorseSummary
                        key={horse.key}
                        horse={horse}
                        groupSize={row.horses.length}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="font-mono text-base font-bold text-blue-700">
                    {percent(row.winRate)}
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  <span className="font-semibold text-emerald-700">
                    {row.wins}
                  </span>
                  <span className="text-gray-400">/</span>
                  <span className="text-gray-600">{row.total}</span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  className="px-3 py-10 text-center text-gray-400"
                  colSpan={3}
                >
                  暂无可统计数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RaceStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialArchiveId =
    (location.state as { archiveId?: string } | null)?.archiveId ?? 'default';
  const [items, setItems] = useState<RaceRecord[]>([]);
  const [archives, setArchives] = useState<RaceArchive[]>([]);
  const [activeArchiveId] = useState(initialArchiveId);
  const [umdbReady, setUmdbReady] = useState(false);
  const [activeConfig, setActiveConfig] = useState<StatConfig['key']>('single');
  const active = statConfigs.find((config) => config.key === activeConfig)!;
  const rows = useMemo(
    () => (umdbReady ? buildStatsForSize(items, active.size) : []),
    [active.size, items, umdbReady],
  );

  useEffect(() => {
    window.electron.race
      .archives()
      .then((config) => {
        setArchives(config.archives ?? []);
        return undefined;
      })
      .catch(() => {
        setArchives(fallbackArchives);
      });
    loadUMDB()
      .then(() => setUmdbReady(true))
      .catch(() => setUmdbReady(true));
  }, []);

  useEffect(() => {
    window.electron.race
      .list(activeArchiveId)
      .then((list) => {
        setItems((list ?? []) as any[]);
        return undefined;
      })
      .catch(() => setItems([]));
  }, [activeArchiveId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 pb-4 border-b border-gray-200 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-gray-800 font-semibold text-lg">
              <BarChart3 size={20} />
              比赛统计
            </div>
            <p className="text-gray-500 text-sm mt-1 ml-1">
              按单马、双马组合、三马组合查看胜率
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate('/races', {
                state: { archiveId: activeArchiveId },
              })
            }
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft size={16} />
            返回记录
          </button>
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {statConfigs.map((config) => (
            <button
              key={config.key}
              type="button"
              onClick={() => setActiveConfig(config.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeConfig === config.key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {config.title}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <span>
            统计存档：
            {archives.find((archive) => archive.id === activeArchiveId)?.name ??
              '默认'}
          </span>
          <span>共 {rows.length} 个统计对象，按胜率和样本数排序</span>
        </div>

        <StatTable rows={rows} />
      </div>
    </div>
  );
}
