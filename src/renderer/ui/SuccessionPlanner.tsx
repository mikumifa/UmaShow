/* eslint-disable */
import {
  type DragEvent as ReactDragEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Download,
  GripVertical,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';

import successionData from 'renderer/data/succession_data.json';
import successionSkillMetaData from 'renderer/data/succession_skill_meta.json';
import SkillSelector, {
  type AutoResearchSkill,
} from 'renderer/components/autoResearch/SkillSelector';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { horseIconPath } from 'renderer/components/autoResearch/SelectionCards';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';

import './SuccessionPlanner.css';

type AptitudeKey =
  | 'turf'
  | 'dirt'
  | 'short'
  | 'mile'
  | 'middle'
  | 'long'
  | 'nige'
  | 'senko'
  | 'sashi'
  | 'oikomi';
type FactorKey = AptitudeKey;
type InheritanceTargets = Partial<Record<FactorKey, number>>;
type AptitudeMinimums = Record<AptitudeKey, number>;
type RouteMinimums = Record<BranchKey, AptitudeMinimums>;
type SlotRouteSetting = {
  routeId: string;
  minimums: AptitudeMinimums;
};
type SlotRouteOverrides = Partial<Record<LineageSlot, SlotRouteSetting>>;
type BranchKey = 'paternal' | 'maternal';
type LineageSlot =
  | 'father'
  | 'mother'
  | 'paternalA'
  | 'paternalB'
  | 'maternalA'
  | 'maternalB';

type SuccessionUma = {
  id: number;
  name: string;
  icon?: string | null;
  aptitudes: Record<AptitudeKey, number>;
  relationTypes: number[];
};

type SuccessionData = {
  relationPoints: Record<string, number>;
  umas: SuccessionUma[];
};

type Route = {
  id: string;
  name: string;
  shortName: string;
  g1Count: number;
  winSaddleIds: number[];
  aptitudes: FactorKey[];
};

type PositionCompatibilityScore = {
  base: number;
  g1Count: number;
  g1Source?: 'detailed' | 'route';
  total: number;
  ownTotal?: number;
  inheritedTotal?: number;
  coParentLabel?: string;
  coParentName?: string;
  coParentBase?: number;
  coParentTotal?: number;
  relationNames?: string[];
  ancestorDetails?: Array<{
    label: string;
    umaName?: string;
    base: number;
    g1Count: number;
    g1Source?: 'detailed' | 'route';
    total: number;
  }>;
};

type PositionFactorRequirement = {
  type: FactorKey;
  base: number;
  target: number;
  stars: number | null;
};

type FactorAssignment = {
  type: FactorKey;
  stars: 1 | 2 | 3;
  free?: boolean;
  unconstrained?: boolean;
};
type TrainedLineageMember = {
  umaId: number;
  cardId?: number;
  factor: Pick<FactorAssignment, 'type' | 'stars'>;
  routeId: string;
  winSaddleIds?: number[];
};
type TrainedUmaSetting = {
  self: TrainedLineageMember;
  parents: [TrainedLineageMember, TrainedLineageMember];
  source?: 'own' | 'rental';
  selectionId?: string;
  viewerId?: number;
};
type TrainedUmaSettings = Partial<Record<LineageSlot, TrainedUmaSetting>>;
type FixedDressSlots = Partial<Record<LineageSlot, number>>;
type CapturedReuseMode = 'off' | 'parents';
type BlueFactorKey = 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom';
type CapturedBlueFactorMinimums = Record<BlueFactorKey, number>;
type CapturedFactor = {
  id: number;
  type: FactorKey;
  stars: 1 | 2 | 3;
};
type CapturedBlueFactor = {
  id: number;
  type: BlueFactorKey;
  name: string;
  stars: 1 | 2 | 3;
};
type CapturedInheritanceFactor = {
  id: number;
  groupId: number;
  stars: 1 | 2 | 3;
};
type SuccessionFactorMeta = {
  id: number;
  groupId: number;
  stars: 1 | 2 | 3;
  factorType: 3 | 4 | 5;
  name: string;
  skillGroupIds: number[];
  skillTargets?: Array<{
    groupId: number;
    name: string;
    iconId: number;
    level?: number;
  }>;
};
type CapturedFactorTargetKind = 'skill' | 'race' | 'unique';
type CapturedFactorTarget = {
  kind: CapturedFactorTargetKind;
  groupId: number;
};
type CapturedLineageMember = {
  trainedCharaId: number;
  cardId: number;
  rarity: number;
  raceClothId: number;
  umaId: number;
  name: string;
  factor: CapturedFactor;
  blueFactor: CapturedBlueFactor | null;
  uniqueFactorStars: number;
  whiteFactorCount: number;
  inheritanceFactors: CapturedInheritanceFactor[];
  winSaddleIds: number[];
};
type CapturedTrainedUma = CapturedLineageMember & {
  selectionId: string;
  source: 'own' | 'rental';
  viewerId: number;
  ownerName: string;
  rankScore: number;
  parents: [CapturedLineageMember, CapturedLineageMember];
  lineageFactors: CapturedFactor[];
};
type CapturedCompatibilityPreview = {
  label: string;
  base: number;
  g1Count: number;
  total: number;
  detailed: boolean;
  g1Details?: Array<{
    label: string;
    count: number;
    detailed: boolean;
  }>;
};
type SuccessionIndexSnapshot = {
  receivedAt: string;
  viewerId?: number;
  data: Record<string, any>;
};

type StoredSuccessionPlayer = {
  viewerId: string;
  name: string;
  fetchedAt: string;
  userInfo: Record<string, any>;
  practicePartner: Record<string, any>;
};

type SuccessionScanAccount = {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
};

type SuccessionScanProgress = {
  stage: 'login' | 'load' | 'scan';
  detail: string;
  viewerId?: string;
  current?: number;
  total?: number;
};

type TargetFactorPlan = {
  assignments: Record<LineageSlot, FactorAssignment>;
};

type TargetFactorPlanEnumerator = {
  total: number;
  getRange: (offset: number, limit: number) => TargetFactorPlan[];
};

type CompleteDesignPosition = {
  code: string;
  generation: 1 | 2 | 3 | 4;
  uma?: SuccessionUma;
  factor: FactorAssignment;
  compatibility?: number;
  compatibilityTitle?: string;
  minimumDemand?: FactorDemand;
  cumulativeDemand?: FactorDemand;
  fixed: boolean;
  requiresUma: boolean;
  winSaddleIds?: number[];
  capturedSelectionId?: string;
  capturedSource?: 'own' | 'rental';
  capturedOwnerName?: string;
  capturedViewerId?: number;
  capturedInheritanceFactors?: CapturedInheritanceFactor[];
  capturedFactorSummary?: {
    blueFactor: CapturedBlueFactor | null;
    aptitudeFactor: CapturedFactor;
    uniqueFactorStars: number;
    selectedSkillFactors: Array<{
      groupId: number;
      name: string;
      count: number;
    }>;
    whiteFactorCount: number;
  };
  inRaceFactorJump?: {
    type: FactorKey;
    fromRank: number;
    toRank: number;
  };
  alternatives?: CompleteDesignPosition[];
  alternativeCount?: number;
};

type CompleteFactorDesign = {
  positions: CompleteDesignPosition[];
  cumulativeRequirements: Array<{
    code: string;
    demand: FactorDemand;
  }>;
  issues: string[];
};

type OptimalCompleteDesignResult = {
  results: Array<{
    probability: number;
    plan: TargetFactorPlan;
    design: CompleteFactorDesign;
  }>;
  truncated: boolean;
  bestMatchCount: number;
};

type CompletedCalculation = {
  inputKey: string;
  result: OptimalCompleteDesignResult | null;
};

type BranchFactorStrategy = {
  positions: CompleteDesignPosition[];
  cumulativeRequirements: CompleteFactorDesign['cumulativeRequirements'];
  greatFactorRequirements: {
    parent: FactorDemand;
    grandparents: [FactorDemand, FactorDemand];
  };
  capturedSelectionIds?: string[];
  capturedSources?: Array<'own' | 'rental'>;
  capturedBlueFactorTotals?: CapturedBlueFactorMinimums;
};

type CapturedReuseBranchIdentity = {
  parentId: number;
  parentSource: 'own' | 'rental' | 'planned';
  selectionIds: string[];
  sources: Array<'own' | 'rental'>;
  umaIds: number[];
};

export function capturedReuseCombinationValid(
  first: CapturedReuseBranchIdentity,
  second: CapturedReuseBranchIdentity,
) {
  if (!first.parentId || first.parentId === second.parentId) return false;
  const selectionIds = [...first.selectionIds, ...second.selectionIds];
  if (new Set(selectionIds).size !== selectionIds.length) return false;
  const umaIds = [...first.umaIds, ...second.umaIds];
  if (new Set(umaIds).size !== umaIds.length) return false;
  return !(first.parentSource === 'rental' && second.parentSource === 'rental');
}

export function capturedReusePairPolicy(
  paternalSource: 'own' | 'rental',
  branchesInterchangeable: boolean,
) {
  return {
    includePaternal:
      !branchesInterchangeable || paternalSource === 'own',
    includeMaternalRentals: paternalSource === 'own',
    canonicalizeOwnPair: branchesInterchangeable,
  };
}

export function capturedMemberMatchesSlotConstraint(
  member: Pick<CapturedLineageMember, 'umaId' | 'cardId'>,
  constraint: {
    targetId: number;
    fixedUmaId?: number;
    trainedUmaId?: number;
    fixedDressCardId?: number;
    excluded?: boolean;
  },
) {
  if (member.umaId === constraint.targetId) return false;
  const fixed = Boolean(constraint.fixedUmaId || constraint.trainedUmaId);
  if (constraint.excluded && !fixed) return false;
  if (constraint.fixedUmaId && constraint.fixedUmaId !== member.umaId) {
    return false;
  }
  if (constraint.trainedUmaId && constraint.trainedUmaId !== member.umaId) {
    return false;
  }
  if (
    constraint.fixedDressCardId &&
    constraint.fixedDressCardId !== member.cardId
  ) {
    return false;
  }
  return true;
}

export function capturedBlueFactorTotals(
  members: Array<Pick<CapturedLineageMember, 'blueFactor'>>,
): CapturedBlueFactorMinimums {
  const totals = { ...INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS };
  members.forEach((member) => {
    if (!member.blueFactor) return;
    totals[member.blueFactor.type] += member.blueFactor.stars;
  });
  return totals;
}

export function capturedBlueFactorMinimumsSatisfied(
  minimums: CapturedBlueFactorMinimums,
  branches: CapturedBlueFactorMinimums[],
) {
  return BLUE_FACTOR_KEYS.every(
    (type) =>
      branches.reduce((total, branch) => total + branch[type], 0) >=
      minimums[type],
  );
}

export function capturedBlueFactorMinimumSlotCount(
  minimums: CapturedBlueFactorMinimums,
) {
  return BLUE_FACTOR_KEYS.reduce(
    (total, type) => total + factorSlotsForStars(minimums[type]),
    0,
  );
}

const data = successionData as SuccessionData;
const successionSkillMeta = successionSkillMetaData as Record<
  number,
  { groupId: number; name: string; iconId: number; level?: number }
>;
const EMPTY_TARGET_FACTOR_PLAN_ENUMERATOR: TargetFactorPlanEnumerator = {
  total: 0,
  getRange: () => [],
};
const MIN_DISPLAYED_PROBABILITY = 0.00005;
const APTITUDE_LABELS: Record<AptitudeKey, string> = {
  turf: '草地',
  dirt: '泥地',
  short: '短距离',
  mile: '英里',
  middle: '中距离',
  long: '长距离',
  nige: '领跑',
  senko: '前列',
  sashi: '居中',
  oikomi: '后追',
};
const APTITUDE_SHORT_LABELS: Record<AptitudeKey, string> = {
  turf: '草',
  dirt: '泥',
  short: '短',
  mile: '英',
  middle: '中',
  long: '长',
  nige: '领',
  senko: '前',
  sashi: '居',
  oikomi: '后',
};
const FACTOR_ICON_PATHS: Record<AptitudeKey, string> = {
  turf: 'succession/aptitude/turf.png',
  dirt: 'succession/aptitude/dirt.png',
  short: 'succession/aptitude/short.png',
  mile: 'succession/aptitude/mile.png',
  middle: 'succession/aptitude/middle.png',
  long: 'succession/aptitude/long.png',
  nige: 'succession/aptitude/front.png',
  senko: 'succession/aptitude/pace.png',
  sashi: 'succession/aptitude/late.png',
  oikomi: 'succession/aptitude/end.png',
};
const RANK_ICON_PATHS: Record<string, string> = {
  S: 'succession/rank/s.png',
  A: 'succession/rank/a.png',
  B: 'succession/rank/b.png',
  C: 'succession/rank/c.png',
  D: 'succession/rank/d.png',
  E: 'succession/rank/e.png',
  F: 'succession/rank/f.png',
  G: 'succession/rank/g.png',
};
const APTITUDE_GROUPS: Array<{
  label: string;
  types: AptitudeKey[];
}> = [
  { label: '场地', types: ['turf', 'dirt'] },
  { label: '距离', types: ['short', 'mile', 'middle', 'long'] },
  { label: '跑法', types: ['nige', 'senko', 'sashi', 'oikomi'] },
];
const ALL_APTITUDES: AptitudeKey[] = [
  'turf',
  'dirt',
  'short',
  'mile',
  'middle',
  'long',
  'nige',
  'senko',
  'sashi',
  'oikomi',
];
const FACTOR_STEPS = [0, 1, 4, 7, 10];
const RANKS = ['-', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
const BRANCH_SLOTS: Record<BranchKey, LineageSlot[]> = {
  paternal: ['father', 'paternalA', 'paternalB'],
  maternal: ['mother', 'maternalA', 'maternalB'],
};
const SLOT_LABELS: Record<LineageSlot, string> = {
  father: '父亲 A',
  mother: '母亲 B',
  paternalA: '祖代 AA',
  paternalB: '祖代 AB',
  maternalA: '祖代 BA',
  maternalB: '祖代 BB',
};
const BLUE_FACTOR_LABELS: Record<BlueFactorKey, string> = {
  speed: '速度',
  stamina: '耐力',
  power: '力量',
  guts: '毅力',
  wisdom: '智力',
};
const BLUE_FACTOR_GROUPS: Record<number, BlueFactorKey> = {
  1: 'speed',
  2: 'stamina',
  3: 'power',
  4: 'guts',
  5: 'wisdom',
};
const BLUE_FACTOR_KEYS = Object.values(BLUE_FACTOR_GROUPS);
const INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS: CapturedBlueFactorMinimums = {
  speed: 0,
  stamina: 0,
  power: 0,
  guts: 0,
  wisdom: 0,
};
const SLOT_SOURCE_LABELS: Record<LineageSlot, string> = {
  father: '祖代 AA / AB',
  mother: '祖代 BA / BB',
  paternalA: '曾祖代 AAA / AAB',
  paternalB: '曾祖代 ABA / ABB',
  maternalA: '曾祖代 BAA / BAB',
  maternalB: '曾祖代 BBA / BBB',
};
const SLOT_UPSTREAM_SLOTS: Partial<Record<LineageSlot, LineageSlot[]>> = {
  father: ['paternalA', 'paternalB'],
  mother: ['maternalA', 'maternalB'],
};
const ROUTES: Route[] = [
  {
    id: 'mile-middle-dirt',
    name: '英中长泥',
    shortName: '英中长泥',
    g1Count: 23,
    winSaddleIds: [
      34, 33, 18, 27, 12, 14, 38, 16, 26, 23, 10, 165, 30, 17, 13, 25, 21, 36,
      168, 15, 11, 29, 32,
    ],
    aptitudes: ['turf', 'mile', 'middle', 'long', 'dirt'],
  },
  {
    id: 'short-mile-middle-dirt',
    name: '短英中泥',
    shortName: '短英中泥',
    g1Count: 22,
    winSaddleIds: [
      35, 34, 24, 27, 19, 14, 38, 28, 26, 23, 32, 165, 30, 20, 25, 21, 36, 22,
      168, 15, 11, 29,
    ],
    aptitudes: ['turf', 'short', 'mile', 'middle', 'dirt'],
  },
  {
    id: 'none',
    name: '暂不规划历战',
    shortName: '无赛程',
    g1Count: 0,
    winSaddleIds: [],
    aptitudes: [],
  },
];
const G1_COMPATIBILITY_POINTS = 3;
const RED_FACTOR_BASE_PROBABILITY: Record<1 | 2 | 3, number> = {
  1: 0.01,
  2: 0.03,
  3: 0.05,
};
const FACTOR_GROUP_TO_APTITUDE: Record<number, FactorKey> = {
  11: 'turf',
  12: 'dirt',
  21: 'nige',
  22: 'senko',
  23: 'sashi',
  24: 'oikomi',
  31: 'short',
  32: 'mile',
  33: 'middle',
  34: 'long',
};

const INITIAL_LINEAGE: Record<LineageSlot, number> = {
  father: 0,
  mother: 0,
  paternalA: 0,
  paternalB: 0,
  maternalA: 0,
  maternalB: 0,
};
const INITIAL_ROUTES: Record<BranchKey, string> = {
  paternal: 'short-mile-middle-dirt',
  maternal: 'mile-middle-dirt',
};
const DEFAULT_APTITUDE_MINIMUMS: AptitudeMinimums = {
  turf: 6,
  dirt: 6,
  short: 6,
  mile: 6,
  middle: 6,
  long: 6,
  nige: 6,
  senko: 6,
  sashi: 6,
  oikomi: 6,
};
const INITIAL_ROUTE_MINIMUMS: RouteMinimums = {
  paternal: { ...DEFAULT_APTITUDE_MINIMUMS },
  maternal: { ...DEFAULT_APTITUDE_MINIMUMS },
};
const INITIAL_INHERITANCE_APTITUDES: FactorKey[] = [];
const INITIAL_INHERITANCE_TARGETS: InheritanceTargets = {};
const MAX_INHERITANCE_SLOTS = 6;
const TARGET_FACTOR_SLOTS: LineageSlot[] = [
  'father',
  'mother',
  'paternalA',
  'paternalB',
  'maternalA',
  'maternalB',
];
const SLOT_CODES: Record<LineageSlot, string> = {
  father: 'A',
  mother: 'B',
  paternalA: 'AA',
  paternalB: 'AB',
  maternalA: 'BA',
  maternalB: 'BB',
};
const COMPLETE_GENERATION_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: '亲代',
  2: '祖代',
  3: '曾祖代',
  4: '曾曾祖代（高祖代）',
};
const MAX_EQUAL_CANDIDATES = 10;
const MAX_CAPTURED_RESULT_CANDIDATES = 100;
const MAX_EQUAL_MATCH_GROUPS = 100;
const MAX_CAPTURED_PICKER_CANDIDATES = 100;
const CAPTURED_PICKER_PAGE_SIZE = 1;
const CALCULATION_PHASES = [
  '读取并校验计算条件',
  '构建红因子分配方案',
  '枚举种马路线、计算概率',
  '整理最高概率结果',
] as const;
const SUCCESSION_STORAGE_KEY = 'uma-tools:succession-planner:v1';

export function capturedFactorBaseProbability(
  factorType: 3 | 4 | 5,
  stars: 1 | 2 | 3,
) {
  if (factorType === 3) return 0.05 * stars;
  if (factorType === 4) return 0.03 * stars;
  return 0.01 * stars;
}

export function capturedFactorInheritanceProbability(
  factorType: 3 | 4 | 5,
  stars: 1 | 2 | 3,
  compatibility: number,
) {
  return Math.min(
    1,
    capturedFactorBaseProbability(factorType, stars) *
      (1 + compatibility / 100),
  );
}

export function probabilityAtLeastOnce(
  singleAttemptProbability: number,
  attempts = 2,
) {
  return 1 - (1 - singleAttemptProbability) ** Math.max(0, attempts);
}

export function compareCombinedProbabilityPriority(
  leftCombinedProbability: number,
  leftSkillProbabilities: number[],
  rightCombinedProbability: number,
  rightSkillProbabilities: number[],
  epsilon = 1e-12,
) {
  if (leftCombinedProbability > rightCombinedProbability + epsilon) return 1;
  if (leftCombinedProbability < rightCombinedProbability - epsilon) return -1;
  const count = Math.max(
    leftSkillProbabilities.length,
    rightSkillProbabilities.length,
  );
  for (let index = 0; index < count; index += 1) {
    const left = leftSkillProbabilities[index] || 0;
    const right = rightSkillProbabilities[index] || 0;
    if (left > right + epsilon) return 1;
    if (left < right - epsilon) return -1;
  }
  return 0;
}

export function combinedSkillTargetProbability(
  baseProbability: number,
  skillProbabilities: number[],
) {
  return (
    baseProbability *
    skillProbabilities.reduce(
      (jointProbability, value) => jointProbability * value,
      1,
    )
  );
}

export function capturedFactorMatchesTarget(
  factor: CapturedInheritanceFactor,
  target: CapturedFactorTarget,
  factorMeta: Record<number, SuccessionFactorMeta>,
) {
  const meta = factorMeta[factor.id];
  if (!meta) return false;
  if (target.kind === 'skill') {
    return meta.skillGroupIds.includes(target.groupId);
  }
  if (target.kind === 'race') {
    return meta.factorType === 5 && meta.groupId === target.groupId;
  }
  return meta.factorType === 3 && meta.groupId === target.groupId;
}

export function capturedFactorTargetProbability(
  sources: Array<{
    factor: CapturedInheritanceFactor;
    generation: 1 | 2;
    compatibility: number;
  }>,
  target: CapturedFactorTarget,
  factorMeta: Record<number, SuccessionFactorMeta>,
) {
  const matchingProbabilities = sources.flatMap(
    ({ factor, generation, compatibility }) => {
      const meta = factorMeta[factor.id];
      if (!meta || !capturedFactorMatchesTarget(factor, target, factorMeta)) {
        return [];
      }
      if (
        generation === 1 &&
        (target.kind === 'unique' ||
          (target.kind === 'skill' && meta.factorType === 3))
      ) {
        return [1];
      }
      return [
        probabilityAtLeastOnce(
          capturedFactorInheritanceProbability(
            meta.factorType,
            factor.stars,
            compatibility,
          ),
        ),
      ];
    },
  );
  return (
    1 -
    matchingProbabilities.reduce(
      (missProbability, probability) => missProbability * (1 - probability),
      1,
    )
  );
}

function charaIdFromCardId(value: unknown) {
  const digits = String(Number(value) || '');
  return Number(digits.slice(0, 4)) || 0;
}

function baseCharaId(value: unknown) {
  const id = Number(value) || 0;
  if (!id) return 0;
  return data.umas.some((uma) => uma.id === id) ? id : charaIdFromCardId(id);
}

function plannedDressIconPath(cardId: number) {
  const rarityMap = UMDB.cardRarityData[cardId] || {};
  const raceDressId =
    Number(rarityMap[5] || rarityMap[4] || rarityMap[3]) ||
    Object.values(rarityMap).map(Number).find(Boolean) ||
    cardId;
  return horseIconPath(cardId, 0, raceDressId);
}

function normalizedSaddleIds(value: unknown) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

function capturedExtendedFactorRows(
  rows: any,
  factorExtendRows: any,
  positionId: number,
) {
  const replacements = new Map<number, number>();
  for (const extension of Array.isArray(factorExtendRows)
    ? factorExtendRows
    : []) {
    if (Number(extension?.position_id || 0) !== positionId) continue;
    const baseFactorId = Number(extension?.base_factor_id || 0);
    const factorId = Number(extension?.factor_id || 0);
    if (baseFactorId && factorId) replacements.set(baseFactorId, factorId);
  }
  if (!replacements.size) return rows;
  return (Array.isArray(rows) ? rows : []).map((row: any) => {
    const baseFactorId = Number(row?.factor_id ?? row?.id ?? 0);
    const factorId = replacements.get(baseFactorId);
    if (!factorId) return row;
    const stars = factorId % 10;
    return {
      ...row,
      factor_id: factorId,
      ...(row?.id == null ? {} : { id: factorId }),
      ...(row?.rarity == null ? {} : { rarity: stars }),
      ...(row?.stars == null ? {} : { stars }),
    };
  });
}

function capturedFactorSummary(rows: any) {
  let blueFactor: CapturedBlueFactor | null = null;
  let uniqueFactorStars = 0;
  let whiteFactorCount = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = Number(row?.factor_id ?? row?.id ?? 0);
    if (!id) continue;
    const groupId = Number(row?.factor_group_id || Math.floor(id / 100));
    const blueFactorType = BLUE_FACTOR_GROUPS[groupId];
    const isStat = Boolean(blueFactorType);
    const isRed = Boolean(FACTOR_GROUP_TO_APTITUDE[groupId]);
    const isUnique = id >= 10_000_000;
    const stars = Number(row?.rarity ?? row?.stars ?? id % 10);
    if (isStat && (stars === 1 || stars === 2 || stars === 3)) {
      blueFactor = {
        id,
        type: blueFactorType,
        name: BLUE_FACTOR_LABELS[blueFactorType],
        stars,
      };
    } else if (isUnique) {
      uniqueFactorStars = Math.max(uniqueFactorStars, stars || 1);
    } else if (!isStat && !isRed) {
      whiteFactorCount += 1;
    }
  }
  return { blueFactor, uniqueFactorStars, whiteFactorCount };
}

function capturedInheritanceFactors(rows: any): CapturedInheritanceFactor[] {
  return (Array.isArray(rows) ? rows : []).flatMap((row: any) => {
    const id = Number(row?.factor_id ?? row?.id ?? 0);
    const groupId = Number(row?.factor_group_id || Math.floor(id / 100));
    const stars = Number(row?.rarity ?? row?.stars ?? id % 10);
    if (!id || !groupId || (stars !== 1 && stars !== 2 && stars !== 3)) {
      return [];
    }
    return [{ id, groupId, stars: stars as 1 | 2 | 3 }];
  });
}

export function detailedCommonG1Count(
  firstWinSaddleIds: number[] | undefined,
  secondWinSaddleIds: number[] | undefined,
  successionG1SaddleIds: Iterable<number>,
) {
  if (!firstWinSaddleIds?.length || !secondWinSaddleIds?.length) {
    return undefined;
  }
  const g1Ids = new Set(successionG1SaddleIds);
  if (!g1Ids.size) return undefined;
  const first = new Set(firstWinSaddleIds.filter((id) => g1Ids.has(id)));
  const second = new Set(secondWinSaddleIds.filter((id) => g1Ids.has(id)));
  return [...first].filter((id) => second.has(id)).length;
}

export function winSaddleCompatibilityBonus(g1Counts: number[]) {
  return (
    g1Counts.reduce((total, count) => total + count, 0) *
    G1_COMPATIBILITY_POINTS
  );
}

function capturedRedFactor(rows: any): CapturedFactor | null {
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = Number(row?.factor_id ?? row?.id ?? 0);
    const groupId = Number(row?.factor_group_id || Math.floor(id / 100));
    const type = FACTOR_GROUP_TO_APTITUDE[groupId];
    if (!type) continue;
    const stars = Number(row?.rarity ?? row?.stars ?? id % 10);
    if (stars !== 1 && stars !== 2 && stars !== 3) continue;
    return { id, type, stars };
  }
  return null;
}

function capturedMember(
  row: any,
  factorExtendRows: any = [],
  positionId = 1,
): CapturedLineageMember | null {
  const trainedCharaId = Number(
    row?.trained_chara_id ?? row?.owner_trained_chara_id ?? 0,
  );
  const cardId = Number(row?.card_id || 0);
  const umaId = baseCharaId(row?.chara_id) || baseCharaId(cardId);
  const factorRows = capturedExtendedFactorRows(
    row?.factor_info_array ?? row?.factors,
    factorExtendRows,
    positionId,
  );
  const factor = capturedRedFactor(factorRows);
  if (!umaId || !factor || !data.umas.some((uma) => uma.id === umaId)) {
    return null;
  }
  const uma = data.umas.find((candidate) => candidate.id === umaId)!;
  return {
    trainedCharaId,
    cardId,
    rarity: Number(row?.rarity || 0),
    raceClothId: Number(row?.race_cloth_id || 0),
    umaId,
    name: uma.name || `马娘 ${umaId}`,
    factor,
    ...capturedFactorSummary(factorRows),
    inheritanceFactors: capturedInheritanceFactors(factorRows),
    winSaddleIds: normalizedSaddleIds(row?.win_saddle_id_array),
  };
}

export function normalizeSuccessionIndex(
  snapshot: SuccessionIndexSnapshot | null,
) {
  if (!snapshot?.data) return [];
  const index = snapshot.data;
  const ownRows = Array.isArray(index.trained_chara)
    ? index.trained_chara
    : Array.isArray(index.trained_chara_array)
      ? index.trained_chara_array
      : [];
  const rentalData = index.succession_trained_chara_data || {};
  const rentalRows = Array.isArray(rentalData.succession_trained_chara_array)
    ? rentalData.succession_trained_chara_array
    : [];
  const ownerNames = new Map<number, string>(
    (Array.isArray(rentalData.summary_user_info_array)
      ? rentalData.summary_user_info_array
      : []
    ).map((row: any) => [Number(row?.viewer_id || 0), String(row?.name || '')]),
  );
  const rowsById = new Map<number, any>();
  [...ownRows, ...rentalRows].forEach((row) => {
    const id = Number(row?.trained_chara_id || 0);
    if (id && !rowsById.has(id)) rowsById.set(id, row);
  });

  const normalizeRoot = (
    row: any,
    expectedSource: 'own' | 'rental',
  ): CapturedTrainedUma | null => {
    const currentViewerId = Number(snapshot.viewerId || 0);
    const rowViewerId = Number(row?.viewer_id || row?.owner_viewer_id || 0);
    const source =
      expectedSource === 'own' &&
      currentViewerId &&
      rowViewerId &&
      rowViewerId !== currentViewerId
        ? 'rental'
        : expectedSource;
    const factorExtendRows = row?.factor_extend_array;
    const self = capturedMember(row, factorExtendRows, 1);
    if (!self) return null;
    const allEmbeddedParents: any[] = (
      Array.isArray(row?.succession_chara_array)
        ? row.succession_chara_array
        : []
    ).sort(
      (left: any, right: any) =>
        Number(left?.position_id || 0) - Number(right?.position_id || 0),
    );
    const preferredEmbeddedParents = allEmbeddedParents.filter(
      (parent: any) => {
        const position = Number(parent?.position_id || 0);
        return position === 10 || position === 20;
      },
    );
    const embeddedParents =
      preferredEmbeddedParents.length >= 2
        ? preferredEmbeddedParents
        : allEmbeddedParents;
    const referencedParentRows = [
      rowsById.get(Number(row?.succession_trained_chara_id_1 || 0)),
      rowsById.get(Number(row?.succession_trained_chara_id_2 || 0)),
    ];
    const parentRows =
      embeddedParents.length >= 2
        ? embeddedParents.slice(0, 2).map((embedded: any, index: number) => ({
            ...(referencedParentRows[index] || {}),
            ...embedded,
          }))
        : referencedParentRows;
    const parents = parentRows.map((parent: any, index: number) =>
      capturedMember(
        parent,
        factorExtendRows,
        Number(parent?.position_id || 0) || (index === 0 ? 10 : 20),
      ),
    );
    if (!parents[0] || !parents[1]) return null;
    const embeddedLineageFactors = allEmbeddedParents
      .map((member: any): CapturedFactor | null => {
        const positionId = Number(member?.position_id || 0);
        return capturedRedFactor(
          capturedExtendedFactorRows(
            member?.factor_info_array ?? member?.factors,
            factorExtendRows,
            positionId,
          ),
        );
      })
      .filter((factor): factor is CapturedFactor => Boolean(factor));
    const viewerId = Number(row?.viewer_id || 0);
    return {
      ...self,
      selectionId: `${source}:${viewerId}:${self.trainedCharaId}`,
      source,
      viewerId,
      ownerName:
        source === 'own' ? '自己' : ownerNames.get(viewerId) || '其他玩家',
      rankScore: Number(row?.rank_score || 0),
      parents: [parents[0], parents[1]],
      lineageFactors: embeddedLineageFactors.length
        ? embeddedLineageFactors
        : [parents[0].factor, parents[1].factor],
    };
  };

  const normalizedRows = [
    ...ownRows.map((row: any) => normalizeRoot(row, 'own')),
    ...rentalRows.map((row: any) => normalizeRoot(row, 'rental')),
  ].filter((row): row is CapturedTrainedUma => Boolean(row));
  const uniqueRows = new Map<string, CapturedTrainedUma>();
  normalizedRows.forEach((row) => {
    if (!uniqueRows.has(row.selectionId)) uniqueRows.set(row.selectionId, row);
  });
  return [...uniqueRows.values()].sort(
      (left, right) =>
        (left.source === right.source ? 0 : left.source === 'own' ? -1 : 1) ||
        right.rankScore - left.rankScore,
    );
}

export function mergeScannedSuccessionPlayers(
  snapshot: SuccessionIndexSnapshot | null,
  players: StoredSuccessionPlayer[],
): SuccessionIndexSnapshot | null {
  if (!snapshot && !players.length) return null;
  const data = snapshot?.data || {};
  const rentalData = data.succession_trained_chara_data || {};
  const rowMap = new Map<string, any>();
  const rowKey = (row: any) =>
    `${Number(row?.viewer_id || 0)}:${Number(row?.trained_chara_id || 0)}`;
  (Array.isArray(rentalData.succession_trained_chara_array)
    ? rentalData.succession_trained_chara_array
    : []
  ).forEach((row: any) => rowMap.set(rowKey(row), row));
  players.forEach((player) => {
    const row = {
      ...player.practicePartner,
      viewer_id: Number(player.viewerId),
    };
    rowMap.set(rowKey(row), row);
  });

  const summaryMap = new Map<number, any>();
  (Array.isArray(rentalData.summary_user_info_array)
    ? rentalData.summary_user_info_array
    : []
  ).forEach((row: any) => summaryMap.set(Number(row?.viewer_id || 0), row));
  players.forEach((player) => {
    summaryMap.set(Number(player.viewerId), {
      ...player.userInfo,
      viewer_id: Number(player.viewerId),
      name: player.name,
    });
  });

  const latestScannedAt = players.reduce(
    (latest, player) => (player.fetchedAt > latest ? player.fetchedAt : latest),
    '',
  );
  return {
    receivedAt:
      latestScannedAt > (snapshot?.receivedAt || '')
        ? latestScannedAt
        : snapshot?.receivedAt || new Date().toISOString(),
    viewerId: snapshot?.viewerId,
    data: {
      ...data,
      succession_trained_chara_data: {
        ...rentalData,
        succession_trained_chara_array: [...rowMap.values()],
        summary_user_info_array: [...summaryMap.values()],
      },
    },
  };
}

type ProbabilityFactor = {
  type: FactorKey;
  stars: 1 | 2 | 3;
  compatibility: number;
};

function redFactorInheritanceProbability(
  stars: 1 | 2 | 3,
  compatibility: number,
) {
  return Math.min(
    1,
    RED_FACTOR_BASE_PROBABILITY[stars] * (1 + compatibility / 100),
  );
}

function probabilityOfReachingTargets(
  factors: ProbabilityFactor[],
  targetTypes: FactorKey[],
  requiredRaises: Partial<Record<FactorKey, number>>,
) {
  const activeTypes = targetTypes.filter(
    (type) => (requiredRaises[type] || 0) > 0,
  );
  if (!activeTypes.length) return 1;
  return activeTypes.reduce((jointProbability, type) => {
    const limit = requiredRaises[type] || 0;
    let states: number[] = Array.from({ length: limit + 1 }, (_, index) =>
      index === 0 ? 1 : 0,
    );
    factors
      .filter((factor) => factor.type === type)
      .forEach((factor) => {
        const probability = redFactorInheritanceProbability(
          factor.stars,
          factor.compatibility,
        );
        for (let inheritance = 0; inheritance < 2; inheritance += 1) {
          const nextStates = Array.from({ length: limit + 1 }, () => 0);
          states.forEach((stateProbability, count) => {
            nextStates[count] += stateProbability * (1 - probability);
            nextStates[Math.min(limit, count + 1)] +=
              stateProbability * probability;
          });
          states = nextStates;
        }
      });
    return jointProbability * states[limit];
  }, 1);
}

type StoredSuccessionSettings = {
  targetId: number;
  lineage: Record<LineageSlot, number>;
  routes: Record<BranchKey, string>;
  routeMinimums: RouteMinimums;
  inheritanceAptitudes: FactorKey[];
  inheritanceTargets: InheritanceTargets;
  allowInRaceFactorJump: boolean;
  inRaceFactorJumpMinimumRank: number;
  excludedUmaIds: number[];
  excludedCapturedSelectionIds: string[];
  slotRouteOverrides: SlotRouteOverrides;
  trainedUmaSettings: TrainedUmaSettings;
  capturedReuseMode: CapturedReuseMode;
  capturedBlueFactorMinimums: CapturedBlueFactorMinimums;
  capturedFactorTargets: CapturedFactorTarget[];
  fixedDressSlots: FixedDressSlots;
};

function loadStoredSuccessionSettings(): StoredSuccessionSettings {
  const fallback = {
    targetId: 0,
    lineage: { ...INITIAL_LINEAGE },
    routes: { ...INITIAL_ROUTES },
    routeMinimums: {
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    },
    inheritanceAptitudes: [...INITIAL_INHERITANCE_APTITUDES],
    inheritanceTargets: { ...INITIAL_INHERITANCE_TARGETS },
    allowInRaceFactorJump: false,
    inRaceFactorJumpMinimumRank: 6,
    excludedUmaIds: [],
    excludedCapturedSelectionIds: [],
    slotRouteOverrides: {},
    trainedUmaSettings: {},
    capturedReuseMode: 'off' as CapturedReuseMode,
    capturedBlueFactorMinimums: { ...INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS },
    capturedFactorTargets: [] as CapturedFactorTarget[],
    fixedDressSlots: {} as FixedDressSlots,
  };
  if (typeof localStorage === 'undefined') return fallback;

  try {
    const stored = JSON.parse(
      localStorage.getItem(SUCCESSION_STORAGE_KEY) || 'null',
    );
    if (!stored || typeof stored !== 'object') return fallback;

    const umaIds = new Set(data.umas.map((uma) => uma.id));
    const validAptitudes = new Set<FactorKey>(ALL_APTITUDES);
    const excludedUmaIds: number[] = [
      ...new Set<number>(
        (Array.isArray(stored.excludedUmaIds) ? stored.excludedUmaIds : [])
          .map(Number)
          .filter((id: number) => umaIds.has(id)),
      ),
    ];
    const excludedCapturedSelectionIds = [
      ...new Set<string>(
        (
          Array.isArray(stored.excludedCapturedSelectionIds)
            ? stored.excludedCapturedSelectionIds
            : []
        )
          .map(String)
          .filter(Boolean),
      ),
    ];
    const storedTargetId = Number(stored.targetId);
    const targetId = umaIds.has(storedTargetId) ? storedTargetId : 0;
    const lineage = { ...INITIAL_LINEAGE };
    (Object.keys(lineage) as LineageSlot[]).forEach((slot) => {
      const value = Number(stored.lineage?.[slot]);
      lineage[slot] = umaIds.has(value) ? value : 0;
    });

    const routes = { ...INITIAL_ROUTES };
    (Object.keys(routes) as BranchKey[]).forEach((branch) => {
      const value = stored.routes?.[branch];
      if (ROUTES.some((route) => route.id === value)) routes[branch] = value;
    });

    const routeMinimums: RouteMinimums = {
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    };
    (Object.keys(routeMinimums) as BranchKey[]).forEach((branch) => {
      const storedMinimums = stored.routeMinimums?.[branch];
      if (typeof storedMinimums === 'number') {
        if ([4, 5, 6, 7].includes(storedMinimums)) {
          ALL_APTITUDES.forEach((type) => {
            routeMinimums[branch][type] = storedMinimums;
          });
        }
        return;
      }
      ALL_APTITUDES.forEach((type) => {
        const value = Number(storedMinimums?.[type]);
        if ([4, 5, 6, 7].includes(value)) {
          routeMinimums[branch][type] = value;
        }
      });
    });

    const slotRouteOverrides: SlotRouteOverrides = {};
    (Object.keys(INITIAL_LINEAGE) as LineageSlot[]).forEach((slot) => {
      const storedOverride = stored.slotRouteOverrides?.[slot];
      if (
        !storedOverride ||
        !ROUTES.some((route) => route.id === storedOverride.routeId)
      ) {
        return;
      }
      const minimums = { ...DEFAULT_APTITUDE_MINIMUMS };
      ALL_APTITUDES.forEach((type) => {
        const value = Number(storedOverride.minimums?.[type]);
        if ([4, 5, 6, 7].includes(value)) minimums[type] = value;
      });
      slotRouteOverrides[slot] = {
        routeId: storedOverride.routeId,
        minimums,
      };
    });

    const trainedUmaSettings: TrainedUmaSettings = {};
    const parseTrainedMember = (value: any): TrainedLineageMember | null => {
      const umaId = Number(value?.umaId);
      const type = value?.factor?.type;
      const stars = Number(value?.factor?.stars);
      const routeId = value?.routeId;
      if (
        !umaIds.has(umaId) ||
        !validAptitudes.has(type) ||
        (stars !== 1 && stars !== 2 && stars !== 3) ||
        !ROUTES.some((route) => route.id === routeId)
      ) {
        return null;
      }
      return {
        umaId,
        cardId: Number(value?.cardId || 0) || undefined,
        factor: { type, stars: stars as 1 | 2 | 3 },
        routeId,
        winSaddleIds: normalizedSaddleIds(value?.winSaddleIds),
      };
    };
    (Object.keys(INITIAL_LINEAGE) as LineageSlot[]).forEach((slot) => {
      const storedSetting = stored.trainedUmaSettings?.[slot];
      const self = parseTrainedMember(storedSetting?.self);
      const firstParent = parseTrainedMember(storedSetting?.parents?.[0]);
      const secondParent = parseTrainedMember(storedSetting?.parents?.[1]);
      if (!self || !firstParent || !secondParent) return;
      if (
        new Set([self.umaId, firstParent.umaId, secondParent.umaId]).size < 3
      ) {
        return;
      }
      trainedUmaSettings[slot] = {
        self,
        parents: [firstParent, secondParent],
        source: storedSetting?.source === 'rental' ? 'rental' : 'own',
        selectionId: String(storedSetting?.selectionId || ''),
        viewerId: Number(storedSetting?.viewerId || 0),
      };
    });

    const targetUma = data.umas.find((uma) => uma.id === targetId);
    const inheritanceTargets: InheritanceTargets = {};
    ALL_APTITUDES.forEach((type) => {
      const base = targetUma?.aptitudes[type];
      const value = Number(stored.inheritanceTargets?.[type]);
      if (
        base &&
        Number.isInteger(value) &&
        value > base &&
        value <= Math.min(7, base + FACTOR_STEPS.length - 1)
      ) {
        inheritanceTargets[type] = value;
      }
    });

    const storedInheritanceValues = Array.isArray(stored.inheritanceAptitudes)
      ? stored.inheritanceAptitudes
      : [
          ...(stored.inheritanceAptitudes?.paternal || []),
          ...(stored.inheritanceAptitudes?.maternal || []),
        ];
    const validValues = [
      ...new Set(
        storedInheritanceValues.filter((value: unknown): value is FactorKey =>
          validAptitudes.has(value as FactorKey),
        ),
      ),
    ];
    const inheritanceAptitudes = ALL_APTITUDES.filter(
      (type) =>
        validValues.includes(type) ||
        Object.prototype.hasOwnProperty.call(
          stored.inheritanceTargets || {},
          type,
        ),
    );
    const storedRunningStyleStars = Number(
      typeof stored.runningStyleStars === 'object'
        ? (stored.runningStyleStars?.paternal ??
            stored.runningStyleStars?.maternal)
        : stored.runningStyleStars,
    );
    const runningStyleStars = [1, 4, 7, 10].includes(storedRunningStyleStars)
      ? storedRunningStyleStars
      : 1;
    const allowInRaceFactorJump = stored.allowInRaceFactorJump === true;
    const capturedReuseMode: CapturedReuseMode =
      stored.capturedReuseMode === 'all' ||
      stored.capturedReuseMode === 'parents'
        ? 'parents'
        : 'off';
    const capturedBlueFactorMinimums = {
      ...INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS,
    };
    BLUE_FACTOR_KEYS.forEach((type) => {
      const stars = Number(stored.capturedBlueFactorMinimums?.[type]);
      if (Number.isInteger(stars) && stars >= 0 && stars <= 18) {
        const next = { ...capturedBlueFactorMinimums, [type]: stars };
        if (capturedBlueFactorMinimumSlotCount(next) <= 6) {
          capturedBlueFactorMinimums[type] = stars;
        }
      }
    });
    const capturedFactorTargets = (
      Array.isArray(stored.capturedFactorTargets)
        ? stored.capturedFactorTargets
        : []
    ).flatMap((target: any) => {
      const kind = target?.kind as CapturedFactorTargetKind;
      const groupId = Number(target?.groupId || 0);
      if (!groupId || kind !== 'skill') {
        return [];
      }
      return [{ kind, groupId }];
    });
    const fixedDressSlots: FixedDressSlots = {};
    (Object.keys(INITIAL_LINEAGE) as LineageSlot[]).forEach((slot) => {
      const storedValue = stored.fixedDressSlots?.[slot];
      const cardId = Number(
        storedValue === true
          ? trainedUmaSettings[slot]?.self.cardId || 0
          : storedValue || 0,
      );
      if (cardId) fixedDressSlots[slot] = cardId;
    });
    const storedJumpMinimumRank = Number(stored.inRaceFactorJumpMinimumRank);
    const inRaceFactorJumpMinimumRank = [3, 4, 5, 6].includes(
      storedJumpMinimumRank,
    )
      ? storedJumpMinimumRank
      : 6;
    if (targetUma) {
      inheritanceAptitudes.forEach((type) => {
        const base = targetUma.aptitudes[type];
        if (base >= 7 || inheritanceTargets[type]) return;
        const stars =
          type === 'nige' ||
          type === 'senko' ||
          type === 'sashi' ||
          type === 'oikomi'
            ? runningStyleStars
            : 1;
        inheritanceTargets[type] = Math.min(
          7,
          base + Math.max(0, FACTOR_STEPS.indexOf(stars)),
        );
      });
    }

    return {
      targetId,
      lineage,
      routes,
      routeMinimums,
      inheritanceAptitudes,
      inheritanceTargets,
      allowInRaceFactorJump,
      inRaceFactorJumpMinimumRank,
      excludedUmaIds,
      excludedCapturedSelectionIds,
      slotRouteOverrides,
      trainedUmaSettings,
      capturedReuseMode,
      capturedBlueFactorMinimums,
      capturedFactorTargets,
      fixedDressSlots,
    };
  } catch {
    return fallback;
  }
}

function assetUrl(path?: string | null) {
  if (!path) return '';
  return path.replace(/^\/+/, '');
}

function capturedFactorTargetKey(target: CapturedFactorTarget) {
  return `${target.kind}:${target.groupId}`;
}

export function capturedSelectedSkillFactorCount(
  factors: CapturedInheritanceFactor[],
  targets: CapturedFactorTarget[],
  factorMeta: Record<number, SuccessionFactorMeta>,
) {
  if (!targets.length) return 0;
  return factors.filter((factor) => {
    const meta = factorMeta[factor.id];
    return (
      meta &&
      targets.some((target) => meta.skillGroupIds.includes(target.groupId))
    );
  }).length;
}

type CapturedFactorTargetOption = CapturedFactorTarget & {
  name: string;
  iconId: number;
  availableCount: number;
};

function CapturedSkillPriorityEditor({
  options,
  selected,
  onAdd,
  onRemove,
  onReorder,
  disabled,
}: {
  options: CapturedFactorTargetOption[];
  selected: CapturedFactorTarget[];
  onAdd: () => void;
  onRemove: (target: CapturedFactorTarget) => void;
  onReorder: (sourceKey: string, targetKey: string) => void;
  disabled: boolean;
}) {
  const [draggedKey, setDraggedKey] = useState('');
  const optionByKey = new Map(
    options.map((option) => [capturedFactorTargetKey(option), option]),
  );
  return (
    <div
      className={`successionCapturedSkillPriority${disabled ? ' disabled' : ''}`}
      aria-disabled={disabled}
    >
      <header>
        <div>
          <strong>目标技能优先级</strong>
          <small>
            基础综合概率相同时，依次优先选择前面技能获得概率更高的路线。可拖动调整顺序。
          </small>
        </div>
        <button type="button" disabled={disabled} onClick={onAdd}>
          <Plus size={15} aria-hidden="true" />
          添加技能
        </button>
      </header>
      <div className="successionCapturedSkillPriorityList">
        {selected.map((target, index) => {
          const key = capturedFactorTargetKey(target);
          const option = optionByKey.get(key);
          return (
            <div
              className={draggedKey === key ? 'dragging' : ''}
              draggable={!disabled}
              onDragStart={(event) => {
                setDraggedKey(key);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', key);
              }}
              onDragOver={(event) => {
                if (!disabled) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                onReorder(
                  event.dataTransfer.getData('text/plain') || draggedKey,
                  key,
                );
                setDraggedKey('');
              }}
              onDragEnd={() => setDraggedKey('')}
              key={key}
            >
              <b>{index + 1}</b>
              <span className="successionCapturedSkillIcon">
                {option?.iconId ? (
                  <AssetIcon
                    path={`skill_icons/${option.iconId}.png`}
                    alt=""
                    className="successionCapturedSkillIconImage"
                  />
                ) : (
                  <i>技</i>
                )}
              </span>
              <span className="successionCapturedSkillCopy">
                <strong>{option?.name || `技能组 ${target.groupId}`}</strong>
              </span>
              <GripVertical size={18} aria-label="拖动调整优先级" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(target)}
                title="移除技能"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {!selected.length && (
          <button type="button" disabled={disabled} onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            添加希望优先获得的技能
          </button>
        )}
      </div>
    </div>
  );
}

function CapturedBlueFactorMinimumEditor({
  minimums,
  onChange,
  disabled,
}: {
  minimums: CapturedBlueFactorMinimums;
  onChange: (type: BlueFactorKey, stars: number) => void;
  disabled: boolean;
}) {
  const usedSlots = capturedBlueFactorMinimumSlotCount(minimums);
  return (
    <div className="successionCapturedBlueRequirements">
      <header>
        <div>
          <strong>属性因子总星数最低要求</strong>
        </div>
        <b>{usedSlots} / 6 槽</b>
      </header>
      <div className="successionCapturedBlueRequirementGrid">
        {BLUE_FACTOR_KEYS.map((type) => {
          const stars = minimums[type];
          const increased = { ...minimums, [type]: stars + 1 };
          const canIncrease =
            stars < 18 && capturedBlueFactorMinimumSlotCount(increased) <= 6;
          return (
            <div className="successionCapturedBlueRequirement" key={type}>
              <span>{BLUE_FACTOR_LABELS[type]}</span>
              <div>
                <button
                  type="button"
                  aria-label={`降低${BLUE_FACTOR_LABELS[type]}因子总星数`}
                  disabled={disabled || stars <= 0}
                  onClick={() => onChange(type, Math.max(0, stars - 1))}
                >
                  −
                </button>
                <b>{stars}★</b>
                <button
                  type="button"
                  aria-label={`提高${BLUE_FACTOR_LABELS[type]}因子总星数`}
                  disabled={disabled || !canIncrease}
                  onClick={() => onChange(type, stars + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function rankLabel(value: number) {
  return RANKS[Math.max(0, Math.min(8, value))] || '-';
}

function minimumStarsForRank(base: number, target: number) {
  const raises = Math.max(0, target - base);
  if (!raises) return 0;
  return FACTOR_STEPS[raises] ?? null;
}

function maximumInheritedRank(base: number) {
  return Math.min(7, base + FACTOR_STEPS.length - 1);
}

function minimumRouteRank(base: number) {
  return Math.min(7, Math.max(4, base));
}

function routeMinimumSlotCount(
  uma: SuccessionUma,
  route: Route,
  minimums: AptitudeMinimums,
) {
  return route.aptitudes.reduce((total, type) => {
    const stars = minimumStarsForRank(uma.aptitudes[type], minimums[type]);
    return (
      total +
      (stars === null ? MAX_INHERITANCE_SLOTS + 1 : factorSlotsForStars(stars))
    );
  }, 0);
}

function fitMinimumsForUma(
  minimums: AptitudeMinimums,
  uma: SuccessionUma,
  route: Route,
): AptitudeMinimums {
  const fitted = Object.fromEntries(
    ALL_APTITUDES.map((type) => [
      type,
      Math.max(
        minimumRouteRank(uma.aptitudes[type]),
        Math.min(minimums[type], maximumInheritedRank(uma.aptitudes[type])),
      ),
    ]),
  ) as AptitudeMinimums;

  while (routeMinimumSlotCount(uma, route, fitted) > MAX_INHERITANCE_SLOTS) {
    const reduction = route.aptitudes
      .map((type, index) => {
        if (fitted[type] <= 4) return null;
        const currentStars = minimumStarsForRank(
          uma.aptitudes[type],
          fitted[type],
        );
        const reducedStars = minimumStarsForRank(
          uma.aptitudes[type],
          fitted[type] - 1,
        );
        if (currentStars === null || reducedStars === null) return null;
        const savedSlots =
          factorSlotsForStars(currentStars) - factorSlotsForStars(reducedStars);
        return savedSlots > 0
          ? { type, savedSlots, base: uma.aptitudes[type], index }
          : null;
      })
      .filter(
        (
          item,
        ): item is {
          type: AptitudeKey;
          savedSlots: number;
          base: number;
          index: number;
        } => Boolean(item),
      )
      .sort(
        (a, b) =>
          b.savedSlots - a.savedSlots || b.base - a.base || b.index - a.index,
      )[0];
    if (!reduction) break;
    fitted[reduction.type] -= 1;
  }

  return fitted;
}

function factorSlotsForStars(stars: number) {
  return stars > 0 ? Math.ceil(stars / 3) : 0;
}

function factorAssignmentKey(assignment: FactorAssignment) {
  return [
    assignment.type,
    assignment.stars,
    assignment.free ? 'free' : 'required',
    assignment.unconstrained ? 'unconstrained' : 'typed',
  ].join(':');
}

function effectiveFactorRoleKey(assignment: FactorAssignment) {
  return assignment.unconstrained
    ? `free:${assignment.stars}`
    : `${assignment.type}:${assignment.stars}`;
}

function inheritanceAllocation(
  target: SuccessionUma,
  selected: FactorKey[],
  targets: InheritanceTargets,
) {
  return selected.map((type) => {
    const base = target.aptitudes[type];
    const targetRank =
      base >= 7 ? base : Math.max(base + 1, targets[type] || base + 1);
    const stars = base >= 7 ? 1 : minimumStarsForRank(base, targetRank) || 1;
    return {
      type,
      base,
      target: targetRank,
      stars,
      slots: factorSlotsForStars(stars),
    };
  });
}

function createTargetFactorPlanEnumerator(
  selected: FactorKey[],
  minimumStars: Partial<Record<FactorKey, number>>,
): TargetFactorPlanEnumerator {
  if (!selected.length) {
    const plan: TargetFactorPlan = {
      assignments: Object.fromEntries(
        TARGET_FACTOR_SLOTS.map((slot) => [
          slot,
          {
            type: 'turf' as const,
            stars: 3 as const,
            free: true,
            unconstrained: true,
          },
        ]),
      ) as Record<LineageSlot, FactorAssignment>,
    };
    return {
      total: 1,
      getRange: (offset, limit) => (offset === 0 && limit > 0 ? [plan] : []),
    };
  }

  const requiredTokenGroups: FactorAssignment[][] = [
    selected.flatMap((type) =>
      Array.from(
        { length: factorSlotsForStars(minimumStars[type] || 1) },
        () => ({ type, stars: 3 as const, free: false }),
      ),
    ),
  ];

  const requiredSlots = requiredTokenGroups[0]?.length || 0;
  const freeSlots = Math.max(0, MAX_INHERITANCE_SLOTS - requiredSlots);
  const freeTokens: FactorAssignment[] = Array.from(
    { length: freeSlots },
    () => ({ type: selected[0], stars: 3, free: true }),
  );

  const plans: TargetFactorPlan[] = [];
  const seenPlans = new Set<string>();
  const assignmentOrderKey = (assignment: FactorAssignment) =>
    assignment.free
      ? `1:free:${assignment.stars}`
      : `0:${String(ALL_APTITUDES.indexOf(assignment.type)).padStart(
          2,
          '0',
        )}:${assignment.stars}`;
  const appendUniquePermutations = (tokens: FactorAssignment[]) => {
    const tokenCounts = new Map<
      string,
      { token: FactorAssignment; count: number }
    >();
    tokens.forEach((token) => {
      const key = token.free
        ? `free:${token.stars}`
        : `${token.type}:${token.stars}:required`;
      const current = tokenCounts.get(key);
      if (current) current.count += 1;
      else tokenCounts.set(key, { token, count: 1 });
    });
    const entries = [...tokenCounts.values()];
    const permutation: FactorAssignment[] = [];
    const visit = () => {
      if (permutation.length === TARGET_FACTOR_SLOTS.length) {
        const key = permutation
          .map((assignment) =>
            assignment.free
              ? `free:${assignment.stars}`
              : `${assignment.type}:${assignment.stars}:required`,
          )
          .join('|');
        if (seenPlans.has(key)) return;
        seenPlans.add(key);
        plans.push({
          assignments: Object.fromEntries(
            TARGET_FACTOR_SLOTS.map((slot, index) => [
              slot,
              permutation[index],
            ]),
          ) as Record<LineageSlot, FactorAssignment>,
        });
        return;
      }
      entries.forEach((entry) => {
        if (!entry.count) return;
        const position = permutation.length;
        const isSecondInUnorderedPair = position === 3 || position === 5;
        if (
          isSecondInUnorderedPair &&
          assignmentOrderKey(permutation[position - 1]) >
            assignmentOrderKey(entry.token)
        ) {
          return;
        }
        entry.count -= 1;
        permutation.push(entry.token);
        visit();
        permutation.pop();
        entry.count += 1;
      });
    };
    visit();
  };

  requiredTokenGroups.forEach((requiredTokens) => {
    appendUniquePermutations([...requiredTokens, ...freeTokens]);
  });

  return {
    total: plans.length,
    getRange: (offset, limit) => plans.slice(offset, offset + limit),
  };
}

type FactorDemand = Partial<Record<FactorKey, number>>;

function factorDemandForUma(
  uma: SuccessionUma,
  route: Route,
  minimums: AptitudeMinimums,
  producedType?: FactorKey,
  factorProductionMinimumRank = 7,
) {
  const demand: FactorDemand = {};
  const impossible: FactorKey[] = [];
  const types = [
    ...new Set([...route.aptitudes, ...(producedType ? [producedType] : [])]),
  ];
  types.forEach((type) => {
    const targetRank = Math.max(
      route.aptitudes.includes(type) ? minimums[type] : 0,
      type === producedType ? factorProductionMinimumRank : 0,
    );
    const stars = minimumStarsForRank(uma.aptitudes[type], targetRank);
    if (
      type === producedType &&
      targetRank < 7 &&
      uma.aptitudes[type] < 7 &&
      stars === 0
    ) {
      // 没有对应红因子时不存在局内继续提升到 A 的触发来源。
      impossible.push(type);
      return;
    }
    if (stars === null) impossible.push(type);
    else if (stars > 0) demand[type] = stars;
  });
  return { demand, impossible };
}

function remainingFactorDemand(
  demand: FactorDemand,
  assignments: Array<{
    type: FactorKey;
    stars: number;
    unconstrained?: boolean;
  }>,
): FactorDemand {
  const remaining: FactorDemand = {};
  ALL_APTITUDES.forEach((type) => {
    const contribution = assignments.reduce(
      (total, assignment) =>
        total +
        (!assignment.unconstrained && assignment.type === type
          ? assignment.stars
          : 0),
      0,
    );
    const value = Math.max(0, (demand[type] || 0) - contribution);
    if (value > 0) remaining[type] = value;
  });
  return remaining;
}

function demandSlotCount(demand: FactorDemand) {
  return ALL_APTITUDES.reduce(
    (total, type) => total + factorSlotsForStars(demand[type] || 0),
    0,
  );
}

function demandSatisfied(
  demand: FactorDemand,
  assignments: Array<{
    type: FactorKey;
    stars: number;
    unconstrained?: boolean;
  }>,
) {
  return ALL_APTITUDES.every((type) => {
    const supplied = assignments.reduce(
      (total, assignment) =>
        total +
        (!assignment.unconstrained && assignment.type === type
          ? assignment.stars
          : 0),
      0,
    );
    return supplied >= (demand[type] || 0);
  });
}

export function capturedUmaMatchesGeneratedCandidate(
  candidate: CapturedTrainedUma,
  position: Pick<
    CompleteDesignPosition,
    'uma' | 'factor' | 'minimumDemand' | 'cumulativeDemand'
  >,
) {
  if (!position.uma || candidate.umaId !== position.uma.id) return false;
  if (
    !position.factor.free &&
    !position.factor.unconstrained &&
    (candidate.factor.type !== position.factor.type ||
      candidate.factor.stars < position.factor.stars)
  ) {
    return false;
  }

  const directParentFactors = candidate.parents.map((parent) => parent.factor);
  if (!demandSatisfied(position.minimumDemand || {}, directParentFactors)) {
    return false;
  }

  const totalDemand: FactorDemand = {};
  ALL_APTITUDES.forEach((type) => {
    const stars =
      (position.minimumDemand?.[type] || 0) +
      (position.cumulativeDemand?.[type] || 0);
    if (stars > 0) totalDemand[type] = stars;
  });
  return demandSatisfied(
    totalDemand,
    candidate.lineageFactors?.length
      ? candidate.lineageFactors
      : directParentFactors,
  );
}

function FactorIcon({
  type,
  compact = false,
}: {
  type: AptitudeKey;
  compact?: boolean;
}) {
  return (
    <img
      className={`successionFactorIcon ${compact ? 'compact' : ''}`}
      src={assetUrl(FACTOR_ICON_PATHS[type])}
      alt={`${APTITUDE_LABELS[type]}因子`}
    />
  );
}

function RankIcon({
  value,
  compact = false,
}: {
  value: number;
  compact?: boolean;
}) {
  const rank = rankLabel(value);
  const path = RANK_ICON_PATHS[rank];
  return path ? (
    <img
      className={`successionRankIcon ${compact ? 'compact' : ''}`}
      src={assetUrl(path)}
      alt={rank}
    />
  ) : (
    <strong className="successionRankFallback">{rank}</strong>
  );
}

function UmaPortrait({
  uma,
  large = false,
}: {
  uma?: SuccessionUma;
  large?: boolean;
}) {
  if (!uma) {
    return (
      <span className={`successionPortrait empty ${large ? 'large' : ''}`}>
        ?
      </span>
    );
  }
  return uma.icon ? (
    <img
      className={`successionPortrait ${large ? 'large' : ''}`}
      src={assetUrl(uma.icon)}
      alt=""
      loading="lazy"
    />
  ) : (
    <span className={`successionPortrait fallback ${large ? 'large' : ''}`}>
      {uma.name.slice(0, 1)}
    </span>
  );
}

function UmaAptitudeRows({
  uma,
  picker = false,
}: {
  uma: SuccessionUma;
  picker?: boolean;
}) {
  return (
    <div className={`successionAptitudeRows ${picker ? 'picker' : 'compact'}`}>
      {APTITUDE_GROUPS.map((group) => (
        <div
          className="successionAptitudeRow"
          aria-label={group.label}
          key={group.label}
        >
          <div>
            {group.types.map((type) => (
              <span key={type} title={APTITUDE_LABELS[type]}>
                <small>{APTITUDE_SHORT_LABELS[type]}</small>
                <RankIcon value={uma.aptitudes[type]} compact />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function compatibilityTitle(compatibility: PositionCompatibilityScore) {
  if (compatibility.inheritedTotal === undefined) {
    const relationLabel = (compatibility.relationNames || []).join('、');
    const racePartnerName = compatibility.relationNames?.at(-1);
    const g1Label =
      compatibility.g1Source === 'detailed' && racePartnerName
        ? `和${racePartnerName}的胜鞍共同 G1`
        : '路线估算共同 G1';
    return `${relationLabel}相性 ${compatibility.base} + ${g1Label} ${compatibility.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${compatibility.total}`;
  }

  const ancestorDetails = (compatibility.ancestorDetails || []).filter(
    (detail) => detail.umaName,
  );
  const targetName = compatibility.relationNames?.[0] || '目标马娘';
  const totalParts = [compatibility.ownTotal || 0];
  if (compatibility.coParentName) {
    totalParts.push(compatibility.coParentTotal || 0);
  }
  if (ancestorDetails.length) {
    totalParts.push(compatibility.inheritedTotal || 0);
  }
  return [
    `自身：与${targetName}相性 ${compatibility.base}`,
    ...(compatibility.coParentName
      ? [
          `亲代：与${compatibility.coParentLabel || '另一亲代'} ${compatibility.coParentName}相性 ${compatibility.coParentBase || 0}`,
        ]
      : []),
    ...ancestorDetails.map(
      (detail) =>
        `${detail.label}：${detail.umaName || ''}基础相性 ${detail.base}\n${detail.g1Source === 'detailed' && detail.umaName ? `和${detail.umaName}的胜鞍` : '路线估算胜鞍'}：共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${detail.total}`,
    ),
    `总计：${totalParts.join(' + ')} = ${compatibility.total}`,
  ].join('\n');
}

function UmaSelect({
  label,
  value,
  onChange,
  required = false,
  exclude = [],
  compatibility,
  footer,
  modeSelector,
  openRequest,
  displayOnly = false,
  onClear,
  titleActions,
  portrait,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
  exclude?: number[];
  compatibility?: PositionCompatibilityScore;
  footer?: ReactNode;
  modeSelector?: ReactNode;
  openRequest?: number;
  displayOnly?: boolean;
  onClear?: () => void;
  titleActions?: ReactNode;
  portrait?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = data.umas.find((uma) => uma.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const options = data.umas.filter((uma) => {
    if (uma.id === value) return true;
    return (
      !normalizedQuery ||
      uma.name.toLocaleLowerCase().includes(normalizedQuery) ||
      String(uma.id).includes(normalizedQuery)
    );
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const chooseUma = (umaId: number) => {
    onChange(umaId);
    setOpen(false);
  };
  const clearSearch = () => setQuery('');

  useEffect(() => {
    if (openRequest === undefined || openRequest <= 0) return;
    setOpen(true);
  }, [openRequest]);

  return (
    <div
      className={`successionUmaSelect ${selected ? 'selected' : ''}${modeSelector ? ' withModeSelector' : ''}`}
    >
      <div className="successionUmaSelectTitle">
        <span>{!selected && modeSelector ? '未设置' : label}</span>
        {selected && (titleActions || !displayOnly || onClear) && (
          <div className="successionUmaSelectActions">
            {titleActions}
            {(!displayOnly || onClear) && (
              <button
                type="button"
                onClick={() => (onClear ? onClear() : onChange(0))}
                aria-label={`清除${label}`}
              >
                清除
              </button>
            )}
          </div>
        )}
      </div>
      {(selected || !modeSelector) && (
        <button
          type="button"
          className="successionUmaTrigger"
          aria-label={label}
          disabled={displayOnly}
          onClick={() => setOpen(true)}
        >
          {selected ? (
            <Fragment>
              {portrait || <UmaPortrait uma={selected} />}
              <div className="successionSelectedUma">
                <strong>{selected.name}</strong>
                <UmaAptitudeRows uma={selected} />
              </div>
              {compatibility && (
                <span
                  className="successionUmaCompatibility"
                  title={compatibilityTitle(compatibility)}
                >
                  <small>相性</small>
                  <strong>{compatibility.total}</strong>
                </span>
              )}
            </Fragment>
          ) : (
            <Fragment>
              {required && <span className="successionPortrait empty">+</span>}
              <div className="successionUmaPlaceholder">
                <strong>{required ? '请选择马娘' : '不固定'}</strong>
              </div>
            </Fragment>
          )}
        </button>
      )}
      {modeSelector}
      {selected && footer}

      {open && (
        <div
          className="successionPickerOverlay"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="successionPickerDialog"
            role="dialog"
            aria-modal="true"
            aria-label={`选择${label}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="successionPickerHeader">
              <div>
                <span>SELECT UMAMUSUME</span>
                <h3>选择{label}</h3>
                <p>输入名称或 ID 搜索，点击头像完成选择。</p>
              </div>
              <button
                type="button"
                className="successionPickerClose"
                aria-label="关闭选择界面"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="successionPickerToolbar">
              <label className="successionPickerSearch">
                <input
                  type="text"
                  value={query}
                  autoFocus
                  placeholder="输入马娘名称或 ID"
                  aria-label={`搜索${label}`}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
              <div className="successionPickerMeta">
                <span>找到 {options.length} 位马娘</span>
                {query && (
                  <button type="button" onClick={clearSearch}>
                    清空搜索
                  </button>
                )}
                {!required && value !== 0 && (
                  <button type="button" onClick={() => chooseUma(0)}>
                    设为不固定
                  </button>
                )}
              </div>
            </div>

            <div className="successionPickerGrid">
              {options.length ? (
                options.map((uma) => {
                  const selected = uma.id === value;
                  const occupied = !selected && exclude.includes(uma.id);
                  return (
                    <button
                      type="button"
                      className={`successionPickerCard ${selected ? 'selected' : ''} ${occupied ? 'occupied' : ''}`}
                      aria-label={
                        occupied
                          ? `${uma.name}，已在其他位置选择`
                          : `选择${uma.name}`
                      }
                      disabled={occupied}
                      onClick={() => chooseUma(uma.id)}
                      key={uma.id}
                    >
                      <UmaPortrait uma={uma} large />
                      <div className="successionPickerCardBody">
                        <strong>{uma.name}</strong>
                        <UmaAptitudeRows uma={uma} picker />
                      </div>
                      {selected && <em aria-label="当前选择">✓</em>}
                      {occupied && (
                        <em className="occupied" aria-label="已在其他位置选择">
                          已选择
                        </em>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="successionPickerEmpty">
                  <strong>没有符合条件的马娘</strong>
                  <p>尝试修改名称、ID，或清空搜索。</p>
                  <button type="button" onClick={clearSearch}>
                    清空搜索
                  </button>
                </div>
              )}
            </div>
            <footer className="successionPickerFooter">
              <span>当前显示 {options.length} 位马娘</span>
              <button type="button" onClick={() => setOpen(false)}>
                完成
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function BranchRouteCard({
  branch,
  route,
  minimums,
  uma,
  onRouteChange,
  onMinimumChange,
  settingLabel,
  compact = false,
  trained = false,
  followsDefault = false,
  onReset,
}: {
  branch: BranchKey;
  route: Route;
  minimums: AptitudeMinimums;
  uma?: SuccessionUma;
  onRouteChange: (value: string) => void;
  onMinimumChange: (type: AptitudeKey, value: number) => void;
  settingLabel?: string;
  compact?: boolean;
  trained?: boolean;
  followsDefault?: boolean;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const branchLabel = branch === 'paternal' ? '父系' : '母系';
  const displayLabel = settingLabel || branchLabel;
  const routeFactorRequirements = uma
    ? route.aptitudes
        .map((type) => ({
          type,
          stars: minimumStarsForRank(uma.aptitudes[type], minimums[type]),
        }))
        .filter(
          (item): item is { type: AptitudeKey; stars: number } =>
            item.stars !== null && item.stars > 0,
        )
    : [];
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div
        className={`successionRouteCard ${branch}${compact ? ' compact' : ''}`}
      >
        <button
          type="button"
          className="successionRouteSummaryButton"
          aria-label={`设置${displayLabel}赛程`}
          onClick={() => setOpen(true)}
        >
          <header>
            <span className={compact ? '' : 'successionDefaultRouteLabel'}>
              {trained
                ? '育成赛程'
                : compact
                  ? '单独赛程'
                  : `${branchLabel}默认赛程`}
            </span>
            <strong>
              {route.id === 'none' ? '暂不规划' : route.shortName}
            </strong>
          </header>
          <div className="successionRouteSummaryNeeds">
            {trained ? (
              <span>{route.g1Count} 场 G1</span>
            ) : route.aptitudes.length ? (
              route.aptitudes.map((type) => (
                <span key={type}>
                  <b>{APTITUDE_LABELS[type]}</b>
                  <i>≥</i>
                  <RankIcon value={minimums[type]} compact />
                </span>
              ))
            ) : (
              <span>不设置赛程适性要求</span>
            )}
          </div>
        </button>
      </div>

      {open && (
        <div
          className="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            className="successionInheritanceModal successionRouteModal"
            role="dialog"
            aria-modal="true"
            aria-label={`设置${displayLabel}赛程`}
          >
            <header>
              <div>
                <span>RACE SCHEDULE</span>
                <h3>{displayLabel}赛程设置</h3>
              </div>
              <button
                type="button"
                aria-label={`关闭${displayLabel}赛程设置`}
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="successionRouteModalBody">
              <section className="successionRouteModalPresets">
                <header>
                  <strong>选择赛程</strong>
                  <span>
                    {trained
                      ? '记录实际参加的赛程，用于计算共同 G1 相性'
                      : '赛程决定改马的适应性要求'}
                  </span>
                </header>
                <div role="radiogroup" aria-label={`${displayLabel}赛程`}>
                  {ROUTES.map((item) => (
                    <button
                      type="button"
                      role="radio"
                      className={item.id === route.id ? 'selected' : ''}
                      aria-checked={item.id === route.id}
                      onClick={() => onRouteChange(item.id)}
                      key={item.id}
                    >
                      <strong>
                        {item.id === 'none' ? '不规划' : item.shortName}
                      </strong>
                      <small>{item.g1Count} 场 G1</small>
                    </button>
                  ))}
                </div>
              </section>
              {trained ? (
                <div className="successionRouteModalEmpty">
                  已育成马娘不会再反推适性因子；这里的赛程仅用于计算与目标、父辈之间的共同
                  G1 相性。
                </div>
              ) : route.aptitudes.length ? (
                <section className="successionRouteAptitudeMinimums">
                  <header>
                    <strong>设置比赛的最低适应性</strong>
                    <span>
                      {uma
                        ? `因子槽位 ${routeMinimumSlotCount(uma, route, minimums)} / ${MAX_INHERITANCE_SLOTS}`
                        : '比赛的适应性要求决定其父代和祖代的因子'}
                    </span>
                  </header>
                  <div>
                    {APTITUDE_GROUPS.map((group) => {
                      const types = group.types.filter((type) =>
                        route.aptitudes.includes(type),
                      );
                      if (!types.length) return null;
                      return (
                        <section key={group.label}>
                          <span>{group.label}</span>
                          <div>
                            {types.map((type) => (
                              <div key={type}>
                                <strong>{APTITUDE_LABELS[type]}</strong>
                                <div
                                  role="radiogroup"
                                  aria-label={`${displayLabel}${APTITUDE_LABELS[type]}最低适性`}
                                >
                                  {[7, 6, 5, 4].map((value) => {
                                    const maximum = uma
                                      ? maximumInheritedRank(
                                          uma.aptitudes[type],
                                        )
                                      : 7;
                                    const minimum = uma
                                      ? minimumRouteRank(uma.aptitudes[type])
                                      : 4;
                                    const belowBase = value < minimum;
                                    const exceedsRank = value > maximum;
                                    const proposedMinimums = {
                                      ...minimums,
                                      [type]: value,
                                    };
                                    const currentSlots = uma
                                      ? routeMinimumSlotCount(
                                          uma,
                                          route,
                                          minimums,
                                        )
                                      : 0;
                                    const proposedSlots = uma
                                      ? routeMinimumSlotCount(
                                          uma,
                                          route,
                                          proposedMinimums,
                                        )
                                      : 0;
                                    const exceedsSlots = Boolean(
                                      uma &&
                                        proposedSlots > MAX_INHERITANCE_SLOTS &&
                                        proposedSlots > currentSlots,
                                    );
                                    const unavailable =
                                      belowBase || exceedsRank || exceedsSlots;
                                    const unavailableReason = belowBase
                                      ? `不能低于先天${rankLabel(uma!.aptitudes[type])}适性`
                                      : exceedsRank
                                        ? `最高只能提升至${rankLabel(maximum)}`
                                        : exceedsSlots
                                          ? `所有适性合计超过${MAX_INHERITANCE_SLOTS}个因子槽位`
                                          : '';
                                    return (
                                      <button
                                        type="button"
                                        role="radio"
                                        className={
                                          minimums[type] === value
                                            ? 'selected'
                                            : ''
                                        }
                                        disabled={unavailable}
                                        aria-checked={minimums[type] === value}
                                        aria-label={`${APTITUDE_LABELS[type]}最低${rankLabel(value)}${unavailableReason ? `，${unavailableReason}` : ''}`}
                                        title={
                                          unavailableReason
                                            ? uma && exceedsRank
                                              ? `先天${rankLabel(uma.aptitudes[type])}，${unavailableReason}`
                                              : unavailableReason
                                            : undefined
                                        }
                                        onClick={() =>
                                          onMinimumChange(type, value)
                                        }
                                        key={value}
                                      >
                                        <RankIcon value={value} compact />
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div className="successionRouteModalEmpty">
                  当前不规划赛程，不限制场地和距离适性。
                </div>
              )}
            </div>
            <footer className="successionRouteModalFooter">
              <div className="successionRouteFactorSummary">
                <strong>{trained ? '记录用途' : '需要的因子'}</strong>
                {trained ? (
                  <em>按实际赛程计算共同 G1 与继承相性</em>
                ) : uma ? (
                  routeFactorRequirements.length ? (
                    routeFactorRequirements.map((item) => (
                      <span key={item.type}>
                        <FactorIcon type={item.type} compact />
                        <b>{item.stars}★</b>
                      </span>
                    ))
                  ) : (
                    <em>无需额外适性因子</em>
                  )
                ) : (
                  <em>选择具体马娘后显示</em>
                )}
              </div>
              <div className="successionRouteModalActions">
                {onReset && !followsDefault && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      onReset();
                      setOpen(false);
                    }}
                  >
                    恢复默认
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)}>
                  完成
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function TrainedRedFactorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Pick<FactorAssignment, 'type' | 'stars'>;
  onChange: (value: Pick<FactorAssignment, 'type' | 'stars'>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftType, setDraftType] = useState<FactorKey>(value?.type || 'turf');
  const [draftStars, setDraftStars] = useState<1 | 2 | 3>(value?.stars || 3);
  const openEditor = () => {
    setDraftType(value?.type || 'turf');
    setDraftStars(value?.stars || 3);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`successionTrainedFactorButton${value ? ' configured' : ''}`}
        aria-label={`设置${label}的红因子`}
        onClick={openEditor}
      >
        <span>红因子</span>
        {value ? (
          <strong>
            <FactorIcon type={value.type} compact />
            <b>{value.stars}★</b>
          </strong>
        ) : (
          <em>未设置</em>
        )}
      </button>
      {open && (
        <div
          className="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section
            className="successionInheritanceModal successionTrainedFactorModal"
            role="dialog"
            aria-modal="true"
            aria-label={`设置${label}的红因子`}
          >
            <header>
              <div>
                <span>TRAINED RED FACTOR</span>
                <h3>{label}的红因子</h3>
              </div>
              <button
                type="button"
                aria-label="关闭红因子设置"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="successionTrainedFactorModalBody">
              <section>
                <strong>因子属性</strong>
                <div className="successionTrainedFactorTypes">
                  {APTITUDE_GROUPS.map((group) => (
                    <div key={group.label}>
                      <span>{group.label}</span>
                      <div>
                        {group.types.map((type) => (
                          <button
                            type="button"
                            className={draftType === type ? 'selected' : ''}
                            aria-pressed={draftType === type}
                            onClick={() => setDraftType(type)}
                            key={type}
                          >
                            <FactorIcon type={type} compact />
                            <b>{APTITUDE_LABELS[type]}</b>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <strong>因子星级</strong>
                <div
                  className="successionTrainedFactorStars"
                  role="radiogroup"
                  aria-label="红因子星级"
                >
                  {([1, 2, 3] as const).map((stars) => (
                    <button
                      type="button"
                      role="radio"
                      className={draftStars === stars ? 'selected' : ''}
                      aria-checked={draftStars === stars}
                      onClick={() => setDraftStars(stars)}
                      key={stars}
                    >
                      {stars}★
                    </button>
                  ))}
                </div>
              </section>
              <footer>
                <span>
                  当前：
                  <FactorIcon type={draftType} compact />
                  {APTITUDE_LABELS[draftType]} {draftStars}★
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ type: draftType, stars: draftStars });
                    setOpen(false);
                  }}
                >
                  保存
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function TrainedLineageMemberEditor({
  label,
  branch,
  member,
  exclude,
  onChange,
}: {
  label: string;
  branch: BranchKey;
  member: TrainedLineageMember;
  exclude: number[];
  onChange: (member: TrainedLineageMember) => void;
}) {
  const uma = data.umas.find((candidate) => candidate.id === member.umaId);
  const route = ROUTES.find((item) => item.id === member.routeId) || ROUTES[0];
  return (
    <div className="successionTrainedMemberEditor">
      <UmaSelect
        label={label}
        value={member.umaId}
        required
        exclude={exclude}
        onChange={(umaId) => onChange({ ...member, umaId })}
        footer={
          uma ? (
            <div className="successionLineageUmaDetails trained">
              <TrainedRedFactorInput
                label={`${label}（${uma.name}）`}
                value={member.factor}
                onChange={(factor) => onChange({ ...member, factor })}
              />
              <BranchRouteCard
                branch={branch}
                route={route}
                minimums={DEFAULT_APTITUDE_MINIMUMS}
                uma={uma}
                settingLabel={`${label}（${uma.name}）`}
                compact
                trained
                onRouteChange={(routeId) => onChange({ ...member, routeId })}
                onMinimumChange={() => undefined}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
}

function TrainedUmaSettingModal({
  slot,
  branch,
  currentUmaId,
  defaultRouteId,
  existing,
  exclude,
  onSave,
  onClose,
}: {
  slot: LineageSlot;
  branch: BranchKey;
  currentUmaId: number;
  defaultRouteId: string;
  existing?: TrainedUmaSetting;
  exclude: number[];
  onSave: (setting: TrainedUmaSetting) => void;
  onClose: () => void;
}) {
  const createMember = (umaId = 0): TrainedLineageMember => ({
    umaId,
    factor: { type: 'turf', stars: 3 },
    routeId: defaultRouteId,
  });
  const [setting, setSetting] = useState<TrainedUmaSetting>(
    existing || {
      self: createMember(currentUmaId),
      parents: [createMember(), createMember()],
    },
  );
  const members = [setting.self, ...setting.parents];
  const memberIds = members.map((member) => member.umaId).filter(Boolean);
  const complete = memberIds.length === 3 && new Set(memberIds).size === 3;
  const updateMember = (index: number, member: TrainedLineageMember) => {
    if (index === 0) {
      setSetting((current) => ({ ...current, self: member }));
      return;
    }
    setSetting((current) => ({
      ...current,
      parents: current.parents.map((item, parentIndex) =>
        parentIndex === index - 1 ? member : item,
      ) as [TrainedLineageMember, TrainedLineageMember],
    }));
  };
  const parentCodes = [`${SLOT_CODES[slot]}A`, `${SLOT_CODES[slot]}B`];
  const renderMemberEditor = (member: TrainedLineageMember, index: number) => {
    const allowedCurrentIds = new Set(memberIds);
    const memberExclude = [
      ...exclude.filter((id) => !allowedCurrentIds.has(id)),
      ...members
        .filter((_, memberIndex) => memberIndex !== index)
        .map((item) => item.umaId)
        .filter(Boolean),
    ];
    return (
      <TrainedLineageMemberEditor
        label={
          index === 0
            ? `${SLOT_LABELS[slot]}本人`
            : `父辈 ${parentCodes[index - 1]}`
        }
        branch={branch}
        member={member}
        exclude={[...new Set(memberExclude)]}
        onChange={(value) => updateMember(index, value)}
      />
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      className="successionInheritanceModalOverlay"
      role="presentation"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="successionInheritanceModal successionTrainedUmaModal"
        role="dialog"
        aria-modal="true"
        aria-label={`设置${SLOT_LABELS[slot]}已育成马娘`}
      >
        <header>
          <div>
            <span>TRAINED UMAMUSUME</span>
            <h3>设置{SLOT_LABELS[slot]}已育成马娘</h3>
          </div>
          <button
            type="button"
            aria-label="关闭已育成马娘设置"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="successionTrainedUmaModalBody">
          <div className="successionTrainedUmaTree">
            <div className="successionTrainedUmaTreeRoot">
              {renderMemberEditor(members[0], 0)}
            </div>
            <div className="successionTrainedUmaTreeChildren">
              {members.slice(1).map((member, index) => (
                <div className="successionTrainedUmaTreeChild" key={index}>
                  {renderMemberEditor(member, index + 1)}
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="successionTrainedUmaModalFooter">
          <span>
            {complete
              ? '本人和两位父辈已完整设置，保存后不再向上搜索。'
              : '请选择本人和两位不同的父辈马娘。'}
          </span>
          <div>
            <button type="button" className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              disabled={!complete}
              onClick={() => complete && onSave(setting)}
            >
              保存已育成马娘
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function capturedSetting(
  candidate: CapturedTrainedUma,
  routeId: string,
): TrainedUmaSetting {
  const member = (value: CapturedLineageMember): TrainedLineageMember => ({
    umaId: value.umaId,
    cardId: value.cardId,
    factor: { type: value.factor.type, stars: value.factor.stars },
    routeId,
    winSaddleIds: value.winSaddleIds,
  });
  return {
    self: member(candidate),
    parents: [member(candidate.parents[0]), member(candidate.parents[1])],
    source: candidate.source,
    selectionId: candidate.selectionId,
    viewerId: candidate.viewerId,
  };
}

function FixedDressPickerModal({
  umaId,
  selectedCardId,
  onSelect,
  onClose,
}: {
  umaId: number;
  selectedCardId?: number;
  onSelect: (cardId?: number) => void;
  onClose: () => void;
}) {
  const uma = data.umas.find((candidate) => candidate.id === umaId);
  const dresses = Object.values(UMDB.cards)
    .flatMap((card: any) => {
      const cardId = Number(card?.id || 0);
      return cardId && baseCharaId(cardId) === umaId
        ? [{ cardId, name: String(card?.name || `衣装 ${cardId}`) }]
        : [];
    })
    .sort((left, right) => left.cardId - right.cardId);

  return (
    <div className="successionPickerOverlay" onMouseDown={onClose}>
      <section
        className="successionPickerDialog successionFixedDressDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`选择${uma?.name || '马娘'}固定衣装`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="successionPickerHeader">
          <div>
            <h3>固定衣装</h3>
            <p>选择后，计算只会使用这名角色的指定换皮。</p>
          </div>
          <button
            type="button"
            className="successionPickerClose"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="successionFixedDressGrid">
          {dresses.map((dress) => {
            const selected = selectedCardId === dress.cardId;
            const iconPath = plannedDressIconPath(dress.cardId);
            return (
              <button
                type="button"
                className={`successionFixedDressOption${selected ? ' selected' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  onSelect(dress.cardId);
                  onClose();
                }}
                key={dress.cardId}
              >
                <span className="successionFixedDressPortrait">
                  {iconPath ? (
                    <AssetIcon
                      path={iconPath}
                      alt={dress.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UmaPortrait uma={uma} />
                  )}
                </span>
                <strong>{dress.name}</strong>
                <small>{dress.cardId}</small>
                {selected ? <Check size={15} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <footer className="successionFixedDressFooter">
          <button
            type="button"
            disabled={!selectedCardId}
            onClick={() => {
              onSelect(undefined);
              onClose();
            }}
          >
            取消固定衣装
          </button>
        </footer>
      </section>
    </div>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('copy failed');
}

function CapturedMemberPortrait({ member }: { member: CapturedLineageMember }) {
  const path = horseIconPath(member.cardId, member.rarity, member.raceClothId);
  const uma = data.umas.find((candidate) => candidate.id === member.umaId);
  return path ? (
    <span className="successionCapturedPortrait">
      <AssetIcon
        path={path}
        alt={member.name}
        className="h-full w-full object-cover"
        fallback={<UmaPortrait uma={uma} />}
      />
    </span>
  ) : (
    <UmaPortrait uma={uma} />
  );
}

function CapturedMemberDetails({ member }: { member: CapturedLineageMember }) {
  return (
    <div className="successionCapturedMemberDetails">
      <div className="successionCapturedFactorCounts">
        {member.blueFactor ? (
          <span className="stat">
            {member.blueFactor.name}{' '}
            <b>{'★'.repeat(member.blueFactor.stars)}</b>
          </span>
        ) : null}
        <span className="distance">
          {APTITUDE_LABELS[member.factor.type]}{' '}
          <b>{'★'.repeat(member.factor.stars)}</b>
        </span>
        {member.uniqueFactorStars ? (
          <span className="unique">
            固有 <b>{'★'.repeat(member.uniqueFactorStars)}</b>
          </span>
        ) : null}
        {member.whiteFactorCount > 0 ? (
          <span className="white">白因子 ×{member.whiteFactorCount}</span>
        ) : null}
      </div>
    </div>
  );
}

export function capturedDetailFactorOrder(
  factors: CapturedInheritanceFactor[],
  blueFactorId: number | undefined,
  aptitudeFactorId: number,
  factorMeta: Record<number, SuccessionFactorMeta> = {},
) {
  const remainingFactors = factors.filter(
    (factor) =>
      factor.id !== blueFactorId && factor.id !== aptitudeFactorId,
  );
  const isUnique = (factor: CapturedInheritanceFactor) =>
    factor.id >= 10_000_000 || factorMeta[factor.id]?.factorType === 3;
  return [
    ...remainingFactors.filter(isUnique),
    ...remainingFactors.filter((factor) => !isUnique(factor)),
  ];
}

function CapturedMemberAllFactors({ member }: { member: CapturedLineageMember }) {
  const factorMeta = UMDB.successionFactorMeta as Record<
    number,
    SuccessionFactorMeta
  >;
  const remainingFactors = capturedDetailFactorOrder(
    member.inheritanceFactors,
    member.blueFactor?.id,
    member.factor.id,
    factorMeta,
  );
  return (
    <div className="successionCapturedAllFactors">
      {member.blueFactor ? (
        <span className="stat">
          {member.blueFactor.name} <b>{member.blueFactor.stars}★</b>
        </span>
      ) : null}
      <span className="aptitude">
        {APTITUDE_LABELS[member.factor.type]}{' '}
        <b>{member.factor.stars}★</b>
      </span>
      {remainingFactors.map((factor, index) => {
        const meta = factorMeta[factor.id];
        return (
          <span
            className={
              meta?.factorType === 3
                ? 'unique'
                : meta?.factorType === 5
                  ? 'race'
                  : 'white'
            }
            key={`${factor.id}:${index}`}
            title={`因子 ID ${factor.id}`}
          >
            {meta?.name || `因子 ${factor.id}`}{' '}
            <b>{factor.stars}★</b>
          </span>
        );
      })}
    </div>
  );
}

function CapturedUmaDetailModal({
  candidate,
  onSelect,
  onClose,
}: {
  candidate: CapturedTrainedUma;
  onSelect?: () => void;
  onClose: () => void;
}) {
  const members = [
    { label: '本体', member: candidate },
    { label: '父辈 1', member: candidate.parents[0] },
    { label: '父辈 2', member: candidate.parents[1] },
  ];
  return createPortal(
    <div
      className="successionPickerOverlay successionCapturedDetailOverlay"
      onMouseDown={onClose}
    >
      <section
        className="successionPickerDialog successionCapturedDetailDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${candidate.name}全部因子`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="successionPickerHeader">
          <div>
            <h3>{UMDB.cards[candidate.cardId]?.name || candidate.name}</h3>
            <p>
              {candidate.source === 'own'
                ? '自己的马娘'
                : `借用 · ${candidate.ownerName}`}
              {' · '}完整因子与父辈
            </p>
          </div>
          <button
            type="button"
            className="successionPickerClose"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="successionCapturedDetailMembers">
          {members.map(({ label, member }) => (
            <article key={`${label}:${member.trainedCharaId}:${member.cardId}`}>
              <header>
                <CapturedMemberPortrait member={member} />
                <span>
                  <small>{label}</small>
                  <strong>{UMDB.cards[member.cardId]?.name || member.name}</strong>
                  <em>{member.name}</em>
                </span>
              </header>
              <CapturedMemberAllFactors member={member} />
            </article>
          ))}
        </div>
        <footer className="successionCapturedDetailActions">
          <button type="button" onClick={onClose}>
            关闭
          </button>
          {onSelect ? (
            <button type="button" className="primary" onClick={onSelect}>
              选择此马娘
            </button>
          ) : null}
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function CapturedUmaPickerModal({
  slot,
  candidates,
  plannedUmaId,
  exclude,
  routeId,
  compatibilityPreviews,
  onSave,
  onClose,
}: {
  slot: LineageSlot;
  candidates: CapturedTrainedUma[];
  plannedUmaId: number;
  exclude: number[];
  routeId: string;
  compatibilityPreviews: (
    candidate: CapturedTrainedUma,
  ) => CapturedCompatibilityPreview[];
  onSave: (setting: TrainedUmaSetting) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [candidatePage, setCandidatePage] = useState(0);
  const [detailCandidate, setDetailCandidate] =
    useState<CapturedTrainedUma>();
  const keyword = search.trim().toLowerCase();
  const excluded = new Set(exclude);
  const visible = candidates.filter((candidate) => {
    if (candidate.umaId !== plannedUmaId) return false;
    const memberIds = [
      candidate.umaId,
      candidate.parents[0].umaId,
      candidate.parents[1].umaId,
    ];
    if (memberIds.some((id) => excluded.has(id))) return false;
    if (!keyword) return true;
    return [
      candidate.name,
      UMDB.cards[candidate.cardId]?.name,
      candidate.cardId,
      candidate.ownerName,
      candidate.viewerId,
      candidate.trainedCharaId,
      APTITUDE_LABELS[candidate.factor.type],
      candidate.blueFactor?.name,
      ...candidate.parents.flatMap((parent) => [
        parent.name,
        APTITUDE_LABELS[parent.factor.type],
        parent.blueFactor?.name,
      ]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
  const limitedVisible = visible.slice(0, MAX_CAPTURED_PICKER_CANDIDATES);
  const pageCount = Math.max(
    1,
    Math.ceil(limitedVisible.length / CAPTURED_PICKER_PAGE_SIZE),
  );
  const pagedVisible = limitedVisible.slice(
    candidatePage * CAPTURED_PICKER_PAGE_SIZE,
    (candidatePage + 1) * CAPTURED_PICKER_PAGE_SIZE,
  );

  useEffect(() => {
    setCandidatePage(0);
  }, [keyword, plannedUmaId, candidates]);

  useEffect(() => {
    setCandidatePage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (detailCandidate) setDetailCandidate(undefined);
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailCandidate, onClose]);

  return (
    <div className="successionPickerOverlay" onMouseDown={onClose}>
      <section
        className="successionPickerDialog successionCapturedPickerDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`选择${SLOT_LABELS[slot]}已有马娘`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="successionPickerHeader">
          <div>
            <h3>选择已有马娘</h3>
            <p>
              点击候选卡片直接选择；“查看详细”可查看本体、父辈与全部因子。
            </p>
          </div>
          <button
            type="button"
            className="successionPickerClose"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="successionPickerToolbar">
          <label className="successionPickerSearch">
            <input
              autoFocus
              value={search}
              placeholder="搜索马娘、红因子、玩家或 ID"
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </label>
          <div className="successionPickerMeta">
            找到 {visible.length} 个已有实例
            {visible.length > MAX_CAPTURED_PICKER_CANDIDATES
              ? `，分页显示前 ${MAX_CAPTURED_PICKER_CANDIDATES} 个`
              : ''}
          </div>
        </div>
        {pagedVisible.length ? (
          <>
            <div className="successionCapturedPickerPagination">
              <button
                type="button"
                disabled={candidatePage === 0}
                onClick={() => setCandidatePage((current) => current - 1)}
              >
                上一匹
              </button>
              <strong>
                {candidatePage + 1} / {pageCount}
              </strong>
              <button
                type="button"
                disabled={candidatePage >= pageCount - 1}
                onClick={() => setCandidatePage((current) => current + 1)}
              >
                下一匹
              </button>
            </div>
            <div className="successionCapturedPickerGrid">
              {pagedVisible.map((candidate) => {
              const dressName = UMDB.cards[candidate.cardId]?.name;
              const previews = compatibilityPreviews(candidate);
              return (
                <article
                  className="successionCapturedPickerCard"
                  key={candidate.selectionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSave(capturedSetting(candidate, routeId))}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSave(capturedSetting(candidate, routeId));
                    }
                  }}
                >
                  <div className="successionCapturedPickerSelf">
                    <CapturedMemberPortrait member={candidate} />
                    <div className="successionCapturedIdentity">
                      <strong>{dressName || candidate.name}</strong>
                      <span>
                        {dressName && dressName !== candidate.name
                          ? `${candidate.name} · `
                          : ''}
                        {candidate.source === 'own'
                          ? '自己的马娘'
                          : `借用 · ${candidate.ownerName}`}
                        {candidate.rankScore
                          ? ` · 评分 ${candidate.rankScore}`
                          : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="successionCapturedViewDetails"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailCandidate(candidate);
                        }}
                      >
                        查看详细
                      </button>
                    </div>
                  <CapturedMemberDetails member={candidate} />
                  {previews.length ? (
                    <div className="successionCapturedCompatibility">
                      {previews.map((preview) => (
                        <span
                          key={preview.label}
                          title={
                            preview.g1Details?.length
                              ? `基础相性 ${preview.base} + ${preview.g1Details
                                  .map(
                                    (detail) =>
                                      `${detail.detailed ? detail.label : `${detail.label}（路线估算）`}：共同 G1 ${detail.count} × ${G1_COMPATIBILITY_POINTS}`,
                                  )
                                  .join('\n')}\n总计 ${preview.total}`
                              : `基础相性 ${preview.base}\n${preview.detailed ? preview.label : '路线估算胜鞍'}：共同 G1 ${preview.g1Count} × ${G1_COMPATIBILITY_POINTS}`
                          }
                        >
                          <small>{preview.label}</small>
                          <strong>契合度 {preview.total}</strong>
                          <em>
                            {preview.g1Details?.length
                              ? preview.g1Details.map((detail) => (
                                  <span key={detail.label}>
                                    {detail.detailed
                                      ? detail.label
                                      : `${detail.label}（路线估算）`}
                                    {' · '}共同 G1 {detail.count}
                                  </span>
                                ))
                              : `${preview.detailed ? preview.label : '路线估算胜鞍'} · 共同 G1 ${preview.g1Count}`}
                          </em>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="successionCapturedPickerParents">
                    {candidate.parents.map((parent, index) => (
                      <section
                        key={`${candidate.selectionId}:${parent.trainedCharaId}:${parent.umaId}`}
                      >
                        <div className="successionCapturedParentHeader">
                          <CapturedMemberPortrait member={parent} />
                          <span>
                            <small>父辈 {index + 1}</small>
                            <strong>
                              {UMDB.cards[parent.cardId]?.name || parent.name}
                            </strong>
                          </span>
                        </div>
                        <CapturedMemberDetails member={parent} />
                      </section>
                    ))}
                  </div>
                </article>
              );
              })}
            </div>
          </>
        ) : (
          <div className="successionCapturedPickerEmpty">
            {candidates.length
              ? '没有符合当前角色及血统排除条件的已有马娘。'
              : '尚未捕获 load/index 或 pre_single_mode。请保持 UmaShow 监听开启，然后在游戏中进入育成准备或重新登录。'}
          </div>
        )}
      </section>
      {detailCandidate ? (
        <CapturedUmaDetailModal
          candidate={detailCandidate}
          onSelect={() => onSave(capturedSetting(detailCandidate, routeId))}
          onClose={() => setDetailCandidate(undefined)}
        />
      ) : null}
    </div>
  );
}

function MatchingCapturedUmaModal({
  candidates,
  onClose,
}: {
  candidates: CapturedTrainedUma[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [copiedViewerId, setCopiedViewerId] = useState(0);
  const [candidatePage, setCandidatePage] = useState(0);
  const [detailCandidate, setDetailCandidate] =
    useState<CapturedTrainedUma>();
  const keyword = search.trim().toLowerCase();
  const visible = candidates.filter((candidate) => {
    if (!keyword) return true;
    return [
      candidate.name,
      UMDB.cards[candidate.cardId]?.name,
      candidate.cardId,
      candidate.ownerName,
      candidate.viewerId,
      candidate.trainedCharaId,
      APTITUDE_LABELS[candidate.factor.type],
      candidate.blueFactor?.name,
      ...candidate.parents.flatMap((parent) => [
        parent.name,
        UMDB.cards[parent.cardId]?.name,
        APTITUDE_LABELS[parent.factor.type],
        parent.blueFactor?.name,
      ]),
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
  const limitedVisible = visible.slice(0, MAX_CAPTURED_PICKER_CANDIDATES);
  const pageCount = Math.max(
    1,
    Math.ceil(limitedVisible.length / CAPTURED_PICKER_PAGE_SIZE),
  );
  const pagedVisible = limitedVisible.slice(
    candidatePage * CAPTURED_PICKER_PAGE_SIZE,
    (candidatePage + 1) * CAPTURED_PICKER_PAGE_SIZE,
  );

  useEffect(() => {
    setCandidatePage(0);
  }, [keyword, candidates]);

  useEffect(() => {
    setCandidatePage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (detailCandidate) setDetailCandidate(undefined);
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailCandidate, onClose]);

  return (
    <div className="successionPickerOverlay" onMouseDown={onClose}>
      <section
        className="successionPickerDialog successionCapturedPickerDialog successionMatchingCapturedDialog"
        role="dialog"
        aria-modal="true"
        aria-label="满足条件的已育成马娘"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="successionPickerHeader">
          <div>
            <h3>满足条件的已育成马娘</h3>
          </div>
          <button
            type="button"
            className="successionPickerClose"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="successionPickerToolbar">
          <label className="successionPickerSearch">
            <input
              autoFocus
              value={search}
              placeholder="搜索马娘、因子、玩家或 ID"
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </label>
          <div className="successionPickerMeta">
            找到 {visible.length} 匹
            {visible.length > MAX_CAPTURED_PICKER_CANDIDATES
              ? `，分页显示前 ${MAX_CAPTURED_PICKER_CANDIDATES} 匹`
              : ''}
          </div>
        </div>
        {pagedVisible.length ? (
          <>
            <div className="successionCapturedPickerPagination">
              <button
                type="button"
                disabled={candidatePage === 0}
                onClick={() => setCandidatePage((current) => current - 1)}
              >
                上一匹
              </button>
              <strong>
                {candidatePage + 1} / {pageCount}
              </strong>
              <button
                type="button"
                disabled={candidatePage >= pageCount - 1}
                onClick={() => setCandidatePage((current) => current + 1)}
              >
                下一匹
              </button>
            </div>
            <div className="successionCapturedPickerGrid">
              {pagedVisible.map((candidate) => {
              const dressName = UMDB.cards[candidate.cardId]?.name;
              return (
                <article
                  className="successionCapturedPickerCard"
                  key={candidate.selectionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailCandidate(candidate)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setDetailCandidate(candidate);
                    }
                  }}
                >
                  <div className="successionCapturedPickerSelf">
                    <CapturedMemberPortrait member={candidate} />
                    <div className="successionCapturedIdentity">
                      <strong>{dressName || candidate.name}</strong>
                      <span>
                        {dressName && dressName !== candidate.name
                          ? `${candidate.name} · `
                          : ''}
                        {candidate.source === 'own'
                          ? '自己的马娘'
                          : `借用 · ${candidate.ownerName}`}
                        {candidate.rankScore
                          ? ` · 评分 ${candidate.rankScore}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  <div className="successionCapturedMatchFactorRow">
                    <CapturedMemberDetails member={candidate} />
                    {candidate.source === 'rental' && candidate.viewerId ? (
                      <button
                        type="button"
                        className="successionCandidateCopyViewerId"
                        title={`${candidate.ownerName} · 玩家 ID ${candidate.viewerId}`}
                        onClick={async (event) => {
                          event.stopPropagation();
                          try {
                            await copyText(String(candidate.viewerId));
                            setCopiedViewerId(candidate.viewerId);
                            window.setTimeout(() => setCopiedViewerId(0), 1400);
                          } catch {
                            setCopiedViewerId(0);
                          }
                        }}
                      >
                        {copiedViewerId === candidate.viewerId
                          ? '已复制'
                          : '复制 ID'}
                      </button>
                    ) : null}
                  </div>
                  <div className="successionCapturedPickerParents">
                    {candidate.parents.map((parent, index) => (
                      <section
                        key={`${candidate.selectionId}:${parent.trainedCharaId}:${parent.umaId}:${index}`}
                      >
                        <div className="successionCapturedParentHeader">
                          <CapturedMemberPortrait member={parent} />
                          <span>
                            <small>父辈 {index + 1}</small>
                            <strong>
                              {UMDB.cards[parent.cardId]?.name || parent.name}
                            </strong>
                          </span>
                        </div>
                        <CapturedMemberDetails member={parent} />
                      </section>
                    ))}
                  </div>
                </article>
              );
              })}
            </div>
          </>
        ) : (
          <div className="successionCapturedPickerEmpty">
            没有符合搜索条件的已育成马娘。
          </div>
        )}
      </section>
      {detailCandidate ? (
        <CapturedUmaDetailModal
          candidate={detailCandidate}
          onClose={() => setDetailCandidate(undefined)}
        />
      ) : null}
    </div>
  );
}

function LineageUmaSetting({
  slot,
  branch,
  value,
  exclude,
  compatibility,
  route,
  minimums,
  followsDefault,
  onRouteChange,
  onMinimumChange,
  onResetRoute,
  trainedSetting,
  inheritedMember,
  inheritedSourceLabel,
  trainedModalExclude,
  capturedUmas,
  compatibilityPreviews,
  onPlanUmaChange,
  onTrainedSettingChange,
  onTrainedSettingClear,
  fixedDressCardId,
  onFixedDressChange,
  onClear,
  draggedSlot,
  dropSlot,
}: {
  slot: LineageSlot;
  branch: BranchKey;
  value: number;
  exclude: number[];
  compatibility: PositionCompatibilityScore;
  route: Route;
  minimums: AptitudeMinimums;
  followsDefault: boolean;
  onRouteChange: (value: string) => void;
  onMinimumChange: (type: AptitudeKey, value: number) => void;
  onResetRoute: () => void;
  trainedSetting?: TrainedUmaSetting;
  inheritedMember?: TrainedLineageMember;
  inheritedSourceLabel?: string;
  trainedModalExclude: number[];
  capturedUmas: CapturedTrainedUma[];
  compatibilityPreviews: (
    candidate: CapturedTrainedUma,
  ) => CapturedCompatibilityPreview[];
  onPlanUmaChange: (value: number) => void;
  onTrainedSettingChange: (setting: TrainedUmaSetting) => void;
  onTrainedSettingClear: () => void;
  fixedDressCardId?: number;
  onFixedDressChange: (cardId?: number) => void;
  onClear: () => void;
  draggedSlot: LineageSlot | null;
  dropSlot: LineageSlot | null;
}) {
  const [planPickerRequest, setPlanPickerRequest] = useState(0);
  const [showTrainedModal, setShowTrainedModal] = useState(false);
  const [showFixedDressModal, setShowFixedDressModal] = useState(false);
  const [viewerIdCopied, setViewerIdCopied] = useState(false);
  const trainedMember = inheritedMember || trainedSetting?.self;
  const effectiveValue = inheritedMember?.umaId || value;
  const uma = data.umas.find((candidate) => candidate.id === effectiveValue);
  const trainedRoute = trainedMember
    ? ROUTES.find((item) => item.id === trainedMember.routeId) || route
    : route;
  const locked = Boolean(inheritedMember);
  const selectedCapturedUma = trainedSetting?.selectionId
    ? capturedUmas.find(
        (candidate) => candidate.selectionId === trainedSetting.selectionId,
      )
    : undefined;
  const viewerId =
    selectedCapturedUma?.viewerId || trainedSetting?.viewerId || 0;
  const capturedSource = selectedCapturedUma?.source || trainedSetting?.source;
  const capturedCardId =
    selectedCapturedUma?.cardId ||
    inheritedMember?.cardId ||
    trainedSetting?.self.cardId;
  const displayedDressCardId = capturedCardId || fixedDressCardId;
  const displayedDressIconPath = displayedDressCardId
    ? selectedCapturedUma?.cardId === displayedDressCardId
      ? horseIconPath(
          displayedDressCardId,
          selectedCapturedUma.rarity,
          selectedCapturedUma.raceClothId,
        )
      : plannedDressIconPath(displayedDressCardId)
    : undefined;
  const hiddenParentFactors =
    trainedSetting && slot !== 'father' && slot !== 'mother'
      ? trainedSetting.parents
      : [];
  const hiddenParentCodes = [`${SLOT_CODES[slot]}A`, `${SLOT_CODES[slot]}B`];
  const factorBadge = (
    factor: Pick<FactorAssignment, 'type' | 'stars'>,
    label: string,
  ) => (
    <span className="successionTrainedFactorItem">
      <small>{label}</small>
      <span
        className="successionCandidateFactor"
        title={`${APTITUDE_LABELS[factor.type]} ${factor.stars}★`}
      >
        {APTITUDE_LABELS[factor.type]}
        <b>{factor.stars}★</b>
      </span>
    </span>
  );
  return (
    <div
      className={`successionLineageUmaSetting${draggedSlot === slot ? ' dragging' : ''}${dropSlot === slot && draggedSlot !== slot ? ' dropTarget' : ''}`}
      data-lineage-slot={slot}
      draggable={Boolean(uma) && !locked}
      aria-grabbed={draggedSlot === slot}
    >
      <UmaSelect
        label={SLOT_LABELS[slot]}
        value={effectiveValue}
        exclude={exclude}
        compatibility={compatibility}
        onChange={onPlanUmaChange}
        onClear={!locked && uma ? onClear : undefined}
        portrait={
          displayedDressIconPath ? (
            <AssetIcon
              path={displayedDressIconPath}
              alt={uma?.name || ''}
              className="successionPortrait object-cover"
            />
          ) : undefined
        }
        titleActions={
          uma && !locked ? (
            <Fragment>
              {capturedSource === 'rental' && viewerId ? (
                <button
                  type="button"
                  className="successionCopySelectedViewerId"
                  title={`玩家 ID ${viewerId}`}
                  onClick={async () => {
                    try {
                      await copyText(String(viewerId));
                      setViewerIdCopied(true);
                      window.setTimeout(() => setViewerIdCopied(false), 1400);
                    } catch {
                      setViewerIdCopied(false);
                    }
                  }}
                >
                  {viewerIdCopied ? '已复制 ID' : '复制玩家 ID'}
                </button>
              ) : null}
              <button
                type="button"
                className="successionUseCapturedUma"
                onClick={() => setShowTrainedModal(true)}
                aria-label={`为${SLOT_LABELS[slot]}使用已有马娘填充`}
              >
                {trainedSetting ? '更换已有马娘' : '使用已有马娘填充'}
              </button>
              {trainedSetting ? (
                <button
                  type="button"
                  className="successionCancelCapturedUma"
                  onClick={onTrainedSettingClear}
                >
                  取消已有填充
                </button>
              ) : null}
              {!capturedCardId ? (
                <button
                  type="button"
                  className="successionFixedDressSwitch"
                  title="在计划马娘的基础上进一步选择具体衣装"
                  onClick={() => setShowFixedDressModal(true)}
                >
                  <span>
                    {fixedDressCardId
                      ? `衣装：${UMDB.cards[fixedDressCardId]?.name || fixedDressCardId}`
                      : '选择衣装'}
                  </span>
                </button>
              ) : null}
            </Fragment>
          ) : null
        }
        openRequest={planPickerRequest}
        displayOnly
        modeSelector={
          !uma && !locked ? (
            <div
              className="successionBranchModeSwitch"
              role="group"
              aria-label={`${SLOT_LABELS[slot]}设置方式`}
            >
              <button
                type="button"
                onClick={() => setPlanPickerRequest((current) => current + 1)}
              >
                设置计划马娘
              </button>
            </div>
          ) : null
        }
        footer={
          uma ? (
            trainedMember ? (
              <div className="successionTrainedUmaSummary">
                <div className="successionTrainedFactorSummary">
                  {factorBadge(trainedMember.factor, '自身')}
                  {hiddenParentFactors.map((member, index) => (
                    <Fragment key={hiddenParentCodes[index]}>
                      {factorBadge(member.factor, hiddenParentCodes[index])}
                    </Fragment>
                  ))}
                </div>
                <span className="successionTrainedRoute">
                  {trainedRoute.shortName}
                </span>
                <em>
                  {inheritedSourceLabel
                    ? `由${inheritedSourceLabel}固定`
                    : capturedSource === 'rental'
                      ? '已有马娘 · 其他玩家'
                      : '已有马娘 · 自己'}
                </em>
              </div>
            ) : (
              <div className="successionLineageUmaDetails planned">
                <BranchRouteCard
                  branch={branch}
                  route={route}
                  minimums={minimums}
                  uma={uma}
                  settingLabel={`${SLOT_LABELS[slot]}（${uma.name}）`}
                  compact
                  followsDefault={followsDefault}
                  onRouteChange={onRouteChange}
                  onMinimumChange={onMinimumChange}
                  onReset={onResetRoute}
                />
              </div>
            )
          ) : null
        }
      />
      {showTrainedModal && (
        <CapturedUmaPickerModal
          slot={slot}
          candidates={capturedUmas}
          plannedUmaId={effectiveValue}
          routeId={route.id}
          compatibilityPreviews={compatibilityPreviews}
          exclude={trainedModalExclude}
          onSave={(setting) => {
            onTrainedSettingChange(setting);
            setShowTrainedModal(false);
          }}
          onClose={() => setShowTrainedModal(false)}
        />
      )}
      {showFixedDressModal && uma && !capturedCardId ? (
        <FixedDressPickerModal
          umaId={uma.id}
          selectedCardId={fixedDressCardId}
          onSelect={onFixedDressChange}
          onClose={() => setShowFixedDressModal(false)}
        />
      ) : null}
    </div>
  );
}

function InRaceFactorJumpOption({
  enabled,
  minimumRank,
  onEnabledChange,
  onMinimumRankChange,
  footer,
}: {
  enabled: boolean;
  minimumRank: number;
  onEnabledChange: (enabled: boolean) => void;
  onMinimumRankChange: (rank: number) => void;
  footer?: ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const selectRank = (rank: number) => {
    onMinimumRankChange(rank);
    onEnabledChange(true);
  };
  return (
    <>
      <section className="successionInheritanceAptitudes successionFactorJumpOption">
        <header>
          <strong>产生红因子最低适应性要求</strong>
          <button
            type="button"
            className="successionFactorJumpInfoButton"
            aria-label="查看局内跳因子说明"
            onClick={() => setShowInfo(true)}
          >
            i
          </button>
        </header>
        <div
          className="successionFactorJumpChoices"
          role="group"
          aria-label="局内跳因子最低初始适性"
        >
          <button
            type="button"
            className={!enabled ? 'selected' : ''}
            aria-pressed={!enabled}
            onClick={() => onEnabledChange(false)}
          >
            关闭
          </button>
          {[6, 5, 4, 3].map((rank) => (
            <button
              type="button"
              className={`successionFactorJumpRankChoice${enabled && minimumRank === rank ? ' selected' : ''}`}
              aria-pressed={enabled && minimumRank === rank}
              aria-label={`允许初始适性 ${rankLabel(rank)} 以上通过局内提升到 A`}
              title={`允许初始适性 ${rankLabel(rank)} 以上通过局内提升到 A`}
              onClick={() => selectRank(rank)}
              key={rank}
            >
              <RankIcon value={rank} compact />
            </button>
          ))}
        </div>
        {footer && (
          <div className="successionFactorProductionTargets">{footer}</div>
        )}
      </section>
      {showInfo && (
        <div
          className="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setShowInfo(false);
          }}
        >
          <section
            className="successionInheritanceModal successionFactorJumpModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-factor-jump-modal-title"
          >
            <header>
              <div>
                <span className="successionModalChineseLabel">规则说明</span>
                <h3 id="succession-factor-jump-modal-title">
                  产生红因子最低适应性要求
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭局内跳因子说明"
                onClick={() => setShowInfo(false)}
              >
                ×
              </button>
            </header>
            <div className="successionFactorJumpModalBody">
              <p>通常只有育成开始时对应适性达到 A，马娘才能产出该红因子。</p>
              <div>
                <strong>选择 B / C / D / E</strong>
                <span>
                  如果父祖辈提供的同类红因子能让马娘以所选等级以上开始育成，并可能在局内继续提升到
                  A，也将她视为可产出对应红因子。
                </span>
              </div>
              <div>
                <strong>结果标记</strong>
                <span>
                  对应马娘会显示“需要局内 属性 X → A”，方便区分正常产出方案。
                </span>
              </div>
              <footer>
                此设置只判断理论可达，不会把局内红因子的触发概率计入最终达成概率。
              </footer>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function InheritanceAptitudes({
  target,
  selected,
  targets,
  onToggle,
  onConfigure,
}: {
  target: SuccessionUma;
  selected: FactorKey[];
  targets: InheritanceTargets;
  onToggle: (type: FactorKey) => void;
  onConfigure: (type: FactorKey, rank: number) => void;
}) {
  const [editingType, setEditingType] = useState<FactorKey | null>(null);
  const allocations = inheritanceAllocation(target, selected, targets);
  const usedSlots = allocations.reduce((total, item) => total + item.slots, 0);
  const editingBase = editingType ? target.aptitudes[editingType] : 0;
  const editingAllocation = editingType
    ? allocations.find((item) => item.type === editingType)
    : undefined;
  const editingOtherSlots = usedSlots - (editingAllocation?.slots || 0);
  const editingMaximum = Math.min(7, editingBase + FACTOR_STEPS.length - 1);

  return (
    <>
      <section className="successionInheritanceAptitudes">
        <header>
          <strong>{target.name}需要继承的适应性</strong>
          <span
            className="successionInheritanceBudget"
            title="1 / 4 / 7 / 10★门槛分别按 1 / 2 / 3 / 4 个满级 3★槽位规划"
          >
            因子槽位{' '}
            <b>
              {usedSlots}/{MAX_INHERITANCE_SLOTS}
            </b>
          </span>
        </header>
        <div className="successionInheritanceGroups">
          {APTITUDE_GROUPS.map((group) => (
            <div className="successionInheritanceGroup" key={group.label}>
              <span>{group.label}</span>
              <div>
                {group.types.map((type) => {
                  const active = selected.includes(type);
                  const base = target.aptitudes[type];
                  const allocation = allocations.find(
                    (item) => item.type === type,
                  );
                  const cannotSelect =
                    !active && usedSlots + 1 > MAX_INHERITANCE_SLOTS;
                  return (
                    <div
                      className={`successionInheritanceChoice${active ? ' selected' : ''}`}
                      key={type}
                    >
                      <button
                        type="button"
                        className={`successionInheritanceToggle${active ? ' selected' : ''}`}
                        aria-pressed={active}
                        aria-label={`养成马娘${active ? '取消' : '选择'}继承${APTITUDE_LABELS[type]}适性`}
                        disabled={cannotSelect}
                        title={cannotSelect ? '红因子槽位不足' : undefined}
                        onClick={() => {
                          if (!active && base < 7) setEditingType(type);
                          else onToggle(type);
                        }}
                      >
                        <b>{APTITUDE_LABELS[type]}</b>
                        <i aria-hidden="true">✓</i>
                      </button>
                      {active && base < 7 && allocation && (
                        <button
                          className="successionInheritanceTargetSummary"
                          type="button"
                          aria-label={`修改${APTITUDE_LABELS[type]}提升等级`}
                          onClick={() => setEditingType(type)}
                        >
                          <RankIcon value={base} compact />
                          <i aria-hidden="true">›</i>
                          <RankIcon value={allocation.target} compact />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      {editingType && editingBase < 7 && (
        <div
          className="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) setEditingType(null);
          }}
        >
          <section
            className="successionInheritanceModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-inheritance-modal-title"
          >
            <header>
              <div>
                <span className="successionModalChineseLabel">
                  设置初始的适应性等级
                </span>
                <h3 id="succession-inheritance-modal-title">
                  {APTITUDE_LABELS[editingType]}
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭适性提升设置"
                onClick={() => setEditingType(null)}
              >
                ×
              </button>
            </header>
            <div className="successionInheritanceModalSummary">
              <span>
                当前 <RankIcon value={editingBase} compact />
              </span>
              <i aria-hidden="true">›</i>
              <span>
                最高 <RankIcon value={editingMaximum} compact />
              </span>
              <b>可用因子槽位 {MAX_INHERITANCE_SLOTS - editingOtherSlots}</b>
            </div>
            <div className="successionInheritanceRankChoices">
              {Array.from(
                { length: editingMaximum - editingBase },
                (_, index) => editingBase + index + 1,
              ).map((rank) => {
                const stars = minimumStarsForRank(editingBase, rank) || 0;
                const slots = factorSlotsForStars(stars);
                const lacksSlots =
                  editingOtherSlots + slots > MAX_INHERITANCE_SLOTS;
                const unavailable = lacksSlots;
                const active = editingAllocation?.target === rank;
                const unavailableReason = lacksSlots ? '槽位不足' : '';
                return (
                  <button
                    type="button"
                    className={active ? 'selected' : ''}
                    disabled={unavailable}
                    onClick={() => {
                      onConfigure(editingType, rank);
                      setEditingType(null);
                    }}
                    key={rank}
                  >
                    <span>
                      <RankIcon value={editingBase} compact />
                      <i aria-hidden="true">›</i>
                      <RankIcon value={rank} compact />
                    </span>
                    <strong>
                      提升 {rank - editingBase} 级至 {rankLabel(rank)}
                    </strong>
                    <small>需要 {slots} 个因子槽</small>
                    {unavailableReason && <em>{unavailableReason}</em>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ProbabilityTargetInput({
  targetName,
  probabilityOptions,
  onConfigureProbabilityTarget,
  embedded = false,
}: {
  targetName: string;
  probabilityOptions: Array<{
    type: FactorKey;
    guaranteed: number;
    target: number;
  }>;
  onConfigureProbabilityTarget: (type: FactorKey, rank: number) => void;
  embedded?: boolean;
}) {
  const [editingProbabilityType, setEditingProbabilityType] =
    useState<FactorKey | null>(null);
  const editingProbabilityOption = probabilityOptions.find(
    (option) => option.type === editingProbabilityType,
  );
  return (
    <>
      <div
        className={`successionProbabilityTargets successionCalculationProbabilityTargets${embedded ? ' embedded' : ''}`}
      >
        <span>要求{targetName}育成后</span>
        <div>
          {!probabilityOptions.length && (
            <strong>未设置，按赛程与相性计算</strong>
          )}
          {probabilityOptions.map((option) => (
            <button
              type="button"
              className="successionProbabilityTargetOption"
              aria-label={`修改${APTITUDE_LABELS[option.type]}概率目标等级`}
              onClick={() => setEditingProbabilityType(option.type)}
              key={option.type}
            >
              <b>{APTITUDE_LABELS[option.type]}</b>
              <span className="successionProbabilityTargetRank">
                <RankIcon value={option.guaranteed} compact />
                <em>›</em>
                <RankIcon value={option.target} compact />
              </span>
            </button>
          ))}
        </div>
      </div>
      {editingProbabilityOption && (
        <div
          className="successionInheritanceModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setEditingProbabilityType(null);
            }
          }}
        >
          <section
            className="successionInheritanceModal successionProbabilityModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="succession-probability-modal-title"
          >
            <header>
              <div>
                <span>随机继承概率目标</span>
                <h3 id="succession-probability-modal-title">
                  {APTITUDE_LABELS[editingProbabilityOption.type]}
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭概率目标设置"
                onClick={() => setEditingProbabilityType(null)}
              >
                ×
              </button>
            </header>
            <div className="successionInheritanceModalSummary">
              <span>
                开局必定{' '}
                <RankIcon value={editingProbabilityOption.guaranteed} compact />
              </span>
              <i aria-hidden="true">›</i>
              <span>
                最高 <RankIcon value={8} compact />
              </span>
              <b>仅计算后续两次随机继承</b>
            </div>
            <div className="successionInheritanceRankChoices">
              {Array.from(
                { length: 9 - editingProbabilityOption.guaranteed },
                (_, index) => editingProbabilityOption.guaranteed + index,
              ).map((rank) => (
                <button
                  type="button"
                  className={
                    editingProbabilityOption.target === rank ? 'selected' : ''
                  }
                  onClick={() => {
                    onConfigureProbabilityTarget(
                      editingProbabilityOption.type,
                      rank,
                    );
                    setEditingProbabilityType(null);
                  }}
                  key={rank}
                >
                  <span>
                    <RankIcon
                      value={editingProbabilityOption.guaranteed}
                      compact
                    />
                    <i aria-hidden="true">›</i>
                    <RankIcon value={rank} compact />
                  </span>
                  <strong>概率目标 {rankLabel(rank)}</strong>
                  <small>
                    {rank === editingProbabilityOption.guaranteed
                      ? '无需额外随机继承'
                      : `还需随机继承 ${rank - editingProbabilityOption.guaranteed} 次`}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function UmaExclusionList({
  excludedIds,
  excludedCapturedSelectionIds,
  capturedUmas,
  fixedIds,
  onToggle,
  onToggleCaptured,
}: {
  excludedIds: number[];
  excludedCapturedSelectionIds: string[];
  capturedUmas: CapturedTrainedUma[];
  fixedIds: number[];
  onToggle: (umaId: number) => void;
  onToggleCaptured: (selectionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const excludedSet = new Set(excludedIds);
  const fixedSet = new Set(fixedIds.filter(Boolean));
  const excludedUmas = data.umas.filter((uma) => excludedSet.has(uma.id));
  const excludedCapturedSet = new Set(excludedCapturedSelectionIds);
  const excludedCapturedUmas = capturedUmas.filter((candidate) =>
    excludedCapturedSet.has(candidate.selectionId),
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const options = data.umas.filter(
    (uma) =>
      !normalizedQuery ||
      uma.name.toLocaleLowerCase().includes(normalizedQuery) ||
      String(uma.id).includes(normalizedQuery),
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <section className="successionUmaExclusionList">
        <header>
          <span>黑名单马娘</span>
          <button
            type="button"
            aria-label="管理黑名单马娘"
            onClick={() => setOpen(true)}
          >
            管理{' '}
            {excludedIds.length + excludedCapturedSelectionIds.length
              ? `(${excludedIds.length + excludedCapturedSelectionIds.length})`
              : ''}
          </button>
        </header>
        <div className="successionUmaExclusionSummary">
          {excludedUmas.length || excludedCapturedUmas.length ? (
            <>
              {excludedUmas.slice(0, 4).map((uma) => (
                <span key={uma.id} title={uma.name}>
                  <UmaPortrait uma={uma} />
                  <b>{uma.name}</b>
                  <button
                    type="button"
                    aria-label={`从黑名单移除${uma.name}`}
                    onClick={() => onToggle(uma.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {excludedUmas.length > 4 && (
                <em>另有 {excludedUmas.length - 4} 位</em>
              )}
              {excludedCapturedUmas.slice(0, 4).map((candidate) => (
                <span
                  key={candidate.selectionId}
                  title={`${candidate.name} · 已育成记录`}
                >
                  <CapturedMemberPortrait member={candidate} />
                  <b>{UMDB.cards[candidate.cardId]?.name || candidate.name}</b>
                  <button
                    type="button"
                    aria-label={`从黑名单移除已育成的${candidate.name}`}
                    onClick={() => onToggleCaptured(candidate.selectionId)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {excludedCapturedUmas.length > 4 && (
                <em>另有 {excludedCapturedUmas.length - 4} 匹已育成记录</em>
              )}
            </>
          ) : (
            <strong>暂无黑名单马娘</strong>
          )}
        </div>
      </section>

      {open && (
        <div
          className="successionPickerOverlay"
          onMouseDown={() => setOpen(false)}
        >
          <section
            className="successionPickerDialog successionExclusionDialog"
            role="dialog"
            aria-modal="true"
            aria-label="管理黑名单马娘"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="successionPickerHeader">
              <div>
                <span>UMAMUSUME FILTER</span>
                <h3>黑名单马娘</h3>
                <p>可按角色整体排除，也可只排除某一匹已育成记录。</p>
              </div>
              <button
                type="button"
                className="successionPickerClose"
                aria-label="关闭黑名单马娘"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="successionExclusionToolbar">
              <label className="successionPickerSearch">
                <input
                  type="text"
                  value={query}
                  autoFocus
                  placeholder="输入马娘名称或 ID"
                  aria-label="搜索马娘过滤列表"
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
              </label>
              <span>
                已过滤 <b>{excludedIds.length}</b> 位 · 当前显示{' '}
                {options.length}位
              </span>
            </div>
            {excludedCapturedUmas.length ? (
              <div className="successionCapturedBlacklistRecords">
                <strong>已屏蔽的已育成记录</strong>
                <div>
                  {excludedCapturedUmas.map((candidate) => (
                    <CapturedRecordHoverPreview
                      candidate={candidate}
                      key={candidate.selectionId}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleCaptured(candidate.selectionId)}
                      >
                        <CapturedMemberPortrait member={candidate} />
                        <span>
                          <b>
                            {UMDB.cards[candidate.cardId]?.name || candidate.name}
                          </b>
                          <small>
                            {candidate.source === 'own'
                              ? '自己的马娘'
                              : `借用 · ${candidate.ownerName}`}
                          </small>
                        </span>
                        <i>移除</i>
                      </button>
                    </CapturedRecordHoverPreview>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="successionExclusionGrid">
              {options.map((uma) => {
                const excluded = excludedSet.has(uma.id);
                const fixed = fixedSet.has(uma.id);
                return (
                  <button
                    type="button"
                    className={excluded ? 'selected' : ''}
                    aria-pressed={excluded}
                    aria-label={
                      excluded
                        ? `从黑名单移除${uma.name}`
                        : fixed
                          ? `将${uma.name}加入黑名单，当前固定位置仍会保留`
                          : `将${uma.name}加入黑名单`
                    }
                    title={
                      fixed
                        ? '当前种马路线中的固定选择优先，加入过滤不会清除该位置'
                        : undefined
                    }
                    onClick={() => onToggle(uma.id)}
                    key={uma.id}
                  >
                    <UmaPortrait uma={uma} />
                    <strong>{uma.name}</strong>
                    <em>{excluded ? '已过滤' : '加入'}</em>
                  </button>
                );
              })}
            </div>
            <footer className="successionPickerFooter">
              <span>过滤设置会自动保存</span>
              <button type="button" onClick={() => setOpen(false)}>
                完成
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function CompleteDesignFactorBadge({
  position,
}: {
  position: CompleteDesignPosition;
}) {
  return position.factor.free ? (
    <span
      className="successionCandidateFactor free"
      title={
        position.factor.unconstrained
          ? '该位置不指定红因子类型'
          : `自由槽位：实际按${APTITUDE_LABELS[position.factor.type]} ${position.factor.stars}★计算`
      }
    >
      自由
    </span>
  ) : (
    <span
      className="successionCandidateFactor"
      title={`${APTITUDE_LABELS[position.factor.type]} ${position.factor.stars}★`}
    >
      {APTITUDE_LABELS[position.factor.type]}
      <b>{position.factor.stars}★</b>
    </span>
  );
}

function CompleteDesignUpstreamRequirements({
  position,
}: {
  position: CompleteDesignPosition;
}) {
  const minimumDemandTypes = ALL_APTITUDES.filter(
    (type) => (position.minimumDemand?.[type] || 0) > 0,
  );
  const cumulativeDemandTypes = ALL_APTITUDES.filter(
    (type) => (position.cumulativeDemand?.[type] || 0) > 0,
  );
  const overlappingDemandTypes = cumulativeDemandTypes.filter(
    (type) => (position.minimumDemand?.[type] || 0) > 0,
  );
  const ancestorOnlyDemandTypes = cumulativeDemandTypes.filter(
    (type) => !(position.minimumDemand?.[type] || 0),
  );
  if (position.generation !== 2) return null;
  return (
    <div className="successionUpstreamRequirements">
      {minimumDemandTypes.length > 0 ? (
        <div>
          <small>{position.uma?.name || position.code}的父辈需要</small>
          <span>
            {minimumDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.minimumDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      ) : cumulativeDemandTypes.length === 0 ? (
        <em>{position.uma?.name || position.code}的父辈无额外要求</em>
      ) : null}
      {minimumDemandTypes.length === 0 && cumulativeDemandTypes.length > 0 && (
        <div className="successionCombinedRequirement">
          <small>父辈连同祖辈共要有</small>
          <span>
            {cumulativeDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.cumulativeDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      )}
      {minimumDemandTypes.length > 0 && ancestorOnlyDemandTypes.length > 0 && (
        <div>
          <small>祖辈需要</small>
          <span>
            {ancestorOnlyDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥{position.cumulativeDemand?.[type]}★
              </b>
            ))}
          </span>
        </div>
      )}
      {overlappingDemandTypes.length > 0 && (
        <div className="successionCombinedRequirement">
          <small>同时父辈连同祖辈共要有</small>
          <span>
            {overlappingDemandTypes.map((type) => (
              <b key={type}>
                {APTITUDE_LABELS[type]} ≥
                {(position.minimumDemand?.[type] || 0) +
                  (position.cumulativeDemand?.[type] || 0)}
                ★
              </b>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function CompleteDesignCapturedFactorSummary({
  summary,
}: {
  summary: NonNullable<CompleteDesignPosition['capturedFactorSummary']>;
}) {
  return (
    <div className="successionCapturedResultFactors">
      <span className="stat">
        <i>属性</i>
        {summary.blueFactor ? (
          <b>
            {summary.blueFactor.name} {summary.blueFactor.stars}★
          </b>
        ) : (
          <b>—</b>
        )}
      </span>
      <span className="aptitude">
        <i>适性</i>
        <b>
          {APTITUDE_LABELS[summary.aptitudeFactor.type]}{' '}
          {summary.aptitudeFactor.stars}★
        </b>
      </span>
      <span className="unique">
        <i>固有</i>
        <b>{summary.uniqueFactorStars}★</b>
      </span>
      {summary.selectedSkillFactors
        .filter((skill) => skill.count > 0)
        .map((skill) => (
          <span className="skill" key={skill.groupId}>
            <i>{skill.name}</i>
            <b>×{skill.count}</b>
          </span>
        ))}
      {summary.whiteFactorCount > 0 ? (
        <span className="white">
          <i>白因子</i>
          <b>×{summary.whiteFactorCount}</b>
        </span>
      ) : null}
    </div>
  );
}

function CapturedBlacklistHoverDetails({
  candidate,
}: {
  candidate: CapturedTrainedUma;
}) {
  const members = [
    { label: '本体', member: candidate },
    { label: '父辈 1', member: candidate.parents[0] },
    { label: '父辈 2', member: candidate.parents[1] },
  ];
  return (
    <div className="successionCapturedBlacklistTooltip" role="tooltip">
      <header>
        <strong>将要屏蔽的已育成记录</strong>
        <span>
          {candidate.source === 'own'
            ? '自己的马娘'
            : `借用 · ${candidate.ownerName}`}
        </span>
      </header>
      <div>
        {members.map(({ label, member }) => (
          <section key={`${label}:${member.trainedCharaId}:${member.cardId}`}>
            <div>
              <CapturedMemberPortrait member={member} />
              <span>
                <small>{label}</small>
                <strong>{UMDB.cards[member.cardId]?.name || member.name}</strong>
              </span>
            </div>
            <CapturedMemberDetails member={member} />
          </section>
        ))}
      </div>
    </div>
  );
}

function CapturedRecordHoverPreview({
  candidate,
  children,
}: {
  candidate: CapturedTrainedUma;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  }>();
  const show = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = Math.min(620, Math.max(280, window.innerWidth - 24));
    const left = Math.min(
      Math.max(12, rect.right - width),
      Math.max(12, window.innerWidth - width - 12),
    );
    const estimatedHeight = 245;
    const belowTop = rect.bottom + 8;
    const top =
      belowTop + estimatedHeight <= window.innerHeight - 12
        ? belowTop
        : Math.max(12, rect.top - estimatedHeight - 8);
    setPosition({ top, left, width });
  };
  return (
    <span
      className="successionCapturedHoverAnchor"
      onMouseEnter={(event) => show(event.currentTarget)}
      onMouseLeave={() => setPosition(undefined)}
      onFocusCapture={(event) => show(event.currentTarget)}
      onBlurCapture={() => setPosition(undefined)}
    >
      {children}
      {position
        ? createPortal(
            <div
              className="successionCapturedBlacklistFloating"
              style={position}
            >
              <CapturedBlacklistHoverDetails candidate={candidate} />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

function CompleteDesignCandidateIdentity({
  position,
  capturedUmas,
  showCapturedMatches,
  onExcludeUma,
  onExcludeCapturedUma,
}: {
  position: CompleteDesignPosition;
  capturedUmas: CapturedTrainedUma[];
  showCapturedMatches: boolean;
  onExcludeUma: (umaId: number) => void;
  onExcludeCapturedUma: (selectionId: string) => void;
}) {
  const [matchingModalOpen, setMatchingModalOpen] = useState(false);
  const [capturedDetailOpen, setCapturedDetailOpen] = useState(false);
  const matchingCapturedUmas = showCapturedMatches
    ? capturedUmas.filter((candidate) =>
        capturedUmaMatchesGeneratedCandidate(candidate, position),
      )
    : [];
  const capturedCandidate = position.capturedSelectionId
    ? capturedUmas.find(
        (candidate) => candidate.selectionId === position.capturedSelectionId,
      )
    : undefined;
  const blacklistButton = (
    <button
      type="button"
      className="successionCandidateBlacklist"
      disabled={position.fixed && !position.capturedSelectionId}
      title={
        position.fixed && !position.capturedSelectionId
          ? '固定马娘不能加入角色黑名单'
          : undefined
      }
      aria-label={
        position.fixed && !position.capturedSelectionId
          ? `${position.uma?.name}是固定马娘`
          : position.capturedSelectionId
            ? `将这匹已育成的${position.uma?.name}加入黑名单`
            : `将${position.uma?.name}加入黑名单`
      }
      onClick={(event) => {
        event.stopPropagation();
        if (position.capturedSelectionId) {
          onExcludeCapturedUma(position.capturedSelectionId);
        } else if (position.uma) {
          onExcludeUma(position.uma.id);
        }
      }}
    >
      {position.fixed && !position.capturedSelectionId
        ? '已固定'
        : position.capturedSelectionId
          ? '屏蔽此马娘'
          : '加入黑名单'}
    </button>
  );
  return (
    <>
      <div
        className={`successionCandidateOption${capturedCandidate ? ' clickable' : ''}`}
        role={capturedCandidate ? 'button' : undefined}
        tabIndex={capturedCandidate ? 0 : undefined}
        onClick={() => {
          if (capturedCandidate) setCapturedDetailOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || !capturedCandidate) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCapturedDetailOpen(true);
          }
        }}
      >
        <div className="successionCandidateOptionIdentity">
          <UmaPortrait uma={position.uma} />
          <span className="successionCandidateIdentity">
            <strong>{position.uma?.name || '没有可用马娘'}</strong>
            {position.capturedSelectionId && (
              <small className="successionCandidateCapturedSource">
                已育成 ·{' '}
                {position.capturedSource === 'own'
                  ? '自己'
                  : position.capturedOwnerName || '其他玩家'}
              </small>
            )}
            {position.uma && position.compatibility !== undefined && (
              <small
                className="successionCandidateCompatibility"
                title={position.compatibilityTitle}
              >
                相性 <b>{position.compatibility}</b>
              </small>
            )}
            {position.inRaceFactorJump && (
              <small
                className="successionCandidateJumpRequirement"
                title="该马娘需要在育成局内触发对应红因子，将适性提升到 A 后才能产出该红因子"
              >
                <strong>需要局内</strong>
                <span>{APTITUDE_LABELS[position.inRaceFactorJump.type]}</span>
                <b>{rankLabel(position.inRaceFactorJump.fromRank)}</b>
                <i aria-hidden="true">→</i>
                <b>{rankLabel(position.inRaceFactorJump.toRank)}</b>
              </small>
            )}
          </span>
          {position.uma && (
            <span className="successionCandidateActions">
              {showCapturedMatches && (
                <button
                  type="button"
                  className="successionCandidateViewCaptured"
                  disabled={!matchingCapturedUmas.length}
                  title={
                    matchingCapturedUmas.length
                      ? `查看满足${position.uma.name}及因子条件的已育成马娘`
                      : '导入数据中没有满足全部条件的马娘'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    setMatchingModalOpen(true);
                  }}
                >
                  查看已有 {matchingCapturedUmas.length}
                </button>
              )}
              {blacklistButton}
            </span>
          )}
        </div>
        {position.capturedFactorSummary ? (
          <CompleteDesignCapturedFactorSummary
            summary={position.capturedFactorSummary}
          />
        ) : (
          <CompleteDesignUpstreamRequirements position={position} />
        )}
      </div>
      {matchingModalOpen && (
        <MatchingCapturedUmaModal
          candidates={matchingCapturedUmas}
          onClose={() => setMatchingModalOpen(false)}
        />
      )}
      {capturedDetailOpen && capturedCandidate ? (
        <CapturedUmaDetailModal
          candidate={capturedCandidate}
          onClose={() => setCapturedDetailOpen(false)}
        />
      ) : null}
    </>
  );
}

function CompleteDesignPositionCard({
  position,
  capturedUmas,
  showCapturedMatches,
  onExcludeUma,
  onExcludeCapturedUma,
}: {
  position: CompleteDesignPosition;
  capturedUmas: CapturedTrainedUma[];
  showCapturedMatches: boolean;
  onExcludeUma: (umaId: number) => void;
  onExcludeCapturedUma: (selectionId: string) => void;
}) {
  const [copiedViewerId, setCopiedViewerId] = useState(0);
  const alternatives = position.alternatives?.length
    ? position.alternatives
    : [position];
  const multiple = alternatives.length > 1;
  const rentalViewers = [
    ...new Map(
      alternatives
        .filter(
          (alternative) =>
            alternative.capturedSource === 'rental' &&
            Boolean(alternative.capturedViewerId),
        )
        .map((alternative) => [
          alternative.capturedViewerId!,
          {
            viewerId: alternative.capturedViewerId!,
            ownerName: alternative.capturedOwnerName || '其他玩家',
          },
        ]),
    ).values(),
  ];
  return (
    <article className={position.uma ? '' : 'missing'}>
      <header>
        <b>{position.code}</b>
        <div className="successionCandidateHeaderMeta">
          {multiple && (
            <small>
              {position.alternativeCount || alternatives.length}{' '}
              位候选，任选其一
            </small>
          )}
          {!position.capturedFactorSummary && (
            <CompleteDesignFactorBadge position={position} />
          )}
          {rentalViewers.map((viewer) => (
            <button
              type="button"
              className="successionCandidateCopyViewerId"
              title={`${viewer.ownerName} · 玩家 ID ${viewer.viewerId}`}
              onClick={async () => {
                try {
                  await copyText(String(viewer.viewerId));
                  setCopiedViewerId(viewer.viewerId);
                  window.setTimeout(() => setCopiedViewerId(0), 1400);
                } catch {
                  setCopiedViewerId(0);
                }
              }}
              key={viewer.viewerId}
            >
              {copiedViewerId === viewer.viewerId ? '已复制' : '复制 ID'}
            </button>
          ))}
        </div>
      </header>
      {multiple ? (
        <div className="successionCandidateOptions">
          {alternatives.map((alternative, index) => (
            <div
              className="successionCandidateOptionChoice"
              key={`${alternative.uma?.id || 0}:${index}`}
            >
              {index > 0 && (
                <strong className="successionCandidateOr">或</strong>
              )}
              <CompleteDesignCandidateIdentity
                position={alternative}
                capturedUmas={capturedUmas}
                showCapturedMatches={showCapturedMatches}
                onExcludeUma={onExcludeUma}
                onExcludeCapturedUma={onExcludeCapturedUma}
              />
            </div>
          ))}
        </div>
      ) : (
        <CompleteDesignCandidateIdentity
          position={position}
          capturedUmas={capturedUmas}
          showCapturedMatches={showCapturedMatches}
          onExcludeUma={onExcludeUma}
          onExcludeCapturedUma={onExcludeCapturedUma}
        />
      )}
    </article>
  );
}

function CompleteDesignBranchTree({
  branch,
  design,
  capturedUmas,
  showCapturedMatches,
  onExcludeUma,
  onExcludeCapturedUma,
}: {
  branch: BranchKey;
  design: CompleteFactorDesign;
  capturedUmas: CapturedTrainedUma[];
  showCapturedMatches: boolean;
  onExcludeUma: (umaId: number) => void;
  onExcludeCapturedUma: (selectionId: string) => void;
}) {
  const codes = branch === 'paternal' ? ['A', 'AA', 'AB'] : ['B', 'BA', 'BB'];
  const positions = codes.map((code) =>
    design?.positions.find((position) => position.code === code),
  );
  const [parent, ...grandparents] = positions;
  const hasAlternatives = grandparents.some(
    (position) => (position?.alternatives?.length || 0) > 1,
  );
  const alternativeCounts = grandparents.map(
    (position) => position?.alternatives?.length || 1,
  );
  const hasMatchingAlternativeCounts =
    alternativeCounts[0] === alternativeCounts[1];
  return (
    <section
      className={`successionRequirementBranch successionOptimalBranch ${branch}${hasAlternatives ? ' hasAlternatives' : ''}${hasMatchingAlternativeCounts ? ' hasMatchingAlternativeCounts' : ''}`}
    >
      <header>
        <strong>{branch === 'paternal' ? '父系' : '母系'}</strong>
      </header>
      <div className="successionRequirementTree successionOptimalTree">
        <div className="successionRequirementTreeRoot successionCompleteGeneration generation1">
          <CompleteDesignPositionCard
            position={parent!}
            capturedUmas={capturedUmas}
            showCapturedMatches={showCapturedMatches}
            onExcludeUma={onExcludeUma}
            onExcludeCapturedUma={onExcludeCapturedUma}
          />
        </div>
        <div className="successionRequirementTreeChildren">
          {grandparents.map((position) => (
            <div
              className="successionRequirementTreeNode successionCompleteGeneration generation2"
              key={position!.code}
            >
              <CompleteDesignPositionCard
                position={position!}
                capturedUmas={capturedUmas}
                showCapturedMatches={showCapturedMatches}
                onExcludeUma={onExcludeUma}
                onExcludeCapturedUma={onExcludeCapturedUma}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMPLETE_DESIGN_BRANCH_CODES: Record<BranchKey, string[]> = {
  paternal: ['A', 'AA', 'AB'],
  maternal: ['B', 'BA', 'BB'],
};

function visibleCompleteDesignBranches(
  design: CompleteFactorDesign,
): BranchKey[] {
  if (design.positions.some((position) => position.capturedFactorSummary)) {
    return ['paternal', 'maternal'];
  }
  const branchFullyFixed = (branch: BranchKey) =>
    COMPLETE_DESIGN_BRANCH_CODES[branch].every(
      (code) =>
        design.positions.find((position) => position.code === code)?.fixed,
    );
  const paternalFixed = branchFullyFixed('paternal');
  const maternalFixed = branchFullyFixed('maternal');
  if (paternalFixed && maternalFixed) return [];
  if (paternalFixed) return ['maternal'];
  if (maternalFixed) return ['paternal'];
  return ['paternal', 'maternal'];
}

function CompleteDesignResult({
  rank,
  design,
  probability,
  probabilityTargets,
  hasCapturedFactorTargets,
  capturedUmas,
  showCapturedMatches,
  onExcludeUma,
  onExcludeCapturedUma,
}: {
  rank: number;
  design: CompleteFactorDesign;
  probability?: number;
  probabilityTargets: Array<{ type: FactorKey; rank: number }>;
  hasCapturedFactorTargets?: boolean;
  capturedUmas: CapturedTrainedUma[];
  showCapturedMatches: boolean;
  onExcludeUma: (umaId: number) => void;
  onExcludeCapturedUma: (selectionId: string) => void;
}) {
  const visibleBranches = visibleCompleteDesignBranches(design);
  const visibleCodes = new Set(
    visibleBranches.flatMap((branch) => COMPLETE_DESIGN_BRANCH_CODES[branch]),
  );
  const hasAlternatives = design.positions.some(
    (position) =>
      visibleCodes.has(position.code) &&
      (position.alternatives?.length || 0) > 1,
  );
  return (
    <section className="successionCompleteDesign successionOptimalResult">
      <header>
        <div>
          <strong>候选 {rank}</strong>
        </div>
        <div className="successionOptimalProbability">
          {probabilityTargets.map((target) => (
            <span key={target.type}>
              <i>{APTITUDE_SHORT_LABELS[target.type]}</i>
              <RankIcon value={target.rank} compact />
            </span>
          ))}
          {hasCapturedFactorTargets && (
            <em className="successionConfiguredSkillBadge">已设置技能</em>
          )}
          <small>
            {hasCapturedFactorTargets ? '综合达成概率' : '达成概率'}
          </small>

          <strong>
            {probability === undefined
              ? '—'
              : `${(probability * 100).toFixed(2)}%`}
          </strong>
        </div>
      </header>
      <div
        className={`successionOptimalBranches${hasAlternatives ? ' hasAlternatives' : ''}${visibleBranches.length === 1 ? ' singleBranch' : ''}`}
      >
        {visibleBranches.length ? (
          visibleBranches.map((branch) => (
            <CompleteDesignBranchTree
              branch={branch}
              design={design}
              capturedUmas={capturedUmas}
              showCapturedMatches={showCapturedMatches}
              onExcludeUma={onExcludeUma}
              onExcludeCapturedUma={onExcludeCapturedUma}
              key={branch}
            />
          ))
        ) : (
          <div className="successionAllBranchesFixed">父系与母系均已固定</div>
        )}
      </div>
    </section>
  );
}

function PositionRequirementCard({
  branch,
  slot,
  uma,
  inheritanceAptitudes,
  requirements,
  sourceSelections,
  candidates,
  preferredFactors,
  availableSlots,
}: {
  branch: BranchKey;
  slot: LineageSlot;
  uma?: SuccessionUma;
  inheritanceAptitudes: FactorKey[];
  requirements: PositionFactorRequirement[];
  sourceSelections: { slot: LineageSlot; uma?: SuccessionUma }[];
  candidates: { uma: SuccessionUma; score: number }[];
  preferredFactors: FactorKey[];
  availableSlots: number;
}) {
  const impossible = requirements.filter((item) => item.stars === null);
  const needed = requirements.filter(
    (item) => item.stars !== null && item.stars > 0,
  );
  const sourcesLocked =
    sourceSelections.length > 0 &&
    sourceSelections.every((source) => source.uma);
  const sourceLabel = uma
    ? `${SLOT_SOURCE_LABELS[slot]}（${uma.name}）`
    : SLOT_SOURCE_LABELS[slot];
  const receivingLabel = uma
    ? `${SLOT_LABELS[slot]}（${uma.name}）`
    : SLOT_LABELS[slot];
  const minimumUsedSlots = needed.reduce(
    (total, item) => total + factorSlotsForStars(item.stars || 0),
    0,
  );
  const probabilitySlots = Math.max(0, availableSlots - minimumUsedSlots);
  const freeSlotFill =
    preferredFactors.length && probabilitySlots > 0 ? (
      <div className="successionRequirementFreeFill">
        <strong>剩余 {probabilitySlots} 槽</strong>
        <span>
          继续枚举为
          {preferredFactors.map((type) => APTITUDE_LABELS[type]).join(' / ')}
          红因子（全部 3★）
        </span>
      </div>
    ) : null;
  return (
    <article className={`successionPositionRequirement ${branch}`}>
      <header>
        <span className="successionRequirementSourceTitle">{sourceLabel}</span>
        <div className="successionRequirementPositionMeta">
          <strong>{SLOT_LABELS[slot]}</strong>
          {uma && (
            <div className="successionRequirementUma" title={uma.name}>
              <UmaPortrait uma={uma} />
            </div>
          )}
        </div>
      </header>

      {!uma ? (
        <div className="successionRequirementState muted">
          先选择{SLOT_LABELS[slot]}，系统再反推{sourceLabel}
          的最低红因子。
        </div>
      ) : !inheritanceAptitudes.length ? (
        <div className="successionRequirementState muted">
          未选择想要继承的适性。
        </div>
      ) : impossible.length ? (
        <div className="successionRequirementState impossible">
          <strong>无法满足最低适性要求</strong>
          <div className="successionImpossibleRequirements">
            {impossible.map((item) => {
              const maximum = Math.min(
                RANKS.length - 1,
                item.base + FACTOR_STEPS.length - 1,
              );
              return (
                <span key={item.type} title={APTITUDE_LABELS[item.type]}>
                  <strong>{APTITUDE_LABELS[item.type]}</strong>
                  <b>最高</b>
                  <i>
                    <RankIcon value={item.base} compact />
                    <em>›</em>
                    <RankIcon value={maximum} compact />
                  </i>
                </span>
              );
            })}
          </div>
        </div>
      ) : !needed.length ? (
        <>
          <div className="successionRequirementState ready">
            当前马娘已满足赛程与红因子产出要求，{sourceLabel}无需补适性。
          </div>
          {freeSlotFill}
        </>
      ) : (
        <>
          <div className="successionRequirementNeeds">
            <small>{receivingLabel}总共需要被提供</small>
            <div>
              {needed.map((item) => (
                <span key={item.type}>
                  <strong className="successionRequirementStarCount">
                    {factorSlotsForStars(item.stars || 0)} 槽 × 3★
                  </strong>
                  <FactorIcon type={item.type} compact />
                </span>
              ))}
            </div>
          </div>
          {sourceSelections.length > 0 && (
            <div className="successionRequirementSources">
              {sourceSelections.map((source) => (
                <div
                  className={source.uma ? 'selected' : 'empty'}
                  key={source.slot}
                >
                  <span>{SLOT_LABELS[source.slot]}</span>
                  {source.uma ? (
                    <>
                      <UmaPortrait uma={source.uma} />
                      <strong>{source.uma.name}</strong>
                      <small>
                        {needed.map((item) => (
                          <b
                            className={
                              source.uma?.aptitudes[item.type] === 7
                                ? 'ready'
                                : 'missing'
                            }
                            key={item.type}
                          >
                            <FactorIcon type={item.type} compact />
                            <RankIcon
                              value={source.uma?.aptitudes[item.type] || 0}
                              compact
                            />
                          </b>
                        ))}
                      </small>
                    </>
                  ) : (
                    <em>未固定</em>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="successionRequirementCandidates">
            <small>
              {sourceSelections.length
                ? '未固定位置可选候选'
                : `${sourceLabel}候选`}{' '}
              · 所需红因子适性原始 A
            </small>
            {sourcesLocked ? (
              <p>
                {sourceLabel}
                已全部固定；上方红色适性表示该马娘不能产出所需红因子。
              </p>
            ) : candidates.length ? (
              <div>
                {candidates.map((candidate) => (
                  <article key={candidate.uma.id}>
                    <UmaPortrait uma={candidate.uma} />
                    <span>
                      <strong>{candidate.uma.name}</strong>
                      <small>相性适配 +{candidate.score}</small>
                    </span>
                    <div>
                      {needed.map((item) => (
                        <b
                          key={item.type}
                          title={`${APTITUDE_LABELS[item.type]} A`}
                        >
                          <FactorIcon type={item.type} compact />
                          <RankIcon value={7} compact />
                        </b>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>没有能够产出全部所需红因子的候选。</p>
            )}
          </div>
          {freeSlotFill}
        </>
      )}
    </article>
  );
}

function SuccessionPlanner({
  capturedUmas: allCapturedUmas,
  successionG1SaddleIds,
  successionFactorMeta,
}: {
  capturedUmas: CapturedTrainedUma[];
  successionG1SaddleIds: number[];
  successionFactorMeta: Record<number, SuccessionFactorMeta>;
}) {
  const [initialSettings] = useState(loadStoredSuccessionSettings);
  const [targetId, setTargetId] = useState(initialSettings.targetId);
  const [lineage, setLineage] = useState(initialSettings.lineage);
  const [trainedUmaSettings, setTrainedUmaSettings] =
    useState<TrainedUmaSettings>(initialSettings.trainedUmaSettings);
  const [routes, setRoutes] = useState<Record<BranchKey, string>>(
    initialSettings.routes,
  );
  const [routeMinimums, setRouteMinimums] = useState<RouteMinimums>(
    initialSettings.routeMinimums,
  );
  const [inheritanceAptitudes, setInheritanceAptitudes] = useState<FactorKey[]>(
    initialSettings.inheritanceAptitudes,
  );
  const [inheritanceTargets, setInheritanceTargets] =
    useState<InheritanceTargets>(initialSettings.inheritanceTargets);
  const [allowInRaceFactorJump, setAllowInRaceFactorJump] = useState(
    initialSettings.allowInRaceFactorJump,
  );
  const [inRaceFactorJumpMinimumRank, setInRaceFactorJumpMinimumRank] =
    useState(initialSettings.inRaceFactorJumpMinimumRank);
  const [excludedUmaIds, setExcludedUmaIds] = useState<number[]>(
    initialSettings.excludedUmaIds,
  );
  const [excludedCapturedSelectionIds, setExcludedCapturedSelectionIds] =
    useState<string[]>(initialSettings.excludedCapturedSelectionIds);
  const [slotRouteOverrides, setSlotRouteOverrides] =
    useState<SlotRouteOverrides>(initialSettings.slotRouteOverrides);
  const [capturedReuseMode, setCapturedReuseMode] = useState<CapturedReuseMode>(
    initialSettings.capturedReuseMode,
  );
  const [capturedBlueFactorMinimums, setCapturedBlueFactorMinimums] =
    useState<CapturedBlueFactorMinimums>(
      initialSettings.capturedBlueFactorMinimums,
    );
  const [fixedDressSlots, setFixedDressSlots] = useState<FixedDressSlots>(
    initialSettings.fixedDressSlots,
  );
  const [capturedFactorTargets, setCapturedFactorTargets] = useState<
    CapturedFactorTarget[]
  >(initialSettings.capturedFactorTargets);
  const [calculationSettingsOpen, setCalculationSettingsOpen] = useState(false);
  const [capturedSkillPickerOpen, setCapturedSkillPickerOpen] = useState(false);
  const [probabilityTargetRanks, setProbabilityTargetRanks] =
    useState<InheritanceTargets>({});
  const [
    configuredProbabilityTargetTypes,
    setConfiguredProbabilityTargetTypes,
  ] = useState<FactorKey[]>([]);
  const [calculationRequestId, setCalculationRequestId] = useState(0);
  const [calculationInputKey, setCalculationInputKey] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStage, setCalculationStage] = useState(0);
  const [calculationPairProgress, setCalculationPairProgress] = useState({
    current: 0,
    total: 0,
  });
  const [calculationResultPage, setCalculationResultPage] = useState(0);
  const [completedCalculation, setCompletedCalculation] =
    useState<CompletedCalculation>();
  const [draggedLineageSlot, setDraggedLineageSlot] =
    useState<LineageSlot | null>(null);
  const [lineageDropSlot, setLineageDropSlot] = useState<LineageSlot | null>(
    null,
  );
  const calculationRunToken = useRef(0);
  const capturedReusePairFilterRef = useRef<{
    inputKey: string;
    allowedPairKeys: Set<string>;
    truncated: boolean;
  } | undefined>(undefined);
  const excludedCapturedSelectionIdSet = useMemo(
    () => new Set(excludedCapturedSelectionIds),
    [excludedCapturedSelectionIds.join('|')],
  );
  const capturedUmas = useMemo(
    () =>
      allCapturedUmas.filter(
        (candidate) =>
          !excludedCapturedSelectionIdSet.has(candidate.selectionId),
      ),
    [allCapturedUmas, excludedCapturedSelectionIds.join('|')],
  );

  useEffect(() => {
    if (!calculationSettingsOpen) setCapturedSkillPickerOpen(false);
  }, [calculationSettingsOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(
        SUCCESSION_STORAGE_KEY,
        JSON.stringify({
          targetId,
          lineage,
          routes,
          routeMinimums,
          inheritanceAptitudes,
          inheritanceTargets,
          allowInRaceFactorJump,
          inRaceFactorJumpMinimumRank,
          excludedUmaIds,
          excludedCapturedSelectionIds,
          slotRouteOverrides,
          trainedUmaSettings,
          capturedReuseMode,
          capturedBlueFactorMinimums,
          capturedFactorTargets,
          fixedDressSlots,
        }),
      );
    } catch {
      // The planner still works when browser storage is unavailable.
    }
  }, [
    targetId,
    lineage,
    routes,
    routeMinimums,
    inheritanceAptitudes,
    inheritanceTargets,
    allowInRaceFactorJump,
    inRaceFactorJumpMinimumRank,
    excludedUmaIds,
    excludedCapturedSelectionIds,
    slotRouteOverrides,
    trainedUmaSettings,
    capturedReuseMode,
    capturedBlueFactorMinimums,
    capturedFactorTargets,
    fixedDressSlots,
  ]);

  useEffect(() => {
    if (!capturedUmas.length) return;
    const capturedBySelectionId = new Map(
      capturedUmas.map((candidate) => [candidate.selectionId, candidate]),
    );
    setTrainedUmaSettings((current) => {
      let changed = false;
      const next = { ...current };
      (Object.keys(current) as LineageSlot[]).forEach((slot) => {
        const setting = current[slot];
        const candidate = setting?.selectionId
          ? capturedBySelectionId.get(setting.selectionId)
          : undefined;
        if (!setting || !candidate || candidate.umaId !== setting.self.umaId)
          return;
        const candidateMembers = [candidate, ...candidate.parents];
        const settingMembers = [setting.self, ...setting.parents];
        if (
          candidateMembers.some(
            (member, index) => member.umaId !== settingMembers[index].umaId,
          )
        ) {
          return;
        }
        const hydratedMembers = settingMembers.map((member, index) => ({
          ...member,
          cardId: candidateMembers[index].cardId,
          winSaddleIds: candidateMembers[index].winSaddleIds,
        })) as [
          TrainedLineageMember,
          TrainedLineageMember,
          TrainedLineageMember,
        ];
        if (
          hydratedMembers.every(
            (member, index) =>
              member.cardId === settingMembers[index].cardId &&
              JSON.stringify(member.winSaddleIds) ===
                JSON.stringify(settingMembers[index].winSaddleIds),
          )
        ) {
          return;
        }
        changed = true;
        next[slot] = {
          ...setting,
          self: hydratedMembers[0],
          parents: [hydratedMembers[1], hydratedMembers[2]],
        };
      });
      return changed ? next : current;
    });
  }, [capturedUmas]);

  const umaById = useMemo(
    () => new Map(data.umas.map((uma) => [uma.id, uma])),
    [],
  );
  const target = umaById.get(targetId);
  const capturedParentSettings = [
    trainedUmaSettings.father,
    trainedUmaSettings.mother,
  ].filter((setting): setting is TrainedUmaSetting => Boolean(setting?.source));
  const capturedOwnershipInvalid =
    capturedReuseMode === 'off' &&
    capturedParentSettings.length === 2 &&
    capturedParentSettings.every((setting) => setting.source === 'rental');
  const capturedReuseUnavailable =
    capturedReuseMode !== 'off' && capturedUmas.length < 2;
  const capturedFactorSources = useMemo(
    () =>
      capturedUmas.flatMap((candidate) =>
        [candidate, ...candidate.parents].flatMap((member) =>
          member.inheritanceFactors.map((factor) => ({
            factor,
            generation: 2 as const,
          })),
        ),
      ),
    [capturedUmas],
  );
  const capturedFactorTargetOptions = useMemo(() => {
    const options = new Map<string, CapturedFactorTargetOption>();
    Object.values(successionFactorMeta).forEach((meta) => {
      const skillTargets = meta.skillTargets?.length
        ? meta.skillTargets
        : meta.skillGroupIds.map((groupId) => ({
            groupId,
            name:
              successionSkillMeta[groupId]?.name ||
              (meta.factorType === 5
                ? UMDB.skillTipName(groupId, 1)
                : meta.name),
            iconId: successionSkillMeta[groupId]?.iconId || 0,
          }));
      skillTargets.forEach((skillTarget) => {
        const target: CapturedFactorTarget = {
          kind: 'skill',
          groupId: skillTarget.groupId,
        };
        const key = capturedFactorTargetKey(target);
        if (options.has(key)) return;
        const availableCount = capturedFactorSources.filter(({ factor }) => {
          const sourceMeta = successionFactorMeta[factor.id];
          if (!sourceMeta) return false;
          return sourceMeta.skillGroupIds.includes(target.groupId);
        }).length;
        options.set(key, {
          ...target,
          name:
            successionSkillMeta[skillTarget.groupId]?.name || skillTarget.name,
          iconId:
            successionSkillMeta[skillTarget.groupId]?.iconId ||
            skillTarget.iconId,
          availableCount,
        });
      });
    });
    return [...options.values()].sort(
      (left, right) =>
        Number(right.availableCount > 0) - Number(left.availableCount > 0) ||
        left.name.localeCompare(right.name, 'zh-CN'),
    );
  }, [capturedFactorSources, successionFactorMeta]);
  const toggleCapturedFactorTarget = (target: CapturedFactorTarget) => {
    const key = capturedFactorTargetKey(target);
    setCapturedFactorTargets((current) =>
      current.some((item) => capturedFactorTargetKey(item) === key)
        ? current.filter((item) => capturedFactorTargetKey(item) !== key)
        : [...current, target],
    );
  };
  const reorderCapturedFactorTarget = (
    sourceKey: string,
    targetKey: string,
  ) => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    setCapturedFactorTargets((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex(
        (target) => capturedFactorTargetKey(target) === sourceKey,
      );
      const targetIndex = next.findIndex(
        (target) => capturedFactorTargetKey(target) === targetKey,
      );
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };
  const capturedSkillPickerSkills = useMemo(() => {
    const skillsByName = new Map(
      Object.values(UMDB.skills).map((skill) => [skill.name || '', skill]),
    );
    return capturedFactorTargetOptions.map((option) => {
      const skill = skillsByName.get(option.name);
      return {
        id: Number(skill?.id || option.groupId),
        name: option.name,
        rarity: 1,
        group_id: option.groupId,
        grade_value: Number(skill?.gradeValue || 0),
        need_skill_point: 0,
        disable_singlemode: 0,
        tags: (skill?.tagId || []).map(Number).filter(Number.isFinite),
        icon_id: option.iconId,
        skill_category: 0,
      } satisfies AutoResearchSkill;
    });
  }, [capturedFactorTargetOptions]);
  const selectedCapturedFactorTargetLabels = capturedFactorTargets.map(
    (target) =>
      capturedFactorTargetOptions.find(
        (option) =>
          capturedFactorTargetKey(option) === capturedFactorTargetKey(target),
      )?.name || `${target.kind}:${target.groupId}`,
  );
  const effectiveCapturedFactorTargets =
    capturedReuseMode === 'off' ? [] : capturedFactorTargets;
  const capturedReuseInputKey =
    capturedReuseMode === 'off'
      ? ''
      : capturedUmas
          .map((candidate) =>
            [
              candidate.selectionId,
              candidate.umaId,
              candidate.factor.type,
              candidate.factor.stars,
              candidate.blueFactor?.type || '',
              candidate.blueFactor?.stars || 0,
              ...candidate.inheritanceFactors.map((factor) => factor.id),
              ...candidate.parents.flatMap((parent) => [
                parent.umaId,
                parent.factor.type,
                parent.factor.stars,
                parent.blueFactor?.type || '',
                parent.blueFactor?.stars || 0,
                ...parent.inheritanceFactors.map((factor) => factor.id),
              ]),
              candidate.winSaddleIds.join(','),
            ].join(':'),
          )
          .sort()
          .join('|');
  const excludedUmaIdSet = useMemo(
    () => new Set(excludedUmaIds),
    [excludedUmaIds.join('|')],
  );
  const currentCalculationInputKey = JSON.stringify({
    targetId,
    lineage,
    routes,
    routeMinimums,
    inheritanceAptitudes,
    inheritanceTargets,
    allowInRaceFactorJump,
    inRaceFactorJumpMinimumRank,
    probabilityTargetRanks,
    excludedUmaIds,
    excludedCapturedSelectionIds,
    slotRouteOverrides,
    trainedUmaSettings,
    capturedReuseMode,
    capturedBlueFactorMinimums,
    capturedFactorTargets: effectiveCapturedFactorTargets,
    fixedDressSlots,
    capturedReuseInputKey,
    successionG1SaddleIds,
  });
  const calculationReady =
    calculationRequestId > 0 &&
    calculationInputKey === currentCalculationInputKey;
  const selectedLineageIds = Object.values(lineage).filter(Boolean);
  const excludedIdsForSlot = (slot: LineageSlot) => {
    const isParent = slot === 'father' || slot === 'mother';
    const sameBranchGrandparents = slot.startsWith('paternal')
      ? [lineage.paternalA, lineage.paternalB]
      : [lineage.maternalA, lineage.maternalB];
    const ids = isParent
      ? [targetId, ...selectedLineageIds]
      : [targetId, lineage.father, lineage.mother, ...sameBranchGrandparents];
    return [...new Set(ids.filter((id) => id && id !== lineage[slot]))];
  };
  const selectedRoutes = {
    paternal: ROUTES.find((route) => route.id === routes.paternal) || ROUTES[0],
    maternal: ROUTES.find((route) => route.id === routes.maternal) || ROUTES[1],
  };
  const branchForSlot = (slot: LineageSlot): BranchKey =>
    slot === 'father' || slot.startsWith('paternal') ? 'paternal' : 'maternal';
  const routeSettingForSlot = (slot: LineageSlot, umaId = lineage[slot]) => {
    const branch = branchForSlot(slot);
    const fixedSlot = umaId
      ? BRANCH_SLOTS[branch].find(
          (candidateSlot) => lineage[candidateSlot] === umaId,
        )
      : undefined;
    const overrideSlot =
      fixedSlot && slotRouteOverrides[fixedSlot] ? fixedSlot : undefined;
    const override = overrideSlot
      ? slotRouteOverrides[overrideSlot]
      : undefined;
    const minimums = override?.minimums || routeMinimums[branch];
    const fixedUma = fixedSlot ? umaById.get(umaId) : undefined;
    return {
      route:
        ROUTES.find((route) => route.id === override?.routeId) ||
        selectedRoutes[branch],
      minimums: fixedUma
        ? fitMinimumsForUma(
            minimums,
            fixedUma,
            ROUTES.find((route) => route.id === override?.routeId) ||
              selectedRoutes[branch],
          )
        : minimums,
    };
  };
  const commonG1Count = (first: Route, second: Route) => {
    if (first.id === 'none' || second.id === 'none') return 0;
    const secondIds = new Set(second.winSaddleIds);
    return first.winSaddleIds.filter((id) => secondIds.has(id)).length;
  };
  const trainedMemberForSlot = (
    slot: LineageSlot,
    expectedUmaId = lineage[slot],
  ): TrainedLineageMember | undefined => {
    const direct = trainedUmaSettings[slot]?.self;
    if (direct?.umaId === expectedUmaId) return direct;
    const inheritedMappings: Partial<
      Record<LineageSlot, { parent: LineageSlot; index: 0 | 1 }>
    > = {
      paternalA: { parent: 'father', index: 0 },
      paternalB: { parent: 'father', index: 1 },
      maternalA: { parent: 'mother', index: 0 },
      maternalB: { parent: 'mother', index: 1 },
    };
    const mapping = inheritedMappings[slot];
    const inherited = mapping
      ? trainedUmaSettings[mapping.parent]?.parents[mapping.index]
      : undefined;
    return inherited?.umaId === expectedUmaId ? inherited : undefined;
  };
  const resolvedCommonG1 = (
    firstMember: Pick<TrainedLineageMember, 'winSaddleIds'> | undefined,
    firstRoute: Route,
    secondMember: Pick<TrainedLineageMember, 'winSaddleIds'> | undefined,
    secondRoute: Route,
  ) => {
    const detailedCount = detailedCommonG1Count(
      firstMember?.winSaddleIds?.length
        ? firstMember.winSaddleIds
        : firstRoute.winSaddleIds,
      secondMember?.winSaddleIds?.length
        ? secondMember.winSaddleIds
        : secondRoute.winSaddleIds,
      successionG1SaddleIds,
    );
    return detailedCount === undefined
      ? {
          count: commonG1Count(firstRoute, secondRoute),
          source: 'route' as const,
        }
      : {
          count: detailedCount,
          source:
            firstMember?.winSaddleIds?.length ||
            secondMember?.winSaddleIds?.length
              ? ('detailed' as const)
              : ('route' as const),
        };
  };
  const targetInheritanceAllocations = target
    ? inheritanceAllocation(target, inheritanceAptitudes, inheritanceTargets)
    : [];
  const rawTargetFactorPlanEnumerator = useMemo(
    () =>
      calculationReady
        ? createTargetFactorPlanEnumerator(
            inheritanceAptitudes,
            target
              ? Object.fromEntries(
                  inheritanceAllocation(
                    target,
                    inheritanceAptitudes,
                    inheritanceTargets,
                  ).map((item) => [item.type, item.stars]),
                )
              : {},
          )
        : EMPTY_TARGET_FACTOR_PLAN_ENUMERATOR,
    [
      calculationReady,
      targetId,
      inheritanceAptitudes.join('|'),
      JSON.stringify(inheritanceTargets),
    ],
  );
  useEffect(() => {
    if (!target) {
      setProbabilityTargetRanks({});
      setConfiguredProbabilityTargetTypes([]);
      return;
    }
    const guaranteedRanks = new Map(
      inheritanceAllocation(
        target,
        inheritanceAptitudes,
        inheritanceTargets,
      ).map((item) => [item.type, item.target]),
    );
    setProbabilityTargetRanks((current) =>
      Object.fromEntries(
        inheritanceAptitudes.map((type) => {
          const guaranteed =
            guaranteedRanks.get(type) || target.aptitudes[type];
          const defaultTarget = guaranteed >= 7 ? 8 : 7;
          const selectedTarget = configuredProbabilityTargetTypes.includes(type)
            ? current[type] || defaultTarget
            : defaultTarget;
          return [type, Math.min(8, Math.max(guaranteed, selectedTarget))];
        }),
      ),
    );
  }, [
    targetId,
    inheritanceAptitudes.join('|'),
    JSON.stringify(inheritanceTargets),
  ]);

  const relationScore = (...ids: number[]) => {
    if (
      !ids.length ||
      ids.some((value) => !value) ||
      new Set(ids).size !== ids.length
    ) {
      return 0;
    }
    const relationSets = ids.map(
      (id) => new Set(umaById.get(id)?.relationTypes || []),
    );
    if (relationSets.some((set) => !set.size)) return 0;
    const shared = [...relationSets[0]].filter((type) =>
      relationSets.slice(1).every((set) => set.has(type)),
    );
    return shared.reduce(
      (total, type) => total + (data.relationPoints[String(type)] || 0),
      0,
    );
  };

  const positionScore = (
    slot: LineageSlot,
    branch: BranchKey,
    parentId?: number,
  ): PositionCompatibilityScore => {
    const umaId = lineage[slot];
    const base =
      !target || !umaId
        ? 0
        : parentId
          ? relationScore(targetId, parentId, umaId)
          : relationScore(targetId, umaId);
    const isParentSlot = slot === 'father' || slot === 'mother';
    const slotRoute = routeSettingForSlot(slot).route;
    const parentSlot = branch === 'paternal' ? 'father' : 'mother';
    const parentRoute = routeSettingForSlot(parentSlot).route;
    const g1 = !umaId
      ? { count: 0, source: 'route' as const }
      : isParentSlot
        ? { count: 0, source: 'route' as const }
        : resolvedCommonG1(
            trainedMemberForSlot(parentSlot, lineage[parentSlot]),
            parentRoute,
            trainedMemberForSlot(slot, umaId),
            slotRoute,
          );
    const relationNames = [
      target?.name,
      parentId ? umaById.get(parentId)?.name : undefined,
      umaById.get(umaId)?.name,
    ].filter((name): name is string => Boolean(name));
    return {
      base,
      g1Count: g1.count,
      g1Source: g1.source,
      relationNames,
      total: umaId ? base + g1.count * G1_COMPATIBILITY_POINTS : 0,
    };
  };

  const parentPairBase = relationScore(lineage.father, lineage.mother);
  const parentPairCompatibility = parentPairBase;

  const paternalACompatibility = positionScore(
    'paternalA',
    'paternal',
    lineage.father,
  );
  const paternalBCompatibility = positionScore(
    'paternalB',
    'paternal',
    lineage.father,
  );
  const fatherOwnCompatibility = positionScore('father', 'paternal');
  const fatherCompatibility: PositionCompatibilityScore = {
    ...fatherOwnCompatibility,
    ownTotal: fatherOwnCompatibility.base,
    inheritedTotal: paternalACompatibility.total + paternalBCompatibility.total,
    coParentLabel: SLOT_LABELS.mother,
    coParentName: umaById.get(lineage.mother)?.name,
    coParentBase: parentPairBase,
    coParentTotal: parentPairCompatibility,
    ancestorDetails: [
      {
        label: SLOT_LABELS.paternalA,
        umaName: umaById.get(lineage.paternalA)?.name,
        ...paternalACompatibility,
      },
      {
        label: SLOT_LABELS.paternalB,
        umaName: umaById.get(lineage.paternalB)?.name,
        ...paternalBCompatibility,
      },
    ],
    total:
      fatherOwnCompatibility.base +
      parentPairCompatibility +
      paternalACompatibility.total +
      paternalBCompatibility.total,
  };

  const maternalACompatibility = positionScore(
    'maternalA',
    'maternal',
    lineage.mother,
  );
  const maternalBCompatibility = positionScore(
    'maternalB',
    'maternal',
    lineage.mother,
  );
  const motherOwnCompatibility = positionScore('mother', 'maternal');
  const motherCompatibility: PositionCompatibilityScore = {
    ...motherOwnCompatibility,
    ownTotal: motherOwnCompatibility.base,
    inheritedTotal: maternalACompatibility.total + maternalBCompatibility.total,
    coParentLabel: SLOT_LABELS.father,
    coParentName: umaById.get(lineage.father)?.name,
    coParentBase: parentPairBase,
    coParentTotal: parentPairCompatibility,
    ancestorDetails: [
      {
        label: SLOT_LABELS.maternalA,
        umaName: umaById.get(lineage.maternalA)?.name,
        ...maternalACompatibility,
      },
      {
        label: SLOT_LABELS.maternalB,
        umaName: umaById.get(lineage.maternalB)?.name,
        ...maternalBCompatibility,
      },
    ],
    total:
      motherOwnCompatibility.base +
      parentPairCompatibility +
      maternalACompatibility.total +
      maternalBCompatibility.total,
  };

  const positionCompatibility: Record<LineageSlot, PositionCompatibilityScore> =
    {
      father: fatherCompatibility,
      paternalA: paternalACompatibility,
      paternalB: paternalBCompatibility,
      mother: motherCompatibility,
      maternalA: maternalACompatibility,
      maternalB: maternalBCompatibility,
    };
  const branchConfigs: Record<
    BranchKey,
    { parent: LineageSlot; grandparents: [LineageSlot, LineageSlot] }
  > = {
    paternal: {
      parent: 'father',
      grandparents: ['paternalA', 'paternalB'],
    },
    maternal: {
      parent: 'mother',
      grandparents: ['maternalA', 'maternalB'],
    },
  };
  const lineageFullyUnfixed = TARGET_FACTOR_SLOTS.every(
    (slot) => !lineage[slot],
  );
  const branchSettingsEquivalent =
    routes.paternal === routes.maternal &&
    ALL_APTITUDES.every(
      (type) => routeMinimums.paternal[type] === routeMinimums.maternal[type],
    );
  const branchesInterchangeable =
    lineageFullyUnfixed &&
    branchSettingsEquivalent &&
    !Object.keys(trainedUmaSettings).length;
  const factorProductionMinimumRank = allowInRaceFactorJump
    ? inRaceFactorJumpMinimumRank
    : 7;
  const factorPlanBranchKey = (plan: TargetFactorPlan, branch: BranchKey) => {
    const { parent, grandparents } = branchConfigs[branch];
    const grandparentKeys = grandparents
      .map((slot) => factorAssignmentKey(plan.assignments[slot]))
      .sort();
    return [
      factorAssignmentKey(plan.assignments[parent]),
      ...grandparentKeys,
    ].join('|');
  };

  const buildBranchStrategies = (
    factorPlan: TargetFactorPlan,
    branch: BranchKey,
  ): BranchFactorStrategy[] => {
    const { parent, grandparents } = branchConfigs[branch];
    const slots: [LineageSlot, LineageSlot, LineageSlot] = [
      parent,
      ...grandparents,
    ];
    const trainedParent = trainedUmaSettings[parent];
    if (trainedParent && capturedReuseMode === 'off') {
      const trainedMembers = [trainedParent.self, ...trainedParent.parents];
      const trainedUmas = trainedMembers.map((member) =>
        umaById.get(member.umaId),
      );
      if (trainedUmas.some((uma) => !uma)) return [];
      return [
        {
          positions: slots.map((slot, index) => ({
            code: SLOT_CODES[slot],
            generation: index === 0 ? 1 : 2,
            uma: trainedUmas[index]!,
            factor: trainedMembers[index].factor,
            fixed: true,
            requiresUma: true,
          })),
          cumulativeRequirements: [],
          greatFactorRequirements: {
            parent: {},
            grandparents: [{}, {}],
          },
          capturedSelectionIds: trainedParent.selectionId
            ? [trainedParent.selectionId]
            : [],
          capturedSources: trainedParent.source ? [trainedParent.source] : [],
        },
      ];
    }
    const effectiveAssignmentForSlot = (
      slot: LineageSlot,
    ): FactorAssignment => {
      const trainedFactor =
        capturedReuseMode === 'off'
          ? trainedUmaSettings[slot]?.self.factor
          : undefined;
      return trainedFactor
        ? { ...trainedFactor }
        : factorPlan.assignments[slot];
    };
    const factorRequirementForCandidate = (
      slot: LineageSlot,
      candidate: SuccessionUma,
      producedType?: FactorKey,
    ) => {
      const trainedSelf = trainedUmaSettings[slot]?.self;
      if (capturedReuseMode === 'off' && trainedSelf?.umaId === candidate.id) {
        return { demand: {}, impossible: [] as FactorKey[] };
      }
      const setting = routeSettingForSlot(slot, candidate.id);
      return factorDemandForUma(
        candidate,
        setting.route,
        setting.minimums,
        producedType,
        factorProductionMinimumRank,
      );
    };
    const inRaceFactorJumpForCandidate = (
      slot: LineageSlot,
      candidate: SuccessionUma,
      assignment: FactorAssignment,
    ): CompleteDesignPosition['inRaceFactorJump'] => {
      if (
        (capturedReuseMode === 'off' && trainedUmaSettings[slot]) ||
        !allowInRaceFactorJump ||
        assignment.unconstrained ||
        candidate.aptitudes[assignment.type] >= 7
      ) {
        return undefined;
      }
      const setting = routeSettingForSlot(slot, candidate.id);
      const fromRank = Math.max(
        setting.route.aptitudes.includes(assignment.type)
          ? setting.minimums[assignment.type]
          : 0,
        factorProductionMinimumRank,
      );
      const requiredStars = minimumStarsForRank(
        candidate.aptitudes[assignment.type],
        fromRank,
      );
      if (fromRank >= 7 || !requiredStars) return undefined;
      return {
        type: assignment.type,
        fromRank,
        toRank: 7,
      };
    };
    const candidateCanProduceConfiguredFactor = (
      slot: LineageSlot,
      candidate: SuccessionUma,
    ) =>
      inheritanceAptitudes.some((type) => {
        const requirement = factorRequirementForCandidate(
          slot,
          candidate,
          type,
        );
        return (
          !requirement.impossible.length &&
          demandSlotCount(requirement.demand) <= MAX_INHERITANCE_SLOTS
        );
      });

    const slotAcceptsCapturedMember = (
      slot: LineageSlot,
      member: CapturedLineageMember,
    ) => {
      const fixedUmaId = lineage[slot];
      const trainedMember = trainedUmaSettings[slot]?.self;
      const fixedDressCardId = trainedMember?.cardId || fixedDressSlots[slot];
      return capturedMemberMatchesSlotConstraint(member, {
        targetId,
        fixedUmaId,
        trainedUmaId: trainedMember?.umaId,
        fixedDressCardId,
        excluded: excludedUmaIdSet.has(member.umaId),
      });
    };
    const capturedPosition = (
      member: CapturedLineageMember,
      code: string,
      generation: 1 | 2,
      root?: CapturedTrainedUma,
      fixed = false,
    ): CompleteDesignPosition => ({
      code,
      generation,
      uma: umaById.get(member.umaId),
      factor: { type: member.factor.type, stars: member.factor.stars },
      fixed,
      requiresUma: true,
      winSaddleIds: member.winSaddleIds,
      capturedInheritanceFactors: member.inheritanceFactors,
      capturedFactorSummary: {
        blueFactor: member.blueFactor,
        aptitudeFactor: member.factor,
        uniqueFactorStars: member.uniqueFactorStars,
        selectedSkillFactors: effectiveCapturedFactorTargets.map((target) => ({
          groupId: target.groupId,
          name:
            capturedFactorTargetOptions.find(
              (option) =>
                capturedFactorTargetKey(option) ===
                capturedFactorTargetKey(target),
            )?.name || `技能 ${target.groupId}`,
          count: capturedSelectedSkillFactorCount(
            member.inheritanceFactors,
            [target],
            successionFactorMeta,
          ),
        })),
        whiteFactorCount: member.whiteFactorCount,
      },
      ...(root
        ? {
            capturedSelectionId: root.selectionId,
            capturedSource: root.source,
            capturedOwnerName: root.ownerName,
            capturedViewerId: root.viewerId,
          }
        : {}),
    });
    const capturedDirectStrategies = () => {
      const preparedPairFilter = capturedReusePairFilterRef.current;
      const allowedSelectionIds =
        preparedPairFilter?.inputKey === currentCalculationInputKey
          ? new Set(
              [...preparedPairFilter.allowedPairKeys].map((pairKey) => {
                const [paternalSelectionId, maternalSelectionId] =
                  pairKey.split('|');
                return branch === 'paternal'
                  ? paternalSelectionId
                  : maternalSelectionId;
              }),
            )
          : undefined;
      return capturedUmas
        .filter(
          (candidate) =>
            !allowedSelectionIds ||
            allowedSelectionIds.has(candidate.selectionId),
        )
        .filter((candidate) => {
          const members = [candidate, ...candidate.parents];
          if (new Set(members.map((member) => member.umaId)).size !== 3) {
            return false;
          }
          return slots.every((slot, index) =>
            slotAcceptsCapturedMember(slot, members[index]),
          );
        })
        .map((candidate): BranchFactorStrategy => {
          const members = [candidate, ...candidate.parents];
          return {
            positions: [
              capturedPosition(
                candidate,
                SLOT_CODES[parent],
                1,
                candidate,
                Boolean(lineage[parent]),
              ),
              capturedPosition(
                candidate.parents[0],
                SLOT_CODES[grandparents[0]],
                2,
                undefined,
                Boolean(lineage[grandparents[0]]),
              ),
              capturedPosition(
                candidate.parents[1],
                SLOT_CODES[grandparents[1]],
                2,
                undefined,
                Boolean(lineage[grandparents[1]]),
              ),
            ],
            cumulativeRequirements: [],
            greatFactorRequirements: {
              parent: {},
              grandparents: [{}, {}],
            },
            capturedSelectionIds: [candidate.selectionId],
            capturedSources: [candidate.source],
            capturedBlueFactorTotals: capturedBlueFactorTotals(members),
          };
        });
    };

    if (capturedReuseMode !== 'off') {
      return capturedDirectStrategies();
    }

    const buildCandidateList = (
      slot: LineageSlot,
      allowedFixedUmas?: SuccessionUma[],
    ) => {
      const trainedSelf = trainedUmaSettings[slot]?.self;
      if (trainedSelf) {
        const trainedUma = umaById.get(trainedSelf.umaId);
        return trainedUma ? [trainedUma] : [];
      }
      const assignment = effectiveAssignmentForSlot(slot);
      return data.umas
        .filter((candidate) => {
          if (candidate.id === targetId) return false;
          const fixedCandidate =
            lineage[slot] === candidate.id ||
            Boolean(allowedFixedUmas?.some((uma) => uma.id === candidate.id));
          if (excludedUmaIdSet.has(candidate.id) && !fixedCandidate) {
            return false;
          }
          if (
            allowedFixedUmas?.length === 2 &&
            !allowedFixedUmas.some((uma) => uma.id === candidate.id)
          ) {
            return false;
          }
          if (
            assignment.unconstrained &&
            candidateCanProduceConfiguredFactor(slot, candidate)
          ) {
            // “自由”是该马娘无法产出任何目标红因子时的兜底，不与
            // 可产出的具体红因子方案一起参与同概率候选。
            return false;
          }
          const requirement = factorRequirementForCandidate(
            slot,
            candidate,
            assignment.unconstrained ? undefined : assignment.type,
          );
          return (
            !requirement.impossible.length &&
            demandSlotCount(requirement.demand) <= MAX_INHERITANCE_SLOTS
          );
        })
        .map((candidate) => {
          const setting = routeSettingForSlot(slot, candidate.id);
          return {
            candidate,
            factorQuality: assignment.unconstrained
              ? 0
              : candidate.aptitudes[assignment.type],
            routeQuality: setting.route.aptitudes.reduce(
              (total, type) => total + candidate.aptitudes[type],
              0,
            ),
            compatibility: relationScore(targetId, candidate.id),
          };
        })
        .sort(
          (a, b) =>
            b.factorQuality - a.factorQuality ||
            b.routeQuality - a.routeQuality ||
            b.compatibility - a.compatibility ||
            a.candidate.name.localeCompare(b.candidate.name, 'zh-CN'),
        )
        .map(({ candidate }) => candidate);
    };

    const fixedParent = umaById.get(lineage[parent]);
    const fixedGrandparents = grandparents
      .map((slot) => umaById.get(lineage[slot]))
      .filter(
        (uma, index, values): uma is SuccessionUma =>
          Boolean(uma) &&
          values.findIndex((candidate) => candidate?.id === uma?.id) === index,
      );
    const fixedGrandparentIds = new Set(fixedGrandparents.map((uma) => uma.id));
    const candidateLists: [SuccessionUma[], SuccessionUma[], SuccessionUma[]] =
      [
        fixedParent ? [fixedParent] : buildCandidateList(parent),
        buildCandidateList(grandparents[0], fixedGrandparents),
        buildCandidateList(grandparents[1], fixedGrandparents),
      ];
    const pruneDominatedParents = (candidates: SuccessionUma[]) => {
      if (fixedParent) return candidates;
      const assignment = effectiveAssignmentForSlot(parent);
      const parentSetting = routeSettingForSlot(parent);
      const relevantTypes = [
        ...new Set([
          ...parentSetting.route.aptitudes,
          ...(assignment.unconstrained ? [] : [assignment.type]),
        ]),
      ];
      const targetRelationTypes = new Set(target?.relationTypes || []);
      const fixedCoParentId =
        branch === 'paternal' ? lineage.mother : lineage.father;
      const metrics = new Map(
        candidates.map((candidate) => {
          const relationTypes = new Set(candidate.relationTypes);
          return [
            candidate.id,
            {
              compatibility: relationScore(targetId, candidate.id),
              coParentCompatibility: fixedCoParentId
                ? relationScore(candidate.id, fixedCoParentId)
                : 0,
              demand: factorRequirementForCandidate(
                parent,
                candidate,
                assignment.unconstrained ? undefined : assignment.type,
              ).demand,
              relationTypes,
              sharedTargetRelationTypes: new Set(
                candidate.relationTypes.filter((type) =>
                  targetRelationTypes.has(type),
                ),
              ),
            },
          ] as const;
        }),
      );
      return candidates.filter((candidate) => {
        if (fixedGrandparentIds.has(candidate.id)) return false;
        const candidateMetrics = metrics.get(candidate.id)!;
        return !candidates.some((other) => {
          if (other.id === candidate.id || fixedGrandparentIds.has(other.id)) {
            return false;
          }
          const otherMetrics = metrics.get(other.id)!;
          const aptitudeNoWorse = relevantTypes.every(
            (type) => other.aptitudes[type] >= candidate.aptitudes[type],
          );
          const demandNoWorse = ALL_APTITUDES.every(
            (type) =>
              (otherMetrics.demand[type] || 0) <=
              (candidateMetrics.demand[type] || 0),
          );
          const targetRelationsCover = [
            ...candidateMetrics.sharedTargetRelationTypes,
          ].every((type) => otherMetrics.sharedTargetRelationTypes.has(type));
          const coParentRelationsNoWorse = fixedCoParentId
            ? otherMetrics.coParentCompatibility >=
              candidateMetrics.coParentCompatibility
            : [...candidateMetrics.relationTypes].every((type) =>
                otherMetrics.relationTypes.has(type),
              );
          const compatibilityNoWorse =
            otherMetrics.compatibility >= candidateMetrics.compatibility;
          const strictlyBetter =
            relevantTypes.some(
              (type) => other.aptitudes[type] > candidate.aptitudes[type],
            ) ||
            ALL_APTITUDES.some(
              (type) =>
                (otherMetrics.demand[type] || 0) <
                (candidateMetrics.demand[type] || 0),
            ) ||
            otherMetrics.compatibility > candidateMetrics.compatibility ||
            (fixedCoParentId
              ? otherMetrics.coParentCompatibility >
                candidateMetrics.coParentCompatibility
              : otherMetrics.relationTypes.size >
                candidateMetrics.relationTypes.size);
          return (
            aptitudeNoWorse &&
            demandNoWorse &&
            targetRelationsCover &&
            coParentRelationsNoWorse &&
            compatibilityNoWorse &&
            strictlyBetter
          );
        });
      });
    };
    candidateLists[0] = pruneDominatedParents(candidateLists[0]);
    const pruneDominatedGrandparents = (
      candidates: SuccessionUma[],
      slot: LineageSlot,
      parentUma: SuccessionUma,
    ) => {
      if (fixedGrandparents.length === 2) return candidates;
      const assignment = effectiveAssignmentForSlot(slot);
      const slotSetting = routeSettingForSlot(slot);
      const relevantTypes = [
        ...new Set([
          ...slotSetting.route.aptitudes,
          ...(assignment.unconstrained ? [] : [assignment.type]),
        ]),
      ];
      const metrics = new Map(
        candidates.map((candidate) => [
          candidate.id,
          {
            compatibility: relationScore(targetId, parentUma.id, candidate.id),
            demand: factorRequirementForCandidate(
              slot,
              candidate,
              assignment.unconstrained ? undefined : assignment.type,
            ).demand,
          },
        ]),
      );
      return candidates.filter((candidate) => {
        if (fixedGrandparentIds.has(candidate.id)) {
          return true;
        }
        const candidateMetrics = metrics.get(candidate.id)!;
        return !candidates.some((other) => {
          if (other.id === candidate.id || fixedGrandparentIds.has(other.id)) {
            return false;
          }
          const otherMetrics = metrics.get(other.id)!;
          const aptitudeNoWorse = relevantTypes.every(
            (type) => other.aptitudes[type] >= candidate.aptitudes[type],
          );
          const demandNoWorse = ALL_APTITUDES.every(
            (type) =>
              (otherMetrics.demand[type] || 0) <=
              (candidateMetrics.demand[type] || 0),
          );
          const compatibilityNoWorse =
            otherMetrics.compatibility >= candidateMetrics.compatibility;
          const strictlyBetter =
            relevantTypes.some(
              (type) => other.aptitudes[type] > candidate.aptitudes[type],
            ) ||
            ALL_APTITUDES.some(
              (type) =>
                (otherMetrics.demand[type] || 0) <
                (candidateMetrics.demand[type] || 0),
            ) ||
            otherMetrics.compatibility > candidateMetrics.compatibility;
          return (
            aptitudeNoWorse &&
            demandNoWorse &&
            compatibilityNoWorse &&
            strictlyBetter
          );
        });
      });
    };
    const grandparentAssignmentsEquivalent =
      effectiveFactorRoleKey(effectiveAssignmentForSlot(grandparents[0])) ===
      effectiveFactorRoleKey(effectiveAssignmentForSlot(grandparents[1]));
    function* grandparentPairs(
      parentUma: SuccessionUma,
    ): Generator<[SuccessionUma, SuccessionUma]> {
      let firstCandidates = pruneDominatedGrandparents(
        candidateLists[1],
        grandparents[0],
        parentUma,
      );
      let secondCandidates = pruneDominatedGrandparents(
        candidateLists[2],
        grandparents[1],
        parentUma,
      );
      if (!fixedGrandparents.length && !grandparentAssignmentsEquivalent) {
        const sharedCandidates = [
          ...new Map(
            [...firstCandidates, ...secondCandidates].map((uma) => [
              uma.id,
              uma,
            ]),
          ).values(),
        ].sort((a, b) => a.id - b.id);
        firstCandidates = sharedCandidates;
        secondCandidates = sharedCandidates;
      }
      const firstGrandparentById = new Map(
        firstCandidates.map((uma) => [uma.id, uma]),
      );
      const secondGrandparentById = new Map(
        secondCandidates.map((uma) => [uma.id, uma]),
      );
      if (fixedGrandparents.length === 1) {
        const fixedUma = fixedGrandparents[0];
        const fixedAsFirst = firstGrandparentById.get(fixedUma.id);
        if (fixedAsFirst) {
          for (const secondUma of secondCandidates) {
            if (secondUma.id !== fixedUma.id) yield [fixedAsFirst, secondUma];
          }
        }
        if (!grandparentAssignmentsEquivalent) {
          const fixedAsSecond = secondGrandparentById.get(fixedUma.id);
          if (fixedAsSecond) {
            for (const firstUma of firstCandidates) {
              if (firstUma.id !== fixedUma.id) yield [firstUma, fixedAsSecond];
            }
          }
        }
        return;
      }

      if (fixedGrandparents.length === 2) {
        const [firstFixed, secondFixed] = fixedGrandparents;
        const directPair = [
          firstGrandparentById.get(firstFixed.id),
          secondGrandparentById.get(secondFixed.id),
        ] as const;
        if (directPair[0] && directPair[1]) {
          yield [directPair[0], directPair[1]];
        }
        if (!grandparentAssignmentsEquivalent) {
          const swappedPair = [
            firstGrandparentById.get(secondFixed.id),
            secondGrandparentById.get(firstFixed.id),
          ] as const;
          if (swappedPair[0] && swappedPair[1]) {
            yield [swappedPair[0], swappedPair[1]];
          }
        }
        return;
      }

      for (
        let firstIndex = 0;
        firstIndex < firstCandidates.length;
        firstIndex += 1
      ) {
        for (
          let secondIndex = 0;
          secondIndex < secondCandidates.length;
          secondIndex += 1
        ) {
          const firstUma = firstCandidates[firstIndex];
          const secondUma = secondCandidates[secondIndex];
          // 空祖辈槽没有左右语义：马娘组合只按 ID 升序生成一次。
          // 不同因子角色在下方交换 assignment，而不是反向遍历马娘。
          if (firstUma.id >= secondUma.id) continue;
          yield [firstUma, secondUma];
        }
      }
    }

    const strategies: BranchFactorStrategy[] = [];
    const seenStrategies = new Set<string>();
    for (const parentUma of candidateLists[0]) {
      for (const [firstGrandparent, secondGrandparent] of grandparentPairs(
        parentUma,
      )) {
        const directUmas = [parentUma, firstGrandparent, secondGrandparent];
        if (new Set(directUmas.map((uma) => uma.id)).size !== 3) continue;

        const parentAssignment = effectiveAssignmentForSlot(parent);
        if (
          parentAssignment.unconstrained &&
          candidateCanProduceConfiguredFactor(parent, parentUma)
        ) {
          continue;
        }
        const parentRequirement = factorRequirementForCandidate(
          parent,
          parentUma,
          parentAssignment.unconstrained ? undefined : parentAssignment.type,
        );
        if (
          parentRequirement.impossible.length ||
          demandSlotCount(parentRequirement.demand) > MAX_INHERITANCE_SLOTS
        ) {
          continue;
        }

        const usefulFreeTypes = ALL_APTITUDES.filter(
          (type) => (parentRequirement.demand[type] || 0) > 0,
        );
        const baseGrandparentAssignments = grandparents.map((slot) =>
          effectiveAssignmentForSlot(slot),
        );
        const grandparentAssignmentOrders =
          !fixedGrandparents.length && !grandparentAssignmentsEquivalent
            ? [
                baseGrandparentAssignments,
                [baseGrandparentAssignments[1], baseGrandparentAssignments[0]],
              ]
            : [baseGrandparentAssignments];
        for (const grandparentAssignments of grandparentAssignmentOrders) {
          const grandparentFactorChoices = grandparentAssignments.map(
            (assignment) => {
              if (!assignment.unconstrained) return [assignment];
              return [
                ...usefulFreeTypes.map(
                  (type): FactorAssignment => ({ type, stars: 3 }),
                ),
                assignment,
              ];
            },
          );
          let resolvedGrandparentAssignments: FactorAssignment[] | undefined;
          let grandparentRequirements:
            | ReturnType<typeof factorDemandForUma>[]
            | undefined;
          let parentRemaining: FactorDemand | undefined;
          let bestAssignmentScore = Number.POSITIVE_INFINITY;
          grandparentFactorChoices[0].forEach((firstFactor) => {
            grandparentFactorChoices[1].forEach((secondFactor) => {
              const assignments = [firstFactor, secondFactor];
              const requirements = grandparents.map((_, index) => {
                return factorRequirementForCandidate(
                  grandparents[index],
                  directUmas[index + 1],
                  assignments[index].unconstrained
                    ? undefined
                    : assignments[index].type,
                );
              });
              if (
                requirements.some(
                  (item) =>
                    item.impossible.length ||
                    demandSlotCount(item.demand) > MAX_INHERITANCE_SLOTS,
                )
              ) {
                return;
              }
              const remaining = remainingFactorDemand(
                parentRequirement.demand,
                assignments,
              );
              const remainingSlots = demandSlotCount(remaining);
              if (remainingSlots > 4) return;
              const score =
                remainingSlots * 100 +
                requirements.reduce(
                  (total, item) => total + demandSlotCount(item.demand),
                  0,
                );
              if (score >= bestAssignmentScore) return;
              bestAssignmentScore = score;
              resolvedGrandparentAssignments = assignments;
              grandparentRequirements = requirements;
              parentRemaining = remaining;
            });
          });
          if (
            !resolvedGrandparentAssignments ||
            !grandparentRequirements ||
            !parentRemaining
          ) {
            continue;
          }

          const universe = [
            ...inheritanceAptitudes,
            ...ALL_APTITUDES.filter(
              (type) =>
                Boolean(parentRemaining![type]) ||
                grandparentRequirements!.some((item) =>
                  Boolean(item.demand[type]),
                ),
            ),
          ].filter((type, index, values) => values.indexOf(type) === index);
          let greatAssignments: FactorAssignment[] | undefined = universe.length
            ? undefined
            : Array.from({ length: 4 }, () => ({
                type: 'turf' as const,
                stars: 3 as const,
                free: true,
                unconstrained: true,
              }));
          const visitGreatAssignments = (types: FactorKey[]) => {
            if (greatAssignments) return;
            if (types.length < 4) {
              universe.forEach((type) =>
                visitGreatAssignments([...types, type]),
              );
              return;
            }
            const assignments = types.map((type) => ({
              type,
              stars: 3 as const,
            }));
            if (!demandSatisfied(parentRemaining!, assignments)) return;
            const ancestorsFit = grandparents.every((_, index) => {
              const remaining = remainingFactorDemand(
                grandparentRequirements![index]!.demand,
                assignments.slice(index * 2, index * 2 + 2),
              );
              return demandSlotCount(remaining) <= 4;
            });
            if (ancestorsFit) greatAssignments = assignments;
          };
          visitGreatAssignments([]);
          if (!greatAssignments) continue;

          const positions: CompleteDesignPosition[] = slots.map(
            (slot, index) => {
              const factor =
                index === 0
                  ? parentAssignment
                  : resolvedGrandparentAssignments![index - 1];
              return {
                code: SLOT_CODES[slot],
                generation: index === 0 ? 1 : 2,
                uma: directUmas[index],
                factor,
                fixed:
                  index === 0
                    ? Boolean(lineage[parent])
                    : fixedGrandparentIds.has(directUmas[index].id) ||
                      Boolean(trainedUmaSettings[slot]),
                requiresUma: true,
                inRaceFactorJump: inRaceFactorJumpForCandidate(
                  slot,
                  directUmas[index],
                  factor,
                ),
              };
            },
          );
          const greatCodes = grandparents.flatMap((slot) => [
            `${SLOT_CODES[slot]}A`,
            `${SLOT_CODES[slot]}B`,
          ]);
          greatAssignments.forEach((factor, index) => {
            positions.push({
              code: greatCodes[index],
              generation: 3,
              factor,
              fixed: false,
              requiresUma: false,
            });
          });
          const demandOrderKey = (demand: FactorDemand) =>
            ALL_APTITUDES.map((type) => demand[type] || 0).join(':');
          const strategyKey = [
            directUmas.map((uma) => uma.id).join(':'),
            [parentAssignment, ...resolvedGrandparentAssignments]
              .map(effectiveFactorRoleKey)
              .join('|'),
            greatAssignments.map(effectiveFactorRoleKey).join('|'),
            demandOrderKey(parentRemaining!),
            grandparentRequirements!
              .map((requirement) => demandOrderKey(requirement.demand))
              .join('|'),
          ].join('||');
          if (seenStrategies.has(strategyKey)) continue;
          seenStrategies.add(strategyKey);
          strategies.push({
            positions,
            cumulativeRequirements: grandparents.map((slot, index) => ({
              code: SLOT_CODES[slot],
              demand: grandparentRequirements![index]!.demand,
            })),
            greatFactorRequirements: {
              parent: parentRemaining!,
              grandparents: [
                grandparentRequirements![0]!.demand,
                grandparentRequirements![1]!.demand,
              ],
            },
          });
        }
      }
    }
    return strategies;
  };

  const validCompleteDesigns = useMemo(() => {
    if (!calculationReady) return [];
    const branchCaches: Record<
      BranchKey,
      Map<string, BranchFactorStrategy[]>
    > = {
      paternal: new Map(),
      maternal: new Map(),
    };
    const expandBranchFactorPlans = (
      plan: TargetFactorPlan,
      branch: BranchKey,
    ) => {
      const { parent, grandparents } = branchConfigs[branch];
      const slots: LineageSlot[] = [parent, ...grandparents];
      const freeFactorTypes = [...inheritanceAptitudes];
      const freeAssignmentOrder = (assignment: FactorAssignment) =>
        assignment.unconstrained
          ? ALL_APTITUDES.length
          : ALL_APTITUDES.indexOf(assignment.type);
      const variants: TargetFactorPlan[] = [];
      const visit = (
        index: number,
        assignments: Record<LineageSlot, FactorAssignment>,
      ) => {
        if (index >= slots.length) {
          variants.push({ assignments });
          return;
        }
        const slot = slots[index];
        const assignment = plan.assignments[slot];
        if (!assignment.free || assignment.unconstrained) {
          visit(index + 1, assignments);
          return;
        }
        freeFactorTypes.forEach((type) => {
          const firstGrandparentAssignment = assignments[grandparents[0]];
          if (
            slot === grandparents[1] &&
            plan.assignments[grandparents[0]].free &&
            ALL_APTITUDES.indexOf(type) <
              freeAssignmentOrder(firstGrandparentAssignment)
          ) {
            return;
          }
          visit(index + 1, {
            ...assignments,
            [slot]: { ...assignment, type },
          });
        });
        visit(index + 1, {
          ...assignments,
          [slot]: { ...assignment, unconstrained: true },
        });
      };
      visit(0, { ...plan.assignments });
      return variants;
    };
    const factorPlans =
      capturedReuseMode === 'off'
        ? rawTargetFactorPlanEnumerator.getRange(
            0,
            rawTargetFactorPlanEnumerator.total,
          )
        : [
            {
              assignments: Object.fromEntries(
                TARGET_FACTOR_SLOTS.map((slot) => [
                  slot,
                  {
                    type: 'turf' as const,
                    stars: 3 as const,
                    free: true,
                    unconstrained: true,
                  },
                ]),
              ) as Record<LineageSlot, FactorAssignment>,
            },
          ];
    return factorPlans
      .filter(
        (plan) =>
          !branchesInterchangeable ||
          factorPlanBranchKey(plan, 'paternal') <=
            factorPlanBranchKey(plan, 'maternal'),
      )
      .map((plan) => {
        const getStrategies = (branch: BranchKey) => {
          const { parent, grandparents } = branchConfigs[branch];
          return expandBranchFactorPlans(plan, branch).flatMap((variant) => {
            const key = [parent, ...grandparents]
              .map((slot) => factorAssignmentKey(variant.assignments[slot]))
              .join('|');
            let strategies = branchCaches[branch].get(key);
            if (!strategies) {
              strategies = buildBranchStrategies(variant, branch);
              branchCaches[branch].set(key, strategies);
            }
            return strategies;
          });
        };
        const paternal = getStrategies('paternal');
        const maternal = getStrategies('maternal');
        return {
          plan,
          paternal,
          maternal,
        };
      })
      .filter((item) => item.paternal.length > 0 && item.maternal.length > 0);
  }, [
    calculationReady,
    calculationRequestId,
    rawTargetFactorPlanEnumerator,
    targetId,
    JSON.stringify(lineage),
    routes.paternal,
    routes.maternal,
    JSON.stringify(routeMinimums),
    JSON.stringify(slotRouteOverrides),
    inheritanceAptitudes.join('|'),
    factorProductionMinimumRank,
    excludedUmaIds.join('|'),
    branchesInterchangeable,
    JSON.stringify(trainedUmaSettings),
    JSON.stringify(fixedDressSlots),
    capturedReuseMode,
    JSON.stringify(capturedBlueFactorMinimums),
    capturedUmas,
  ]);
  const probabilityTargetTypes = inheritanceAptitudes;
  const guaranteedFactorDemand: FactorDemand = Object.fromEntries(
    targetInheritanceAllocations.map((item) => [item.type, item.stars]),
  );
  const probabilityRequiredRaises = useMemo(() => {
    const raises: Partial<Record<FactorKey, number>> = {};
    if (!target) return raises;
    const guaranteedRanks = new Map(
      inheritanceAllocation(
        target,
        inheritanceAptitudes,
        inheritanceTargets,
      ).map((item) => [item.type, item.target]),
    );
    probabilityTargetTypes.forEach((type) => {
      const guaranteedRank =
        guaranteedRanks.get(type) || target.aptitudes[type];
      const probabilityTarget = Math.max(
        guaranteedRank,
        probabilityTargetRanks[type] || guaranteedRank,
      );
      raises[type] = Math.max(0, probabilityTarget - guaranteedRank);
    });
    return raises;
  }, [
    targetId,
    inheritanceAptitudes.join('|'),
    probabilityTargetTypes.join('|'),
    JSON.stringify(inheritanceTargets),
    JSON.stringify(probabilityTargetRanks),
  ]);
  const optimalCompleteDesign = useMemo(() => {
    if (!calculationReady || !validCompleteDesigns.length) {
      return undefined;
    }

    const minimumGreatFactorStars = (strategy: BranchFactorStrategy) => {
      const greatPositions = strategy.positions.filter(
        (position) => position.generation === 3,
      );
      if (greatPositions.length !== 4) return [3, 3, 3, 3];
      const requirementsSatisfied = (stars: number[]) => {
        const contributions = greatPositions.map((position, index) => ({
          type: position.factor.type,
          stars: stars[index],
        }));
        if (
          !demandSatisfied(
            strategy.greatFactorRequirements.parent,
            contributions,
          )
        ) {
          return false;
        }
        return strategy.greatFactorRequirements.grandparents.every(
          (demand, index) =>
            demandSlotCount(
              remainingFactorDemand(
                demand,
                contributions.slice(index * 2, index * 2 + 2),
              ),
            ) <= 4,
        );
      };
      for (let total = 0; total <= 12; total += 1) {
        let result: number[] | undefined;
        const visit = (index: number, remaining: number, stars: number[]) => {
          if (result) return;
          if (index === 4) {
            if (!remaining && requirementsSatisfied(stars)) result = stars;
            return;
          }
          for (let value = 0; value <= Math.min(3, remaining); value += 1) {
            visit(index + 1, remaining - value, [...stars, value]);
          }
        };
        visit(0, total, []);
        if (result) return result;
      }
      return [3, 3, 3, 3];
    };
    const resolvedPositionCache = new WeakMap<
      BranchFactorStrategy,
      CompleteDesignPosition[]
    >();
    const resolvedPositions = (...strategies: BranchFactorStrategy[]) =>
      strategies.flatMap((strategy) => {
        const cached = resolvedPositionCache.get(strategy);
        if (cached) return cached;
        const greatStars = minimumGreatFactorStars(strategy);
        const directPositions = strategy.positions
          .filter((position) => position.generation !== 3)
          .map((position) => ({
            ...position,
            factor: {
              type: position.factor.type,
              stars: position.factor.stars,
              ...(position.factor.unconstrained
                ? { free: true, unconstrained: true }
                : {}),
            },
          }));
        const greatPositions = strategy.positions.filter(
          (position) => position.generation === 3,
        );
        const groupedGreatRequirements = [0, 2].map((start) => {
          const pair = greatPositions.slice(start, start + 2);
          const minimumDemand: FactorDemand = {};
          const suppliedFactors = pair.map((position, pairIndex) => ({
            type: position.factor.type,
            stars: greatStars[start + pairIndex] || 0,
            unconstrained: position.factor.unconstrained,
          }));
          pair.forEach((position, pairIndex) => {
            const stars = greatStars[start + pairIndex] || 0;
            if (stars > 0) {
              minimumDemand[position.factor.type] =
                (minimumDemand[position.factor.type] || 0) + stars;
            }
          });
          const totalDemand =
            strategy.cumulativeRequirements[start / 2]?.demand || {};
          return {
            minimumDemand,
            cumulativeDemand: remainingFactorDemand(
              totalDemand,
              suppliedFactors,
            ),
          };
        });
        let grandparentIndex = 0;
        const resolved = directPositions.map((position) => {
          if (position.generation !== 2) return position;
          const requirements = groupedGreatRequirements[grandparentIndex];
          grandparentIndex += 1;
          return {
            ...position,
            minimumDemand: requirements?.minimumDemand || {},
            cumulativeDemand: requirements?.cumulativeDemand || {},
          };
        });
        resolvedPositionCache.set(strategy, resolved);
        return resolved;
      });
    const demandKey = (demand: FactorDemand) =>
      ALL_APTITUDES.filter((type) => (demand[type] || 0) > 0)
        .map((type) => `${type}:${demand[type]}`)
        .join(',');
    type BranchProbabilitySummary = {
      strategy: BranchFactorStrategy;
      parentId: number;
      factors: Array<ProbabilityFactor & { parent: boolean }>;
      capturedParentFactors: CapturedInheritanceFactor[];
      capturedAncestorTargetMissProbabilities: number[];
      capturedTargetAvailability: boolean[];
      positionCompatibilities: Record<
        string,
        { total: number; formula: string; parent: boolean }
      >;
    };
    const branchSummaryCache: Record<
      BranchKey,
      WeakMap<BranchFactorStrategy, BranchProbabilitySummary | null>
    > = {
      paternal: new WeakMap(),
      maternal: new WeakMap(),
    };
    const summarizeBranch = (
      strategy: BranchFactorStrategy,
      branch: BranchKey,
    ): BranchProbabilitySummary | undefined => {
      const cached = branchSummaryCache[branch].get(strategy);
      if (cached !== undefined) return cached || undefined;
      const parentCode = branch === 'paternal' ? 'A' : 'B';
      const grandparentCodes =
        branch === 'paternal'
          ? (['AA', 'AB'] as const)
          : (['BA', 'BB'] as const);
      const positionByCode = new Map(
        strategy.positions.map((position) => [position.code, position]),
      );
      const parentPosition = positionByCode.get(parentCode);
      const grandparentPositions = grandparentCodes.map((code) =>
        positionByCode.get(code),
      );
      const parentId = parentPosition?.uma?.id || 0;
      if (
        !parentPosition ||
        !parentId ||
        grandparentPositions.some((position) => !position?.uma)
      ) {
        branchSummaryCache[branch].set(strategy, null);
        return undefined;
      }
      const parentSlot = branch === 'paternal' ? 'father' : 'mother';
      const grandparentSlots =
        branch === 'paternal'
          ? (['paternalA', 'paternalB'] as const)
          : (['maternalA', 'maternalB'] as const);
      const parentRoute = routeSettingForSlot(parentSlot, parentId).route;
      const grandparentCompatibilityDetails = grandparentPositions.map(
        (position, index) => {
          const grandparentId = position?.uma?.id || 0;
          const grandparentRoute = routeSettingForSlot(
            grandparentSlots[index],
            grandparentId,
          ).route;
          const base = relationScore(targetId, parentId, grandparentId);
          const parentDetailedMember = parentPosition.winSaddleIds?.length
            ? parentPosition
            : trainedMemberForSlot(parentSlot, parentId);
          const grandparentDetailedMember = position?.winSaddleIds?.length
            ? position
            : trainedMemberForSlot(grandparentSlots[index], grandparentId);
          const g1 = resolvedCommonG1(
            parentDetailedMember,
            parentRoute,
            grandparentDetailedMember,
            grandparentRoute,
          );
          return {
            umaName: umaById.get(grandparentId)?.name || `祖辈 ${index + 1}`,
            base,
            g1Count: g1.count,
            g1Source: g1.source,
            total: base + g1.count * G1_COMPATIBILITY_POINTS,
          };
        },
      );
      const parentBaseCompatibility = relationScore(targetId, parentId);
      const parentLocalCompatibility =
        parentBaseCompatibility +
        grandparentCompatibilityDetails.reduce(
          (total, detail) => total + detail.total,
          0,
        );
      const factors: BranchProbabilitySummary['factors'] = [];
      const positionCompatibilities: BranchProbabilitySummary['positionCompatibilities'] =
        {
          [parentCode]: {
            total: parentLocalCompatibility,
            parent: true,
            formula: [
              `与目标基础相性 ${parentBaseCompatibility}`,
              ...grandparentCompatibilityDetails.map(
                (detail) =>
                  `${detail.umaName}基础相性 ${detail.base}\n${detail.g1Source === 'detailed' ? `和${detail.umaName}的胜鞍` : '路线估算胜鞍'}：共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS}`,
              ),
            ].join(' + '),
          },
        };
      grandparentCodes.forEach((code, index) => {
        const detail = grandparentCompatibilityDetails[index];
        positionCompatibilities[code] = {
          total: detail.total,
          parent: false,
          formula: `三者基础相性 ${detail.base}\n${detail.g1Source === 'detailed' ? `和${detail.umaName}的胜鞍` : '路线估算胜鞍'}：共同 G1 ${detail.g1Count} 场 × ${G1_COMPATIBILITY_POINTS} = ${detail.total}`,
        };
      });
      if (
        !parentPosition.factor.unconstrained &&
        probabilityTargetTypes.includes(parentPosition.factor.type)
      ) {
        factors.push({
          ...parentPosition.factor,
          compatibility: parentLocalCompatibility,
          parent: true,
        });
      }
      grandparentPositions.forEach((position, index) => {
        if (
          position &&
          !position.factor.unconstrained &&
          probabilityTargetTypes.includes(position.factor.type)
        ) {
          factors.push({
            ...position.factor,
            compatibility: grandparentCompatibilityDetails[index].total,
            parent: false,
          });
        }
      });
      const capturedParentFactors =
        parentPosition.capturedInheritanceFactors || [];
      const capturedAncestorSources = grandparentPositions.flatMap(
        (position, index) =>
          (position?.capturedInheritanceFactors || []).map((factor) => ({
            factor,
            generation: 2 as const,
            compatibility: grandparentCompatibilityDetails[index].total,
          })),
      );
      const capturedBranchFactors = [
        ...capturedParentFactors,
        ...grandparentPositions.flatMap(
          (position) => position?.capturedInheritanceFactors || [],
        ),
      ];
      const summary = {
        strategy,
        parentId,
        factors,
        capturedParentFactors,
        capturedAncestorTargetMissProbabilities:
          effectiveCapturedFactorTargets.map(
            (target) =>
              1 -
              capturedFactorTargetProbability(
                capturedAncestorSources,
                target,
                successionFactorMeta,
              ),
          ),
        capturedTargetAvailability: effectiveCapturedFactorTargets.map(
          (target) =>
            capturedBranchFactors.some((factor) =>
              capturedFactorMatchesTarget(factor, target, successionFactorMeta),
            ),
        ),
        positionCompatibilities,
      };
      branchSummaryCache[branch].set(strategy, summary);
      return summary;
    };
    const compactBranch = (
      strategies: BranchFactorStrategy[],
      branch: BranchKey,
    ) => {
      const { parent, grandparents } = branchConfigs[branch];
      const positionRoles = new Map<string, string>([
        [SLOT_CODES[parent], 'P'],
        [SLOT_CODES[grandparents[0]], 'G0'],
        [SLOT_CODES[grandparents[1]], 'G1'],
      ]);
      const resolvedOptionKey = (position: CompleteDesignPosition) =>
        [
          position.uma?.id || 0,
          position.capturedSelectionId || '',
          factorAssignmentKey(position.factor),
          demandKey(position.minimumDemand || {}),
          demandKey(position.cumulativeDemand || {}),
          position.capturedFactorSummary?.blueFactor?.type || '',
          position.capturedFactorSummary?.blueFactor?.stars || 0,
          position.capturedFactorSummary?.uniqueFactorStars || 0,
          (position.capturedFactorSummary?.selectedSkillFactors || [])
            .map((skill) => `${skill.groupId}:${skill.count}`)
            .join(','),
          position.capturedFactorSummary?.whiteFactorCount || 0,
          (position.capturedInheritanceFactors || [])
            .map((factor) => factor.id)
            .sort((left, right) => left - right)
            .join(','),
        ].join('/');
      const summaries = new Map<
        string,
        {
          representative: BranchProbabilitySummary;
          positionOptions: Map<string, Map<string, CompleteDesignPosition>>;
        }
      >();
      strategies.forEach((strategy) => {
        const summary = summarizeBranch(strategy, branch);
        if (!summary) return;
        const resolved = resolvedPositions(strategy)
          .filter((position) => position.generation <= 2)
          .map((position) => {
            const compatibility =
              summary.positionCompatibilities[position.code];
            return {
              ...position,
              compatibility: compatibility?.total,
              compatibilityTitle: compatibility?.formula,
            };
          });
        // 在固定父辈下，祖辈身份不进入等价键；每个槽位的相性和因子
        // 相同即可归为同一概率/展示组，具体马娘保留为“或”选项。
        const key = [
          String(summary.parentId).padStart(10, '0'),
          ...[...(strategy.capturedSelectionIds || [])].sort(),
          ...BLUE_FACTOR_KEYS.map(
            (type) =>
              `${type}:${strategy.capturedBlueFactorTotals?.[type] || 0}`,
          ),
          ...resolved
            .map((position) => {
              const compatibility =
                summary.positionCompatibilities[position.code]?.total ?? -1;
              return `${positionRoles.get(position.code)}:${factorAssignmentKey(position.factor)}:${compatibility}`;
            })
            .sort(),
        ].join('|');
        let group = summaries.get(key);
        if (!group) {
          group = {
            representative: summary,
            positionOptions: new Map(),
          };
          summaries.set(key, group);
        }
        resolved
          .filter((position) => position.generation === 2)
          .forEach((position) => {
            let options = group!.positionOptions.get(position.code);
            if (!options) {
              options = new Map();
              group!.positionOptions.set(position.code, options);
            }
            options.set(resolvedOptionKey(position), position);
          });
      });
      return [...summaries.entries()].map(([orderKey, group]) => ({
        orderKey,
        ...group,
      }));
    };

    const probabilityCache = new Map<string, number>();
    type BranchProbabilityGroup = ReturnType<typeof compactBranch>[number];
    const combinedProbabilityFactors = (
      paternal: BranchProbabilitySummary,
      maternal: BranchProbabilitySummary,
    ) => {
      const parentPairCompatibility = relationScore(
        paternal.parentId,
        maternal.parentId,
      );
      return [...paternal.factors, ...maternal.factors].map((factor) => {
        const compatibility =
          factor.compatibility + (factor.parent ? parentPairCompatibility : 0);
        return {
          type: factor.type,
          stars: factor.stars,
          compatibility,
        } satisfies ProbabilityFactor;
      });
    };
    const buildRankedResult = (
      probability: number,
      plan: TargetFactorPlan,
      paternal: BranchProbabilityGroup,
      maternal: BranchProbabilityGroup,
    ) => {
      const parentPairCompatibility = relationScore(
        paternal.representative.parentId,
        maternal.representative.parentId,
      );
      const materializeBranch = (group: BranchProbabilityGroup) =>
        resolvedPositions(group.representative.strategy).map((position) => {
          const detail =
            group.representative.positionCompatibilities[position.code];
          const compatibility =
            detail?.total + (detail?.parent ? parentPairCompatibility : 0);
          const compatibilityTitle = detail?.parent
            ? `${detail.formula} + 父母基础相性 ${parentPairCompatibility} = ${compatibility}`
            : detail?.formula;
          const options = [
            ...(group.positionOptions.get(position.code)?.values() || []),
          ].sort((left, right) => (left.uma?.id || 0) - (right.uma?.id || 0));
          return {
            ...position,
            compatibility,
            compatibilityTitle,
            ...(options.length > 1
              ? {
                  alternatives: options,
                  alternativeCount: options.length,
                }
              : {}),
          };
        });
      return {
        probability: Math.max(0, probability),
        plan,
        design: {
          positions: [
            ...materializeBranch(paternal),
            ...materializeBranch(maternal),
          ],
          cumulativeRequirements: [
            ...paternal.representative.strategy.cumulativeRequirements,
            ...maternal.representative.strategy.cumulativeRequirements,
          ],
          issues: [],
        } satisfies CompleteFactorDesign,
      };
    };
    type BestMatch = {
      plan: TargetFactorPlan;
      paternal: BranchProbabilityGroup;
      maternal: BranchProbabilityGroup;
    };
    const bestMatches: BestMatch[] = [];
    const bestMatchByKey = new Map<string, BestMatch>();
    const bestMatchKeys = new Set<string>();
    const mergeBranchGroupOptions = (
      target: BranchProbabilityGroup,
      source: BranchProbabilityGroup,
    ) => {
      source.positionOptions.forEach((sourceOptions, code) => {
        let targetOptions = target.positionOptions.get(code);
        if (!targetOptions) {
          targetOptions = new Map();
          target.positionOptions.set(code, targetOptions);
        }
        sourceOptions.forEach((position, optionKey) => {
          targetOptions!.set(optionKey, position);
        });
      });
    };
    const bestMatchKey = (
      paternal: BranchProbabilityGroup,
      maternal: BranchProbabilityGroup,
      branchesUnordered: boolean,
    ) => {
      const branchKeys = [paternal.orderKey, maternal.orderKey];
      if (branchesUnordered) branchKeys.sort();
      return branchKeys.join('||');
    };
    const recordBestMatch = (match: BestMatch, key: string) => {
      const existing = bestMatchByKey.get(key);
      if (existing) {
        mergeBranchGroupOptions(existing.paternal, match.paternal);
        mergeBranchGroupOptions(existing.maternal, match.maternal);
        return;
      }
      if (bestMatchKeys.has(key)) return;
      bestMatchKeys.add(key);
      bestMatchCount += 1;
      if (bestMatches.length >= MAX_EQUAL_MATCH_GROUPS) return;
      bestMatches.push(match);
      bestMatchByKey.set(key, match);
    };
    let bestCombinedProbability = -1;
    let bestSkillProbabilities: number[] = [];
    let bestMatchCount = 0;
    const rankedCapturedMatches: Array<{
      probability: number;
      targetProbabilities: number[];
      match: BestMatch;
    }> = [];
    const activeCapturedFactorTargets = effectiveCapturedFactorTargets;

    for (const completeDesignGroup of validCompleteDesigns) {
      const branchFactorPlansEquivalent =
        capturedReuseMode === 'off' &&
        branchesInterchangeable &&
        factorPlanBranchKey(completeDesignGroup.plan, 'paternal') ===
          factorPlanBranchKey(completeDesignGroup.plan, 'maternal');
      const paternalSummaries = compactBranch(
        completeDesignGroup.paternal,
        'paternal',
      );
      const maternalSummaries = compactBranch(
        completeDesignGroup.maternal,
        'maternal',
      );
      function* candidateSummaryPairs(): Generator<
        [BranchProbabilityGroup, BranchProbabilityGroup]
      > {
        const preparedPairFilter = capturedReusePairFilterRef.current;
        if (
          capturedReuseMode !== 'off' &&
          preparedPairFilter?.inputKey === currentCalculationInputKey
        ) {
          const paternalBySelectionId = new Map(
            paternalSummaries.map((summary) => [
              summary.representative.strategy.capturedSelectionIds?.[0] || '',
              summary,
            ]),
          );
          const maternalBySelectionId = new Map(
            maternalSummaries.map((summary) => [
              summary.representative.strategy.capturedSelectionIds?.[0] || '',
              summary,
            ]),
          );
          for (const pairKey of preparedPairFilter.allowedPairKeys) {
            const [paternalSelectionId, maternalSelectionId] =
              pairKey.split('|');
            const paternal = paternalBySelectionId.get(paternalSelectionId);
            const maternal = maternalBySelectionId.get(maternalSelectionId);
            if (paternal && maternal) yield [paternal, maternal];
          }
          return;
        }
        for (const paternal of paternalSummaries) {
          for (const maternal of maternalSummaries) {
            yield [paternal, maternal];
          }
        }
      }
      for (const [paternal, maternal] of candidateSummaryPairs()) {
          if (
            branchFactorPlansEquivalent &&
            paternal.orderKey > maternal.orderKey
          ) {
            continue;
          }
          const paternalSummary = paternal.representative;
          const maternalSummary = maternal.representative;
          if (capturedReuseMode !== 'off') {
            const preparedPairFilter = capturedReusePairFilterRef.current;
            const paternalSelectionId =
              paternalSummary.strategy.capturedSelectionIds?.[0] || '';
            const maternalSelectionId =
              maternalSummary.strategy.capturedSelectionIds?.[0] || '';
            if (
              preparedPairFilter?.inputKey === currentCalculationInputKey &&
              !preparedPairFilter.allowedPairKeys.has(
                `${paternalSelectionId}|${maternalSelectionId}`,
              )
            ) {
              continue;
            }
            const identity = (
              summary: BranchProbabilitySummary,
            ): CapturedReuseBranchIdentity => {
              const directParent = summary.strategy.positions.find(
                (position) => position.generation === 1,
              );
              return {
                parentId: summary.parentId,
                parentSource: directParent?.capturedSource || 'planned',
                selectionIds: summary.strategy.capturedSelectionIds || [],
                sources: summary.strategy.capturedSources || [],
                umaIds: summary.strategy.positions
                  .filter(
                    (position) => position.generation <= 2 && position.uma?.id,
                  )
                  .map((position) => position.uma!.id),
              };
            };
            if (
              !capturedReuseCombinationValid(
                identity(paternalSummary),
                identity(maternalSummary),
              )
            ) {
              continue;
            }
            if (
              !capturedBlueFactorMinimumsSatisfied(capturedBlueFactorMinimums, [
                paternalSummary.strategy.capturedBlueFactorTotals ||
                  INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS,
                maternalSummary.strategy.capturedBlueFactorTotals ||
                  INITIAL_CAPTURED_BLUE_FACTOR_MINIMUMS,
              ])
            ) {
              continue;
            }
            if (
              activeCapturedFactorTargets.some(
                (_, index) =>
                  !paternalSummary.capturedTargetAvailability[index] &&
                  !maternalSummary.capturedTargetAvailability[index],
              )
            ) {
              continue;
            }
          }
          if (
            !demandSatisfied(guaranteedFactorDemand, [
              ...paternalSummary.factors,
              ...maternalSummary.factors,
            ])
          ) {
            continue;
          }
          const factors = combinedProbabilityFactors(
            paternalSummary,
            maternalSummary,
          );
          const probabilityKey = factors
            .map(
              (factor) =>
                `${factor.type}:${factor.stars}:${factor.compatibility}`,
            )
            .sort()
            .join('|');
          let probability = probabilityCache.get(probabilityKey);
          if (probability === undefined) {
            probability = probabilityOfReachingTargets(
              factors,
              probabilityTargetTypes,
              probabilityRequiredRaises,
            );
            probabilityCache.set(probabilityKey, probability);
          }
          let targetProbabilities: number[] = [];
          if (activeCapturedFactorTargets.length) {
            const parentPairCompatibility = relationScore(
              paternalSummary.parentId,
              maternalSummary.parentId,
            );
            targetProbabilities = activeCapturedFactorTargets.map(
              (factorTarget, targetIndex) => {
                const parentMissProbability = (
                  summary: BranchProbabilitySummary,
                ) => {
                  const localCompatibility =
                    Object.values(summary.positionCompatibilities).find(
                      (detail) => detail.parent,
                    )?.total || 0;
                  return (
                    1 -
                    capturedFactorTargetProbability(
                      summary.capturedParentFactors.map((factor) => ({
                        factor,
                        generation: 1 as const,
                        compatibility:
                          localCompatibility + parentPairCompatibility,
                      })),
                      factorTarget,
                      successionFactorMeta,
                    )
                  );
                };
                const missProbability =
                  paternalSummary
                    .capturedAncestorTargetMissProbabilities[targetIndex] *
                  maternalSummary
                    .capturedAncestorTargetMissProbabilities[targetIndex] *
                  parentMissProbability(paternalSummary) *
                  parentMissProbability(maternalSummary);
                return 1 - missProbability;
              },
            );
            if (targetProbabilities.some((value) => value <= 0)) continue;
          }
          const combinedProbability = combinedSkillTargetProbability(
            probability,
            targetProbabilities,
          );
          if (
            capturedReuseMode === 'off'
              ? combinedProbability < MIN_DISPLAYED_PROBABILITY
              : combinedProbability <= 0
          ) {
            continue;
          }
          if (capturedReuseMode !== 'off') {
            rankedCapturedMatches.push({
              probability: combinedProbability,
              targetProbabilities,
              match: {
                plan: completeDesignGroup.plan,
                paternal,
                maternal,
              },
            });
            continue;
          }
          const priorityComparison = compareCombinedProbabilityPriority(
            combinedProbability,
            targetProbabilities,
            bestCombinedProbability,
            bestSkillProbabilities,
          );
          if (priorityComparison > 0) {
            bestCombinedProbability = combinedProbability;
            bestSkillProbabilities = targetProbabilities;
            bestMatches.length = 0;
            bestMatchByKey.clear();
            bestMatchKeys.clear();
            bestMatchCount = 0;
            const match = {
              plan: completeDesignGroup.plan,
              paternal,
              maternal,
            };
            recordBestMatch(
              match,
              bestMatchKey(paternal, maternal, branchFactorPlansEquivalent),
            );
          } else if (priorityComparison === 0) {
            const match = {
              plan: completeDesignGroup.plan,
              paternal,
              maternal,
            };
            recordBestMatch(
              match,
              bestMatchKey(paternal, maternal, branchFactorPlansEquivalent),
            );
          }
      }
    }

    if (capturedReuseMode !== 'off') {
      rankedCapturedMatches.sort((left, right) => {
        const comparison = compareCombinedProbabilityPriority(
          left.probability,
          left.targetProbabilities,
          right.probability,
          right.targetProbabilities,
        );
        return comparison === 0
          ? bestMatchKey(left.match.paternal, left.match.maternal, false).localeCompare(
              bestMatchKey(right.match.paternal, right.match.maternal, false),
            )
          : -comparison;
      });
      if (!rankedCapturedMatches.length) return undefined;
      const results = rankedCapturedMatches
        .slice(0, MAX_CAPTURED_RESULT_CANDIDATES)
        .map(({ probability, match }) =>
          buildRankedResult(
            probability,
            match.plan,
            match.paternal,
            match.maternal,
          ),
        );
      const preparedPairFilter = capturedReusePairFilterRef.current;
      return {
        results,
        truncated:
          Boolean(
            preparedPairFilter?.inputKey === currentCalculationInputKey &&
              preparedPairFilter.truncated,
          ) || rankedCapturedMatches.length > results.length,
        bestMatchCount: rankedCapturedMatches.length,
      };
    }

    if (!bestMatches.length) return undefined;
    const results: ReturnType<typeof buildRankedResult>[] = [];
    const maximumResults =
      capturedReuseMode === 'off'
        ? MAX_EQUAL_CANDIDATES
        : MAX_CAPTURED_RESULT_CANDIDATES;
    let truncated =
      bestMatchCount > bestMatches.length ||
      Boolean(
        capturedReusePairFilterRef.current?.inputKey ===
          currentCalculationInputKey &&
          capturedReusePairFilterRef.current.truncated,
      );
    for (const match of bestMatches) {
      results.push(
        buildRankedResult(
          bestCombinedProbability,
          match.plan,
          match.paternal,
          match.maternal,
        ),
      );
      if (results.length >= maximumResults) {
        truncated = true;
        break;
      }
    }
    return {
      results,
      truncated,
      bestMatchCount,
    };
  }, [
    calculationReady,
    calculationRequestId,
    currentCalculationInputKey,
    validCompleteDesigns,
    probabilityTargetTypes.join('|'),
    JSON.stringify(probabilityRequiredRaises),
    targetId,
    routes.paternal,
    routes.maternal,
    JSON.stringify(slotRouteOverrides),
    branchesInterchangeable,
    JSON.stringify(guaranteedFactorDemand),
    capturedReuseMode,
    JSON.stringify(capturedBlueFactorMinimums),
    JSON.stringify(effectiveCapturedFactorTargets),
    successionFactorMeta,
  ]);
  useEffect(() => {
    if (!isCalculating || !calculationReady) return;
    const runToken = calculationRunToken.current;
    const completedInputKey = currentCalculationInputKey;
    const completedResult = optimalCompleteDesign || null;
    setCalculationStage(4);
    setCalculationProgress((current) => Math.max(current, 92));
    const completeTimer = window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCalculationProgress(100);
    }, 140);
    const closeTimer = window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCompletedCalculation({
        inputKey: completedInputKey,
        result: completedResult,
      });
      setCalculationInputKey('');
      setCalculationRequestId(0);
      setIsCalculating(false);
    }, 520);
    return () => {
      window.clearTimeout(completeTimer);
      window.clearTimeout(closeTimer);
    };
  }, [
    calculationReady,
    calculationRequestId,
    currentCalculationInputKey,
    optimalCompleteDesign,
  ]);

  const displayedCalculation =
    completedCalculation?.inputKey === currentCalculationInputKey
      ? completedCalculation
      : undefined;
  const calculationComplete =
    displayedCalculation !== undefined && !isCalculating;
  const completeFactorDesigns = displayedCalculation?.result?.results || [];
  const displayedCompleteFactorDesign =
    completeFactorDesigns[calculationResultPage];
  const renderedCompleteFactorDesigns =
    capturedReuseMode === 'off'
      ? completeFactorDesigns
      : displayedCompleteFactorDesign
        ? [displayedCompleteFactorDesign]
        : [];
  const singleBranchCompleteDesigns =
    completeFactorDesigns.length > 0 &&
    completeFactorDesigns.every(
      (result) => visibleCompleteDesignBranches(result.design).length === 1,
    );

  useEffect(() => {
    setCalculationResultPage((current) =>
      Math.min(current, Math.max(0, completeFactorDesigns.length - 1)),
    );
  }, [completeFactorDesigns.length, currentCalculationInputKey]);

  const calculateOptimalDesign = () => {
    if (!target || isCalculating) return;
    const runToken = calculationRunToken.current + 1;
    const requestedInputKey = currentCalculationInputKey;
    calculationRunToken.current = runToken;
    setCompletedCalculation(undefined);
    setCalculationResultPage(0);
    setCalculationInputKey('');
    setCalculationPairProgress({ current: 0, total: 0 });
    setIsCalculating(true);
    if (capturedReuseMode !== 'off') {
      setCalculationStage(3);
      setCalculationProgress(0);
      const branchAcceptsCandidate = (
        candidate: CapturedTrainedUma,
        branch: BranchKey,
      ) => {
        const slots = BRANCH_SLOTS[branch];
        const members = [candidate, ...candidate.parents];
        if (new Set(members.map((member) => member.umaId)).size !== 3) {
          return false;
        }
        return slots.every((slot, index) => {
          const member = members[index];
          const trainedMember = trainedUmaSettings[slot]?.self;
          return capturedMemberMatchesSlotConstraint(member, {
            targetId,
            fixedUmaId: lineage[slot],
            trainedUmaId: trainedMember?.umaId,
            fixedDressCardId:
              trainedMember?.cardId || fixedDressSlots[slot],
            excluded: excludedUmaIdSet.has(member.umaId),
          });
        });
      };
      const prepareBranchCandidate = (
        candidate: CapturedTrainedUma,
        branch: BranchKey,
      ) => {
        const members = [candidate, ...candidate.parents];
        const inheritanceFactors = members.flatMap(
          (member) => member.inheritanceFactors,
        );
        const { parent, grandparents } = branchConfigs[branch];
        const parentRoute = routeSettingForSlot(parent, candidate.umaId).route;
        const grandparentCompatibilityDetails = candidate.parents.map(
          (grandparent, index) => {
            const grandparentSlot = grandparents[index];
            const grandparentRoute = routeSettingForSlot(
              grandparentSlot,
              grandparent.umaId,
            ).route;
            const base = relationScore(
              targetId,
              candidate.umaId,
              grandparent.umaId,
            );
            const g1 = resolvedCommonG1(
              candidate.winSaddleIds.length
                ? candidate
                : trainedMemberForSlot(parent, candidate.umaId),
              parentRoute,
              grandparent.winSaddleIds.length
                ? grandparent
                : trainedMemberForSlot(grandparentSlot, grandparent.umaId),
              grandparentRoute,
            );
            return {
              total: base + g1.count * G1_COMPATIBILITY_POINTS,
            };
          },
        );
        const parentLocalCompatibility =
          relationScore(targetId, candidate.umaId) +
          grandparentCompatibilityDetails.reduce(
            (total, detail) => total + detail.total,
            0,
          );
        const probabilityFactors: Array<
          ProbabilityFactor & { parent: boolean }
        > = members.flatMap((member, index) =>
          probabilityTargetTypes.includes(member.factor.type)
            ? [
                {
                  type: member.factor.type,
                  stars: member.factor.stars,
                  compatibility:
                    index === 0
                      ? parentLocalCompatibility
                      : grandparentCompatibilityDetails[index - 1].total,
                  parent: index === 0,
                },
              ]
            : [],
        );
        const ancestorSources = candidate.parents.flatMap(
          (grandparent, index) =>
            grandparent.inheritanceFactors.map((factor) => ({
              factor,
              generation: 2 as const,
              compatibility: grandparentCompatibilityDetails[index].total,
            })),
        );
        return {
          candidate,
          identity: {
            parentId: candidate.umaId,
            parentSource: candidate.source,
            selectionIds: [candidate.selectionId],
            sources: [candidate.source],
            umaIds: members.map((member) => member.umaId),
          } satisfies CapturedReuseBranchIdentity,
          blueFactorTotals: capturedBlueFactorTotals(members),
          targetAvailability: effectiveCapturedFactorTargets.map((factorTarget) =>
            inheritanceFactors.some((factor) =>
              capturedFactorMatchesTarget(
                factor,
                factorTarget,
                successionFactorMeta,
              ),
            ),
          ),
          probabilityFactors,
          parentLocalCompatibility,
          ancestorTargetMissProbabilities: effectiveCapturedFactorTargets.map(
            (factorTarget) =>
              1 -
              capturedFactorTargetProbability(
                ancestorSources,
                factorTarget,
                successionFactorMeta,
              ),
          ),
        };
      };
      const paternalCandidates = capturedUmas
        .filter((candidate) => branchAcceptsCandidate(candidate, 'paternal'))
        .map((candidate) => prepareBranchCandidate(candidate, 'paternal'));
      const maternalCandidates = capturedUmas
        .filter((candidate) => branchAcceptsCandidate(candidate, 'maternal'))
        .map((candidate) => prepareBranchCandidate(candidate, 'maternal'));
      const candidateOrderKey = ({ candidate }: (typeof paternalCandidates)[number]) =>
        `${String(candidate.umaId).padStart(10, '0')}:${candidate.selectionId}`;
      const maternalOwnCandidates = maternalCandidates
        .filter(({ candidate }) => candidate.source === 'own')
        .sort((left, right) =>
          candidateOrderKey(left).localeCompare(candidateOrderKey(right)),
        );
      const maternalRentalCandidates = maternalCandidates.filter(
        ({ candidate }) => candidate.source === 'rental',
      );
      const pairRows = paternalCandidates
        .filter(({ candidate }) =>
          capturedReusePairPolicy(candidate.source, branchesInterchangeable)
            .includePaternal,
        )
        .map((paternal) => {
          const pairPolicy = capturedReusePairPolicy(
            paternal.candidate.source,
            branchesInterchangeable,
          );
          const paternalOrderKey = candidateOrderKey(paternal);
          let low = 0;
          if (pairPolicy.canonicalizeOwnPair) {
            let high = maternalOwnCandidates.length;
            while (low < high) {
              const middle = Math.floor((low + high) / 2);
              if (
                candidateOrderKey(maternalOwnCandidates[middle]) <=
                paternalOrderKey
              ) {
                low = middle + 1;
              } else {
                high = middle;
              }
            }
          }
          const maternalRentalCount = pairPolicy.includeMaternalRentals
            ? maternalRentalCandidates.length
            : 0;
          return {
            paternal,
            maternalOwnStartIndex: low,
            maternalRentalCount,
            pairCount:
              maternalRentalCount + maternalOwnCandidates.length - low,
          };
        });
      const totalPairs = pairRows.reduce(
        (total, row) => total + row.pairCount,
        0,
      );
      const allowedPairKeys = new Set<string>();
      const probabilityCache = new Map<string, number>();
      const rankedPairCandidates: Array<{
        pairKey: string;
        combinedProbability: number;
        targetProbabilities: number[];
      }> = [];
      let positivePairCount = 0;
      let processedPairs = 0;
      let pairRowIndex = 0;
      let pairRowOffset = 0;
      const finishPreparation = () => {
        if (calculationRunToken.current !== runToken) return;
        rankedPairCandidates.forEach(({ pairKey }) =>
          allowedPairKeys.add(pairKey),
        );
        capturedReusePairFilterRef.current = {
          inputKey: requestedInputKey,
          allowedPairKeys,
          truncated: positivePairCount > allowedPairKeys.size,
        };
        setCalculationPairProgress({
          current: totalPairs,
          total: totalPairs,
        });
        setCalculationProgress(99);
        setCalculationInputKey(requestedInputKey);
        setCalculationRequestId((current) => current + 1);
      };
      const processBatch = () => {
        if (calculationRunToken.current !== runToken) return;
        const batchStartedAt = window.performance.now();
        const batchStartIndex = processedPairs;
        const batchEndIndex = Math.min(totalPairs, processedPairs + 500);
        while (
          processedPairs < batchEndIndex &&
          (processedPairs === batchStartIndex ||
            window.performance.now() - batchStartedAt < 12)
        ) {
          const pairRow = pairRows[pairRowIndex];
          if (!pairRow) break;
          const paternal = pairRow.paternal;
          const maternal =
            pairRowOffset < pairRow.maternalRentalCount
              ? maternalRentalCandidates[pairRowOffset]
              : maternalOwnCandidates[
                  pairRow.maternalOwnStartIndex +
                    pairRowOffset -
                    pairRow.maternalRentalCount
                ];
          processedPairs += 1;
          pairRowOffset += 1;
          if (pairRowOffset >= pairRow.pairCount) {
            pairRowIndex += 1;
            pairRowOffset = 0;
          }
          if (!paternal || !maternal) continue;
          if (
            !capturedReuseCombinationValid(
              paternal.identity,
              maternal.identity,
            )
          ) {
            continue;
          }
          if (
            !capturedBlueFactorMinimumsSatisfied(
              capturedBlueFactorMinimums,
              [paternal.blueFactorTotals, maternal.blueFactorTotals],
            )
          ) {
            continue;
          }
          if (
            effectiveCapturedFactorTargets.some(
              (_, index) =>
                !paternal.targetAvailability[index] &&
                !maternal.targetAvailability[index],
            )
          ) {
            continue;
          }
          if (
            !demandSatisfied(guaranteedFactorDemand, [
              ...paternal.probabilityFactors,
              ...maternal.probabilityFactors,
            ])
          ) {
            continue;
          }
          const parentPairCompatibility = relationScore(
            paternal.candidate.umaId,
            maternal.candidate.umaId,
          );
          const probabilityFactors = [
            ...paternal.probabilityFactors,
            ...maternal.probabilityFactors,
          ].map((factor) => ({
            type: factor.type,
            stars: factor.stars,
            compatibility:
              factor.compatibility +
              (factor.parent ? parentPairCompatibility : 0),
          }));
          const probabilityKey = probabilityFactors
            .map(
              (factor) =>
                `${factor.type}:${factor.stars}:${factor.compatibility}`,
            )
            .sort()
            .join('|');
          let probability = probabilityCache.get(probabilityKey);
          if (probability === undefined) {
            probability = probabilityOfReachingTargets(
              probabilityFactors,
              probabilityTargetTypes,
              probabilityRequiredRaises,
            );
            probabilityCache.set(probabilityKey, probability);
          }
          const targetProbabilities = effectiveCapturedFactorTargets.map(
            (factorTarget, targetIndex) => {
              const parentMissProbability = (
                prepared: typeof paternal,
              ) =>
                1 -
                capturedFactorTargetProbability(
                  prepared.candidate.inheritanceFactors.map((factor) => ({
                    factor,
                    generation: 1 as const,
                    compatibility:
                      prepared.parentLocalCompatibility +
                      parentPairCompatibility,
                  })),
                  factorTarget,
                  successionFactorMeta,
                );
              const missProbability =
                paternal.ancestorTargetMissProbabilities[targetIndex] *
                maternal.ancestorTargetMissProbabilities[targetIndex] *
                parentMissProbability(paternal) *
                parentMissProbability(maternal);
              return 1 - missProbability;
            },
          );
          if (targetProbabilities.some((value) => value <= 0)) continue;
          const combinedProbability = combinedSkillTargetProbability(
            probability,
            targetProbabilities,
          );
          if (combinedProbability <= 0) continue;
          const pairKey = `${paternal.candidate.selectionId}|${maternal.candidate.selectionId}`;
          positivePairCount += 1;
          const insertAt = rankedPairCandidates.findIndex((candidate) => {
            const comparison = compareCombinedProbabilityPriority(
              combinedProbability,
              targetProbabilities,
              candidate.combinedProbability,
              candidate.targetProbabilities,
            );
            return comparison > 0 ||
              (comparison === 0 && pairKey < candidate.pairKey);
          });
          const rankedCandidate = {
            pairKey,
            combinedProbability,
            targetProbabilities,
          };
          if (insertAt >= 0) {
            rankedPairCandidates.splice(insertAt, 0, rankedCandidate);
          } else if (rankedPairCandidates.length < MAX_EQUAL_MATCH_GROUPS) {
            rankedPairCandidates.push(rankedCandidate);
          }
          if (rankedPairCandidates.length > MAX_EQUAL_MATCH_GROUPS) {
            rankedPairCandidates.pop();
          }
        }
        setCalculationPairProgress({
          current: processedPairs,
          total: totalPairs,
        });
        if (processedPairs < totalPairs) {
          setCalculationProgress(
            Math.min(99, Math.floor((processedPairs * 100) / totalPairs)),
          );
          window.setTimeout(processBatch, 0);
          return;
        }
        finishPreparation();
      };
      if (totalPairs) {
        window.setTimeout(processBatch, 0);
      } else {
        finishPreparation();
      }
      return;
    }
    capturedReusePairFilterRef.current = undefined;
    setCalculationStage(1);
    setCalculationProgress(12);
    window.setTimeout(() => {
      if (calculationRunToken.current !== runToken) return;
      setCalculationStage(2);
      setCalculationProgress(32);
      window.setTimeout(() => {
        if (calculationRunToken.current !== runToken) return;
        setCalculationStage(3);
        setCalculationProgress(58);
        window.setTimeout(() => {
          if (calculationRunToken.current !== runToken) return;
          setCalculationInputKey(requestedInputKey);
          setCalculationRequestId((current) => current + 1);
        }, 100);
      }, 120);
    }, 120);
  };

  const updateLineage = (slot: LineageSlot, value: number) => {
    const changed = lineage[slot] !== value;
    setLineage((current) => ({ ...current, [slot]: value }));
    if (!changed) return;
    setSlotRouteOverrides((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setFixedDressSlots((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setTrainedUmaSettings((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const clearLineageSetting = (slot: LineageSlot) => {
    const clearedSlots = [
      slot,
      ...(trainedUmaSettings[slot] ? SLOT_UPSTREAM_SLOTS[slot] || [] : []),
    ];
    setLineage((current) => {
      const next = { ...current };
      clearedSlots.forEach((item) => {
        next[item] = 0;
      });
      return next;
    });
    setSlotRouteOverrides((current) => {
      const next = { ...current };
      clearedSlots.forEach((item) => delete next[item]);
      return next;
    });
    setTrainedUmaSettings((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
    setFixedDressSlots((current) => {
      const next = { ...current };
      clearedSlots.forEach((item) => delete next[item]);
      return next;
    });
  };

  const clearTrainedUmaFill = (slot: LineageSlot) => {
    const setting = trainedUmaSettings[slot];
    if (!setting) return;
    const upstreamSlots = SLOT_UPSTREAM_SLOTS[slot] || [];
    setTrainedUmaSettings((current) => {
      const next = { ...current };
      delete next[slot];
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
    setLineage((current) => {
      const next = { ...current, [slot]: setting.self.umaId };
      upstreamSlots.forEach((upstreamSlot) => {
        next[upstreamSlot] = 0;
      });
      return next;
    });
    setSlotRouteOverrides((current) => {
      const next = { ...current };
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
    setFixedDressSlots((current) => {
      const next = { ...current };
      delete next[slot];
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
  };

  const lineageSlotFromDragEvent = (event: ReactDragEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const rawSlot = target.closest<HTMLElement>('[data-lineage-slot]')?.dataset
      .lineageSlot;
    return rawSlot && rawSlot in INITIAL_LINEAGE
      ? (rawSlot as LineageSlot)
      : null;
  };

  const clearLineageDragState = () => {
    setDraggedLineageSlot(null);
    setLineageDropSlot(null);
  };

  const handleLineageDragStart = (event: ReactDragEvent<HTMLDivElement>) => {
    const slot = lineageSlotFromDragEvent(event);
    if (!slot || !lineage[slot]) {
      event.preventDefault();
      return;
    }
    setDraggedLineageSlot(slot);
    setLineageDropSlot(null);
    event.dataTransfer?.setData('text/x-uma-lineage-slot', slot);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      const eventTarget = event.target;
      const slotElement =
        eventTarget instanceof Element
          ? eventTarget.closest<HTMLElement>('[data-lineage-slot]')
          : null;
      const trigger = slotElement?.querySelector<HTMLElement>(
        '.successionUmaTrigger',
      );
      if (trigger) {
        const preview = trigger.cloneNode(true) as HTMLElement;
        const bounds = trigger.getBoundingClientRect();
        preview.classList.add('successionLineageDragPreview');
        preview.style.width = `${bounds.width}px`;
        preview.setAttribute('aria-hidden', 'true');
        document.body.appendChild(preview);
        event.dataTransfer.setDragImage(
          preview,
          Math.min(bounds.width / 2, 52),
          Math.min(bounds.height / 2, 34),
        );
        window.setTimeout(() => preview.remove(), 0);
      }
    }
  };

  const handleLineageDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    const slot = lineageSlotFromDragEvent(event);
    if (!draggedLineageSlot || !slot || slot === draggedLineageSlot) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (lineageDropSlot !== slot) setLineageDropSlot(slot);
  };

  const handleLineageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const targetSlot = lineageSlotFromDragEvent(event);
    const rawSource =
      event.dataTransfer?.getData('text/x-uma-lineage-slot') ||
      draggedLineageSlot;
    const sourceSlot =
      rawSource && rawSource in INITIAL_LINEAGE
        ? (rawSource as LineageSlot)
        : null;
    if (!sourceSlot || !targetSlot || sourceSlot === targetSlot) {
      clearLineageDragState();
      return;
    }
    event.preventDefault();
    setLineage((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    setSlotRouteOverrides((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    setTrainedUmaSettings((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    setFixedDressSlots((current) => ({
      ...current,
      [sourceSlot]: current[targetSlot],
      [targetSlot]: current[sourceSlot],
    }));
    clearLineageDragState();
  };

  const saveTrainedUmaSetting = (
    slot: LineageSlot,
    setting: TrainedUmaSetting,
  ) => {
    const upstreamSlots = SLOT_UPSTREAM_SLOTS[slot] || [];
    setTrainedUmaSettings((current) => {
      const next = { ...current, [slot]: setting };
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
    setFixedDressSlots((current) => {
      const next = { ...current };
      delete next[slot];
      upstreamSlots.forEach((upstreamSlot) => delete next[upstreamSlot]);
      return next;
    });
    setLineage((current) => {
      const next = { ...current, [slot]: setting.self.umaId };
      upstreamSlots.forEach((upstreamSlot, index) => {
        next[upstreamSlot] = setting.parents[index].umaId;
      });
      return next;
    });
    setSlotRouteOverrides((current) => {
      const next = {
        ...current,
        [slot]: {
          routeId: setting.self.routeId,
          minimums: { ...DEFAULT_APTITUDE_MINIMUMS },
        },
      };
      upstreamSlots.forEach((upstreamSlot, index) => {
        next[upstreamSlot] = {
          routeId: setting.parents[index].routeId,
          minimums: { ...DEFAULT_APTITUDE_MINIMUMS },
        };
      });
      return next;
    });
  };

  const updateSlotRoute = (slot: LineageSlot, routeId: string) => {
    const effective = routeSettingForSlot(slot);
    const uma = umaById.get(lineage[slot]);
    const nextRoute = ROUTES.find((route) => route.id === routeId) || ROUTES[0];
    setSlotRouteOverrides((current) => {
      const sourceMinimums = current[slot]?.minimums || effective.minimums;
      return {
        ...current,
        [slot]: {
          routeId,
          minimums: uma
            ? fitMinimumsForUma(sourceMinimums, uma, nextRoute)
            : { ...sourceMinimums },
        },
      };
    });
  };

  const updateSlotRouteMinimum = (
    slot: LineageSlot,
    type: AptitudeKey,
    value: number,
  ) => {
    const effective = routeSettingForSlot(slot);
    const uma = umaById.get(lineage[slot]);
    const limitedValue = uma
      ? Math.max(
          minimumRouteRank(uma.aptitudes[type]),
          Math.min(value, maximumInheritedRank(uma.aptitudes[type])),
        )
      : value;
    const nextMinimums = {
      ...effective.minimums,
      [type]: limitedValue,
    };
    setSlotRouteOverrides((current) => ({
      ...current,
      [slot]: {
        routeId: current[slot]?.routeId || effective.route.id,
        minimums: uma
          ? fitMinimumsForUma(nextMinimums, uma, effective.route)
          : nextMinimums,
      },
    }));
  };

  const resetSlotRoute = (slot: LineageSlot) => {
    setSlotRouteOverrides((current) => {
      if (!current[slot]) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const clearAllUmaSelections = () => {
    calculationRunToken.current += 1;
    setTargetId(0);
    setLineage({ ...INITIAL_LINEAGE });
    setSlotRouteOverrides({});
    setTrainedUmaSettings({});
    setFixedDressSlots({});
    setInheritanceTargets({});
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    setCalculationInputKey('');
    setCalculationRequestId(0);
    setCompletedCalculation(undefined);
    setIsCalculating(false);
    setCalculationProgress(0);
    setCalculationStage(0);
  };

  const updateTarget = (value: number) => {
    if (!value) {
      clearAllUmaSelections();
      return;
    }
    setTargetId(value);
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    const nextTarget = umaById.get(value);
    setInheritanceTargets((current) => {
      if (!nextTarget) return {};
      const next: InheritanceTargets = {};
      inheritanceAptitudes.forEach((type) => {
        const previousBase =
          target?.aptitudes[type] ?? nextTarget.aptitudes[type];
        const raises = Math.max(
          1,
          (Number(current[type]) || previousBase + 1) - previousBase,
        );
        const nextBase = nextTarget.aptitudes[type];
        const targetRank = Math.min(7, nextBase + raises);
        if (targetRank > nextBase) next[type] = targetRank;
      });
      return next;
    });
  };

  const toggleInheritanceAptitude = (type: FactorKey) => {
    const active = inheritanceAptitudes.includes(type);
    if (active) {
      setInheritanceAptitudes((current) =>
        current.filter((item) => item !== type),
      );
      setInheritanceTargets((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      setConfiguredProbabilityTargetTypes((current) =>
        current.filter((item) => item !== type),
      );
      return;
    }
    if (!target) return;
    const allocations = inheritanceAllocation(
      target,
      inheritanceAptitudes,
      inheritanceTargets,
    );
    const usedSlots = allocations.reduce((sum, item) => sum + item.slots, 0);
    if (usedSlots + 1 > MAX_INHERITANCE_SLOTS) {
      return;
    }
    setInheritanceAptitudes((current) => [...current, type]);
    if (target.aptitudes[type] < 7) {
      setInheritanceTargets((current) => ({
        ...current,
        [type]: target.aptitudes[type] + 1,
      }));
    }
  };

  const configureProbabilityTarget = (type: FactorKey, rank: number) => {
    const guaranteed = targetInheritanceAllocations.find(
      (item) => item.type === type,
    )?.target;
    if (guaranteed === undefined || rank < guaranteed || rank > 8) return;
    setProbabilityTargetRanks((current) => ({ ...current, [type]: rank }));
    setConfiguredProbabilityTargetTypes((current) =>
      current.includes(type) ? current : [...current, type],
    );
  };

  const configureInheritanceAptitude = (type: FactorKey, rank: number) => {
    if (!target || rank <= target.aptitudes[type]) return;
    const nextSelected = inheritanceAptitudes.includes(type)
      ? inheritanceAptitudes
      : [...inheritanceAptitudes, type];
    const nextTargets = { ...inheritanceTargets, [type]: rank };
    const totals = inheritanceAllocation(target, nextSelected, nextTargets);
    const usedSlots = totals.reduce((sum, item) => sum + item.slots, 0);
    if (usedSlots > MAX_INHERITANCE_SLOTS) {
      return;
    }
    setInheritanceAptitudes(nextSelected);
    setInheritanceTargets(nextTargets);
  };

  const toggleExcludedUma = (umaId: number) => {
    if (!umaById.has(umaId)) return;
    setExcludedUmaIds((current) =>
      current.includes(umaId)
        ? current.filter((id) => id !== umaId)
        : [...current, umaId],
    );
  };

  const toggleExcludedCapturedUma = (selectionId: string) => {
    if (!selectionId) return;
    setExcludedCapturedSelectionIds((current) =>
      current.includes(selectionId)
        ? current.filter((id) => id !== selectionId)
        : [...current, selectionId],
    );
  };

  const resetLineage = () => {
    calculationRunToken.current += 1;
    setLineage({ ...INITIAL_LINEAGE });
    setRoutes({ ...INITIAL_ROUTES });
    setRouteMinimums({
      paternal: { ...INITIAL_ROUTE_MINIMUMS.paternal },
      maternal: { ...INITIAL_ROUTE_MINIMUMS.maternal },
    });
    setSlotRouteOverrides({});
    setTrainedUmaSettings({});
    setFixedDressSlots({});
    setInheritanceAptitudes([...INITIAL_INHERITANCE_APTITUDES]);
    setAllowInRaceFactorJump(false);
    setInRaceFactorJumpMinimumRank(6);
    setProbabilityTargetRanks({});
    setConfiguredProbabilityTargetTypes([]);
    setCalculationInputKey('');
    setCalculationRequestId(0);
    setCompletedCalculation(undefined);
    setIsCalculating(false);
    setCalculationProgress(0);
    setCalculationStage(0);
    if (target) {
      const nextTargets: InheritanceTargets = {};
      INITIAL_INHERITANCE_APTITUDES.forEach((type) => {
        if (target.aptitudes[type] < 7) {
          nextTargets[type] = target.aptitudes[type] + 1;
        }
      });
      setInheritanceTargets(nextTargets);
    } else {
      setInheritanceTargets({ ...INITIAL_INHERITANCE_TARGETS });
    }
  };

  const inheritedTrainedMemberForSlot = (slot: LineageSlot) => {
    const mappings: Partial<
      Record<LineageSlot, { parent: LineageSlot; index: 0 | 1 }>
    > = {
      paternalA: { parent: 'father', index: 0 },
      paternalB: { parent: 'father', index: 1 },
      maternalA: { parent: 'mother', index: 0 },
      maternalB: { parent: 'mother', index: 1 },
    };
    const mapping = mappings[slot];
    if (!mapping) return undefined;
    const parentSetting = trainedUmaSettings[mapping.parent];
    if (!parentSetting) return undefined;
    return {
      member: parentSetting.parents[mapping.index],
      sourceLabel: SLOT_LABELS[mapping.parent],
    };
  };
  const trainedModalExcludedIds = (slot: LineageSlot) => {
    const replacedSlots = new Set([slot, ...(SLOT_UPSTREAM_SLOTS[slot] || [])]);
    return [
      targetId,
      ...TARGET_FACTOR_SLOTS.filter((item) => !replacedSlots.has(item)).map(
        (item) => lineage[item],
      ),
    ].filter(Boolean);
  };
  const capturedCompatibilityPreviews = (
    slot: LineageSlot,
    candidate: CapturedTrainedUma,
  ): CapturedCompatibilityPreview[] => {
    if (!targetId) return [];
    const isParentSlot = slot === 'father' || slot === 'mother';
    const routeCompatibility = (route: Route) => {
      const detailed = detailedCommonG1Count(
        candidate.winSaddleIds,
        route.winSaddleIds,
        successionG1SaddleIds,
      );
      return {
        count: detailed ?? route.g1Count,
        detailed: detailed !== undefined,
      };
    };
    if (isParentSlot) {
      const branch = branchForSlot(slot);
      const route = routeSettingForSlot(slot, candidate.umaId).route;
      const coParentSlot: LineageSlot =
        branch === 'paternal' ? 'mother' : 'father';
      const coParentBase = lineage[coParentSlot]
        ? relationScore(candidate.umaId, lineage[coParentSlot])
        : 0;
      const ancestorBase = candidate.parents.reduce(
        (total, parent) =>
          total + relationScore(targetId, candidate.umaId, parent.umaId),
        0,
      );
      const base =
        relationScore(targetId, candidate.umaId) + coParentBase + ancestorBase;
      const g1Details = candidate.parents.map((parent) => {
        const exact = detailedCommonG1Count(
          candidate.winSaddleIds,
          parent.winSaddleIds,
          successionG1SaddleIds,
        );
        const fallback = routeCompatibility(route);
        return {
          label: `和${UMDB.cards[parent.cardId]?.name || parent.name}的胜鞍`,
          count: exact ?? fallback.count,
          detailed: exact !== undefined,
        };
      });
      const g1Count = g1Details.reduce(
        (total, detail) => total + detail.count,
        0,
      );
      return [
        {
          label: `${route.shortName}当前位置`,
          base,
          g1Count,
          total:
            base +
            winSaddleCompatibilityBonus(
              g1Details.map((detail) => detail.count),
            ),
          detailed: g1Details.every((detail) => detail.detailed),
          g1Details,
        },
      ];
    }

    const parentSlot: LineageSlot =
      slot === 'paternalA' || slot === 'paternalB' ? 'father' : 'mother';
    const parentId = lineage[parentSlot];
    const base = relationScore(targetId, parentId, candidate.umaId);
    const parentMember = trainedMemberForSlot(parentSlot, parentId);
    const exact = detailedCommonG1Count(
      parentMember?.winSaddleIds,
      candidate.winSaddleIds,
      successionG1SaddleIds,
    );
    if (exact !== undefined) {
      return [
        {
          label: `和${umaById.get(parentId)?.name || '父辈'}的胜鞍`,
          base,
          g1Count: exact,
          total: base + exact * G1_COMPATIBILITY_POINTS,
          detailed: true,
        },
      ];
    }
    return ROUTES.filter((route) => route.id !== 'none').map((route) => {
      const g1 = routeCompatibility(route);
      return {
        label: `父辈按${route.shortName}`,
        base,
        g1Count: g1.count,
        total: base + g1.count * G1_COMPATIBILITY_POINTS,
        detailed: g1.detailed,
      };
    });
  };

  return (
    <section className="successionPlanner">
      <section className="successionPanel successionLineagePanel">
        <div className={`successionTargetSetup${target ? ' hasTarget' : ''}`}>
          <div className={`successionTargetBar${target ? ' hasTarget' : ''}`}>
            <div className="successionTargetInline">
              <UmaSelect
                label="养成马娘"
                value={targetId}
                required
                exclude={selectedLineageIds}
                onChange={updateTarget}
              />
            </div>
          </div>
        </div>
        {target ? (
          <>
            <div
              className={`successionLineageGrid${draggedLineageSlot ? ' draggingUma' : ''}`}
              onDragStart={handleLineageDragStart}
              onDragOver={handleLineageDragOver}
              onDrop={handleLineageDrop}
              onDragEnd={clearLineageDragState}
            >
              <article className="successionBranch paternal">
                <div className="successionBranchLineage">
                  <LineageUmaSetting
                    slot="father"
                    branch="paternal"
                    value={lineage.father}
                    exclude={excludedIdsForSlot('father')}
                    compatibility={positionCompatibility.father}
                    route={routeSettingForSlot('father').route}
                    minimums={routeSettingForSlot('father').minimums}
                    followsDefault={!slotRouteOverrides.father}
                    trainedSetting={trainedUmaSettings.father}
                    trainedModalExclude={trainedModalExcludedIds('father')}
                    capturedUmas={capturedUmas}
                    compatibilityPreviews={(candidate) =>
                      capturedCompatibilityPreviews('father', candidate)
                    }
                    draggedSlot={draggedLineageSlot}
                    dropSlot={lineageDropSlot}
                    onPlanUmaChange={(value) => updateLineage('father', value)}
                    onClear={() => clearLineageSetting('father')}
                    onTrainedSettingChange={(setting) =>
                      saveTrainedUmaSetting('father', setting)
                    }
                    onTrainedSettingClear={() => clearTrainedUmaFill('father')}
                    fixedDressCardId={fixedDressSlots.father}
                    onFixedDressChange={(cardId) =>
                      setFixedDressSlots((current) => ({
                        ...current,
                        father: cardId,
                      }))
                    }
                    onRouteChange={(value) => updateSlotRoute('father', value)}
                    onMinimumChange={(type, value) =>
                      updateSlotRouteMinimum('father', type, value)
                    }
                    onResetRoute={() => resetSlotRoute('father')}
                  />
                  <div className="successionGrandparents">
                    <LineageUmaSetting
                      slot="paternalA"
                      branch="paternal"
                      value={lineage.paternalA}
                      exclude={excludedIdsForSlot('paternalA')}
                      compatibility={positionCompatibility.paternalA}
                      route={routeSettingForSlot('paternalA').route}
                      minimums={routeSettingForSlot('paternalA').minimums}
                      followsDefault={!slotRouteOverrides.paternalA}
                      trainedSetting={trainedUmaSettings.paternalA}
                      inheritedMember={
                        inheritedTrainedMemberForSlot('paternalA')?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot('paternalA')?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds('paternalA')}
                      capturedUmas={capturedUmas}
                      compatibilityPreviews={(candidate) =>
                        capturedCompatibilityPreviews('paternalA', candidate)
                      }
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage('paternalA', value)
                      }
                      onClear={() => clearLineageSetting('paternalA')}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting('paternalA', setting)
                      }
                      onTrainedSettingClear={() =>
                        clearTrainedUmaFill('paternalA')
                      }
                      fixedDressCardId={fixedDressSlots.paternalA}
                      onFixedDressChange={(cardId) =>
                        setFixedDressSlots((current) => ({
                          ...current,
                          paternalA: cardId,
                        }))
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute('paternalA', value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum('paternalA', type, value)
                      }
                      onResetRoute={() => resetSlotRoute('paternalA')}
                    />
                    <LineageUmaSetting
                      slot="paternalB"
                      branch="paternal"
                      value={lineage.paternalB}
                      exclude={excludedIdsForSlot('paternalB')}
                      compatibility={positionCompatibility.paternalB}
                      route={routeSettingForSlot('paternalB').route}
                      minimums={routeSettingForSlot('paternalB').minimums}
                      followsDefault={!slotRouteOverrides.paternalB}
                      trainedSetting={trainedUmaSettings.paternalB}
                      inheritedMember={
                        inheritedTrainedMemberForSlot('paternalB')?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot('paternalB')?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds('paternalB')}
                      capturedUmas={capturedUmas}
                      compatibilityPreviews={(candidate) =>
                        capturedCompatibilityPreviews('paternalB', candidate)
                      }
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage('paternalB', value)
                      }
                      onClear={() => clearLineageSetting('paternalB')}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting('paternalB', setting)
                      }
                      onTrainedSettingClear={() =>
                        clearTrainedUmaFill('paternalB')
                      }
                      fixedDressCardId={fixedDressSlots.paternalB}
                      onFixedDressChange={(cardId) =>
                        setFixedDressSlots((current) => ({
                          ...current,
                          paternalB: cardId,
                        }))
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute('paternalB', value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum('paternalB', type, value)
                      }
                      onResetRoute={() => resetSlotRoute('paternalB')}
                    />
                  </div>
                </div>
                <BranchRouteCard
                  branch="paternal"
                  route={selectedRoutes.paternal}
                  minimums={routeMinimums.paternal}
                  onRouteChange={(value) =>
                    setRoutes((current) => ({ ...current, paternal: value }))
                  }
                  onMinimumChange={(type, value) =>
                    setRouteMinimums((current) => ({
                      ...current,
                      paternal: { ...current.paternal, [type]: value },
                    }))
                  }
                />
              </article>
              <article className="successionBranch maternal">
                <div className="successionBranchLineage">
                  <LineageUmaSetting
                    slot="mother"
                    branch="maternal"
                    value={lineage.mother}
                    exclude={excludedIdsForSlot('mother')}
                    compatibility={positionCompatibility.mother}
                    route={routeSettingForSlot('mother').route}
                    minimums={routeSettingForSlot('mother').minimums}
                    followsDefault={!slotRouteOverrides.mother}
                    trainedSetting={trainedUmaSettings.mother}
                    trainedModalExclude={trainedModalExcludedIds('mother')}
                    capturedUmas={capturedUmas}
                    compatibilityPreviews={(candidate) =>
                      capturedCompatibilityPreviews('mother', candidate)
                    }
                    draggedSlot={draggedLineageSlot}
                    dropSlot={lineageDropSlot}
                    onPlanUmaChange={(value) => updateLineage('mother', value)}
                    onClear={() => clearLineageSetting('mother')}
                    onTrainedSettingChange={(setting) =>
                      saveTrainedUmaSetting('mother', setting)
                    }
                    onTrainedSettingClear={() => clearTrainedUmaFill('mother')}
                    fixedDressCardId={fixedDressSlots.mother}
                    onFixedDressChange={(cardId) =>
                      setFixedDressSlots((current) => ({
                        ...current,
                        mother: cardId,
                      }))
                    }
                    onRouteChange={(value) => updateSlotRoute('mother', value)}
                    onMinimumChange={(type, value) =>
                      updateSlotRouteMinimum('mother', type, value)
                    }
                    onResetRoute={() => resetSlotRoute('mother')}
                  />
                  <div className="successionGrandparents">
                    <LineageUmaSetting
                      slot="maternalA"
                      branch="maternal"
                      value={lineage.maternalA}
                      exclude={excludedIdsForSlot('maternalA')}
                      compatibility={positionCompatibility.maternalA}
                      route={routeSettingForSlot('maternalA').route}
                      minimums={routeSettingForSlot('maternalA').minimums}
                      followsDefault={!slotRouteOverrides.maternalA}
                      trainedSetting={trainedUmaSettings.maternalA}
                      inheritedMember={
                        inheritedTrainedMemberForSlot('maternalA')?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot('maternalA')?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds('maternalA')}
                      capturedUmas={capturedUmas}
                      compatibilityPreviews={(candidate) =>
                        capturedCompatibilityPreviews('maternalA', candidate)
                      }
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage('maternalA', value)
                      }
                      onClear={() => clearLineageSetting('maternalA')}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting('maternalA', setting)
                      }
                      onTrainedSettingClear={() =>
                        clearTrainedUmaFill('maternalA')
                      }
                      fixedDressCardId={fixedDressSlots.maternalA}
                      onFixedDressChange={(cardId) =>
                        setFixedDressSlots((current) => ({
                          ...current,
                          maternalA: cardId,
                        }))
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute('maternalA', value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum('maternalA', type, value)
                      }
                      onResetRoute={() => resetSlotRoute('maternalA')}
                    />
                    <LineageUmaSetting
                      slot="maternalB"
                      branch="maternal"
                      value={lineage.maternalB}
                      exclude={excludedIdsForSlot('maternalB')}
                      compatibility={positionCompatibility.maternalB}
                      route={routeSettingForSlot('maternalB').route}
                      minimums={routeSettingForSlot('maternalB').minimums}
                      followsDefault={!slotRouteOverrides.maternalB}
                      trainedSetting={trainedUmaSettings.maternalB}
                      inheritedMember={
                        inheritedTrainedMemberForSlot('maternalB')?.member
                      }
                      inheritedSourceLabel={
                        inheritedTrainedMemberForSlot('maternalB')?.sourceLabel
                      }
                      trainedModalExclude={trainedModalExcludedIds('maternalB')}
                      capturedUmas={capturedUmas}
                      compatibilityPreviews={(candidate) =>
                        capturedCompatibilityPreviews('maternalB', candidate)
                      }
                      draggedSlot={draggedLineageSlot}
                      dropSlot={lineageDropSlot}
                      onPlanUmaChange={(value) =>
                        updateLineage('maternalB', value)
                      }
                      onClear={() => clearLineageSetting('maternalB')}
                      onTrainedSettingChange={(setting) =>
                        saveTrainedUmaSetting('maternalB', setting)
                      }
                      onTrainedSettingClear={() =>
                        clearTrainedUmaFill('maternalB')
                      }
                      fixedDressCardId={fixedDressSlots.maternalB}
                      onFixedDressChange={(cardId) =>
                        setFixedDressSlots((current) => ({
                          ...current,
                          maternalB: cardId,
                        }))
                      }
                      onRouteChange={(value) =>
                        updateSlotRoute('maternalB', value)
                      }
                      onMinimumChange={(type, value) =>
                        updateSlotRouteMinimum('maternalB', type, value)
                      }
                      onResetRoute={() => resetSlotRoute('maternalB')}
                    />
                  </div>
                </div>
                <BranchRouteCard
                  branch="maternal"
                  route={selectedRoutes.maternal}
                  minimums={routeMinimums.maternal}
                  onRouteChange={(value) =>
                    setRoutes((current) => ({ ...current, maternal: value }))
                  }
                  onMinimumChange={(type, value) =>
                    setRouteMinimums((current) => ({
                      ...current,
                      maternal: { ...current.maternal, [type]: value },
                    }))
                  }
                />
              </article>
            </div>
            <section className="successionCalculationPanel">
              <div className="successionCalculationWorkspace compact">
                <div className="successionCalculationActions">
                  <button
                    className="successionResetLineage"
                    type="button"
                    disabled={isCalculating}
                    onClick={resetLineage}
                  >
                    <span aria-hidden="true">↺</span>
                    重置种马路线
                  </button>
                  <button
                    type="button"
                    className="successionCalculationSettingsButton"
                    disabled={isCalculating}
                    onClick={() => setCalculationSettingsOpen(true)}
                    title="计算设置"
                  >
                    <Settings size={18} aria-hidden="true" />
                    <span>设置</span>
                    {capturedReuseMode !== 'off' && <i />}
                  </button>
                  <button
                    type="button"
                    className="successionCalculateButton"
                    disabled={
                      isCalculating ||
                      capturedOwnershipInvalid ||
                      capturedReuseUnavailable
                    }
                    onClick={calculateOptimalDesign}
                  >
                    {isCalculating
                      ? '计算中'
                      : calculationComplete
                        ? '重新计算最优种马路线'
                        : '计算最优种马路线'}
                  </button>
                </div>
              </div>
              {calculationSettingsOpen && (
                <div
                  className="successionCalculationSettingsBackdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                      setCalculationSettingsOpen(false);
                    }
                  }}
                >
                  <section
                    className="successionCalculationSettingsDialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label="最优种马路线计算设置"
                  >
                    <header>
                      <div>
                        <h2>最优种马路线设置</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalculationSettingsOpen(false)}
                        aria-label="关闭设置"
                      >
                        ×
                      </button>
                    </header>
                    <div className="successionCalculationSettingsBody">
                      <section>
                        <header>
                          <strong>继承与概率</strong>
                        </header>
                        <div className="successionCalculationPlanning">
                          <InRaceFactorJumpOption
                            enabled={allowInRaceFactorJump}
                            minimumRank={inRaceFactorJumpMinimumRank}
                            onEnabledChange={setAllowInRaceFactorJump}
                            onMinimumRankChange={setInRaceFactorJumpMinimumRank}
                            footer={
                              <ProbabilityTargetInput
                                targetName={target.name}
                                probabilityOptions={targetInheritanceAllocations.map(
                                  (item) => ({
                                    type: item.type,
                                    guaranteed: item.target,
                                    target:
                                      probabilityTargetRanks[item.type] ||
                                      item.target,
                                  }),
                                )}
                                onConfigureProbabilityTarget={
                                  configureProbabilityTarget
                                }
                                embedded
                              />
                            }
                          />
                          <div className="successionCalculationInheritance">
                            <InheritanceAptitudes
                              target={target}
                              selected={inheritanceAptitudes}
                              targets={inheritanceTargets}
                              onToggle={toggleInheritanceAptitude}
                              onConfigure={configureInheritanceAptitude}
                            />
                          </div>
                        </div>
                      </section>
                      <section>
                        <div className="successionCalculationControls">
                          <UmaExclusionList
                            excludedIds={excludedUmaIds}
                            excludedCapturedSelectionIds={
                              excludedCapturedSelectionIds
                            }
                            capturedUmas={allCapturedUmas}
                            fixedIds={[targetId, ...selectedLineageIds]}
                            onToggle={toggleExcludedUma}
                            onToggleCaptured={toggleExcludedCapturedUma}
                          />
                        </div>
                      </section>
                      <section>
                        <div className="successionCapturedReuseControls settings">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={capturedReuseMode !== 'off'}
                            className={`successionSettingsSwitchRow${capturedReuseMode !== 'off' ? ' isOn' : ''}`}
                            disabled={
                              isCalculating ||
                              (capturedReuseMode === 'off' &&
                                !capturedUmas.length)
                            }
                            onClick={() =>
                              setCapturedReuseMode((current) =>
                                current === 'off' ? 'parents' : 'off',
                              )
                            }
                          >
                            <span
                              className="successionSettingsSwitch"
                              aria-hidden="true"
                            >
                              <i />
                            </span>
                            <span className="successionSettingsSwitchCopy">
                              <strong>只使用已育成马娘</strong>
                            </span>
                          </button>
                          {capturedOwnershipInvalid && (
                            <div
                              className="successionCapturedOwnershipWarning settings"
                              role="alert"
                            >
                              两个直接父代不能同时使用借用马娘。请将其中一个改为计划马娘或自己的已有马娘。
                            </div>
                          )}
                          {capturedReuseUnavailable && (
                            <div
                              className="successionCapturedOwnershipWarning settings"
                              role="alert"
                            >
                              只使用已育成马娘至少需要两匹可用记录。
                            </div>
                          )}
                          {capturedReuseMode !== 'off' && (
                            <>
                              <CapturedBlueFactorMinimumEditor
                                minimums={capturedBlueFactorMinimums}
                                onChange={(type, stars) =>
                                  setCapturedBlueFactorMinimums((current) => {
                                    const next = { ...current, [type]: stars };
                                    return capturedBlueFactorMinimumSlotCount(
                                      next,
                                    ) <= 6
                                      ? next
                                      : current;
                                  })
                                }
                                disabled={isCalculating}
                              />
                              <CapturedSkillPriorityEditor
                                options={capturedFactorTargetOptions}
                                selected={capturedFactorTargets}
                                onAdd={() => setCapturedSkillPickerOpen(true)}
                                onRemove={toggleCapturedFactorTarget}
                                onReorder={reorderCapturedFactorTarget}
                                disabled={
                                  isCalculating ||
                                  !Object.keys(successionFactorMeta).length
                                }
                              />
                            </>
                          )}
                        </div>
                      </section>
                    </div>
                    <footer>
                      <span>设置会自动保存并用于下一次计算</span>
                      <button
                        type="button"
                        onClick={() => setCalculationSettingsOpen(false)}
                      >
                        完成
                      </button>
                    </footer>
                  </section>
                </div>
              )}
              <SkillSelector
                open={
                  capturedReuseMode !== 'off' &&
                  calculationSettingsOpen &&
                  capturedSkillPickerOpen
                }
                title="选择希望继承的技能"
                description="只显示可通过已有因子获得的普通技能和基础固有技能；支持按效果、跑法和距离筛选。"
                skills={capturedSkillPickerSkills}
                selectedNames={selectedCapturedFactorTargetLabels}
                blockedNames={capturedFactorTargetOptions
                  .filter((option) => !option.availableCount)
                  .map((option) => option.name)}
                showRarityFilter={false}
                showSkillPoints={false}
                elevated
                onToggle={(skill) =>
                  toggleCapturedFactorTarget({
                    kind: 'skill',
                    groupId: skill.group_id,
                  })
                }
                onClose={() => setCapturedSkillPickerOpen(false)}
              />
              {isCalculating && (
                <div
                  className="successionCalculationProgress"
                  aria-live="polite"
                >
                  <header>
                    <div>
                      <strong>
                        阶段 {calculationStage} / {CALCULATION_PHASES.length}
                      </strong>
                      <span>
                        {calculationPairProgress.total
                          ? `计算已有马娘组合 ${calculationPairProgress.current} / ${calculationPairProgress.total}`
                          : CALCULATION_PHASES[
                              Math.max(0, calculationStage - 1)
                            ]}
                      </span>
                    </div>
                    <b>{calculationProgress}%</b>
                  </header>
                  <progress max="100" value={calculationProgress} />
                  <ol>
                    {CALCULATION_PHASES.map((phase, index) => {
                      const phaseNumber = index + 1;
                      return (
                        <li
                          className={
                            phaseNumber < calculationStage
                              ? 'completed'
                              : phaseNumber === calculationStage
                                ? 'active'
                                : ''
                          }
                          key={phase}
                        >
                          <i>
                            {phaseNumber < calculationStage ? '✓' : phaseNumber}
                          </i>
                          <span>{phase}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>
            {calculationComplete && completeFactorDesigns.length ? (
              <div
                className={`successionOptimalResults${singleBranchCompleteDesigns ? ' singleBranchResults' : ''}`}
              >
                {capturedReuseMode !== 'off' &&
                  selectedCapturedFactorTargetLabels.length > 0 && (
                    <div className="successionOptimalResultsNotice factorTargets">
                      {selectedCapturedFactorTargetLabels
                        .map((label, index) => `${index + 1}.${label}`)
                        .join('　')}
                    </div>
                  )}
                {displayedCalculation?.result?.truncated && (
                  <div className="successionOptimalResultsNotice">
                    候选过多，仅显示前
                    {capturedReuseMode === 'off'
                      ? MAX_EQUAL_CANDIDATES
                      : MAX_CAPTURED_RESULT_CANDIDATES}
                    个候选。
                  </div>
                )}
                {capturedReuseMode !== 'off' && (
                  <div className="successionCapturedPickerPagination successionResultPagination">
                    <button
                      type="button"
                      disabled={calculationResultPage === 0}
                      onClick={() =>
                        setCalculationResultPage((current) => current - 1)
                      }
                    >
                      上一匹
                    </button>
                    <strong>
                      {calculationResultPage + 1} / {completeFactorDesigns.length}
                    </strong>
                    <button
                      type="button"
                      disabled={
                        calculationResultPage >= completeFactorDesigns.length - 1
                      }
                      onClick={() =>
                        setCalculationResultPage((current) => current + 1)
                      }
                    >
                      下一匹
                    </button>
                  </div>
                )}
                {renderedCompleteFactorDesigns.map((result, index) => (
                  <CompleteDesignResult
                    rank={
                      capturedReuseMode === 'off'
                        ? index + 1
                        : calculationResultPage + 1
                    }
                    design={result.design}
                    probability={result.probability}
                    probabilityTargets={targetInheritanceAllocations.map(
                      (item) => ({
                        type: item.type,
                        rank: probabilityTargetRanks[item.type] || item.target,
                      }),
                    )}
                    hasCapturedFactorTargets={
                      capturedReuseMode !== 'off' &&
                      effectiveCapturedFactorTargets.length > 0
                    }
                    capturedUmas={capturedUmas}
                    showCapturedMatches={capturedReuseMode === 'off'}
                    onExcludeUma={toggleExcludedUma}
                    onExcludeCapturedUma={toggleExcludedCapturedUma}
                    key={
                      capturedReuseMode === 'off'
                        ? index
                        : calculationResultPage
                    }
                  />
                ))}
              </div>
            ) : calculationComplete ? (
              <div className="successionCompleteDesignIssues successionStandaloneIssue">
                <strong>未找到可行的种马路线</strong>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  );
}

export default function SuccessionPlannerPage() {
  const [snapshot, setSnapshot] = useState<SuccessionIndexSnapshot | null>(
    null,
  );
  const [scannedPlayers, setScannedPlayers] = useState<
    StoredSuccessionPlayer[]
  >([]);
  const [scanAccounts, setScanAccounts] = useState<SuccessionScanAccount[]>([]);
  const [selectedScanAccountId, setSelectedScanAccountId] = useState(
    () => localStorage.getItem('succession.playerScan.account') || '',
  );
  const [playerScanOpen, setPlayerScanOpen] = useState(false);
  const [playerIdsText, setPlayerIdsText] = useState('');
  const [updateExistingPlayers, setUpdateExistingPlayers] = useState(
    () => localStorage.getItem('succession.playerScan.updateExisting') !== 'false',
  );
  const scannedImportInputRef = useRef<HTMLInputElement>(null);
  const [scanProgress, setScanProgress] =
    useState<SuccessionScanProgress | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResult, setScanResult] = useState('');
  const [successionG1SaddleIds, setSuccessionG1SaddleIds] = useState<number[]>(
    [],
  );
  const [successionFactorMeta, setSuccessionFactorMeta] = useState<
    Record<number, SuccessionFactorMeta>
  >({});
  const effectiveSnapshot = useMemo(
    () => mergeScannedSuccessionPlayers(snapshot, scannedPlayers),
    [snapshot, scannedPlayers],
  );
  const capturedUmas = useMemo(
    () => normalizeSuccessionIndex(effectiveSnapshot),
    [effectiveSnapshot],
  );
  const capturedRentalRows = Array.isArray(
    effectiveSnapshot?.data?.succession_trained_chara_data
      ?.succession_trained_chara_array,
  )
    ? effectiveSnapshot.data.succession_trained_chara_data
        .succession_trained_chara_array.length
    : 0;
  const ownCount = capturedUmas.filter((uma) => uma.source === 'own').length;
  const rentalCount = capturedUmas.length - ownCount;

  const loadScanAccounts = async () => {
    const accounts =
      (await window.electron.autoResearch.accounts()) as SuccessionScanAccount[];
    setScanAccounts(accounts);
    setSelectedScanAccountId((current) => {
      const selected = accounts.some((account) => account.id === current)
        ? current
        : accounts[0]?.id || '';
      if (selected)
        localStorage.setItem('succession.playerScan.account', selected);
      return selected;
    });
    return accounts;
  };

  useEffect(() => {
    loadUMDB()
      .then(() => {
        setSuccessionG1SaddleIds([...UMDB.successionG1SaddleIds]);
        setSuccessionFactorMeta({ ...UMDB.successionFactorMeta });
      })
      .catch(() => undefined);
    window.electron.packetListener
      .getSuccessionIndex()
      .then((value) => setSnapshot(value as SuccessionIndexSnapshot | null))
      .catch(() => undefined);
    window.electron.successionPlayerScan
      .list()
      .then((value) => setScannedPlayers(value as StoredSuccessionPlayer[]))
      .catch(() => undefined);
    loadScanAccounts().catch(() => undefined);
    return window.electron.packetListener.onSuccessionIndex((value) => {
      setSnapshot(value as SuccessionIndexSnapshot);
    });
  }, []);

  useEffect(
    () =>
      window.electron.successionPlayerScan.onProgress((progress) => {
        setScanProgress(progress as SuccessionScanProgress);
      }),
    [],
  );

  const scanPlayerIds = async (
    rawPlayerIds: string,
    updateExisting = updateExistingPlayers,
  ) => {
    if (!selectedScanAccountId) {
      setScanError('请先选择一个账号');
      return;
    }
    if (!rawPlayerIds.trim()) {
      setScanError('请粘贴至少一个玩家 ID');
      return;
    }
    setScanBusy(true);
    setScanError('');
    setScanResult('');
    setScanProgress({ stage: 'login', detail: '正在准备所选账号' });
    try {
      const result = (await window.electron.successionPlayerScan.scan(
        selectedScanAccountId,
        rawPlayerIds,
        updateExisting,
      )) as {
        players: StoredSuccessionPlayer[];
        added: StoredSuccessionPlayer[];
        errors: Array<{ viewerId: string; message: string }>;
        skipped: string[];
      };
      setScannedPlayers(result.players);
      setScanResult(
        `成功载入 ${result.added.length} 位玩家的代表马娘${result.skipped.length ? `，跳过已有 ${result.skipped.length} 位` : ''}${result.errors.length ? `，失败 ${result.errors.length} 位` : ''}`,
      );
    } catch (error) {
      setScanError((error as Error).message);
    } finally {
      setScanBusy(false);
    }
  };

  const startPlayerScan = () => scanPlayerIds(playerIdsText);

  const refreshAllScannedPlayers = () =>
    scanPlayerIds(
      scannedPlayers.map((player) => player.viewerId).join('\n'),
      true,
    );

  const clearScannedPlayers = async () => {
    if (
      !window.confirm(
        `确定删除全部 ${scannedPlayers.length} 位玩家的已爬取数据吗？`,
      )
    )
      return;
    setScanError('');
    try {
      const players =
        (await window.electron.successionPlayerScan.clear()) as StoredSuccessionPlayer[];
      setScannedPlayers(players);
      setScanResult('已删除全部爬取数据');
    } catch (error) {
      setScanError((error as Error).message);
    }
  };

  const exportScannedPlayers = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            players: scannedPlayers,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `umashow-succession-players-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importScannedPlayers = async (file: File) => {
    setScanError('');
    setScanResult('');
    try {
      const payload = JSON.parse(await file.text());
      const result = (await window.electron.successionPlayerScan.importPlayers(
        payload,
      )) as {
        players: StoredSuccessionPlayer[];
        importedCount: number;
      };
      setScannedPlayers(result.players);
      setScanResult(
        `已导入 ${result.importedCount} 位玩家，当前共 ${result.players.length} 位`,
      );
    } catch (error) {
      setScanError(`导入失败：${(error as Error).message}`);
    }
  };

  return (
    <main className="successionPlannerPage">
      <header className="successionIndexStatus">
        <div>
          <h1>继承规划</h1>
        </div>
        <div className={effectiveSnapshot ? 'captured' : 'waiting'}>
          <div className="successionLoadedHeading">
            <strong>
              {effectiveSnapshot
                ? `已载入 ${capturedUmas.length} 匹`
                : '等待育成准备数据'}
            </strong>
            <button
              type="button"
              className="successionAddPlayersButton"
              onClick={() => setPlayerScanOpen(true)}
            >
              <Plus size={14} />
              增加更多马娘
            </button>
          </div>
          <span>
            {effectiveSnapshot
              ? `自己的 ${ownCount} · 其他玩家 ${rentalCount}/${capturedRentalRows} · 已保存扫描玩家 ${scannedPlayers.length} · ${new Date(effectiveSnapshot.receivedAt).toLocaleString()}`
              : '请保持监听开启，并在游戏中进入育成准备画面'}
          </span>
        </div>
      </header>
      <SuccessionPlanner
        capturedUmas={capturedUmas}
        successionG1SaddleIds={successionG1SaddleIds}
        successionFactorMeta={successionFactorMeta}
      />
      {playerScanOpen && (
        <div
          className="successionPickerOverlay"
          onMouseDown={() => {
            if (!scanBusy) setPlayerScanOpen(false);
          }}
        >
          <section
            className="successionPickerDialog successionPlayerScanDialog"
            role="dialog"
            aria-modal="true"
            aria-label="增加更多马娘"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="successionPickerHeader">
              <div>
                <span>PLAYER SCANNER</span>
                <h3>增加更多马娘</h3>
              </div>
              <button
                type="button"
                className="successionPickerClose"
                aria-label="关闭"
                disabled={scanBusy}
                onClick={() => setPlayerScanOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="successionPlayerScanBody">
              <section className="successionPlayerScanLogin">
                <div className="successionPlayerScanSectionTitle">
                  <strong>选择账号</strong>
                  <span>账号请在AutoUma中添加</span>
                </div>
                {scanAccounts.length ? (
                  <div className="successionPlayerScanAccounts">
                    {scanAccounts.map((account) => (
                      <button
                        type="button"
                        key={account.id}
                        className={
                          selectedScanAccountId === account.id ? 'selected' : ''
                        }
                        disabled={scanBusy}
                        onClick={() => {
                          setSelectedScanAccountId(account.id);
                          localStorage.setItem(
                            'succession.playerScan.account',
                            account.id,
                          );
                        }}
                      >
                        <strong>{account.label || `UID ${account.uid}`}</strong>
                        <span>
                          {account.uid} · {account.accessKeyPreview}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="successionPlayerScanEmpty">
                    还没有可用账号，请先前往自动育成页面添加账号。
                  </p>
                )}
              </section>

              <section className="successionPlayerScanTargets">
                <div className="successionPlayerScanSectionTitle">
                  <strong>玩家 ID</strong>
                  <span>不限数量，按 0.5 秒间隔依次请求</span>
                </div>
                <textarea
                  value={playerIdsText}
                  disabled={scanBusy}
                  autoFocus
                  placeholder={'245749415802\n426751416382\n196682775987'}
                  onChange={(event) => setPlayerIdsText(event.target.value)}
                />
                {scanProgress && (
                  <div className="successionPlayerScanProgress">
                    <strong>{scanProgress.detail}</strong>
                    {scanProgress.total ? (
                      <span>
                        {scanProgress.current || 0}/{scanProgress.total}
                      </span>
                    ) : null}
                  </div>
                )}
                {scanResult && (
                  <div className="successionPlayerScanMessage success">
                    {scanResult}
                  </div>
                )}
                {scanError && (
                  <div className="successionPlayerScanMessage error">
                    {scanError}
                  </div>
                )}
              </section>

              {scannedPlayers.length > 0 && (
                <section className="successionPlayerScanSaved">
                  <div className="successionPlayerScanSectionTitle">
                    <div>
                      <strong>已持久化 {scannedPlayers.length} 位玩家</strong>
                      <span>下次启动 UmaShow 会自动继续载入</span>
                    </div>
                    <div className="successionPlayerScanSavedToolbar">
                      <button
                        type="button"
                        disabled={scanBusy || !selectedScanAccountId}
                        onClick={refreshAllScannedPlayers}
                      >
                        <RefreshCw size={12} />
                        全部刷新
                      </button>
                      <button type="button" onClick={exportScannedPlayers}>
                        <Download size={12} />
                        导出 JSON
                      </button>
                      <button
                        type="button"
                        disabled={scanBusy}
                        onClick={() => scannedImportInputRef.current?.click()}
                      >
                        <Upload size={12} />
                        导入 JSON
                      </button>
                      <input
                        ref={scannedImportInputRef}
                        type="file"
                        accept="application/json,.json"
                        hidden
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) importScannedPlayers(file);
                          event.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="danger"
                        disabled={scanBusy}
                        onClick={clearScannedPlayers}
                      >
                        <Trash2 size={12} />
                        全部删除
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <footer className="successionPlayerScanFooter">
              <label className="successionPlayerScanUpdateToggle">
                <input
                  type="checkbox"
                  checked={updateExistingPlayers}
                  disabled={scanBusy}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setUpdateExistingPlayers(checked);
                    localStorage.setItem(
                      'succession.playerScan.updateExisting',
                      String(checked),
                    );
                  }}
                />
                <i aria-hidden="true" />
                <span>更新已有数据</span>
              </label>
              <button
                type="button"
                disabled={scanBusy || !selectedScanAccountId}
                onClick={startPlayerScan}
              >
                {scanBusy ? '正在扫描…' : '开始扫描'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
