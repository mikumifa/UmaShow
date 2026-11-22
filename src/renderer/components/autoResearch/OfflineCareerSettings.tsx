/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  Dispatch,
  memo,
  ReactNode,
  SetStateAction,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  CalendarDays,
  ChevronDown,
  Check,
  CircleAlert,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Star,
  X,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import successionData from 'renderer/data/succession_data.json';
import {
  SuccessionPickerDialog,
  SuccessionPickerFilterSheet,
  SuccessionPickerTrigger,
} from 'renderer/components/succession/SuccessionPicker';
import {
  PlannerButton,
  PlannerPortrait,
  PlannerSelectionCard,
  PlannerSkillCardContent,
} from 'renderer/components/succession/PlannerComponents';
import {
  matchesParentFactorFilters,
  ParentFactorFilter,
} from 'renderer/utils/parentFactorFilters';
import { compareRaces } from './shared';
import SkillSelector, {
  AutoResearchSkill,
  isInheritedUniqueSkill,
  PrioritySkillName,
  skillIconPath,
  SkillMetadata,
  type SkillTiers,
} from './SkillSelector';
import {
  isRentalParent,
  ParentChoiceCard,
  RentalParentBadge,
  umaSkinIconPath,
} from './SelectionCards';
import {
  Dashboard,
  OfflineFactorSelection,
  OfflineFactorTarget,
  OfflineSingleModeSetup,
  RaceOption,
} from './types';
import RaceSchedulePicker from './RaceSchedulePicker';
import ReorderControls from './ReorderControls';
import { factorPriorityRanks, usesOfflineFactorTargets } from './offlineCareerSkills';
import Toggle from './Toggle';
import type { SkillSourcesByGroup } from './obtainableSkills';
import ParentFactorFilters from './ParentFactorFilters';
import useScrollLoadMore from './useScrollLoadMore';

type Props = {
  obtainableGroups?: SkillSourcesByGroup;
  factorOnly?: boolean;
  customSchedule?: boolean;
  setCustomSchedule?: (custom: boolean) => void;
  customScheduleContent?: ReactNode;
  setup: OfflineSingleModeSetup | null;
  selectedScenarioId: number;
  races: RaceOption[];
  selectedDeckNum: number;
  setSelectedDeckNum: Dispatch<SetStateAction<number>>;
  busy: string;
  prepare: () => Promise<OfflineSingleModeSetup | null>;
  saveDeck: (
    deckNum: number,
    deckName: string,
    raceIds: number[],
  ) => Promise<boolean>;
  factorSelection: OfflineFactorSelection;
  setFactorSelection: Dispatch<SetStateAction<OfflineFactorSelection>>;
  parents: Dashboard['parents'];
  umas: Dashboard['umas'];
  skills: AutoResearchSkill[];
};

const raceKey = (year: number, programId: number) => year * 100000 + programId;
const EMPTY_SKILL_GROUPS: SkillSourcesByGroup = new Map();

// A saved double-circle target uses the single-circle row in the picker.
const visibleTargetName = (name: string) => name.replace(/◎$/, '○');

const BLUE_FACTORS = [
  ['speed', '速度'],
  ['stamina', '耐力'],
  ['power', '力量'],
  ['guts', '毅力'],
  ['wit', '智力'],
] as const;

const APTITUDE_FACTORS: OfflineFactorTarget[] = [
  { factor_group_id: 11, name: '草地', kind: 'aptitude', weight: 1 },
  { factor_group_id: 12, name: '泥地', kind: 'aptitude', weight: 1 },
  { factor_group_id: 21, name: '领跑', kind: 'aptitude', weight: 1 },
  { factor_group_id: 22, name: '跟前', kind: 'aptitude', weight: 1 },
  { factor_group_id: 23, name: '居中', kind: 'aptitude', weight: 1 },
  { factor_group_id: 24, name: '后追', kind: 'aptitude', weight: 1 },
  { factor_group_id: 31, name: '短距离', kind: 'aptitude', weight: 1 },
  { factor_group_id: 32, name: '英里', kind: 'aptitude', weight: 1 },
  { factor_group_id: 33, name: '中距离', kind: 'aptitude', weight: 1 },
  { factor_group_id: 34, name: '长距离', kind: 'aptitude', weight: 1 },
];

const APTITUDE_FACTOR_GROUP_IDS = new Set(
  APTITUDE_FACTORS.map((factor) => factor.factor_group_id),
);

type LineageSourceFilter = 'all' | 'own' | 'rental';
type LineageSort = 'score' | 'blue' | 'aptitude';
type LineageSortDirection = 'desc' | 'asc';

function parentFactorStars(
  parent: Dashboard['parents'][number],
  kind: 'blue' | 'aptitude',
  factorGroupIds: number[],
) {
  return Math.max(
    0,
    ...parent.factors
      .filter((factor) => {
        if (
          factorGroupIds.length &&
          !factorGroupIds.includes(factor.factor_group_id)
        ) {
          return false;
        }
        if (kind === 'blue') {
          return factor.factor_type === 1 || factor.category === 'stat';
        }
        return (
          factor.factor_type === 2 ||
          factor.category === 'distance' ||
          factor.category === 'aptitude' ||
          APTITUDE_FACTOR_GROUP_IDS.has(factor.factor_group_id)
        );
      })
      .map((factor) => factor.stars),
  );
}

const RED_FACTOR_GROUPS = [
  { label: '场地', factors: APTITUDE_FACTORS.slice(0, 2) },
  { label: '跑法', factors: APTITUDE_FACTORS.slice(2, 6) },
  { label: '距离', factors: APTITUDE_FACTORS.slice(6) },
];

const RED_FACTOR_ICON_PATHS: Record<number, string> = {
  11: 'succession/aptitude/turf.png',
  12: 'succession/aptitude/dirt.png',
  21: 'succession/aptitude/front.png',
  22: 'succession/aptitude/pace.png',
  23: 'succession/aptitude/late.png',
  24: 'succession/aptitude/end.png',
  31: 'succession/aptitude/short.png',
  32: 'succession/aptitude/mile.png',
  33: 'succession/aptitude/middle.png',
  34: 'succession/aptitude/long.png',
};

const LINEAGE_ROUTES = [
  {
    id: 'mile-middle-dirt',
    name: '英中长泥',
    description: '英里、中距离、长距离与泥地 G1',
    g1Count: 23,
  },
  {
    id: 'short-mile-middle-dirt',
    name: '短英中泥',
    description: '短距离、英里、中距离与泥地 G1',
    g1Count: 22,
  },
  {
    id: 'none',
    name: '暂不规划',
    description: '不限制这匹已育成马娘的胜鞍赛程',
    g1Count: 0,
  },
] as const;

const successionUmaOptions = (
  successionData as {
    umas: Array<{ id: number; name: string; icon?: string | null }>;
  }
).umas;

type LineageTreeSlot = keyof OfflineFactorSelection['lineage']['tree'];

const LINEAGE_TREE_SLOT_LABELS: Record<LineageTreeSlot, string> = {
  parent: '另一侧父辈',
  ancestor_1: '祖辈 1',
  ancestor_2: '祖辈 2',
};

const INITIAL_LINEAGE_PARENT_LIMIT = 48;
const LINEAGE_PARENT_BATCH_SIZE = 60;

function SettingWithHelp({
  label, description, children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  return (
    <>
      <div className="flex items-center gap-1">
        {children}
        <button
          type="button"
          aria-label={`${label}说明`}
          aria-expanded={expanded}
          aria-controls={descriptionId}
          onClick={() => setExpanded((open) => !open)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-indigo-600"
        >
          <CircleAlert size={16} aria-hidden="true" />
        </button>
      </div>
      <p id={descriptionId} hidden={!expanded} className="mt-1 text-label text-slate-600">
        {description}
      </p>
    </>
  );
}

function OfflineCareerSettings({
  obtainableGroups = EMPTY_SKILL_GROUPS,
  factorOnly = false,
  customSchedule = false,
  setCustomSchedule,
  customScheduleContent,
  setup,
  selectedScenarioId,
  races,
  selectedDeckNum,
  setSelectedDeckNum,
  busy,
  prepare,
  saveDeck,
  factorSelection,
  setFactorSelection,
  parents,
  umas,
  skills,
}: Props) {
  const [factorSkillPickerOpen, setFactorSkillPickerOpen] = useState(false);
  const [draggedFactorTarget, setDraggedFactorTarget] = useState('');
  const [editingDeckNum, setEditingDeckNum] = useState(0);
  const [editingDeckName, setEditingDeckName] = useState('');
  const [editingRaceIds, setEditingRaceIds] = useState<number[]>([]);
  const [specificLineageSearch, setSpecificLineageSearch] = useState('');
  const [specificLineagePickerOpen, setSpecificLineagePickerOpen] =
    useState(false);
  const [specificLineageSource, setSpecificLineageSource] =
    useState<LineageSourceFilter>('all');
  const [specificLineageFactorFilters, setSpecificLineageFactorFilters] =
    useState<ParentFactorFilter[]>([]);
  const specificLineageBlueFactors = specificLineageFactorFilters
    .filter((item) => item.groupId <= 5)
    .map((item) => item.groupId);
  const specificLineageAptitudeFactors = specificLineageFactorFilters
    .filter((item) => item.groupId > 5)
    .map((item) => item.groupId);
  const [specificLineageSort, setSpecificLineageSort] =
    useState<LineageSort>('score');
  const [specificLineageSortDirection, setSpecificLineageSortDirection] =
    useState<LineageSortDirection>('desc');
  const [lineageTreeSearch, setLineageTreeSearch] = useState('');
  const [lineageTreePicker, setLineageTreePicker] = useState<
    'parent' | 'ancestor_1' | 'ancestor_2' | ''
  >('');
  const [lineageFactorPicker, setLineageFactorPicker] = useState<
    LineageTreeSlot | ''
  >('');
  const [lineageRoutePicker, setLineageRoutePicker] = useState<
    LineageTreeSlot | ''
  >('');
  const [lineageFactorDraft, setLineageFactorDraft] = useState({
    factor_group_id: 11,
    stars: 3,
  });
  const raceById = useMemo(
    () => new Map(races.map((race) => [race.id, race])),
    [races],
  );
  const requiredRaces = useMemo(
    () =>
      (setup?.required_race_array || [])
        .map((item) => ({
          ...item,
          id: raceKey(item.year, item.program_id),
          race: raceById.get(raceKey(item.year, item.program_id)),
        }))
        .sort((left, right) => {
          if (left.race && right.race)
            return compareRaces(left.race, right.race);
          return left.id - right.id;
        }),
    [raceById, setup?.required_race_array],
  );

  const deckOptions = useMemo(() => {
    const serverDecks = new Map(
      (setup?.race_decks || []).map((deck) => [deck.deck_num, deck]),
    );
    return Array.from({ length: 8 }, (_, index) => {
      const deckNum = index + 1;
      return (
        serverDecks.get(deckNum) || {
          deck_num: deckNum,
          deck_name: '',
          race_array: [],
        }
      );
    });
  }, [setup]);

  useEffect(() => {
    setEditingDeckNum(0);
    setEditingDeckName('');
    setEditingRaceIds([]);
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!setup || !editingDeckNum) return;
    const deck = setup.race_decks.find(
      (item) => item.deck_num === editingDeckNum,
    );
    if (!deck) return;
    setEditingDeckName(deck.deck_name || `我的参赛计划${deck.deck_num}`);
    setEditingRaceIds(
      deck.race_array.map((item) => raceKey(item.year, item.program_id)),
    );
  }, [editingDeckNum, setup]);

  useEffect(() => {
    if (!editingDeckNum) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setEditingDeckNum(0);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, editingDeckNum]);

  useEffect(() => {
    if (!lineageFactorPicker && !lineageRoutePicker) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setLineageFactorPicker('');
      setLineageRoutePicker('');
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [lineageFactorPicker, lineageRoutePicker]);

  const editDeck = async (deckNum: number) => {
    const availableSetup = setup || (await prepare());
    const deck = availableSetup?.race_decks.find(
      (item) => item.deck_num === deckNum,
    );
    if (!deck) return;
    setEditingDeckNum(deckNum);
    setEditingDeckName(deck.deck_name || `我的参赛计划${deckNum}`);
    setEditingRaceIds(
      deck.race_array.map((item) => raceKey(item.year, item.program_id)),
    );
  };

  const updateFactorSelection = (update: Partial<OfflineFactorSelection>) =>
    setFactorSelection((current) => ({ ...current, ...update }));
  const toggleTarget = (target: OfflineFactorTarget) => {
    setFactorSelection((current) => {
      const existing = current.targets.find(
        (item) => item.factor_group_id === target.factor_group_id,
      );
      if (existing && visibleTargetName(existing.name) !== visibleTargetName(target.name)) {
        return {
          ...current,
          targets: current.targets.map((item) =>
            item === existing ? { ...existing, name: target.name } : item,
          ),
        };
      }
      return {
        ...current,
        targets: existing
          ? current.targets.filter(
              (item) => item.factor_group_id !== target.factor_group_id,
            )
          : [...current.targets, target],
      };
    });
  };
  const reorderTarget = (sourceKey: string, targetKey: string) => {
    if (!sourceKey || sourceKey === targetKey) return;
    setFactorSelection((current) => {
      const sourceIndex = current.targets.findIndex(
        (target) => `${target.kind}:${target.factor_group_id}` === sourceKey,
      );
      const targetIndex = current.targets.findIndex(
        (target) => `${target.kind}:${target.factor_group_id}` === targetKey,
      );
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const targets = [...current.targets];
      const [moved] = targets.splice(sourceIndex, 1);
      targets.splice(targetIndex, 0, moved);
      // Move the item to the destination priority slot; keep tier boundaries in place.
      return { ...current, targets: targets.map((target, index) => ({
        ...target, priority: current.targets[index].priority,
      })) };
    });
  };
  const togglePriorityTie = (factorGroupId: number) => {
    setFactorSelection((current) => {
      const index = current.targets.findIndex((item) => item.factor_group_id === factorGroupId);
      if (index < 1) return current;
      const ranks = factorPriorityRanks(current.targets);
      const shift = ranks[index] === ranks[index - 1] ? 1 : -1;
      return { ...current, targets: current.targets.map((target, i) => ({
        ...target, priority: ranks[i] + (i >= index ? shift : 0),
      })) };
    });
  };
  const updateTargetWeight = (factorGroupId: number, weight: number) => {
    setFactorSelection((current) => ({
      ...current,
      targets: current.targets.map((target) =>
        target.factor_group_id === factorGroupId
          ? { ...target, weight: Math.max(0, weight) }
          : target,
      ),
    }));
  };
  const selectedSkillNames = factorSelection.targets
    .filter((target) => target.kind === 'skill')
    .map((target) => visibleTargetName(target.name));
  const skillByName = useMemo(
    () => new Map(skills.map((skill) => [skill.name, skill])),
    [skills],
  );
  const prioritySkills = useMemo(
    () => skills.filter(
      (skill) => skill.rarity === 2 ||
        (skill.rarity === 1 && !isInheritedUniqueSkill(skill) && !skill.name.endsWith('◎')),
    ),
    [skills],
  );
  const tiersByGroup = useMemo(() => {
    const groups = new Map<number, SkillTiers>();
    for (const skill of prioritySkills) {
      if (!skill.group_id) continue;
      const tiers = groups.get(skill.group_id) ?? {};
      tiers[skill.rarity === 2 ? 'gold' : 'white'] = skill.name;
      groups.set(skill.group_id, tiers);
    }
    return groups;
  }, [prioritySkills]);
  const deferredSpecificLineageSearch = useDeferredValue(specificLineageSearch);
  const normalizedSpecificLineageSearch = deferredSpecificLineageSearch
    .trim()
    .toLocaleLowerCase('zh-CN');
  const selectedLineageParent = useMemo(
    () =>
      parents.find(
        (parent) => parent.selection_id === factorSelection.lineage.selection_id,
      ),
    [factorSelection.lineage.selection_id, parents],
  );
  const selectedLineageParentRental = isRentalParent(selectedLineageParent);
  const [visibleLineageLimit, setVisibleLineageLimit] = useState(
    INITIAL_LINEAGE_PARENT_LIMIT,
  );
  useEffect(() => {
    if (specificLineagePickerOpen) {
      setVisibleLineageLimit(INITIAL_LINEAGE_PARENT_LIMIT);
    }
  }, [
    normalizedSpecificLineageSearch,
    specificLineageFactorFilters,
    specificLineagePickerOpen,
    specificLineageSort,
    specificLineageSortDirection,
    specificLineageSource,
  ]);
  const filteredLineageParents = useMemo(() => {
    if (!specificLineagePickerOpen) return [];
    return parents
      .filter((parent) => {
        if (
          parent.source === 'rental' &&
          parent.friend_state !== undefined &&
          ![1, 3].includes(parent.friend_state)
        ) {
          return false;
        }
        if (
          specificLineageSource !== 'all' &&
          parent.source !== specificLineageSource
        ) {
          return false;
        }
        if (!matchesParentFactorFilters(parent, specificLineageFactorFilters))
          return false;
        if (!normalizedSpecificLineageSearch) return true;
        return [
          parent.name,
          parent.owner_name,
          parent.viewer_id ? String(parent.viewer_id) : '',
          String(parent.rank_score),
          ...parent.factors.map((factor) => factor.name),
          ...parent.ancestors.flatMap((ancestor) => [
            ancestor.name,
            ...ancestor.factors.map((factor) => factor.name),
          ]),
        ].some((value) =>
          String(value)
            .toLocaleLowerCase('zh-CN')
            .includes(normalizedSpecificLineageSearch),
        );
      })
      .sort((left, right) => {
        const direction = specificLineageSortDirection === 'asc' ? 1 : -1;
        const sortValue = (parent: Dashboard['parents'][number]) => {
          if (specificLineageSort === 'blue') {
            return parentFactorStars(
              parent,
              'blue',
              specificLineageBlueFactors,
            );
          }
          if (specificLineageSort === 'aptitude') {
            return parentFactorStars(
              parent,
              'aptitude',
              specificLineageAptitudeFactors,
            );
          }
          return parent.rank_score;
        };
        return (
          (sortValue(left) - sortValue(right)) * direction ||
          (left.rank_score - right.rank_score) * direction ||
          (left.rank - right.rank) * direction
        );
      });
  }, [
    normalizedSpecificLineageSearch,
    parents,
    specificLineageAptitudeFactors,
    specificLineageBlueFactors,
    specificLineageFactorFilters,
    specificLineagePickerOpen,
    specificLineageSort,
    specificLineageSortDirection,
    specificLineageSource,
  ]);
  const visibleLineageParents = filteredLineageParents.slice(
    0,
    visibleLineageLimit,
  );
  const lineageLoadMoreRef = useScrollLoadMore({
    enabled: Boolean(
      specificLineagePickerOpen &&
        filteredLineageParents.length > visibleLineageLimit,
    ),
    onLoadMore: () =>
      setVisibleLineageLimit(
        (current) => current + LINEAGE_PARENT_BATCH_SIZE,
      ),
    itemCount: visibleLineageParents.length,
    resetKey: `${specificLineagePickerOpen}:${filteredLineageParents.length}`,
  });
  const specificLineageHasFilters = Boolean(
    specificLineageSource !== 'all' ||
      specificLineageFactorFilters.length ||
      specificLineageSort !== 'score' ||
      specificLineageSortDirection !== 'desc',
  );
  const emptyLineageParentMessage =
    normalizedSpecificLineageSearch || specificLineageHasFilters
      ? '没有找到符合当前搜索或筛选条件的已育成马娘'
      : '没有可选择的已育成马娘';
  const lineageCharaOptions = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...successionUmaOptions.map((uma) => ({
              chara_id: uma.id,
              card_id: 0,
              name: uma.name,
              rarity: 0,
              race_cloth_id: 0,
              icon: uma.icon || undefined,
            })),
            ...umas.map((uma) => ({
              chara_id: uma.chara_id,
              card_id: uma.id,
              name: uma.name,
              rarity: uma.rarity,
              race_cloth_id: uma.race_cloth_id,
              icon: undefined,
            })),
            ...parents.flatMap((parent) => [
              {
                chara_id: parent.chara_id,
                card_id: parent.card_id,
                name: parent.name,
                rarity: parent.rarity,
                race_cloth_id: parent.race_cloth_id,
                icon: undefined,
              },
              ...parent.ancestors.map((ancestor) => ({
                chara_id: ancestor.chara_id,
                card_id: ancestor.card_id,
                name: ancestor.name,
                rarity: ancestor.rarity,
                race_cloth_id: ancestor.race_cloth_id,
                icon: undefined,
              })),
            ]),
          ].map((uma) => [uma.chara_id, uma]),
        ).values(),
      ),
    [parents, umas],
  );
  const lineageCharaById = useMemo(
    () => new Map(lineageCharaOptions.map((option) => [option.chara_id, option])),
    [lineageCharaOptions],
  );
  const deferredLineageTreeSearch = useDeferredValue(lineageTreeSearch);
  const normalizedLineageTreeSearch = deferredLineageTreeSearch
    .trim()
    .toLocaleLowerCase('zh-CN');
  const filteredLineageCharaOptions = useMemo(() => {
    if (!lineageTreePicker) return [];
    return lineageCharaOptions.filter(
      (uma) =>
        !normalizedLineageTreeSearch ||
        uma.name
          .toLocaleLowerCase('zh-CN')
          .includes(normalizedLineageTreeSearch) ||
        String(uma.chara_id).includes(normalizedLineageTreeSearch),
    );
  }, [lineageCharaOptions, lineageTreePicker, normalizedLineageTreeSearch]);
  const updateLineageTreeSlot = (
    slot: LineageTreeSlot,
    update: Partial<OfflineFactorSelection['lineage']['tree'][LineageTreeSlot]>,
  ) =>
    setFactorSelection((current) => ({
      ...current,
      lineage: {
        ...current.lineage,
        tree: {
          ...current.lineage.tree,
          [slot]: { ...current.lineage.tree[slot], ...update },
        },
      },
    }));
  const lineageTreeNode = (
    slot: LineageTreeSlot,
    label: string,
    tone: 'parent' | 'ancestor',
  ) => {
    const setting = factorSelection.lineage.tree[slot];
    const uma = lineageCharaById.get(setting.chara_id);
    const iconPath = uma
      ? umaSkinIconPath(uma.card_id, uma.rarity, uma.race_cloth_id) || uma.icon
      : undefined;
    const redFactor = APTITUDE_FACTORS.find(
      (factor) => factor.factor_group_id === setting.red_factor_group_id,
    );
    const route =
      LINEAGE_ROUTES.find((item) => item.id === setting.route_id) ||
      LINEAGE_ROUTES[2];
    return (
      <div
        className={`rounded-xl border p-3 shadow-sm ${
          tone === 'parent'
            ? 'border-sky-200 bg-sky-50/70'
            : 'border-rose-200 bg-rose-50/70'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <strong
            className={`text-data ${
              tone === 'parent' ? 'text-sky-950' : 'text-rose-950'
            }`}
          >
            {label}
          </strong>
          {setting.chara_id ? (
            <button
              type="button"
              onClick={() => updateLineageTreeSlot(slot, { chara_id: 0 })}
              className="text-label text-slate-500 hover:text-red-600"
            >
              清除
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setLineageTreeSearch('');
            setLineageTreePicker(slot);
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/80 bg-white p-2 text-left hover:border-indigo-200"
        >
          <span className="flex h-14 w-14 flex-none items-center justify-center text-2xl text-slate-300">
            {iconPath && uma ? (
              <AssetIcon
                path={iconPath}
                alt={uma.name}
                className="h-full w-full object-contain"
              />
            ) : (
              '+'
            )}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-data text-slate-800">
              {uma?.name || '不固定马娘类型'}
            </strong>
          </span>
        </button>
        {uma ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-label={`设置${label}的红因子`}
              onClick={() => {
                setLineageFactorDraft({
                  factor_group_id: setting.red_factor_group_id || 11,
                  stars: setting.red_factor_stars || 3,
                });
                setLineageFactorPicker(slot);
              }}
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                redFactor
                  ? 'border-rose-200 bg-rose-50 hover:border-rose-300'
                  : 'border-slate-200 bg-white hover:border-rose-200'
              }`}
            >
              <span className="flex items-center gap-1 text-caption font-medium text-slate-500">
                <Star size={12} /> 红因子
              </span>
              {redFactor ? (
                <strong className="mt-1 flex items-center gap-1.5 text-data text-rose-800">
                  <AssetIcon
                    path={RED_FACTOR_ICON_PATHS[redFactor.factor_group_id]}
                    alt={`${redFactor.name}因子`}
                    className="h-5 w-5 object-contain"
                  />
                  <span className="truncate">{redFactor.name}</span>
                  <b className="ml-auto flex-none">
                    {setting.red_factor_stars}★
                  </b>
                </strong>
              ) : (
                <strong className="mt-1 block text-data text-slate-500">
                  点击设置
                </strong>
              )}
            </button>
            <button
              type="button"
              aria-label={`设置${label}的赛程`}
              onClick={() => setLineageRoutePicker(slot)}
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                route.id !== 'none'
                  ? 'border-sky-200 bg-sky-50 hover:border-sky-300'
                  : 'border-slate-200 bg-white hover:border-sky-200'
              }`}
            >
              <span className="flex items-center gap-1 text-caption font-medium text-slate-500">
                <CalendarDays size={12} /> 育成赛程
              </span>
              <strong
                className={`mt-1 block truncate text-data ${
                  route.id !== 'none' ? 'text-sky-800' : 'text-slate-500'
                }`}
              >
                {route.name}
              </strong>
              <span className="mt-0.5 block text-caption text-slate-500">
                {route.g1Count ? `${route.g1Count} 场 G1` : '不限制胜鞍'}
              </span>
            </button>
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white/60 px-2 py-2 text-center text-label text-slate-500">
            选择马娘后设置红因子与赛程
          </p>
        )}
      </div>
    );
  };

  const filteringFactors = usesOfflineFactorTargets(factorSelection);
  const priorityRanks = factorPriorityRanks(factorSelection.targets);
  const ancestorMode = factorSelection.evaluation_mode === 'ancestor';
  const targetTitle = ancestorMode ? '适应性与技能因子权重' : '适应性与技能优先级';
  const targetDescription = [
    filteringFactors && (ancestorMode
      ? '按两次继承的期望跳数加权累加。'
      : '优先比较目标因子至少继承一次的概率，白因子兜底。'),
    !factorOnly && (ancestorMode
      ? '事件启发和结束点技能按技能权重从高到低，同权重按列表顺序。'
      : '事件启发和结束点技能按优先级分组，同级技能并列。'),
    !factorOnly && '结束时优先学同组金技能或双圈，满足条件的技能会自动进化。',
  ].filter(Boolean).join('');
  const targetEditor = (
    <div className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SettingWithHelp key={targetTitle} label={targetTitle} description={targetDescription}>
            <strong className="text-data text-slate-800">{targetTitle}</strong>
          </SettingWithHelp>
        </div>
        <button
          type="button"
          onClick={() => setFactorSkillPickerOpen(true)}
          className="flex flex-none items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-caption font-semibold text-white hover:bg-indigo-700"
        >
          <Plus size={14} /> 添加技能
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {APTITUDE_FACTORS.map((target) => {
          const selected = factorSelection.targets.some(
            (item) => item.factor_group_id === target.factor_group_id,
          );
          return (
            <button
              key={target.factor_group_id}
              type="button"
              onClick={() => toggleTarget(target)}
              className={`rounded-full border px-2.5 py-1 text-caption ${
                selected
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {target.name}
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        {factorSelection.targets.map((target, index) => {
          const targetKey = `${target.kind}:${target.factor_group_id}`;
          const skill = target.kind === 'skill'
            ? skillByName.get(visibleTargetName(target.name)) ?? skillByName.get(target.name)
            : undefined;
          const iconPath =
            target.kind === 'aptitude'
              ? RED_FACTOR_ICON_PATHS[target.factor_group_id]
              : skillIconPath(skill);
          const draggable = factorSelection.evaluation_mode === 'parent';
          const tied = index > 0 && priorityRanks[index] === priorityRanks[index - 1];
          return (
            <div
              key={targetKey}
              draggable={draggable}
              onDragStart={(event) => {
                if (!draggable) return;
                setDraggedFactorTarget(targetKey);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData(
                  'text/plain',
                  `factor-target:${targetKey}`,
                );
              }}
              onDragOver={(event) => {
                if (!draggable) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                if (!draggable) return;
                event.preventDefault();
                const transferredKey = event.dataTransfer
                  .getData('text/plain')
                  .replace('factor-target:', '');
                reorderTarget(transferredKey || draggedFactorTarget, targetKey);
                setDraggedFactorTarget('');
              }}
              onDragEnd={() => setDraggedFactorTarget('')}
              className={`plannerUiTheme flex min-w-0 flex-wrap content-start items-start gap-2 rounded-lg border bg-white px-2.5 py-2 shadow-sm ${
                draggable ? 'cursor-grab active:cursor-grabbing' : ''
              } ${
                draggedFactorTarget === targetKey
                  ? 'border-indigo-300 opacity-45'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-[11px]">
                <PlannerSkillCardContent
                  iconPath={iconPath}
                  name={skill
                    ? <PrioritySkillName skill={skill} tiers={tiersByGroup.get(skill.group_id)} />
                    : target.name}
                  meta={
                    skill ? <SkillMetadata skill={skill} /> : target.kind === 'aptitude' && '适应性因子'
                  }
                  description={
                    target.kind === 'skill' ? skill?.description || '暂无技能说明' : undefined
                  }
                />
              </div>
              <div className="ml-auto flex flex-none items-center gap-1">
                <b className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-caption text-slate-600">
                  {draggable ? priorityRanks[index] : index + 1}
                </b>
                {factorSelection.evaluation_mode === 'ancestor' ? (
                  <label className="flex flex-none flex-col text-label text-slate-500">
                    权重
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={target.weight}
                      onChange={(event) =>
                        updateTargetWeight(
                          target.factor_group_id,
                          Number(event.target.value),
                        )
                      }
                      className="mt-0.5 w-16 rounded border border-slate-200 px-1.5 py-1 text-caption text-slate-700"
                    />
                  </label>
                ) : (
                  <>
                    {index > 0 && (
                      <button
                        type="button"
                        aria-label={`${target.name}与上一项并列`}
                        aria-pressed={tied}
                        title={tied ? '取消与上一项并列' : '与上一项并列'}
                        onClick={() => togglePriorityTie(target.factor_group_id)}
                        className="h-8 rounded-md border border-slate-200 px-2 text-caption text-slate-600 hover:border-indigo-300 aria-pressed:border-indigo-300 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700"
                      >
                        并列
                      </button>
                    )}
                    <ReorderControls
                      label={`因子：${target.name}`}
                      index={index}
                      count={factorSelection.targets.length}
                      onMove={(targetIndex) => {
                        const destination = factorSelection.targets[targetIndex];
                        reorderTarget(
                          targetKey,
                          `${destination.kind}:${destination.factor_group_id}`,
                        );
                      }}
                    />
                    <GripVertical
                      size={17}
                      className="flex-none text-slate-300"
                      aria-label="拖动调整顺序"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => toggleTarget(target)}
                  title="移除"
                  className="flex-none rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {!factorSelection.targets.length ? (
          <button
            type="button"
            onClick={() => setFactorSkillPickerOpen(true)}
            className="col-span-full flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-label text-slate-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Plus size={15} className="mr-1" />
            选择适应性或添加技能
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="autoResearchForm contents">
      <section
        id="career-factor-options"
        className="order-2 mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
              {factorOnly ? 3 : 5}
            </span>
            <h3 className="text-section font-semibold text-gray-800">
              免费因子重抽与筛选
            </h3>
          </div>
          <Toggle
            label="免费因子重抽与筛选"
            disabled={factorSelection.transfer_mode === 'direct'}
            checked={filteringFactors}
            onChange={(enabled) => updateFactorSelection({ enabled })}
          />
        </div>

        {filteringFactors && (
          <div className="mt-4 autoResearchAdaptiveColumns grid items-start gap-x-6 gap-y-5">
            <div className="max-w-2xl">
              <strong className="text-data text-slate-800">使用场景</strong>
              <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
                {(
                  [
                    [
                      'parent',
                      '父辈模式',
                      '可以设置另一侧完整父辈，根据最终继承概率比较。',
                    ],
                    [
                      'ancestor',
                      '祖辈模式',
                      '只按自身因子继承概率进行加权计算。',
                    ],
                  ] as const
                ).map(([mode, label, description]) => (
                  <div
                    key={mode}
                    className={`rounded-lg border pr-1 transition [&>p]:px-3 [&>p]:pb-2 ${
                      factorSelection.evaluation_mode === mode
                        ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <SettingWithHelp label={label} description={description}>
                      <button
                        type="button"
                        aria-pressed={factorSelection.evaluation_mode === mode}
                        onClick={() => updateFactorSelection({ evaluation_mode: mode })}
                        className="flex-1 rounded-md px-3 py-2 text-left text-data font-semibold text-slate-800"
                      >
                        {label}
                      </button>
                    </SettingWithHelp>
                  </div>
                ))}
              </div>
            </div>

            <fieldset className="min-w-0">
              <legend className="text-data font-semibold text-slate-800">
                属性因子最低星数
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BLUE_FACTORS.map(([key, label]) => {
                  const stars = factorSelection.blue_factor_minimums[key];
                  return (
                    <label
                      key={key}
                      className={`relative inline-flex min-h-11 items-center gap-1 rounded-md border px-2.5 text-caption font-medium focus-within:ring-2 focus-within:ring-indigo-500 sm:min-h-8 ${
                        stars === undefined
                          ? 'border-slate-200 bg-white text-slate-600'
                          : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      }`}
                    >
                      {label}
                      <span>{stars === undefined ? '不限' : stars ? `${stars}★` : '不要'}</span>
                      <ChevronDown size={12} aria-hidden="true" />
                      <select
                        aria-label={`${label}因子最低星数`}
                        value={stars ?? ''}
                        onChange={(event) => {
                          const { value } = event.target;
                          const minimums = {
                            ...factorSelection.blue_factor_minimums,
                          };
                          if (value === '') delete minimums[key];
                          else minimums[key] = Number(value);
                          updateFactorSelection({
                            blue_factor_minimums: minimums,
                          });
                        }}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      >
                        <option value="">不限</option>
                        {stars === 0 && <option value={0}>不要</option>}
                        {[1, 2, 3].map((minimum) => (
                          <option key={minimum} value={minimum}>
                            至少 {minimum} 星
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {targetEditor}

            {factorSelection.evaluation_mode === 'parent' ? (
              <div className="max-w-5xl lg:col-span-2">
                <strong className="text-data text-slate-800">
                  兄弟辈 / 另一侧谱系
                </strong>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ['none', '不设置', '不限制另一侧谱系'],
                      ['specific', '指定已有马娘', '直接选择一组完整谱系'],
                      ['rules', '按谱系条件', '设置任意马娘、红因子与赛程'],
                    ] as const
                  ).map(([mode, label, description]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={factorSelection.lineage.mode === mode}
                      onClick={() =>
                        updateFactorSelection({
                          lineage: { ...factorSelection.lineage, mode },
                        })
                      }
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        factorSelection.lineage.mode === mode
                          ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <strong className="block text-data text-slate-800">
                        {label}
                      </strong>
                      <span className="mt-0.5 block text-caption text-slate-500">
                        {description}
                      </span>
                    </button>
                  ))}
                </div>

                {factorSelection.lineage.mode === 'specific' ? (
                  <div className="mt-3 max-w-xl">
                    {selectedLineageParent ? (
                      <ParentChoiceCard
                        parent={selectedLineageParent}
                        selected
                        viewOnly
                        disabled={false}
                        onSelect={() => setSpecificLineagePickerOpen(true)}
                        heading={
                          <>
                            {selectedLineageParent.name}
                            <small className="mt-1 flex flex-wrap items-center gap-1 text-gray-500">
                              {selectedLineageParentRental && <RentalParentBadge />}
                              {selectedLineageParentRental
                                ? selectedLineageParent.owner_name || '未知玩家'
                                : '自己的马娘'}
                              {selectedLineageParent.rank_score
                                ? ` · 评分 ${selectedLineageParent.rank_score}`
                                : ''}
                            </small>
                          </>
                        }
                        headingActions={
                          <>
                            <PlannerButton
                              size="small"
                              variant="ghost"
                              aria-label="清除指定已有马娘"
                              onClick={() =>
                                updateFactorSelection({
                                  lineage: {
                                    ...factorSelection.lineage,
                                    selection_id: '',
                                  },
                                })
                              }
                            >
                              清除
                            </PlannerButton>
                            <PlannerButton
                              size="small"
                              aria-label="更换指定已有马娘"
                              onClick={() => setSpecificLineagePickerOpen(true)}
                            >
                              更换
                            </PlannerButton>
                          </>
                        }
                      />
                    ) : (
                      <SuccessionPickerTrigger
                        label="指定已有马娘"
                        selected={false}
                        placeholder="点击选择已有马娘"
                        onOpen={() => setSpecificLineagePickerOpen(true)}
                      />
                    )}
                    {!selectedLineageParent &&
                    factorSelection.lineage.selection_id ? (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-label text-amber-800">
                        已保存的马娘当前不在自己或好友列表中，请重新选择。
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {factorSelection.lineage.mode === 'rules' ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mx-auto max-w-4xl">
                      <div className="mx-auto max-w-md">
                        {lineageTreeNode('parent', '另一侧父辈', 'parent')}
                      </div>
                      <div className="relative pt-4 sm:pt-7">
                        <span className="pointer-events-none absolute left-1/4 right-1/4 top-0 hidden h-7 border-l-2 border-r-2 border-t-2 border-slate-200 sm:block" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {lineageTreeNode('ancestor_1', '祖辈 1', 'ancestor')}
                          {lineageTreeNode('ancestor_2', '祖辈 2', 'ancestor')}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section
        id="offline-career-setup"
        className={`${factorOnly ? 'hidden' : 'order-1 mt-5'} scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4`}
      >
        <header className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
              4
            </span>
            <h3 className="text-section font-semibold text-gray-800">赛程设置</h3>
          </div>
          {setCustomSchedule && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-label">
              <span
                className={
                  customSchedule
                    ? 'font-semibold text-indigo-700'
                    : 'text-slate-500'
                }
              >
                本地
              </span>
              <Toggle
                label="游戏内"
                checked={!customSchedule}
                disabled={Boolean(busy)}
                onChange={(useGamePreset) => setCustomSchedule(!useGamePreset)}
              />
              <span className={customSchedule ? 'text-slate-500' : 'font-semibold text-indigo-700'}>
                游戏内
              </span>
            </div>
          )}
        </header>
        {customSchedule && <div className="mt-3">{customScheduleContent}</div>}
        {!customSchedule && (
          <div className="mt-4 max-w-7xl">
            <div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {deckOptions.map((deck) => {
                  const selected = selectedDeckNum === deck.deck_num;
                  return (
                    <article
                      key={deck.deck_num}
                      className={`flex min-h-16 min-w-0 items-center gap-2 rounded-lg border bg-white p-2.5 text-data transition ${
                        selected
                          ? 'border-indigo-400 ring-2 ring-indigo-100'
                          : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedDeckNum(deck.deck_num)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-slate-700"
                      >
                        <span
                          className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                            selected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 text-transparent'
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate">
                            槽位 {deck.deck_num} ·{' '}
                            {setup ? deck.deck_name || '空槽位' : '待读取'}
                          </strong>
                          <span className="text-caption text-slate-500">
                            {busy === 'idle-prepare'
                              ? '读取中…'
                              : setup
                                ? `${deck.race_array.length} 场比赛`
                                : '暂无数据'}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => editDeck(deck.deck_num)}
                        disabled={Boolean(busy)}
                        className="flex flex-none items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-caption font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
                      >
                        <Pencil size={12} /> 编辑
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {!factorOnly && editingDeckNum ? (
        <div className="successionPickerTheme successionPickerOverlay plannerElevatedOverlay">
          <button
            type="button"
            aria-label="关闭赛程槽位编辑"
            onClick={() => setEditingDeckNum(0)}
            disabled={Boolean(busy)}
            className="absolute inset-0 bg-transparent disabled:cursor-wait"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`编辑游戏赛程槽位 ${editingDeckNum}`}
            className="successionPickerDialog relative max-h-[92vh] w-full max-w-6xl"
          >
            <header className="successionPickerHeader flex-wrap items-end">
              <label className="min-w-0 flex-1 text-label text-slate-700">
                <strong className="block text-section text-slate-900">
                  编辑游戏赛程槽位 {editingDeckNum}
                </strong>
                <input
                  value={editingDeckName}
                  maxLength={20}
                  disabled={Boolean(busy)}
                  onChange={(event) => setEditingDeckName(event.target.value)}
                  placeholder={`我的参赛计划${editingDeckNum}`}
                  className="mt-3 w-full rounded-md border border-slate-200 px-3 py-2 disabled:bg-slate-50"
                />
              </label>
              <button
                type="button"
                aria-label="关闭赛程槽位编辑"
                onClick={() => setEditingDeckNum(0)}
                disabled={Boolean(busy)}
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <RaceSchedulePicker
                id={`offline-races-${editingDeckNum}`}
                races={races}
                selectedRaceIds={editingRaceIds}
                setSelectedRaceIds={setEditingRaceIds}
              />

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-data font-medium text-amber-950">
                  必跑比赛（自动加入）
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {requiredRaces.length ? (
                    requiredRaces.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-caption text-amber-800"
                      >
                        <Check size={12} />{' '}
                        {item.race
                          ? `${item.race.date} · ${item.race.name}`
                          : `第 ${item.year} 年 · 未知比赛`}
                      </span>
                    ))
                  ) : (
                    <span className="text-caption text-amber-700/60">
                      暂无固定比赛
                    </span>
                  )}
                </div>
              </div>
            </div>

            <footer className="successionPickerFooter flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDeckNum(0)}
                disabled={Boolean(busy)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-data text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                取消
              </button>
              <span role="status" className="ml-auto whitespace-nowrap text-data text-slate-500">
                已选择 {editingRaceIds.length} 场
              </span>
              <button
                type="button"
                onClick={async () => {
                  const saved = await saveDeck(
                    editingDeckNum,
                    editingDeckName,
                    editingRaceIds,
                  );
                  if (saved) setEditingDeckNum(0);
                }}
                disabled={Boolean(busy)}
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-data font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={15} />
                {busy === 'idle-race-deck'
                  ? '保存中…'
                  : `保存槽位 ${editingDeckNum}`}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {lineageFactorPicker ? (
        <div className="successionPickerTheme successionPickerOverlay plannerElevatedOverlay">
          <button
            type="button"
            aria-label="关闭红因子设置"
            onClick={() => setLineageFactorPicker('')}
            className="absolute inset-0 bg-transparent"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`设置${LINEAGE_TREE_SLOT_LABELS[lineageFactorPicker]}的红因子`}
            className="successionPickerDialog relative w-full max-w-2xl"
          >
            <header className="successionPickerHeader">
              <div>
                <h3 className="text-section font-semibold text-slate-900">
                  {LINEAGE_TREE_SLOT_LABELS[lineageFactorPicker]}的红因子
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭红因子设置"
                onClick={() => setLineageFactorPicker('')}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </header>
            <div className="space-y-5 p-5">
              <section>
                <strong className="text-data text-slate-800">因子属性</strong>
                <div className="mt-2 space-y-3">
                  {RED_FACTOR_GROUPS.map((group) => (
                    <div key={group.label}>
                      <span className="text-caption font-medium text-slate-500">
                        {group.label}
                      </span>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {group.factors.map((factor) => {
                          const selected =
                            lineageFactorDraft.factor_group_id ===
                            factor.factor_group_id;
                          return (
                            <button
                              key={factor.factor_group_id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setLineageFactorDraft((current) => ({
                                  ...current,
                                  factor_group_id: factor.factor_group_id,
                                }))
                              }
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                                selected
                                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-100'
                                  : 'border-slate-200 bg-white hover:border-rose-200'
                              }`}
                            >
                              <AssetIcon
                                path={
                                  RED_FACTOR_ICON_PATHS[factor.factor_group_id]
                                }
                                alt={`${factor.name}因子`}
                                className="h-7 w-7 flex-none object-contain"
                              />
                              <strong className="truncate text-data text-slate-800">
                                {factor.name}
                              </strong>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <strong className="text-data text-slate-800">因子星级</strong>
                <div
                  role="radiogroup"
                  aria-label="红因子最低星级"
                  className="mt-2 grid grid-cols-3 gap-2"
                >
                  {[1, 2, 3].map((stars) => (
                    <button
                      key={stars}
                      type="button"
                      role="radio"
                      aria-checked={lineageFactorDraft.stars === stars}
                      onClick={() =>
                        setLineageFactorDraft((current) => ({
                          ...current,
                          stars,
                        }))
                      }
                      className={`rounded-xl border px-3 py-2.5 text-data font-semibold transition ${
                        lineageFactorDraft.stars === stars
                          ? 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-100'
                          : 'border-slate-200 text-slate-600 hover:border-rose-200'
                      }`}
                    >
                      {stars}★
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <footer className="successionPickerFooter flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-data text-slate-600">
                <AssetIcon
                  path={
                    RED_FACTOR_ICON_PATHS[lineageFactorDraft.factor_group_id]
                  }
                  alt="当前红因子"
                  className="h-6 w-6 object-contain"
                />
                当前：
                {
                  APTITUDE_FACTORS.find(
                    (factor) =>
                      factor.factor_group_id ===
                      lineageFactorDraft.factor_group_id,
                  )?.name
                }{' '}
                {lineageFactorDraft.stars}★
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLineageFactorPicker('')}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-data font-medium text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateLineageTreeSlot(lineageFactorPicker, {
                      red_factor_group_id: lineageFactorDraft.factor_group_id,
                      red_factor_stars: lineageFactorDraft.stars,
                      min_factor_stars: 0,
                    });
                    setLineageFactorPicker('');
                  }}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-data font-semibold text-white hover:bg-rose-700"
                >
                  保存
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {lineageRoutePicker ? (
        <div className="successionPickerTheme successionPickerOverlay plannerElevatedOverlay">
          <button
            type="button"
            aria-label="关闭赛程设置"
            onClick={() => setLineageRoutePicker('')}
            className="absolute inset-0 bg-transparent"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`设置${LINEAGE_TREE_SLOT_LABELS[lineageRoutePicker]}的赛程`}
            className="successionPickerDialog relative w-full max-w-2xl"
          >
            <header className="successionPickerHeader">
              <div>
                <h3 className="text-section font-semibold text-slate-900">
                  {LINEAGE_TREE_SLOT_LABELS[lineageRoutePicker]}赛程设置
                </h3>
              </div>
              <button
                type="button"
                aria-label="关闭赛程设置"
                onClick={() => setLineageRoutePicker('')}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </header>
            <div
              role="radiogroup"
              aria-label="育成赛程"
              className="grid gap-3 p-5 sm:grid-cols-3"
            >
              {LINEAGE_ROUTES.map((route) => {
                const selected =
                  factorSelection.lineage.tree[lineageRoutePicker].route_id ===
                  route.id;
                return (
                  <button
                    key={route.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      updateLineageTreeSlot(lineageRoutePicker, {
                        route_id: route.id,
                        min_factor_stars: 0,
                      })
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-100'
                        : 'border-slate-200 bg-white hover:border-sky-200'
                    }`}
                  >
                    <CalendarDays
                      size={22}
                      className={selected ? 'text-sky-600' : 'text-slate-400'}
                    />
                    <strong className="mt-3 block text-data text-slate-900">
                      {route.name}
                    </strong>
                    <span className="mt-1 block text-caption leading-5 text-slate-500">
                      {route.description}
                    </span>
                    <b className="mt-2 block text-caption text-sky-700">
                      {route.g1Count ? `${route.g1Count} 场 G1` : '不限制胜鞍'}
                    </b>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {specificLineagePickerOpen ? (
        <SuccessionPickerDialog
          ariaLabel="指定已有马娘"
          title="正在选择已有马娘"
          onClose={() => setSpecificLineagePickerOpen(false)}
          dialogClassName="successionCapturedPickerDialog"
          searchValue={specificLineageSearch}
          searchPlaceholder="搜索马娘、因子、玩家或玩家 ID"
          searchAriaLabel="搜索已有马娘"
          onSearchChange={setSpecificLineageSearch}
          meta={<span>找到 {filteredLineageParents.length} 个已有实例</span>}
        >
          <SuccessionPickerFilterSheet
            title="筛选已有马娘"
            summary={specificLineageHasFilters ? '已启用筛选' : '全部已有马娘'}
            onClear={() => {
              setSpecificLineageSource('all');
              setSpecificLineageFactorFilters([]);
              setSpecificLineageSort('score');
              setSpecificLineageSortDirection('desc');
            }}
          >
            <div className="successionCapturedPickerFilters border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
                <span className="mr-1 text-caption font-semibold text-slate-700">
                  来源
                </span>
                {(
                  [
                    ['all', '全部'],
                    ['own', '自己的'],
                    ['rental', '玩家借用'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={specificLineageSource === value}
                    onClick={() => setSpecificLineageSource(value)}
                    className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${specificLineageSource === value ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ParentFactorFilters
                filters={specificLineageFactorFilters}
                setFilters={setSpecificLineageFactorFilters}
              />

              <section className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="mr-1 text-caption text-slate-700">
                    排序
                  </strong>
                  {(
                    [
                      ['score', '养成评价'],
                      ['blue', '属性星级'],
                      ['aptitude', '适应性星级'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={specificLineageSort === value}
                      onClick={() => setSpecificLineageSort(value)}
                      className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${
                        specificLineageSort === value
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      ['desc', '倒序'],
                      ['asc', '正序'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={specificLineageSortDirection === value}
                      onClick={() => setSpecificLineageSortDirection(value)}
                      className={`successionCapturedPickerCompactControl rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
                        specificLineageSortDirection === value
                          ? 'bg-white text-indigo-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </SuccessionPickerFilterSheet>
          {filteredLineageParents.length ? (
            <>
              <div className="successionCapturedPickerGrid">
                {visibleLineageParents.map((parent) => (
                  <ParentChoiceCard
                    key={parent.selection_id}
                    parent={parent}
                    selected={
                      factorSelection.lineage.selection_id ===
                      parent.selection_id
                    }
                    disabled={false}
                    onSelect={() => {
                      updateFactorSelection({
                        lineage: {
                          ...factorSelection.lineage,
                          selection_id: parent.selection_id,
                        },
                      });
                      setSpecificLineagePickerOpen(false);
                    }}
                  />
                ))}
                {filteredLineageParents.length > visibleLineageLimit ? (
                  <div
                    ref={lineageLoadMoreRef}
                    className="col-span-full h-4"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="successionCapturedPickerEmpty">
              {emptyLineageParentMessage}
            </div>
          )}
        </SuccessionPickerDialog>
      ) : null}

      {lineageTreePicker ? (
        <SuccessionPickerDialog
          ariaLabel="选择谱系树马娘"
          title={`正在选择${LINEAGE_TREE_SLOT_LABELS[lineageTreePicker]}`}
          onClose={() => setLineageTreePicker('')}
          overlayClassName="plannerElevatedOverlay"
          searchValue={lineageTreeSearch}
          searchPlaceholder="搜索马娘名称"
          searchAriaLabel="搜索谱系树马娘"
          onSearchChange={setLineageTreeSearch}
          meta={
            <>
              <span>找到 {filteredLineageCharaOptions.length} 位马娘</span>
              <button
                type="button"
                onClick={() => {
                  updateLineageTreeSlot(lineageTreePicker, { chara_id: 0 });
                  setLineageTreePicker('');
                }}
              >
                设为不固定
              </button>
            </>
          }
          bodyClassName="successionPickerGrid"
        >
          {filteredLineageCharaOptions.length ? (
            filteredLineageCharaOptions.map((uma) => {
              const selected =
                factorSelection.lineage.tree[lineageTreePicker].chara_id ===
                uma.chara_id;
              const occupied = (
                Object.keys(factorSelection.lineage.tree) as LineageTreeSlot[]
              ).some(
                (slot) =>
                  slot !== lineageTreePicker &&
                  factorSelection.lineage.tree[slot].chara_id === uma.chara_id,
              );
              const iconPath =
                umaSkinIconPath(uma.card_id, uma.rarity, uma.race_cloth_id) ||
                uma.icon;
              return (
                <PlannerSelectionCard
                  key={uma.chara_id}
                  selected={selected}
                  occupied={occupied}
                  portrait={
                    <PlannerPortrait
                      path={iconPath}
                      alt={uma.name}
                      size="large"
                    />
                  }
                  title={uma.name}
                  onClick={() => {
                    const current =
                      factorSelection.lineage.tree[lineageTreePicker];
                    updateLineageTreeSlot(lineageTreePicker, {
                      chara_id: uma.chara_id,
                      red_factor_group_id: current.red_factor_group_id || 11,
                      red_factor_stars: current.red_factor_stars || 3,
                      route_id: current.route_id || 'none',
                      min_factor_stars: 0,
                    });
                    setLineageTreePicker('');
                  }}
                />
              );
            })
          ) : (
            <div className="successionPickerEmpty">
              <strong>没有找到符合搜索条件的马娘</strong>
              <p>尝试修改搜索词，或清空搜索。</p>
              <PlannerButton
                variant="secondary"
                size="small"
                onClick={() => setLineageTreeSearch('')}
              >
                清空搜索
              </PlannerButton>
            </div>
          )}
        </SuccessionPickerDialog>
      ) : null}

      <SkillSelector
        open={filteringFactors && factorSkillPickerOpen}
        title="选择目标技能"
        skills={prioritySkills}
        tiersByGroup={tiersByGroup}
        obtainableGroups={factorOnly ? undefined : obtainableGroups}
        showKindFilter={false}
        selectedNames={selectedSkillNames}
        showRarityFilter={false}
        showSkillPoints={false}
        elevated
        onToggle={(skill) =>
          toggleTarget({
            factor_group_id: skill.group_id || Math.floor(skill.id / 10),
            name: skill.name,
            kind: 'skill',
            weight: 1,
          })
        }
        onClose={() => setFactorSkillPickerOpen(false)}
      />
    </div>
  );
}

export default memo(OfflineCareerSettings);
