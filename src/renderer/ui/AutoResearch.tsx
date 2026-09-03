/* eslint-disable promise/always-return, promise/catch-or-return, jsx-a11y/label-has-associated-control, no-nested-ternary, no-await-in-loop */
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  Check,
  Database,
  Gem,
  History,
  ListChecks,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import HistoryTab from 'renderer/components/autoResearch/HistoryTab';
import ProgressTab from 'renderer/components/autoResearch/ProgressTab';
import PresetsTab from 'renderer/components/autoResearch/PresetsTab';
import CareerTab from 'renderer/components/autoResearch/CareerTab';
import DailyTasksTab from 'renderer/components/autoResearch/DailyTasksTab';
import AutomationControlCard from 'renderer/components/autoResearch/AutomationControlCard';
import EditableNumberInput from 'renderer/components/autoResearch/EditableNumberInput';
import SkillSelector, {
  AutoResearchSkill,
} from 'renderer/components/autoResearch/SkillSelector';
import { horseIconPath } from 'renderer/components/autoResearch/SelectionCards';
import {
  AutoResearchRequestError,
  CAREER_SETTINGS_KEY,
  careerSettingMatchesCurrent,
  compareRaces,
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
  createDefaultPreset,
  createSkillSelectionId,
  DEFAULT_EXPECT_ATTRIBUTE,
  DEFAULT_PRESET_NAME,
  DEFAULT_SERVER,
  fileToBase64,
  formatAccountError,
  getSharedStorageItem,
  LAST_ACCOUNT_KEY,
  LOCAL_PRESETS_KEY,
  MONTH_OPTIONS,
  needsRelogin,
  normalizeRaceSelection,
  normalizeServer,
  normalizeSkillLearningSettings,
  normalizeSkillSelections,
  normalizeTargetAttributeStages,
  normalizeTurnList,
  numberArray,
  panelClass,
  parentViewerIdFromSelection,
  scrollToSection,
  setSharedStorageItem,
  skillPurchaseTurn,
  skillPurchaseTurnLabel,
  SKILL_PURCHASE_YEAR_OPTIONS,
} from 'renderer/components/autoResearch/shared';
import {
  Account,
  AccountOptionsResponse,
  AuthResponse,
  AutoResearchTab,
  CapturedCredential,
  CareerSessionRecord,
  CareerRunQueueItem,
  CareerSetting,
  DailyTasksConfig,
  DailyTasksResponse,
  LoginProgress,
  LoginProgressResponse,
  OfflineSingleModeSetup,
  OfflineFactorSelection,
  OfflineSkillSettings,
  PendingRun,
  Preset,
  RaceOption,
  Runner,
  RunMode,
  SessionAccount,
  SessionResponse,
  SkillLearningSetting,
  SkillOption,
  SkillSelectionEntry,
  SupportInfo,
  TargetAttributeStage,
} from 'renderer/components/autoResearch/types';

import { loadUMDB } from 'renderer/utils/umdb';
import autoResearchCatalog from '../../../assets/data/auto_research_catalog.json';

const localCatalog = autoResearchCatalog as {
  skills: Record<string, SkillOption>;
  races: RaceOption[];
};

const localAutoResearchSkills = (() => {
  const byName = new Map<string, AutoResearchSkill>();
  Object.entries(localCatalog.skills).forEach(([rawId, rawSkill]) => {
    const name = String(rawSkill.name || '').trim();
    const needSkillPoint = Number(rawSkill.need_skill_point || 0);
    if (!name || needSkillPoint <= 0 || name.endsWith('×')) return;
    if (!byName.has(name)) {
      byName.set(name, {
        id: Number(rawId),
        name,
        rarity: Number(rawSkill.rarity || 0),
        group_id: Number(rawSkill.group_id || 0),
        grade_value: Number(rawSkill.grade_value || 0),
        need_skill_point: needSkillPoint,
        disable_singlemode: Number(rawSkill.disable_singlemode || 0),
        tags: Array.isArray(rawSkill.tags)
          ? rawSkill.tags.map(Number).filter(Number.isFinite)
          : [],
        icon_id: Number(rawSkill.icon_id || 0),
        skill_category: Number(rawSkill.skill_category || 0),
      });
    }
  });
  return [...byName.values()].sort(
    (left, right) =>
      right.rarity - left.rarity ||
      left.skill_category - right.skill_category ||
      left.name.localeCompare(right.name, 'zh-CN'),
  );
})();

const emptyAccountOptions = (): AccountOptionsResponse['options'] => ({
  umas: [],
  supports: [],
  decks: [],
  parents: [],
  friends: [],
  friend_exclude_ids: [],
  offline_scenarios: [],
});

const LOCAL_DAILY_TASKS_KEY = 'autoResearch.dailyTasks.v1';

// A local game session belongs to an account, not a tab.  Daily work and the
// career-detail editor deliberately share this state and the same main-process
// game client.
type LocalAccountSessionState = 'unknown' | 'checking' | 'ready' | 'missing';

type LocalOfflineSetupResponse = {
  success?: unknown;
  offline_setup?: unknown;
};

const isMissingLocalGameSession = (error: unknown) => {
  const message = String((error as Error)?.message || '');
  return message.includes('请先登录') || message.includes('本地游戏会话');
};

function isOfflineSingleModeSetup(
  value: unknown,
): value is OfflineSingleModeSetup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const setup = value as Record<string, unknown>;
  const challenge = setup.training_challenge;
  if (!challenge || typeof challenge !== 'object' || Array.isArray(challenge)) {
    return false;
  }
  const challengeInfo = challenge as Record<string, unknown>;
  return (
    Number.isFinite(Number(setup.scenario_id)) &&
    Number(setup.scenario_id) > 0 &&
    typeof setup.scenario_name === 'string' &&
    Array.isArray(setup.scenarios) &&
    Array.isArray(setup.required_race_array) &&
    Array.isArray(setup.race_decks) &&
    typeof challengeInfo.available === 'boolean'
  );
}

const defaultDailyTasksConfig = (): DailyTasksConfig => ({
  schema_version: 3,
  run_with_career: false,
  daily_race: {
    enabled: false,
    daily_race_id: 0,
    trained_chara_id: 0,
    running_style: 0,
  },
  daily_legend_race: {
    enabled: false,
    daily_legend_race_id: 0,
    trained_chara_id: 0,
    running_style: 0,
  },
  team_stadium: { enabled: false, opponent_strength: 3 },
  limited_shop: { enabled: false, buy_all: true },
});

const editableDailyTasksConfig = (
  config: DailyTasksConfig,
): DailyTasksConfig => ({
  schema_version: 3,
  run_with_career: Boolean(config.run_with_career),
  daily_race: { ...config.daily_race },
  daily_legend_race: { ...config.daily_legend_race },
  team_stadium: { ...config.team_stadium },
  limited_shop: { ...config.limited_shop },
});

const readLocalDailyTasks = (
  uid: string,
  fallback: DailyTasksConfig,
): DailyTasksConfig => {
  try {
    const stored = JSON.parse(
      getSharedStorageItem(LOCAL_DAILY_TASKS_KEY) || '{}',
    ) as Record<string, DailyTasksConfig>;
    return editableDailyTasksConfig(stored[uid] || fallback);
  } catch {
    return editableDailyTasksConfig(fallback);
  }
};

const writeLocalDailyTasks = (uid: string, config: DailyTasksConfig) => {
  let stored: Record<string, DailyTasksConfig> = {};
  try {
    stored = JSON.parse(
      getSharedStorageItem(LOCAL_DAILY_TASKS_KEY) || '{}',
    ) as Record<string, DailyTasksConfig>;
  } catch {
    stored = {};
  }
  const saved = editableDailyTasksConfig(config);
  setSharedStorageItem(
    LOCAL_DAILY_TASKS_KEY,
    JSON.stringify({ ...stored, [uid]: saved }),
  );
  return saved;
};

const readCareerDailyTasks = (uid: string): DailyTasksConfig | undefined => {
  try {
    const stored = JSON.parse(
      getSharedStorageItem(LOCAL_DAILY_TASKS_KEY) || '{}',
    ) as Record<string, DailyTasksConfig>;
    const config = stored[uid];
    return config?.run_with_career
      ? editableDailyTasksConfig(config)
      : undefined;
  } catch {
    return undefined;
  }
};

const SERVER_CONTROL_STATUSES = [
  'queued',
  'reconnect_wait',
  'running',
  'stopping',
] as const;

const runnerUsesServerSession = (runner?: Runner) =>
  Boolean(
    runner?.running ||
      runner?.run_plan?.active ||
      runner?.daily_jewel_schedule?.enabled ||
      ((runner?.control?.desired_state === 'running' ||
        runner?.control?.status === 'stopping') &&
        SERVER_CONTROL_STATUSES.includes(
          runner?.control?.status as (typeof SERVER_CONTROL_STATUSES)[number],
        )),
  );

const runtimeSessionOwner = (
  runtime?: Partial<
    Pick<Account['runtime'], 'session_owner' | 'logged_in' | 'runner'>
  >,
) => {
  if (runtime?.session_owner === 'server') return 'server' as const;
  if (runnerUsesServerSession(runtime?.runner)) return 'server' as const;
  if (runtime?.session_owner === 'local') return 'local' as const;
  return 'none' as const;
};

const normalizeOfflineFactorSelection = (
  value?: Partial<OfflineFactorSelection>,
): OfflineFactorSelection => {
  const defaults = createDefaultOfflineFactorSelection();
  const legacyBlueMinimums = !value?.evaluation_mode;
  const normalizeBlueMinimum = (
    key: keyof OfflineFactorSelection['blue_factor_minimums'],
  ) => {
    const raw = Number(value?.blue_factor_minimums?.[key]);
    if (!Number.isFinite(raw)) return defaults.blue_factor_minimums[key];
    if (legacyBlueMinimums && raw === 0) return 1;
    return Math.max(0, Math.min(3, Math.round(raw)));
  };
  return {
    ...defaults,
    ...(value || {}),
    evaluation_mode:
      value?.evaluation_mode === 'ancestor' ? 'ancestor' : 'parent',
    use_skill_priority: true,
    blue_factor_minimums: {
      speed: normalizeBlueMinimum('speed'),
      stamina: normalizeBlueMinimum('stamina'),
      power: normalizeBlueMinimum('power'),
      guts: normalizeBlueMinimum('guts'),
      wit: normalizeBlueMinimum('wit'),
    },
    targets: Array.isArray(value?.targets)
      ? value.targets.flatMap((target) => {
          const factorGroupId = Number(target?.factor_group_id || 0);
          if (!factorGroupId) return [];
          const weight = Number(target?.weight ?? 1);
          return [
            {
              ...target,
              factor_group_id: factorGroupId,
              weight: Number.isFinite(weight) ? Math.max(0, weight) : 1,
            },
          ];
        })
      : [],
    lineage: {
      ...defaults.lineage,
      ...(value?.lineage || {}),
      tree: {
        parent: {
          ...defaults.lineage.tree.parent,
          ...(value?.lineage?.tree?.parent || {}),
          chara_id: Number(
            value?.lineage?.tree?.parent?.chara_id ||
              (value?.lineage?.chara_ids?.length === 1
                ? value.lineage.chara_ids[0]
                : 0),
          ),
          min_factor_stars: Math.max(
            0,
            Number(
              value?.lineage?.tree?.parent?.min_factor_stars ??
                value?.lineage?.min_parent_factor_stars ??
                0,
            ),
          ),
        },
        ancestor_1: {
          ...defaults.lineage.tree.ancestor_1,
          ...(value?.lineage?.tree?.ancestor_1 || {}),
          chara_id: Number(
            value?.lineage?.tree?.ancestor_1?.chara_id ||
              value?.lineage?.ancestor_chara_ids?.[0] ||
              0,
          ),
          min_factor_stars: Math.max(
            0,
            Number(value?.lineage?.tree?.ancestor_1?.min_factor_stars || 0),
          ),
        },
        ancestor_2: {
          ...defaults.lineage.tree.ancestor_2,
          ...(value?.lineage?.tree?.ancestor_2 || {}),
          chara_id: Number(
            value?.lineage?.tree?.ancestor_2?.chara_id ||
              value?.lineage?.ancestor_chara_ids?.[1] ||
              0,
          ),
          min_factor_stars: Math.max(
            0,
            Number(value?.lineage?.tree?.ancestor_2?.min_factor_stars || 0),
          ),
        },
      },
      chara_ids: [],
      ancestor_chara_ids: [],
      min_parent_factor_stars: 0,
      min_ancestor_factor_stars: 0,
    },
  };
};

const normalizeOfflineSkillSettings = (
  value?: Partial<OfflineSkillSettings>,
): OfflineSkillSettings => {
  const defaults = createDefaultOfflineSkillSettings();
  return {
    ...defaults,
    ...(value || {}),
    learn_skill_list: Array.isArray(value?.learn_skill_list)
      ? value.learn_skill_list
          .map((group) => (Array.isArray(group) ? group.map(String) : []))
          .filter((group) => group.length)
      : [],
    learn_skill_group_labels: Array.isArray(value?.learn_skill_group_labels)
      ? value.learn_skill_group_labels.map(String)
      : [],
    enabled: true,
    learn_skill_settings: {},
    learn_skill_only_user_provided: false,
    skip_double_circle_unless_high_hint: false,
    maximize_skill_score_at_end: true,
  };
};

const preferNewerRunner = (
  current: Runner | undefined,
  incoming: Runner | undefined,
) => {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentEpoch = String(current.state_epoch || '');
  const incomingEpoch = String(incoming.state_epoch || '');
  if (currentEpoch && incomingEpoch && currentEpoch !== incomingEpoch) {
    return incoming;
  }
  const currentRevision = Number(current.state_revision || 0);
  const incomingRevision = Number(incoming.state_revision || 0);
  if (currentRevision > 0 && incomingRevision <= 0) return current;
  if (
    currentRevision > 0 &&
    incomingRevision > 0 &&
    incomingRevision < currentRevision
  ) {
    return current;
  }
  return incoming;
};

function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed right-4 top-4 z-[1600] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-white px-4 py-3 text-sm text-slate-700 shadow-2xl"
    >
      <AlertTriangle className="mt-0.5 flex-none text-red-500" size={18} />
      <p className="min-w-0 flex-1 break-words leading-5">
        {formatAccountError(message)}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭错误提示"
        className="flex-none rounded px-1 text-lg leading-5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ×
      </button>
    </div>
  );
}

export default function AutoResearch() {
  const [activeTab, setActiveTab] = useState<AutoResearchTab>('career');
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem('autoResearch.server') || DEFAULT_SERVER,
  );
  const [server, setServer] = useState('');
  const [loginSettingsOpen, setLoginSettingsOpen] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [captured, setCaptured] = useState<CapturedCredential[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [presets, setPresets] = useState<Preset[]>(() => [
    createDefaultPreset(),
  ]);
  const { races } = localCatalog;
  const skills = localAutoResearchSkills;
  const [busy, setBusy] = useState('');
  const [stoppingAccountId, setStoppingAccountId] = useState('');
  const [error, setError] = useState('');
  const dismissError = useCallback(() => setError(''), []);
  const [manualUid, setManualUid] = useState('');
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loginProgress, setLoginProgress] = useState<LoginProgress | null>(
    null,
  );
  const [disconnectingAccountId, setDisconnectingAccountId] = useState('');
  const [
    checkingExistingRuntimeAccountId,
    setCheckingExistingRuntimeAccountId,
  ] = useState('');
  const [missingExistingRuntimeAccountId, setMissingExistingRuntimeAccountId] =
    useState('');
  const accountsRef = useRef(accounts);
  const sessionTokens = useRef(new Map<string, string>());
  const existingRuntimeAttachAttempts = useRef(new Set<string>());
  const activeLoginOperation = useRef('');
  const activeConnectionAccountIdRef = useRef('');
  const disconnectingAccountIdRef = useRef('');
  accountsRef.current = accounts;
  const selectedAccountIdRef = useRef(selectedAccountId);
  selectedAccountIdRef.current = selectedAccountId;
  const overviewRequestVersions = useRef(new Map<string, number>());
  const overviewResponseOrders = useRef(new Map<string, number>());
  const accountOptionsCache = useRef(
    new Map<string, AccountOptionsResponse['options']>(),
  );
  const accountOptionsRequests = useRef(new Map<string, Promise<void>>());
  const [cardId, setCardId] = useState(0);
  const [deckId, setDeckId] = useState(0);
  const [supportCardIds, setSupportCardIds] = useState<number[]>([]);
  const [friendCardId, setFriendCardId] = useState(0);
  const [parent1, setParent1] = useState('');
  const [parent2, setParent2] = useState('');
  const scenarioId = 1;
  const [presetName, setPresetName] = useState(DEFAULT_PRESET_NAME);
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetSaved, setPresetSaved] = useState(false);
  const presetSaveFeedbackTimer = useRef<number | null>(null);
  const [maxSteps, setMaxSteps] = useState(2500);
  const [burnClocks, setBurnClocks] = useState(false);
  const [runningStyle, setRunningStyle] = useState(0);
  const [recoverTpWithItem, setRecoverTpWithItem] = useState(false);
  const [recoverTpWithJewels, setRecoverTpWithJewels] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runMode, setRunMode] = useState<RunMode>('single');
  const [runCountTarget, setRunCountTarget] = useState(3);
  const [jewelDropTarget, setJewelDropTarget] = useState(20);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [scheduleStartTime, setScheduleStartTime] = useState('05:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('05:00');
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [appendPlanPickerOpen, setAppendPlanPickerOpen] = useState(false);
  const [skillSelections, setSkillSelections] = useState<SkillSelectionEntry[]>(
    [],
  );
  const [skillLearningSettings, setSkillLearningSettings] = useState<
    Record<string, SkillLearningSetting>
  >({});
  const [editingSkillSelectionId, setEditingSkillSelectionId] = useState('');
  const [skillSettingYearOffset, setSkillSettingYearOffset] = useState(0);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [draggedPrioritySkill, setDraggedPrioritySkill] = useState('');
  const [skillThreshold, setSkillThreshold] = useState(888);
  const [skipDoubleCircle, setSkipDoubleCircle] = useState(false);
  const [maximizeSkillScoreAtEnd, setMaximizeSkillScoreAtEnd] = useState(false);
  const [skillPurchaseTurns, setSkillPurchaseTurns] = useState<number[]>([]);
  const [skillPurchaseYearOffset, setSkillPurchaseYearOffset] = useState(0);
  const [uraAiTimeBudget, setUraAiTimeBudget] = useState(2);
  const [uraAiMinRollouts, setUraAiMinRollouts] = useState(128);
  const [uraAiMaxRollouts, setUraAiMaxRollouts] = useState(256);
  const [uraAiWorkers, setUraAiWorkers] = useState(4);
  const [uraAiRiskFactor, setUraAiRiskFactor] = useState(0);
  const [uraAiTargetAttributes, setUraAiTargetAttributes] = useState(
    DEFAULT_EXPECT_ATTRIBUTE,
  );
  const [uraAiTargetAttributeStages, setUraAiTargetAttributeStages] = useState<
    TargetAttributeStage[]
  >([]);
  const [targetAttributeStageYearOffset, setTargetAttributeStageYearOffset] =
    useState(0);
  const [selectedRaceIds, setSelectedRaceIds] = useState<number[]>([]);
  const [umaSearch, setUmaSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [supportSearch, setSupportSearch] = useState('');
  const [parentSelectionSlot, setParentSelectionSlot] = useState<1 | 2>(1);
  const [careerSettings, setCareerSettings] = useState<CareerSetting[]>([]);
  const [selectedCareerSettingId, setSelectedCareerSettingId] = useState('');
  const [careerSettingName, setCareerSettingName] = useState('');
  const [careerPresetName, setCareerPresetName] = useState('');
  const [careerSaveOpen, setCareerSaveOpen] = useState(false);
  const [newCareerSaveName, setNewCareerSaveName] = useState('');
  const [newCareerPresetName, setNewCareerPresetName] = useState('');
  const [newCareerMode, setNewCareerMode] = useState<'online' | 'offline'>(
    'online',
  );
  const [careerMode, setCareerMode] = useState<'online' | 'offline'>('online');
  const [offlineSetup, setOfflineSetup] =
    useState<OfflineSingleModeSetup | null>(null);
  const [offlineSetupAccountId, setOfflineSetupAccountId] = useState('');
  const [offlineScenarioId, setOfflineScenarioId] = useState(0);
  const [offlineChallengeMode, setOfflineChallengeMode] = useState(false);
  const [offlineRaceDeckNum, setOfflineRaceDeckNum] = useState(0);
  const [offlineRaceDeckName, setOfflineRaceDeckName] = useState('');
  const [offlineRaceIds, setOfflineRaceIds] = useState<number[]>([]);
  const [offlineFactorSelection, setOfflineFactorSelection] =
    useState<OfflineFactorSelection>(() =>
      createDefaultOfflineFactorSelection(),
    );
  const [offlineSkillSettings, setOfflineSkillSettings] =
    useState<OfflineSkillSettings>(() => createDefaultOfflineSkillSettings());
  const [careerHistory, setCareerHistory] = useState<CareerSessionRecord[]>([]);
  const [historyCareerSettingId, setHistoryCareerSettingId] = useState('');
  const [selectedCareerRecords, setSelectedCareerRecords] = useState<
    CareerSessionRecord[] | null
  >(null);
  const [dailyTasksOverview, setDailyTasksOverview] =
    useState<DailyTasksResponse | null>(null);
  const [dailyTasksLoading, setDailyTasksLoading] = useState(false);
  const [dailyTasksLoadError, setDailyTasksLoadError] = useState('');
  const [localAccountSessionStates, setLocalAccountSessionStates] = useState<
    Record<string, LocalAccountSessionState>
  >({});

  const skillPriorityNames = useMemo(
    () => skillSelections.flatMap((entry) => entry.skill_names),
    [skillSelections],
  );
  const editingSkillSelection = skillSelections.find(
    (entry) => entry.id === editingSkillSelectionId,
  );

  const dashboard = session?.dashboard;
  const loginProgressComplete = Boolean(
    loginProgress?.done && !loginProgress.error,
  );
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const serverAccount =
    dashboard?.account ||
    session?.runtime?.account ||
    selectedAccount?.runtime.account;
  const historyDashboard =
    dashboard ||
    (serverAccount
      ? { ...emptyAccountOptions(), account: serverAccount }
      : undefined);
  const runner = session?.runtime?.runner || selectedAccount?.runtime.runner;
  const runnerStopping = Boolean(
    runner?.stopping || stoppingAccountId === selectedAccountId,
  );
  const runnerSessionWaiting = Boolean(runner?.session_waiting);
  const dailyJewelSchedule = runner?.daily_jewel_schedule;
  const queuedCareerControl = Boolean(
    (runner?.control?.desired_state === 'running' ||
      runner?.control?.status === 'stopping') &&
      SERVER_CONTROL_STATUSES.includes(
        runner?.control?.status as (typeof SERVER_CONTROL_STATUSES)[number],
      ),
  );
  const automationActive = Boolean(
    runner?.running ||
      runner?.run_plan?.active ||
      dailyJewelSchedule?.enabled ||
      queuedCareerControl,
  );
  const serverCareerActive = Boolean(
    runner?.running || runner?.run_plan?.active || queuedCareerControl,
  );
  const sessionOwner =
    serverCareerActive || dailyJewelSchedule?.enabled
      ? 'server'
      : session?.runtime?.session_owner === 'local' ||
          runtimeSessionOwner(selectedAccount?.runtime) === 'local'
        ? 'local'
        : 'none';
  const serverHostedMode = sessionOwner === 'server';
  const localSessionMode = sessionOwner === 'local';
  const localAccountSessionState = selectedAccountId
    ? localAccountSessionStates[selectedAccountId] || 'unknown'
    : 'unknown';
  const remainingJewelDrops = Math.max(
    0,
    (runner?.daily_jewel_drop_limit || 20) -
      (runner?.daily_jewel_drop_count || 0),
  );
  const offlineControlActive = Boolean(
    (runner?.control?.desired_state === 'running' ||
      runner?.control?.status === 'stopping') &&
      runner?.control?.request?.career_mode === 'offline' &&
      SERVER_CONTROL_STATUSES.includes(
        runner?.control?.status as (typeof SERVER_CONTROL_STATUSES)[number],
      ),
  );
  const currentIdleSingleMode = offlineControlActive
    ? runner?.control?.detail?.idle_single_mode ||
      dashboard?.account?.idle_single_mode
    : dashboard?.account?.idle_single_mode ||
      runner?.control?.detail?.idle_single_mode;
  const activeCareer = dashboard?.account?.career;
  const activeCareerUma = dashboard?.umas.find(
    (uma) => uma.id === Number(activeCareer?.card_id || 0),
  );
  // The resident Worker owns the live Runner in another process.  Its
  // persisted run_plan is authoritative even before this Web process has a
  // local ``running`` snapshot.
  const currentCareerActive = Boolean(
    activeCareer?.active ||
      runner?.running ||
      runner?.run_plan?.active ||
      queuedCareerControl,
  );
  const currentCareerUma =
    (offlineControlActive
      ? dashboard?.umas.find(
          (uma) => uma.id === Number(runner?.control?.request?.card_id || 0),
        )
      : activeCareerUma) ||
    (runner?.running || queuedCareerControl
      ? dashboard?.umas.find(
          (uma) =>
            uma.id ===
            Number(runner?.card_id || runner?.control?.request?.card_id || 0),
        )
      : undefined);
  const currentCareerCardId = Number(
    currentCareerUma?.id ||
      (offlineControlActive ? 0 : activeCareer?.card_id) ||
      runner?.card_id ||
      runner?.control?.request?.card_id ||
      0,
  );
  const activeCareerIconPath = currentCareerCardId
    ? horseIconPath(
        currentCareerCardId,
        currentCareerUma?.rarity || 0,
        currentCareerUma?.race_cloth_id || currentCareerCardId,
      )
    : undefined;
  const currentRunnerStats = offlineControlActive
    ? {}
    : runner?.current_stats || runner?.action_history?.at(-1)?.stats || {};
  const selectedUma = dashboard?.umas.find((uma) => uma.id === cardId);
  const selectedParent1 = dashboard?.parents.find(
    (parent) => parent.selection_id === parent1,
  );
  const selectedParent2 = dashboard?.parents.find(
    (parent) => parent.selection_id === parent2,
  );
  const selectedDeck = dashboard?.decks.find((deck) => deck.id === deckId);
  const selectedFriendSupport = dashboard?.supports.find(
    (support) => support.id === friendCardId,
  );
  const selectedDeckCharaIds = useMemo(
    () => (selectedDeck?.cards || []).map((support) => support.chara_id),
    [selectedDeck],
  );
  const accountCareerSettings = useMemo(
    () =>
      careerSettings.filter(
        (setting) => setting.account_uid === selectedAccount?.uid,
      ),
    [careerSettings, selectedAccount?.uid],
  );
  const matchingCareerSettings = useMemo(() => {
    if (!activeCareer?.active) return [];
    return accountCareerSettings.filter(
      (setting) =>
        setting.mode !== 'offline' &&
        careerSettingMatchesCurrent(setting, activeCareer) &&
        presets.some((preset) => preset.name === setting.preset_name),
    );
  }, [accountCareerSettings, activeCareer, presets]);
  const selectedCareerSetting = useMemo(
    () =>
      careerSettings.find((setting) => setting.id === selectedCareerSettingId),
    [careerSettings, selectedCareerSettingId],
  );
  const pendingRunSetting = useMemo(() => {
    if (!pendingRun) return undefined;
    if (pendingRun.type === 'saved' || pendingRun.type === 'append') {
      return careerSettings.find(
        (setting) => setting.id === pendingRun.settingId,
      );
    }
    return selectedCareerSetting;
  }, [careerSettings, pendingRun, selectedCareerSetting]);
  const appendingCareerPlan = pendingRun?.type === 'append';
  const activeQueueItems = runner?.run_plan?.queue?.items || [];
  const appendBlockedByContinuous =
    (activeQueueItems.length
      ? activeQueueItems[activeQueueItems.length - 1]?.goal === 'continuous'
      : runner?.run_plan?.mode === 'continuous') ||
    runner?.daily_jewel_schedule?.mode === 'continuous';
  const activeAutomationSetting = useMemo(() => {
    const controlSettingId = String(
      runner?.control?.request?.career_setting_id || '',
    );
    const controlSetting = careerSettings.find(
      (setting) => setting.id === controlSettingId,
    );
    if (runner?.control?.request?.career_mode === 'offline') {
      return controlSetting?.mode === 'offline' ? controlSetting : undefined;
    }
    return controlSetting || selectedCareerSetting || matchingCareerSettings[0];
  }, [
    careerSettings,
    matchingCareerSettings,
    runner?.control?.request?.career_mode,
    runner?.control?.request?.career_setting_id,
    selectedCareerSetting,
  ]);
  const historyCareerSetting = useMemo(
    () =>
      accountCareerSettings.find(
        (setting) => setting.id === historyCareerSettingId,
      ),
    [accountCareerSettings, historyCareerSettingId],
  );
  const historyCareerRecords = useMemo(() => {
    if (!historyCareerSetting) return [];
    return careerHistory.filter((report) => {
      if (report.career_setting_id) {
        return report.career_setting_id === historyCareerSetting.id;
      }
      return (
        report.preset_name === historyCareerSetting.preset_name &&
        report.card_id === historyCareerSetting.card_id
      );
    });
  }, [careerHistory, historyCareerSetting]);
  const continuingCurrentCareer = Boolean(activeCareer?.active);
  const effectiveCardId =
    cardId ||
    (continuingCurrentCareer ? Number(selectedCareerSetting?.card_id || 0) : 0);
  const effectiveDeckId =
    deckId ||
    (continuingCurrentCareer ? Number(selectedCareerSetting?.deck_id || 0) : 0);
  const effectiveSupportCardIds = useMemo(() => {
    if (
      continuingCurrentCareer &&
      activeCareer?.support_card_ids?.length === 5
    ) {
      return activeCareer.support_card_ids;
    }
    if (selectedDeck?.support_card_ids.length === 5) {
      return selectedDeck.support_card_ids;
    }
    if (supportCardIds.length === 5) return supportCardIds;
    return continuingCurrentCareer
      ? selectedCareerSetting?.support_card_ids || []
      : supportCardIds;
  }, [
    activeCareer,
    continuingCurrentCareer,
    selectedCareerSetting,
    selectedDeck,
    supportCardIds,
  ]);
  const effectiveFriendCardId =
    friendCardId ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.friend_card_id || 0)
      : 0);
  const effectiveParentKey1 =
    parent1 ||
    (continuingCurrentCareer ? selectedCareerSetting?.parent_key_1 : '') ||
    '';
  const effectiveParentKey2 =
    parent2 ||
    (continuingCurrentCareer ? selectedCareerSetting?.parent_key_2 : '') ||
    '';
  const effectiveParentId1 =
    selectedParent1?.instance_id ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.parent_id_1 || 0)
      : 0);
  const effectiveParentId2 =
    selectedParent2?.instance_id ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.parent_id_2 || 0)
      : 0);
  const careerConfigDifferences = useMemo(() => {
    if (!activeCareer?.active) return [];
    if (!selectedCareerSetting) return ['尚未选择养马详设'];
    const differences: string[] = [];
    if (Number(activeCareer.card_id || 0) !== effectiveCardId) {
      differences.push('育成马娘');
    }
    return differences;
  }, [activeCareer, effectiveCardId, selectedCareerSetting]);
  const canContinueCurrentCareer =
    continuingCurrentCareer && careerConfigDifferences.length === 0;

  useEffect(() => {
    if (!automationActive) return;
    const mode = runner?.run_plan?.mode;
    if (mode) {
      setRunMode(
        mode === 'daily_count'
          ? 'count'
          : mode === 'daily_jewel_drops'
            ? 'jewel_drops'
            : mode,
      );
    }
    setRepeatDaily(
      Boolean(
        runner?.run_plan?.repeat_daily ||
          runner?.daily_jewel_schedule?.enabled ||
          runner?.run_plan?.queue?.repeat_daily,
      ),
    );
    if (mode === 'count' && runner?.run_plan?.target) {
      setRunCountTarget(runner.run_plan.target);
    }
    if (mode === 'daily_count' && runner?.run_plan?.target) {
      setRunCountTarget(runner.run_plan.target);
    }
    if (mode === 'jewel_drops' && runner?.run_plan?.target) {
      setJewelDropTarget(runner.run_plan.target);
    }
  }, [
    automationActive,
    runner?.daily_jewel_schedule?.enabled,
    runner?.run_plan?.mode,
    runner?.run_plan?.queue?.repeat_daily,
    runner?.run_plan?.repeat_daily,
    runner?.run_plan?.target,
  ]);
  const skillByName = useMemo(
    () => new Map(skills.map((skill) => [skill.name, skill])),
    [skills],
  );
  const filteredUmas = useMemo(() => {
    const keyword = umaSearch.trim().toLowerCase();
    return (dashboard?.umas || []).filter(
      (uma) =>
        !keyword || `${uma.name} ${uma.id}`.toLowerCase().includes(keyword),
    );
  }, [dashboard?.umas, umaSearch]);
  const filteredParents = useMemo(() => {
    const keyword = parentSearch.trim().toLowerCase();
    return (dashboard?.parents || [])
      .filter((parent) => {
        if (!keyword) return true;
        const factorText = [
          ...(parent.factors || []),
          ...(parent.ancestors || []).flatMap(
            (ancestor) => ancestor.factors || [],
          ),
        ]
          .map((factor) => factor.name)
          .join(' ');
        return `${parent.name} ${parent.card_id} ${factorText}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort(
        (left, right) =>
          right.rank_score - left.rank_score || right.rank - left.rank,
      );
  }, [dashboard?.parents, parentSearch]);
  const filteredSupports = useMemo(() => {
    const keyword = supportSearch.trim().toLowerCase();
    const rarityOrder: Record<string, number> = { SSR: 0, SR: 1, R: 2 };
    return (dashboard?.supports || [])
      .filter(
        (support) =>
          !keyword ||
          `${support.name} ${support.type} ${support.rarity}`
            .toLowerCase()
            .includes(keyword),
      )
      .sort(
        (left, right) =>
          (rarityOrder[left.rarity] ?? 9) - (rarityOrder[right.rarity] ?? 9) ||
          right.id - left.id,
      );
  }, [dashboard?.supports, supportSearch]);
  const availableFriendSupportIds = useMemo(() => {
    const supports = new Map(
      (dashboard?.supports || []).map((support) => [support.id, support]),
    );
    return new Set(
      (dashboard?.friends || [])
        .filter((friend) => {
          const support = supports.get(friend.support_card_id);
          return (
            friend.limit_break_count >= 4 &&
            (!support?.max_exp || friend.exp >= support.max_exp)
          );
        })
        .map((friend) => friend.support_card_id),
    );
  }, [dashboard?.friends, dashboard?.supports]);
  const visibleFriendSupports = useMemo(
    () =>
      filteredSupports.filter((support) =>
        availableFriendSupportIds.has(support.id),
      ),
    [availableFriendSupportIds, filteredSupports],
  );
  const selectionConflict = useMemo(() => {
    if (!selectedUma || !selectedFriendSupport) return '';
    if (effectiveSupportCardIds.length !== 5) {
      return '支援卡组必须正好包含 5 张卡';
    }
    const ownSupports = effectiveSupportCardIds
      .map((supportId) =>
        dashboard?.supports.find((support) => support.id === supportId),
      )
      .filter((support): support is SupportInfo => Boolean(support));
    if (ownSupports.length !== 5) return '支援卡组资料不完整，请重新登录账号';
    const ownCharaIds = ownSupports.map((support) => support.chara_id);
    if (new Set(ownCharaIds).size !== ownCharaIds.length) {
      return '支援卡组中有相同马娘';
    }
    if (ownCharaIds.includes(selectedUma.chara_id)) {
      return '育成马娘与支援卡组中的马娘重复';
    }
    if (
      selectedFriendSupport.chara_id === selectedUma.chara_id ||
      ownCharaIds.includes(selectedFriendSupport.chara_id)
    ) {
      return '好友支援与育成马娘或支援卡组中的马娘重复';
    }
    const parentCharaIds = [
      selectedParent1?.chara_id || 0,
      selectedParent2?.chara_id || 0,
    ].filter(Boolean);
    if (
      selectedParent1?.source === 'rental' &&
      selectedParent2?.source === 'rental'
    ) {
      return '每次育成最多只能借用一位继承马娘';
    }
    if (
      parentCharaIds.length === 2 &&
      parentCharaIds[0] === parentCharaIds[1]
    ) {
      return '两位继承马娘不能是同一马娘';
    }
    if (parentCharaIds.some((charaId) => charaId === selectedUma.chara_id)) {
      return '育成马娘和继承马娘不能是同一马娘';
    }
    return '';
  }, [
    dashboard?.supports,
    effectiveSupportCardIds,
    selectedFriendSupport,
    selectedParent1,
    selectedParent2,
    selectedUma,
  ]);
  const request = useCallback(
    async <T,>(
      path: string,
      init?: Parameters<typeof fetch>[1],
    ): Promise<T> => {
      const response = await fetch(`${server}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AutoResearchRequestError(
          body.detail || `HTTP ${response.status}`,
          response.status,
        );
      }
      return body as T;
    },
    [server],
  );

  const streamLoginProgress = useCallback(
    async (
      loginId: string,
      onProgress: (progress: LoginProgressResponse) => void,
      signal: AbortSignal,
    ) => {
      const response = await fetch(
        `${server}/api/auth/login-progress/${encodeURIComponent(loginId)}/stream`,
        { signal },
      );
      if (!response.ok || !response.body) {
        throw new Error(`login progress stream HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines =
          `${buffer}${decoder.decode(value, { stream: true })}`.split('\n');
        buffer = lines.pop() || '';
        lines.forEach((line) => {
          if (!line.trim()) return;
          try {
            onProgress(JSON.parse(line) as LoginProgressResponse);
          } catch {
            // Keep the stream alive if a proxy splits or corrupts one record.
          }
        });
      }
    },
    [server],
  );

  const loadAccounts = useCallback(async () => {
    const localAccounts =
      (await window.electron.autoResearch.accounts()) as Array<
        Omit<Account, 'runtime'>
      >;
    setAccounts((current) =>
      localAccounts.map((account) => ({
        ...account,
        runtime: current.find((item) => item.id === account.id)?.runtime || {
          logged_in: false,
          session_owner: 'none',
          last_error: '',
          runner: { running: false },
          account: null,
        },
      })),
    );
    const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY) || '';
    const currentAccountId = selectedAccountIdRef.current;
    const nextAccountId =
      currentAccountId &&
      localAccounts.some((account) => account.id === currentAccountId)
        ? currentAccountId
        : lastAccountId &&
            localAccounts.some((account) => account.id === lastAccountId)
          ? lastAccountId
          : '';
    setSelectedAccountId(nextAccountId);
  }, []);

  const updateRuntime = useCallback(
    (accountId: string, response: SessionResponse | null) => {
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? (() => {
                const nextSessionOwner = response
                  ? runtimeSessionOwner(response.runtime)
                  : 'none';
                const incomingAccount =
                  response?.dashboard?.account ?? response?.runtime?.account;
                const nextRunner = preferNewerRunner(
                  account.runtime.runner,
                  response?.runtime?.runner || response?.runner,
                );
                return {
                  ...account,
                  runtime: response
                    ? {
                        ...account.runtime,
                        ...(response.runtime || {}),
                        runner: nextRunner || account.runtime.runner,
                        logged_in: !!response.success,
                        account:
                          nextSessionOwner === 'none'
                            ? null
                            : nextSessionOwner === 'local'
                              ? incomingAccount || null
                              : (incomingAccount ?? account.runtime.account),
                      }
                    : {
                        logged_in: false,
                        session_owner: 'none',
                        last_error: '',
                        runner: { running: false },
                        account: null,
                      },
                };
              })()
            : account,
        ),
      );
    },
    [],
  );

  const invalidateOverviewResponses = useCallback((accountId: string) => {
    const nextOrder = (overviewResponseOrders.current.get(accountId) || 0) + 1;
    overviewResponseOrders.current.set(accountId, nextOrder);
    return nextOrder;
  }, []);

  const clearAccountOverviewSnapshot = useCallback(
    (accountId: string, clearOptions = true) => {
      overviewRequestVersions.current.set(
        accountId,
        (overviewRequestVersions.current.get(accountId) || 0) + 1,
      );
      invalidateOverviewResponses(accountId);
      if (clearOptions) accountOptionsCache.current.delete(accountId);
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? {
                ...account,
                runtime: {
                  logged_in: false,
                  session_owner: 'none',
                  last_error: '',
                  runner: { running: false },
                  account: null,
                },
              }
            : account,
        ),
      );
      if (selectedAccountIdRef.current !== accountId) return;
      setSession(null);
    },
    [invalidateOverviewResponses],
  );

  const commitOverviewResponse = useCallback(
    (accountId: string, response: SessionResponse, requestOrder?: number) => {
      if (requestOrder !== undefined) {
        if (overviewResponseOrders.current.get(accountId) !== requestOrder) {
          return false;
        }
      } else {
        invalidateOverviewResponses(accountId);
      }
      const responseOwner = runtimeSessionOwner(response.runtime);
      const options = accountOptionsCache.current.get(accountId);
      const normalized = {
        ...response,
        dashboard:
          responseOwner !== 'none' && response.dashboard
            ? {
                ...emptyAccountOptions(),
                ...(options || {}),
                ...response.dashboard,
              }
            : undefined,
      } as SessionResponse;
      setSession((current) => {
        const currentRunner = current?.runtime?.runner || current?.runner;
        const incomingRunner = normalized.runtime?.runner || normalized.runner;
        const nextRunner = preferNewerRunner(currentRunner, incomingRunner);
        return {
          ...normalized,
          runner: normalized.runner ? nextRunner : normalized.runner,
          runtime: normalized.runtime
            ? { ...normalized.runtime, runner: nextRunner }
            : normalized.runtime,
        };
      });
      updateRuntime(accountId, normalized);
      return true;
    },
    [invalidateOverviewResponses, updateRuntime],
  );

  const commitRunnerStream = useCallback(
    (
      accountId: string,
      nextRunner: Runner,
      nextAccount?: SessionAccount | null,
      nextSessionOwner: Account['runtime']['session_owner'] = 'server',
    ) => {
      invalidateOverviewResponses(accountId);
      const streamedAccount =
        nextSessionOwner === 'server' ? nextAccount : null;
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? (() => {
                const acceptedRunner =
                  preferNewerRunner(account.runtime.runner, nextRunner) ||
                  account.runtime.runner;
                return {
                  ...account,
                  runtime: {
                    ...account.runtime,
                    logged_in: nextSessionOwner !== 'none',
                    session_owner: nextSessionOwner,
                    runner: acceptedRunner,
                    account:
                      acceptedRunner === nextRunner &&
                      streamedAccount !== undefined
                        ? streamedAccount
                        : account.runtime.account,
                  },
                };
              })()
            : account,
        ),
      );
      if (selectedAccountIdRef.current !== accountId) return;
      setSession((current) =>
        current
          ? (() => {
              const currentRunner = current.runtime?.runner || current.runner;
              const acceptedRunner =
                preferNewerRunner(currentRunner, nextRunner) || nextRunner;
              return {
                ...current,
                dashboard:
                  acceptedRunner === nextRunner && streamedAccount !== undefined
                    ? streamedAccount
                      ? {
                          ...(current.dashboard || emptyAccountOptions()),
                          account: streamedAccount,
                        }
                      : undefined
                    : current.dashboard,
                runner: acceptedRunner,
                runtime: {
                  ...(current.runtime || {}),
                  logged_in: nextSessionOwner !== 'none',
                  session_owner: nextSessionOwner,
                  runner: acceptedRunner,
                  account:
                    acceptedRunner === nextRunner &&
                    streamedAccount !== undefined
                      ? streamedAccount
                      : current.runtime?.account,
                },
              };
            })()
          : current,
      );
    },
    [invalidateOverviewResponses],
  );

  const accountRequest = useCallback(
    async <T,>(
      accountId: string,
      path: string,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const token = sessionTokens.current.get(accountId);
      if (!token) {
        throw new AutoResearchRequestError('账号尚未登录此服务器', 401);
      }
      const result = await request<T>(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
      return result;
    },
    [request],
  );

  const applyAccountOptions = useCallback(
    (accountId: string, options: AccountOptionsResponse['options']) => {
      accountOptionsCache.current.set(accountId, options);
      if (selectedAccountIdRef.current !== accountId) return;
      setSession((current) =>
        current?.dashboard
          ? {
              ...current,
              dashboard: { ...current.dashboard, ...options },
            }
          : current,
      );
    },
    [],
  );

  const loadAccountOptions = useCallback(
    (accountId: string, refresh = false): Promise<void> => {
      if (!accountId) return Promise.resolve();
      const cached = accountOptionsCache.current.get(accountId);
      if (cached && !refresh) {
        applyAccountOptions(accountId, cached);
        return Promise.resolve();
      }
      const requestKey = `${accountId}:${refresh ? 'refresh' : 'cached'}`;
      const existing = accountOptionsRequests.current.get(requestKey);
      if (existing) return existing;
      const promise = (
        serverHostedMode && sessionTokens.current.has(accountId)
          ? accountRequest<AccountOptionsResponse>(
              accountId,
              refresh ? '/api/account/options/refresh' : '/api/account/options',
              refresh ? { method: 'POST', body: '{}' } : undefined,
            )
          : window.electron.autoResearch
              .localOverview(accountId)
              .then((result) => {
                const response = result as SessionResponse;
                if (!response.success || !response.dashboard) {
                  throw new Error('本地游戏没有返回账号详设数据');
                }
                return {
                  success: true,
                  options: {
                    umas: response.dashboard.umas,
                    supports: response.dashboard.supports,
                    decks: response.dashboard.decks,
                    parents: response.dashboard.parents,
                    friends: response.dashboard.friends,
                    friend_exclude_ids: response.dashboard.friend_exclude_ids,
                    offline_scenarios: response.dashboard.offline_scenarios,
                  },
                } as AccountOptionsResponse;
              })
      )
        .then((result) => applyAccountOptions(accountId, result.options))
        .finally(() => {
          accountOptionsRequests.current.delete(requestKey);
        });
      accountOptionsRequests.current.set(requestKey, promise);
      return promise;
    },
    [accountRequest, applyAccountOptions, serverHostedMode],
  );

  const loadOverview = useCallback(
    async (accountId: string) => {
      if (!accountId) return;
      if (
        disconnectingAccountIdRef.current === accountId ||
        activeConnectionAccountIdRef.current === accountId
      )
        return;
      const requestVersion =
        overviewRequestVersions.current.get(accountId) || 0;
      const requestOrder = invalidateOverviewResponses(accountId);
      let result: SessionResponse;
      try {
        result =
          serverHostedMode && sessionTokens.current.has(accountId)
            ? await accountRequest<SessionResponse>(
                accountId,
                '/api/account/overview',
              )
            : ((await window.electron.autoResearch.localOverview(
                accountId,
              )) as SessionResponse);
      } catch (caught) {
        if (!serverHostedMode && isMissingLocalGameSession(caught)) {
          setLocalAccountSessionStates((current) => ({
            ...current,
            [accountId]: 'missing',
          }));
          if (selectedAccountIdRef.current === accountId) {
            setSession(null);
            updateRuntime(accountId, null);
          }
          return;
        }
        if (
          disconnectingAccountIdRef.current === accountId ||
          activeConnectionAccountIdRef.current === accountId ||
          selectedAccountIdRef.current !== accountId ||
          (overviewRequestVersions.current.get(accountId) || 0) !==
            requestVersion
        )
          return;
        throw caught;
      }
      if (
        disconnectingAccountIdRef.current === accountId ||
        activeConnectionAccountIdRef.current === accountId ||
        selectedAccountIdRef.current !== accountId ||
        (overviewRequestVersions.current.get(accountId) || 0) !== requestVersion
      )
        return;
      commitOverviewResponse(accountId, result, requestOrder);
      if (!serverHostedMode) {
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: 'ready',
        }));
      }
    },
    [
      accountRequest,
      commitOverviewResponse,
      invalidateOverviewResponses,
      serverHostedMode,
      updateRuntime,
    ],
  );

  const attachExistingRuntime = useCallback(
    async (accountId: string, retry = false) => {
      if (!server || !accountId || sessionTokens.current.has(accountId)) {
        return false;
      }
      const attemptKey = `${server}|${accountId}`;
      if (!retry && existingRuntimeAttachAttempts.current.has(attemptKey)) {
        return false;
      }
      existingRuntimeAttachAttempts.current.add(attemptKey);
      setCheckingExistingRuntimeAccountId(accountId);
      setMissingExistingRuntimeAccountId((current) =>
        current === accountId ? '' : current,
      );
      const attachController = new AbortController();
      let attachTimeout = 0;
      const attachTimeoutPromise = new Promise<never>((_resolve, reject) => {
        attachTimeout = window.setTimeout(() => {
          attachController.abort();
          const timeoutError = new Error('读取服务端已有养马状态超时');
          timeoutError.name = 'AbortError';
          reject(timeoutError);
        }, 8000);
      });
      try {
        const attachRequest = (async (): Promise<AuthResponse> => {
          const credential = (await window.electron.autoResearch.credential(
            accountId,
          )) as { uid: string; accessKey: string };
          return request<AuthResponse>('/api/auth/attach', {
            method: 'POST',
            signal: attachController.signal,
            body: JSON.stringify({
              uid: credential.uid,
              access_key: credential.accessKey,
            }),
          });
        })();
        const attached = await Promise.race([
          attachRequest,
          attachTimeoutPromise,
        ]);
        const attachedRunner = attached.runtime?.runner || attached.runner;
        const hasCurrentCareer =
          attached.runtime?.session_owner === 'server' ||
          runnerUsesServerSession(attachedRunner);
        if (!hasCurrentCareer) {
          await request('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${attached.token}` },
            body: '{}',
          }).catch(() => undefined);
          setMissingExistingRuntimeAccountId(accountId);
          return false;
        }
        sessionTokens.current.set(accountId, attached.token);
        accountOptionsCache.current.delete(accountId);
        commitOverviewResponse(accountId, attached);
        setMissingExistingRuntimeAccountId('');
        localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
        return true;
      } catch (caught) {
        if ((caught as Error)?.name === 'AbortError') {
          existingRuntimeAttachAttempts.current.delete(attemptKey);
          throw new Error(
            '读取服务端已有养马状态超时；未执行游戏登录，请检查服务器连接后重试',
          );
        }
        if (
          String((caught as Error).message || '').includes(
            '服务端没有该账号正在运行的托管任务',
          ) ||
          String((caught as Error).message || '').includes(
            '服务端没有该账号正在运行的养马实例',
          )
        ) {
          setMissingExistingRuntimeAccountId(accountId);
          return false;
        }
        existingRuntimeAttachAttempts.current.delete(attemptKey);
        throw caught;
      } finally {
        window.clearTimeout(attachTimeout);
        setCheckingExistingRuntimeAccountId((current) =>
          current === accountId ? '' : current,
        );
      }
    },
    [commitOverviewResponse, request, server],
  );

  const loadCareerHistory = useCallback(
    async (accountId: string) => {
      if (!accountId || !sessionTokens.current.has(accountId)) return;
      setBusy('history');
      try {
        const result = await accountRequest<{
          success: boolean;
          reports: CareerSessionRecord[];
        }>(accountId, '/api/account/career/history');
        setCareerHistory(result.reports || []);
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [accountRequest],
  );

  const deleteCareerHistory = useCallback(
    async (reportIds: string[]) => {
      if (!selectedAccountId || !reportIds.length) return;
      setBusy('history-delete');
      setError('');
      try {
        const result = await accountRequest<{
          success: boolean;
          reports: CareerSessionRecord[];
        }>(selectedAccountId, '/api/account/career/history/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report_ids: reportIds }),
        });
        setCareerHistory(result.reports || []);
        setSelectedCareerRecords(null);
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [accountRequest, selectedAccountId],
  );

  const loadDailyTasks = useCallback(
    async (accountId: string): Promise<boolean> => {
      if (!accountId) return false;
      const account = accounts.find((item) => item.id === accountId);
      if (!account) {
        setDailyTasksOverview(null);
        setDailyTasksLoading(false);
        setDailyTasksLoadError('');
        return false;
      }
      setDailyTasksLoading(true);
      setDailyTasksLoadError('');
      try {
        const localConfig = readLocalDailyTasks(
          account.uid,
          defaultDailyTasksConfig(),
        );
        const result = (await window.electron.autoResearch.dailyTasksOverview(
          accountId,
          localConfig,
        )) as DailyTasksResponse;
        if (selectedAccountIdRef.current === accountId) {
          setDailyTasksOverview({
            ...result,
            daily_tasks: { ...result.daily_tasks, ...localConfig },
          });
        }
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: 'ready',
        }));
        return true;
      } catch (caught) {
        const loginRequired =
          String((caught as Error).message || '').includes('请先登录') ||
          needsRelogin(caught);
        if (loginRequired) {
          setLocalAccountSessionStates((current) => ({
            ...current,
            [accountId]: 'missing',
          }));
        }
        if (selectedAccountIdRef.current === accountId) {
          setDailyTasksOverview(null);
          if (loginRequired) {
            setDailyTasksLoadError('');
          } else {
            const { message } = caught as Error;
            setDailyTasksLoadError(message);
            setError(message);
          }
        }
        return false;
      } finally {
        if (selectedAccountIdRef.current === accountId) {
          setDailyTasksLoading(false);
        }
      }
    },
    [accounts],
  );

  const loginLocalAccount = useCallback(
    async (accountId: string) => {
      if (!accountId) return;
      if (serverHostedMode) {
        setError('当前账号处于服务器托管状态，请先停止托管');
        return;
      }
      if (activeLoginOperation.current || disconnectingAccountIdRef.current) {
        setError('另一个账号操作正在进行，请等待完成后再登录');
        return;
      }
      const confirmed = window.confirm(
        '登录会刷新该账号的游戏会话，可能使游戏客户端或其他工具中的同账号掉线。\n\n确定要在 UmaShow 本地登录吗？',
      );
      if (!confirmed) return;

      const operationId = `local-login-${accountId}-${Date.now()}`;
      const loginId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const startedAt = Date.now();
      activeLoginOperation.current = operationId;
      activeConnectionAccountIdRef.current = accountId;
      setSelectedAccountId(accountId);
      setBusy(`login-${accountId}`);
      setError('');
      setLocalAccountSessionStates((current) => ({
        ...current,
        [accountId]: 'checking',
      }));
      setLoginProgress({
        accountId,
        loginId,
        action: 'login',
        stage: 'local_login',
        endpoint: '',
        detail: '正在由 UmaShow 本地登录游戏账号',
        delay: 0,
        elapsed: 0,
        done: false,
        error: '',
      });
      const progressTimer = window.setInterval(() => {
        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - startedAt) / 1000),
        );
        setLoginProgress((current) =>
          current?.loginId === loginId ? { ...current, elapsed } : current,
        );
      }, 250);
      try {
        await window.electron.autoResearch.loginSession(accountId, loginId);
        // The login IPC owns the client until it returns.  Release the UI-only
        // guard before asking the same queued client for its dashboard.
        if (activeConnectionAccountIdRef.current === accountId) {
          activeConnectionAccountIdRef.current = '';
        }
        await loadOverview(accountId);
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: 'ready',
        }));
        if (activeTab === 'daily') {
          await loadDailyTasks(accountId);
        }
        localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
      } catch (caught) {
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: 'missing',
        }));
        setError((caught as Error).message);
      } finally {
        window.clearInterval(progressTimer);
        if (activeLoginOperation.current === operationId) {
          activeLoginOperation.current = '';
          activeConnectionAccountIdRef.current = '';
          setLoginProgress(null);
        }
        setBusy('');
      }
    },
    [activeTab, loadDailyTasks, loadOverview, serverHostedMode],
  );

  const logoutLocalAccount = useCallback(
    async (accountId: string) => {
      if (!accountId) return;
      if (serverHostedMode) {
        setError('服务器托管任务运行中，不能清除本地游戏会话');
        return;
      }
      if (activeLoginOperation.current || disconnectingAccountIdRef.current) {
        setError('另一个账号操作正在进行，请等待完成');
        return;
      }
      setBusy(`logout-${accountId}`);
      setError('');
      try {
        await window.electron.autoResearch.clearLocalSession(accountId);
        accountOptionsCache.current.delete(accountId);
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: 'missing',
        }));
        if (selectedAccountIdRef.current === accountId) {
          setSession(null);
          updateRuntime(accountId, null);
        }
        if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
          localStorage.removeItem(LAST_ACCOUNT_KEY);
        }
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [serverHostedMode, updateRuntime],
  );

  const saveDailyTasks = useCallback(
    async (config: DailyTasksConfig) => {
      if (serverHostedMode) {
        setError('服务端自动育成正在运行，请停止养马后再修改每日日常');
        return;
      }
      if (!selectedAccountId || !selectedAccount) return;
      setBusy('daily-save');
      setError('');
      try {
        const saved = writeLocalDailyTasks(selectedAccount.uid, config);
        setDailyTasksOverview((current) =>
          current
            ? {
                ...current,
                daily_tasks: { ...current.daily_tasks, ...saved },
              }
            : current,
        );
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [selectedAccount, selectedAccountId, serverHostedMode],
  );

  const runDailyTasks = useCallback(
    async (config: DailyTasksConfig) => {
      if (serverHostedMode) {
        setError('服务端自动育成正在运行，请停止养马后再执行每日日常');
        return;
      }
      if (!selectedAccountId || !selectedAccount) return;
      setBusy('daily-run');
      setError('');
      try {
        const saved = writeLocalDailyTasks(selectedAccount.uid, config);
        const result = (await window.electron.autoResearch.runDailyTasks(
          selectedAccountId,
          saved,
        )) as DailyTasksResponse;
        setDailyTasksOverview({
          ...result,
          daily_tasks: { ...result.daily_tasks, ...saved },
        });
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [selectedAccount, selectedAccountId, serverHostedMode],
  );

  const connect = useCallback(
    async (address?: string) => {
      const nextServer = normalizeServer(address ?? serverAddress);
      setBusy('connect');
      setError('');
      try {
        const response = await fetch(`${nextServer}/api/health`);
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.detail || '服务端未就绪');
        }
        localStorage.setItem('autoResearch.server', nextServer);
        sessionTokens.current.clear();
        existingRuntimeAttachAttempts.current.clear();
        setMissingExistingRuntimeAccountId('');
        accountOptionsCache.current.clear();
        accountOptionsRequests.current.clear();
        setAccounts((current) =>
          current.map((account) => ({
            ...account,
            runtime: {
              logged_in: false,
              session_owner: 'none',
              last_error: '',
              runner: { running: false },
              account: null,
            },
          })),
        );
        setSession(null);
        setServerAddress(nextServer);
        setServer(nextServer);
        setHealth(body);
        return true;
      } catch (caught) {
        setError(`无法连接后端：${(caught as Error).message}`);
        return false;
      } finally {
        setBusy('');
      }
    },
    [serverAddress],
  );

  useEffect(() => {
    loadUMDB().catch(() => undefined);
    let localPresets: Preset[] = [];
    try {
      const storedPresets = JSON.parse(
        getSharedStorageItem(LOCAL_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(storedPresets)) localPresets = storedPresets;
      const stored = JSON.parse(
        getSharedStorageItem(CAREER_SETTINGS_KEY) || '[]',
      );
      if (Array.isArray(stored)) {
        const normalizedSettings = stored.map((setting: CareerSetting) => {
          const normalized = { ...setting };
          delete normalized.run_queue;
          return normalized;
        });
        setCareerSettings(normalizedSettings);
        setSharedStorageItem(
          CAREER_SETTINGS_KEY,
          JSON.stringify(normalizedSettings),
        );
      }
    } catch {
      setCareerSettings([]);
    }
    const presetMap = new Map(
      localPresets
        .filter((preset) => preset?.name)
        .map((preset) => [preset.name, preset]),
    );
    if (!presetMap.has(DEFAULT_PRESET_NAME)) {
      presetMap.set(DEFAULT_PRESET_NAME, createDefaultPreset());
    }
    const nextPresets = [
      presetMap.get(DEFAULT_PRESET_NAME) as Preset,
      ...[...presetMap.values()].filter(
        (preset) => preset.name !== DEFAULT_PRESET_NAME,
      ),
    ];
    setPresets(nextPresets);
    setPresetName((current) =>
      nextPresets.some((preset) => preset.name === current)
        ? current
        : DEFAULT_PRESET_NAME,
    );
  }, []);

  useEffect(
    () => () => {
      if (presetSaveFeedbackTimer.current !== null) {
        window.clearTimeout(presetSaveFeedbackTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    window.electron.autoResearch.credentials().then(setCaptured);
    loadAccounts().catch((caught) => setError((caught as Error).message));
    const unsubscribeCredential =
      window.electron.autoResearch.onCredentialCaptured((credential) => {
        setCaptured((current) => [
          credential,
          ...current.filter((item) => item.uid !== credential.uid),
        ]);
        loadAccounts().catch((caught) => setError((caught as Error).message));
      });
    const unsubscribeLoginProgress =
      window.electron.autoResearch.onLoginProgress((progress) => {
        setLoginProgress((current) =>
          current?.loginId === progress.loginId
            ? {
                ...current,
                stage: `local_${progress.stage}`,
                endpoint: '',
                detail: progress.detail,
              }
            : current,
        );
      });
    return () => {
      unsubscribeCredential();
      unsubscribeLoginProgress();
    };
  }, [loadAccounts]);

  useEffect(() => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) return;
    setRunningStyle(Number(preset.running_style ?? 0));
    setSkillSelections(
      normalizeSkillSelections(
        preset.learn_skill_list,
        preset.learn_skill_group_labels,
      ),
    );
    setSkillLearningSettings(
      normalizeSkillLearningSettings(preset.learn_skill_settings),
    );
    setSkillThreshold(Number(preset.learn_skill_threshold || 888));
    setSkipDoubleCircle(Boolean(preset.skip_double_circle_unless_high_hint));
    setMaximizeSkillScoreAtEnd(Boolean(preset.maximize_skill_score_at_end));
    setSkillPurchaseTurns(normalizeTurnList(preset.skill_purchase_turns));
    const uraAi = preset.ura_ai || {};
    setUraAiTimeBudget(
      Math.max(0.5, Math.min(2, Number(uraAi.time_budget_s ?? 2))),
    );
    setUraAiMinRollouts(
      Math.max(32, Math.min(128, Number(uraAi.min_rollouts ?? 128))),
    );
    setUraAiMaxRollouts(
      Math.max(32, Math.min(256, Number(uraAi.max_rollouts ?? 256))),
    );
    setUraAiWorkers(Math.max(1, Math.min(64, Number(uraAi.workers ?? 4) || 4)));
    setUraAiRiskFactor(
      Math.max(-2, Math.min(2, Number(uraAi.risk_factor ?? 0))),
    );
    setUraAiTargetAttributes(
      numberArray(uraAi.target_attributes, DEFAULT_EXPECT_ATTRIBUTE),
    );
    setUraAiTargetAttributeStages(
      normalizeTargetAttributeStages(uraAi.target_attribute_stages),
    );
    setSelectedRaceIds(
      normalizeRaceSelection((preset.extra_race_list || []).map(Number), races),
    );
  }, [presetName, presets, races]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSession(null);
      return undefined;
    }
    const accountId = selectedAccountId;
    let cancelled = false;
    (async () => {
      // A server Worker may already own this account.  Attach/read that state
      // first; only fall back to Electron's local game client when no hosted
      // task exists, never race the two SID owners.
      if (server && !sessionTokens.current.has(accountId)) {
        try {
          if (await attachExistingRuntime(accountId)) return;
        } catch (caught) {
          if (!cancelled) setError((caught as Error).message);
          return;
        }
      }
      if (cancelled || selectedAccountIdRef.current !== accountId) return;
      loadOverview(accountId).catch((caught) => {
        if (!cancelled) setError((caught as Error).message);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [attachExistingRuntime, loadOverview, selectedAccountId, server]);

  useEffect(() => {
    if (
      dashboard?.account.career?.active &&
      error === '已有进行中的育成，不能重复开始'
    ) {
      setError('');
    }
  }, [dashboard?.account.career?.active, error]);

  useEffect(() => {
    if (
      !selectedAccountId ||
      !selectedAccount?.runtime.logged_in ||
      serverHostedMode ||
      !['career', 'history'].includes(activeTab)
    ) {
      return;
    }
    loadAccountOptions(selectedAccountId).catch((caught) =>
      setError((caught as Error).message),
    );
  }, [
    activeTab,
    loadAccountOptions,
    serverHostedMode,
    selectedAccount?.runtime.logged_in,
    selectedAccountId,
  ]);

  useEffect(() => {
    const selectedSetting = careerSettings.find(
      (setting) => setting.id === selectedCareerSettingId,
    );
    if (
      selectedSetting &&
      selectedSetting.account_uid !== selectedAccount?.uid
    ) {
      setSelectedCareerSettingId('');
      setCareerSettingName('');
      setCareerPresetName('');
      setCareerSaveOpen(false);
    }
  }, [careerSettings, selectedAccount?.uid, selectedCareerSettingId]);

  useEffect(() => {
    setSession(null);
    setBusy('');
    setSelectedCareerSettingId('');
    setCareerSettingName('');
    setCareerPresetName('');
    setCareerSaveOpen(false);
    setNewCareerSaveName('');
    setNewCareerPresetName('');
    setCareerHistory([]);
    setHistoryCareerSettingId('');
    setSelectedCareerRecords(null);
    setDailyTasksOverview(null);
    setDailyTasksLoading(false);
    setDailyTasksLoadError('');
    setOfflineSetup(null);
    setOfflineSetupAccountId('');
    setOfflineScenarioId(0);
    setOfflineChallengeMode(false);
    setOfflineRaceDeckNum(0);
    setOfflineRaceDeckName('');
    setOfflineRaceIds([]);
  }, [selectedAccountId]);

  useEffect(() => {
    setSelectedCareerRecords(null);
  }, [historyCareerSettingId]);

  useEffect(() => {
    if (
      activeTab !== 'history' ||
      !selectedAccountId ||
      !selectedAccount?.runtime.logged_in
    ) {
      return;
    }
    loadCareerHistory(selectedAccountId).catch(() => undefined);
  }, [
    activeTab,
    loadCareerHistory,
    selectedAccount?.runtime.logged_in,
    selectedAccountId,
  ]);

  useEffect(() => {
    if (
      activeTab !== 'daily' ||
      !selectedAccountId ||
      serverHostedMode ||
      localAccountSessionState !== 'ready'
    ) {
      return undefined;
    }
    const accountId = selectedAccountId;
    let cancelled = false;
    (async () => {
      try {
        await loadDailyTasks(accountId);
      } catch (caught) {
        if (cancelled || selectedAccountIdRef.current !== accountId) return;
        setLocalAccountSessionStates((current) => ({
          ...current,
          [accountId]: isMissingLocalGameSession(caught)
            ? 'missing'
            : current[accountId] || 'ready',
        }));
        setError((caught as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    loadDailyTasks,
    localAccountSessionState,
    selectedAccountId,
    serverHostedMode,
  ]);

  useEffect(() => {
    if (!selectedAccountId || !automationActive) return undefined;
    const token = sessionTokens.current.get(selectedAccountId);
    if (!token || !server) return undefined;
    const accountId = selectedAccountId;
    let cancelled = false;
    let retryDelay = 1000;
    let controller: AbortController | null = null;
    const handleStreamLine = (line: string) => {
      if (cancelled || !line.trim()) return;
      try {
        const event = JSON.parse(line) as {
          success?: boolean;
          runner?: Runner;
          account?: SessionAccount | null;
          session_owner?: Account['runtime']['session_owner'];
        };
        if (!event.runner) return;
        retryDelay = 1000;
        commitRunnerStream(
          accountId,
          event.runner,
          event.account,
          event.session_owner || 'server',
        );
      } catch {
        // Ignore an incomplete or malformed stream record and keep reading.
      }
    };
    const connectStream = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const response = await fetch(
            `${server}/api/account/career/runner/stream`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          if (!response.ok || !response.body) {
            throw new Error(`runner stream HTTP ${response.status}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines =
              `${buffer}${decoder.decode(value, { stream: true })}`.split('\n');
            buffer = lines.pop() || '';
            lines.forEach(handleStreamLine);
          }
        } catch (caught) {
          if ((caught as Error).name === 'AbortError' || cancelled) return;
        }
        if (!cancelled) {
          const currentRetryDelay = retryDelay;
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, currentRetryDelay);
          });
          retryDelay = Math.min(retryDelay * 2, 8000);
        }
      }
    };
    connectStream().catch(() => undefined);
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [automationActive, commitRunnerStream, selectedAccountId, server]);

  useEffect(() => {
    if (!stoppingAccountId) return;
    const account = accounts.find((item) => item.id === stoppingAccountId);
    const accountRunner =
      stoppingAccountId === selectedAccountId
        ? session?.runtime?.runner || account?.runtime.runner
        : account?.runtime.runner;
    if (
      !accountRunner?.running &&
      !accountRunner?.run_plan?.active &&
      accountRunner?.control?.desired_state !== 'running'
    ) {
      setStoppingAccountId('');
    }
  }, [accounts, selectedAccountId, session, stoppingAccountId]);

  useEffect(() => {
    if (!dashboard || !accountOptionsCache.current.has(selectedAccountId))
      return;
    if (cardId && !dashboard.umas.some((uma) => uma.id === cardId))
      setCardId(0);
    if (
      parent1 &&
      !dashboard.parents.some((parent) => parent.selection_id === parent1)
    ) {
      setParent1('');
    }
    if (
      parent2 &&
      !dashboard.parents.some((parent) => parent.selection_id === parent2)
    ) {
      setParent2('');
    }
    if (
      friendCardId &&
      !dashboard.supports.some((support) => support.id === friendCardId)
    ) {
      setFriendCardId(0);
    }
    if (deckId && !dashboard.decks.some((deck) => deck.id === deckId)) {
      setDeckId(0);
      setSupportCardIds([]);
    }
  }, [
    cardId,
    dashboard,
    deckId,
    friendCardId,
    parent1,
    parent2,
    selectedAccountId,
  ]);

  const addCredentials = async (credentials: CapturedCredential[]) => {
    if (!credentials.length) return;
    setBusy('credentials');
    setError('');
    try {
      await window.electron.autoResearch.saveAccounts(credentials);
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const addManual = async () => {
    if (!manualUid.trim() || !manualAccessKey.trim()) {
      setError('请填写 uid 和 access_key');
      return;
    }
    await addCredentials([
      {
        uid: manualUid.trim(),
        accessKey: manualAccessKey.trim(),
        source: '手动填写',
        capturedAt: new Date().toISOString(),
      },
    ]);
    setManualUid('');
    setManualAccessKey('');
  };

  const prepareAccountBeforeServer = async (accountId: string) => {
    setBusy(`prepare-${accountId}`);
    setError('');
    try {
      await window.electron.autoResearch.credential(accountId);
      setSelectedAccountId(accountId);
      localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const connectFromLoginSettings = async () => {
    if (!selectedAccountId) {
      setError('请先选择要登录的账号');
      return;
    }
    await prepareAccountBeforeServer(selectedAccountId);
    if (await connect()) {
      setLoginSettingsOpen(false);
      setActiveTab('career');
    }
  };

  const importUsersDb = async (file: File) => {
    setBusy('users-db');
    setError('');
    try {
      const content = await fileToBase64(file);
      await window.electron.autoResearch.importUsersDb(content);
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
      setDragging(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) importUsersDb(file);
  };

  const accountAction = async (
    accountId: string,
    action: 'login' | 'logout' | 'refresh',
  ) => {
    const otherLoggedInAccount = accounts.find(
      (account) =>
        runtimeSessionOwner(account.runtime) === 'server' &&
        account.id !== accountId,
    );
    const otherConnectedAccountId = Array.from(
      sessionTokens.current.keys(),
    ).find((connectedAccountId) => connectedAccountId !== accountId);
    if (
      (action === 'login' || action === 'refresh') &&
      (otherLoggedInAccount || otherConnectedAccountId)
    ) {
      setError(
        `请先退出账号 ${otherLoggedInAccount?.label || (otherLoggedInAccount ? `UID ${otherLoggedInAccount.uid}` : '当前账号')}，前端同时只能登录一个账号`,
      );
      return;
    }
    const connectionOperationId =
      action === 'login' || action === 'refresh'
        ? `${action}-${accountId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        : '';
    if (
      connectionOperationId &&
      (activeLoginOperation.current || disconnectingAccountIdRef.current)
    ) {
      setError('另一个账号正在登录、刷新或退出，请等待当前操作完成');
      return;
    }
    if (
      action === 'logout' &&
      (activeLoginOperation.current || disconnectingAccountIdRef.current)
    ) {
      setError('另一个账号操作正在进行，请等待完成后再退出');
      return;
    }
    if (connectionOperationId) {
      activeLoginOperation.current = connectionOperationId;
      activeConnectionAccountIdRef.current = accountId;
    }
    if (action === 'logout') {
      disconnectingAccountIdRef.current = accountId;
      setDisconnectingAccountId(accountId);
    }
    if (connectionOperationId || action === 'logout') {
      overviewRequestVersions.current.set(
        accountId,
        (overviewRequestVersions.current.get(accountId) || 0) + 1,
      );
    }
    const requestedAccount = accounts.find(
      (account) => account.id === accountId,
    );
    const actionUsesServerSession =
      runtimeSessionOwner(requestedAccount?.runtime) === 'server';
    if (
      (action === 'login' || action === 'refresh') &&
      !actionUsesServerSession
    ) {
      // Local mode is rebuilt exclusively from this login's load/index and
      // current-career load. Never render an overview left by the Worker.
      clearAccountOverviewSnapshot(accountId);
    }
    setBusy(`${action}-${accountId}`);
    setError('');
    try {
      let result: SessionResponse | null = null;
      const authenticate = async (
        forceLogin = false,
        recoveryDetail = '',
        allowAccountLogin = false,
      ) => {
        const loginId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (activeLoginOperation.current !== connectionOperationId) {
          throw new Error('另一个账号正在登录，请等待当前登录完成');
        }
        const startedAt = Date.now();
        const progressController = new AbortController();
        setSelectedAccountId(accountId);
        setLoginProgress({
          accountId,
          loginId,
          action: 'login',
          stage: 'queued',
          endpoint: '',
          detail:
            recoveryDetail ||
            (forceLogin ? '登录已过期，正在重新登录' : '正在连接登录服务'),
          delay: 0,
          elapsed: 0,
          done: false,
          error: '',
        });
        const progressTimer = window.setInterval(() => {
          const elapsed = Math.max(
            0,
            Math.floor((Date.now() - startedAt) / 1000),
          );
          setLoginProgress((current) =>
            current?.loginId === loginId ? { ...current, elapsed } : current,
          );
        }, 250);
        const progressStream = streamLoginProgress(
          loginId,
          (progress) => {
            if (!progress.found) return;
            const elapsed = Math.max(
              0,
              Math.floor((Date.now() - startedAt) / 1000),
            );
            setLoginProgress((current) =>
              current?.loginId === loginId
                ? {
                    ...current,
                    stage: progress.stage || current.stage,
                    endpoint: progress.endpoint || '',
                    detail: progress.detail || current.detail,
                    delay: Number(progress.delay || 0),
                    elapsed,
                    done: Boolean(progress.done),
                    error: String(progress.error || ''),
                  }
                : current,
            );
          },
          progressController.signal,
        ).catch(() => undefined);
        try {
          const credential = (await window.electron.autoResearch.credential(
            accountId,
          )) as { uid: string; accessKey: string };
          const authenticated = await request<AuthResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              uid: credential.uid,
              access_key: credential.accessKey,
              login_id: loginId,
              force_login: forceLogin,
              allow_account_login: allowAccountLogin,
            }),
          });
          sessionTokens.current.set(accountId, authenticated.token);
          return authenticated;
        } finally {
          progressController.abort();
          window.clearInterval(progressTimer);
          await progressStream.catch(() => undefined);
        }
      };
      const authenticateWithConfirmation = async (recoveryDetail = '') => {
        try {
          return await authenticate(false, recoveryDetail, false);
        } catch (caught) {
          const detail = String((caught as Error)?.message || '');
          if (!detail.includes('二次确认')) throw caught;
          const confirmed = window.confirm(
            '继续登录可能顶掉其他地方的登录。\n\n确定要继续登录吗？',
          );
          if (!confirmed) {
            throw new Error('已取消登录，服务器自动育成会话未被修改');
          }
          return authenticate(true, '已确认刷新游戏会话，正在重新登录', true);
        }
      };
      if (action === 'login') {
        const attached = await attachExistingRuntime(accountId, true);
        if (attached) return;
        if (sessionTokens.current.has(accountId)) {
          try {
            const attachedOverview = await accountRequest<SessionResponse>(
              accountId,
              '/api/account/overview',
            );
            if (runtimeSessionOwner(attachedOverview.runtime) === 'server') {
              commitOverviewResponse(accountId, attachedOverview);
              return;
            }
          } catch (caught) {
            if (
              caught instanceof AutoResearchRequestError &&
              caught.status === 401
            ) {
              sessionTokens.current.delete(accountId);
            } else {
              throw caught;
            }
          }
        }
        try {
          result = await authenticateWithConfirmation();
        } catch (caught) {
          const detail = String((caught as Error)?.message || '');
          if (detail.includes('服务器托管模式')) {
            if (sessionTokens.current.has(accountId)) {
              try {
                const hostedOverview = await accountRequest<SessionResponse>(
                  accountId,
                  '/api/account/overview',
                );
                if (runtimeSessionOwner(hostedOverview.runtime) === 'server') {
                  commitOverviewResponse(accountId, hostedOverview);
                  return;
                }
              } catch (overviewError) {
                if (
                  overviewError instanceof AutoResearchRequestError &&
                  overviewError.status === 401
                ) {
                  sessionTokens.current.delete(accountId);
                } else {
                  throw overviewError;
                }
              }
            }
            if (await attachExistingRuntime(accountId, true)) return;
          }
          throw caught;
        }
      } else if (action === 'refresh') {
        let relogged = false;
        const actionAccount = accounts.find(
          (account) => account.id === accountId,
        );
        const accountRunner = actionAccount?.runtime.runner;
        const accountRunning = Boolean(
          runtimeSessionOwner(actionAccount?.runtime) === 'server' ||
            runnerUsesServerSession(accountRunner),
        );
        const restoreLogin = async (recoveryDetail = '') => {
          await authenticateWithConfirmation(recoveryDetail);
          relogged = true;
        };
        const refreshStatus = async () => {
          if (accountRunning) {
            return accountRequest<SessionResponse>(
              accountId,
              '/api/account/overview',
            );
          }
          const refreshId = `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const startedAt = Date.now();
          const progressController = new AbortController();
          setLoginProgress({
            accountId,
            loginId: refreshId,
            action: 'refresh',
            stage: 'queued',
            endpoint: '',
            detail: '准备重新登录账号',
            delay: 0,
            elapsed: 0,
            done: false,
            error: '',
          });
          const progressTimer = window.setInterval(() => {
            const elapsed = Math.max(
              0,
              Math.floor((Date.now() - startedAt) / 1000),
            );
            setLoginProgress((current) =>
              current?.loginId === refreshId
                ? { ...current, elapsed }
                : current,
            );
          }, 250);
          const progressStream = streamLoginProgress(
            refreshId,
            (progress) => {
              if (!progress.found) return;
              const elapsed = Math.max(
                0,
                Math.floor((Date.now() - startedAt) / 1000),
              );
              setLoginProgress((current) =>
                current?.loginId === refreshId
                  ? {
                      ...current,
                      stage: progress.stage || current.stage,
                      endpoint: progress.endpoint || '',
                      detail: progress.detail || current.detail,
                      delay: Number(progress.delay || 0),
                      elapsed,
                      done: Boolean(progress.done),
                      error: String(progress.error || ''),
                    }
                  : current,
              );
            },
            progressController.signal,
          ).catch(() => undefined);
          try {
            return await accountRequest<SessionResponse>(
              accountId,
              '/api/account/refresh',
              {
                method: 'POST',
                body: JSON.stringify({ refresh_id: refreshId }),
              },
            );
          } finally {
            progressController.abort();
            window.clearInterval(progressTimer);
            await progressStream.catch(() => undefined);
          }
        };
        if (!sessionTokens.current.has(accountId)) {
          if (accountRunning) {
            const attached = await attachExistingRuntime(accountId, true);
            if (!attached) {
              throw new Error('无法连接服务器上的托管任务，请稍后重试');
            }
          } else {
            await restoreLogin();
          }
        }
        try {
          result = await refreshStatus();
        } catch (caught) {
          if (!needsRelogin(caught)) throw caught;
          sessionTokens.current.delete(accountId);
          if (
            caught instanceof AutoResearchRequestError &&
            caught.status === 401
          ) {
            try {
              await restoreLogin('服务器会话已失效，正在重新登录后继续刷新');
            } catch (loginError) {
              throw new Error(
                `服务器会话已失效，自动重新登录失败：${(loginError as Error).message}。请在账号页重新登录；如果 access_key 已变化，请先更新账号凭据。`,
              );
            }
          } else {
            await authenticateWithConfirmation('需要重新连接账号');
            relogged = true;
          }
          try {
            result = await refreshStatus();
          } catch (retryError) {
            if (
              retryError instanceof AutoResearchRequestError &&
              retryError.status === 401
            ) {
              throw new Error(
                '自动重新登录后刷新仍返回 401 Unauthorized。请在账号页重新登录；如果 access_key 已变化，请先更新账号凭据。',
              );
            }
            if (String((retryError as Error)?.message || '').includes('217')) {
              throw new Error(
                '重新登录后仍出现错误码 217，账号可能正在其他位置操作。请稍后再次刷新。',
              );
            }
            throw retryError;
          }
        }
        result.relogged_in = relogged;
      } else {
        await accountRequest(accountId, '/api/auth/logout', {
          method: 'POST',
          body: '{}',
        });
        sessionTokens.current.delete(accountId);
      }
      accountOptionsCache.current.delete(accountId);
      if (result) {
        commitOverviewResponse(accountId, result);
      } else {
        setSession(null);
        updateRuntime(accountId, null);
      }
      setSelectedAccountId(accountId);
      if (action === 'logout') {
        if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
          localStorage.removeItem(LAST_ACCOUNT_KEY);
        }
      } else if (result?.success) {
        localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
        if (action === 'login') setActiveTab('career');
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      if (activeLoginOperation.current === connectionOperationId) {
        activeLoginOperation.current = '';
        activeConnectionAccountIdRef.current = '';
        setLoginProgress(null);
      }
      if (
        action === 'logout' &&
        disconnectingAccountIdRef.current === accountId
      ) {
        disconnectingAccountIdRef.current = '';
        setDisconnectingAccountId('');
      }
      setBusy('');
    }
  };

  const ensureServerTaskSession = async (accountId: string) => {
    if (!server) {
      setError('启动后台任务前，请先连接自动育成服务器');
      return false;
    }

    // A server Worker owns a different long-running game client.  Hand the
    // account over only after dropping Electron's client/SID, so it cannot be
    // used again after the server establishes its own session. Do this even
    // when a Worker is already attached: a stale local SID must never remain
    // available as a fallback owner.
    try {
      await window.electron.autoResearch.clearLocalSession(accountId);
      setLocalAccountSessionStates((current) => ({
        ...current,
        [accountId]: 'missing',
      }));
    } catch (caught) {
      setError(`无法移交本地游戏会话：${(caught as Error).message}`);
      return false;
    }

    if (serverHostedMode && sessionTokens.current.has(accountId)) return true;

    // accountAction intentionally reports UI errors instead of rethrowing.
    // Remove any stale bearer first, otherwise a failed server login could be
    // mistaken for success merely because an old token remains in this map.
    sessionTokens.current.delete(accountId);
    await accountAction(accountId, 'login');
    return sessionTokens.current.has(accountId);
  };

  const exitAutoResearchLogin = async () => {
    if (selectedAccountId && sessionTokens.current.has(selectedAccountId)) {
      await accountAction(selectedAccountId, 'logout');
    } else if (selectedAccountId) {
      await logoutLocalAccount(selectedAccountId);
    }
    setServer('');
    setHealth(null);
    setSession(null);
    setActiveTab('career');
  };

  const refreshOptionsIndex = async () => {
    if (!selectedAccountId) return;
    if (serverHostedMode) {
      await loadOverview(selectedAccountId);
      return;
    }
    setBusy('options-index');
    setError('');
    try {
      await loadAccountOptions(selectedAccountId, true);
    } catch (caught) {
      setError(
        needsRelogin(caught)
          ? '登录会话已失效，请退出账号后重新连接'
          : (caught as Error).message,
      );
    } finally {
      setBusy('');
    }
  };

  const refreshCurrentAccount = () => {
    if (!selectedAccountId) return;
    if (serverHostedMode) {
      accountAction(selectedAccountId, 'refresh').catch(() => undefined);
      return;
    }
    loginLocalAccount(selectedAccountId).catch(() => undefined);
  };

  const deleteAccount = async (accountId: string) => {
    setBusy(`delete-${accountId}`);
    try {
      if (sessionTokens.current.has(accountId)) {
        await accountRequest(accountId, '/api/auth/logout', {
          method: 'POST',
          body: '{}',
        }).catch(() => undefined);
        sessionTokens.current.delete(accountId);
      }
      accountOptionsCache.current.delete(accountId);
      await window.electron.autoResearch.deleteAccount(accountId);
      if (selectedAccountId === accountId) {
        setSelectedAccountId('');
        setSession(null);
      }
      if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
        localStorage.removeItem(LAST_ACCOUNT_KEY);
      }
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const resetAccount = async (accountId: string) => {
    if (
      !window.confirm(
        '确定强制重置当前账号吗？这会停止自动操作，清除等待、运行计划、每日计划和服务端登录，但不会向游戏发送放弃育成请求。',
      )
    )
      return;
    if (activeLoginOperation.current || disconnectingAccountIdRef.current) {
      setError('账号连接操作正在进行，请等待完成后再重置');
      return;
    }
    const resetOperationId = `reset-${accountId}-${Date.now()}`;
    activeLoginOperation.current = resetOperationId;
    activeConnectionAccountIdRef.current = accountId;
    overviewRequestVersions.current.set(
      accountId,
      (overviewRequestVersions.current.get(accountId) || 0) + 1,
    );
    setBusy(`reset-${accountId}`);
    setError('');
    try {
      await accountRequest<{ success: boolean; reset: boolean }>(
        accountId,
        '/api/account/reset',
        { method: 'POST', body: '{}' },
      );
      sessionTokens.current.delete(accountId);
      accountOptionsCache.current.delete(accountId);
      setSession(null);
      updateRuntime(accountId, null);
      if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
        localStorage.removeItem(LAST_ACCOUNT_KEY);
      }
      setActiveTab('career');
    } catch (caught) {
      if (needsRelogin(caught)) {
        sessionTokens.current.delete(accountId);
        setSession(null);
        updateRuntime(accountId, null);
      }
      setError((caught as Error).message);
    } finally {
      if (activeLoginOperation.current === resetOperationId) {
        activeLoginOperation.current = '';
        activeConnectionAccountIdRef.current = '';
      }
      setBusy('');
    }
  };

  const togglePrioritySkill = (skill: AutoResearchSkill) => {
    const removing = skillPriorityNames.includes(skill.name);
    setSkillSelections((current) => {
      if (!removing) {
        return [
          ...current,
          {
            id: createSkillSelectionId(),
            label: '',
            skill_names: [skill.name],
          },
        ];
      }
      return current
        .map((entry) => ({
          ...entry,
          skill_names: entry.skill_names.filter((name) => name !== skill.name),
        }))
        .filter((entry) => entry.skill_names.length);
    });
    if (removing) {
      setSkillLearningSettings((settings) => {
        const next = { ...settings };
        delete next[skill.name];
        return next;
      });
      if (editingSkillSelection?.skill_names.includes(skill.name)) {
        setEditingSkillSelectionId('');
      }
    }
  };

  const addSkillGroup = (groupSkills: AutoResearchSkill[], label: string) => {
    const selected = new Set(skillPriorityNames);
    const names = Array.from(
      new Set(
        groupSkills
          .map((skill) => skill.name.trim())
          .filter((name) => name && !selected.has(name)),
      ),
    );
    if (!names.length) return;
    setSkillSelections((current) => [
      ...current,
      {
        id: createSkillSelectionId(),
        label: label.trim() || `技能组 ${current.length + 1}`,
        skill_names: names,
      },
    ]);
  };

  const reorderPrioritySkill = (source: string, target: string) => {
    if (!source || !target || source === target) return;
    setSkillSelections((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((entry) => entry.id === source);
      const targetIndex = next.findIndex((entry) => entry.id === target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const updateSkillLearningSetting = (
    names: string[],
    update: Partial<SkillLearningSetting>,
  ) => {
    setSkillLearningSettings((current) => {
      const next = { ...current };
      names.forEach((name) => {
        const existing = current[name] || {
          min_hint_level: 0,
          learn_when_affordable: false,
          purchase_turns: [],
        };
        next[name] = {
          ...existing,
          ...update,
        };
      });
      return next;
    });
  };

  const skillSelectionSetting = (entry: SkillSelectionEntry) => {
    const settings = entry.skill_names.map(
      (name) =>
        skillLearningSettings[name] || {
          min_hint_level: 0,
          learn_when_affordable: false,
          purchase_turns: [],
        },
    );
    const first = settings[0];
    const mixed = settings.some(
      (setting) => JSON.stringify(setting) !== JSON.stringify(first),
    );
    return { setting: first, mixed };
  };

  const skillLearningConditionLabel = (entry: SkillSelectionEntry) => {
    const { setting, mixed } = skillSelectionSetting(entry);
    if (mixed) return '组内技能使用了不同的学习条件';
    const normalizedSetting = setting || {
      min_hint_level: 0,
      learn_when_affordable: false,
      purchase_turns: [],
    };
    const parts = [`Hint ≥ ${normalizedSetting.min_hint_level}`];
    if (normalizedSetting.learn_when_affordable) parts.push('PT 足够立即学习');
    if (normalizedSetting.purchase_turns.length) {
      parts.push(
        `独立时间：${normalizedSetting.purchase_turns.map(skillPurchaseTurnLabel).join('、')}`,
      );
    }
    return parts.join(' · ');
  };

  const draftPreset = () => {
    const minRollouts = Math.max(32, Math.min(128, uraAiMinRollouts));
    const maxRollouts = Math.max(
      minRollouts,
      Math.max(32, Math.min(256, uraAiMaxRollouts)),
    );
    return {
      name: presetName.trim(),
      scenario_id: scenarioId,
      running_style: runningStyle,
      learn_skill_list: skillSelections.map((entry) => entry.skill_names),
      learn_skill_group_labels: skillSelections.map((entry) => entry.label),
      learn_skill_settings: Object.fromEntries(
        skillPriorityNames
          .filter((name) => skillLearningSettings[name])
          .map((name) => [name, skillLearningSettings[name]]),
      ),
      learn_skill_blacklist: [],
      learn_skill_threshold: skillThreshold,
      learn_skill_only_user_provided: true,
      skip_double_circle_unless_high_hint: skipDoubleCircle,
      maximize_skill_score_at_end: maximizeSkillScoreAtEnd,
      skill_purchase_turns: normalizeTurnList(skillPurchaseTurns),
      ura_ai: {
        enabled: true,
        time_budget_s: Math.max(0.5, Math.min(2, uraAiTimeBudget)),
        min_rollouts: minRollouts,
        max_rollouts: maxRollouts,
        workers: Math.max(1, Math.min(64, uraAiWorkers)),
        risk_factor: Math.max(-2, Math.min(2, uraAiRiskFactor)),
        target_attributes: uraAiTargetAttributes.map((value) =>
          Math.max(0, Math.trunc(value)),
        ),
        target_attribute_stages: normalizeTargetAttributeStages(
          uraAiTargetAttributeStages,
        ),
      },
      extra_race_list: normalizeRaceSelection(selectedRaceIds, races).sort(
        (leftId, rightId) => {
          const left = races.find((race) => race.id === leftId);
          const right = races.find((race) => race.id === rightId);
          if (left && right) return compareRaces(left, right);
          if (left) return -1;
          if (right) return 1;
          return leftId - rightId;
        },
      ),
    };
  };

  const runCareer = async (mode: RunMode, target: number) => {
    if (!selectedAccountId || !dashboard?.account) return false;
    const idleSingleMode = currentIdleSingleMode;
    if (idleSingleMode?.active) {
      const stateLabel =
        idleSingleMode.state === 'playing'
          ? '进行中'
          : idleSingleMode.state === 'finished'
            ? '已完成，等待查看结果'
            : '结果已查看，等待游戏清理';
      setError(
        `当前存在离线自动育成「${idleSingleMode.name || '未知马娘'}」（${stateLabel}），暂不能启动普通自动育成。请先在游戏中处理该离线育成后刷新。`,
      );
      return false;
    }
    const boundPreset = presets.find(
      (preset) => preset.name === careerPresetName,
    );
    if (!boundPreset) {
      setError('这个养马详设绑定的预设不存在，请返回后重新创建详设');
      return false;
    }
    const active = dashboard.account.career?.active;
    if (active && !canContinueCurrentCareer) {
      setError(
        `当前育成与所选养马详设不一致：${careerConfigDifferences.join('、')}。请选择匹配的详设后继续，或放弃本次育成。`,
      );
      return false;
    }
    if (
      !active &&
      (!cardId || !deckId || !parent1 || !parent2 || !friendCardId)
    ) {
      setError('开始新育成前，请完整选择角色、卡组、好友支援和两位继承马娘');
      return false;
    }
    if (!active && selectionConflict) {
      setError(selectionConflict);
      return false;
    }
    if (!(await ensureServerTaskSession(selectedAccountId))) return false;
    setBusy('run');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/run',
        {
          method: 'POST',
          body: JSON.stringify({
            card_id: effectiveCardId,
            support_card_ids: effectiveSupportCardIds,
            friend_viewer_id: 0,
            friend_card_id: effectiveFriendCardId,
            parent_id_1: effectiveParentId1,
            parent_id_2: effectiveParentId2,
            parent_1_viewer_id:
              selectedParent1?.viewer_id ||
              parentViewerIdFromSelection(effectiveParentKey1),
            parent_2_viewer_id:
              selectedParent2?.viewer_id ||
              parentViewerIdFromSelection(effectiveParentKey2),
            scenario_id: scenarioId,
            deck_id: effectiveDeckId || 1,
            use_tp: 30,
            recover_tp_with_item: recoverTpWithItem,
            recover_tp_with_jewels: recoverTpWithJewels,
            run_mode: mode,
            run_target: target,
            repeat_daily: repeatDaily,
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
            daily_tasks: readCareerDailyTasks(selectedAccount?.uid || ''),
            career_setting_id: selectedCareerSetting?.id || '',
            career_setting_name:
              selectedCareerSetting?.name || careerSettingName,
            preset_name: careerPresetName,
            preset: boundPreset,
            max_steps: maxSteps,
            burn_clocks: burnClocks,
          }),
        },
      );
      commitOverviewResponse(selectedAccountId, result);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const resumeCareerWithSetting = async (
    setting: CareerSetting,
    mode: RunMode,
    target: number,
  ) => {
    if (!selectedAccountId || !activeCareer?.active) return false;
    const preset = presets.find((item) => item.name === setting.preset_name);
    if (!preset) {
      setError(`养马详设使用的预设不存在：${setting.preset_name}`);
      return false;
    }
    if (!careerSettingMatchesCurrent(setting, activeCareer)) {
      setError('当前育成与这个养马详设不一致，请重新登录后再选择');
      return false;
    }
    const busyKey = `resume-${setting.id}`;
    const currentDeck = dashboard?.decks.find(
      (deck) => deck.id === setting.deck_id,
    );
    const resumeSupportCardIds =
      activeCareer.support_card_ids?.length === 5
        ? activeCareer.support_card_ids
        : currentDeck?.support_card_ids.length === 5
          ? currentDeck.support_card_ids
          : setting.support_card_ids || [];
    if (!(await ensureServerTaskSession(selectedAccountId))) return false;
    setBusy(busyKey);
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/run',
        {
          method: 'POST',
          body: JSON.stringify({
            card_id: setting.card_id,
            support_card_ids: resumeSupportCardIds,
            friend_viewer_id: 0,
            friend_card_id: setting.friend_card_id,
            parent_id_1: setting.parent_id_1,
            parent_id_2: setting.parent_id_2,
            parent_1_viewer_id: parentViewerIdFromSelection(
              setting.parent_key_1,
            ),
            parent_2_viewer_id: parentViewerIdFromSelection(
              setting.parent_key_2,
            ),
            scenario_id: Number(setting.scenario_id || preset.scenario_id || 1),
            deck_id: setting.deck_id || 1,
            use_tp: 30,
            recover_tp_with_item: setting.recover_tp_with_item,
            recover_tp_with_jewels: setting.recover_tp_with_jewels,
            run_mode: mode,
            run_target: target,
            repeat_daily: repeatDaily,
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
            daily_tasks: readCareerDailyTasks(selectedAccount?.uid || ''),
            career_setting_id: setting.id,
            career_setting_name: setting.name,
            preset_name: setting.preset_name,
            preset,
            max_steps: setting.max_steps || 2500,
            burn_clocks: setting.burn_clocks,
          }),
        },
      );
      setSelectedCareerSettingId(setting.id);
      setCareerSettingName(setting.name);
      commitOverviewResponse(selectedAccountId, result);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const stopCareer = async () => {
    if (!selectedAccountId) return;
    const accountId = selectedAccountId;
    setStoppingAccountId(accountId);
    setBusy('stop');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/career/runner/stop',
        {
          method: 'POST',
          body: '{}',
        },
      );
      invalidateOverviewResponses(accountId);
      setSession((current) =>
        current
          ? {
              ...current,
              runner: result.runner || current.runner,
              runtime: {
                ...current.runtime,
                runner: result.runner ||
                  result.runtime?.runner ||
                  current.runtime?.runner || { running: false },
              },
            }
          : current,
      );
      updateRuntime(accountId, result);
      loadOverview(accountId).catch(() => undefined);
    } catch (caught) {
      setStoppingAccountId('');
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const updateRunnerConfiguration = async (
    preset: Preset | undefined,
    mode: RunMode,
    target: number,
    careerOptions?: Pick<
      CareerSetting,
      | 'max_steps'
      | 'burn_clocks'
      | 'recover_tp_with_item'
      | 'recover_tp_with_jewels'
    >,
  ) => {
    if (!selectedAccountId) return false;
    if (mode === 'daily_jewel_schedule') {
      setError('运行中请先选择单次、持续、完成次数或宝石目标');
      return false;
    }
    setBusy('update-runner');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/runner/update',
        {
          method: 'POST',
          body: JSON.stringify({
            run_mode: mode,
            run_target: target,
            ...(preset
              ? {
                  preset_name: preset.name,
                  preset,
                }
              : {}),
            max_steps:
              careerOptions?.max_steps ||
              activeAutomationSetting?.max_steps ||
              maxSteps,
            burn_clocks:
              careerOptions?.burn_clocks ??
              activeAutomationSetting?.burn_clocks ??
              burnClocks,
            recover_tp_with_item:
              careerOptions?.recover_tp_with_item ??
              activeAutomationSetting?.recover_tp_with_item ??
              recoverTpWithItem,
            recover_tp_with_jewels:
              careerOptions?.recover_tp_with_jewels ??
              activeAutomationSetting?.recover_tp_with_jewels ??
              recoverTpWithJewels,
          }),
        },
      );
      commitOverviewResponse(selectedAccountId, result);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const updateRunningAutomation = async () => {
    const target =
      runMode === 'count'
        ? Math.max(1, runCountTarget)
        : runMode === 'jewel_drops'
          ? Math.max(1, jewelDropTarget)
          : 1;
    if (runner?.control?.request?.career_mode === 'offline') {
      await updateRunnerConfiguration(undefined, runMode, target);
      return;
    }
    const presetNameForRunner =
      activeAutomationSetting?.preset_name ||
      String(runner?.control?.request?.preset_name || '') ||
      careerPresetName;
    const preset = presets.find((item) => item.name === presetNameForRunner);
    if (!preset) {
      setError('当前自动育成绑定的预设不存在');
      return;
    }
    await updateRunnerConfiguration(preset, runMode, target);
  };

  const releaseSessionWait = async () => {
    if (!selectedAccountId || !runnerSessionWaiting) return;
    const accountId = selectedAccountId;
    setBusy('release-session-wait');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/career/runner/release-wait',
        { method: 'POST', body: '{}' },
      );
      invalidateOverviewResponses(accountId);
      setSession((current) =>
        current
          ? {
              ...current,
              runner: result.runner || current.runner,
              runtime: {
                ...current.runtime,
                runner: result.runner ||
                  result.runtime?.runner ||
                  current.runtime?.runner || { running: false },
              },
            }
          : current,
      );
      updateRuntime(accountId, result);
      loadOverview(accountId).catch(() => undefined);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const abandonCareer = async () => {
    if (!selectedAccountId || !dashboard?.account.career?.active) return;
    if (serverHostedMode) {
      setError('服务器托管期间不能使用本地 SID 放弃育成，请先停止服务器托管');
      return;
    }
    const accountId = selectedAccountId;
    if (
      !window.confirm('确定放弃当前育成吗？本次育成会立即结束，且无法恢复。')
    ) {
      return;
    }
    setBusy('abandon');
    setError('');
    try {
      const result = await window.electron.autoResearch.abandonCareer(
        accountId,
        Number(dashboard.account.career.scenario_id || scenarioId || 1),
        Number(runner?.turn ?? dashboard.account.career.turn ?? 1),
      );
      if (!result?.careerDeleted) {
        throw new Error('本地放弃育成后未能确认游戏状态');
      }
      invalidateOverviewResponses(accountId);
      setSession((current) =>
        current?.dashboard
          ? {
              ...current,
              dashboard: {
                ...current.dashboard,
                account: { ...current.dashboard.account, career: null },
              },
            }
          : current,
      );
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId && account.runtime.account
            ? {
                ...account,
                runtime: {
                  ...account.runtime,
                  account: { ...account.runtime.account, career: null },
                },
              }
            : account,
        ),
      );
      setCareerSaveOpen(false);
      setSelectedCareerSettingId('');
      setCareerSettingName('');
      setCareerPresetName('');
      setOfflineSetup(null);
      setOfflineSetupAccountId('');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const refreshIdleSingleMode = async () => {
    if (!selectedAccountId) return;
    if (!serverHostedMode) {
      await loadOverview(selectedAccountId).catch((caught) =>
        setError((caught as Error).message),
      );
      return;
    }
    setBusy('idle-single-mode-refresh');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/overview',
      );
      commitOverviewResponse(selectedAccountId, result);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const abandonIdleSingleMode = async () => {
    if (!selectedAccountId || !currentIdleSingleMode?.active) {
      return;
    }
    if (
      !window.confirm(
        '确定放弃离线自动育成吗？本次育成会立即结束，且无法恢复。',
      )
    ) {
      return;
    }
    setBusy('idle-single-mode-abandon');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/idle-single-mode/abandon',
        { method: 'POST', body: '{}' },
      );
      commitOverviewResponse(selectedAccountId, result);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const savePreset = async () => {
    if (
      !presetEditorOpen ||
      !presets.some((preset) => preset.name === presetName)
    ) {
      setError('请先从预设槽位界面选择一个预设');
      return false;
    }
    setPresetSaved(false);
    setBusy('preset');
    try {
      const preset = draftPreset();
      const nextPresets = presets.map((item) =>
        item.name === preset.name ? preset : item,
      );
      setPresets(nextPresets);
      setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
      const runnerPresetName =
        activeAutomationSetting?.preset_name ||
        String(runner?.control?.request?.preset_name || '');
      if (automationActive && runnerPresetName === preset.name) {
        const target =
          runMode === 'count'
            ? Math.max(1, runCountTarget)
            : runMode === 'jewel_drops'
              ? Math.max(1, jewelDropTarget)
              : 1;
        if (!(await updateRunnerConfiguration(preset, runMode, target))) {
          return false;
        }
      }
      setError('');
      setPresetSaved(true);
      if (presetSaveFeedbackTimer.current !== null) {
        window.clearTimeout(presetSaveFeedbackTimer.current);
      }
      presetSaveFeedbackTimer.current = window.setTimeout(() => {
        setPresetSaved(false);
        presetSaveFeedbackTimer.current = null;
      }, 1800);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const exportPreset = (preset: Preset) => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'umashow-autoresearch-preset',
            version: 1,
            preset,
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
    anchor.download = `${preset.name.replace(/[<>:"/\\|?*]+/g, '_') || '预设'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const raw = parsed?.preset ?? parsed;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('文件中没有可用的预设数据');
      }
      const requestedName = String(
        raw.name || file.name.replace(/\.json$/i, ''),
      ).trim();
      const baseName = requestedName || '导入预设';
      let name = baseName;
      let suffix = 2;
      const existingNames = new Set(presets.map((preset) => preset.name));
      while (existingNames.has(name)) {
        name = `${baseName} (${suffix})`;
        suffix += 1;
      }
      const importedPreset: Preset = {
        ...createDefaultPreset(name),
        ...(raw as Partial<Preset>),
        name,
        scenario_id: 1,
      };
      const nextPresets = [...presets, importedPreset];
      setPresets(nextPresets);
      setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
      setPresetName(name);
      setPresetEditorOpen(true);
      setPresetSaved(false);
      setError('');
    } catch (caught) {
      setError(`预设导入失败：${(caught as Error).message}`);
    }
  };

  const navigateToTab = (tab: AutoResearchTab, target?: string) => {
    if (tab === 'presets') {
      if (target) {
        const selectedName = presets.some(
          (preset) => preset.name === presetName,
        )
          ? presetName
          : DEFAULT_PRESET_NAME;
        setPresetName(selectedName);
        setPresetEditorOpen(true);
      } else {
        setPresetEditorOpen(false);
      }
    }
    setActiveTab(tab);
    if (target) {
      window.setTimeout(() => scrollToSection(target), 0);
    }
  };

  const savePresetAndContinue = async () => {
    if (await savePreset()) {
      navigateToTab('career', 'career-task');
    }
  };

  const openPresetEditor = (name: string) => {
    if (!presets.some((preset) => preset.name === name)) return;
    setPresetName(name);
    setPresetEditorOpen(true);
    setPresetSaved(false);
    setError('');
  };

  const createPresetSlot = () => {
    const name = newPresetName.trim();
    if (!name) {
      setError('请先填写新预设名称');
      return;
    }
    if (presets.some((preset) => preset.name === name)) {
      setError(`预设“${name}”已经存在`);
      return;
    }
    const nextPresets = [...presets, createDefaultPreset(name)];
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
    setPresetName(name);
    setPresetEditorOpen(true);
    setPresetSaved(false);
    setNewPresetName('');
    setError('');
  };

  const renamePreset = (currentName: string, nextName: string) => {
    const name = nextName.trim();
    if (currentName === DEFAULT_PRESET_NAME) return true;
    if (!name) {
      setError('预设名称不能为空');
      return false;
    }
    if (name === currentName) return true;
    if (presets.some((preset) => preset.name === name)) {
      setError(`预设“${name}”已经存在`);
      return false;
    }
    const nextPresets = presets.map((preset) =>
      preset.name === currentName ? { ...preset, name } : preset,
    );
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));

    const nextCareerSettings = careerSettings.map((setting) =>
      setting.preset_name === currentName
        ? { ...setting, preset_name: name }
        : setting,
    );
    setCareerSettings(nextCareerSettings);
    setSharedStorageItem(
      CAREER_SETTINGS_KEY,
      JSON.stringify(nextCareerSettings),
    );

    if (presetName === currentName) setPresetName(name);
    if (careerPresetName === currentName) setCareerPresetName(name);
    if (newCareerPresetName === currentName) setNewCareerPresetName(name);
    setError('');
    return true;
  };

  const deletePreset = (requestedName = presetName) => {
    const name = requestedName.trim();
    if (!name) return;
    if (name === DEFAULT_PRESET_NAME) {
      setError('默认预设用于兜底，不能删除');
      return;
    }
    const referencedSettings = careerSettings.filter(
      (setting) => setting.preset_name === name,
    );
    if (referencedSettings.length) {
      setError(
        `“${name}”仍被 ${referencedSettings.length} 个养马详设使用。请先到“自动育成”中删除这些详设。`,
      );
      return;
    }
    if (careerSaveOpen && careerPresetName === name) {
      setError('当前正在编辑的养马详设已绑定这个预设，请先返回详设选择界面');
      return;
    }
    if (!window.confirm(`确定删除预设“${name}”吗？`)) return;
    const nextPresets = presets.filter((preset) => preset.name !== name);
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
    setPresetName(DEFAULT_PRESET_NAME);
    if (newCareerPresetName === name) setNewCareerPresetName('');
    setPresetEditorOpen(false);
    setError('');
  };

  const persistCareerSettings = (nextSettings: CareerSetting[]) => {
    setCareerSettings(nextSettings);
    setSharedStorageItem(CAREER_SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  const closeCareerEditor = () => {
    if (!selectedCareerSettingId) {
      setCareerSettingName('');
      setCareerPresetName('');
    }
    setCareerSaveOpen(false);
    setOfflineSetup(null);
    setOfflineSetupAccountId('');
    setError('');
  };

  const editCareerPreset = () => {
    if (careerMode === 'offline') {
      setError('离线详设不使用本地预设');
      return;
    }
    if (
      !careerPresetName ||
      !presets.some((preset) => preset.name === careerPresetName)
    ) {
      setError('这个养马详设绑定的预设不存在');
      return;
    }
    setPresetName(careerPresetName);
    setPresetEditorOpen(true);
    setActiveTab('presets');
    window.setTimeout(() => scrollToSection('preset-basic'), 0);
    setError('');
  };

  const editPresetForCareerSetting = (settingId: string) => {
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) {
      setError('所选养马详设不存在');
      return;
    }
    if (setting.mode === 'offline') {
      setError('离线详设不使用本地预设');
      return;
    }
    if (!presets.some((preset) => preset.name === setting.preset_name)) {
      setError(`养马详设绑定的预设不存在：${setting.preset_name}`);
      return;
    }
    setSelectedCareerSettingId(setting.id);
    setCareerSettingName(setting.name);
    setCareerPresetName(setting.preset_name);
    setPresetName(setting.preset_name);
    setPresetEditorOpen(true);
    setActiveTab('presets');
    window.setTimeout(() => scrollToSection('preset-basic'), 0);
    setError('');
  };

  const applyCareerSetting = (settingId: string) => {
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) return;
    const mode = setting.mode === 'offline' ? 'offline' : 'online';
    if (
      mode === 'online' &&
      !presets.some((preset) => preset.name === setting.preset_name)
    ) {
      setError(`养马详设绑定的预设不存在：${setting.preset_name}`);
      return;
    }
    setSelectedCareerSettingId(settingId);
    setCareerMode(mode);
    setCareerSettingName(setting.name);
    setPresetName(setting.preset_name);
    setCareerPresetName(setting.preset_name);
    setCardId(setting.card_id);
    setDeckId(setting.deck_id);
    setSupportCardIds(setting.support_card_ids || []);
    setFriendCardId(
      setting.friend_card_id ||
        Number(setting.friend_key?.split(':').pop()) ||
        0,
    );
    setParent1(
      setting.parent_key_1 ||
        dashboard?.parents.find(
          (parent) =>
            parent.source === 'own' &&
            parent.instance_id === setting.parent_id_1,
        )?.selection_id ||
        '',
    );
    setParent2(
      setting.parent_key_2 ||
        dashboard?.parents.find(
          (parent) =>
            parent.source === 'own' &&
            parent.instance_id === setting.parent_id_2,
        )?.selection_id ||
        '',
    );
    setMaxSteps(setting.max_steps || 2500);
    setBurnClocks(Boolean(setting.burn_clocks));
    setRecoverTpWithItem(Boolean(setting.recover_tp_with_item));
    setRecoverTpWithJewels(Boolean(setting.recover_tp_with_jewels));
    setOfflineSetup(null);
    setOfflineSetupAccountId('');
    setOfflineScenarioId(Number(setting.offline_scenario_id || 0));
    setOfflineChallengeMode(Boolean(setting.offline_training_challenge_mode));
    setOfflineRaceDeckNum(Number(setting.offline_race_deck_num || 0));
    setOfflineRaceDeckName(setting.offline_race_deck_name || '');
    setOfflineRaceIds(
      (setting.offline_race_array || []).map(
        (race) => race.year * 100000 + race.program_id,
      ),
    );
    setOfflineFactorSelection(
      normalizeOfflineFactorSelection(setting.offline_factor_selection),
    );
    setOfflineSkillSettings(
      normalizeOfflineSkillSettings(setting.offline_skill_settings),
    );
    setCareerSaveOpen(true);
  };

  const createCareerSave = () => {
    const name = newCareerSaveName.trim();
    if (!name) {
      setError('请先填写新详设名称');
      return;
    }
    if (
      newCareerMode === 'online' &&
      (!newCareerPresetName ||
        !presets.some((preset) => preset.name === newCareerPresetName))
    ) {
      setError('请先选择这个养马详设要绑定的预设');
      return;
    }
    setSelectedCareerSettingId('');
    setCareerMode(newCareerMode);
    setCareerSettingName(name);
    setCareerPresetName(newCareerMode === 'online' ? newCareerPresetName : '');
    setCardId(0);
    setDeckId(0);
    setSupportCardIds([]);
    setFriendCardId(0);
    setParent1('');
    setParent2('');
    setParentSelectionSlot(1);
    setMaxSteps(2500);
    setBurnClocks(false);
    setRecoverTpWithItem(false);
    setRecoverTpWithJewels(false);
    setOfflineSetup(null);
    setOfflineSetupAccountId('');
    setOfflineScenarioId(0);
    setOfflineChallengeMode(false);
    setOfflineRaceDeckNum(0);
    setOfflineRaceDeckName('');
    setOfflineRaceIds([]);
    setOfflineFactorSelection(createDefaultOfflineFactorSelection());
    setOfflineSkillSettings(createDefaultOfflineSkillSettings());
    setCareerSaveOpen(true);
    setNewCareerSaveName('');
    setNewCareerPresetName('');
    setError('');
  };

  const renameCareerSetting = (settingId: string, nextName: string) => {
    const name = nextName.trim();
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting || !name || name === setting.name) return;
    persistCareerSettings(
      careerSettings.map((item) =>
        item.id === settingId ? { ...item, name } : item,
      ),
    );
    if (selectedCareerSettingId === settingId) setCareerSettingName(name);
    setError('');
  };

  const saveCareerSetting = () => {
    if (!selectedAccount || !dashboard) return false;
    const name = careerSettingName.trim();
    if (!name) {
      setError('养马详设名称不能为空，请返回详设界面修改');
      return false;
    }
    if (
      careerMode === 'online' &&
      (!careerPresetName ||
        !presets.some((preset) => preset.name === careerPresetName))
    ) {
      setError('这个养马详设绑定的预设不存在，请返回后重新创建详设');
      return false;
    }
    if (
      !effectiveCardId ||
      !effectiveDeckId ||
      !effectiveFriendCardId ||
      !effectiveParentId1 ||
      !effectiveParentId2
    ) {
      setError('请先完整选择育成马娘、卡组、好友支援和两位继承马娘');
      return false;
    }
    if (!continuingCurrentCareer && selectionConflict) {
      setError(selectionConflict);
      return false;
    }
    const existing = careerSettings.find(
      (setting) => setting.id === selectedCareerSettingId,
    );
    const boundPresetName =
      careerMode === 'offline' ? '' : existing?.preset_name || careerPresetName;
    const setting: CareerSetting = {
      id: existing?.id || `${selectedAccount.uid}-${Date.now()}`,
      name,
      account_uid: selectedAccount.uid,
      mode: careerMode,
      preset_name: boundPresetName,
      card_id: effectiveCardId,
      deck_id: effectiveDeckId,
      support_card_ids: [...effectiveSupportCardIds],
      friend_card_id: effectiveFriendCardId,
      parent_id_1: effectiveParentId1,
      parent_id_2: effectiveParentId2,
      parent_key_1: effectiveParentKey1,
      parent_key_2: effectiveParentKey2,
      scenario_id: scenarioId,
      offline_scenario_id:
        careerMode === 'offline' ? offlineScenarioId : undefined,
      max_steps: maxSteps,
      burn_clocks: burnClocks,
      recover_tp_with_item: recoverTpWithItem,
      recover_tp_with_jewels: recoverTpWithJewels,
      offline_training_challenge_mode:
        careerMode === 'offline' ? offlineChallengeMode : undefined,
      offline_race_deck_num:
        careerMode === 'offline' ? offlineRaceDeckNum : undefined,
      offline_race_deck_name:
        careerMode === 'offline' ? offlineRaceDeckName : undefined,
      offline_race_array:
        careerMode === 'offline'
          ? offlineRaceIds.map((id) => ({
              year: Math.floor(id / 100000),
              program_id: id % 100000,
            }))
          : undefined,
      offline_skill_settings:
        careerMode === 'offline'
          ? normalizeOfflineSkillSettings(offlineSkillSettings)
          : undefined,
      offline_factor_selection:
        careerMode === 'offline'
          ? normalizeOfflineFactorSelection(offlineFactorSelection)
          : undefined,
      updated_at: new Date().toISOString(),
    };
    const nextSettings = [
      setting,
      ...careerSettings.filter((item) => item.id !== setting.id),
    ];
    persistCareerSettings(nextSettings);
    setSelectedCareerSettingId(setting.id);
    setError('');
    return true;
  };

  const saveAndApplyCareerSetting = async () => {
    if (!saveCareerSetting()) return;
    const preset = presets.find((item) => item.name === careerPresetName);
    if (!preset) {
      setError('这个养马详设绑定的预设不存在');
      return;
    }
    const target =
      runMode === 'count'
        ? Math.max(1, runCountTarget)
        : runMode === 'jewel_drops'
          ? Math.max(1, jewelDropTarget)
          : 1;
    await updateRunnerConfiguration(preset, runMode, target, {
      max_steps: maxSteps,
      burn_clocks: burnClocks,
      recover_tp_with_item: recoverTpWithItem,
      recover_tp_with_jewels: recoverTpWithJewels,
    });
  };

  const offlineSelectionRequest = (scenarioOverride?: number) => ({
    card_id: effectiveCardId,
    support_card_ids: effectiveSupportCardIds,
    friend_viewer_id: 0,
    friend_card_id: effectiveFriendCardId,
    parent_id_1: effectiveParentId1,
    parent_id_2: effectiveParentId2,
    parent_1_viewer_id:
      selectedParent1?.viewer_id ||
      parentViewerIdFromSelection(effectiveParentKey1),
    parent_2_viewer_id:
      selectedParent2?.viewer_id ||
      parentViewerIdFromSelection(effectiveParentKey2),
    scenario_id:
      scenarioOverride ?? offlineSetup?.scenario_id ?? offlineScenarioId,
    deck_id: effectiveDeckId || 1,
    use_tp: 15,
    recover_tp_with_item: recoverTpWithItem,
    recover_tp_with_jewels: recoverTpWithJewels,
  });

  const selectOfflineRaceDeck = (
    setup: OfflineSingleModeSetup,
    requestedDeckNum?: number,
  ) => {
    const deck =
      setup.race_decks.find(
        (item) => item.deck_num === Number(requestedDeckNum || 0),
      ) ||
      setup.race_decks.find(
        (item) => item.deck_num === setup.default_deck_num,
      ) ||
      setup.race_decks[0];
    if (!deck) return;
    setOfflineRaceDeckNum(deck.deck_num);
    setOfflineRaceDeckName(deck.deck_name || `我的参赛计划${deck.deck_num}`);
    setOfflineRaceIds(
      deck.race_array.map((item) => item.year * 100000 + item.program_id),
    );
  };

  const prepareOfflineCareer = async () => {
    if (!selectedAccountId) return;
    const accountId = selectedAccountId;
    if (
      automationActive ||
      currentCareerActive ||
      currentIdleSingleMode?.active
    ) {
      setError('当前账号已有进行中的育成或后台任务，不能修改离线育成准备');
      return;
    }
    if (
      !effectiveCardId ||
      !effectiveDeckId ||
      !effectiveFriendCardId ||
      !effectiveParentId1 ||
      !effectiveParentId2
    ) {
      setError('请先完整选择育成马娘、卡组、好友支援和两位继承马娘');
      return;
    }
    if (selectionConflict) {
      setError(selectionConflict);
      return;
    }
    setBusy('idle-prepare');
    setError('');
    try {
      const result = (await window.electron.autoResearch.prepareIdleSingleMode(
        accountId,
        offlineSelectionRequest(offlineScenarioId),
      )) as LocalOfflineSetupResponse;
      if (!isOfflineSingleModeSetup(result?.offline_setup)) {
        throw new Error('游戏没有返回离线育成赛程信息');
      }
      if (selectedAccountIdRef.current !== accountId) return;
      const setup = result.offline_setup;
      setOfflineSetup(setup);
      setOfflineSetupAccountId(accountId);
      setOfflineChallengeMode((current) =>
        setup.training_challenge.available ? current : false,
      );
      selectOfflineRaceDeck(
        setup,
        offlineRaceDeckNum || selectedCareerSetting?.offline_race_deck_num,
      );
    } catch (caught) {
      if (selectedAccountIdRef.current === accountId) {
        setError((caught as Error).message);
      }
    } finally {
      if (selectedAccountIdRef.current === accountId) setBusy('');
    }
  };

  const saveOfflineRaceDeck = async () => {
    if (!selectedAccountId || !offlineSetup || !offlineRaceDeckNum) return;
    const accountId = selectedAccountId;
    if (offlineSetupAccountId !== accountId) {
      setError('当前账号的离线赛程尚未读取，请重新读取后再保存');
      return;
    }
    if (
      automationActive ||
      currentCareerActive ||
      currentIdleSingleMode?.active
    ) {
      setError('当前账号已有进行中的育成或后台任务，不能修改离线赛程');
      return;
    }
    setBusy('idle-race-deck');
    setError('');
    try {
      const result =
        (await window.electron.autoResearch.saveIdleSingleModeRaceDeck(
          accountId,
          {
            card_id: effectiveCardId,
            scenario_id: offlineSetup.scenario_id,
            deck_num: offlineRaceDeckNum,
            deck_name:
              offlineRaceDeckName.trim() || `我的参赛计划${offlineRaceDeckNum}`,
            race_array: offlineRaceIds.map((id) => ({
              year: Math.floor(id / 100000),
              program_id: id % 100000,
            })),
            is_default: offlineSetup.default_deck_num === offlineRaceDeckNum,
          },
        )) as LocalOfflineSetupResponse;
      if (!isOfflineSingleModeSetup(result?.offline_setup)) {
        throw new Error('游戏没有返回有效的离线育成赛程信息');
      }
      if (selectedAccountIdRef.current !== accountId) return;
      const setup = result.offline_setup;
      setOfflineSetup(setup);
      setOfflineSetupAccountId(accountId);
      selectOfflineRaceDeck(setup, offlineRaceDeckNum);
    } catch (caught) {
      if (selectedAccountIdRef.current === accountId) {
        setError((caught as Error).message);
      }
    } finally {
      if (selectedAccountIdRef.current === accountId) setBusy('');
    }
  };

  const startOfflineCareer = async (mode: RunMode, target: number) => {
    if (!selectedAccountId || !offlineSetup || !offlineRaceDeckNum) {
      setError('请先读取并选择一个游戏赛程槽位');
      return false;
    }
    const accountId = selectedAccountId;
    if (offlineSetupAccountId !== accountId) {
      setError('当前账号的离线赛程尚未读取，请重新读取后再开始');
      return false;
    }
    if (!(await ensureServerTaskSession(accountId))) return false;
    setBusy('idle-start');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/idle-single-mode/start',
        {
          method: 'POST',
          body: JSON.stringify({
            ...offlineSelectionRequest(),
            running_style: 0,
            training_challenge_mode: offlineChallengeMode,
            run_mode: mode,
            run_target: target,
            repeat_daily: repeatDaily,
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
            daily_tasks: readCareerDailyTasks(selectedAccount?.uid || ''),
            career_setting_id: selectedCareerSetting?.id || '',
            career_setting_name:
              selectedCareerSetting?.name || careerSettingName,
            offline_skill_settings:
              normalizeOfflineSkillSettings(offlineSkillSettings),
            factor_selection: normalizeOfflineFactorSelection(
              offlineFactorSelection,
            ),
            race_array: offlineRaceIds.map((id) => ({
              year: Math.floor(id / 100000),
              program_id: id % 100000,
            })),
          }),
        },
      );
      if (selectedAccountIdRef.current !== accountId) return false;
      commitOverviewResponse(accountId, result);
      setCareerSaveOpen(false);
      setOfflineSetup(null);
      setOfflineSetupAccountId('');
      return true;
    } catch (caught) {
      if (selectedAccountIdRef.current === accountId) {
        setError((caught as Error).message);
      }
      return false;
    } finally {
      if (selectedAccountIdRef.current === accountId) setBusy('');
    }
  };

  const saveAndRunCareer = () => {
    if (!saveCareerSetting()) return;
    setRepeatDaily(false);
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '05:00');
    setPendingRun({ type: 'current' });
    setRunMode((current) => (current === 'queue' ? 'single' : current));
    setRunDialogOpen(true);
  };

  const openSavedRunDialog = (settingId: string) => {
    setRepeatDaily(false);
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '05:00');
    setPendingRun({ type: 'saved', settingId });
    setRunMode((current) => (current === 'queue' ? 'single' : current));
    setRunDialogOpen(true);
    setError('');
  };

  const buildCareerQueuePayload = (
    queueItem: CareerRunQueueItem,
    resolved: CareerSetting,
  ) => {
    if (!dashboard) throw new Error('账号数据尚未加载完成');
    const parentOne = dashboard.parents.find(
      (parent) => parent.selection_id === resolved.parent_key_1,
    );
    const parentTwo = dashboard.parents.find(
      (parent) => parent.selection_id === resolved.parent_key_2,
    );
    const offline = resolved.mode === 'offline';
    const preset = offline
      ? undefined
      : presets.find((item) => item.name === resolved.preset_name);
    if (!offline && !preset) {
      throw new Error(
        `详设“${resolved.name}”绑定的预设不存在：${resolved.preset_name}`,
      );
    }
    if (offline && !resolved.offline_race_array?.length) {
      throw new Error(
        `离线详设“${resolved.name}”尚未保存赛程，请进入该详设读取游戏赛程后保存`,
      );
    }
    return {
      id: queueItem.id,
      career_setting_id: resolved.id,
      career_setting_name: resolved.name,
      career_mode: offline ? 'offline' : 'online',
      goal: queueItem.goal,
      target: queueItem.target,
      preset: preset || {},
      request: {
        card_id: resolved.card_id,
        support_card_ids: resolved.support_card_ids,
        friend_viewer_id: 0,
        friend_card_id: resolved.friend_card_id,
        parent_id_1: resolved.parent_id_1,
        parent_id_2: resolved.parent_id_2,
        parent_1_viewer_id: parentOne?.viewer_id || 0,
        parent_2_viewer_id: parentTwo?.viewer_id || 0,
        scenario_id: offline
          ? resolved.offline_scenario_id || 0
          : resolved.scenario_id || 1,
        deck_id: resolved.deck_id || 1,
        use_tp: offline ? 15 : 30,
        recover_tp_with_item: resolved.recover_tp_with_item,
        recover_tp_with_jewels: resolved.recover_tp_with_jewels,
        preset_name: resolved.preset_name,
        max_steps: resolved.max_steps,
        burn_clocks: resolved.burn_clocks,
        running_style: 0,
        training_challenge_mode: Boolean(
          resolved.offline_training_challenge_mode,
        ),
        offline_skill_settings: normalizeOfflineSkillSettings(
          resolved.offline_skill_settings,
        ),
        factor_selection: normalizeOfflineFactorSelection(
          resolved.offline_factor_selection,
        ),
        race_array: resolved.offline_race_array || [],
      },
    };
  };

  const appendRunningCareerPlan = async (
    settingId: string,
    goal: CareerRunQueueItem['goal'],
    target: number,
  ) => {
    if (!selectedAccountId) return false;
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) {
      setError('要追加的养马详设不存在');
      return false;
    }
    setBusy('queue-append');
    setError('');
    try {
      const payload = buildCareerQueuePayload(
        {
          id: `queue-${Date.now()}-append`,
          career_setting_id: setting.id,
          goal,
          target: Math.max(
            1,
            Math.min(goal === 'jewel_drops' ? 20 : 100, target),
          ),
        },
        setting,
      );
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/queue/append',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
      if (result.runner) {
        commitRunnerStream(
          selectedAccountId,
          result.runner,
          undefined,
          'server',
        );
      }
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const confirmRunPlan = async () => {
    if (!pendingRun) return;
    const target =
      runMode === 'count'
        ? Math.max(1, runCountTarget)
        : runMode === 'jewel_drops'
          ? Math.max(1, jewelDropTarget)
          : 1;
    let started = false;
    if (pendingRun.type === 'append') {
      started = await appendRunningCareerPlan(
        pendingRun.settingId,
        runMode as CareerRunQueueItem['goal'],
        ['count', 'jewel_drops'].includes(runMode) ? target : 1,
      );
    } else if (pendingRun.type === 'saved') {
      const setting = careerSettings.find(
        (item) => item.id === pendingRun.settingId,
      );
      if (!setting) {
        setError('所选养马详设不存在');
        return;
      }
      if (setting.mode === 'offline') {
        setError('请先进入离线详设读取游戏赛程，再选择运行计划');
        return;
      }
      started = await resumeCareerWithSetting(setting, runMode, target);
    } else if (careerMode === 'offline') {
      started = await startOfflineCareer(runMode, target);
    } else {
      started = await runCareer(runMode, target);
    }
    if (started) {
      setRunDialogOpen(false);
      setPendingRun(null);
      setCareerSaveOpen(false);
      navigateToTab('career', 'career-progress');
    }
  };

  const deleteCareerSetting = (settingId: string) => {
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) return;
    if (!window.confirm(`确定删除养马详设“${setting.name}”吗？`)) return;
    persistCareerSettings(
      careerSettings.filter((item) => item.id !== setting.id),
    );
    if (selectedCareerSettingId === setting.id) {
      setSelectedCareerSettingId('');
      setCareerSettingName('');
      setCareerPresetName('');
      setCareerSaveOpen(false);
    }
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-800 xl:px-6">
      <ErrorToast message={error} onClose={dismissError} />
      {loginSettingsOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="自动育成登录设置"
            className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <LogIn size={19} className="text-indigo-600" />
                  登录自动育成
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  选择本地已保存的游戏账号，并填写自动育成服务器地址。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLoginSettingsOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
            <div className="space-y-5 p-5">
              <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center gap-2">
                  <Plus size={17} className="text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    导入游戏账号
                  </h3>
                </div>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      导入 users.db
                    </p>
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={onDrop}
                      className={`mt-2 rounded-lg border-2 border-dashed p-3 text-center text-sm ${
                        dragging
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Database
                        className="mx-auto mb-1 text-slate-400"
                        size={22}
                      />
                      <p>拖入手机导出的 users.db</p>
                      <p className="mt-1 text-xs text-slate-400">
                        /data/user/0/com.bilibili.umamusu/databases/
                      </p>
                      <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <Upload className="mr-1" size={14} />
                        选择文件
                        <input
                          type="file"
                          accept=".db,application/x-sqlite3"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) importUsersDb(file);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                    <p className="text-sm font-semibold text-slate-700">
                      手动填写
                    </p>
                    <div className="mt-2 grid gap-2">
                      <input
                        value={manualUid}
                        onChange={(event) => setManualUid(event.target.value)}
                        placeholder="uid"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={manualAccessKey}
                        onChange={(event) =>
                          setManualAccessKey(event.target.value)
                        }
                        placeholder="access_key"
                        type="password"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addManual().catch(() => undefined)}
                        disabled={Boolean(busy)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        添加账号
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  也可在游戏重新登录后由 Localify
                  自动捕获账号；捕获成功后会立即出现在下方列表。
                </p>
                {captured.length ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    UmaShow 已捕获并保存 {captured.length} 个游戏登录凭据。
                  </p>
                ) : null}
              </section>
              <section>
                <label className="text-sm font-semibold text-slate-800">
                  游戏账号
                </label>
                <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(account.id);
                        localStorage.setItem(LAST_ACCOUNT_KEY, account.id);
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedAccountId === account.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {account.label || `UID ${account.uid}`}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {account.uid} · {account.accessKeyPreview}
                      </p>
                    </button>
                  ))}
                  {!accounts.length ? (
                    <p className="col-span-full rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                      请在上方导入游戏账号，或在游戏中重新登录后由 Localify
                      自动捕获。
                    </p>
                  ) : null}
                </div>
              </section>
              <label
                className="block text-sm font-semibold text-slate-800"
                htmlFor="auto-research-login-server"
              >
                自动育成服务器网址
                <input
                  id="auto-research-login-server"
                  value={serverAddress}
                  onChange={(event) => setServerAddress(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      connectFromLoginSettings().catch(() => undefined);
                    }
                  }}
                  placeholder={DEFAULT_SERVER}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setLoginSettingsOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() =>
                  connectFromLoginSettings().catch(() => undefined)
                }
                disabled={
                  Boolean(busy) || !accounts.length || !selectedAccountId
                }
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogIn size={16} />
                {busy === 'connect' ? '连接中…' : '连接并继续'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {editingSkillSelection ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${editingSkillSelection.label || editingSkillSelection.skill_names[0]}的学习设置`}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-slate-900">
                  {editingSkillSelection.label ||
                    editingSkillSelection.skill_names[0]}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingSkillSelection.skill_names.length > 1
                    ? `这组设置会应用到其中 ${editingSkillSelection.skill_names.length} 个技能。`
                    : '单独设置这个技能的学习条件。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSkillSelectionId('')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                完成
              </button>
            </div>
            {(() => {
              const { setting } = skillSelectionSetting(editingSkillSelection);
              return (
                <div className="max-h-[75vh] overflow-y-auto p-4">
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    <label className="flex items-center justify-between gap-4 px-3 py-3 text-sm text-slate-700">
                      <span>
                        <strong className="block font-medium text-slate-800">
                          最低学习 Hint 等级
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          当前 Hint 低于此等级时不会学习
                        </span>
                      </span>
                      <EditableNumberInput
                        min={0}
                        max={5}
                        step={1}
                        value={setting.min_hint_level}
                        onValueChange={(nextValue) =>
                          updateSkillLearningSetting(
                            editingSkillSelection.skill_names,
                            {
                              min_hint_level: Math.max(
                                0,
                                Math.min(5, Math.trunc(nextValue)),
                              ),
                            },
                          )
                        }
                        className="w-20 rounded-md border border-slate-200 px-3 py-2 text-center"
                      />
                    </label>
                    <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={setting.learn_when_affordable}
                        onChange={(event) =>
                          updateSkillLearningSetting(
                            editingSkillSelection.skill_names,
                            {
                              learn_when_affordable: event.target.checked,
                            },
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        <strong className="block font-medium text-slate-800">
                          PT 足够就学
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          不等待购买时间，也不受技能点购买阈值限制
                        </span>
                      </span>
                    </label>
                  </div>

                  <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          指定学习时间
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          未选择时使用预设中的统一购买技能时间
                        </p>
                      </div>
                      {setting.purchase_turns.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateSkillLearningSetting(
                              editingSkillSelection.skill_names,
                              { purchase_turns: [] },
                            )
                          }
                          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                        >
                          改用统一时间
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                      {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
                        <button
                          key={year.offset}
                          type="button"
                          onClick={() => setSkillSettingYearOffset(year.offset)}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            skillSettingYearOffset === year.offset
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {year.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {MONTH_OPTIONS.map((month) => (
                        <div
                          key={month}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                        >
                          <p className="mb-1 text-center text-[11px] font-medium text-slate-500">
                            {month}月
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {([1, 2] as const).map((half) => {
                              const turn = skillPurchaseTurn(
                                skillSettingYearOffset,
                                month,
                                half,
                              );
                              const selected =
                                setting.purchase_turns.includes(turn);
                              return (
                                <button
                                  key={half}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() =>
                                    updateSkillLearningSetting(
                                      editingSkillSelection.skill_names,
                                      {
                                        purchase_turns: selected
                                          ? setting.purchase_turns.filter(
                                              (value) => value !== turn,
                                            )
                                          : [
                                              ...setting.purchase_turns,
                                              turn,
                                            ].sort(
                                              (left, right) => left - right,
                                            ),
                                      },
                                    )
                                  }
                                  className={`rounded px-1 py-1 text-[11px] font-medium ${
                                    selected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                                  }`}
                                >
                                  {half === 1 ? '上' : '下'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                      {setting.purchase_turns.map((turn) => (
                        <button
                          key={turn}
                          type="button"
                          onClick={() =>
                            updateSkillLearningSetting(
                              editingSkillSelection.skill_names,
                              {
                                purchase_turns: setting.purchase_turns.filter(
                                  (value) => value !== turn,
                                ),
                              },
                            )
                          }
                          title="点击移除"
                          className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          {skillPurchaseTurnLabel(turn)} ×
                        </button>
                      ))}
                      {!setting.purchase_turns.length ? (
                        <span className="py-1 text-xs text-slate-400">
                          当前使用统一购买技能时间
                        </span>
                      ) : null}
                    </div>
                  </section>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
      {appendPlanPickerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="选择后续养马详设"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                选择后续养马详设
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                选择完整保存的详设，然后使用与正常启动相同的运行方式页面确认目标。
              </p>
            </div>
            <div className="overflow-y-auto p-4">
              {appendBlockedByContinuous ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  当前计划没有自然结束点。请先在运行计划中改为“单次”或“完成 X
                  次”并应用，再添加后续计划。
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {accountCareerSettings.map((setting) => {
                  const offline = setting.mode === 'offline';
                  const uma = dashboard?.umas.find(
                    (item) => item.id === setting.card_id,
                  );
                  const invalid = offline
                    ? !setting.offline_race_array?.length
                    : !presets.some(
                        (preset) => preset.name === setting.preset_name,
                      );
                  return (
                    <article
                      key={setting.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-slate-900">
                            {setting.name}
                          </strong>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            {uma?.name || `马娘 ${setting.card_id}`} ·{' '}
                            {offline
                              ? `离线赛程 ${setting.offline_race_array?.length || 0} 场`
                              : setting.preset_name}
                          </span>
                        </div>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            offline
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}
                        >
                          {offline ? '离线详设' : '在线详设'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <span>卡组：{setting.deck_id || '-'}</span>
                        <span>支援：{setting.support_card_ids.length}/5</span>
                        <span>继承 1：{setting.parent_id_1 || '-'}</span>
                        <span>继承 2：{setting.parent_id_2 || '-'}</span>
                      </div>
                      {invalid ? (
                        <p className="mt-3 text-xs text-red-600">
                          {offline
                            ? '该离线详设尚未保存赛程'
                            : '绑定的预设不存在'}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={invalid || appendBlockedByContinuous}
                        onClick={() => {
                          setAppendPlanPickerOpen(false);
                          setPendingRun({
                            type: 'append',
                            settingId: setting.id,
                          });
                          setRunMode('single');
                          setRunCountTarget(1);
                          setJewelDropTarget(20);
                          setRunDialogOpen(true);
                        }}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Play size={15} />
                        选择并设置运行方式
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setAppendPlanPickerOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {runDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="选择自动育成运行方式"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {appendingCareerPlan ? '添加后续计划' : '选择运行方式'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {appendingCareerPlan
                  ? `后续详设：${pendingRunSetting?.name || '未知详设'}。当前计划完成后才会开始执行。`
                  : '先选择基础结束条件，再单独决定整个计划是否作为每日任务重复。'}
              </p>
            </div>
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(appendingCareerPlan
                  ? [
                      {
                        id: 'single' as const,
                        title: '单次',
                        detail: '使用所选详设完成一次育成，然后进入下一项。',
                        icon: Play,
                      },
                      {
                        id: 'continuous' as const,
                        title: '持续',
                        detail: '持续执行所选详设；作为队列最后一项运行。',
                        icon: RefreshCw,
                      },
                      {
                        id: 'count' as const,
                        title: '完成 X 次',
                        detail: '使用所选详设连续完成指定次数。',
                        icon: ListChecks,
                      },
                      {
                        id: 'jewel_drops' as const,
                        title: '获得 X 次',
                        detail: '获得指定次数的钻石掉落后进入下一项。',
                        icon: Gem,
                      },
                    ]
                  : [
                      {
                        id: 'single' as const,
                        title: '单次',
                        detail: '完成当前这一次育成后停止。',
                        icon: Play,
                      },
                      {
                        id: 'continuous' as const,
                        title: '持续',
                        detail:
                          '每次育成结束后自动开始下一次，直到手动停止或无法继续。',
                        icon: RefreshCw,
                      },
                      {
                        id: 'count' as const,
                        title: '完成 X 次',
                        detail: '从现在开始完成指定次数的育成后停止。',
                        icon: ListChecks,
                      },
                      {
                        id: 'jewel_drops' as const,
                        title: '获得 X 次',
                        detail: `从现在起累计指定次数的宝石掉落；本周期还可掉落 ${remainingJewelDrops} 次。`,
                        icon: Gem,
                      },
                    ]
                ).map((option) => {
                  const IconComponent = option.icon;
                  const disabled =
                    option.id === 'jewel_drops' &&
                    !repeatDaily &&
                    remainingJewelDrops <= 0;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setRunMode(option.id);
                        if (option.id === 'jewel_drops') {
                          setJewelDropTarget(
                            repeatDaily
                              ? 20
                              : Math.max(1, Math.min(20, remainingJewelDrops)),
                          );
                        }
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        runMode === option.id
                          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                      }`}
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <IconComponent size={18} />
                      </span>
                      <span>
                        <strong className="block text-sm font-semibold text-slate-800">
                          {option.title}
                        </strong>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {option.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {appendingCareerPlan ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  此项继承整个运行计划的设置：
                  <strong className="ml-1 text-slate-800">
                    {repeatDaily ? '每天重复' : '仅运行一次计划'}
                  </strong>
                </div>
              ) : (
                <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={repeatDaily}
                      onChange={(event) => {
                        setRepeatDaily(event.target.checked);
                        if (event.target.checked && runMode === 'jewel_drops') {
                          setJewelDropTarget(20);
                        }
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-indigo-300 text-indigo-600"
                    />
                    <span>
                      <strong className="block text-sm text-indigo-950">
                        作为每日任务重复
                      </strong>
                      <span className="mt-0.5 block text-xs leading-5 text-indigo-700">
                        开启后，整个计划以及队列中的所有详设共同按天重复，不为单个队列项分别设置“每日”。
                      </span>
                    </span>
                  </label>
                  {repeatDaily ? (
                    <div className="mt-3 grid gap-3 border-t border-indigo-100 pt-3 sm:grid-cols-2">
                      <label className="text-sm text-indigo-950">
                        每日启动时间
                        <input
                          type="time"
                          value={scheduleStartTime}
                          onChange={(event) =>
                            setScheduleStartTime(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 font-semibold"
                        />
                      </label>
                      <label className="text-sm text-indigo-950">
                        每日结束时间
                        <input
                          type="time"
                          value={scheduleEndTime}
                          onChange={(event) =>
                            setScheduleEndTime(event.target.value)
                          }
                          className="mt-1.5 w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 font-semibold"
                        />
                      </label>
                      <p className="text-xs leading-5 text-indigo-700 sm:col-span-2">
                        使用北京时间，支持跨午夜；两者同为 05:00 表示完整的
                        05:00 至次日 04:59 周期。
                      </p>
                    </div>
                  ) : null}
                </section>
              )}

              {runMode === 'count' ? (
                <label className="mt-4 block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  {repeatDaily ? '每天完成' : '从现在起完成'}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={runCountTarget}
                      onChange={(event) =>
                        setRunCountTarget(
                          Math.max(
                            1,
                            Math.min(100, Number(event.target.value)),
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold"
                    />
                    <span className="text-slate-500">次育成</span>
                  </div>
                  {repeatDaily && !appendingCareerPlan ? (
                    <span className="mt-2 block text-xs text-slate-500">
                      每个每日周期都会使用当前详设完成这些次数；达到后等待下一个周期。
                    </span>
                  ) : null}
                </label>
              ) : null}

              {runMode === 'jewel_drops' ? (
                <label className="mt-4 block rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
                  {repeatDaily ? '每天累计达到' : '从现在起获得'}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={repeatDaily ? 20 : Math.max(1, remainingJewelDrops)}
                      value={jewelDropTarget}
                      onChange={(event) =>
                        setJewelDropTarget(
                          Math.max(
                            1,
                            Math.min(
                              repeatDaily
                                ? 20
                                : Math.max(1, remainingJewelDrops),
                              Number(event.target.value),
                            ),
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                    />
                    <span className="text-violet-700">次宝石掉落</span>
                  </div>
                  <span className="mt-2 block text-xs text-violet-600">
                    {repeatDaily
                      ? '今天已经获得的钻石会计入目标；若启动时已经达到，会直接完成今天的计划。'
                      : '达到目标后会在当前比赛结束处停止，未完成的育成之后可以继续。'}
                  </span>
                </label>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setRunDialogOpen(false);
                  setPendingRun(null);
                }}
                disabled={Boolean(busy)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmRunPlan}
                disabled={
                  Boolean(busy) ||
                  (runMode === 'jewel_drops' &&
                    !repeatDaily &&
                    remainingJewelDrops <= 0)
                }
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Play size={16} />
                {busy
                  ? appendingCareerPlan
                    ? '正在添加…'
                    : '正在启动…'
                  : appendingCareerPlan
                    ? '添加到后续计划'
                    : '开始运行'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SkillSelector
        open={skillPickerOpen}
        title="选择育成中学习的技能"
        description="只会学习这里选择的技能；新技能添加到队列末尾，可拖动调整购买顺序。"
        skills={skills}
        selectedNames={skillPriorityNames}
        blockedNames={[]}
        onToggle={togglePrioritySkill}
        onAddGroup={addSkillGroup}
        onClose={() => setSkillPickerOpen(false)}
      />
      <div className="mx-auto max-w-none space-y-4">
        <header className="flex min-h-[60px] flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <Activity size={24} />
              <h1 className="text-xl font-semibold text-gray-800">自动育成</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {server
                ? `${server} · 游戏版本 ${health?.app_ver} · 当前服务器允许运行上限 ${health?.max_accounts}`
                : activeTab === 'daily'
                  ? 'UmaShow 本地每日日常'
                  : '本地预设编辑'}
            </p>
            {selectedAccount ? (
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  serverHostedMode
                    ? 'bg-violet-100 text-violet-700'
                    : localSessionMode || localAccountSessionState === 'ready'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {serverHostedMode
                  ? '服务器托管模式 · 本地游戏 API 已禁用'
                  : localSessionMode || localAccountSessionState === 'ready'
                    ? '本地模式 · 可登录、刷新和配置'
                    : '未登录游戏 · 等待本地登录'}
              </span>
            ) : null}
          </div>
          {selectedAccount ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!serverHostedMode && selectedAccountId) {
                    loginLocalAccount(selectedAccountId).catch(() => undefined);
                    return;
                  }
                  refreshCurrentAccount();
                }}
                disabled={
                  !selectedAccountId ||
                  Boolean(disconnectingAccountId) ||
                  Boolean(checkingExistingRuntimeAccountId) ||
                  busy === `refresh-${selectedAccountId}` ||
                  busy === `login-${selectedAccountId}`
                }
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`mr-1 inline ${busy === `refresh-${selectedAccountId}` ? 'animate-spin' : ''}`}
                  size={15}
                />
                {busy === `refresh-${selectedAccountId}`
                  ? serverHostedMode
                    ? '正在读取服务器…'
                    : '重新登录中…'
                  : busy === `login-${selectedAccountId}`
                    ? '登录中…'
                    : serverHostedMode
                      ? '刷新服务器状态'
                      : localAccountSessionState === 'ready'
                        ? '重新登录'
                        : '登录本地模式'}
              </button>
              {serverHostedMode ? (
                <button
                  type="button"
                  onClick={() => exitAutoResearchLogin().catch(() => undefined)}
                  disabled={Boolean(loginProgress || disconnectingAccountId)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <LogOut className="mr-1 inline" size={15} />
                  退出登录
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLoginSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <LogIn size={16} />
              登录
            </button>
          )}
        </header>

        <div className={`${panelClass('px-3')} sticky top-0 z-30 shadow-sm`}>
          <nav
            className="-mb-px flex space-x-8 overflow-x-auto"
            aria-label="自动育成设置"
          >
            {[
              { id: 'daily' as const, label: '每日日常', icon: CalendarCheck },
              { id: 'presets' as const, label: '预设', icon: Settings2 },
              { id: 'career' as const, label: '详设', icon: ListChecks },
              { id: 'history' as const, label: '养马记录', icon: History },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateToTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <IconComponent size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {disconnectingAccountId ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex items-center gap-2 font-semibold">
              <RefreshCw className="animate-spin" size={15} />
              正在退出账号
            </div>
            <p className="mt-1 text-xs text-slate-500">
              正在断开当前前端会话，账号在后端的登录与养马状态会继续保留。
            </p>
          </div>
        ) : null}

        <div
          className={`grid gap-4 ${
            activeTab === 'accounts'
              ? 'xl:grid-cols-[390px_minmax(0,1fr)]'
              : 'grid-cols-1'
          }`}
        >
          <aside className={activeTab === 'accounts' ? 'space-y-4' : 'hidden'}>
            <section className={panelClass('p-4')}>
              <h2 className="flex items-center gap-2 font-bold">
                <Plus size={18} />
                添加账号
              </h2>
              {captured.length ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  UmaShow 已捕获并持久化 {captured.length} 个登录凭据。
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-700">
                  方法一：导入 users.db
                </p>
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-2 rounded-xl border-2 border-dashed p-4 text-center text-sm ${
                    dragging
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200'
                  }`}
                >
                  <Database className="mx-auto mb-2 text-slate-400" size={24} />
                  <p>拖入手机导出的 users.db</p>
                  <p className="mt-1 text-xs text-slate-400">
                    /data/user/0/com.bilibili.umamusu/databases/
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50">
                    <Upload className="mr-1" size={14} />
                    选择文件
                    <input
                      type="file"
                      accept=".db,application/x-sqlite3"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) importUsersDb(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700">
                  方法二：手动填写
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  直接填写账号的 UID 和 access_key。
                </p>
                <div className="mt-2 grid gap-2">
                  <input
                    value={manualUid}
                    onChange={(event) => setManualUid(event.target.value)}
                    placeholder="uid"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={manualAccessKey}
                    onChange={(event) => setManualAccessKey(event.target.value)}
                    placeholder="access_key"
                    type="password"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addManual}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    手动添加
                  </button>
                </div>
              </div>
            </section>

            <section className={panelClass('p-4')}>
              <h2 className="flex items-center gap-2 font-bold">
                <Users size={18} />
                账号列表
              </h2>
              <div className="mt-3 space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedAccountId === account.id
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      disabled={Boolean(
                        loginProgress || disconnectingAccountId,
                      )}
                      className="flex w-full items-start justify-between gap-2 text-left disabled:cursor-wait"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {account.label || `UID ${account.uid}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {account.uid} · {account.accessKeyPreview}
                        </p>
                        {account.runtime.last_refreshed_at ? (
                          <p className="mt-0.5 text-xs text-slate-400">
                            上次完整刷新：
                            {new Date(
                              account.runtime.last_refreshed_at,
                            ).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${disconnectingAccountId === account.id ? 'bg-amber-100 text-amber-700' : runtimeSessionOwner(account.runtime) === 'server' ? 'bg-violet-100 text-violet-700' : runtimeSessionOwner(account.runtime) === 'local' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {disconnectingAccountId === account.id
                          ? '退出中'
                          : loginProgress?.accountId === account.id
                            ? loginProgress.action === 'refresh'
                              ? '刷新中'
                              : '登录中'
                            : runtimeSessionOwner(account.runtime) === 'server'
                              ? '服务器托管'
                              : runtimeSessionOwner(account.runtime) === 'local'
                                ? '本地模式'
                                : '未登录'}
                      </span>
                    </button>
                    <div className="mt-3 flex gap-1">
                      {account.runtime.logged_in ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                runtimeSessionOwner(account.runtime) ===
                                'server'
                              ) {
                                accountAction(account.id, 'refresh').catch(
                                  () => undefined,
                                );
                                return;
                              }
                              loginLocalAccount(account.id).catch(
                                () => undefined,
                              );
                            }}
                            disabled={
                              Boolean(loginProgress) ||
                              Boolean(disconnectingAccountId) ||
                              busy === `refresh-${account.id}`
                            }
                            className="rounded-lg bg-white px-2 py-1 text-xs disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`mr-1 inline ${busy === `refresh-${account.id}` ? 'animate-spin' : ''}`}
                              size={12}
                            />
                            {busy === `refresh-${account.id}`
                              ? runtimeSessionOwner(account.runtime) ===
                                'server'
                                ? '读取中'
                                : '重新登录中'
                              : runtimeSessionOwner(account.runtime) ===
                                  'server'
                                ? '刷新服务器'
                                : '重新登录'}
                          </button>
                          <button
                            type="button"
                            onClick={() => resetAccount(account.id)}
                            disabled={Boolean(
                              busy || loginProgress || disconnectingAccountId,
                            )}
                            className="rounded-lg bg-white px-2 py-1 text-xs text-amber-700 disabled:opacity-50"
                          >
                            {busy === `reset-${account.id}` ? (
                              <RefreshCw
                                className="mr-1 inline animate-spin"
                                size={12}
                              />
                            ) : (
                              <RotateCcw className="mr-1 inline" size={12} />
                            )}
                            {busy === `reset-${account.id}`
                              ? '重置中'
                              : '强制重置'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                runtimeSessionOwner(account.runtime) ===
                                'server'
                              ) {
                                accountAction(account.id, 'logout').catch(
                                  () => undefined,
                                );
                                return;
                              }
                              logoutLocalAccount(account.id).catch(
                                () => undefined,
                              );
                            }}
                            disabled={Boolean(
                              busy || loginProgress || disconnectingAccountId,
                            )}
                            className="rounded-lg bg-white px-2 py-1 text-xs disabled:opacity-50"
                          >
                            <LogOut className="mr-1 inline" size={12} />
                            {disconnectingAccountId === account.id
                              ? '退出中'
                              : '退出'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            loginLocalAccount(account.id).catch(() => undefined)
                          }
                          disabled={Boolean(
                            loginProgress || disconnectingAccountId,
                          )}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <LogIn className="mr-1 inline" size={12} />
                          {loginProgress?.accountId === account.id
                            ? `登录中 ${loginProgress.elapsed}s`
                            : loginProgress
                              ? '等待登录'
                              : '登录并读取'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteAccount(account.id)}
                        disabled={Boolean(
                          loginProgress || disconnectingAccountId,
                        )}
                        className="ml-auto rounded-lg bg-white px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="inline" size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {!accounts.length ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    还没有账号
                  </p>
                ) : null}
              </div>
            </section>
          </aside>

          <main className="space-y-4 min-w-0">
            {activeTab !== 'presets' && !selectedAccount ? (
              <section
                className={panelClass('p-12 text-center text-slate-400')}
              >
                <p>请先选择要使用的账号。</p>
              </section>
            ) : activeTab !== 'presets' &&
              disconnectingAccountId === selectedAccount?.id ? (
              <section
                className={panelClass(
                  'flex min-h-[calc(100vh-170px)] items-center justify-center p-8 text-center',
                )}
              >
                <div>
                  <RefreshCw
                    className="mx-auto animate-spin text-slate-400"
                    size={42}
                  />
                  <p className="mt-4 font-semibold text-slate-700">
                    正在退出账号
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    仅断开当前前端连接，后端登录和养马状态不会被清除。
                  </p>
                </div>
              </section>
            ) : activeTab !== 'presets' &&
              loginProgress?.accountId === selectedAccount?.id ? (
              <section
                className={panelClass(
                  'flex min-h-[calc(100vh-170px)] items-center justify-center p-8 text-center',
                )}
              >
                <div>
                  {loginProgressComplete ? (
                    <Check className="mx-auto text-emerald-500" size={42} />
                  ) : (
                    <RefreshCw
                      className="mx-auto animate-spin text-cyan-500"
                      size={42}
                    />
                  )}
                  <p className="mt-4 font-semibold text-slate-700">
                    {loginProgressComplete
                      ? '登录完成，正在载入账号界面'
                      : loginProgress?.action === 'refresh'
                        ? '正在重新登录账号'
                        : '正在登录账号'}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {loginProgress?.detail}
                  </p>
                </div>
              </section>
            ) : activeTab !== 'presets' &&
              !automationActive &&
              (!dashboard ||
                (!serverHostedMode && localAccountSessionState !== 'ready')) ? (
              <section className={panelClass('p-12 text-center')}>
                {activeTab !== 'daily' &&
                checkingExistingRuntimeAccountId === selectedAccount?.id ? (
                  <RefreshCw
                    className="mx-auto animate-spin text-indigo-400"
                    size={42}
                  />
                ) : (
                  <LogIn className="mx-auto text-slate-300" size={42} />
                )}
                <h2 className="mt-3 font-bold text-slate-800">
                  {checkingExistingRuntimeAccountId === selectedAccount?.id
                    ? '正在连接服务器上的托管任务'
                    : '登录并读取本账号的最新育成数据'}
                </h2>
                {missingExistingRuntimeAccountId === selectedAccount?.id ? (
                  <div className="mx-auto mt-4 flex max-w-2xl items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
                    <AlertTriangle size={18} className="mt-0.5 flex-none" />
                    <span>
                      登录会接管该账号的游戏会话，可能使正在游戏客户端或其他工具中运行的同账号立即掉线。请确认其他地方已停止操作后再继续。
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      selectedAccount && loginLocalAccount(selectedAccount.id)
                    }
                    disabled={Boolean(
                      loginProgress ||
                        disconnectingAccountId ||
                        checkingExistingRuntimeAccountId ===
                          selectedAccount?.id,
                    )}
                    className="rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    {loginProgress?.accountId === selectedAccount?.id
                      ? `登录中 ${loginProgress?.elapsed || 0}s · ${loginProgress?.detail || '正在连接登录服务'}`
                      : loginProgress
                        ? '请等待其他账号登录完成'
                        : checkingExistingRuntimeAccountId ===
                            selectedAccount?.id
                          ? '正在连接账号'
                          : disconnectingAccountId
                            ? '请等待账号退出完成'
                            : '登录并读取最新数据'}
                  </button>
                  {activeTab !== 'daily' ? (
                    <button
                      type="button"
                      onClick={() => navigateToTab('presets', 'preset-basic')}
                      className="rounded-md border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      先配置预设
                    </button>
                  ) : null}
                </div>
              </section>
            ) : (
              <>
                {dashboard?.account && activeTab === 'accounts' ? (
                  <>
                    <section
                      className={`${panelClass('p-4')} grid gap-3 sm:grid-cols-2 lg:grid-cols-8`}
                    >
                      {[
                        [
                          'TP',
                          `${dashboard.account.tp.current}/${dashboard.account.tp.max}`,
                        ],
                        ['萝卜', dashboard.account.carrots.total],
                        ['金币', dashboard.account.gold],
                        ['闹钟', dashboard.account.clocks],
                        ['能量饮料30', dashboard.account.energy_drinks || 0],
                        [
                          '好友借马',
                          dashboard.account.rental_succession?.known
                            ? `${dashboard.account.rental_succession.remaining} 次剩余（${dashboard.account.rental_succession.used}/${dashboard.account.rental_succession.max}）`
                            : '未读取',
                        ],
                        [
                          '育成',
                          dashboard.account.career?.active
                            ? `${dashboard.account.career.name} T${dashboard.account.career.turn}`
                            : '无',
                        ],
                        [
                          '离线自动育成',
                          currentIdleSingleMode?.active
                            ? `${currentIdleSingleMode.name || '未知马娘'} · ${
                                currentIdleSingleMode.state === 'playing'
                                  ? '进行中'
                                  : currentIdleSingleMode.state === 'finished'
                                    ? '待查看结果'
                                    : '待游戏清理'
                              }`
                            : '无',
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className="mt-1 truncate font-bold">{value}</p>
                        </div>
                      ))}
                    </section>
                    <section
                      className={`${panelClass('p-4')} flex flex-wrap items-center justify-between gap-3`}
                    >
                      <div>
                        <h2 className="font-bold">账号已经准备好</h2>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigateToTab('presets')}
                          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          选择预设
                        </button>
                        {!automationActive ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigateToTab('career', 'career-task')
                            }
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                          >
                            前往养马详设
                          </button>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : null}

                {activeTab === 'career' &&
                currentIdleSingleMode?.active &&
                !offlineControlActive ? (
                  <section className="rounded-lg border border-sky-300 bg-sky-50 p-5 text-sky-900">
                    <h2 className="font-bold">检测到离线自动育成</h2>
                    <p className="mt-1 text-sm">
                      当前离线育成角色为「
                      {currentIdleSingleMode.name || '未知马娘'}
                      」。
                      {currentIdleSingleMode.state === 'playing'
                        ? '任务正在游戏服务器上自动进行，普通自动育成已暂停。'
                        : currentIdleSingleMode.state === 'finished'
                          ? '任务已完成，需在游戏内查看结果后才能继续普通育成。'
                          : '结果已查看，等待游戏完成离线任务清理。'}
                    </p>
                    {currentIdleSingleMode.ends_at ? (
                      <p className="mt-2 text-xs text-sky-700">
                        预计结束：{currentIdleSingleMode.ends_at}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={refreshIdleSingleMode}
                        disabled={busy === 'idle-single-mode-refresh'}
                        className="flex items-center gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                      >
                        <RefreshCw size={16} />
                        {busy === 'idle-single-mode-refresh'
                          ? '正在刷新…'
                          : '刷新状态'}
                      </button>
                      <button
                        type="button"
                        onClick={abandonIdleSingleMode}
                        disabled={busy === 'idle-single-mode-abandon'}
                        className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        {busy === 'idle-single-mode-abandon'
                          ? '正在放弃…'
                          : '放弃离线育成'}
                      </button>
                    </div>
                  </section>
                ) : null}

                {activeTab === 'presets' ? (
                  <PresetsTab
                    presetEditorOpen={presetEditorOpen}
                    presets={presets}
                    presetName={presetName}
                    newPresetName={newPresetName}
                    setNewPresetName={setNewPresetName}
                    createPresetSlot={createPresetSlot}
                    openPresetEditor={openPresetEditor}
                    renamePreset={renamePreset}
                    careerSettings={careerSettings}
                    exportPreset={exportPreset}
                    deletePreset={deletePreset}
                    importPreset={importPreset}
                    setPresetEditorOpen={setPresetEditorOpen}
                    navigateToTab={navigateToTab}
                    savePreset={savePreset}
                    busy={busy}
                    presetSaved={presetSaved}
                    savePresetAndContinue={savePresetAndContinue}
                    runningStyle={runningStyle}
                    setRunningStyle={setRunningStyle}
                    skillSelections={skillSelections}
                    draggedPrioritySkill={draggedPrioritySkill}
                    setDraggedPrioritySkill={setDraggedPrioritySkill}
                    reorderPrioritySkill={reorderPrioritySkill}
                    setEditingSkillSelectionId={setEditingSkillSelectionId}
                    setSkillSettingYearOffset={setSkillSettingYearOffset}
                    setSkillPickerOpen={setSkillPickerOpen}
                    skillByName={skillByName}
                    skillLearningConditionLabel={skillLearningConditionLabel}
                    setSkillSelections={setSkillSelections}
                    skillThreshold={skillThreshold}
                    setSkillThreshold={setSkillThreshold}
                    skipDoubleCircle={skipDoubleCircle}
                    setSkipDoubleCircle={setSkipDoubleCircle}
                    maximizeSkillScoreAtEnd={maximizeSkillScoreAtEnd}
                    setMaximizeSkillScoreAtEnd={setMaximizeSkillScoreAtEnd}
                    skillPurchaseYearOffset={skillPurchaseYearOffset}
                    setSkillPurchaseYearOffset={setSkillPurchaseYearOffset}
                    skillPurchaseTurns={skillPurchaseTurns}
                    setSkillPurchaseTurns={setSkillPurchaseTurns}
                    editingSkillSelectionId={editingSkillSelectionId}
                    setSkillLearningSettings={setSkillLearningSettings}
                    health={health}
                    uraAiTargetAttributes={uraAiTargetAttributes}
                    setUraAiTargetAttributes={setUraAiTargetAttributes}
                    uraAiTargetAttributeStages={uraAiTargetAttributeStages}
                    setUraAiTargetAttributeStages={
                      setUraAiTargetAttributeStages
                    }
                    targetAttributeStageYearOffset={
                      targetAttributeStageYearOffset
                    }
                    setTargetAttributeStageYearOffset={
                      setTargetAttributeStageYearOffset
                    }
                    uraAiTimeBudget={uraAiTimeBudget}
                    setUraAiTimeBudget={setUraAiTimeBudget}
                    uraAiMinRollouts={uraAiMinRollouts}
                    setUraAiMinRollouts={setUraAiMinRollouts}
                    uraAiMaxRollouts={uraAiMaxRollouts}
                    setUraAiMaxRollouts={setUraAiMaxRollouts}
                    uraAiWorkers={uraAiWorkers}
                    setUraAiWorkers={setUraAiWorkers}
                    uraAiRiskFactor={uraAiRiskFactor}
                    setUraAiRiskFactor={setUraAiRiskFactor}
                    races={races}
                    selectedRaceIds={selectedRaceIds}
                    setSelectedRaceIds={setSelectedRaceIds}
                  />
                ) : null}

                {dashboard?.account &&
                activeTab === 'career' &&
                (!automationActive || careerSaveOpen) ? (
                  <CareerTab
                    dashboard={dashboard}
                    careerSaveOpen={careerSaveOpen}
                    accountCareerSettings={accountCareerSettings}
                    matchingCareerSettings={matchingCareerSettings}
                    applyCareerSetting={applyCareerSetting}
                    editPresetForCareerSetting={editPresetForCareerSetting}
                    continueWithSetting={openSavedRunDialog}
                    deleteCareerSetting={deleteCareerSetting}
                    newCareerSaveName={newCareerSaveName}
                    setNewCareerSaveName={setNewCareerSaveName}
                    createCareerSave={createCareerSave}
                    careerSettingName={careerSettingName}
                    automationActive={automationActive}
                    busy={busy}
                    activeCareer={activeCareer}
                    activeCareerIconPath={activeCareerIconPath}
                    abandonCareer={abandonCareer}
                    continuingCurrentCareer={continuingCurrentCareer}
                    canContinueCurrentCareer={canContinueCurrentCareer}
                    saveCareerSetting={saveCareerSetting}
                    saveAndApplyCareerSetting={saveAndApplyCareerSetting}
                    saveAndRunCareer={saveAndRunCareer}
                    careerPresetName={careerPresetName}
                    newCareerPresetName={newCareerPresetName}
                    setNewCareerPresetName={setNewCareerPresetName}
                    newCareerMode={newCareerMode}
                    setNewCareerMode={setNewCareerMode}
                    editCareerPreset={editCareerPreset}
                    closeCareerEditor={closeCareerEditor}
                    presets={presets}
                    selectedUma={selectedUma}
                    cardId={cardId}
                    setCardId={setCardId}
                    filteredUmas={filteredUmas}
                    umaSearch={umaSearch}
                    setUmaSearch={setUmaSearch}
                    selectedParent1={selectedParent1}
                    selectedParent2={selectedParent2}
                    parent1={parent1}
                    parent2={parent2}
                    setParent1={setParent1}
                    setParent2={setParent2}
                    filteredParents={filteredParents}
                    parentSearch={parentSearch}
                    setParentSearch={setParentSearch}
                    parentSelectionSlot={parentSelectionSlot}
                    setParentSelectionSlot={setParentSelectionSlot}
                    deckId={deckId}
                    setDeckId={setDeckId}
                    setSupportCardIds={setSupportCardIds}
                    selectedDeckCharaIds={selectedDeckCharaIds}
                    supportSearch={supportSearch}
                    setSupportSearch={setSupportSearch}
                    friendCardId={friendCardId}
                    setFriendCardId={setFriendCardId}
                    selectedFriendSupport={selectedFriendSupport}
                    visibleFriendSupports={visibleFriendSupports}
                    availableFriendSupportIds={availableFriendSupportIds}
                    maxSteps={maxSteps}
                    setMaxSteps={setMaxSteps}
                    burnClocks={burnClocks}
                    setBurnClocks={setBurnClocks}
                    recoverTpWithItem={recoverTpWithItem}
                    setRecoverTpWithItem={setRecoverTpWithItem}
                    recoverTpWithJewels={recoverTpWithJewels}
                    setRecoverTpWithJewels={setRecoverTpWithJewels}
                    selectionConflict={selectionConflict}
                    refreshOptionsIndex={refreshOptionsIndex}
                    renameCareerSetting={renameCareerSetting}
                    selectedAccountId={selectedAccountId}
                    careerMode={careerMode}
                    offlineSetup={offlineSetup}
                    offlineScenarios={
                      dashboard.offline_scenarios?.length
                        ? dashboard.offline_scenarios
                        : offlineSetup?.scenarios || []
                    }
                    offlineScenarioId={offlineScenarioId}
                    changeOfflineScenario={(selectedScenarioId) => {
                      setOfflineScenarioId(selectedScenarioId);
                      setOfflineSetup(null);
                      setOfflineSetupAccountId('');
                      setOfflineChallengeMode(false);
                      setOfflineRaceDeckNum(0);
                      setOfflineRaceDeckName('');
                      setOfflineRaceIds([]);
                    }}
                    offlineChallengeMode={offlineChallengeMode}
                    setOfflineChallengeMode={setOfflineChallengeMode}
                    offlineRaceDeckNum={offlineRaceDeckNum}
                    setOfflineRaceDeckNum={setOfflineRaceDeckNum}
                    setOfflineRaceDeckName={setOfflineRaceDeckName}
                    offlineRaceIds={offlineRaceIds}
                    setOfflineRaceIds={setOfflineRaceIds}
                    resetOfflineCareer={() => {
                      setOfflineSetup(null);
                      setOfflineSetupAccountId('');
                      setOfflineRaceDeckNum(0);
                      setOfflineRaceDeckName('');
                      setOfflineRaceIds([]);
                    }}
                    prepareOfflineCareer={prepareOfflineCareer}
                    saveOfflineRaceDeck={saveOfflineRaceDeck}
                    races={races}
                    skills={skills}
                    offlineFactorSelection={offlineFactorSelection}
                    setOfflineFactorSelection={setOfflineFactorSelection}
                    offlineSkillSettings={offlineSkillSettings}
                    setOfflineSkillSettings={setOfflineSkillSettings}
                  />
                ) : null}

                {activeTab === 'career' &&
                automationActive &&
                !careerSaveOpen ? (
                  <AutomationControlCard
                    runner={runner}
                    runnerStopping={runnerStopping}
                    busy={busy}
                    runMode={runMode}
                    setRunMode={setRunMode}
                    runCountTarget={runCountTarget}
                    setRunCountTarget={setRunCountTarget}
                    jewelDropTarget={jewelDropTarget}
                    setJewelDropTarget={setJewelDropTarget}
                    remainingJewelDrops={remainingJewelDrops}
                    repeatDaily={repeatDaily}
                    updateRunningAutomation={updateRunningAutomation}
                    stopCareer={stopCareer}
                    activeSetting={activeAutomationSetting}
                    editPreset={editPresetForCareerSetting}
                    canAppendCareerPlan={
                      Boolean(accountCareerSettings.length) &&
                      !appendBlockedByContinuous
                    }
                    openAppendCareerPlan={() => {
                      setRepeatDaily(
                        Boolean(
                          runner?.daily_jewel_schedule?.enabled ||
                            runner?.run_plan?.repeat_daily ||
                            runner?.run_plan?.queue?.repeat_daily,
                        ),
                      );
                      setAppendPlanPickerOpen(true);
                      setError('');
                    }}
                  />
                ) : null}

                {activeTab === 'career' &&
                automationActive &&
                !careerSaveOpen ? (
                  <div id="career-progress" className="scroll-mt-28">
                    <ProgressTab
                      currentCareerActive={currentCareerActive}
                      activeCareerIconPath={activeCareerIconPath}
                      activeCareer={
                        offlineControlActive ? undefined : activeCareer
                      }
                      currentCareerUma={currentCareerUma}
                      runner={runner}
                      runnerStopping={runnerStopping}
                      runnerSessionWaiting={runnerSessionWaiting}
                      automationActive={automationActive}
                      currentRunnerStats={currentRunnerStats}
                      busy={busy}
                      releaseSessionWait={releaseSessionWait}
                      dailyJewelSchedule={dailyJewelSchedule}
                      offlineMode={offlineControlActive}
                      serverHostedMode={serverHostedMode}
                      idleSingleMode={currentIdleSingleMode}
                      abandonCareer={stopCareer}
                    />
                  </div>
                ) : null}

                {activeTab === 'daily' ? (
                  <DailyTasksTab
                    overview={dailyTasksOverview}
                    loading={
                      dailyTasksLoading ||
                      localAccountSessionState === 'unknown' ||
                      localAccountSessionState === 'checking' ||
                      checkingExistingRuntimeAccountId === selectedAccountId
                    }
                    loadError={dailyTasksLoadError}
                    busy={busy}
                    locked={serverHostedMode}
                    onRetry={() => {
                      if (!selectedAccountId) return;
                      loadDailyTasks(selectedAccountId).catch(() => undefined);
                    }}
                    onSave={saveDailyTasks}
                    onRun={runDailyTasks}
                  />
                ) : null}

                {historyDashboard && activeTab === 'history' ? (
                  <HistoryTab
                    dashboard={historyDashboard}
                    selectedCareerRecords={selectedCareerRecords}
                    setSelectedCareerRecords={setSelectedCareerRecords}
                    busy={busy}
                    historyCareerSetting={historyCareerSetting}
                    loadCareerHistory={loadCareerHistory}
                    selectedAccountId={selectedAccountId}
                    historyCareerSettingId={historyCareerSettingId}
                    setHistoryCareerSettingId={setHistoryCareerSettingId}
                    accountCareerSettings={accountCareerSettings}
                    historyCareerRecords={historyCareerRecords}
                    deleteCareerHistory={deleteCareerHistory}
                    races={races}
                  />
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
