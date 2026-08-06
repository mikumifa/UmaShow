/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  BarChart3,
  Copy,
  RefreshCw,
} from 'lucide-react';
import RacePageLayout, {
  raceHeaderButtonClass,
} from 'renderer/components/RacePageLayout';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import { finalGradeLabel } from 'renderer/utils/finalGrade';
import * as UMDatabaseUtils from 'umdb/UMDatabaseUtils';

type LeaderboardTeamMember = {
  team_member_id?: number;
  trained_chara_id?: number;
  card_id?: number;
  final_grade?: number;
  rarity?: number;
  talent_level?: number;
  race_cloth_id?: number;
  running_style?: number;
  [key: string]: unknown;
};

type LeaderboardSuccessionChara = {
  position_id?: number;
  card_id?: number;
  rank?: number;
  rarity?: number;
  talent_level?: number;
  owner_viewer_id?: string | number;
  [key: string]: unknown;
};

type LeaderboardCharaDetail = {
  key: string;
  viewer_id?: string | number;
  trained_chara_id?: string | number;
  card_id?: number;
  owner_viewer_id?: string | number;
  succession_chara_array: LeaderboardSuccessionChara[];
  updatedAt: number;
};

type LeaderboardRankingEntry = {
  rank: number;
  league_score?: number;
  viewer_id?: string | number;
  snapshot_id?: string | number;
  team_name?: string;
  team_member_array: LeaderboardTeamMember[];
  rankingKey?: string;
  [key: string]: unknown;
};

type LeaderboardRankingSnapshot = {
  version: number;
  updatedAt: number;
  source: string;
  rankings: Record<string, LeaderboardRankingEntry[]>;
  details?: Record<string, LeaderboardCharaDetail>;
};

type LineupMember = {
  key: string;
  viewerId?: string | number;
  trainedCharaId?: string | number;
  cardId?: number;
  charaId?: number;
  raceClothId?: number;
  runningStyle?: number;
  finalGrade?: number;
  rarity?: number;
};

type LineupOccurrence = {
  key: string;
  entry: LeaderboardRankingEntry;
  rank: number;
  score?: number;
  maxGrade: number;
  avgGrade: number;
  members: LineupMember[];
};

type LineupRow = {
  key: string;
  label: string;
  members: LineupMember[];
  occurrences: LineupOccurrence[];
  count: number;
  bestRank: number;
  avgRank: number;
  maxGrade: number;
  avgGrade: number;
  topCounts: Record<number, number>;
  topRates: Record<number, number>;
};

type SortKey = 'top50' | 'top100' | 'top150' | 'bestRank' | 'avgRank' | 'count';
type RankingSortKey = 'rank' | 'score' | 'avgGrade';
type SortDirection = 'asc' | 'desc';
type SortState = { key: SortKey; direction: SortDirection };
type RankingSortState = { key: RankingSortKey; direction: SortDirection };
type ActiveTab = 'lineups' | 'horses' | 'rankings';

const TOP_BUCKETS = [50, 100, 150];
const MAX_RANK = 300;
const DEFAULT_SORT: SortState = { key: 'top50', direction: 'desc' };
const DEFAULT_RANKING_SORT: RankingSortState = {
  key: 'rank',
  direction: 'asc',
};
const SUCCESSION_POSITION_LABELS: Record<number, string> = {
  10: '父辈1',
  11: '祖父辈1',
  12: '祖母1',
  20: '父辈2',
  21: '祖父辈2',
  22: '祖母2',
};
const SUCCESSION_POSITION_ORDER = [10, 11, 12, 20, 21, 22];

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function detailKey(viewerId: unknown, trainedCharaId: unknown) {
  if (viewerId == null || trainedCharaId == null) return undefined;
  return `${String(viewerId)}:${String(trainedCharaId)}`;
}

function copyText(value: string | number | undefined) {
  if (value == null) return;
  navigator.clipboard?.writeText(String(value)).catch(() => undefined);
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function averageGradeLabel(value: number | undefined) {
  if (value == null || !Number.isFinite(value)) return '-';
  const baseGrade = Math.floor(value);
  const decimal = value - baseGrade;
  const baseLabel = finalGradeLabel(baseGrade);
  if (baseLabel === '-' || baseLabel.startsWith('Grade ')) {
    return value.toFixed(1);
  }
  return `${baseLabel}${decimal.toFixed(1).slice(1)}`;
}

function averageMemberGrade(members: LineupMember[]) {
  const grades = members
    .map((member) => member.finalGrade)
    .filter((value): value is number => value != null);
  if (grades.length === 0) return undefined;
  return grades.reduce((sum, value) => sum + value, 0) / grades.length;
}

function runningStyleLabel(value?: number) {
  if (value == null) return '-';
  return (
    UMDatabaseUtils.runningStyleLabels[
      value as keyof typeof UMDatabaseUtils.runningStyleLabels
    ] ?? `跑法${value}`
  );
}

function charaIdFromCardId(cardId?: number) {
  if (cardId == null || !Number.isFinite(cardId)) return undefined;
  return Math.floor(cardId / 100);
}

function memberName(member: LineupMember) {
  if (member.charaId != null && UMDB.charas[member.charaId]?.name) {
    return UMDB.charas[member.charaId].name;
  }
  if (member.cardId != null && UMDB.cards[member.cardId]?.name) {
    return UMDB.cards[member.cardId].name;
  }
  return `Card ${member.cardId ?? '-'}`;
}

function memberIconPath(member: LineupMember) {
  if (member.charaId == null || member.raceClothId == null) return undefined;
  return `trained_chr_icon/${member.charaId}_${member.raceClothId}.png`;
}

function normalizeMembers(entry: LeaderboardRankingEntry): LineupMember[] {
  return (entry.team_member_array ?? [])
    .map((member, index) => {
      const viewerId = entry.viewer_id;
      const trainedCharaId = numberValue(member.trained_chara_id);
      const cardId = numberValue(member.card_id);
      const raceClothId = numberValue(member.race_cloth_id) ?? cardId;
      const charaId = charaIdFromCardId(cardId ?? raceClothId);
      const runningStyle = numberValue(member.running_style);
      const finalGrade = numberValue(member.final_grade);
      const rarity = numberValue(member.rarity);
      return {
        key: `${cardId ?? raceClothId ?? index}:${runningStyle ?? '-'}`,
        viewerId,
        trainedCharaId,
        cardId,
        charaId,
        raceClothId,
        runningStyle,
        finalGrade,
        rarity,
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function lineupKey(members: LineupMember[]) {
  return members.map((member) => member.key).join('|');
}

function lineupLabel(members: LineupMember[]) {
  return members
    .map(
      (member) =>
        `${memberName(member)}(${runningStyleLabel(member.runningStyle)})`,
    )
    .join(' / ');
}

function entryKey(entry: LeaderboardRankingEntry) {
  return `${entry.rank}-${String(entry.snapshot_id ?? entry.viewer_id ?? entry.rankingKey ?? '')}`;
}

function mergedRankingEntries(snapshot: LeaderboardRankingSnapshot | null) {
  const byRank = new Map<number, LeaderboardRankingEntry>();
  Object.entries(snapshot?.rankings ?? {}).forEach(([rankingKey, rows]) => {
    rows.forEach((entry) => {
      const rank = numberValue(entry.rank);
      if (rank == null || rank <= 0 || rank > 300 || byRank.has(rank)) return;
      byRank.set(rank, {
        ...entry,
        rank,
        rankingKey: entry.rankingKey ?? rankingKey,
      });
    });
  });
  return [...byRank.values()].sort((left, right) => left.rank - right.rank);
}

function buildLineups(entries: LeaderboardRankingEntry[]): LineupRow[] {
  const denominators = Object.fromEntries(
    TOP_BUCKETS.map((bucket) => [bucket, Math.min(bucket, entries.length)]),
  ) as Record<number, number>;
  const map = new Map<string, LineupRow>();

  entries.forEach((entry) => {
    const rank = numberValue(entry.rank);
    if (rank == null || rank <= 0) return;
    const members = normalizeMembers(entry);
    if (members.length === 0) return;

    const grades = members
      .map((member) => member.finalGrade)
      .filter((value): value is number => value != null);
    const maxGrade = grades.length > 0 ? Math.max(...grades) : 0;
    const avgGrade =
      grades.length > 0
        ? grades.reduce((sum, value) => sum + value, 0) / grades.length
        : 0;
    const key = lineupKey(members);
    const occurrence: LineupOccurrence = {
      key: entryKey(entry),
      entry,
      rank,
      score: numberValue(entry.league_score),
      maxGrade,
      avgGrade,
      members,
    };

    const row =
      map.get(key) ??
      ({
        key,
        label: lineupLabel(members),
        members,
        occurrences: [],
        count: 0,
        bestRank: Number.POSITIVE_INFINITY,
        avgRank: 0,
        maxGrade: 0,
        avgGrade: 0,
        topCounts: Object.fromEntries(TOP_BUCKETS.map((bucket) => [bucket, 0])),
        topRates: Object.fromEntries(TOP_BUCKETS.map((bucket) => [bucket, 0])),
      } as LineupRow);

    row.occurrences.push(occurrence);
    map.set(key, row);
  });

  return Array.from(map.values()).map((row) => {
    row.occurrences.sort((left, right) => left.rank - right.rank);
    row.count = row.occurrences.length;
    row.bestRank = Math.min(...row.occurrences.map((item) => item.rank));
    row.avgRank =
      row.occurrences.reduce((sum, item) => sum + item.rank, 0) / row.count;
    row.maxGrade = Math.max(...row.occurrences.map((item) => item.maxGrade));
    row.avgGrade =
      row.occurrences.reduce((sum, item) => sum + item.avgGrade, 0) / row.count;
    TOP_BUCKETS.forEach((bucket) => {
      row.topCounts[bucket] = row.occurrences.filter(
        (item) => item.rank <= bucket,
      ).length;
      row.topRates[bucket] = denominators[bucket]
        ? row.topCounts[bucket] / denominators[bucket]
        : 0;
    });
    return row;
  });
}

function buildHorseRows(entries: LeaderboardRankingEntry[]): LineupRow[] {
  const denominators = Object.fromEntries(
    TOP_BUCKETS.map((bucket) => [bucket, Math.min(bucket, entries.length)]),
  ) as Record<number, number>;
  const map = new Map<string, LineupRow>();

  entries.forEach((entry) => {
    const rank = numberValue(entry.rank);
    if (rank == null || rank <= 0) return;
    const members = normalizeMembers(entry);
    if (members.length === 0) return;

    members.forEach((member) => {
      const { finalGrade, key } = member;
      const grade = finalGrade ?? 0;
      const occurrence: LineupOccurrence = {
        key: `${entryKey(entry)}-${key}`,
        entry,
        rank,
        score: numberValue(entry.league_score),
        maxGrade: grade,
        avgGrade: grade,
        members: [member],
      };

      const row =
        map.get(key) ??
        ({
          key,
          label: lineupLabel([member]),
          members: [member],
          occurrences: [],
          count: 0,
          bestRank: Number.POSITIVE_INFINITY,
          avgRank: 0,
          maxGrade: 0,
          avgGrade: 0,
          topCounts: Object.fromEntries(
            TOP_BUCKETS.map((bucket) => [bucket, 0]),
          ),
          topRates: Object.fromEntries(
            TOP_BUCKETS.map((bucket) => [bucket, 0]),
          ),
        } as LineupRow);

      row.occurrences.push(occurrence);
      map.set(key, row);
    });
  });

  return Array.from(map.values()).map((row) => {
    row.occurrences.sort((left, right) => left.rank - right.rank);
    row.count = row.occurrences.length;
    row.bestRank = Math.min(...row.occurrences.map((item) => item.rank));
    row.avgRank =
      row.occurrences.reduce((sum, item) => sum + item.rank, 0) / row.count;
    row.maxGrade = Math.max(...row.occurrences.map((item) => item.maxGrade));
    row.avgGrade =
      row.occurrences.reduce((sum, item) => sum + item.avgGrade, 0) / row.count;
    TOP_BUCKETS.forEach((bucket) => {
      row.topCounts[bucket] = row.occurrences.filter(
        (item) => item.rank <= bucket,
      ).length;
      row.topRates[bucket] = denominators[bucket]
        ? row.topCounts[bucket] / denominators[bucket]
        : 0;
    });
    return row;
  });
}

function sortValue(row: LineupRow, key: SortKey) {
  if (key === 'top50') return row.topRates[50];
  if (key === 'top100') return row.topRates[100];
  if (key === 'top150') return row.topRates[150];
  if (key === 'bestRank') return row.bestRank;
  if (key === 'avgRank') return row.avgRank;
  return row.count;
}

function sortLineups(rows: LineupRow[], sortState: SortState) {
  return [...rows].sort((left, right) => {
    const direction = sortState.direction === 'asc' ? 1 : -1;
    const primary =
      (sortValue(left, sortState.key) - sortValue(right, sortState.key)) *
      direction;
    return (
      primary || left.bestRank - right.bestRank || right.count - left.count
    );
  });
}

function rankingSortValue(entry: LeaderboardRankingEntry, key: RankingSortKey) {
  if (key === 'rank') {
    return numberValue(entry.rank) ?? Number.POSITIVE_INFINITY;
  }
  if (key === 'score') return numberValue(entry.league_score) ?? 0;
  return averageMemberGrade(normalizeMembers(entry)) ?? 0;
}

function sortRankingEntries(
  rows: LeaderboardRankingEntry[],
  sortState: RankingSortState,
) {
  return [...rows].sort((left, right) => {
    const direction = sortState.direction === 'asc' ? 1 : -1;
    const primary =
      (rankingSortValue(left, sortState.key) -
        rankingSortValue(right, sortState.key)) *
      direction;
    return primary || left.rank - right.rank;
  });
}

function MemberAvatar({ member }: { member: LineupMember }) {
  const iconPath = memberIconPath(member);
  return (
    <div className="h-9 w-9 flex-none overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200">
      {iconPath ? (
        <AssetIcon
          path={iconPath}
          alt={memberName(member)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full rounded-full bg-gray-200" />
      )}
    </div>
  );
}

function MemberCompact({
  member,
  showGrade = true,
  details,
}: {
  member: LineupMember;
  showGrade?: boolean;
  details?: Record<string, LeaderboardCharaDetail>;
}) {
  const memberDetailKey = detailKey(member.viewerId, member.trainedCharaId);
  const hasDetail = !!details?.[memberDetailKey ?? ''];
  return (
    <div
      className="flex min-w-[180px] items-center gap-2 rounded bg-gray-50 px-2 py-1"
      title={`${memberName(member)} · ${runningStyleLabel(member.runningStyle)}${showGrade ? ` · ${finalGradeLabel(member.finalGrade)}` : ''}`}
    >
      <MemberAvatar member={member} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-800">
          {memberName(member)}
        </div>
        <div className="truncate text-xs text-gray-500">
          {runningStyleLabel(member.runningStyle)}
          {showGrade ? ` · ${finalGradeLabel(member.finalGrade)}` : ''}
          {hasDetail ? (
            <span className="ml-1 rounded bg-emerald-100 px-1 font-medium text-emerald-700">
              详
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const tension = 0.18;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    commands.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return commands.join(' ');
}

function RankDistributionSparkline({ row }: { row: LineupRow }) {
  const bucketSize = 10;
  const bucketCount = MAX_RANK / bucketSize;
  const buckets = Array.from({ length: bucketCount }, () => 0);
  row.occurrences.forEach((occurrence) => {
    const index = Math.max(
      0,
      Math.min(bucketCount - 1, Math.floor((occurrence.rank - 1) / bucketSize)),
    );
    buckets[index] += 1;
  });
  const maxCount = Math.max(1, ...buckets);
  const width = 300;
  const height = 22;
  const paddingX = 2;
  const paddingY = 3;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;
  const points = buckets.map((count, index) => {
    const x = paddingX + (innerWidth * index) / (bucketCount - 1);
    const y = paddingY + innerHeight - (count / maxCount) * innerHeight;
    return { count, x, y };
  });
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;
  const bucketTitle = buckets
    .map((count, index) => {
      const start = index * bucketSize + 1;
      const end = start + bucketSize - 1;
      return count > 0 ? `${start}-${end}: ${count}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const rankTitle = row.occurrences
    .map(
      (occurrence) => `#${occurrence.rank} ${occurrence.entry.team_name ?? ''}`,
    )
    .join('\n');
  const title = [bucketTitle, rankTitle].filter(Boolean).join('\n\n');

  return (
    <div className="w-[220px] max-w-[260px]" title={title}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[22px] w-full rounded bg-gray-50 ring-1 ring-gray-200"
        preserveAspectRatio="none"
      >
        <line x1="2" y1="0" x2="2" y2={height} stroke="#c7d2fe" />
        <line
          x1={width / 2}
          y1="0"
          x2={width / 2}
          y2={height}
          stroke="#e5e7eb"
        />
        <line
          x1={width - 2}
          y1="0"
          x2={width - 2}
          y2={height}
          stroke="#e5e7eb"
        />
        <path d={areaPath} fill="#c7d2fe" opacity="0.35" />
        <path
          d={linePath}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-0.5 flex justify-between text-[9px] leading-none text-gray-400">
        <span className="font-mono">1</span>
        <span className="font-mono">150</span>
        <span className="font-mono">300</span>
      </div>
    </div>
  );
}

function MemberChip({
  member,
  showGrade = true,
  details,
}: {
  member: LineupMember;
  showGrade?: boolean;
  details?: Record<string, LeaderboardCharaDetail>;
}) {
  const memberDetailKey = detailKey(member.viewerId, member.trainedCharaId);
  const hasDetail = !!details?.[memberDetailKey ?? ''];
  return (
    <div className="flex min-w-[220px] items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1.5">
      <MemberAvatar member={member} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-800">
          {memberName(member)}
        </div>
        <div className="text-xs text-gray-500">
          {runningStyleLabel(member.runningStyle)}
          {showGrade ? ` · ${finalGradeLabel(member.finalGrade)}` : ''}
          {hasDetail ? (
            <span className="ml-1 rounded bg-emerald-100 px-1 font-medium text-emerald-700">
              详
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Tabs({
  activeTab,
  onChange,
}: {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'lineups', label: '阵容统计' },
    { id: 'horses', label: '单马统计' },
    { id: 'rankings', label: '排名表' },
  ];

  return (
    <div className="border-b border-gray-200 px-3">
      <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150 ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function SortHeader<TSortKey extends string>({
  label,
  sortKey,
  sortState,
  onSort,
}: {
  label: string;
  sortKey: TSortKey;
  sortState: { key: TSortKey; direction: SortDirection };
  onSort: (sortKey: TSortKey) => void;
}) {
  const active = sortState.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`ml-auto flex items-center justify-end gap-1 rounded px-1 py-0.5 transition-colors ${
        active ? 'text-indigo-600' : 'hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      <span>{label}</span>
      {active ? (
        sortState.direction === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : null}
    </button>
  );
}

function SuccessionDetail({
  member,
  details,
}: {
  member: LineupMember;
  details: Record<string, LeaderboardCharaDetail>;
}) {
  const memberDetailKey = detailKey(member.viewerId, member.trainedCharaId);
  const detail = details[memberDetailKey ?? ''];
  if (!detail) return null;

  const successionByPosition = new Map(
    detail.succession_chara_array.map((item) => [
      numberValue(item.position_id),
      item,
    ]),
  );

  return (
    <div className="rounded border border-emerald-100 bg-emerald-50/40 p-2">
      <div className="mb-2 flex items-center gap-2">
        <MemberAvatar member={member} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-800">
            {memberName(member)}
          </div>
          <div className="truncate text-xs text-gray-500">
            {runningStyleLabel(member.runningStyle)} · 有详细信息
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        {SUCCESSION_POSITION_ORDER.map((positionId) => {
          const item = successionByPosition.get(positionId);
          if (!item) return null;
          const successionMember: LineupMember = {
            key: `${item.card_id ?? positionId}:${positionId}`,
            cardId: numberValue(item.card_id),
            raceClothId: numberValue(item.card_id),
            charaId: charaIdFromCardId(numberValue(item.card_id)),
            rarity: numberValue(item.rarity),
          };
          const ownerViewerId = item.owner_viewer_id;

          return (
            <div
              key={positionId}
              className="flex items-center gap-2 rounded bg-white px-2 py-1 text-xs"
            >
              <div className="w-12 flex-none text-gray-500">
                {SUCCESSION_POSITION_LABELS[positionId]}
              </div>
              <MemberAvatar member={successionMember} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-800">
                  {memberName(successionMember)}
                </div>
                <div className="truncate font-mono text-gray-500">
                  owner_viewer_id: {ownerViewerId ?? '-'}
                </div>
              </div>
              {ownerViewerId != null ? (
                <button
                  type="button"
                  className="flex h-7 w-7 flex-none items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  title="复制 owner_viewer_id"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyText(ownerViewerId);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuccessionDetails({
  members,
  details,
}: {
  members: LineupMember[];
  details: Record<string, LeaderboardCharaDetail>;
}) {
  const membersWithDetails = members.filter(
    (member) =>
      details[detailKey(member.viewerId, member.trainedCharaId) ?? ''],
  );
  if (membersWithDetails.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-gray-500">继承详细</div>
      {membersWithDetails.map((member) => (
        <SuccessionDetail
          key={`${String(member.viewerId)}-${String(member.trainedCharaId)}`}
          member={member}
          details={details}
        />
      ))}
    </div>
  );
}

export default function LeaderboardAnalysis() {
  const [snapshot, setSnapshot] = useState<LeaderboardRankingSnapshot | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);
  const [rankingSortState, setRankingSortState] =
    useState<RankingSortState>(DEFAULT_RANKING_SORT);
  const [activeTab, setActiveTab] = useState<ActiveTab>('lineups');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);

  const loadLatest = () => {
    return window.electron.leaderboardRanking
      .latest()
      .then((data) => {
        setSnapshot(data ?? null);
        setReady(true);
        return undefined;
      })
      .catch(() => {
        setReady(true);
      });
  };

  useEffect(() => {
    loadUMDB()
      .then(() => loadLatest())
      .catch(() => loadLatest());
    const remove = window.electron.leaderboardRanking.onNew(
      (data: LeaderboardRankingSnapshot) => {
        setSnapshot(data);
      },
    );
    return () => remove?.();
  }, []);

  const entries = useMemo(() => mergedRankingEntries(snapshot), [snapshot]);
  const lineups = useMemo(() => buildLineups(entries), [entries]);
  const horseRows = useMemo(() => buildHorseRows(entries), [entries]);
  const visibleLineups = useMemo(
    () => sortLineups(lineups, sortState),
    [lineups, sortState],
  );
  const visibleHorseRows = useMemo(
    () => sortLineups(horseRows, sortState),
    [horseRows, sortState],
  );
  const visibleEntries = useMemo(
    () => sortRankingEntries(entries, rankingSortState),
    [entries, rankingSortState],
  );
  const statsRows = activeTab === 'horses' ? visibleHorseRows : visibleLineups;
  const allStatsRows = activeTab === 'horses' ? horseRows : lineups;

  const selectedStatsRow =
    statsRows.find((row) => row.key === selectedKey) ??
    allStatsRows.find((row) => row.key === selectedKey) ??
    statsRows[0];
  const selectedLineup =
    visibleLineups.find((row) => row.key === selectedKey) ??
    lineups.find((row) => row.key === selectedKey) ??
    visibleLineups[0];
  const selectedEntry =
    entries.find((entry) => entryKey(entry) === selectedEntryKey) ?? null;
  const details = snapshot?.details ?? {};
  const detailMembers = selectedEntry
    ? normalizeMembers(selectedEntry)
    : (selectedStatsRow?.members ?? []);

  useEffect(() => {
    if (statsRows.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !statsRows.some((row) => row.key === selectedKey)) {
      setSelectedKey(statsRows[0].key);
    }
  }, [selectedKey, statsRows]);

  const handleSort = (key: SortKey) => {
    setSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'desc' ? 'asc' : 'desc',
        };
      }
      return {
        key,
        direction: key === 'bestRank' || key === 'avgRank' ? 'asc' : 'desc',
      };
    });
  };

  const handleRankingSort = (key: RankingSortKey) => {
    setRankingSortState((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'desc' ? 'asc' : 'desc',
        };
      }
      return {
        key,
        direction: key === 'rank' ? 'asc' : 'desc',
      };
    });
  };

  const renderStatsTable = (
    rows: LineupRow[],
    nameLabel: string,
    emptyLabel: string,
  ) => (
    <div className="h-full overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold text-gray-500">
          <tr>
            <th className="px-3 py-2">{nameLabel}</th>
            <th className="px-3 py-2">分布</th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="Top50"
                sortKey="top50"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="Top100"
                sortKey="top100"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="Top150"
                sortKey="top150"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="最好"
                sortKey="bestRank"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="均名"
                sortKey="avgRank"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="总数"
                sortKey="count"
                sortState={sortState}
                onSort={handleSort}
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={() => {
                setSelectedKey(row.key);
                setSelectedEntryKey(null);
              }}
              className={`cursor-pointer hover:bg-indigo-50 ${selectedStatsRow?.key === row.key ? 'bg-indigo-50' : ''}`}
            >
              <td className="min-w-[220px] px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {row.members.map((member) => (
                    <MemberCompact
                      key={member.key}
                      member={member}
                      showGrade={false}
                      details={details}
                    />
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 align-middle">
                <RankDistributionSparkline row={row} />
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                {pct(row.topRates[50])}
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                {pct(row.topRates[100])}
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                {pct(row.topRates[150])}
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                #{row.bestRank}
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                {row.avgRank.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                {row.count}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10 text-center text-gray-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRankingTable = () => (
    <div className="h-full overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50 text-xs font-semibold text-gray-500">
          <tr>
            <th className="px-3 py-2">
              <SortHeader
                label="名次"
                sortKey="rank"
                sortState={rankingSortState}
                onSort={handleRankingSort}
              />
            </th>
            <th className="px-3 py-2">队伍</th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="分数"
                sortKey="score"
                sortState={rankingSortState}
                onSort={handleRankingSort}
              />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader
                label="平均评价"
                sortKey="avgGrade"
                sortState={rankingSortState}
                onSort={handleRankingSort}
              />
            </th>
            <th className="px-3 py-2">阵容</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visibleEntries.map((entry) => {
            const members = normalizeMembers(entry);
            const key = lineupKey(members);
            const avgGrade = averageMemberGrade(members);
            return (
              <tr
                key={entryKey(entry)}
                onClick={() => {
                  setSelectedKey(key);
                  setSelectedEntryKey(entryKey(entry));
                }}
                className={`cursor-pointer hover:bg-amber-50 ${selectedLineup?.key === key ? 'bg-indigo-50' : ''}`}
              >
                <td className="px-3 py-2 font-mono text-base font-semibold tabular-nums">
                  #{entry.rank}
                </td>
                <td className="min-w-[160px] px-3 py-2 text-gray-700">
                  {entry.team_name ?? '-'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                  {entry.league_score ?? '-'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-base font-semibold tabular-nums">
                  {averageGradeLabel(avgGrade)}
                </td>
                <td className="min-w-[620px] px-3 py-2 text-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => (
                      <MemberCompact
                        key={member.key}
                        member={member}
                        details={details}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                没有符合筛选的排名。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <RacePageLayout
      title="LOH"
      description={
        snapshot
          ? `阵容分析 · 最新快照 ${new Date(snapshot.updatedAt).toLocaleString()} · 已合并 ${entries.length} 条榜单记录`
          : '等待抓取 LOH 排行榜包后显示阵容表现'
      }
      icon={<BarChart3 className="h-5 w-5 text-indigo-600" />}
      actions={
        <button
          type="button"
          className={raceHeaderButtonClass}
          onClick={loadLatest}
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      }
    >
      {!ready ? (
        <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-500">
          加载中...
        </div>
      ) : !snapshot || entries.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white p-6 text-sm text-gray-600">
          还没有排行榜数据。打开游戏排行榜后，debug 模式会保留最近 50
          个包，页面会自动读取最新榜单。
        </div>
      ) : (
        <div className="grid h-[calc(100vh-150px)] min-h-[520px] gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="min-h-0 min-w-0">
            <div className="flex h-full flex-col overflow-hidden rounded border border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-gray-200 pr-3">
                <Tabs activeTab={activeTab} onChange={setActiveTab} />
                <div className="flex-none text-xs text-gray-500">
                  {lineups.length} 个阵容 · {horseRows.length} 个单马 ·{' '}
                  {entries.length} 条排名
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === 'rankings'
                  ? renderRankingTable()
                  : renderStatsTable(
                      activeTab === 'horses'
                        ? visibleHorseRows
                        : visibleLineups,
                      activeTab === 'horses' ? '单马' : '阵容',
                      activeTab === 'horses'
                        ? '没有单马统计数据。'
                        : '没有阵容统计数据。',
                    )}
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="max-h-[42%] flex-none overflow-auto rounded border border-gray-200 bg-white p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                {activeTab === 'horses' ? '单马详情' : '阵容详情'}
              </div>
              {selectedStatsRow ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-800">
                    {selectedStatsRow.label}
                  </div>
                  <div className="grid gap-2">
                    {selectedStatsRow.members.map((member) => (
                      <MemberChip
                        key={member.key}
                        member={member}
                        showGrade={false}
                        details={details}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">最好名次</div>
                      <div className="font-mono text-lg font-semibold text-gray-800">
                        #{selectedStatsRow.bestRank}
                      </div>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">平均名次</div>
                      <div className="font-mono text-lg font-semibold text-gray-800">
                        {selectedStatsRow.avgRank.toFixed(1)}
                      </div>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">平均评价</div>
                      <div className="font-mono text-lg font-semibold text-gray-800">
                        {averageGradeLabel(selectedStatsRow.avgGrade)}
                      </div>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-xs text-gray-500">最高单马评价</div>
                      <div className="font-mono text-lg font-semibold text-gray-800">
                        {finalGradeLabel(selectedStatsRow.maxGrade)}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    {TOP_BUCKETS.map((bucket) => (
                      <div
                        key={bucket}
                        className="flex items-center justify-between rounded bg-gray-50 px-2 py-1"
                      >
                        <span className="text-gray-600">Top{bucket}</span>
                        <span className="font-mono font-semibold text-gray-800">
                          {selectedStatsRow.topCounts[bucket]} ·{' '}
                          {pct(selectedStatsRow.topRates[bucket])}
                        </span>
                      </div>
                    ))}
                  </div>
                  <SuccessionDetails
                    members={detailMembers}
                    details={details}
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-500">没有统计数据。</div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700">
                <ArrowDownWideNarrow className="h-4 w-4 text-indigo-600" />
                出现记录
              </div>
              <div className="min-h-0 flex-1 overflow-auto divide-y divide-gray-100">
                {selectedStatsRow?.occurrences.map((occurrence) => (
                  <div key={occurrence.key} className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="font-mono text-sm font-semibold text-gray-800">
                        #{occurrence.rank}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {occurrence.entry.team_name ?? '-'}
                      </div>
                    </div>
                    <div className="grid gap-1 text-xs text-gray-600">
                      {occurrence.members.map((member) => {
                        const memberDetailKey = detailKey(
                          member.viewerId,
                          member.trainedCharaId,
                        );
                        const hasDetail = !!details[memberDetailKey ?? ''];
                        return (
                          <div
                            key={member.key}
                            className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <MemberAvatar member={member} />
                              <span className="truncate">
                                {memberName(member)}
                                {hasDetail ? (
                                  <span className="ml-1 rounded bg-emerald-100 px-1 font-medium text-emerald-700">
                                    详
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <span className="flex-none font-mono">
                              {runningStyleLabel(member.runningStyle)} ·{' '}
                              {finalGradeLabel(member.finalGrade)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </RacePageLayout>
  );
}
