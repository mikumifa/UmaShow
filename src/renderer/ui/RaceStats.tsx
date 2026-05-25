import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpDown, BarChart3, RefreshCw, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useActivate } from 'react-activation';
import { RaceArchive, RaceHorseInfo, RaceRecord } from 'types/gameTypes';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import * as UMDatabaseUtils from 'umdb/UMDatabaseUtils';
import { RaceSimulateEventData_SimulateEventType } from 'umdb/race_data_pb';
import { getCharaActivatedSkillIds } from 'umdb/RaceDataUtils';
import { CharaSkill, fromRaceHorseData } from 'umdb/TrainedCharaData';

type HorseStatusItem = {
  label: string;
  value: string | number;
};

type HorseProperGroup = {
  label: string;
  items: HorseStatusItem[];
};

type ProcStatAccumulator = {
  key: string;
  label: string;
  totalCount: number;
  triggeredCount: number;
  winCount: number;
  winTriggeredCount: number;
};

type ProcStatRow = ProcStatAccumulator & {
  triggerRate: number;
  winTriggerRate: number;
  winRateLift?: number;
  informationGain?: number;
};

type SkillStatRow = ProcStatRow & {
  skillId: number;
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
  appearances: number;
  winAppearances: number;
  procStats: ProcStatRow[];
  skillStats: SkillStatRow[];
  iconPath?: string;
};

type HorseEntry = {
  identityKey: string;
  typeKey: string;
  summary: HorseSummaryData;
  finalHp?: number;
  finishRank?: number;
  isWin: boolean;
  trainedSkills: CharaSkill[];
  activatedSkillIds: Set<number>;
  activatedEventTypes: Set<number>;
};

type MutableHorseSummary = Omit<HorseSummaryData, 'procStats' | 'skillStats'> & {
  procStatMap: Map<string, ProcStatAccumulator>;
  skillStatMap: Map<number, SkillStatRow>;
};

type StatRow = {
  key: string;
  label: string;
  horses: HorseSummaryData[];
  wins: number;
  top2: number;
  top3: number;
  total: number;
  winRate: number;
  top2Rate: number;
  top3Rate: number;
};

type StatConfig = {
  key: 'single' | 'double' | 'triple' | 'detail';
  title: string;
  size: number;
};

type ProcStatDefinition = {
  key: string;
  label: string;
  matches: (entry: HorseEntry) => boolean;
};

type ArchiveStatsBundle = {
  rowsBySize: Record<StatConfig['key'], StatRow[]>;
};

type StatsCachePayload = {
  archiveId: string;
  archiveUpdatedAt: number;
  cachedArchiveUpdatedAt: number;
  cacheUpdatedAt: number;
  version: number;
  data: ArchiveStatsBundle | null;
};

type SortDirection = 'asc' | 'desc';

type TableSort<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

const statConfigs: StatConfig[] = [
  { key: 'single', title: '单马', size: 1 },
  { key: 'double', title: '双马组合', size: 2 },
  { key: 'triple', title: '三马组合', size: 3 },
  { key: 'detail', title: '详细', size: 1 },
];

const fallbackArchives: RaceArchive[] = [
  {
    id: 'default',
    name: '默认',
    createdAt: 0,
  },
];

const STATS_CACHE_VERSION = 3;

const horseEventDefinitions: ProcStatDefinition[] = [
  {
    key: 'compete-fight',
    label: '追比',
    matches: (entry) =>
      entry.activatedEventTypes.has(
        RaceSimulateEventData_SimulateEventType.COMPETE_FIGHT,
      ),
  },
  {
    key: 'stamina-limit-break-buff',
    label: '空耐',
    matches: (entry) =>
      entry.activatedEventTypes.has(
        RaceSimulateEventData_SimulateEventType.STAMINA_LIMIT_BREAK_BUFF,
      ),
  },
];

const iconUrlCache = new Map<string, Promise<string | null>>();
const winRateLiftTooltip = '胜率提升 = P(胜利 | 发生) - P(胜利 | 未发生)';
const informationGainTooltip = '信息增益 = H(胜负) - H(胜负 | 事件是否发生)';

function emptyBundle(): ArchiveStatsBundle {
  return {
    rowsBySize: {
      single: [],
      double: [],
      triple: [],
      detail: [],
    },
  };
}

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
  return getHorseFinishRankFromFields(horse) === 1;
}

function getHorseFinishRankFromFields(horse: RaceHorseInfo): number | undefined {
  return (
    numberValue(horseField(horse, 'rank')) ??
    numberValue(horseField(horse, 'result_rank')) ??
    numberValue(horseField(horse, 'final_rank'))
  );
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

function getSkillOrigin(skillId: number): 'inherit' | 'base' | null {
  const skillIdText = String(skillId);
  if (skillIdText.startsWith('9')) {
    return 'inherit';
  }

  const baseSkillPrefix = skillIdText.slice(0, 6);
  if (baseSkillPrefix.startsWith('1')) {
    return 'base';
  }

  return null;
}

function getSkillDisplayLabel(skillId: number) {
  const skillName = UMDB.skillName(skillId);
  const origin = getSkillOrigin(skillId);
  if (origin === 'inherit') {
    return `[继承] ${skillName}`;
  }
  if (origin === 'base') {
    return `[本体] ${skillName}`;
  }
  return skillName;
}

function getSkillTag(skillId: number) {
  const origin = getSkillOrigin(skillId);
  if (origin === 'inherit') {
    return {
      label: '继承',
      className: 'bg-sky-100 text-sky-700 ring-1 ring-sky-200',
    };
  }
  if (origin === 'base') {
    return {
      label: '本体',
      className: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    };
  }
  return null;
}

function SkillNameCell({ skillId, label }: { skillId: number; label: string }) {
  const tag = getSkillTag(skillId);
  const plainLabel = label.replace(/^\[(继承|本体)\]\s*/, '');

  return (
    <div className="flex items-center gap-2">
      {tag && (
        <span
          className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tag.className}`}
        >
          {tag.label}
        </span>
      )}
      <span className="min-w-0 truncate">{plainLabel}</span>
    </div>
  );
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
    appearances: 0,
    winAppearances: 0,
    procStats: [],
    skillStats: [],
    iconPath: getHorseIconPath(charaId, raceDressId),
  };
}

function createMutableHorseSummary(summary: HorseSummaryData): MutableHorseSummary {
  return {
    ...summary,
    procStatMap: new Map(),
    skillStatMap: new Map(),
  };
}

function cloneMutableHorseSummary(summary: MutableHorseSummary): MutableHorseSummary {
  return {
    ...summary,
    status: [...summary.status],
    properGroups: summary.properGroups.map((group) => ({
      ...group,
      items: [...group.items],
    })),
    procStatMap: new Map(
      [...summary.procStatMap.entries()].map(([key, value]) => [key, { ...value }]),
    ),
    skillStatMap: new Map(
      [...summary.skillStatMap.entries()].map(([key, value]) => [key, { ...value }]),
    ),
  };
}

function createProcStatAccumulator(
  key: string,
  label: string,
): ProcStatAccumulator {
  return {
    key,
    label,
    totalCount: 0,
    triggeredCount: 0,
    winCount: 0,
    winTriggeredCount: 0,
  };
}

function bumpProcStat(
  stat: ProcStatAccumulator,
  triggered: boolean,
  isWin: boolean,
) {
  stat.totalCount += 1;
  if (triggered) stat.triggeredCount += 1;
  if (isWin) {
    stat.winCount += 1;
    if (triggered) stat.winTriggeredCount += 1;
  }
}

function finalizeProcStat<T extends ProcStatAccumulator>(stat: T): T & ProcStatRow {
  const nonTriggeredCount = stat.totalCount - stat.triggeredCount;
  const nonTriggeredWinCount = stat.winCount - stat.winTriggeredCount;
  const triggeredWinRate =
    stat.triggeredCount > 0 ? stat.winTriggeredCount / stat.triggeredCount : undefined;
  const nonTriggeredWinRate =
    nonTriggeredCount > 0 ? nonTriggeredWinCount / nonTriggeredCount : undefined;
  const totalWinRate = stat.totalCount > 0 ? stat.winCount / stat.totalCount : undefined;
  const totalEntropy =
    totalWinRate != null ? binaryEntropy(totalWinRate) : undefined;
  const triggeredEntropy =
    triggeredWinRate != null ? binaryEntropy(triggeredWinRate) : undefined;
  const nonTriggeredEntropy =
    nonTriggeredWinRate != null ? binaryEntropy(nonTriggeredWinRate) : undefined;
  const conditionalEntropy =
    totalEntropy != null
      ? (stat.triggeredCount / Math.max(stat.totalCount, 1)) *
          (triggeredEntropy ?? 0) +
        (nonTriggeredCount / Math.max(stat.totalCount, 1)) *
          (nonTriggeredEntropy ?? 0)
      : undefined;

  return {
    ...stat,
    triggerRate: stat.totalCount > 0 ? stat.triggeredCount / stat.totalCount : 0,
    winTriggerRate: stat.winCount > 0 ? stat.winTriggeredCount / stat.winCount : 0,
    winRateLift:
      triggeredWinRate != null && nonTriggeredWinRate != null
        ? triggeredWinRate - nonTriggeredWinRate
        : undefined,
    informationGain:
      totalEntropy != null && conditionalEntropy != null
        ? totalEntropy - conditionalEntropy
        : undefined,
  };
}

function getHorseEntries(item: RaceRecord): HorseEntry[] {
  if (!Array.isArray(item.horses) || item.horses.length === 0) return [];

  let finishOrderByFrame = new Map<number, number>();
  let finalHpByFrame = new Map<number, number>();
  let activatedSkillIdsByFrame = new Map<number, Set<number>>();
  let activatedEventTypesByFrame = new Map<number, Set<number>>();

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
      activatedSkillIdsByFrame = new Map(
        raceData.horseResult.map((_, frameOrder) => [
          frameOrder,
          getCharaActivatedSkillIds(raceData, frameOrder),
        ]),
      );
      activatedEventTypesByFrame = new Map(
        raceData.horseResult.map((_, frameOrder) => [
          frameOrder,
          new Set(
            raceData.event
              .map((eventWrapper) => eventWrapper.event)
              .filter(
                (event): event is NonNullable<typeof event> =>
                  !!event && event.param[0] === frameOrder,
              )
              .map((event) => event.type ?? -1),
          ),
        ]),
      );
    } catch {
      finishOrderByFrame = new Map<number, number>();
      finalHpByFrame = new Map<number, number>();
      activatedSkillIdsByFrame = new Map<number, Set<number>>();
      activatedEventTypesByFrame = new Map<number, Set<number>>();
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
    const finishRank =
      finishOrder != null ? finishOrder + 1 : getHorseFinishRankFromFields(horse);
    const finalHp = finalHpByFrame.get(frameOrder);
    const identityKey = `${viewerId}|${trainedCharaId}`;
    const trainedCharaData = fromRaceHorseData(horse, UMDB.skills);

    return [
      {
        identityKey,
        typeKey: `${charaId ?? 'unknown'}|${cardId ?? trainedCharaId}`,
        summary: getHorseSummary(horse, identityKey, charaId, raceDressId),
        finalHp,
        finishRank,
        isWin: finishRank === 1 || getHorseWinFromFields(horse),
        trainedSkills: trainedCharaData.skills,
        activatedSkillIds:
          activatedSkillIdsByFrame.get(frameOrder) ?? new Set<number>(),
        activatedEventTypes:
          activatedEventTypesByFrame.get(frameOrder) ?? new Set<number>(),
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

function finalizeHorseSummary(horse: MutableHorseSummary): HorseSummaryData {
  return {
    key: horse.key,
    name: horse.name,
    trainerName: horse.trainerName,
    status: horse.status,
    properGroups: horse.properGroups,
    finalHpTotal: horse.finalHpTotal,
    finalHpCount: horse.finalHpCount,
    winFinalHpTotal: horse.winFinalHpTotal,
    winFinalHpCount: horse.winFinalHpCount,
    appearances: horse.appearances,
    winAppearances: horse.winAppearances,
    procStats: [...horse.procStatMap.values()]
      .map((stat) => finalizeProcStat(stat))
      .sort(
        (a, b) =>
          b.triggerRate - a.triggerRate ||
          b.totalCount - a.totalCount ||
          a.label.localeCompare(b.label),
      ),
    skillStats: [...horse.skillStatMap.values()]
      .map((stat) => finalizeProcStat(stat))
      .sort(
        (a, b) =>
          b.triggerRate - a.triggerRate ||
          b.totalCount - a.totalCount ||
          a.label.localeCompare(b.label),
      ),
    iconPath: horse.iconPath,
  };
}

function buildDetailRows(items: RaceRecord[]) {
  const summaryByType = new Map<string, MutableHorseSummary>();
  const rowStatsByType = new Map<
    string,
    {
      wins: number;
      top2: number;
      top3: number;
      total: number;
    }
  >();
  let allHorseSummary: MutableHorseSummary | null = null;
  let allHorseWins = 0;
  let allHorseTop2 = 0;
  let allHorseTop3 = 0;
  let allHorseTotal = 0;

  items.forEach((item) => {
    const entries = getHorseEntries(item);
    entries.forEach((entry) => {
      const typeKey = entry.typeKey;
      const existingSummary =
        summaryByType.get(typeKey) ??
        createMutableHorseSummary({
          ...entry.summary,
          key: typeKey,
        });
      const existingRowStats = rowStatsByType.get(typeKey) ?? {
        wins: 0,
        top2: 0,
        top3: 0,
        total: 0,
      };

      existingSummary.appearances += 1;
      existingRowStats.total += 1;
      if ((entry.finishRank ?? Number.POSITIVE_INFINITY) <= 2) {
        existingRowStats.top2 += 1;
      }
      if ((entry.finishRank ?? Number.POSITIVE_INFINITY) <= 3) {
        existingRowStats.top3 += 1;
      }
      if (entry.isWin) {
        existingSummary.winAppearances += 1;
        existingRowStats.wins += 1;
      }

      horseEventDefinitions.forEach((definition) => {
        const stat =
          existingSummary.procStatMap.get(definition.key) ??
          createProcStatAccumulator(definition.key, definition.label);
        bumpProcStat(stat, definition.matches(entry), entry.isWin);
        existingSummary.procStatMap.set(definition.key, stat);
      });

      entry.trainedSkills.forEach((skill) => {
        const skillId = Number(skill.skillId);
        const stat = existingSummary.skillStatMap.get(skillId) ?? {
          ...createProcStatAccumulator(
            `skill-${skillId}`,
            getSkillDisplayLabel(skillId),
          ),
          skillId,
        };
        bumpProcStat(stat, entry.activatedSkillIds.has(skillId), entry.isWin);
        existingSummary.skillStatMap.set(skillId, stat);
      });

      if (entry.finalHp != null) {
        existingSummary.finalHpTotal += entry.finalHp;
        existingSummary.finalHpCount += 1;
        if (entry.isWin) {
          existingSummary.winFinalHpTotal += entry.finalHp;
          existingSummary.winFinalHpCount += 1;
        }
      }

      summaryByType.set(typeKey, existingSummary);
      rowStatsByType.set(typeKey, existingRowStats);

      if (!allHorseSummary) {
        allHorseSummary = createMutableHorseSummary({
          ...entry.summary,
          key: 'all-horses',
          name: '全部马',
          trainerName: '当前存档全部样本',
          iconPath: undefined,
        });
      }

      allHorseSummary.appearances += 1;
      allHorseTotal += 1;
      if ((entry.finishRank ?? Number.POSITIVE_INFINITY) <= 2) {
        allHorseTop2 += 1;
      }
      if ((entry.finishRank ?? Number.POSITIVE_INFINITY) <= 3) {
        allHorseTop3 += 1;
      }
      if (entry.isWin) {
        allHorseSummary.winAppearances += 1;
        allHorseWins += 1;
      }

      horseEventDefinitions.forEach((definition) => {
        const stat =
          allHorseSummary!.procStatMap.get(definition.key) ??
          createProcStatAccumulator(definition.key, definition.label);
        bumpProcStat(stat, definition.matches(entry), entry.isWin);
        allHorseSummary!.procStatMap.set(definition.key, stat);
      });

      entry.trainedSkills.forEach((skill) => {
        const skillId = Number(skill.skillId);
        const stat = allHorseSummary!.skillStatMap.get(skillId) ?? {
          ...createProcStatAccumulator(
            `skill-${skillId}`,
            getSkillDisplayLabel(skillId),
          ),
          skillId,
        };
        bumpProcStat(stat, entry.activatedSkillIds.has(skillId), entry.isWin);
        allHorseSummary!.skillStatMap.set(skillId, stat);
      });

      if (entry.finalHp != null) {
        allHorseSummary.finalHpTotal += entry.finalHp;
        allHorseSummary.finalHpCount += 1;
        if (entry.isWin) {
          allHorseSummary.winFinalHpTotal += entry.finalHp;
          allHorseSummary.winFinalHpCount += 1;
        }
      }
    });
  });

  const rows: StatRow[] = [...summaryByType.entries()]
    .map(([typeKey, summary]) => {
      const stats = rowStatsByType.get(typeKey)!;
      return {
        key: typeKey,
        label: summary.name,
        horses: [finalizeHorseSummary(summary)],
        wins: stats.wins,
        top2: stats.top2,
        top3: stats.top3,
        total: stats.total,
        winRate: stats.total > 0 ? stats.wins / stats.total : 0,
        top2Rate: stats.total > 0 ? stats.top2 / stats.total : 0,
        top3Rate: stats.total > 0 ? stats.top3 / stats.total : 0,
      };
    })
    .sort((a, b) => b.total - a.total || b.winRate - a.winRate);

  if (allHorseSummary) {
    rows.unshift({
      key: 'all-horses',
      label: '全部马',
      horses: [finalizeHorseSummary(allHorseSummary)],
      wins: allHorseWins,
      top2: allHorseTop2,
      top3: allHorseTop3,
      total: allHorseTotal,
      winRate: allHorseTotal > 0 ? allHorseWins / allHorseTotal : 0,
      top2Rate: allHorseTotal > 0 ? allHorseTop2 / allHorseTotal : 0,
      top3Rate: allHorseTotal > 0 ? allHorseTop3 / allHorseTotal : 0,
    });
  }

  return rows;
}

function buildStatsForSize(items: RaceRecord[], size: number) {
  const stats = new Map<string, Omit<StatRow, 'winRate'>>();

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
        horses: sorted.map((entry) => createMutableHorseSummary(entry.summary)),
        wins: 0,
        top2: 0,
        top3: 0,
        total: 0,
      };

      const hasTop2 = sorted.some(
        (entry) => (entry.finishRank ?? Number.POSITIVE_INFINITY) <= 2,
      );
      const hasTop3 = sorted.some(
        (entry) => (entry.finishRank ?? Number.POSITIVE_INFINITY) <= 3,
      );
      row.total += 1;
      if (isWin) row.wins += 1;
      if (hasTop2) row.top2 += 1;
      if (hasTop3) row.top3 += 1;

      sorted.forEach((entry, index) => {
        const horse = row.horses[index];
        horse.appearances += 1;
        if (isWin) {
          horse.winAppearances += 1;
        }

        horseEventDefinitions.forEach((definition) => {
          const stat =
            horse.procStatMap.get(definition.key) ??
            createProcStatAccumulator(definition.key, definition.label);
          bumpProcStat(stat, definition.matches(entry), isWin);
          horse.procStatMap.set(definition.key, stat);
        });

        entry.trainedSkills.forEach((skill) => {
          const skillId = Number(skill.skillId);
          const stat = horse.skillStatMap.get(skillId) ?? {
            ...createProcStatAccumulator(
              `skill-${skillId}`,
              getSkillDisplayLabel(skillId),
            ),
            skillId,
          };
          bumpProcStat(stat, entry.activatedSkillIds.has(skillId), isWin);
          horse.skillStatMap.set(skillId, stat);
        });

        if (entry.finalHp != null) {
          horse.finalHpTotal += entry.finalHp;
          horse.finalHpCount += 1;
          if (isWin) {
            horse.winFinalHpTotal += entry.finalHp;
            horse.winFinalHpCount += 1;
          }
        }
      });

      stats.set(key, row);
    });
  });

  return [...stats.values()]
    .map((row) => ({
      ...row,
      horses: row.horses.map((horse) => finalizeHorseSummary(horse)),
      winRate: row.total > 0 ? row.wins / row.total : 0,
      top2Rate: row.total > 0 ? row.top2 / row.total : 0,
      top3Rate: row.total > 0 ? row.top3 / row.total : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.total - a.total);
}

function buildArchiveStatsBundle(items: RaceRecord[]): ArchiveStatsBundle {
  return {
    rowsBySize: {
      single: buildStatsForSize(items, 1),
      double: buildStatsForSize(items, 2),
      triple: buildStatsForSize(items, 3),
      detail: buildDetailRows(items),
    },
  };
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number | undefined) {
  if (value == null) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatBits(value: number | undefined) {
  if (value == null) return '-';
  return value.toFixed(4);
}

function binaryEntropy(probability: number) {
  if (probability <= 0 || probability >= 1) return 0;
  return (
    -probability * Math.log2(probability) -
    (1 - probability) * Math.log2(1 - probability)
  );
}

function toRateText(numerator: number, denominator: number) {
  if (denominator <= 0) return '-';
  return `${numerator}/${denominator} = ${percent(numerator / denominator)}`;
}

function winRateLiftDetail(stat: Pick<
  ProcStatRow,
  'triggeredCount' | 'winTriggeredCount' | 'totalCount' | 'winCount' | 'winRateLift'
>) {
  const nonTriggeredCount = stat.totalCount - stat.triggeredCount;
  const nonTriggeredWinCount = stat.winCount - stat.winTriggeredCount;

  return [
    winRateLiftTooltip,
    `P(胜利 | 发生) = ${toRateText(stat.winTriggeredCount, stat.triggeredCount)}`,
    `P(胜利 | 未发生) = ${toRateText(nonTriggeredWinCount, nonTriggeredCount)}`,
    `胜率提升 = ${signedPercent(stat.winRateLift)}`,
  ].join('\n');
}

function entropyText(value: number | undefined) {
  if (value == null) return '-';
  return value.toFixed(4);
}

function informationGainDetail(stat: Pick<
  ProcStatRow,
  | 'triggeredCount'
  | 'winTriggeredCount'
  | 'totalCount'
  | 'winCount'
  | 'informationGain'
>) {
  const nonTriggeredCount = stat.totalCount - stat.triggeredCount;
  const nonTriggeredWinCount = stat.winCount - stat.winTriggeredCount;
  const totalWinRate = stat.totalCount > 0 ? stat.winCount / stat.totalCount : undefined;
  const triggeredWinRate =
    stat.triggeredCount > 0 ? stat.winTriggeredCount / stat.triggeredCount : undefined;
  const nonTriggeredWinRate =
    nonTriggeredCount > 0 ? nonTriggeredWinCount / nonTriggeredCount : undefined;
  const totalEntropy =
    totalWinRate != null ? binaryEntropy(totalWinRate) : undefined;
  const triggeredEntropy =
    triggeredWinRate != null ? binaryEntropy(triggeredWinRate) : undefined;
  const nonTriggeredEntropy =
    nonTriggeredWinRate != null ? binaryEntropy(nonTriggeredWinRate) : undefined;
  const conditionalEntropy =
    totalEntropy != null
      ? (stat.triggeredCount / Math.max(stat.totalCount, 1)) *
          (triggeredEntropy ?? 0) +
        (nonTriggeredCount / Math.max(stat.totalCount, 1)) *
          (nonTriggeredEntropy ?? 0)
      : undefined;

  return [
    informationGainTooltip,
    `H(胜负) = H(${toRateText(stat.winCount, stat.totalCount)}) = ${entropyText(totalEntropy)}`,
    `H(胜负 | 发生) = H(${toRateText(stat.winTriggeredCount, stat.triggeredCount)}) = ${entropyText(triggeredEntropy)}`,
    `H(胜负 | 未发生) = H(${toRateText(nonTriggeredWinCount, nonTriggeredCount)}) = ${entropyText(nonTriggeredEntropy)}`,
    `H(胜负 | 事件) = (${stat.triggeredCount}/${stat.totalCount}) * ${entropyText(triggeredEntropy)} + (${nonTriggeredCount}/${stat.totalCount}) * ${entropyText(nonTriggeredEntropy)} = ${entropyText(conditionalEntropy)}`,
    `信息增益 = ${entropyText(totalEntropy)} - ${entropyText(conditionalEntropy)} = ${formatBits(stat.informationGain)}`,
  ].join('\n');
}

function liftTone(value: number | undefined) {
  if (value == null || value === 0) return 'text-gray-500';
  return value > 0 ? 'text-emerald-700' : 'text-red-600';
}

function WinRateLiftValue({
  value,
  detail,
  className = '',
  withPrefix = false,
}: {
  value: number | undefined;
  detail?: string;
  className?: string;
  withPrefix?: boolean;
}) {
  return (
    <span
      className={`${liftTone(value)} ${className}`.trim()}
      title={detail ?? winRateLiftTooltip}
    >
      {withPrefix ? `提升 ${signedPercent(value)}` : signedPercent(value)}
    </span>
  );
}

function InformationGainValue({
  value,
  detail,
  className = '',
}: {
  value: number | undefined;
  detail?: string;
  className?: string;
}) {
  return (
    <span className={className} title={detail ?? informationGainTooltip}>
      {formatBits(value)}
    </span>
  );
}

function average(total: number, count: number) {
  return count > 0 ? total / count : undefined;
}

function hpText(value: number | undefined) {
  return value == null ? '-' : Math.round(value).toString();
}

function ratioText(numerator: number, denominator: number) {
  return `${numerator}/${denominator}`;
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

function compareValues(
  a: string | number | undefined,
  b: string | number | undefined,
  direction: SortDirection,
) {
  const modifier = direction === 'asc' ? 1 : -1;
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * modifier;
  }
  return String(a).localeCompare(String(b)) * modifier;
}

function sortRows(
  rows: StatRow[],
  sort: TableSort<'label' | 'winRate' | 'top2Rate' | 'top3Rate' | 'wins' | 'total'>,
) {
  return [...rows].sort((a, b) => {
    const value =
      sort.key === 'label'
        ? compareValues(a.label, b.label, sort.direction)
        : compareValues(a[sort.key], b[sort.key], sort.direction);
    if (value !== 0) return value;
    return compareValues(a.label, b.label, 'asc');
  });
}

function sortProcStats(
  rows: ProcStatRow[],
  sort: TableSort<
    'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
  >,
) {
  return [...rows].sort((a, b) => {
    const value =
      sort.key === 'label'
        ? compareValues(a.label, b.label, sort.direction)
        : compareValues(a[sort.key], b[sort.key], sort.direction);
    if (value !== 0) return value;
    return compareValues(a.label, b.label, 'asc');
  });
}

function sortSkillStats(
  rows: SkillStatRow[],
  sort: TableSort<
    'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
  >,
) {
  return [...rows].sort((a, b) => {
    const value =
      sort.key === 'label'
        ? compareValues(a.label, b.label, sort.direction)
        : compareValues(a[sort.key], b[sort.key], sort.direction);
    if (value !== 0) return value;
    return compareValues(a.label, b.label, 'asc');
  });
}

function SortHeader({
  label,
  active,
  onClick,
  align = 'left',
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: 'left' | 'right';
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 ${
        align === 'right' ? 'justify-end w-full' : ''
      }`}
    >
      <span>{label}</span>
      <ArrowUpDown
        size={13}
        className={active ? 'text-blue-600' : 'text-gray-400'}
      />
    </button>
  );
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
      <div className="h-14 w-14 shrink-0 rounded-md border border-gray-200 bg-gray-100" />
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="h-14 w-14 shrink-0 rounded-md border border-gray-200 bg-gray-100 object-cover"
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
  onClick,
}: {
  horse: HorseSummaryData;
  groupSize: number;
  onClick: () => void;
}) {
  let widthClass = 'min-w-[280px] max-w-[360px]';
  if (groupSize === 1) {
    widthClass = 'min-w-[520px] max-w-[820px] flex-1';
  } else if (groupSize === 2) {
    widthClass = 'min-w-[360px] max-w-[520px] flex-1';
  } else if (groupSize === 3) {
    widthClass = 'w-[300px] min-w-[300px] max-w-[300px] shrink-0';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${widthClass} rounded-md border border-gray-200 bg-white p-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/30`}
    >
      <div className="flex gap-2">
        <HorseIcon path={horse.iconPath} name={horse.name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900" title={horse.name}>
            {horse.name}
          </div>
          <div className="truncate text-xs text-gray-500">
            {horse.trainerName || '-'}
          </div>
          <div className="mt-1 text-[11px] text-blue-600">
            {horse.appearances} 场 / 胜场 {horse.winAppearances}
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
    </button>
  );
}

function StatTable({
  rows,
  sort,
  onSort,
  onHorseClick,
  showTopRates,
}: {
  rows: StatRow[];
  sort: TableSort<'label' | 'winRate' | 'top2Rate' | 'top3Rate' | 'wins' | 'total'>;
  onSort: (
    key: 'label' | 'winRate' | 'top2Rate' | 'top3Rate' | 'wins' | 'total',
  ) => void;
  onHorseClick: (horse: HorseSummaryData) => void;
  showTopRates: boolean;
}) {
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const emptyColSpan = showTopRates ? 6 : 4;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">
                <SortHeader
                  label="对象"
                  active={sort.key === 'label'}
                  onClick={() => onSort('label')}
                />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <SortHeader
                  label="胜率"
                  active={sort.key === 'winRate'}
                  onClick={() => onSort('winRate')}
                  align="right"
                />
              </th>
              {showTopRates && (
                <>
                  <th className="px-3 py-2 text-right font-medium">
                    <SortHeader
                      label="前2率"
                      active={sort.key === 'top2Rate'}
                      onClick={() => onSort('top2Rate')}
                      align="right"
                    />
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    <SortHeader
                      label="前3率"
                      active={sort.key === 'top3Rate'}
                      onClick={() => onSort('top3Rate')}
                      align="right"
                    />
                  </th>
                </>
              )}
              <th className="px-3 py-2 text-right font-medium">
                <SortHeader
                  label="胜场"
                  active={sort.key === 'wins'}
                  onClick={() => onSort('wins')}
                  align="right"
                />
              </th>
              <th className="px-3 py-2 text-right font-medium">
                <SortHeader
                  label="场次"
                  active={sort.key === 'total'}
                  onClick={() => onSort('total')}
                  align="right"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedRows.map((row) => (
              <tr key={row.key} className="align-top hover:bg-gray-50">
                <td className="px-3 py-3 text-gray-700">
                  <div
                    className={`flex gap-2 ${
                      row.horses.length >= 3 ? 'min-w-fit flex-nowrap' : 'flex-wrap'
                    }`}
                    title={row.label}
                  >
                    {row.horses.map((horse) => (
                      <HorseSummary
                        key={horse.key}
                        horse={horse}
                        groupSize={row.horses.length}
                        onClick={() => onHorseClick(horse)}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-mono font-bold text-blue-700">
                  {percent(row.winRate)}
                </td>
                {showTopRates && (
                  <>
                    <td className="px-3 py-3 text-right font-mono text-indigo-700">
                      {percent(row.top2Rate)} ({row.top2})
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-violet-700">
                      {percent(row.top3Rate)} ({row.top3})
                    </td>
                  </>
                )}
                <td className="px-3 py-3 text-right font-mono text-emerald-700">
                  {row.wins}
                </td>
                <td className="px-3 py-3 text-right font-mono text-gray-600">
                  {row.total}
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td
                  className="px-3 py-10 text-center text-gray-400"
                  colSpan={emptyColSpan}
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

function ProcStatsTable({
  rows,
  sort,
  onSort,
}: {
  rows: ProcStatRow[];
  sort: TableSort<
    'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
  >;
  onSort: (
    key:
      | 'label'
      | 'triggerRate'
      | 'winTriggerRate'
      | 'winRateLift'
      | 'informationGain',
  ) => void;
}) {
  const sortedRows = useMemo(() => sortProcStats(rows, sort), [rows, sort]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">
              <SortHeader
                label="事件"
                active={sort.key === 'label'}
                onClick={() => onSort('label')}
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="全部场次"
                active={sort.key === 'triggerRate'}
                onClick={() => onSort('triggerRate')}
                align="right"
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="胜利场次"
                active={sort.key === 'winTriggerRate'}
                onClick={() => onSort('winTriggerRate')}
                align="right"
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="信息增益"
                active={sort.key === 'informationGain'}
                onClick={() => onSort('informationGain')}
                align="right"
                title={informationGainTooltip}
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="胜率提升"
                active={sort.key === 'winRateLift'}
                onClick={() => onSort('winRateLift')}
                align="right"
                title={winRateLiftTooltip}
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sortedRows.map((row) => (
            <tr key={row.key}>
              <td className="px-3 py-2 text-gray-800">{row.label}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-700">
                {percent(row.triggerRate)} ({ratioText(row.triggeredCount, row.totalCount)})
              </td>
              <td className="px-3 py-2 text-right font-mono text-rose-700">
                {percent(row.winTriggerRate)} ({ratioText(row.winTriggeredCount, row.winCount)})
              </td>
              <td className="px-3 py-2 text-right font-mono text-cyan-700">
                <InformationGainValue
                  value={row.informationGain}
                  detail={informationGainDetail(row)}
                />
              </td>
              <td
                className="px-3 py-2 text-right font-mono"
              >
                <WinRateLiftValue
                  value={row.winRateLift}
                  detail={winRateLiftDetail(row)}
                />
              </td>
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-center text-gray-400" colSpan={5}>
                暂无事件统计
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SkillStatsTable({
  rows,
  sort,
  onSort,
}: {
  rows: SkillStatRow[];
  sort: TableSort<
    'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
  >;
  onSort: (
    key:
      | 'label'
      | 'triggerRate'
      | 'winTriggerRate'
      | 'winRateLift'
      | 'informationGain',
  ) => void;
}) {
  const sortedRows = useMemo(() => sortSkillStats(rows, sort), [rows, sort]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">
              <SortHeader
                label="技能"
                active={sort.key === 'label'}
                onClick={() => onSort('label')}
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="全部场次"
                active={sort.key === 'triggerRate'}
                onClick={() => onSort('triggerRate')}
                align="right"
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="胜利场次"
                active={sort.key === 'winTriggerRate'}
                onClick={() => onSort('winTriggerRate')}
                align="right"
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="信息增益"
                active={sort.key === 'informationGain'}
                onClick={() => onSort('informationGain')}
                align="right"
                title={informationGainTooltip}
              />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <SortHeader
                label="胜率提升"
                active={sort.key === 'winRateLift'}
                onClick={() => onSort('winRateLift')}
                align="right"
                title={winRateLiftTooltip}
              />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {sortedRows.map((row) => (
            <tr key={row.skillId}>
              <td className="px-3 py-2 text-gray-800">
                <SkillNameCell skillId={row.skillId} label={row.label} />
              </td>
              <td className="px-3 py-2 text-right font-mono text-amber-700">
                {percent(row.triggerRate)} ({ratioText(row.triggeredCount, row.totalCount)})
              </td>
              <td className="px-3 py-2 text-right font-mono text-rose-700">
                {percent(row.winTriggerRate)} ({ratioText(row.winTriggeredCount, row.winCount)})
              </td>
              <td className="px-3 py-2 text-right font-mono text-cyan-700">
                <InformationGainValue
                  value={row.informationGain}
                  detail={informationGainDetail(row)}
                />
              </td>
              <td
                className="px-3 py-2 text-right font-mono"
              >
                <WinRateLiftValue
                  value={row.winRateLift}
                  detail={winRateLiftDetail(row)}
                />
              </td>
            </tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-center text-gray-400" colSpan={5}>
                暂无技能统计
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HorseSkillsModal({
  horse,
  onClose,
}: {
  horse: HorseSummaryData | null;
  onClose: () => void;
}) {
  const [eventSort, setEventSort] = useState<
    TableSort<
      'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
    >
  >({
    key: 'informationGain',
    direction: 'desc',
  });
  const [skillSort, setSkillSort] = useState<
    TableSort<
      'label' | 'triggerRate' | 'winTriggerRate' | 'winRateLift' | 'informationGain'
    >
  >({
    key: 'informationGain',
    direction: 'desc',
  });

  useEffect(() => {
    setEventSort({ key: 'informationGain', direction: 'desc' });
    setSkillSort({ key: 'informationGain', direction: 'desc' });
  }, [horse?.key]);

  useEffect(() => {
    if (!horse) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [horse]);

  if (!horse) return null;

  const toggleEventSort = (
    key:
      | 'label'
      | 'triggerRate'
      | 'winTriggerRate'
      | 'winRateLift'
      | 'informationGain',
  ) => {
    setEventSort((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleSkillSort = (
    key:
      | 'label'
      | 'triggerRate'
      | 'winTriggerRate'
      | 'winRateLift'
      | 'informationGain',
  ) => {
    setSkillSort((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-gray-900">
              {horse.name}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {horse.trainerName || '-'}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              出场 {horse.appearances} 场，胜场 {horse.winAppearances}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div>
            <div className="mb-2 text-sm font-medium text-gray-900">HP情况</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-violet-50 px-3 py-3">
                <div className="text-xs text-gray-500">平均HP</div>
                <div className="mt-1 font-mono text-lg font-bold text-violet-700">
                  {hpText(average(horse.finalHpTotal, horse.finalHpCount))}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  基于 {horse.finalHpCount} 场
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-fuchsia-50 px-3 py-3">
                <div className="text-xs text-gray-500">胜场HP</div>
                <div className="mt-1 font-mono text-lg font-bold text-fuchsia-700">
                  {hpText(average(horse.winFinalHpTotal, horse.winFinalHpCount))}
                </div>
                <div className="mt-1 text-[11px] text-gray-500">
                  基于 {horse.winFinalHpCount} 场
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-900">事件发动率</div>
            <ProcStatsTable
              rows={horse.procStats}
              sort={eventSort}
              onSort={toggleEventSort}
            />
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-900">技能发动率</div>
            <SkillStatsTable
              rows={horse.skillStats}
              sort={skillSort}
              onSort={toggleSkillSort}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RaceStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedArchiveId =
    (location.state as { archiveId?: string } | null)?.archiveId ?? 'default';

  const [archives, setArchives] = useState<RaceArchive[]>([]);
  const [activeArchiveId, setActiveArchiveId] = useState(requestedArchiveId);
  const [umdbReady, setUmdbReady] = useState(false);
  const [activeConfig, setActiveConfig] = useState<StatConfig['key']>('single');
  const [statsBundle, setStatsBundle] = useState<ArchiveStatsBundle>(emptyBundle);
  const [cacheInfo, setCacheInfo] = useState<StatsCachePayload | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<HorseSummaryData | null>(
    null,
  );
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [tableSort, setTableSort] = useState<
    TableSort<'label' | 'winRate' | 'top2Rate' | 'top3Rate' | 'wins' | 'total'>
  >({
    key: 'winRate',
    direction: 'desc',
  });

  const active = statConfigs.find((config) => config.key === activeConfig)!;
  const rows = statsBundle.rowsBySize[active.key] ?? [];

  const loadArchives = useCallback(async () => {
    try {
      const config = await window.electron.race.archives();
      const nextArchives = config.archives ?? fallbackArchives;
      setArchives(nextArchives);
      setActiveArchiveId((prev) => {
        if (nextArchives.some((archive) => archive.id === requestedArchiveId)) {
          return requestedArchiveId;
        }
        return nextArchives.some((archive) => archive.id === prev)
          ? prev
          : 'default';
      });
    } catch {
      setArchives(fallbackArchives);
      setActiveArchiveId('default');
    }
  }, [requestedArchiveId]);

  useEffect(() => {
    void loadArchives();

    loadUMDB()
      .then(() => setUmdbReady(true))
      .catch(() => setUmdbReady(true));
  }, [loadArchives]);

  useActivate(() => {
    void loadArchives();
  });

  useEffect(() => {
    if (!umdbReady) return;

    let cancelled = false;

    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const cache = (await window.electron.race.getStatsCache(
          activeArchiveId,
        )) as StatsCachePayload;
        if (cancelled) return;

        const canUseCache =
          refreshNonce === 0 &&
          cache.version === STATS_CACHE_VERSION &&
          !!cache.data &&
          cache.cachedArchiveUpdatedAt === cache.archiveUpdatedAt &&
          cache.archiveUpdatedAt <= cache.cacheUpdatedAt;

        if (canUseCache && cache.data) {
          setStatsBundle(cache.data);
          setCacheInfo(cache);
          return;
        }

        const list = (await window.electron.race.list(activeArchiveId)) as RaceRecord[];
        if (cancelled) return;

        const nextBundle = buildArchiveStatsBundle(list ?? []);
        setStatsBundle(nextBundle);

        const saved = (await window.electron.race.setStatsCache(activeArchiveId, {
          version: STATS_CACHE_VERSION,
          archiveUpdatedAt: cache.archiveUpdatedAt,
          data: nextBundle,
        })) as StatsCachePayload;
        if (!cancelled) {
          setCacheInfo(saved);
        }
      } catch {
        if (!cancelled) {
          setStatsBundle(emptyBundle());
          setCacheInfo(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [activeArchiveId, refreshNonce, umdbReady]);

  useEffect(() => {
    setSelectedHorse(null);
    setTableSort({ key: 'winRate', direction: 'desc' });
  }, [activeArchiveId, activeConfig]);

  const refreshStats = () => {
    setRefreshNonce((prev) => prev + 1);
  };

  const toggleTableSort = (
    key: 'label' | 'winRate' | 'top2Rate' | 'top3Rate' | 'wins' | 'total',
  ) => {
    setTableSort((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <BarChart3 size={20} />
              比赛统计
            </div>
            <p className="ml-1 mt-1 text-sm text-gray-500">
              按单马、双马组合、三马组合查看胜率
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshStats}
              disabled={loadingStats}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              <RefreshCw
                size={16}
                className={loadingStats ? 'animate-spin' : undefined}
              />
              刷新统计
            </button>
            <button
              type="button"
              onClick={() =>
                navigate('/races', { state: { archiveId: activeArchiveId } })
              }
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              <ArrowLeft size={16} />
              返回记录
            </button>
          </div>
        </div>

        <div className="mb-4 border-b border-gray-200">
          <div className="flex flex-wrap items-end gap-2">
            {archives.map((archive) => (
              <button
                key={archive.id}
                type="button"
                onClick={() => setActiveArchiveId(archive.id)}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeArchiveId === archive.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {archive.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {statConfigs.map((config) => (
            <button
              key={config.key}
              type="button"
              onClick={() => setActiveConfig(config.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
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
          <span>共 {rows.length} 个统计对象</span>
          {cacheInfo && (
            <span>
              缓存时间：
              {cacheInfo.cacheUpdatedAt
                ? new Date(cacheInfo.cacheUpdatedAt).toLocaleString()
                : '-'}
            </span>
          )}
        </div>

        {loadingStats ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-gray-400">
            正在计算统计...
          </div>
        ) : (
          <StatTable
            rows={rows}
            sort={tableSort}
            onSort={toggleTableSort}
            onHorseClick={setSelectedHorse}
            showTopRates={active.key === 'single'}
          />
        )}
      </div>

      <HorseSkillsModal horse={selectedHorse} onClose={() => setSelectedHorse(null)} />
    </div>
  );
}
