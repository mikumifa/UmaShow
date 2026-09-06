/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  SuccessionPickerDialog,
  SuccessionPickerTrigger,
} from 'renderer/components/succession/SuccessionPicker';
import {
  PlannerPortrait,
  PlannerSelectionCard,
} from 'renderer/components/succession/PlannerComponents';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import OfflineCareerSettings from './OfflineCareerSettings';
import AppMenuPortal from '../AppMenuPortal';
import AppSideNotch from '../AppSideNotch';
import {
  characterIconPath,
  DeckChoiceCard,
  ParentChoiceCard,
  SupportChoiceCard,
} from './SelectionCards';
import { careerSettingModeBadgeClass, scrollToSection } from './shared';
import { parentCompatibilityPreview } from './successionCompatibility';
import { AutoResearchSkill } from './SkillSelector';
import {
  CareerSetting,
  Dashboard,
  OfflineFactorSelection,
  OfflineSkillSettings,
  OfflineSingleModeSetup,
  Preset,
  RaceOption,
  SessionAccount,
  SupportInfo,
} from './types';

type CareerTabProps = {
  dashboard: Dashboard;
  careerSaveOpen: boolean;
  accountCareerSettings: CareerSetting[];
  matchingCareerSettings: CareerSetting[];
  applyCareerSetting: (settingId: string) => void;
  editPresetForCareerSetting: (settingId: string) => void;
  continueWithSetting: (settingId: string) => void;
  deleteCareerSetting: (settingId: string) => void;
  newCareerSaveName: string;
  setNewCareerSaveName: Dispatch<SetStateAction<string>>;
  createCareerSave: () => void;
  automationActive: boolean;
  busy: string;
  activeCareer?: SessionAccount['career'];
  activeCareerIconPath?: string;
  abandonCareer: () => Promise<void>;
  continuingCurrentCareer: boolean;
  canContinueCurrentCareer: boolean;
  saveCareerSetting: () => boolean;
  saveAndApplyCareerSetting: () => Promise<void>;
  saveAndRunCareer: () => void;
  careerPresetName: string;
  newCareerPresetName: string;
  setNewCareerPresetName: Dispatch<SetStateAction<string>>;
  newCareerMode: 'online' | 'offline';
  setNewCareerMode: Dispatch<SetStateAction<'online' | 'offline'>>;
  editCareerPreset: () => void;
  closeCareerEditor: () => void;
  presets: Preset[];
  selectedUma?: Dashboard['umas'][number];
  cardId: number;
  setCardId: Dispatch<SetStateAction<number>>;
  selectedParent1?: Dashboard['parents'][number];
  selectedParent2?: Dashboard['parents'][number];
  parent1: string;
  parent2: string;
  setParent1: Dispatch<SetStateAction<string>>;
  setParent2: Dispatch<SetStateAction<string>>;
  deckId: number;
  setDeckId: Dispatch<SetStateAction<number>>;
  setSupportCardIds: Dispatch<SetStateAction<number[]>>;
  selectedDeckCharaIds: number[];
  supportSearch: string;
  setSupportSearch: Dispatch<SetStateAction<string>>;
  friendCardId: number;
  setFriendCardId: Dispatch<SetStateAction<number>>;
  selectedFriendSupport?: SupportInfo;
  visibleFriendSupports: SupportInfo[];
  availableFriendSupportIds: Set<number>;
  burnClocks: boolean;
  setBurnClocks: Dispatch<SetStateAction<boolean>>;
  recoverTpWithItem: boolean;
  setRecoverTpWithItem: Dispatch<SetStateAction<boolean>>;
  recoverTpWithJewels: boolean;
  setRecoverTpWithJewels: Dispatch<SetStateAction<boolean>>;
  selectionConflict: string;
  refreshOptionsIndex: () => Promise<void>;
  renameCareerSetting: (settingId: string, name: string) => void;
  selectedAccountId: string;
  careerMode: 'online' | 'offline';
  offlineSetup: OfflineSingleModeSetup | null;
  offlineScenarios: Dashboard['offline_scenarios'];
  offlineScenarioId: number;
  changeOfflineScenario: (scenarioId: number) => void;
  offlineRaceDeckNum: number;
  setOfflineRaceDeckNum: Dispatch<SetStateAction<number>>;
  resetOfflineCareer: () => void;
  prepareOfflineCareer: () => Promise<OfflineSingleModeSetup | null>;
  saveOfflineRaceDeck: (
    deckNum: number,
    deckName: string,
    raceIds: number[],
  ) => Promise<boolean>;
  races: RaceOption[];
  skills: AutoResearchSkill[];
  offlineFactorSelection: OfflineFactorSelection;
  setOfflineFactorSelection: Dispatch<SetStateAction<OfflineFactorSelection>>;
  offlinePrioritySkillIds: number[];
  setOfflinePrioritySkillIds: Dispatch<SetStateAction<number[]>>;
  offlineSkillSettings: OfflineSkillSettings;
  setOfflineSkillSettings: Dispatch<SetStateAction<OfflineSkillSettings>>;
};

const PARENT_BLUE_FACTOR_OPTIONS = [
  { factor_group_id: 1, name: '速度', abbreviation: '速' },
  { factor_group_id: 2, name: '耐力', abbreviation: '耐' },
  { factor_group_id: 3, name: '力量', abbreviation: '力' },
  { factor_group_id: 4, name: '毅力', abbreviation: '根' },
  { factor_group_id: 5, name: '智力', abbreviation: '智' },
];

const PARENT_APTITUDE_FACTOR_GROUPS = [
  {
    label: '场地',
    factors: [
      { factor_group_id: 11, name: '草地' },
      { factor_group_id: 12, name: '泥地' },
    ],
  },
  {
    label: '跑法',
    factors: [
      { factor_group_id: 21, name: '领跑' },
      { factor_group_id: 22, name: '跟前' },
      { factor_group_id: 23, name: '居中' },
      { factor_group_id: 24, name: '后追' },
    ],
  },
  {
    label: '距离',
    factors: [
      { factor_group_id: 31, name: '短距离' },
      { factor_group_id: 32, name: '英里' },
      { factor_group_id: 33, name: '中距离' },
      { factor_group_id: 34, name: '长距离' },
    ],
  },
];

const PARENT_APTITUDE_FACTOR_GROUP_IDS = new Set(
  PARENT_APTITUDE_FACTOR_GROUPS.flatMap((group) =>
    group.factors.map((factor) => factor.factor_group_id),
  ),
);

type ParentPickerSource = 'all' | 'own' | 'rental';
type ParentPickerSort = 'score' | 'compatibility' | 'blue' | 'aptitude';
type ParentPickerSortDirection = 'desc' | 'asc';

function parentPickerFactorStars(
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
          PARENT_APTITUDE_FACTOR_GROUP_IDS.has(factor.factor_group_id)
        );
      })
      .map((factor) => factor.stars),
  );
}

export default function CareerTab(props: CareerTabProps) {
  const {
    dashboard,
    careerSaveOpen,
    accountCareerSettings,
    matchingCareerSettings,
    applyCareerSetting,
    editPresetForCareerSetting,
    continueWithSetting,
    deleteCareerSetting,
    newCareerSaveName,
    setNewCareerSaveName,
    createCareerSave,
    automationActive,
    busy,
    activeCareer,
    activeCareerIconPath,
    abandonCareer,
    continuingCurrentCareer,
    canContinueCurrentCareer,
    saveCareerSetting,
    saveAndApplyCareerSetting,
    saveAndRunCareer,
    careerPresetName,
    newCareerPresetName,
    setNewCareerPresetName,
    newCareerMode,
    setNewCareerMode,
    editCareerPreset,
    closeCareerEditor,
    presets,
    selectedUma,
    cardId,
    setCardId,
    selectedParent1,
    selectedParent2,
    parent1,
    parent2,
    setParent1,
    setParent2,
    deckId,
    setDeckId,
    setSupportCardIds,
    selectedDeckCharaIds,
    supportSearch,
    setSupportSearch,
    friendCardId,
    setFriendCardId,
    selectedFriendSupport,
    visibleFriendSupports,
    availableFriendSupportIds,
    burnClocks,
    setBurnClocks,
    recoverTpWithItem,
    setRecoverTpWithItem,
    recoverTpWithJewels,
    setRecoverTpWithJewels,
    selectionConflict,
    refreshOptionsIndex,
    renameCareerSetting,
    selectedAccountId,
    careerMode,
    offlineSetup,
    offlineScenarios,
    offlineScenarioId,
    changeOfflineScenario,
    offlineRaceDeckNum,
    setOfflineRaceDeckNum,
    resetOfflineCareer,
    prepareOfflineCareer,
    saveOfflineRaceDeck,
    races,
    skills,
    offlineFactorSelection,
    setOfflineFactorSelection,
    offlinePrioritySkillIds,
    setOfflinePrioritySkillIds,
    offlineSkillSettings,
    setOfflineSkillSettings,
  } = props;
  const [newCareerDialogOpen, setNewCareerDialogOpen] = useState(false);
  const [umaPickerOpen, setUmaPickerOpen] = useState(false);
  const [umaPickerSearch, setUmaPickerSearch] = useState('');
  const [parentPickerSlot, setParentPickerSlot] = useState<1 | 2 | null>(null);
  const [parentPickerSearch, setParentPickerSearch] = useState('');
  const [parentPickerSource, setParentPickerSource] =
    useState<ParentPickerSource>('all');
  const [parentPickerBlueFactors, setParentPickerBlueFactors] = useState<
    number[]
  >([]);
  const [parentPickerBlueStars, setParentPickerBlueStars] = useState(0);
  const [parentPickerAptitudeFactors, setParentPickerAptitudeFactors] =
    useState<number[]>([]);
  const [parentPickerAptitudeStars, setParentPickerAptitudeStars] = useState(0);
  const [parentPickerSort, setParentPickerSort] =
    useState<ParentPickerSort>('score');
  const [parentPickerSortDirection, setParentPickerSortDirection] =
    useState<ParentPickerSortDirection>('desc');
  const [successionG1SaddleIds, setSuccessionG1SaddleIds] = useState<number[]>(
    [],
  );
  useEffect(() => {
    loadUMDB()
      .then(() => setSuccessionG1SaddleIds([...UMDB.successionG1SaddleIds]))
      .catch(() => setSuccessionG1SaddleIds([]));
  }, []);
  useEffect(() => {
    if (!newCareerDialogOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNewCareerDialogOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [newCareerDialogOpen]);
  const normalizedUmaSearch = umaPickerSearch.trim().toLowerCase();
  const pickerUmas = dashboard.umas.filter(
    (uma) =>
      !normalizedUmaSearch ||
      `${uma.name} ${uma.id}`.toLowerCase().includes(normalizedUmaSearch),
  );
  const normalizedParentSearch = parentPickerSearch.trim().toLowerCase();
  const requiredParentPickerBlueStars = parentPickerBlueFactors.length
    ? Math.max(1, parentPickerBlueStars)
    : parentPickerBlueStars;
  const requiredParentPickerAptitudeStars = parentPickerAptitudeFactors.length
    ? Math.max(1, parentPickerAptitudeStars)
    : parentPickerAptitudeStars;
  const parentPickerOtherParent =
    parentPickerSlot === 1 ? selectedParent2 : selectedParent1;
  const parentPickerCompatibility = (parent: Dashboard['parents'][number]) =>
    selectedUma
      ? parentCompatibilityPreview(
          selectedUma.chara_id,
          parent,
          parentPickerOtherParent,
          successionG1SaddleIds,
        ).total
      : 0;
  const pickerParents = dashboard.parents
    .filter((parent) => {
      if (
        parent.source === 'rental' &&
        parent.friend_state !== undefined &&
        ![1, 3].includes(parent.friend_state)
      ) {
        return false;
      }
      if (
        parentPickerSource !== 'all' &&
        parent.source !== parentPickerSource
      ) {
        return false;
      }
      if (
        requiredParentPickerBlueStars > 0 &&
        parentPickerFactorStars(parent, 'blue', parentPickerBlueFactors) <
          requiredParentPickerBlueStars
      ) {
        return false;
      }
      if (
        requiredParentPickerAptitudeStars > 0 &&
        parentPickerFactorStars(
          parent,
          'aptitude',
          parentPickerAptitudeFactors,
        ) < requiredParentPickerAptitudeStars
      ) {
        return false;
      }
      if (!normalizedParentSearch) return true;
      const factorText = [
        ...(parent.factors || []),
        ...(parent.ancestors || []).flatMap(
          (ancestor) => ancestor.factors || [],
        ),
      ]
        .map((factor) => factor.name)
        .join(' ');
      return `${parent.name} ${parent.card_id} ${parent.owner_name} ${factorText}`
        .toLowerCase()
        .includes(normalizedParentSearch);
    })
    .sort((left, right) => {
      const direction = parentPickerSortDirection === 'asc' ? 1 : -1;
      const sortValue = (parent: Dashboard['parents'][number]) => {
        if (parentPickerSort === 'compatibility') {
          return parentPickerCompatibility(parent);
        }
        if (parentPickerSort === 'blue') {
          return parentPickerFactorStars(
            parent,
            'blue',
            parentPickerBlueFactors,
          );
        }
        if (parentPickerSort === 'aptitude') {
          return parentPickerFactorStars(
            parent,
            'aptitude',
            parentPickerAptitudeFactors,
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
  const parentPickerHasFilters = Boolean(
    parentPickerSource !== 'all' ||
      parentPickerBlueFactors.length ||
      parentPickerBlueStars ||
      parentPickerAptitudeFactors.length ||
      parentPickerAptitudeStars ||
      parentPickerSort !== 'score' ||
      parentPickerSortDirection !== 'desc',
  );
  const offlineDetailBlockedByActiveCareer = Boolean(
    careerSaveOpen && careerMode === 'offline' && activeCareer?.active,
  );
  const canCreateCareerSave = Boolean(
    newCareerSaveName.trim() &&
      (newCareerMode === 'offline' ||
        presets.some((preset) => preset.name === newCareerPresetName)),
  );
  const createCareerSaveFromDialog = () => {
    if (!canCreateCareerSave) return;
    createCareerSave();
    setNewCareerDialogOpen(false);
  };
  const careerModeSettings = (
    <OfflineCareerSettings
      factorOnly={careerMode === 'online'}
      setup={offlineSetup}
      selectedScenarioId={offlineScenarioId}
      races={races}
      selectedDeckNum={offlineRaceDeckNum}
      setSelectedDeckNum={setOfflineRaceDeckNum}
      busy={busy}
      prepare={prepareOfflineCareer}
      saveDeck={saveOfflineRaceDeck}
      factorSelection={offlineFactorSelection}
      setFactorSelection={setOfflineFactorSelection}
      parents={dashboard.parents}
      umas={dashboard.umas}
      skills={skills}
      prioritySkillIds={offlinePrioritySkillIds}
      setPrioritySkillIds={setOfflinePrioritySkillIds}
      skillSettings={offlineSkillSettings}
      setSkillSettings={setOfflineSkillSettings}
    />
  );
  return activeCareer?.active && !careerSaveOpen ? (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-gray-100">
            {activeCareerIconPath ? (
              <AssetIcon
                path={activeCareerIconPath}
                alt={activeCareer.name}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <Database size={28} className="m-6 text-gray-300" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-bold">进行中的育成</h2>
            <p className="mt-1 font-medium text-gray-800">
              {activeCareer.name}
            </p>
            <p className="text-sm text-gray-500">
              第 {activeCareer.turn || 0} 回合
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abandonCareer}
            disabled={busy === 'abandon'}
            className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {busy === 'abandon' ? '正在放弃…' : '放弃本次育成'}
          </button>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">
          符合当前育成的养马详设
        </h3>
        {matchingCareerSettings.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {matchingCareerSettings.map((setting) => (
              <article
                key={setting.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
              >
                <strong className="block truncate text-sm text-slate-800">
                  {setting.name}
                </strong>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {setting.preset_name}
                </span>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editPresetForCareerSetting(setting.id)}
                    className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    编辑预设
                  </button>
                  <button
                    type="button"
                    onClick={() => continueWithSetting(setting.id)}
                    disabled={Boolean(busy)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Play size={14} />
                    {busy === `resume-${setting.id}` ? '正在继续…' : '继续育成'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            没有找到与当前育成匹配的养马详设。请放弃当前育成后重新选择。
          </p>
        )}
      </div>
    </section>
  ) : offlineDetailBlockedByActiveCareer ? (
    <section>
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <AlertTriangle size={20} className="mt-0.5 flex-none text-amber-600" />
        <div>
          <h2 className="font-semibold">当前普通育成尚未结束</h2>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            游戏仍报告“{activeCareer?.name || '当前育成'}
            ”正在进行，不能启动离线育成详设。
            请先放弃当前育成，或返回详设选择界面。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeCareerEditor}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              返回详设选择界面
            </button>
            <button
              type="button"
              onClick={abandonCareer}
              disabled={busy === 'abandon'}
              className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {busy === 'abandon' ? '正在放弃…' : '放弃当前育成'}
            </button>
          </div>
        </div>
      </div>
    </section>
  ) : !careerSaveOpen && !automationActive ? (
    <>
      <section className="flex-1">
        <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accountCareerSettings.map((setting) => {
            const uma = dashboard.umas.find(
              (item) => item.id === setting.card_id,
            );
            const offline = setting.mode === 'offline';
            const presetExists =
              offline ||
              presets.some((preset) => preset.name === setting.preset_name);
            // A saved setting already has enough information to show its base
            // portrait. Do not wait for the server-side dashboard. Once the
            // owned-card metadata arrives, switch to the exact race cloth.
            const iconPath = characterIconPath(setting.card_id);
            return (
              <article
                key={setting.id}
                className="relative flex h-full flex-col rounded-lg border border-gray-200 bg-gray-50/60 p-3"
              >
                <span
                  className={`absolute right-3 top-3 ${careerSettingModeBadgeClass(offline)}`}
                >
                  {offline ? '离线' : '在线'}
                </span>
                <div className="flex items-start gap-3">
                  <span className="h-16 w-16 flex-none overflow-hidden rounded-md bg-gray-100">
                    {iconPath ? (
                      <AssetIcon
                        path={iconPath}
                        alt={uma?.name || setting.name}
                        className="h-full w-full object-cover"
                        loading="eager"
                      />
                    ) : (
                      <Database size={24} className="m-5 text-gray-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pr-14">
                    <label className="block text-xs text-gray-500">
                      详设名称
                      <input
                        key={`${setting.id}-${setting.name}`}
                        defaultValue={setting.name}
                        onBlur={(event) =>
                          renameCareerSetting(setting.id, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-800"
                      />
                    </label>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {uma?.name || '尚未选择育成马娘'} ·{' '}
                      {offline
                        ? `游戏离线育成 · 槽位 ${setting.offline_race_deck_num || '-'}`
                        : setting.preset_name}
                    </p>
                    {!presetExists ? (
                      <span className="mt-1 block text-xs font-medium text-red-600">
                        绑定预设不存在
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => applyCareerSetting(setting.id)}
                    disabled={!presetExists}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    进入详设
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCareerSetting(setting.id)}
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    aria-label={`删除详设${setting.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}

          <button
            type="button"
            onClick={() => setNewCareerDialogOpen(true)}
            className="flex h-full min-h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-center text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
              <Plus size={22} />
            </span>
            <strong className="mt-3 text-sm text-indigo-950">
              新建养马详设
            </strong>
          </button>
        </div>
      </section>

      {newCareerDialogOpen ? (
        <div className="successionPickerTheme successionPickerOverlay">
          <button
            type="button"
            aria-label="关闭新建养马详设"
            onClick={() => setNewCareerDialogOpen(false)}
            className="absolute inset-0 bg-transparent"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-career-dialog-title"
            className="successionPickerDialog relative max-h-[90vh] w-full max-w-lg"
          >
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2">
                {(['online', 'offline'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNewCareerMode(mode)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      newCareerMode === mode
                        ? 'border-indigo-400 bg-indigo-100 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {mode === 'online' ? '在线自动育成' : '游戏离线育成'}
                  </button>
                ))}
              </div>

              {newCareerMode === 'online' ? (
                <label className="block text-sm font-medium text-slate-700">
                  绑定预设
                  <select
                    value={newCareerPresetName}
                    onChange={(event) =>
                      setNewCareerPresetName(event.target.value)
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">请手动选择预设</option>
                    {presets.map((preset) => (
                      <option key={preset.name} value={preset.name}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="rounded-md bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-700">
                  离线详设不绑定预设。
                </p>
              )}

              <label className="block text-sm font-medium text-slate-700">
                详设名称
                <input
                  value={newCareerSaveName}
                  onChange={(event) => setNewCareerSaveName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createCareerSaveFromDialog();
                  }}
                  placeholder={`例如：URA 详设 ${accountCareerSettings.length + 1}`}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <footer className="successionPickerFooter flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewCareerDialogOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={createCareerSaveFromDialog}
                disabled={!canCreateCareerSave}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                新建并进入
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  ) : (
    <>
      <AppMenuPortal targetId="app-page-secondary-tabs">
        <AppSideNotch side="left">
          <nav className="flex h-10 items-center gap-1 px-2">
            {(careerMode === 'offline'
              ? [
                  ['career-scenario', '剧本'],
                  ['career-uma', '马娘'],
                  ['career-support', '支援卡'],
                  ['offline-career-setup', '赛程'],
                  ['career-factor-options', '因子'],
                  ['career-options', '技能'],
                  ['career-other-options', '其他'],
                ]
              : [
                  ['career-uma', '马娘'],
                  ['career-support', '支援卡'],
                  ['career-factor-options', '因子'],
                  ['career-other-options', '其他'],
                ]
            ).map(([target, label]) => (
              <button
                key={target}
                type="button"
                onClick={() => scrollToSection(target)}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {label}
              </button>
            ))}
          </nav>
        </AppSideNotch>
      </AppMenuPortal>

      <AppMenuPortal targetId="app-page-context-actions">
        <AppSideNotch side="right">
          <div className="flex h-10 items-center gap-1.5 px-2">
            <button
              type="button"
              onClick={closeCareerEditor}
              className="h-7 whitespace-nowrap rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-slate-100"
            >
              返回
            </button>
            {automationActive && careerMode === 'online' ? (
              <button
                type="button"
                onClick={saveAndApplyCareerSetting}
                disabled={Boolean(busy)}
                className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy === 'update-runner' ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {busy === 'update-runner' ? '正在应用…' : '保存并应用'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveCareerSetting}
                  disabled={busy === 'run'}
                  className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <Save size={14} />
                  保存
                </button>
                <button
                  type="button"
                  onClick={saveAndRunCareer}
                  disabled={
                    Boolean(busy) ||
                    (continuingCurrentCareer && !canContinueCurrentCareer) ||
                    (careerMode === 'offline' && !offlineRaceDeckNum)
                  }
                  className="flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play size={14} />
                  {busy === 'run' || busy === 'idle-start'
                    ? dashboard.account.career?.active
                      ? '保存并继续中…'
                      : careerMode === 'offline'
                        ? '启动中…'
                        : '保存并开始中…'
                    : careerMode === 'offline' && !offlineRaceDeckNum
                      ? '请选择赛程槽位'
                      : continuingCurrentCareer
                        ? canContinueCurrentCareer
                          ? '保存并继续'
                          : '详设不匹配'
                        : '保存并开始'}
                </button>
              </>
            )}
          </div>
        </AppSideNotch>
      </AppMenuPortal>

      <section id="career-task" className="scroll-mt-28">
        {!dashboard.account.career?.active ? (
          <div id="career-selection" className="scroll-mt-28 space-y-5">
            {careerMode === 'offline' ? (
              <section
                id="career-scenario"
                className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
              >
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      选择育成剧本
                    </h3>
                    <p className="text-xs text-gray-500">
                      先确定离线育成使用的剧本，再配置马娘、继承与赛程。
                    </p>
                  </div>
                </div>
                <div className="mt-3 max-w-sm">
                  <select
                    value={offlineScenarioId}
                    disabled={Boolean(busy)}
                    onChange={(event) =>
                      changeOfflineScenario(Number(event.target.value))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value={0}>自动选择最新可用剧本</option>
                    {offlineScenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                  {offlineSetup ? (
                    <p className="mt-2 text-xs text-slate-500">
                      当前主剧本：
                      <strong className="ml-1 text-slate-800">
                        {offlineSetup.scenario_name ||
                          `剧本 ${offlineSetup.scenario_id}`}
                      </strong>
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
            <div
              id="career-uma"
              className="scroll-mt-28 grid gap-5 xl:grid-cols-3"
            >
              <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {careerMode === 'offline' ? 2 : 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        选择育成马娘
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="mt-3 max-w-xl">
                  <SuccessionPickerTrigger
                    label="育成马娘"
                    selected={Boolean(selectedUma)}
                    required
                    portrait={
                      selectedUma ? (
                        <PlannerPortrait
                          path={characterIconPath(selectedUma.id) || ''}
                          alt={selectedUma.name}
                        />
                      ) : null
                    }
                    onOpen={() => setUmaPickerOpen(true)}
                  >
                    {selectedUma ? (
                      <>
                        <strong>{selectedUma.name}</strong>
                        <small className="mt-1 block text-gray-500">
                          角色 ID {selectedUma.chara_id} · 才能等级{' '}
                          {selectedUma.talent_level}
                        </small>
                      </>
                    ) : null}
                  </SuccessionPickerTrigger>
                </div>
              </section>

              {umaPickerOpen ? (
                <SuccessionPickerDialog
                  ariaLabel="选择育成马娘"
                  eyebrow="SELECT UMAMUSUME"
                  title="正在选择育成马娘"
                  description="点击卡片选择，可继续切换；使用右上角按钮关闭。"
                  onClose={() => setUmaPickerOpen(false)}
                  searchValue={umaPickerSearch}
                  searchPlaceholder="输入马娘名称或 ID"
                  searchAriaLabel="搜索育成马娘"
                  onSearchChange={setUmaPickerSearch}
                  meta={
                    <>
                      <span>找到 {pickerUmas.length} 位马娘</span>
                      {umaPickerSearch ? (
                        <button
                          type="button"
                          onClick={() => setUmaPickerSearch('')}
                        >
                          清空搜索
                        </button>
                      ) : null}
                    </>
                  }
                  bodyClassName="successionPickerGrid"
                >
                  {pickerUmas.length ? (
                    pickerUmas.map((uma) => {
                      const selected = cardId === uma.id;
                      return (
                        <PlannerSelectionCard
                          selected={selected}
                          portrait={
                            <PlannerPortrait
                              path={characterIconPath(uma.id) || ''}
                              alt={uma.name}
                              size="large"
                            />
                          }
                          title={uma.name}
                          subtitle={`角色 ID ${uma.chara_id} · 才能等级 ${uma.talent_level}`}
                          onClick={() => {
                            setCardId(uma.id);
                            setDeckId(0);
                            setSupportCardIds([]);
                            setFriendCardId(0);
                            setParent1('');
                            setParent2('');
                            resetOfflineCareer();
                          }}
                          key={uma.id}
                        />
                      );
                    })
                  ) : (
                    <div className="successionPickerEmpty">
                      <strong>没有符合条件的马娘</strong>
                      <p>尝试修改名称、ID，或清空搜索。</p>
                      <button
                        type="button"
                        onClick={() => setUmaPickerSearch('')}
                      >
                        清空搜索
                      </button>
                    </div>
                  )}
                </SuccessionPickerDialog>
              ) : null}

              <section
                className={`rounded-lg border p-4 xl:col-span-2 ${
                  selectedUma
                    ? 'border-gray-200 bg-gray-50/60'
                    : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {careerMode === 'offline' ? 2 : 1}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        选择继承马娘
                      </h3>
                    </div>
                  </div>
                </div>

                {!selectedUma ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    请先完成第 1 步，选择要养的马娘。
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {[
                      [1, selectedParent1],
                      [2, selectedParent2],
                    ].map(([slot, parent]) => {
                      const slotNumber = slot as 1 | 2;
                      const selectedParent = parent as
                        | Dashboard['parents'][number]
                        | undefined;
                      const otherParent =
                        slotNumber === 1 ? selectedParent2 : selectedParent1;
                      const compatibility = selectedParent
                        ? parentCompatibilityPreview(
                            selectedUma.chara_id,
                            selectedParent,
                            otherParent,
                            successionG1SaddleIds,
                          )
                        : undefined;
                      return (
                        <SuccessionPickerTrigger
                          key={slotNumber}
                          label={`继承马娘 ${slotNumber}`}
                          selected={Boolean(selectedParent)}
                          required
                          portrait={
                            selectedParent ? (
                              <PlannerPortrait
                                path={
                                  characterIconPath(selectedParent.card_id) ||
                                  ''
                                }
                                alt={selectedParent.name}
                              />
                            ) : null
                          }
                          placeholder={`请选择继承马娘 ${slotNumber}`}
                          onOpen={() => setParentPickerSlot(slotNumber)}
                          onClear={
                            selectedParent
                              ? () =>
                                  slotNumber === 1
                                    ? setParent1('')
                                    : setParent2('')
                              : undefined
                          }
                        >
                          {selectedParent ? (
                            <>
                              <strong>{selectedParent.name}</strong>
                              <small className="mt-1 block text-gray-500">
                                {selectedParent.source === 'rental'
                                  ? `借用 · ${selectedParent.owner_name || '未知玩家'}`
                                  : '自己的马娘'}
                                {selectedParent.rank_score
                                  ? ` · 评分 ${selectedParent.rank_score}`
                                  : ''}
                                {compatibility
                                  ? ` · 契合度 ${compatibility.total}`
                                  : ''}
                              </small>
                            </>
                          ) : null}
                        </SuccessionPickerTrigger>
                      );
                    })}
                  </div>
                )}
              </section>

              {selectedUma && parentPickerSlot ? (
                <SuccessionPickerDialog
                  ariaLabel={`选择继承马娘 ${parentPickerSlot}`}
                  title={`正在选择继承位 ${parentPickerSlot}`}
                  description="点击卡片为当前继承位选择，可继续切换；使用右上角按钮关闭。"
                  onClose={() => setParentPickerSlot(null)}
                  dialogClassName="successionCapturedPickerDialog"
                  searchValue={parentPickerSearch}
                  searchPlaceholder="搜索马娘、因子、玩家或 ID"
                  searchAriaLabel="搜索已有马娘"
                  onSearchChange={setParentPickerSearch}
                  meta={
                    parentPickerHasFilters ? (
                      <button
                        type="button"
                        onClick={() => {
                          setParentPickerSource('all');
                          setParentPickerBlueFactors([]);
                          setParentPickerBlueStars(0);
                          setParentPickerAptitudeFactors([]);
                          setParentPickerAptitudeStars(0);
                          setParentPickerSort('score');
                          setParentPickerSortDirection('desc');
                        }}
                      >
                        清空筛选
                      </button>
                    ) : null
                  }
                >
                  <div className="successionCapturedPickerFilters border-b border-slate-200 bg-slate-50/80 px-3 py-2">
                    <div className="grid gap-2 xl:grid-cols-[minmax(280px,0.85fr)_minmax(440px,1.35fr)]">
                      <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <strong className="text-xs text-slate-700">
                            基础筛选
                          </strong>
                          <span className="text-[11px] text-slate-400">
                            属性可多选
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="w-12 text-[11px] font-medium text-slate-500">
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
                              aria-pressed={parentPickerSource === value}
                              onClick={() => setParentPickerSource(value)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                parentPickerSource === value
                                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="my-2 border-t border-slate-100" />
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="w-12 text-[11px] font-medium text-slate-500">
                            属性
                          </span>
                          <button
                            type="button"
                            aria-pressed={!parentPickerBlueFactors.length}
                            onClick={() => setParentPickerBlueFactors([])}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                              !parentPickerBlueFactors.length
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                            }`}
                          >
                            任意
                          </button>
                          {PARENT_BLUE_FACTOR_OPTIONS.map((factor) => {
                            const selected = parentPickerBlueFactors.includes(
                              factor.factor_group_id,
                            );
                            return (
                              <button
                                key={factor.factor_group_id}
                                type="button"
                                aria-label={factor.name}
                                title={factor.name}
                                aria-pressed={selected}
                                onClick={() =>
                                  setParentPickerBlueFactors((current) =>
                                    selected
                                      ? current.filter(
                                          (id) => id !== factor.factor_group_id,
                                        )
                                      : [...current, factor.factor_group_id],
                                  )
                                }
                                className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                  selected
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                                }`}
                              >
                                {factor.abbreviation}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="w-12 text-[11px] font-medium text-slate-500">
                            星级
                          </span>
                          {[0, 1, 2, 3].map((stars) => (
                            <button
                              key={stars}
                              type="button"
                              aria-pressed={parentPickerBlueStars === stars}
                              onClick={() => setParentPickerBlueStars(stars)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                parentPickerBlueStars === stars
                                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                              }`}
                            >
                              {stars ? `${stars}★` : '不限'}
                            </button>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <strong className="text-xs text-slate-700">
                            本体适应性因子
                          </strong>
                          <button
                            type="button"
                            onClick={() => setParentPickerAptitudeFactors([])}
                            className={`successionCapturedPickerCompactControl rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              !parentPickerAptitudeFactors.length
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'
                            }`}
                          >
                            任意类型
                          </button>
                        </div>
                        <div className="space-y-2">
                          {PARENT_APTITUDE_FACTOR_GROUPS.map((group) => (
                            <div
                              key={group.label}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <span className="w-12 text-[11px] font-medium text-slate-500">
                                {group.label}
                              </span>
                              {group.factors.map((factor) => {
                                const selected =
                                  parentPickerAptitudeFactors.includes(
                                    factor.factor_group_id,
                                  );
                                return (
                                  <button
                                    key={factor.factor_group_id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() =>
                                      setParentPickerAptitudeFactors(
                                        (current) =>
                                          selected
                                            ? current.filter(
                                                (id) =>
                                                  id !== factor.factor_group_id,
                                              )
                                            : [
                                                ...current,
                                                factor.factor_group_id,
                                              ],
                                      )
                                    }
                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                      selected
                                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                                    }`}
                                  >
                                    {factor.name}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                            <span className="w-12 text-[11px] font-medium text-slate-500">
                              星级
                            </span>
                            {[0, 1, 2, 3].map((stars) => (
                              <button
                                key={stars}
                                type="button"
                                aria-pressed={
                                  parentPickerAptitudeStars === stars
                                }
                                onClick={() =>
                                  setParentPickerAptitudeStars(stars)
                                }
                                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                                  parentPickerAptitudeStars === stars
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'
                                }`}
                              >
                                {stars ? `${stars}★` : '不限'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>
                    </div>

                    <section className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong className="mr-1 text-xs text-slate-700">
                          排序
                        </strong>
                        {(
                          [
                            ['score', '养成评价'],
                            ['compatibility', '契合度'],
                            ['blue', '属性星级'],
                            ['aptitude', '适应性星级'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={parentPickerSort === value}
                            onClick={() => setParentPickerSort(value)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                              parentPickerSort === value
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
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
                            aria-pressed={parentPickerSortDirection === value}
                            onClick={() => setParentPickerSortDirection(value)}
                            className={`successionCapturedPickerCompactControl rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                              parentPickerSortDirection === value
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
                  {pickerParents.length ? (
                    <div className="successionCapturedPickerGrid">
                      {pickerParents.map((parent) => {
                        const currentValue =
                          parentPickerSlot === 1 ? parent1 : parent2;
                        const otherValue =
                          parentPickerSlot === 1 ? parent2 : parent1;
                        const otherParent = dashboard.parents.find(
                          (item) => item.selection_id === otherValue,
                        );
                        const blockedCharaIds = new Set([
                          selectedUma.chara_id,
                          otherParent?.chara_id || 0,
                        ]);
                        const compatibility = parentCompatibilityPreview(
                          selectedUma.chara_id,
                          parent,
                          otherParent,
                          successionG1SaddleIds,
                        );
                        return (
                          <ParentChoiceCard
                            key={parent.selection_id}
                            parent={parent}
                            selected={currentValue === parent.selection_id}
                            disabled={
                              otherValue === parent.selection_id ||
                              blockedCharaIds.has(parent.chara_id) ||
                              (parent.source === 'rental' &&
                                otherParent?.source === 'rental')
                            }
                            compatibility={compatibility}
                            onSelect={() => {
                              if (parentPickerSlot === 1) {
                                setParent1(parent.selection_id);
                              } else {
                                setParent2(parent.selection_id);
                              }
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="successionCapturedPickerEmpty">
                      没有符合当前搜索或筛选条件的已有马娘。
                    </div>
                  )}
                </SuccessionPickerDialog>
              ) : null}
            </div>

            <section
              id="career-support"
              className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {careerMode === 'offline' ? 3 : 2}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">选择支援卡组</h3>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap content-start gap-3">
                {dashboard.decks.map((deck) => {
                  const deckCharaIds = deck.cards.map(
                    (support) => support.chara_id,
                  );
                  const reservedCharaIds = new Set([
                    selectedUma?.chara_id || 0,
                    selectedFriendSupport?.chara_id || 0,
                  ]);
                  const disabled =
                    deck.cards.length !== 5 ||
                    new Set(deckCharaIds).size !== deckCharaIds.length ||
                    deckCharaIds.some((charaId) =>
                      reservedCharaIds.has(charaId),
                    );
                  return (
                    <DeckChoiceCard
                      key={deck.id}
                      deck={deck}
                      selected={deckId === deck.id}
                      disabled={disabled}
                      onSelect={() => {
                        setDeckId(deck.id);
                        setSupportCardIds(deck.support_card_ids);
                      }}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    {careerMode === 'offline' ? 3 : 2}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      选择好友支援卡
                    </h3>
                    <p className="text-xs text-gray-500">
                      只允许借用满破满级支援。
                    </p>
                  </div>
                </div>
                <label className="relative block w-full sm:w-80">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    value={supportSearch}
                    onChange={(event) => setSupportSearch(event.target.value)}
                    placeholder="搜索支援卡名称或类型"
                    className="w-full cursor-text select-text rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshOptionsIndex}
                  disabled={!selectedAccountId || busy === 'options-index'}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={busy === 'options-index' ? 'animate-spin' : ''}
                  />
                  {busy === 'options-index'
                    ? '正在刷新 …'
                    : `刷新 好友支援卡列表${availableFriendSupportIds.size ? `（${availableFriendSupportIds.size} 张可借）` : ''}`}
                </button>
              </div>
              <div className="mt-3 flex max-h-[460px] flex-wrap content-start gap-1.5 overflow-auto pr-1">
                {visibleFriendSupports.map((support) => {
                  const reservedCharaIds = new Set([
                    selectedUma?.chara_id || 0,
                    ...selectedDeckCharaIds,
                  ]);
                  return (
                    <SupportChoiceCard
                      key={support.id}
                      support={support}
                      selected={friendCardId === support.id}
                      disabled={reservedCharaIds.has(support.chara_id)}
                      onSelect={() => setFriendCardId(support.id)}
                    />
                  );
                })}
              </div>
              {!visibleFriendSupports.length && busy !== 'options-index' ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  当前没有找到符合条件的满破满级好友支援。
                </div>
              ) : null}
            </section>

            {selectionConflict ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {selectionConflict}
              </div>
            ) : null}

            <div className="flex flex-col">{careerModeSettings}</div>

            <section
              id="career-other-options"
              className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {careerMode === 'online' ? 4 : 7}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">编辑其他设置</h3>
                </div>
              </div>

              <div
                className="mt-4 grid auto-rows-fr gap-2"
                style={{
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))',
                }}
              >
                {careerMode === 'online' ? (
                  <>
                    <button
                      type="button"
                      onClick={editCareerPreset}
                      className="flex min-h-20 items-start rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <span>
                        <strong className="block font-medium text-slate-800">
                          {careerPresetName}
                        </strong>
                        <span className="mt-0.5 block text-xs font-medium text-indigo-600">
                          编辑“{careerPresetName}”的预设配置 →
                        </span>
                      </span>
                    </button>
                    <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={burnClocks}
                        onChange={(event) =>
                          setBurnClocks(event.target.checked)
                        }
                        className="mt-1"
                      />
                      <span>
                        <strong className="block font-medium text-slate-800">
                          比赛失败时使用闹钟
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          失败后有可用闹钟时自动继续；当前有{' '}
                          {dashboard.account.clocks || 0} 个
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}
                <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={recoverTpWithItem}
                    onChange={(event) =>
                      setRecoverTpWithItem(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong className="block font-medium text-slate-800">
                      TP不足时使用体力药
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      优先使用能量饮料30；当前有{' '}
                      {dashboard.account.energy_drinks || 0} 个
                    </span>
                  </span>
                </label>
                <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={recoverTpWithJewels}
                    onChange={(event) =>
                      setRecoverTpWithJewels(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong className="block font-medium text-slate-800">
                      仍不足时允许使用宝石
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      会实际消耗宝石恢复TP，默认关闭
                    </span>
                  </span>
                </label>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </>
  );
}
