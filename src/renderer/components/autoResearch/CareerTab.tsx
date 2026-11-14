/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import {
  Dispatch,
  memo,
  SetStateAction,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  CloudDownload,
  CloudUpload,
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
  SuccessionPickerFilterSheet,
  SuccessionPickerTrigger,
} from 'renderer/components/succession/SuccessionPicker';
import {
  PlannerButton,
  PlannerPortrait,
  PlannerSelectionCard,
} from 'renderer/components/succession/PlannerComponents';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import {
  inheritedCareerAptitudes,
  OfflineDesign,
} from 'renderer/utils/offlineCareerDesign';
import useScrollLoadMore from './useScrollLoadMore';
import { PLANNER_CATALOG } from 'renderer/utils/racePlannerCatalog';
import { UmaAptitudeRows } from 'renderer/ui/SuccessionPlanner';
import {
  matchesParentFactorFilters,
  ParentFactorFilter,
} from 'renderer/utils/parentFactorFilters';
import AppFloatingAction from '../AppFloatingAction';
import OfflineCareerSettings from './OfflineCareerSettings';
import OfflineDesignSettings, {
  OfflineCustomSchedule,
} from './OfflineDesignSettings';
import {
  DeckChoiceCard,
  ParentChoiceCard,
  SupportChoiceCard,
  umaSkinIconPath,
} from './SelectionCards';
import { careerSettingModeBadgeClass, scrollToSection } from './shared';
import { parentCompatibilityPreview } from './successionCompatibility';
import { AutoResearchSkill } from './SkillSelector';
import ParentFactorFilters, {
  PARENT_APTITUDE_FACTOR_GROUPS,
} from './ParentFactorFilters';
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

import './CareerSelection.css';

type CareerTabProps = {
  readOnly?: boolean;
  careerDirty?: boolean;
  validationErrors?: Record<string, string>;
  dashboard: Dashboard;
  careerSaveOpen: boolean;
  accountCareerSettings: CareerSetting[];
  matchingCareerSettings: CareerSetting[];
  applyCareerSetting: (settingId: string) => void;
  editPresetForCareerSetting: (settingId: string) => void;
  continueWithSetting: (settingId: string) => void;
  deleteCareerSetting: (settingId: string) => void;
  uploadCareerSetting: (settingId: string) => Promise<void>;
  pullCloudConfiguration: () => Promise<void>;
  cloudCareerConfigIds: Set<string>;
  newCareerSaveName: string;
  setNewCareerSaveName: Dispatch<SetStateAction<string>>;
  createCareerSave: (goal?: OfflineDesign['goal']) => void;
  automationActive: boolean;
  busy: string;
  activeCareer?: SessionAccount['career'];
  activeCareerIconPath?: string;
  abandonCareer: () => Promise<void>;
  continuingCurrentCareer: boolean;
  canContinueCurrentCareer: boolean;
  saveCareerSetting: () => Promise<boolean>;
  saveAndApplyCareerSetting: () => Promise<void>;
  saveAndRunCareer: () => Promise<void>;
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
  clockUseLimit: number;
  setClockUseLimit: Dispatch<SetStateAction<number>>;
  recoverTpWithItem: boolean;
  setRecoverTpWithItem: Dispatch<SetStateAction<boolean>>;
  recoverTpWithJewels: boolean;
  setRecoverTpWithJewels: Dispatch<SetStateAction<boolean>>;
  transferMode?: 'keep' | 'direct';
  setTransferMode?: (mode: 'keep' | 'direct') => void;
  selectionConflict: string;
  refreshOptionsIndex: () => Promise<void>;
  renameCareerSetting: (settingId: string, name: string) => void;
  selectedAccountId: string;
  careerMode: 'online' | 'offline';
  offlineSetup: OfflineSingleModeSetup | null;
  offlineScenarios: Dashboard['offline_scenarios'];
  offlineScenarioId: number;
  changeOfflineScenario: (scenarioId: number) => void;
  offlineRunningStyle: number;
  setOfflineRunningStyle: Dispatch<SetStateAction<number>>;
  offlineRaceDeckNum: number;
  offlineDesign: OfflineDesign;
  setOfflineDesign: Dispatch<SetStateAction<OfflineDesign>>;
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

const PARENT_APTITUDE_FACTOR_GROUP_IDS = new Set(
  PARENT_APTITUDE_FACTOR_GROUPS.flatMap((group) =>
    group.factors.map((factor) => factor.factor_group_id),
  ),
);

const CHARACTER_BY_ID = new Map(
  PLANNER_CATALOG.characters.map((item) => [item.id, item]),
);

const INITIAL_PARENT_PICKER_LIMIT = 48;
const PARENT_PICKER_BATCH_SIZE = 60;

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

function CareerTab(props: CareerTabProps) {
  const {
    readOnly = false,
    dashboard,
    careerSaveOpen,
    accountCareerSettings,
    matchingCareerSettings,
    applyCareerSetting,
    editPresetForCareerSetting,
    continueWithSetting,
    deleteCareerSetting,
    uploadCareerSetting,
    pullCloudConfiguration,
    cloudCareerConfigIds,
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
    careerDirty = false,
    validationErrors = {},
    saveAndApplyCareerSetting,
    saveAndRunCareer,
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
    clockUseLimit,
    setClockUseLimit,
    recoverTpWithItem,
    setRecoverTpWithItem,
    recoverTpWithJewels,
    setRecoverTpWithJewels,
    transferMode = 'keep',
    setTransferMode,
    selectionConflict,
    refreshOptionsIndex,
    renameCareerSetting,
    selectedAccountId,
    careerMode,
    offlineSetup,
    offlineScenarios,
    offlineScenarioId,
    changeOfflineScenario,
    offlineRunningStyle,
    setOfflineRunningStyle,
    offlineRaceDeckNum,
    offlineDesign,
    setOfflineDesign,
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
  const [newCareerGoal, setNewCareerGoal] =
    useState<OfflineDesign['goal']>('breeding');
  const [umaPickerOpen, setUmaPickerOpen] = useState(false);
  const [umaPickerSearch, setUmaPickerSearch] = useState('');
  const [parentPickerSlot, setParentPickerSlot] = useState<1 | 2 | null>(null);
  const [parentPickerSearch, setParentPickerSearch] = useState('');
  const [parentPickerSource, setParentPickerSource] =
    useState<ParentPickerSource>('all');
  const [parentPickerFactorFilters, setParentPickerFactorFilters] = useState<
    ParentFactorFilter[]
  >([]);
  const parentPickerBlueFactors = parentPickerFactorFilters
    .filter((item) => item.groupId <= 5)
    .map((item) => item.groupId);
  const parentPickerAptitudeFactors = parentPickerFactorFilters
    .filter((item) => item.groupId > 5)
    .map((item) => item.groupId);
  const [parentPickerSort, setParentPickerSort] =
    useState<ParentPickerSort>('score');
  const [parentPickerSortDirection, setParentPickerSortDirection] =
    useState<ParentPickerSortDirection>('desc');
  const [successionG1SaddleIds, setSuccessionG1SaddleIds] = useState<number[]>(
    [],
  );
  useEffect(() => {
    if (readOnly) return undefined;
    loadUMDB()
      .then(() => setSuccessionG1SaddleIds([...UMDB.successionG1SaddleIds]))
      .catch(() => setSuccessionG1SaddleIds([]));
    return undefined;
  }, [readOnly]);
  useEffect(() => {
    if (!newCareerDialogOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNewCareerDialogOpen(false);
    };
    const handleBack = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      setNewCareerDialogOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('autouma:back', handleBack, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('autouma:back', handleBack, true);
    };
  }, [newCareerDialogOpen]);
  const deferredUmaSearch = useDeferredValue(umaPickerSearch);
  const normalizedUmaSearch = deferredUmaSearch.trim().toLowerCase();
  const selectedUmaBase = selectedUma
    ? CHARACTER_BY_ID.get(selectedUma.chara_id)
    : undefined;
  const selectedUmaAptitudes = useMemo(
    () =>
      selectedUmaBase
        ? inheritedCareerAptitudes(selectedUmaBase.aptitudes, [
            selectedParent1,
            selectedParent2,
          ])
        : undefined,
    [selectedParent1, selectedParent2, selectedUmaBase],
  );
  const umaById = useMemo(
    () => new Map(dashboard.umas.map((item) => [item.id, item])),
    [dashboard.umas],
  );
  const presetNameSet = useMemo(
    () => new Set(presets.map((preset) => preset.name)),
    [presets],
  );
  const parentBySelectionId = useMemo(
    () => new Map(dashboard.parents.map((item) => [item.selection_id, item])),
    [dashboard.parents],
  );
  const pickerUmas = useMemo(() => {
    if (!umaPickerOpen) return [];
    return dashboard.umas.filter(
      (uma) =>
        !normalizedUmaSearch ||
        `${uma.name} ${uma.id}`.toLowerCase().includes(normalizedUmaSearch),
    );
  }, [dashboard.umas, normalizedUmaSearch, umaPickerOpen]);
  const deferredParentSearch = useDeferredValue(parentPickerSearch);
  const normalizedParentSearch = deferredParentSearch.trim().toLowerCase();
  const parentPickerOtherParent =
    parentPickerSlot === 1 ? selectedParent2 : selectedParent1;
  const [visibleParentLimit, setVisibleParentLimit] = useState(
    INITIAL_PARENT_PICKER_LIMIT,
  );
  useEffect(() => {
    if (parentPickerSlot) {
      setVisibleParentLimit(INITIAL_PARENT_PICKER_LIMIT);
    }
  }, [
    normalizedParentSearch,
    parentPickerFactorFilters,
    parentPickerSlot,
    parentPickerSort,
    parentPickerSortDirection,
    parentPickerSource,
  ]);
  const { pickerParents, compatibilityBySelectionId } = useMemo(() => {
    const compatibilityMap = new Map<
      string,
      ReturnType<typeof parentCompatibilityPreview>
    >();
    if (!selectedUma || !parentPickerSlot) {
      return {
        pickerParents: [] as Dashboard['parents'],
        compatibilityBySelectionId: compatibilityMap,
      };
    }
    const filtered = dashboard.parents.filter((parent) => {
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
      if (!matchesParentFactorFilters(parent, parentPickerFactorFilters))
        return false;
      if (!normalizedParentSearch) return true;
      const factorText = [
        ...(parent.factors || []),
        ...(parent.ancestors || []).flatMap(
          (ancestor) => ancestor.factors || [],
        ),
      ]
        .map((factor) => factor.name)
        .join(' ');
      return `${parent.name} ${parent.card_id} ${parent.viewer_id || ''} ${parent.owner_name} ${factorText}`
        .toLowerCase()
        .includes(normalizedParentSearch);
    });
    filtered.forEach((parent) => {
      compatibilityMap.set(
        parent.selection_id,
        parentCompatibilityPreview(
          selectedUma.chara_id,
          parent,
          parentPickerOtherParent,
          successionG1SaddleIds,
        ),
      );
    });
    const direction = parentPickerSortDirection === 'asc' ? 1 : -1;
    const sortValue = (parent: Dashboard['parents'][number]) => {
      if (parentPickerSort === 'compatibility') {
        return compatibilityMap.get(parent.selection_id)?.total || 0;
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
    const sorted = [...filtered].sort(
      (left, right) =>
        (sortValue(left) - sortValue(right)) * direction ||
        (left.rank_score - right.rank_score) * direction ||
        (left.rank - right.rank) * direction,
    );
    return {
      pickerParents: sorted,
      compatibilityBySelectionId: compatibilityMap,
    };
  }, [
    dashboard.parents,
    normalizedParentSearch,
    parentPickerAptitudeFactors,
    parentPickerBlueFactors,
    parentPickerFactorFilters,
    parentPickerOtherParent,
    parentPickerSlot,
    parentPickerSort,
    parentPickerSortDirection,
    parentPickerSource,
    selectedUma,
    successionG1SaddleIds,
  ]);
  const visiblePickerParents = pickerParents.slice(0, visibleParentLimit);
  const parentLoadMoreRef = useScrollLoadMore({
    enabled: Boolean(
      parentPickerSlot !== null && pickerParents.length > visibleParentLimit,
    ),
    onLoadMore: () =>
      setVisibleParentLimit((current) => current + PARENT_PICKER_BATCH_SIZE),
    itemCount: visiblePickerParents.length,
    resetKey: `${parentPickerSlot ?? 0}:${pickerParents.length}`,
  });
  const deckReservedCharaIds = useMemo(
    () =>
      new Set([
        selectedUma?.chara_id || 0,
        selectedFriendSupport?.chara_id || 0,
      ]),
    [selectedFriendSupport?.chara_id, selectedUma?.chara_id],
  );
  const friendReservedCharaIds = useMemo(
    () => new Set([selectedUma?.chara_id || 0, ...selectedDeckCharaIds]),
    [selectedDeckCharaIds, selectedUma?.chara_id],
  );
  const parentPickerHasFilters = Boolean(
    parentPickerSource !== 'all' ||
      parentPickerFactorFilters.length ||
      parentPickerSort !== 'score' ||
      parentPickerSortDirection !== 'desc',
  );
  const offlineDetailBlockedByActiveCareer = Boolean(
    careerSaveOpen && careerMode === 'offline' && activeCareer?.active,
  );
  const canCreateCareerSave = Boolean(newCareerSaveName.trim());
  const createCareerSaveFromDialog = () => {
    if (!canCreateCareerSave) return;
    createCareerSave(newCareerMode === 'offline' ? newCareerGoal : 'breeding');
    setNewCareerDialogOpen(false);
  };
  const careerModeSettings = (
    <OfflineCareerSettings
      factorOnly={careerMode === 'online'}
      customSchedule={offlineDesign.source === 'custom'}
      setCustomSchedule={(custom) => {
        setOfflineDesign((current) => ({
          ...current,
          source: custom ? 'custom' : 'api',
        }));
        if (custom && !offlineScenarioId) changeOfflineScenario(5);
      }}
      customRaceCount={offlineDesign.raceIds.length}
      customScheduleContent={
        <OfflineCustomSchedule
          design={offlineDesign}
          setDesign={setOfflineDesign}
          charaId={selectedUma?.chara_id || 0}
          scenarioId={offlineScenarioId}
          disabled={Boolean(busy)}
        />
      }
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
          <span className="h-20 w-20 flex-none">
            {activeCareerIconPath ? (
              <AssetIcon
                path={activeCareerIconPath}
                alt={activeCareer.name}
                className="h-full w-full object-contain"
                loading="eager"
              />
            ) : (
              <Database size={28} className="m-6 text-gray-300" />
            )}
          </span>
          <div>
            <h2 className="text-section font-semibold">进行中的育成</h2>
            <p className="mt-1 font-medium text-gray-800">
              {activeCareer.name}
            </p>
            <p className="uma-prose text-data text-gray-500">
              第 {activeCareer.turn || 0} 回合
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abandonCareer}
            disabled={busy === 'abandon'}
            className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-data font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {busy === 'abandon' ? '正在放弃…' : '放弃本次育成'}
          </button>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-data font-semibold text-slate-800">
          符合当前育成的养马详设
        </h3>
        {matchingCareerSettings.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {matchingCareerSettings.map((setting) => (
              <article
                key={setting.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
              >
                <strong className="block truncate text-data text-slate-800">
                  {setting.name}
                </strong>
                <span className="mt-0.5 block truncate text-caption text-slate-500">
                  {setting.preset_name}
                </span>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => editPresetForCareerSetting(setting.id)}
                    className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-caption font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    编辑预设
                  </button>
                  <button
                    type="button"
                    onClick={() => continueWithSetting(setting.id)}
                    disabled={Boolean(busy)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-caption font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Play size={14} />
                    {busy === `resume-${setting.id}` ? '正在继续…' : '继续育成'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="uma-prose mt-3 rounded-lg bg-slate-50 px-3 py-4 text-data text-slate-500">
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
          <h2 className="text-section font-semibold">当前普通育成尚未结束</h2>
          <p className="uma-prose mt-1 text-data leading-6 text-amber-800">
            游戏仍报告“{activeCareer?.name || '当前育成'}
            ”正在进行，不能启动离线育成详设。
            请先放弃当前育成，或返回详设选择界面。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeCareerEditor}
              className="rounded-md border border-amber-300 bg-white px-3 py-2 text-data font-medium text-amber-900 hover:bg-amber-100"
            >
              返回详设选择界面
            </button>
            <button
              type="button"
              onClick={abandonCareer}
              disabled={busy === 'abandon'}
              className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-data font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={15} />
              {busy === 'abandon' ? '正在放弃…' : '放弃当前育成'}
            </button>
          </div>
        </div>
      </div>
    </section>
  ) : !careerSaveOpen && !automationActive ? (
    <div className="autoResearchForm contents">
      <section className="autoResearchSettingsList flex-1">
        <div className="mb-3 flex items-center gap-2 sm:hidden">
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setNewCareerDialogOpen(true)}
              className="uma-clay-button-primary inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 px-3 text-data font-semibold"
            >
              <Plus size={16} />
              <span>新建育成设置</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={pullCloudConfiguration}
            disabled={busy === 'cloud-config-pull'}
            className={`uma-clay-button inline-flex min-h-10 items-center justify-center gap-1.5 px-3.5 text-data font-semibold disabled:opacity-50 ${readOnly ? 'flex-1' : 'shrink-0'}`}
          >
            <CloudDownload
              size={16}
              className={busy === 'cloud-config-pull' ? 'animate-spin' : ''}
            />
            <span>
              {busy === 'cloud-config-pull' ? '拉取中…' : '拉取云端'}
            </span>
          </button>
        </div>
        <AppFloatingAction>
          <button
            type="button"
            onClick={pullCloudConfiguration}
            disabled={busy === 'cloud-config-pull'}
            className="uma-clay-button-primary text-label font-semibold disabled:opacity-50"
            title="拉取云端"
          >
            <CloudDownload size={15} />
            <span>
              {busy === 'cloud-config-pull' ? '拉取中…' : '拉取云端'}
            </span>
          </button>
        </AppFloatingAction>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accountCareerSettings.map((setting) => {
            const uma = umaById.get(setting.card_id);
            const offline = setting.mode === 'offline';
            const presetExists =
              offline || presetNameSet.has(setting.preset_name);
            // The card id is enough to derive its costume. Once owned-card
            // metadata arrives, prefer the exact rarity and race cloth.
            const iconPath = umaSkinIconPath(
              setting.card_id,
              uma?.rarity,
              uma?.race_cloth_id,
            );
            return (
              <article
                key={setting.id}
                className="uma-setting-card relative flex h-full flex-col p-4"
              >
                <span
                  className={`absolute right-3 top-3 ${careerSettingModeBadgeClass(offline)}`}
                >
                  {offline ? '离线' : '在线'}
                </span>
                <div className="flex items-start gap-3">
                  <span className="h-16 w-16 flex-none" title={uma?.name}>
                    {iconPath ? (
                      <AssetIcon
                        path={iconPath}
                        alt={uma?.name || setting.name}
                        className="h-full w-full object-contain"
                        loading="eager"
                      />
                    ) : (
                      <Database size={24} className="m-5 text-gray-300" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 pr-14">
                    {readOnly ? (
                      <div className="block text-caption text-gray-500">
                        <span className="sr-only">详设名称</span>
                        <strong className="block truncate py-1 text-data text-gray-800">
                          {setting.name}
                        </strong>
                      </div>
                    ) : (
                      <label className="block text-label text-gray-500">
                        <span className="sr-only">详设名称</span>
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
                          className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-data font-semibold text-gray-800"
                        />
                      </label>
                    )}
                    <p className="mt-1 truncate text-label text-gray-500">
                      {!uma && !iconPath ? '尚未选择育成马娘 · ' : ''}
                      {offline
                        ? `${setting.offline_design?.goal === 'jewels' ? '挂钻' : setting.offline_design?.goal === 'fans' ? '刷粉丝' : '种马'} · ${setting.offline_design?.source === 'custom' ? `自定义 ${setting.offline_design.raceIds.length} 场` : `槽位 ${setting.offline_race_deck_num || '-'}`}`
                        : `预设：${setting.preset_name}`}
                    </p>
                    {!presetExists ? (
                      <span className="mt-1 block text-caption font-medium text-red-600">
                        绑定预设不存在
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      readOnly
                        ? continueWithSetting(setting.id)
                        : applyCareerSetting(setting.id)
                    }
                    disabled={!presetExists}
                    className="uma-clay-button-primary min-h-10 flex-1 px-3 py-2 text-data font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
                  >
                    {readOnly ? '选择并设置运行方式' : '进入详设'}
                  </button>
                  {!readOnly ? (
                    <>
                      <button
                        type="button"
                        onClick={() => uploadCareerSetting(setting.id)}
                        disabled={busy === `career-cloud-upload:${setting.id}`}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-2 text-caption font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 sm:min-h-9"
                        title={
                          cloudCareerConfigIds.has(setting.id)
                            ? '更新云端详设'
                            : '上传到云端详设库'
                        }
                      >
                        <CloudUpload size={15} />
                        {cloudCareerConfigIds.has(setting.id) ? '更新' : '上传'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCareerSetting(setting.id)}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-data text-red-600 hover:bg-red-50 sm:min-h-9 sm:min-w-0"
                        aria-label={`删除详设${setting.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            );
          })}

          {!readOnly ? (
            <button
              type="button"
              onClick={() => setNewCareerDialogOpen(true)}
              className="flex h-full min-h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-center text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="flex h-11 w-11 items-center justify-center">
                <Plus size={22} />
              </span>
              <strong className="mt-3 text-data text-indigo-950">
                新建育成设置
              </strong>
            </button>
          ) : null}
        </div>
      </section>

      {!readOnly && newCareerDialogOpen ? (
        <div className="autoResearchCreateDialogOverlay successionPickerCompactOverlay successionPickerTheme successionPickerOverlay">
          <button
            type="button"
            aria-label="关闭新建育成设置"
            onClick={() => setNewCareerDialogOpen(false)}
            className="absolute inset-0 bg-transparent"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-career-dialog-title"
            className="autoResearchCreateDialog successionPickerDialog relative max-h-[90vh] w-full max-w-lg"
          >
            <div className="space-y-4 overflow-y-auto p-5">
              <h2
                id="new-career-dialog-title"
                className="text-section font-semibold text-slate-900"
              >
                新建育成设置
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(['online', 'offline'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNewCareerMode(mode)}
                    className={`rounded-md border px-3 py-2 text-data font-medium ${
                      newCareerMode === mode
                        ? 'border-indigo-400 bg-indigo-100 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {mode === 'online' ? '在线自动育成' : '游戏离线育成'}
                  </button>
                ))}
              </div>

              {newCareerMode === 'offline' && (
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['breeding', '种马'],
                      ['jewels', '挂钻'],
                      ['fans', '刷粉丝'],
                    ] as const
                  ).map(([goal, label]) => (
                    <button
                      key={goal}
                      type="button"
                      aria-pressed={newCareerGoal === goal}
                      onClick={() => setNewCareerGoal(goal)}
                      className={`rounded-md border px-3 py-2 text-data font-medium ${newCareerGoal === goal ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <label className="block text-label font-medium text-slate-700">
                育成设置名称
                <input
                  value={newCareerSaveName}
                  onChange={(event) => setNewCareerSaveName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createCareerSaveFromDialog();
                  }}
                  placeholder={`例如：URA 育成 ${accountCareerSettings.length + 1}`}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-data"
                />
              </label>
            </div>

            <footer className="successionPickerFooter flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewCareerDialogOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-data font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={createCareerSaveFromDialog}
                disabled={!canCreateCareerSave}
                className="rounded-md bg-indigo-600 px-4 py-2 text-data font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                新建并进入
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="autoResearchForm contents">
      <header className="autoResearchEditorToolbar">
        <div className="autoResearchEditorNav">
          <button
            type="button"
            aria-label="返回"
            onClick={closeCareerEditor}
            className="autoResearchBackButton"
          >
            <ChevronLeft size={20} strokeWidth={2.25} />
            <span className="autoResearchBackLabel">返回</span>
          </button>
          <span className="autoResearchEditorTitle">
            {careerMode === 'offline' ? '离线育成设置' : '育成设置'}
          </span>
        </div>

        <nav className="autoResearchEditorTabs">
          {(careerMode === 'offline'
            ? [
                ['career-scenario', '基础'],
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
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-caption font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="autoResearchEditorActions">
          {automationActive && careerMode === 'online' ? (
            <button
              type="button"
              onClick={saveAndApplyCareerSetting}
              disabled={Boolean(busy)}
              className="uma-clay-button-primary inline-flex items-center gap-1.5 whitespace-nowrap px-3 text-label font-semibold disabled:opacity-50"
            >
              {busy === 'update-schedule' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {busy === 'update-schedule' ? '应用中…' : '保存并应用'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={saveCareerSetting}
                disabled={Boolean(busy)}
                className={
                  careerDirty || busy === 'career-save'
                    ? 'uma-clay-button inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 text-label font-semibold disabled:opacity-50'
                    : 'inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-200/80 bg-white/80 px-2.5 text-label font-medium text-emerald-700 disabled:opacity-50'
                }
              >
                {careerDirty || busy === 'career-save' ? (
                  <Save size={14} />
                ) : (
                  <Check size={14} />
                )}
                {busy === 'career-save'
                  ? '保存中…'
                  : careerDirty
                    ? '保存修改'
                    : '已保存'}
              </button>
              <button
                type="button"
                onClick={saveAndRunCareer}
                disabled={
                  Boolean(busy) ||
                  (continuingCurrentCareer && !canContinueCurrentCareer) ||
                  (careerMode === 'offline' &&
                    offlineDesign.source === 'api' &&
                    !offlineRaceDeckNum)
                }
                className="uma-clay-button-primary inline-flex items-center gap-1.5 whitespace-nowrap px-3 text-label font-semibold disabled:opacity-50"
              >
                <Play size={14} />
                {busy === 'run' || busy === 'idle-start'
                  ? dashboard.account.career?.active
                    ? '保存并继续中…'
                    : careerMode === 'offline'
                      ? '启动中…'
                      : '保存并开始中…'
                  : careerMode === 'offline' &&
                      offlineDesign.source === 'api' &&
                      !offlineRaceDeckNum
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
      </header>

      <section id="career-task" className="scroll-mt-28">
        {Object.keys(validationErrors).length ? (
          <div
            role="alert"
            className="mb-4 rounded-lg   bg-rose-50 p-4 text-data text-rose-800"
          >
            <p className="font-semibold">请补全以下配置</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(validationErrors).map(([target, message]) => (
                <li key={target}>
                  <button
                    type="button"
                    className="min-h-8 text-left underline underline-offset-4"
                    onClick={() => {
                      scrollToSection(target);
                      document
                        .getElementById(target)
                        ?.querySelector<HTMLElement>(
                          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
                        )
                        ?.focus({ preventScroll: true });
                    }}
                  >
                    {message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!dashboard.account.career?.active ? (
          <div id="career-selection" className="scroll-mt-28 space-y-5">
            {careerMode === 'offline' && (
              <OfflineDesignSettings
                key={`${selectedUma?.chara_id || 0}:${offlineScenarioId}`}
                design={offlineDesign}
                setDesign={setOfflineDesign}
                charaId={selectedUma?.chara_id || 0}
                changeScenario={changeOfflineScenario}
                parents={dashboard.parents}
                selectedParent1={parent1}
                selectedParent2={parent2}
                setParents={(first, second) => {
                  setParent1(first);
                  setParent2(second);
                }}
                busy={busy}
              />
            )}
            {careerMode === 'offline' ? (
              <section
                id="career-scenario"
                className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
                    1
                  </span>
                  <h3 className="text-section font-semibold text-gray-800">
                    基础设置
                  </h3>
                </div>
                <div className="mt-3 grid max-w-xl gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-label">
                      育成剧本
                      <select
                        value={offlineScenarioId}
                        disabled={
                          Boolean(busy) || offlineDesign.goal !== 'breeding'
                        }
                        onChange={(event) =>
                          changeOfflineScenario(Number(event.target.value))
                        }
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-slate-900"
                      >
                        <option value={0}>自动选择最新可用剧本</option>
                        {!offlineScenarios.some(
                          (scenario) => scenario.id === 5,
                        ) && <option value={5}>荣耀女神杯</option>}
                        {offlineScenarios.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {offlineSetup ? (
                      <p className="mt-2 text-label text-slate-500">
                        当前主剧本：
                        <strong className="ml-1 text-slate-800">
                          {offlineSetup.scenario_name ||
                            `剧本 ${offlineSetup.scenario_id}`}
                        </strong>
                      </p>
                    ) : null}
                  </div>
                  <label className="text-label">
                    跑法
                    <select
                      value={offlineRunningStyle}
                      disabled={Boolean(busy)}
                      onChange={(event) =>
                        setOfflineRunningStyle(Number(event.target.value))
                      }
                      className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value={0}>默认（使用马娘初始跑法）</option>
                      <option value={1}>逃</option>
                      <option value={2}>先行</option>
                      <option value={3}>差</option>
                      <option value={4}>追</option>
                    </select>
                  </label>
                </div>
              </section>
            ) : null}
            <div
              id="career-uma"
              className="careerSelection scroll-mt-28 grid gap-5"
            >
              <section className="uma-clay-panel p-4">
                {validationErrors['career-uma'] ? (
                  <p className="mb-3 text-data font-medium text-rose-700">
                    {validationErrors['career-uma']}
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
                      {careerMode === 'offline' ? 2 : 1}
                    </span>
                    <div>
                      <h3 className="text-section font-semibold text-gray-800">
                        选择育成马娘
                      </h3>
                    </div>
                  </div>
                </div>
                <div className="mt-3 w-full xl:max-w-xl">
                  <SuccessionPickerTrigger
                    label="育成马娘"
                    selected={Boolean(selectedUma)}
                    required
                    portrait={
                      selectedUma ? (
                        <PlannerPortrait
                          path={
                            umaSkinIconPath(
                              selectedUma.id,
                              selectedUma.rarity,
                              selectedUma.race_cloth_id,
                            ) || ''
                          }
                          alt={selectedUma.name}
                        />
                      ) : null
                    }
                    onOpen={() => setUmaPickerOpen(true)}
                  >
                    {selectedUmaBase && selectedUmaAptitudes ? (
                      <UmaAptitudeRows
                        uma={{ aptitudes: selectedUmaAptitudes }}
                        baseAptitudes={selectedUmaBase.aptitudes}
                      />
                    ) : null}
                  </SuccessionPickerTrigger>
                </div>
              </section>

              {umaPickerOpen ? (
                <SuccessionPickerDialog
                  ariaLabel="选择育成马娘"
                  title="正在选择育成马娘"
                  onClose={() => setUmaPickerOpen(false)}
                  searchValue={umaPickerSearch}
                  searchPlaceholder="搜索马娘名称"
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
                  bodyClassName="successionPickerGrid careerUmaPickerGrid"
                >
                  {pickerUmas.length ? (
                    pickerUmas.map((uma) => {
                      const selected = cardId === uma.id;
                      const base = CHARACTER_BY_ID.get(uma.chara_id);
                      return (
                        <PlannerSelectionCard
                          selected={selected}
                          portrait={
                            <PlannerPortrait
                              path={
                                umaSkinIconPath(
                                  uma.id,
                                  uma.rarity,
                                  uma.race_cloth_id,
                                ) || ''
                              }
                              alt={uma.name}
                              size="large"
                            />
                          }
                          ariaLabel={`选择${uma.name}`}
                          details={
                            base ? (
                              <UmaAptitudeRows uma={base} picker />
                            ) : undefined
                          }
                          onClick={() => {
                            setCardId(uma.id);
                            setDeckId(0);
                            setSupportCardIds([]);
                            setFriendCardId(0);
                            setParent1('');
                            setParent2('');
                            resetOfflineCareer();
                            setUmaPickerOpen(false);
                          }}
                          key={uma.id}
                        />
                      );
                    })
                  ) : (
                    <div className="successionPickerEmpty">
                      <strong>没有符合条件的马娘</strong>
                      <p>尝试修改搜索词，或清空搜索。</p>
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
                id="career-parents"
                className={`min-w-0 rounded-lg border p-4 ${
                  selectedUma
                    ? 'border-gray-200 bg-gray-50/60'
                    : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-section font-semibold text-gray-800">
                    选择继承马娘
                  </h3>
                </div>

                {validationErrors['career-parents'] ? (
                  <p className="mt-3 text-data font-medium text-rose-700">
                    {validationErrors['career-parents']}
                  </p>
                ) : null}
                {!selectedUma ? (
                  <div className="py-12 text-center text-data text-gray-500">
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
                      if (!selectedParent)
                        return (
                          <SuccessionPickerTrigger
                            key={slotNumber}
                            label={`继承马娘 ${slotNumber}`}
                            selected={false}
                            required
                            placeholder={`请选择继承马娘 ${slotNumber}`}
                            onOpen={() => setParentPickerSlot(slotNumber)}
                          />
                        );
                      return (
                        <ParentChoiceCard
                          key={slotNumber}
                          parent={selectedParent}
                          selected
                          viewOnly
                          disabled={false}
                          compatibility={compatibility}
                          onSelect={() => setParentPickerSlot(slotNumber)}
                          heading={`继承马娘 ${slotNumber}`}
                          headingActions={
                            <>
                              <PlannerButton
                                size="small"
                                variant="ghost"
                                aria-label={`清除继承马娘 ${slotNumber}`}
                                onClick={() =>
                                  slotNumber === 1
                                    ? setParent1('')
                                    : setParent2('')
                                }
                              >
                                清除
                              </PlannerButton>
                              <PlannerButton
                                size="small"
                                onClick={() => setParentPickerSlot(slotNumber)}
                                aria-label={`更换继承马娘 ${slotNumber}`}
                              >
                                更换
                              </PlannerButton>
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {selectedUma && parentPickerSlot ? (
                <SuccessionPickerDialog
                  ariaLabel={`选择继承马娘 ${parentPickerSlot}`}
                  title={`正在选择继承位 ${parentPickerSlot}`}
                  onClose={() => setParentPickerSlot(null)}
                  dialogClassName="successionCapturedPickerDialog"
                  searchValue={parentPickerSearch}
                  searchPlaceholder="搜索马娘、因子、玩家或玩家 ID"
                  searchAriaLabel="搜索已有马娘"
                  onSearchChange={setParentPickerSearch}
                >
                  <SuccessionPickerFilterSheet
                    title="筛选继承马娘"
                    summary={
                      parentPickerHasFilters ? '已启用筛选' : '全部继承马娘'
                    }
                    onClear={() => {
                      setParentPickerSource('all');
                      setParentPickerFactorFilters([]);
                      setParentPickerSort('score');
                      setParentPickerSortDirection('desc');
                    }}
                  >
                    <div className="successionCapturedPickerFilters border-b border-slate-200 bg-slate-50/80 px-3 py-2">
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
                            aria-pressed={parentPickerSource === value}
                            onClick={() => setParentPickerSource(value)}
                            className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${parentPickerSource === value ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <ParentFactorFilters
                        filters={parentPickerFactorFilters}
                        setFilters={setParentPickerFactorFilters}
                      />

                      <section className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="mr-1 text-caption text-slate-700">
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
                              className={`rounded-md border px-2.5 py-1 text-caption font-medium transition-colors ${
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
                              onClick={() =>
                                setParentPickerSortDirection(value)
                              }
                              className={`successionCapturedPickerCompactControl rounded-md px-2.5 py-1 text-caption font-medium transition-colors ${
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
                  </SuccessionPickerFilterSheet>
                  {pickerParents.length ? (
                    <>
                      <div className="successionCapturedPickerGrid">
                        {(() => {
                          const currentValue =
                            parentPickerSlot === 1 ? parent1 : parent2;
                          const otherValue =
                            parentPickerSlot === 1 ? parent2 : parent1;
                          const otherParent =
                            parentBySelectionId.get(otherValue);
                          const blockedCharaIds = new Set([
                            selectedUma.chara_id,
                            otherParent?.chara_id || 0,
                          ]);
                          return visiblePickerParents.map((parent) => (
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
                              compatibility={compatibilityBySelectionId.get(
                                parent.selection_id,
                              )}
                              onSelect={() => {
                                if (parentPickerSlot === 1) {
                                  setParent1(parent.selection_id);
                                } else {
                                  setParent2(parent.selection_id);
                                }
                                setParentPickerSlot(null);
                              }}
                            />
                          ));
                        })()}
                        {pickerParents.length > visibleParentLimit ? (
                          <div
                            ref={parentLoadMoreRef}
                            className="col-span-full h-4"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    </>
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
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
                  {careerMode === 'offline' ? 3 : 2}
                </span>
                <div>
                  <h3 className="text-section font-semibold text-gray-800">
                    选择支援卡组
                  </h3>
                </div>
              </div>
              {validationErrors['career-support'] ? (
                <p className="mt-3 text-data font-medium text-rose-700">
                  {validationErrors['career-support']}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap content-start gap-3">
                {dashboard.decks.map((deck) => {
                  const deckCharaIds = deck.cards.map(
                    (support) => support.chara_id,
                  );
                  const disabled =
                    deck.cards.length !== 5 ||
                    new Set(deckCharaIds).size !== deckCharaIds.length ||
                    deckCharaIds.some((charaId) =>
                      deckReservedCharaIds.has(charaId),
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

            <section
              id="career-friend-support"
              className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              {validationErrors['career-friend-support'] ? (
                <p className="mb-3 text-data font-medium text-rose-700">
                  {validationErrors['career-friend-support']}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-section font-semibold text-gray-800">
                    选择好友支援卡
                  </h3>
                  <p className="text-label text-gray-500">
                    只允许借用满破满级支援。
                  </p>
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
                    className="w-full cursor-text select-text rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-data"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshOptionsIndex}
                  disabled={!selectedAccountId || busy === 'options-index'}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-caption text-gray-600 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={busy === 'options-index' ? 'animate-spin' : ''}
                  />
                  {busy === 'options-index'
                    ? '刷新中…'
                    : `刷新好友支援卡${availableFriendSupportIds.size ? `（${availableFriendSupportIds.size} 张可借）` : ''}`}
                </button>
              </div>
              <div className="mt-3 flex max-h-[460px] flex-wrap content-start gap-1.5 overflow-auto pr-1">
                {visibleFriendSupports.map((support) => (
                  <SupportChoiceCard
                    key={support.id}
                    support={support}
                    selected={friendCardId === support.id}
                    disabled={friendReservedCharaIds.has(support.chara_id)}
                    onSelect={() => setFriendCardId(support.id)}
                  />
                ))}
              </div>
              {!visibleFriendSupports.length && busy !== 'options-index' ? (
                <div className="py-8 text-center text-data text-gray-500">
                  当前没有找到符合条件的满破满级好友支援。
                </div>
              ) : null}
            </section>

            {selectionConflict ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-data text-amber-800">
                {selectionConflict}
              </div>
            ) : null}

            <div className="flex flex-col">{careerModeSettings}</div>

            <section
              id="career-other-options"
              className="mt-5 scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-caption font-semibold text-white">
                  {careerMode === 'online' ? 4 : 7}
                </span>
                <div>
                  <h3 className="text-section font-semibold text-gray-800">
                    编辑其他设置
                  </h3>
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
                      className="flex min-h-20 items-start rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-data text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <span>
                        <strong className="block font-medium text-slate-800">
                          详细育成设置
                        </strong>
                        <span className="mt-0.5 block text-caption font-medium text-indigo-600">
                          设置训练目标、技能、事件与赛事 →
                        </span>
                      </span>
                    </button>
                    <div className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-data text-slate-700">
                      <input
                        id="career-burn-clocks"
                        type="checkbox"
                        checked={burnClocks}
                        onChange={(event) =>
                          setBurnClocks(event.target.checked)
                        }
                        className="mt-1"
                      />
                      <div>
                        <label htmlFor="career-burn-clocks">
                          <strong className="block font-medium text-slate-800">
                            比赛失败时使用闹钟
                          </strong>
                          <span className="mt-0.5 block text-caption text-slate-500">
                            当前持有 {dashboard.account.clocks || 0} 个
                          </span>
                        </label>
                        {burnClocks ? (
                          <label className="mt-2 flex items-center gap-2 text-label text-slate-600">
                            每次育成最多使用
                            <input
                              type="number"
                              min={1}
                              value={clockUseLimit}
                              onChange={(event) =>
                                setClockUseLimit(
                                  Math.max(1, Number(event.target.value) || 1),
                                )
                              }
                              className="w-16 rounded border border-slate-300 px-2 py-1 text-center text-data text-slate-800"
                            />
                            次
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
                {setTransferMode ? (
                  <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-data text-slate-700">
                    <input
                      type="checkbox"
                      checked={transferMode === 'direct'}
                      onChange={(event) =>
                        setTransferMode(
                          event.target.checked ? 'direct' : 'keep',
                        )
                      }
                      className="mt-1"
                    />
                    <span>
                      <strong className="block font-medium text-slate-800">
                        养成完成后直接转队
                      </strong>
                    </span>
                  </label>
                ) : null}
                <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-label text-slate-700">
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
                    <span className="mt-0.5 block text-caption text-slate-500">
                      优先能量饮料 30 · 持有{' '}
                      {dashboard.account.energy_drinks || 0} 个
                    </span>
                  </span>
                </label>
                <label className="flex min-h-20 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-label text-slate-700">
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
                  </span>
                </label>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default memo(CareerTab);
