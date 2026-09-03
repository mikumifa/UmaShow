/* eslint-disable jsx-a11y/label-has-associated-control */
import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Plus,
  Save,
  Search,
  X,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
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
  setDeckName: Dispatch<SetStateAction<string>>;
  selectedRaceIds: number[];
  setSelectedRaceIds: Dispatch<SetStateAction<number[]>>;
  challengeMode: boolean;
  setChallengeMode: Dispatch<SetStateAction<boolean>>;
  busy: string;
  prepare: () => Promise<void>;
  saveDeck: () => Promise<void>;
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
  { factor_group_id: 11, name: '草地', kind: 'aptitude' },
  { factor_group_id: 12, name: '泥地', kind: 'aptitude' },
  { factor_group_id: 21, name: '领跑', kind: 'aptitude' },
  { factor_group_id: 22, name: '跟前', kind: 'aptitude' },
  { factor_group_id: 23, name: '居中', kind: 'aptitude' },
  { factor_group_id: 24, name: '后追', kind: 'aptitude' },
  { factor_group_id: 31, name: '短距离', kind: 'aptitude' },
  { factor_group_id: 32, name: '英里', kind: 'aptitude' },
  { factor_group_id: 33, name: '中距离', kind: 'aptitude' },
  { factor_group_id: 34, name: '长距离', kind: 'aptitude' },
];

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
  setDeckName,
  selectedRaceIds,
  setSelectedRaceIds,
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
  const [specificLineageSearch, setSpecificLineageSearch] = useState('');
  const [lineageTreeSearch, setLineageTreeSearch] = useState('');
  const [lineageTreePicker, setLineageTreePicker] = useState<
    'parent' | 'ancestor_1' | 'ancestor_2' | ''
  >('');
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
  const moveTarget = (index: number, offset: number) => {
    setFactorSelection((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.targets.length)
        return current;
      const targets = [...current.targets];
      [targets[index], targets[destination]] = [
        targets[destination],
        targets[index],
      ];
      return { ...current, targets };
    });
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
  const moveFinalSkillGroup = (index: number, offset: number) => {
    setSkillSettings((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.learn_skill_list.length) {
        return current;
      }
      const groups = [...current.learn_skill_list];
      const labels = [...current.learn_skill_group_labels];
      [groups[index], groups[destination]] = [
        groups[destination],
        groups[index],
      ];
      [labels[index], labels[destination]] = [
        labels[destination],
        labels[index],
      ];
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
    if (parent.selection_id === factorSelection.lineage.selection_id) {
      return false;
    }
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
    : '没有其他可选择的已育成马娘';
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
        <label className="mt-2 block text-xs text-slate-600">
          此槽位因子总星数至少
          <input
            type="number"
            min={0}
            value={setting.min_factor_stars}
            onChange={(event) =>
              updateLineageTreeSlot(slot, {
                min_factor_stars: Math.max(0, Number(event.target.value)),
              })
            }
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
    );
  };

  return (
    <>
      <section
        id="offline-career-setup"
        className="rounded-lg border border-sky-200 bg-sky-50/60 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sky-950">游戏离线自动育成</h3>
            <p className="mt-1 text-xs text-sky-700">
              读取游戏内 8
              个赛程槽位，服务器会自动补入当前马娘和剧本的必跑比赛。
            </p>
          </div>
          <button
            type="button"
            onClick={prepare}
            disabled={Boolean(busy)}
            className="flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
          >
            <Download size={15} />
            {busy === 'idle-prepare' ? '正在读取…' : '读取所选剧本赛程'}
          </button>
        </div>

        <label className="mt-4 block text-sm text-slate-700">
          育成剧本
          <select
            value={selectedScenarioId}
            disabled={Boolean(busy)}
            onChange={(event) => onScenarioChange(Number(event.target.value))}
            className="mt-1.5 w-full rounded-md border border-sky-200 bg-white px-3 py-2 text-slate-900"
          >
            <option value={0}>自动选择最新可用剧本</option>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            切换剧本后需要重新读取赛程，必跑比赛和活动模式会按所选剧本计算。
          </span>
        </label>

        {setup ? (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-sky-100 bg-white p-3 text-sm">
                <span className="text-slate-500">当前主剧本</span>
                <strong className="ml-2 text-slate-900">
                  {setup.scenario_name || `剧本 ${setup.scenario_id}`}
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
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={saveDeck}
                    disabled={Boolean(busy)}
                    className="flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    <Save size={15} />
                    {busy === 'idle-race-deck' ? '正在保存…' : '保存赛程到游戏'}
                  </button>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <RaceSchedulePicker
                    id="offline-races"
                    title="赛程详细"
                    description="可以再次修改赛程；保存后会覆盖游戏内对应槽位的赛程。"
                    notice="此为赛程预设，实际比赛安排还需根据马娘生涯目标。"
                    races={races}
                    selectedRaceIds={selectedRaceIds}
                    setSelectedRaceIds={setSelectedRaceIds}
                  />
                </div>

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
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <section
        id="career-options"
        className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            5
          </span>
          <div>
            <h3 className="font-semibold text-gray-800">结束自动点技能</h3>
            <p className="text-xs text-gray-500">
              固定开启；在因子结算前完成技能购买。
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-violet-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-3xl text-xs leading-5 text-slate-500">
              优先学习列表技能；列表处理完后，会继续从可学习技能中按评价分最大化购买。双圈技能是否提前购买完全由下方优先级决定：未列入时，会在列表完成后与其金技能等候选按优先级处理。
            </p>
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
              自动点技能始终开启
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-sm text-slate-800">技能优先级</strong>
                <p className="mt-0.5 text-xs text-slate-500">
                  越靠前越优先；同一组里的技能视为同级候选。无需设置 Hint 门槛。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinalSkillPickerOpen(true)}
                className="flex items-center gap-1 rounded-md border border-violet-200 px-2.5 py-1.5 text-xs font-medium text-violet-700"
              >
                <Plus size={13} /> 添加技能
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {skillSettings.learn_skill_list.map((group, index) => (
                <div
                  key={`${index}:${group.join('|')}`}
                  className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
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
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveFinalSkillGroup(index, -1)}
                      className="disabled:opacity-30"
                      title="提高优先级"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={
                        index === skillSettings.learn_skill_list.length - 1
                      }
                      onClick={() => moveFinalSkillGroup(index, 1)}
                      className="disabled:opacity-30"
                      title="降低优先级"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFinalSkillGroup(index)}
                      title="移除"
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
                  添加希望优先学习的技能
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section
        id="career-factor-options"
        className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            6
          </span>
          <h3 className="font-semibold text-gray-800">免费因子重抽与筛选</h3>
        </div>

        <div className="mt-4 rounded-lg border border-fuchsia-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">
                免费因子重抽与筛选
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                服务器只抽费用为 0
                的次数；完成因子选择后自动开始下一轮离线育成。
              </p>
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
                <strong className="text-sm text-slate-800">
                  属性因子最低星数
                </strong>
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
                            {stars ? `${stars} 星` : '不限'}
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
                      适应性与技能优先级
                    </strong>
                    <p className="mt-0.5 text-xs text-slate-500">
                      候选按所选适应性与技能的综合继承概率排序；综合概率相同时，再按下方顺序逐项比较。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFactorSkillPickerOpen(true)}
                    className="flex items-center gap-1 rounded-md border border-fuchsia-200 px-2.5 py-1.5 text-xs font-medium text-fuchsia-700"
                  >
                    <Plus size={13} /> 手动添加技能
                  </button>
                </div>
                <p className="mt-2 rounded-md bg-fuchsia-50 px-3 py-2 text-xs leading-5 text-fuchsia-900">
                  始终自动追加第 5
                  步“结束自动点技能”的技能优先级，无需单独开启。
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
                <div className="mt-3 space-y-1.5">
                  {factorSelection.targets.map((target, index) => (
                    <div
                      key={`${target.kind}:${target.factor_group_id}`}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                    >
                      <b className="w-5 text-center text-xs text-fuchsia-700">
                        {index + 1}
                      </b>
                      <span className="min-w-0 flex-1 truncate">
                        {target.name}
                      </span>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveTarget(index, -1)}
                        className="disabled:opacity-30"
                        title="提高优先级"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === factorSelection.targets.length - 1}
                        onClick={() => moveTarget(index, 1)}
                        className="disabled:opacity-30"
                        title="降低优先级"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTarget(target)}
                        title="移除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
                    <div className="mb-3 rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <strong className="text-sm text-fuchsia-900">
                            当前已选马娘
                          </strong>
                          <p className="mt-0.5 text-xs text-fuchsia-700">
                            此马娘将作为固定的另一侧完整谱系使用。
                          </p>
                        </div>
                        {factorSelection.lineage.selection_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateFactorSelection({
                                lineage: {
                                  ...factorSelection.lineage,
                                  selection_id: '',
                                },
                              })
                            }
                            className="inline-flex flex-none items-center gap-1 rounded-md border border-fuchsia-200 bg-white px-2.5 py-1.5 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100"
                          >
                            <X size={13} /> 清除选择
                          </button>
                        ) : null}
                      </div>
                      {selectedLineageParent ? (
                        <ParentChoiceCard
                          parent={selectedLineageParent}
                          selected
                          disabled={false}
                          onSelect={() =>
                            updateFactorSelection({
                              lineage: {
                                ...factorSelection.lineage,
                                selection_id: '',
                              },
                            })
                          }
                        />
                      ) : null}
                      {!selectedLineageParent &&
                      factorSelection.lineage.selection_id ? (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          已保存的马娘当前不在自己或好友列表中，请重新选择。
                        </p>
                      ) : null}
                      {!selectedLineageParent &&
                      !factorSelection.lineage.selection_id ? (
                        <p className="rounded-lg border border-dashed border-fuchsia-200 bg-white/70 px-3 py-4 text-center text-sm text-fuchsia-500">
                          尚未选择已有马娘
                        </p>
                      ) : null}
                    </div>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <p className="text-xs font-medium text-slate-600">
                        从下面选择或更换自己、好友的已育成马娘；卡片显示本体、两位父辈和因子。
                      </p>
                      <label className="relative block w-full sm:w-80">
                        <Search
                          size={15}
                          className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                        />
                        <input
                          value={specificLineageSearch}
                          onChange={(event) =>
                            setSpecificLineageSearch(event.target.value)
                          }
                          placeholder="搜索马娘、玩家、评价或因子"
                          className="w-full cursor-text select-text rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                        />
                      </label>
                    </div>
                    <div className="grid max-h-[520px] gap-2 overflow-y-auto pr-1 xl:grid-cols-2">
                      {filteredLineageParents.map((parent) => (
                        <ParentChoiceCard
                          key={parent.selection_id}
                          parent={parent}
                          selected={
                            factorSelection.lineage.selection_id ===
                            parent.selection_id
                          }
                          disabled={false}
                          onSelect={() =>
                            updateFactorSelection({
                              lineage: {
                                ...factorSelection.lineage,
                                selection_id:
                                  factorSelection.lineage.selection_id ===
                                  parent.selection_id
                                    ? ''
                                    : parent.selection_id,
                              },
                            })
                          }
                        />
                      ))}
                      {!filteredLineageParents.length ? (
                        <p className="py-10 text-center text-sm text-slate-400 xl:col-span-2">
                          {emptyLineageParentMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {factorSelection.lineage.mode === 'rules' ? (
                  <div className="mt-3 rounded-xl border border-fuchsia-200 bg-gradient-to-b from-white to-fuchsia-50/40 p-4">
                    <div className="mb-4">
                      <strong className="text-sm text-slate-800">
                        另一侧完整谱系树
                      </strong>
                      <p className="mt-0.5 text-xs text-slate-500">
                        与继承规划一致：上方设置直接父辈，下方分别设置这位父辈的两位父辈。三个槽位均可独立指定马娘类型和最低因子星数。
                      </p>
                    </div>
                    <div className="mx-auto max-w-4xl">
                      <div className="mx-auto max-w-md">
                        {lineageTreeNode('parent', '另一侧父辈', 'parent')}
                      </div>
                      <div className="relative pt-7">
                        <span className="pointer-events-none absolute left-1/4 right-1/4 top-0 h-7 border-l-2 border-r-2 border-t-2 border-fuchsia-200" />
                        <div className="grid grid-cols-2 gap-3">
                          {lineageTreeNode('ancestor_1', '祖辈 1', 'ancestor')}
                          {lineageTreeNode('ancestor_2', '祖辈 2', 'ancestor')}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

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
                        updateLineageTreeSlot(lineageTreePicker, {
                          chara_id: uma.chara_id,
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
        description="选择顺序就是因子比较优先级；也可以回到列表中上下调整。"
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
          })
        }
        onClose={() => setFactorSkillPickerOpen(false)}
      />
    </>
  );
}
