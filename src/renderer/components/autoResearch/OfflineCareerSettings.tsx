/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Search,
  Star,
  X,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  SuccessionPickerDialog,
  SuccessionPickerTrigger,
} from 'renderer/components/succession/SuccessionPicker';
import { compareRaces } from './shared';
import SkillSelector, {
  AutoResearchSkill,
  skillIconPath,
} from './SkillSelector';
import { horseIconPath, ParentChoiceCard } from './SelectionCards';
import {
  Dashboard,
  OfflineFactorSelection,
  OfflineFactorTarget,
  OfflineSkillSettings,
  OfflineSingleModeSetup,
  RaceOption,
} from './types';
import RaceSchedulePicker from './RaceSchedulePicker';

type Props = {
  setup: OfflineSingleModeSetup | null;
  scenarios: Dashboard['offline_scenarios'];
  selectedScenarioId: number;
  onScenarioChange: (scenarioId: number) => void;
  races: RaceOption[];
  selectedDeckNum: number;
  setSelectedDeckNum: Dispatch<SetStateAction<number>>;
  challengeMode: boolean;
  setChallengeMode: Dispatch<SetStateAction<boolean>>;
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
  skillSettings: OfflineSkillSettings;
  setSkillSettings: Dispatch<SetStateAction<OfflineSkillSettings>>;
};

const raceKey = (year: number, programId: number) => year * 100000 + programId;

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

type LineageTreeSlot = keyof OfflineFactorSelection['lineage']['tree'];

const LINEAGE_TREE_SLOT_LABELS: Record<LineageTreeSlot, string> = {
  parent: '另一侧父辈',
  ancestor_1: '祖辈 1',
  ancestor_2: '祖辈 2',
};

export default function OfflineCareerSettings({
  setup,
  scenarios,
  selectedScenarioId,
  onScenarioChange,
  races,
  selectedDeckNum,
  setSelectedDeckNum,
  challengeMode,
  setChallengeMode,
  busy,
  prepare,
  saveDeck,
  factorSelection,
  setFactorSelection,
  parents,
  umas,
  skills,
  skillSettings,
  setSkillSettings,
}: Props) {
  const [factorSkillPickerOpen, setFactorSkillPickerOpen] = useState(false);
  const [finalSkillPickerOpen, setFinalSkillPickerOpen] = useState(false);
  const [draggedFactorTarget, setDraggedFactorTarget] = useState('');
  const [draggedFinalSkillIndex, setDraggedFinalSkillIndex] = useState<
    number | null
  >(null);
  const [editingDeckNum, setEditingDeckNum] = useState(0);
  const [editingDeckName, setEditingDeckName] = useState('');
  const [editingRaceIds, setEditingRaceIds] = useState<number[]>([]);
  const [specificLineageSearch, setSpecificLineageSearch] = useState('');
  const [specificLineagePickerOpen, setSpecificLineagePickerOpen] =
    useState(false);
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
      const exists = current.targets.some(
        (item) => item.factor_group_id === target.factor_group_id,
      );
      return {
        ...current,
        targets: exists
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
      return { ...current, targets };
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
    .map((target) => target.name);
  const selectedFinalSkillNames = skillSettings.learn_skill_list.flat();
  const skillByName = useMemo(
    () => new Map(skills.map((skill) => [skill.name, skill])),
    [skills],
  );
  const toggleFinalSkill = (skill: AutoResearchSkill) => {
    setSkillSettings((current) => {
      const exists = current.learn_skill_list.some((group) =>
        group.includes(skill.name),
      );
      if (!exists) {
        return {
          ...current,
          learn_skill_list: [...current.learn_skill_list, [skill.name]],
          learn_skill_group_labels: [
            ...current.learn_skill_group_labels,
            skill.name,
          ],
        };
      }
      const kept = current.learn_skill_list
        .map((group, index) => ({
          group: group.filter((name) => name !== skill.name),
          label: current.learn_skill_group_labels[index] || group.join(' / '),
        }))
        .filter((entry) => entry.group.length);
      return {
        ...current,
        learn_skill_list: kept.map((entry) => entry.group),
        learn_skill_group_labels: kept.map((entry) => entry.label),
      };
    });
  };
  const addFinalSkillGroup = (
    selectedSkills: AutoResearchSkill[],
    label: string,
  ) => {
    setSkillSettings((current) => {
      const owned = new Set(current.learn_skill_list.flat());
      const names = selectedSkills
        .map((skill) => skill.name)
        .filter((name) => !owned.has(name));
      if (!names.length) return current;
      return {
        ...current,
        learn_skill_list: [...current.learn_skill_list, names],
        learn_skill_group_labels: [
          ...current.learn_skill_group_labels,
          label || names.join(' / '),
        ],
      };
    });
  };
  const reorderFinalSkillGroup = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    setSkillSettings((current) => {
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        sourceIndex >= current.learn_skill_list.length ||
        targetIndex >= current.learn_skill_list.length
      ) {
        return current;
      }
      const groups = [...current.learn_skill_list];
      const labels = [...current.learn_skill_group_labels];
      const [movedGroup] = groups.splice(sourceIndex, 1);
      const [movedLabel] = labels.splice(sourceIndex, 1);
      groups.splice(targetIndex, 0, movedGroup);
      labels.splice(targetIndex, 0, movedLabel);
      return {
        ...current,
        learn_skill_list: groups,
        learn_skill_group_labels: labels,
      };
    });
  };
  const removeFinalSkillGroup = (index: number) =>
    setSkillSettings((current) => ({
      ...current,
      learn_skill_list: current.learn_skill_list.filter(
        (_, groupIndex) => groupIndex !== index,
      ),
      learn_skill_group_labels: current.learn_skill_group_labels.filter(
        (_, groupIndex) => groupIndex !== index,
      ),
    }));
  const normalizedSpecificLineageSearch = specificLineageSearch
    .trim()
    .toLocaleLowerCase('zh-CN');
  const selectedLineageParent = parents.find(
    (parent) => parent.selection_id === factorSelection.lineage.selection_id,
  );
  const filteredLineageParents = parents.filter((parent) => {
    if (!normalizedSpecificLineageSearch) return true;
    return [
      parent.name,
      parent.owner_name,
      String(parent.rank_score),
      ...parent.factors.map((factor) => factor.name),
      ...parent.ancestors.map((ancestor) => ancestor.name),
    ].some((value) =>
      String(value)
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedSpecificLineageSearch),
    );
  });
  const emptyLineageParentMessage = normalizedSpecificLineageSearch
    ? '没有找到符合搜索条件的已育成马娘'
    : '没有可选择的已育成马娘';
  const lineageCharaOptions = Array.from(
    new Map(
      [
        ...umas.map((uma) => ({
          chara_id: uma.chara_id,
          card_id: uma.id,
          name: uma.name,
          rarity: uma.rarity,
          race_cloth_id: uma.race_cloth_id,
        })),
        ...parents.flatMap((parent) => [
          {
            chara_id: parent.chara_id,
            card_id: parent.card_id,
            name: parent.name,
            rarity: parent.rarity,
            race_cloth_id: parent.race_cloth_id,
          },
          ...parent.ancestors.map((ancestor) => ({
            chara_id: ancestor.chara_id,
            card_id: ancestor.card_id,
            name: ancestor.name,
            rarity: ancestor.rarity,
            race_cloth_id: ancestor.race_cloth_id,
          })),
        ]),
      ].map((uma) => [uma.chara_id, uma]),
    ).values(),
  );
  const normalizedLineageTreeSearch = lineageTreeSearch
    .trim()
    .toLocaleLowerCase('zh-CN');
  const filteredLineageCharaOptions = lineageCharaOptions.filter(
    (uma) =>
      !normalizedLineageTreeSearch ||
      uma.name
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedLineageTreeSearch) ||
      String(uma.chara_id).includes(normalizedLineageTreeSearch),
  );
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
    const uma = lineageCharaOptions.find(
      (option) => option.chara_id === setting.chara_id,
    );
    const iconPath = uma
      ? horseIconPath(uma.card_id, uma.rarity, uma.race_cloth_id)
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
            className={`text-sm ${
              tone === 'parent' ? 'text-sky-950' : 'text-rose-950'
            }`}
          >
            {label}
          </strong>
          {setting.chara_id ? (
            <button
              type="button"
              onClick={() => updateLineageTreeSlot(slot, { chara_id: 0 })}
              className="text-xs text-slate-400 hover:text-red-600"
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
          className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/80 bg-white p-2 text-left hover:border-fuchsia-200"
        >
          <span className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-2xl text-slate-300">
            {iconPath && uma ? (
              <AssetIcon
                path={iconPath}
                alt={uma.name}
                className="h-full w-full object-cover"
              />
            ) : (
              '+'
            )}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm text-slate-800">
              {uma?.name || '不固定马娘类型'}
            </strong>
            <span className="mt-0.5 block text-xs text-slate-500">
              点击搜索并选择
            </span>
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
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Star size={12} /> 红因子
              </span>
              {redFactor ? (
                <strong className="mt-1 flex items-center gap-1.5 text-sm text-rose-800">
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
                <strong className="mt-1 block text-sm text-slate-500">
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
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <CalendarDays size={12} /> 育成赛程
              </span>
              <strong
                className={`mt-1 block truncate text-sm ${
                  route.id !== 'none' ? 'text-sky-800' : 'text-slate-500'
                }`}
              >
                {route.name}
              </strong>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                {route.g1Count ? `${route.g1Count} 场 G1` : '不限制胜鞍'}
              </span>
            </button>
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-white/60 px-2 py-2 text-center text-[11px] text-slate-400">
            选择马娘后设置红因子与赛程
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <section
        id="offline-career-setup"
        className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              5
            </span>
            <div>
              <h3 className="font-semibold text-gray-800">赛程设置</h3>
              <p className="text-xs text-gray-500">
                详设只保存游戏赛程槽位 ID，启动时直接使用服务器上的槽位内容。
              </p>
            </div>
          </div>
        </div>

        <label className="mt-4 block text-sm text-slate-700">
          育成剧本
          <select
            value={selectedScenarioId}
            disabled={Boolean(busy)}
            onChange={(event) => onScenarioChange(Number(event.target.value))}
            className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-slate-900"
          >
            <option value={0}>自动选择最新可用剧本</option>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>

        {setup ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <span className="text-slate-500">当前主剧本</span>
              <strong className="ml-2 text-slate-900">
                {setup.scenario_name || `剧本 ${setup.scenario_id}`}
              </strong>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
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
        ) : null}

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">游戏赛程槽位</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {deckOptions.map((deck) => {
              const selected = selectedDeckNum === deck.deck_num;
              return (
                <article
                  key={deck.deck_num}
                  className={`flex min-w-0 items-center gap-2 rounded-lg border bg-white p-2 text-sm transition ${
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
                        槽位 {deck.deck_num} · {deck.deck_name || '空槽位'}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {setup
                          ? `${deck.race_array.length} 场比赛`
                          : '暂无数据'}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => editDeck(deck.deck_num)}
                    disabled={Boolean(busy)}
                    className="flex flex-none items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50"
                  >
                    <Pencil size={12} /> 编辑
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {editingDeckNum ? (
        <div className="fixed inset-0 z-[1450] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="关闭赛程槽位编辑"
            onClick={() => setEditingDeckNum(0)}
            disabled={Boolean(busy)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm disabled:cursor-wait"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`编辑游戏赛程槽位 ${editingDeckNum}`}
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <label className="min-w-64 flex-1 text-sm text-slate-700">
                <strong className="block text-lg text-slate-900">
                  编辑游戏赛程槽位 {editingDeckNum}
                </strong>
                <span className="mt-1 block text-xs text-slate-500">
                  保存后会覆盖游戏服务器上对应槽位的名称与赛程。
                </span>
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
                title="赛程详细"
                description="选择这个游戏槽位中要保存的比赛。"
                notice="此为赛程预设，实际比赛安排还需根据马娘生涯目标。"
                races={races}
                selectedRaceIds={editingRaceIds}
                setSelectedRaceIds={setEditingRaceIds}
              />

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-sm font-medium text-amber-950">
                  必跑比赛（自动加入）
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {requiredRaces.length ? (
                    requiredRaces.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-amber-800"
                      >
                        <Check size={12} />{' '}
                        {item.race
                          ? `${item.race.date} · ${item.race.name}`
                          : `第 ${item.year} 年 · 比赛 ${item.program_id}`}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-amber-700/60">
                      暂无固定比赛
                    </span>
                  )}
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditingDeckNum(0)}
                disabled={Boolean(busy)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                取消
              </button>
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
                className="flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save size={15} />
                {busy === 'idle-race-deck'
                  ? '正在保存…'
                  : `保存槽位 ${editingDeckNum}`}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <section
        id="career-options"
        className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              6
            </span>
            <div>
              <h3 className="font-semibold text-gray-800">结束自动点技能</h3>
              <p className="mt-1 text-xs text-slate-500">
                越靠前优先级越高，可直接拖动调整顺序。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFinalSkillPickerOpen(true)}
            className="flex flex-none items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <Plus size={14} />
            添加技能
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {skillSettings.learn_skill_list.map((group, index) => (
              <div
                key={`${index}:${group.join('|')}`}
                draggable
                onDragStart={(event) => {
                  setDraggedFinalSkillIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(
                    'text/plain',
                    `final-skill:${index}`,
                  );
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const transferredValue =
                    event.dataTransfer.getData('text/plain');
                  const transferredIndex = transferredValue.startsWith(
                    'final-skill:',
                  )
                    ? Number(transferredValue.replace('final-skill:', ''))
                    : Number.NaN;
                  const sourceIndex = Number.isInteger(transferredIndex)
                    ? transferredIndex
                    : draggedFinalSkillIndex;
                  if (sourceIndex !== null) {
                    reorderFinalSkillGroup(sourceIndex, index);
                  }
                  setDraggedFinalSkillIndex(null);
                }}
                onDragEnd={() => setDraggedFinalSkillIndex(null)}
                className={`flex min-w-0 cursor-grab items-center gap-2 rounded-lg border bg-white p-2 shadow-sm active:cursor-grabbing ${
                  draggedFinalSkillIndex === index
                    ? 'border-violet-300 opacity-45'
                    : 'border-slate-200'
                }`}
              >
                <b className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-50 text-xs text-violet-700">
                  {index + 1}
                </b>
                <span className="relative h-9 w-12 flex-none">
                  {group.slice(0, 3).map((name, iconIndex) => {
                    const skill = skillByName.get(name);
                    const iconPath = skillIconPath(skill);
                    return (
                      <span
                        key={name}
                        className="absolute top-0 h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm"
                        style={{
                          left: `${iconIndex * 7}px`,
                          zIndex: 3 - iconIndex,
                        }}
                      >
                        {iconPath ? (
                          <AssetIcon
                            path={iconPath}
                            alt={name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                            ?
                          </span>
                        )}
                      </span>
                    );
                  })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {skillSettings.learn_skill_group_labels[index] ||
                      group.join(' / ')}
                  </span>
                  <span
                    className="mt-0.5 block truncate text-[11px] text-slate-500"
                    title={group.join('、')}
                  >
                    {group.length > 1
                      ? `包含 ${group.length} 个技能`
                      : group[0]}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-0.5">
                  <GripVertical
                    size={17}
                    className="text-slate-300"
                    aria-label="拖动调整顺序"
                  />
                  <button
                    type="button"
                    onClick={() => removeFinalSkillGroup(index)}
                    title="移除"
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
            {!skillSettings.learn_skill_list.length ? (
              <button
                type="button"
                onClick={() => setFinalSkillPickerOpen(true)}
                className="col-span-2 flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 md:col-span-4"
              >
                <Plus size={15} className="mr-1" />
                暂无技能，点击添加
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="career-factor-options"
        className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            7
          </span>
          <h3 className="font-semibold text-gray-800">免费因子重抽与筛选</h3>
        </div>

        <div className="mt-4 rounded-lg border border-fuchsia-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">
                免费因子重抽与筛选
              </h4>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={factorSelection.enabled}
                onChange={(event) =>
                  updateFactorSelection({ enabled: event.target.checked })
                }
              />
              筛选最优因子
            </label>
          </div>

          {!factorSelection.enabled ? (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              已关闭筛选：仍会抽完所有免费次数，然后从候选中随机选择。
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <strong className="text-sm text-slate-800">使用场景</strong>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      [
                        'parent',
                        '父辈模式',
                        '把本次结果作为直接父辈，并综合另一侧完整谱系比较。',
                      ],
                      [
                        'ancestor',
                        '祖辈模式',
                        '把本次结果作为祖辈，只按自身因子与设置权重比较。',
                      ],
                    ] as const
                  ).map(([mode, label, description]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={factorSelection.evaluation_mode === mode}
                      onClick={() =>
                        updateFactorSelection({ evaluation_mode: mode })
                      }
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        factorSelection.evaluation_mode === mode
                          ? 'border-fuchsia-400 bg-fuchsia-50 ring-2 ring-fuchsia-100'
                          : 'border-slate-200 bg-white hover:border-fuchsia-200'
                      }`}
                    >
                      <strong className="block text-sm text-slate-800">
                        {label}
                      </strong>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <strong className="text-sm text-slate-800">
                  属性因子最低星数
                </strong>
                <p className="mt-0.5 text-xs text-slate-500">
                  每种属性可设最低星级或标记为不要；候选只检查自己实际抽到的属性类型。
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {BLUE_FACTORS.map(([key, label]) => (
                    <label key={key} className="text-xs text-slate-600">
                      {label}
                      <select
                        value={factorSelection.blue_factor_minimums[key]}
                        onChange={(event) =>
                          updateFactorSelection({
                            blue_factor_minimums: {
                              ...factorSelection.blue_factor_minimums,
                              [key]: Number(event.target.value),
                            },
                          })
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      >
                        {[0, 1, 2, 3].map((stars) => (
                          <option key={stars} value={stars}>
                            {stars ? `至少 ${stars} 星` : '不要'}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-sm text-slate-800">
                      {factorSelection.evaluation_mode === 'ancestor'
                        ? '适应性与技能因子权重'
                        : '适应性与技能优先级'}
                    </strong>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {factorSelection.evaluation_mode === 'ancestor'
                        ? '只统计本次结果自身的因子；每个因子的两次继承判定分别计入期望跳数，再乘对应权重累加。'
                        : '把本次结果与选定的另一侧谱系合并，先比较所选适应性与技能至少继承一次的综合概率；相同时按下方顺序逐项比较，最后以全部白因子的逐次继承概率兜底；可直接拖动卡片调整优先级。'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFactorSkillPickerOpen(true)}
                    className="flex flex-none items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700"
                  >
                    <Plus size={14} /> 添加技能
                  </button>
                </div>
                <p className="mt-2 rounded-md bg-fuchsia-50 px-3 py-2 text-xs leading-5 text-fuchsia-900">
                  所选技能自动设置到技能优先级列表里。
                </p>
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
                        className={`rounded-full border px-2.5 py-1 text-xs ${
                          selected
                            ? 'border-fuchsia-400 bg-fuchsia-100 text-fuchsia-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {target.name}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {factorSelection.targets.map((target, index) => {
                    const targetKey = `${target.kind}:${target.factor_group_id}`;
                    const iconPath =
                      target.kind === 'aptitude'
                        ? RED_FACTOR_ICON_PATHS[target.factor_group_id]
                        : skillIconPath(skillByName.get(target.name));
                    const draggable =
                      factorSelection.evaluation_mode === 'parent';
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
                          reorderTarget(
                            transferredKey || draggedFactorTarget,
                            targetKey,
                          );
                          setDraggedFactorTarget('');
                        }}
                        onDragEnd={() => setDraggedFactorTarget('')}
                        className={`flex min-w-0 items-center gap-2 rounded-lg border bg-white p-2 shadow-sm ${
                          draggable ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${
                          draggedFactorTarget === targetKey
                            ? 'border-fuchsia-300 opacity-45'
                            : 'border-slate-200'
                        }`}
                      >
                        <b className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-fuchsia-50 text-xs text-fuchsia-700">
                          {index + 1}
                        </b>
                        <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm">
                          {iconPath ? (
                            <AssetIcon
                              path={iconPath}
                              alt={target.name}
                              className={`h-full w-full ${
                                target.kind === 'aptitude'
                                  ? 'object-contain p-0.5'
                                  : 'object-cover'
                              }`}
                            />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">
                              ?
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {target.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                            {target.kind === 'aptitude'
                              ? '适应性因子'
                              : '技能因子'}
                          </span>
                        </span>
                        {factorSelection.evaluation_mode === 'ancestor' ? (
                          <label className="flex flex-none flex-col text-[10px] text-slate-500">
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
                              className="mt-0.5 w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-slate-700"
                            />
                          </label>
                        ) : (
                          <GripVertical
                            size={17}
                            className="flex-none text-slate-300"
                            aria-label="拖动调整顺序"
                          />
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
                    );
                  })}
                  {!factorSelection.targets.length ? (
                    <button
                      type="button"
                      onClick={() => setFactorSkillPickerOpen(true)}
                      className="col-span-2 flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 md:col-span-4"
                    >
                      <Plus size={15} className="mr-1" />
                      选择适应性或添加技能
                    </button>
                  ) : null}
                </div>
              </div>

              {factorSelection.evaluation_mode === 'parent' ? (
                <div>
                  <strong className="text-sm text-slate-800">
                    兄弟辈 / 另一侧谱系
                  </strong>
                  <p className="mt-0.5 text-xs text-slate-500">
                    仅从当前账号自己的已育成马娘和好友记录中比较，不使用通用种马库。
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ['none', '不设置', '不限制另一侧谱系'],
                        ['specific', '指定已有马娘', '直接选择一组完整谱系'],
                        ['rules', '按谱系条件', '设置父辈、祖辈与星数'],
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
                            ? 'border-fuchsia-400 bg-fuchsia-50 ring-2 ring-fuchsia-100'
                            : 'border-slate-200 bg-white hover:border-fuchsia-200'
                        }`}
                      >
                        <strong className="block text-sm text-slate-800">
                          {label}
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {description}
                        </span>
                      </button>
                    ))}
                  </div>

                  {factorSelection.lineage.mode === 'specific' ? (
                    <div className="mt-3">
                      <SuccessionPickerTrigger
                        label="指定已有马娘"
                        selected={Boolean(selectedLineageParent)}
                        portrait={
                          selectedLineageParent ? (
                            <AssetIcon
                              path={
                                horseIconPath(
                                  selectedLineageParent.card_id,
                                  selectedLineageParent.rarity,
                                  selectedLineageParent.race_cloth_id,
                                ) || ''
                              }
                              alt={selectedLineageParent.name}
                              className="successionPortrait object-cover"
                            />
                          ) : null
                        }
                        placeholder="点击选择已有马娘"
                        onOpen={() => setSpecificLineagePickerOpen(true)}
                        onClear={
                          selectedLineageParent
                            ? () =>
                                updateFactorSelection({
                                  lineage: {
                                    ...factorSelection.lineage,
                                    selection_id: '',
                                  },
                                })
                            : undefined
                        }
                      >
                        {selectedLineageParent ? (
                          <>
                            <strong>{selectedLineageParent.name}</strong>
                            <small className="mt-1 block text-gray-500">
                              {selectedLineageParent.source === 'rental'
                                ? `借用 · ${selectedLineageParent.owner_name || '未知玩家'}`
                                : '自己的马娘'}
                              {selectedLineageParent.rank_score
                                ? ` · 评分 ${selectedLineageParent.rank_score}`
                                : ''}
                            </small>
                          </>
                        ) : null}
                      </SuccessionPickerTrigger>
                      {!selectedLineageParent &&
                      factorSelection.lineage.selection_id ? (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          已保存的马娘当前不在自己或好友列表中，请重新选择。
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {factorSelection.lineage.mode === 'rules' ? (
                    <div className="mt-3 rounded-xl border border-fuchsia-200 bg-gradient-to-b from-white to-fuchsia-50/40 p-4">
                      <div className="mb-4">
                        <strong className="text-sm text-slate-800">
                          另一侧完整谱系树
                        </strong>
                        <p className="mt-0.5 text-xs text-slate-500">
                          与继承规划的“已育成马娘”一致：上方设置直接父辈，下方设置她的两位父辈；每个槽位都可指定马娘、红因子与育成赛程。
                        </p>
                      </div>
                      <div className="mx-auto max-w-4xl">
                        <div className="mx-auto max-w-md">
                          {lineageTreeNode('parent', '另一侧父辈', 'parent')}
                        </div>
                        <div className="relative pt-7">
                          <span className="pointer-events-none absolute left-1/4 right-1/4 top-0 h-7 border-l-2 border-r-2 border-t-2 border-fuchsia-200" />
                          <div className="grid grid-cols-2 gap-3">
                            {lineageTreeNode(
                              'ancestor_1',
                              '祖辈 1',
                              'ancestor',
                            )}
                            {lineageTreeNode(
                              'ancestor_2',
                              '祖辈 2',
                              'ancestor',
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  祖辈模式不会读取或比较另一侧谱系；本次候选的非属性因子只看自身。
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {lineageFactorPicker ? (
        <div className="fixed inset-0 z-[1470] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="关闭红因子设置"
            onClick={() => setLineageFactorPicker('')}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`设置${LINEAGE_TREE_SLOT_LABELS[lineageFactorPicker]}的红因子`}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <span className="text-[11px] font-bold tracking-[0.18em] text-rose-500">
                  TRAINED RED FACTOR
                </span>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {LINEAGE_TREE_SLOT_LABELS[lineageFactorPicker]}的红因子
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  选择这匹已育成马娘实际持有的红因子及最低星级。
                </p>
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
                <strong className="text-sm text-slate-800">因子属性</strong>
                <div className="mt-2 space-y-3">
                  {RED_FACTOR_GROUPS.map((group) => (
                    <div key={group.label}>
                      <span className="text-xs font-medium text-slate-500">
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
                              <strong className="truncate text-sm text-slate-800">
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
                <strong className="text-sm text-slate-800">因子星级</strong>
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
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
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
            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <span className="flex items-center gap-2 text-sm text-slate-600">
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
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
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
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                >
                  保存
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {lineageRoutePicker ? (
        <div className="fixed inset-0 z-[1470] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="关闭赛程设置"
            onClick={() => setLineageRoutePicker('')}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`设置${LINEAGE_TREE_SLOT_LABELS[lineageRoutePicker]}的赛程`}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <span className="text-[11px] font-bold tracking-[0.18em] text-sky-500">
                  RACE SCHEDULE
                </span>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  {LINEAGE_TREE_SLOT_LABELS[lineageRoutePicker]}赛程设置
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  按已育成马娘的实际胜鞍赛程筛选完整谱系。
                </p>
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
                    <strong className="mt-3 block text-sm text-slate-900">
                      {route.name}
                    </strong>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {route.description}
                    </span>
                    <b className="mt-2 block text-xs text-sky-700">
                      {route.g1Count ? `${route.g1Count} 场 G1` : '不限制胜鞍'}
                    </b>
                  </button>
                );
              })}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <span className="text-xs text-slate-500">
                已育成马娘不会再反推适性因子；这里只校验对应胜鞍。
              </span>
              <button
                type="button"
                onClick={() => setLineageRoutePicker('')}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                完成
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {specificLineagePickerOpen ? (
        <SuccessionPickerDialog
          ariaLabel="指定已有马娘"
          title="选择已有马娘"
          description="选择一组完整谱系作为另一侧父辈；可查看本体、两位父辈与全部因子。"
          onClose={() => setSpecificLineagePickerOpen(false)}
          dialogClassName="successionCapturedPickerDialog"
          searchValue={specificLineageSearch}
          searchPlaceholder="搜索马娘、因子、玩家或评价"
          searchAriaLabel="搜索已有马娘"
          onSearchChange={setSpecificLineageSearch}
          meta={<span>找到 {filteredLineageParents.length} 个已有实例</span>}
          footer={
            <>
              <span>已选马娘会作为固定的另一侧完整谱系</span>
              <button
                type="button"
                onClick={() => setSpecificLineagePickerOpen(false)}
              >
                完成
              </button>
            </>
          }
        >
          {filteredLineageParents.length ? (
            <div className="successionCapturedPickerGrid">
              {filteredLineageParents.map((parent) => (
                <ParentChoiceCard
                  key={parent.selection_id}
                  parent={parent}
                  selected={
                    factorSelection.lineage.selection_id === parent.selection_id
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
            </div>
          ) : (
            <div className="successionCapturedPickerEmpty">
              {emptyLineageParentMessage}
            </div>
          )}
        </SuccessionPickerDialog>
      ) : null}

      {lineageTreePicker ? (
        <div className="fixed inset-0 z-[1450] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="关闭谱系树选择"
            onClick={() => setLineageTreePicker('')}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="选择谱系树马娘"
            className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <span className="text-[11px] font-bold tracking-[0.18em] text-fuchsia-500">
                  LINEAGE TREE
                </span>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  选择{LINEAGE_TREE_SLOT_LABELS[lineageTreePicker]}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  输入名称或角色 ID 搜索，点击头像完成选择。
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭谱系树选择"
                onClick={() => setLineageTreePicker('')}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </header>

            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <label className="relative block">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={lineageTreeSearch}
                  onChange={(event) => setLineageTreeSearch(event.target.value)}
                  placeholder="搜索马娘名称或角色 ID"
                  className="w-full cursor-text select-text rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {filteredLineageCharaOptions.map((uma) => {
                  const selected =
                    factorSelection.lineage.tree[lineageTreePicker].chara_id ===
                    uma.chara_id;
                  const occupied = (
                    Object.keys(
                      factorSelection.lineage.tree,
                    ) as LineageTreeSlot[]
                  ).some(
                    (slot) =>
                      slot !== lineageTreePicker &&
                      factorSelection.lineage.tree[slot].chara_id ===
                        uma.chara_id,
                  );
                  const iconPath = horseIconPath(
                    uma.card_id,
                    uma.rarity,
                    uma.race_cloth_id,
                  );
                  return (
                    <button
                      key={uma.chara_id}
                      type="button"
                      disabled={occupied}
                      title={occupied ? '该马娘已用于树中的其他槽位' : uma.name}
                      onClick={() => {
                        const current =
                          factorSelection.lineage.tree[lineageTreePicker];
                        updateLineageTreeSlot(lineageTreePicker, {
                          chara_id: uma.chara_id,
                          red_factor_group_id:
                            current.red_factor_group_id || 11,
                          red_factor_stars: current.red_factor_stars || 3,
                          route_id: current.route_id || 'none',
                          min_factor_stars: 0,
                        });
                        setLineageTreePicker('');
                      }}
                      className={`min-w-0 rounded-xl border p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        selected
                          ? 'border-fuchsia-400 bg-fuchsia-50 ring-2 ring-fuchsia-100'
                          : 'border-slate-200 bg-white hover:border-fuchsia-200 hover:bg-fuchsia-50/40'
                      }`}
                    >
                      <span className="mx-auto block h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                        {iconPath ? (
                          <AssetIcon
                            path={iconPath}
                            alt={uma.name}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="mt-1.5 block truncate text-xs font-semibold text-slate-700">
                        {uma.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!filteredLineageCharaOptions.length ? (
                <p className="py-16 text-center text-sm text-slate-400">
                  没有找到符合搜索条件的马娘
                </p>
              ) : null}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <span className="text-xs text-slate-500">
                找到 {filteredLineageCharaOptions.length} 位马娘
              </span>
              <button
                type="button"
                onClick={() => {
                  updateLineageTreeSlot(lineageTreePicker, { chara_id: 0 });
                  setLineageTreePicker('');
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                设为不固定
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <SkillSelector
        open={finalSkillPickerOpen}
        title="设置离线结束技能优先级"
        description="界面和预设技能选择一致。可单独添加技能，也可把当前筛选结果添加为同优先级组。"
        skills={skills}
        selectedNames={selectedFinalSkillNames}
        elevated
        onToggle={toggleFinalSkill}
        onAddGroup={addFinalSkillGroup}
        onClose={() => setFinalSkillPickerOpen(false)}
      />
      <SkillSelector
        open={factorSkillPickerOpen}
        title="选择目标白因子技能"
        description={
          factorSelection.evaluation_mode === 'ancestor'
            ? '选择后回到列表中设置每个技能因子的权重。'
            : '选择顺序就是因子比较优先级；也可以回到列表中直接拖动调整。'
        }
        skills={skills.filter((skill) => skill.rarity === 1)}
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
    </>
  );
}
