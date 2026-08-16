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
  Server,
  Settings2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import HistoryTab from 'renderer/components/autoResearch/HistoryTab';
import ProgressTab from 'renderer/components/autoResearch/ProgressTab';
import PresetsTab from 'renderer/components/autoResearch/PresetsTab';
import CareerTab from 'renderer/components/autoResearch/CareerTab';
import SkillSelector, {
  AutoResearchSkill,
} from 'renderer/components/autoResearch/SkillSelector';
import { horseIconPath } from 'renderer/components/autoResearch/SelectionCards';
import {
  accountProgressPercent,
  AutoResearchRequestError,
  CAREER_SETTINGS_KEY,
  careerSettingMatchesCurrent,
  compareRaces,
  createDefaultPreset,
  createSkillSelectionId,
  DEFAULT_EXPECT_ATTRIBUTE,
  DEFAULT_PRESET_NAME,
  DEFAULT_SERVER,
  DELETED_PRESETS_KEY,
  fileToBase64,
  getSharedStorageItem,
  LAST_ACCOUNT_KEY,
  LOCAL_PRESETS_KEY,
  MONTH_OPTIONS,
  needsRelogin,
  normalizeServer,
  normalizeSkillLearningSettings,
  normalizeSkillSelections,
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
  CareerReport,
  CareerReportSummary,
  CareerSetting,
  LoginProgress,
  LoginProgressResponse,
  PendingRun,
  Preset,
  RaceOption,
  Runner,
  RunMode,
  SessionResponse,
  SkillLearningSetting,
  SkillOption,
  SkillSelectionEntry,
  SupportInfo,
  UmaRlTrainingStatus,
} from 'renderer/components/autoResearch/types';

import { loadUMDB } from 'renderer/utils/umdb';

const SHOW_UMARL_TRAINING = false;

const emptyAccountOptions = (): AccountOptionsResponse['options'] => ({
  umas: [],
  supports: [],
  decks: [],
  parents: [],
  friends: [],
  friend_exclude_ids: [],
});

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

export default function AutoResearch() {
  const [activeTab, setActiveTab] = useState<AutoResearchTab>('accounts');
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem('autoResearch.server') || DEFAULT_SERVER,
  );
  const [server, setServer] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [captured, setCaptured] = useState<CapturedCredential[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [presets, setPresets] = useState<Preset[]>(() => [
    createDefaultPreset(),
  ]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [skills, setSkills] = useState<AutoResearchSkill[]>([]);
  const [busy, setBusy] = useState('');
  const [stoppingAccountId, setStoppingAccountId] = useState('');
  const [error, setError] = useState('');
  const [manualUid, setManualUid] = useState('');
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loginProgress, setLoginProgress] = useState<LoginProgress | null>(
    null,
  );
  const [disconnectingAccountId, setDisconnectingAccountId] = useState('');
  const sessionTokens = useRef(new Map<string, string>());
  const autoConnectAttempted = useRef(false);
  const autoLoginAttempted = useRef('');
  const activeLoginOperation = useRef('');
  const activeConnectionAccountIdRef = useRef('');
  const disconnectingAccountIdRef = useRef('');
  const selectedAccountIdRef = useRef(selectedAccountId);
  selectedAccountIdRef.current = selectedAccountId;
  const overviewRequestVersions = useRef(new Map<string, number>());
  const overviewResponseOrders = useRef(new Map<string, number>());
  const accountOptionsCache = useRef(
    new Map<string, AccountOptionsResponse['options']>(),
  );
  const accountOptionsRequests = useRef(new Map<string, Promise<void>>());
  const accountActionRef = useRef<
    | ((
        accountId: string,
        action: 'login' | 'logout' | 'refresh',
      ) => Promise<void>)
    | null
  >(null);

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
  const [dailyRunTarget, setDailyRunTarget] = useState(3);
  const [jewelDropTarget, setJewelDropTarget] = useState(20);
  const [scheduleStartTime, setScheduleStartTime] = useState('05:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('05:00');
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
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
  const [selectedRaceIds, setSelectedRaceIds] = useState<number[]>([]);
  const [raceSearch, setRaceSearch] = useState('');
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
  const [careerHistory, setCareerHistory] = useState<CareerReportSummary[]>([]);
  const [historyCareerSettingId, setHistoryCareerSettingId] = useState('');
  const historyCareerSettingIdRef = useRef(historyCareerSettingId);
  historyCareerSettingIdRef.current = historyCareerSettingId;
  const umarlTrainingRequestRef = useRef<{
    key: string;
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);
  const [selectedTrainingReportIds, setSelectedTrainingReportIds] = useState<
    string[]
  >([]);
  const [selectedCareerReport, setSelectedCareerReport] =
    useState<CareerReport | null>(null);
  const [umarlTraining, setUmaRlTraining] =
    useState<UmaRlTrainingStatus | null>(null);
  const [umarlSettingModelAvailable, setUmaRlSettingModelAvailable] = useState<
    boolean | null
  >(null);
  const [umarlTrainEpisodes, setUmaRlTrainEpisodes] = useState(2048);
  const [umarlTrainGenerations, setUmaRlTrainGenerations] = useState(10);
  const [umarlTrainEpochs, setUmaRlTrainEpochs] = useState(6);
  const [umarlTrainBatchSize, setUmaRlTrainBatchSize] = useState(512);
  const [umarlTrainMaxStates, setUmaRlTrainMaxStates] = useState(160);
  const [umarlTrainRolloutWorkers, setUmaRlTrainRolloutWorkers] = useState(4);

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
  const loggedInAccount = accounts.find((account) => account.runtime.logged_in);
  const loggedInAccountId = loggedInAccount?.id || '';
  const runner = session?.runtime?.runner || selectedAccount?.runtime.runner;
  const runnerStopping = Boolean(
    runner?.stopping || stoppingAccountId === selectedAccountId,
  );
  const runnerSessionWaiting = Boolean(runner?.session_waiting);
  const dailyJewelSchedule = runner?.daily_jewel_schedule;
  const automationActive = Boolean(
    runner?.running || runner?.run_plan?.active || dailyJewelSchedule?.enabled,
  );
  const dailyRunCount = runner?.run_plan?.daily_completed_runs || 0;
  const hasRunPlan = Boolean(
    runner?.run_plan?.active ||
      runner?.run_plan?.stop_reason ||
      runner?.run_plan?.completed_runs ||
      runner?.run_plan?.completed_jewel_drops,
  );
  const remainingJewelDrops = Math.max(
    0,
    (runner?.daily_jewel_drop_limit || 20) -
      (runner?.daily_jewel_drop_count || 0),
  );
  const activeCareer = dashboard?.account.career;
  const activeCareerUma = dashboard?.umas.find(
    (uma) => uma.id === Number(activeCareer?.card_id || 0),
  );
  const currentCareerActive = runner?.run_plan?.active
    ? Boolean(runner.running)
    : Boolean(activeCareer?.active || runner?.running);
  const currentCareerUma =
    activeCareerUma ||
    (runner?.running
      ? dashboard?.umas.find((uma) => uma.id === Number(runner?.card_id || 0))
      : undefined);
  const activeCareerIconPath = currentCareerUma
    ? horseIconPath(
        currentCareerUma.id,
        currentCareerUma.rarity,
        currentCareerUma.race_cloth_id,
      )
    : undefined;
  const currentRunnerStats =
    runner?.current_stats || runner?.action_history?.at(-1)?.stats || {};
  const unsupportedCareer = Boolean(
    activeCareer?.active && Number(activeCareer.scenario_id) !== 1,
  );
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
        careerSettingMatchesCurrent(setting, activeCareer) &&
        presets.some((preset) => preset.name === setting.preset_name),
    );
  }, [accountCareerSettings, activeCareer, presets]);
  const selectedCareerSetting = useMemo(
    () =>
      careerSettings.find((setting) => setting.id === selectedCareerSettingId),
    [careerSettings, selectedCareerSettingId],
  );
  const historyCareerSetting = useMemo(
    () =>
      accountCareerSettings.find(
        (setting) => setting.id === historyCareerSettingId,
      ),
    [accountCareerSettings, historyCareerSettingId],
  );
  const historyCareerReports = useMemo(() => {
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
    if (ownSupports.length !== 5) return '支援卡组资料不完整，请刷新当前账号';
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
  const filteredRaces = useMemo(() => {
    const keyword = raceSearch.trim().toLowerCase();
    return races
      .filter(
        (race) =>
          !keyword ||
          `${race.name} ${race.date} ${race.venue} ${race.type}`
            .toLowerCase()
            .includes(keyword),
      )
      .sort(compareRaces);
  }, [raceSearch, races]);

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
          last_error: '',
          runner: { running: false },
          account: null,
        },
      })),
    );
    const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY) || '';
    setSelectedAccountId((current) => {
      if (current && localAccounts.some((account) => account.id === current)) {
        return current;
      }
      if (
        lastAccountId &&
        localAccounts.some((account) => account.id === lastAccountId)
      ) {
        return lastAccountId;
      }
      return '';
    });
  }, []);

  const updateRuntime = useCallback(
    (accountId: string, response: SessionResponse | null) => {
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? (() => {
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
                          response.dashboard?.account ??
                          account.runtime.account,
                      }
                    : {
                        logged_in: false,
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

  const commitOverviewResponse = useCallback(
    (accountId: string, response: SessionResponse, requestOrder?: number) => {
      if (requestOrder !== undefined) {
        if (overviewResponseOrders.current.get(accountId) !== requestOrder) {
          return false;
        }
      } else {
        invalidateOverviewResponses(accountId);
      }
      const options = accountOptionsCache.current.get(accountId);
      const normalized = {
        ...response,
        dashboard: response.dashboard
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
    ) => {
      invalidateOverviewResponses(accountId);
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
                    runner: acceptedRunner,
                    account:
                      acceptedRunner === nextRunner && nextAccount !== undefined
                        ? nextAccount
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
                  acceptedRunner === nextRunner &&
                  nextAccount != null &&
                  current.dashboard
                    ? { ...current.dashboard, account: nextAccount }
                    : current.dashboard,
                runner: acceptedRunner,
                runtime: {
                  ...(current.runtime || {}),
                  runner: acceptedRunner,
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
      return request<T>(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
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
      if (!accountId || !sessionTokens.current.has(accountId)) {
        return Promise.resolve();
      }
      const cached = accountOptionsCache.current.get(accountId);
      if (cached && !refresh) {
        applyAccountOptions(accountId, cached);
        return Promise.resolve();
      }
      const requestKey = `${accountId}:${refresh ? 'refresh' : 'cached'}`;
      const existing = accountOptionsRequests.current.get(requestKey);
      if (existing) return existing;
      const promise = accountRequest<AccountOptionsResponse>(
        accountId,
        refresh ? '/api/account/options/refresh' : '/api/account/options',
        refresh ? { method: 'POST', body: '{}' } : undefined,
      )
        .then((result) => applyAccountOptions(accountId, result.options))
        .finally(() => {
          accountOptionsRequests.current.delete(requestKey);
        });
      accountOptionsRequests.current.set(requestKey, promise);
      return promise;
    },
    [accountRequest, applyAccountOptions],
  );

  const loadOverview = useCallback(
    async (accountId: string) => {
      if (!accountId) return;
      if (
        disconnectingAccountIdRef.current === accountId ||
        activeConnectionAccountIdRef.current === accountId
      )
        return;
      if (!sessionTokens.current.has(accountId)) {
        setSession(null);
        return;
      }
      const requestVersion =
        overviewRequestVersions.current.get(accountId) || 0;
      const requestOrder = invalidateOverviewResponses(accountId);
      let result: SessionResponse;
      try {
        result = await accountRequest<SessionResponse>(
          accountId,
          '/api/account/overview',
        );
      } catch (caught) {
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
    },
    [accountRequest, commitOverviewResponse, invalidateOverviewResponses],
  );

  const loadCareerHistory = useCallback(
    async (accountId: string) => {
      if (!accountId || !sessionTokens.current.has(accountId)) return;
      setBusy('history');
      try {
        const result = await accountRequest<{
          success: boolean;
          reports: CareerReportSummary[];
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

  const openCareerReport = async (reportId: string) => {
    if (!selectedAccountId) return;
    setBusy(`history-${reportId}`);
    setError('');
    try {
      const result = await accountRequest<{
        success: boolean;
        report: CareerReport;
      }>(
        selectedAccountId,
        `/api/account/career/history/${encodeURIComponent(reportId)}`,
      );
      setSelectedCareerReport(result.report);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const loadUmaRlTraining = useCallback(
    (careerSettingId: string): Promise<void> => {
      if (
        !selectedAccountId ||
        !careerSettingId ||
        !sessionTokens.current.has(selectedAccountId)
      ) {
        return Promise.resolve();
      }
      const accountId = selectedAccountId;
      const requestKey = `${accountId}:${careerSettingId}`;
      const existing = umarlTrainingRequestRef.current;
      if (existing?.key === requestKey) {
        return existing.promise;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      const promise = (async () => {
        try {
          const result = await accountRequest<{
            success: boolean;
            training: UmaRlTrainingStatus;
            umarl?: Record<string, unknown>;
          }>(
            accountId,
            `/api/account/umarl/training?career_setting_id=${encodeURIComponent(careerSettingId)}`,
            { signal: controller.signal },
          );
          if (
            selectedAccountIdRef.current !== accountId ||
            historyCareerSettingIdRef.current !== careerSettingId
          ) {
            return;
          }
          setUmaRlTraining(result.training);
          if (result.umarl) {
            setUmaRlSettingModelAvailable(
              Boolean(result.umarl.model_available),
            );
            setHealth((current: any) => ({ ...current, umarl: result.umarl }));
          }
        } catch (caught) {
          if ((caught as Error).name !== 'AbortError') {
            setError((caught as Error).message);
          }
        } finally {
          window.clearTimeout(timeout);
        }
      })().finally(() => {
        if (umarlTrainingRequestRef.current?.controller === controller) {
          umarlTrainingRequestRef.current = null;
        }
      });
      umarlTrainingRequestRef.current = {
        key: requestKey,
        controller,
        promise,
      };
      return promise;
    },
    [accountRequest, selectedAccountId],
  );

  const startUmaRlTraining = async (reportIds: string[]) => {
    if (!selectedAccountId || !historyCareerSetting || !reportIds.length) {
      return;
    }
    setBusy('umarl-train');
    setError('');
    try {
      const result = await accountRequest<{
        success: boolean;
        training: UmaRlTrainingStatus;
        umarl?: Record<string, unknown>;
      }>(selectedAccountId, '/api/account/umarl/training', {
        method: 'POST',
        body: JSON.stringify({
          career_setting_id: historyCareerSetting.id,
          career_setting_name: historyCareerSetting.name,
          preset_name: historyCareerSetting.preset_name,
          card_id: historyCareerSetting.card_id,
          report_ids: reportIds,
          episodes: umarlTrainEpisodes,
          generations: umarlTrainGenerations,
          epochs: umarlTrainEpochs,
          batch_size: umarlTrainBatchSize,
          rollout_workers: umarlTrainRolloutWorkers,
          max_states: umarlTrainMaxStates,
        }),
      });
      setUmaRlTraining(result.training);
      if (result.umarl) {
        setUmaRlSettingModelAvailable(Boolean(result.umarl.model_available));
        setHealth((current: any) => ({ ...current, umarl: result.umarl }));
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const cancelUmaRlTraining = async () => {
    if (!selectedAccountId || !historyCareerSettingId) return;
    setBusy('umarl-cancel');
    try {
      const result = await accountRequest<{
        success: boolean;
        training: UmaRlTrainingStatus;
        umarl?: Record<string, unknown>;
      }>(selectedAccountId, '/api/account/umarl/training/cancel', {
        method: 'POST',
        body: JSON.stringify({
          career_setting_id: historyCareerSettingId,
        }),
      });
      setUmaRlTraining(result.training);
      if (result.umarl) {
        setUmaRlSettingModelAvailable(Boolean(result.umarl.model_available));
        setHealth((current: any) => ({ ...current, umarl: result.umarl }));
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const refreshUmaRlTraining = async () => {
    if (!historyCareerSettingId) return;
    setBusy('umarl-refresh');
    setError('');
    try {
      await loadUmaRlTraining(historyCareerSettingId);
    } finally {
      setBusy('');
    }
  };

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
        accountOptionsCache.current.clear();
        accountOptionsRequests.current.clear();
        setAccounts((current) =>
          current.map((account) => ({
            ...account,
            runtime: {
              logged_in: false,
              last_error: '',
              runner: { running: false },
              account: null,
            },
          })),
        );
        setSession(null);
        setServerAddress(nextServer);
        autoLoginAttempted.current = '';
        setServer(nextServer);
        setHealth(body);
      } catch (caught) {
        setError(`无法连接后端：${(caught as Error).message}`);
      } finally {
        setBusy('');
      }
    },
    [serverAddress],
  );

  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    const storedServer = localStorage.getItem('autoResearch.server');
    if (storedServer) connect(storedServer).catch(() => undefined);
  }, [connect]);

  useEffect(() => {
    loadUMDB().catch(() => undefined);
    try {
      const stored = JSON.parse(
        getSharedStorageItem(CAREER_SETTINGS_KEY) || '[]',
      );
      if (Array.isArray(stored)) setCareerSettings(stored);
    } catch {
      setCareerSettings([]);
    }
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
    return window.electron.autoResearch.onCredentialCaptured((credential) => {
      setCaptured((current) => [
        credential,
        ...current.filter((item) => item.uid !== credential.uid),
      ]);
      loadAccounts().catch((caught) => setError((caught as Error).message));
    });
  }, [loadAccounts]);

  useEffect(() => {
    if (!server) return;
    request<{ presets: Preset[] }>('/api/presets')
      .then((result) => {
        let localPresets: Preset[] = [];
        let deletedPresetNames: string[] = [];
        try {
          const stored = JSON.parse(
            getSharedStorageItem(LOCAL_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(stored)) localPresets = stored;
          const deleted = JSON.parse(
            getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(deleted)) deletedPresetNames = deleted;
        } catch {
          localPresets = [];
          deletedPresetNames = [];
        }
        const merged = new Map<string, Preset>();
        [...(result.presets || []), ...localPresets].forEach((preset) => {
          if (
            preset?.name &&
            (preset.name === DEFAULT_PRESET_NAME ||
              !deletedPresetNames.includes(preset.name))
          ) {
            merged.set(preset.name, preset);
          }
        });
        if (!merged.has(DEFAULT_PRESET_NAME)) {
          merged.set(DEFAULT_PRESET_NAME, createDefaultPreset());
        }
        const nextPresets = [
          merged.get(DEFAULT_PRESET_NAME) as Preset,
          ...[...merged.values()].filter(
            (preset) => preset.name !== DEFAULT_PRESET_NAME,
          ),
        ];
        setSharedStorageItem(
          DELETED_PRESETS_KEY,
          JSON.stringify(
            deletedPresetNames.filter((name) => name !== DEFAULT_PRESET_NAME),
          ),
        );
        setPresets(nextPresets);
        setPresetName((current) =>
          nextPresets.some((preset) => preset.name === current)
            ? current
            : DEFAULT_PRESET_NAME,
        );
      })
      .catch((caught) => setError((caught as Error).message));
    request<{ races: RaceOption[] }>('/api/races')
      .then((result) => setRaces(result.races || []))
      .catch((caught) => setError((caught as Error).message));
    request<{ skills: Record<string, SkillOption> }>('/api/skills')
      .then((result) => {
        const byName = new Map<string, AutoResearchSkill>();
        Object.entries(result.skills || {}).forEach(([rawId, rawSkill]) => {
          const name = String(rawSkill.name || '').trim();
          const needSkillPoint = Number(rawSkill.need_skill_point || 0);
          if (!name || needSkillPoint <= 0 || name.endsWith('×')) return;

          const skill: AutoResearchSkill = {
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
          };
          if (!byName.has(name)) byName.set(name, skill);
        });
        setSkills(
          [...byName.values()].sort(
            (left, right) =>
              right.rarity - left.rarity ||
              left.skill_category - right.skill_category ||
              left.name.localeCompare(right.name, 'zh-CN'),
          ),
        );
      })
      .catch((caught) => setError((caught as Error).message));
  }, [request, server]);

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
    setSelectedRaceIds((preset.extra_race_list || []).map(Number));
  }, [presetName, presets]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSession(null);
      return;
    }
    loadOverview(selectedAccountId).catch((caught) =>
      setError((caught as Error).message),
    );
  }, [loadOverview, selectedAccountId]);

  useEffect(() => {
    if (
      !selectedAccountId ||
      !selectedAccount?.runtime.logged_in ||
      !['career', 'progress', 'history'].includes(activeTab)
    ) {
      return;
    }
    loadAccountOptions(selectedAccountId).catch((caught) =>
      setError((caught as Error).message),
    );
  }, [
    activeTab,
    loadAccountOptions,
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
    umarlTrainingRequestRef.current?.controller.abort();
    umarlTrainingRequestRef.current = null;
    setSelectedCareerSettingId('');
    setCareerSettingName('');
    setCareerPresetName('');
    setCareerSaveOpen(false);
    setNewCareerSaveName('');
    setNewCareerPresetName('');
    setCareerHistory([]);
    setHistoryCareerSettingId('');
    setSelectedTrainingReportIds([]);
    setSelectedCareerReport(null);
    setUmaRlTraining(null);
    setUmaRlSettingModelAvailable(null);
  }, [selectedAccountId]);

  useEffect(() => {
    umarlTrainingRequestRef.current?.controller.abort();
    umarlTrainingRequestRef.current = null;
    setSelectedCareerReport(null);
    setSelectedTrainingReportIds([]);
    setUmaRlTraining(null);
    setUmaRlSettingModelAvailable(null);
  }, [historyCareerSettingId]);

  useEffect(() => {
    const available = new Set(historyCareerReports.map((report) => report.id));
    setSelectedTrainingReportIds((current) =>
      current.filter((reportId) => available.has(reportId)),
    );
  }, [historyCareerReports]);

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
      activeTab !== 'history' ||
      !SHOW_UMARL_TRAINING ||
      !health?.umarl?.installed ||
      !selectedAccountId ||
      !historyCareerSettingId ||
      !selectedAccount?.runtime.logged_in
    ) {
      return undefined;
    }
    loadUmaRlTraining(historyCareerSettingId).catch(() => undefined);
    return undefined;
  }, [
    activeTab,
    health?.umarl?.installed,
    historyCareerSettingId,
    loadUmaRlTraining,
    selectedAccount?.runtime.logged_in,
    selectedAccountId,
  ]);

  useEffect(() => {
    if (!selectedAccountId || !automationActive) return undefined;
    const token = sessionTokens.current.get(selectedAccountId);
    if (!token || !server) return undefined;
    const accountId = selectedAccountId;
    let cancelled = false;
    let completionRequested = false;
    let retryDelay = 1000;
    let controller: AbortController | null = null;
    const handleStreamLine = (line: string) => {
      if (cancelled || !line.trim()) return;
      try {
        const event = JSON.parse(line) as {
          success?: boolean;
          runner?: Runner;
          account?: SessionAccount | null;
        };
        if (!event.runner) return;
        retryDelay = 1000;
        commitRunnerStream(accountId, event.runner, event.account);
        const stillActive = Boolean(
          event.runner.running ||
            event.runner.run_plan?.active ||
            event.runner.daily_jewel_schedule?.enabled,
        );
        if (!stillActive && !completionRequested) {
          completionRequested = true;
          cancelled = true;
          controller?.abort();
          loadOverview(accountId).catch(() => undefined);
        }
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
  }, [
    automationActive,
    commitRunnerStream,
    loadOverview,
    selectedAccountId,
    server,
  ]);

  useEffect(() => {
    if (!stoppingAccountId) return;
    const account = accounts.find((item) => item.id === stoppingAccountId);
    const accountRunner =
      stoppingAccountId === selectedAccountId
        ? session?.runtime?.runner || account?.runtime.runner
        : account?.runtime.runner;
    if (!accountRunner?.running && !accountRunner?.run_plan?.active) {
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
      (account) => account.runtime.logged_in && account.id !== accountId,
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
    setBusy(`${action}-${accountId}`);
    setError('');
    try {
      let result: SessionResponse | null = null;
      const authenticate = async (forceLogin = false, recoveryDetail = '') => {
        const loginId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (activeLoginOperation.current !== connectionOperationId) {
          throw new Error('另一个账号正在登录，请等待当前登录完成');
        }
        const startedAt = Date.now();
        let polling = true;
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
          request<LoginProgressResponse>(
            `/api/auth/login-progress/${encodeURIComponent(loginId)}`,
          )
            .then((progress) => {
              if (!polling || !progress.found) return;
              if (progress.done) {
                polling = false;
                window.clearInterval(progressTimer);
              }
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
            })
            .catch(() => undefined);
        }, 500);
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
            }),
          });
          sessionTokens.current.set(accountId, authenticated.token);
          return authenticated;
        } finally {
          polling = false;
          window.clearInterval(progressTimer);
        }
      };
      if (action === 'login') {
        result = await authenticate(false);
      } else if (action === 'refresh') {
        let relogged = false;
        const accountRunning = Boolean(
          accounts.find((account) => account.id === accountId)?.runtime.runner
            .running,
        );
        const restoreLogin = async (recoveryDetail = '') => {
          try {
            await authenticate(false, recoveryDetail);
          } catch (caught) {
            if (
              !(caught instanceof AutoResearchRequestError) ||
              caught.status !== 401
            ) {
              throw caught;
            }
            await authenticate(true, '登录凭据需要重新验证，正在重新登录');
          }
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
          let polling = true;
          setLoginProgress({
            accountId,
            loginId: refreshId,
            action: 'refresh',
            stage: 'queued',
            endpoint: '',
            detail: '准备刷新当前账号',
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
            request<LoginProgressResponse>(
              `/api/auth/login-progress/${encodeURIComponent(refreshId)}`,
            )
              .then((progress) => {
                if (!polling || !progress.found) return;
                if (progress.done) {
                  polling = false;
                  window.clearInterval(progressTimer);
                }
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
              })
              .catch(() => undefined);
          }, 500);
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
            polling = false;
            window.clearInterval(progressTimer);
          }
        };
        if (!sessionTokens.current.has(accountId)) {
          await restoreLogin();
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
            await authenticate(true);
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

  accountActionRef.current = accountAction;

  useEffect(() => {
    if (
      !server ||
      !accounts.length ||
      loginProgress ||
      activeLoginOperation.current
    )
      return;
    if (
      accounts.some((account) => account.runtime.logged_in) ||
      sessionTokens.current.size
    )
      return;
    const accountId = localStorage.getItem(LAST_ACCOUNT_KEY) || '';
    if (!accountId) return;
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      localStorage.removeItem(LAST_ACCOUNT_KEY);
      return;
    }
    setSelectedAccountId(accountId);
    if (account.runtime.logged_in || sessionTokens.current.has(accountId))
      return;
    const attemptKey = `${server}|${accountId}`;
    if (autoLoginAttempted.current === attemptKey) return;
    autoLoginAttempted.current = attemptKey;
    accountActionRef.current?.(accountId, 'login').catch(() => undefined);
  }, [accounts, loginProgress, server]);

  const refreshOptionsIndex = async () => {
    if (!selectedAccountId) return;
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
      autoLoginAttempted.current = `${server}|${accountId}`;
      setActiveTab('accounts');
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
      },
      extra_race_list: [...selectedRaceIds].sort((leftId, rightId) => {
        const left = races.find((race) => race.id === leftId);
        const right = races.find((race) => race.id === rightId);
        if (left && right) return compareRaces(left, right);
        if (left) return -1;
        if (right) return 1;
        return leftId - rightId;
      }),
    };
  };

  const runCareer = async (mode: RunMode, target: number) => {
    if (!selectedAccountId || !dashboard) return false;
    const boundPreset = presets.find(
      (preset) => preset.name === careerPresetName,
    );
    if (!boundPreset) {
      setError('这个养马详设绑定的预设不存在，请返回后重新创建详设');
      return false;
    }
    if (unsupportedCareer) {
      setError(
        `当前进行中的育成剧本（scenario_id=${dashboard.account.career?.scenario_id}）暂不支持。请在游戏中手动退出本次养马，再刷新账号状态。`,
      );
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
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
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
      setError('当前育成与这个养马详设不一致，请刷新账号后重新选择');
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
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
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
    if (
      !window.confirm('确定放弃当前育成吗？本次育成会立即结束，且无法恢复。')
    ) {
      return;
    }
    setBusy('abandon');
    setError('');
    try {
      if (automationActive) {
        await accountRequest(
          selectedAccountId,
          '/api/account/career/runner/stop',
          { method: 'POST', body: '{}' },
        );
      }
      await accountRequest(selectedAccountId, '/api/account/career/delete', {
        method: 'POST',
        body: JSON.stringify({
          current_turn: runner?.turn ?? dashboard.account.career.turn ?? 1,
        }),
      });
      await loadOverview(selectedAccountId);
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
      const deletedPresetNames = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      ) as string[];
      setSharedStorageItem(
        DELETED_PRESETS_KEY,
        JSON.stringify(
          deletedPresetNames.filter((name) => name !== preset.name),
        ),
      );
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
    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(deletedPresetNames.filter((item) => item !== name)),
    );
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

    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(
        Array.from(
          new Set([
            ...deletedPresetNames.filter((item) => item !== name),
            currentName,
          ]),
        ),
      ),
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
    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(Array.from(new Set([...deletedPresetNames, name]))),
    );
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
    setError('');
  };

  const editCareerPreset = () => {
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

  const applyCareerSetting = (settingId: string) => {
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) return;
    if (!presets.some((preset) => preset.name === setting.preset_name)) {
      setError(`养马详设绑定的预设不存在：${setting.preset_name}`);
      return;
    }
    setSelectedCareerSettingId(settingId);
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
    setCareerSaveOpen(true);
  };

  const createCareerSave = () => {
    const name = newCareerSaveName.trim();
    if (!name) {
      setError('请先填写新详设名称');
      return;
    }
    if (
      !newCareerPresetName ||
      !presets.some((preset) => preset.name === newCareerPresetName)
    ) {
      setError('请先选择这个养马详设要绑定的预设');
      return;
    }
    setSelectedCareerSettingId('');
    setCareerSettingName(name);
    setCareerPresetName(newCareerPresetName);
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
      !careerPresetName ||
      !presets.some((preset) => preset.name === careerPresetName)
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
    const boundPresetName = existing?.preset_name || careerPresetName;
    const setting: CareerSetting = {
      id: existing?.id || `${selectedAccount.uid}-${Date.now()}`,
      name,
      account_uid: selectedAccount.uid,
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
      max_steps: maxSteps,
      burn_clocks: burnClocks,
      recover_tp_with_item: recoverTpWithItem,
      recover_tp_with_jewels: recoverTpWithJewels,
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

  const saveAndRunCareer = () => {
    if (!saveCareerSetting()) return;
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '05:00');
    setPendingRun({ type: 'current' });
    setRunDialogOpen(true);
  };

  const openSavedRunDialog = (settingId: string) => {
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '05:00');
    setPendingRun({ type: 'saved', settingId });
    setRunDialogOpen(true);
    setError('');
  };

  const confirmRunPlan = async () => {
    if (!pendingRun) return;
    const target =
      runMode === 'daily_count'
        ? Math.max(1, dailyRunTarget)
        : runMode === 'jewel_drops' || runMode === 'daily_jewel_schedule'
          ? Math.max(1, jewelDropTarget)
          : 1;
    let started = false;
    if (pendingRun.type === 'saved') {
      const setting = careerSettings.find(
        (item) => item.id === pendingRun.settingId,
      );
      if (!setting) {
        setError('所选养马详设不存在');
        return;
      }
      started = await resumeCareerWithSetting(setting, runMode, target);
    } else {
      started = await runCareer(runMode, target);
    }
    if (started) {
      setRunDialogOpen(false);
      setPendingRun(null);
      navigateToTab('progress');
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

  if (!server) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600">
            <Server size={30} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                连接 UmaAutoResearch
              </h1>
              <p className="text-sm text-slate-500">
                UmaAutoResearch实现暂不开源
              </p>
            </div>
          </div>
          <label
            className="mt-8 block text-sm font-semibold text-slate-700"
            htmlFor="auto-server"
          >
            服务器地址
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="auto-server"
              value={serverAddress}
              onChange={(event) => setServerAddress(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && connect().catch(() => undefined)
              }
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-indigo-400"
              placeholder={DEFAULT_SERVER}
            />
            <button
              type="button"
              onClick={() => connect().catch(() => undefined)}
              disabled={busy === 'connect'}
              className="rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === 'connect' ? '连接中…' : '连接'}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-800 xl:px-6">
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
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={1}
                        value={setting.min_hint_level}
                        onChange={(event) =>
                          updateSkillLearningSetting(
                            editingSkillSelection.skill_names,
                            {
                              min_hint_level: Math.max(
                                0,
                                Math.min(
                                  5,
                                  Math.trunc(Number(event.target.value) || 0),
                                ),
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
      {runDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="选择自动育成运行方式"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">选择运行方式</h3>
              <p className="mt-1 text-sm text-slate-500">
                本次选择只控制如何连续运行，不会写入养马详设。
              </p>
            </div>
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    id: 'single' as const,
                    title: '单次运行',
                    detail: '完成当前这一次育成后停止。',
                    icon: Play,
                  },
                  {
                    id: 'continuous' as const,
                    title: '持续运行',
                    detail:
                      '每次育成结束后自动开始下一次，直到手动停止或无法继续。',
                    icon: RefreshCw,
                  },
                  {
                    id: 'daily_count' as const,
                    title: '每日运行次数',
                    detail: `限制这个账号今天完成的育成次数；今日已完成 ${dailyRunCount} 次。`,
                    icon: ListChecks,
                  },
                  {
                    id: 'jewel_drops' as const,
                    title: '完成宝石掉落',
                    detail: `从现在起累计指定次数的宝石掉落；本周期还可掉落 ${remainingJewelDrops} 次。`,
                    icon: Gem,
                  },
                  {
                    id: 'daily_jewel_schedule' as const,
                    title: '每日宝石计划',
                    detail:
                      '每天在指定时间段内自动运行，达到每日目标或结束时间后停止。',
                    icon: Gem,
                  },
                ].map((option) => {
                  const IconComponent = option.icon;
                  const disabled =
                    (option.id === 'jewel_drops' && remainingJewelDrops <= 0) ||
                    (option.id === 'daily_count' && dailyRunCount >= 100);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setRunMode(option.id);
                        if (option.id === 'daily_count') {
                          setDailyRunTarget((current) =>
                            Math.max(current, dailyRunCount + 1),
                          );
                        } else if (option.id === 'jewel_drops') {
                          setJewelDropTarget(
                            Math.max(1, Math.min(20, remainingJewelDrops)),
                          );
                        } else if (option.id === 'daily_jewel_schedule') {
                          setJewelDropTarget(dailyJewelSchedule?.target || 20);
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

              {runMode === 'daily_count' ? (
                <label className="mt-4 block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  今日总计完成
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={Math.min(100, dailyRunCount + 1)}
                      max={100}
                      value={dailyRunTarget}
                      onChange={(event) =>
                        setDailyRunTarget(
                          Math.max(
                            Math.min(100, dailyRunCount + 1),
                            Math.min(100, Number(event.target.value)),
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold"
                    />
                    <span className="text-slate-500">次育成</span>
                  </div>
                  <span className="mt-2 block text-xs text-slate-500">
                    次数按账号和日期持久化。今天已经完成的育成也会计入上限。
                  </span>
                </label>
              ) : null}

              {runMode === 'jewel_drops' ? (
                <label className="mt-4 block rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
                  从现在起完成
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, remainingJewelDrops)}
                      value={jewelDropTarget}
                      onChange={(event) =>
                        setJewelDropTarget(
                          Math.max(
                            1,
                            Math.min(
                              Math.max(1, remainingJewelDrops),
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
                    达到目标后会在当前比赛结束处停止，未完成的育成之后可以继续。
                  </span>
                </label>
              ) : null}

              {runMode === 'daily_jewel_schedule' ? (
                <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      每日掉落目标
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={jewelDropTarget}
                          onChange={(event) =>
                            setJewelDropTarget(
                              Math.max(
                                1,
                                Math.min(20, Number(event.target.value)),
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                        />
                        <span className="whitespace-nowrap text-violet-700">
                          次
                        </span>
                      </div>
                    </label>
                    <label>
                      每日启动时间
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(event) => {
                          setScheduleStartTime(event.target.value);
                          setError('');
                        }}
                        className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                      />
                    </label>
                    <label>
                      每日结束时间
                      <input
                        type="time"
                        value={scheduleEndTime}
                        onChange={(event) => {
                          setScheduleEndTime(event.target.value);
                          setError('');
                        }}
                        className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-violet-700">
                    时间使用北京时间并支持跨午夜。开始和结束都设为 05:00
                    时，表示完整宝石周期：当天 05:00 至次日 04:59。
                  </p>
                </section>
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
                  (runMode === 'jewel_drops' && remainingJewelDrops <= 0) ||
                  (runMode === 'daily_count' && dailyRunCount >= 100)
                }
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Play size={16} />
                {busy ? '正在启动…' : '开始运行'}
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
              {server} · 游戏版本 {health?.app_ver} · 当前服务器允许运行上限{' '}
              {health?.max_accounts}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                selectedAccountId && accountAction(selectedAccountId, 'refresh')
              }
              disabled={
                !selectedAccountId ||
                Boolean(disconnectingAccountId) ||
                Boolean(
                  loggedInAccountId && loggedInAccountId !== selectedAccountId,
                ) ||
                busy === `refresh-${selectedAccountId}`
              }
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`mr-1 inline ${busy === `refresh-${selectedAccountId}` ? 'animate-spin' : ''}`}
                size={15}
              />
              {busy === `refresh-${selectedAccountId}`
                ? '刷新中…'
                : automationActive
                  ? '刷新养马进度'
                  : '刷新当前账号'}
            </button>
            <button
              type="button"
              onClick={() => {
                setServer('');
                setHealth(null);
              }}
              disabled={Boolean(loginProgress || disconnectingAccountId)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              更换服务器
            </button>
          </div>
        </header>

        <div className={`${panelClass('px-3')} sticky top-0 z-30 shadow-sm`}>
          <nav
            className="-mb-px flex space-x-8 overflow-x-auto"
            aria-label="自动育成设置"
          >
            {[
              { id: 'accounts' as const, label: '账号', icon: Users },
              { id: 'presets' as const, label: '预设', icon: Settings2 },
              { id: 'career' as const, label: '详设', icon: ListChecks },
              { id: 'progress' as const, label: '当前养马', icon: Activity },
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

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {loginProgress ? (
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <div className="flex items-center gap-2 font-semibold">
              {loginProgressComplete ? (
                <Check size={15} />
              ) : (
                <RefreshCw className="animate-spin" size={15} />
              )}
              {loginProgressComplete
                ? loginProgress.action === 'refresh'
                  ? '刷新完成，正在更新界面'
                  : '登录完成，正在打开账号'
                : loginProgress.action === 'refresh'
                  ? '正在刷新当前账号'
                  : '登录中'}{' '}
              · {loginProgress.elapsed}s
            </div>
            <p className="mt-1">
              {loginProgress.detail}
              {loginProgress.endpoint ? ` · ${loginProgress.endpoint}` : ''}
              {loginProgress.delay > 0
                ? ` · 本阶段等待约 ${loginProgress.delay.toFixed(3)}s`
                : ''}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cyan-100">
              <div
                className="h-full rounded-full bg-cyan-500 transition-[width] duration-300"
                style={{ width: `${accountProgressPercent(loginProgress)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-cyan-700">
              {loginProgress.action === 'refresh'
                ? loginProgressComplete
                  ? '账号数据已经返回，正在完成界面切换。'
                  : '等待全部账号接口完成后才会更新页面，请勿重复点击刷新。'
                : loginProgressComplete
                  ? '登录已经完成，正在载入账号数据。'
                  : '接口包含模拟操作间隔，请勿重复点击登录。'}
            </p>
          </div>
        ) : null}
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
                        className={`rounded-full px-2 py-0.5 text-xs ${disconnectingAccountId === account.id ? 'bg-amber-100 text-amber-700' : account.runtime.logged_in ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {disconnectingAccountId === account.id
                          ? '退出中'
                          : loginProgress?.accountId === account.id
                            ? loginProgress.action === 'refresh'
                              ? '刷新中'
                              : '登录中'
                            : account.runtime.logged_in
                              ? '已登录'
                              : '离线'}
                      </span>
                    </button>
                    <div className="mt-3 flex gap-1">
                      {account.runtime.logged_in ? (
                        <>
                          <button
                            type="button"
                            onClick={() => accountAction(account.id, 'refresh')}
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
                              ? '刷新中'
                              : '刷新状态'}
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
                            onClick={() => accountAction(account.id, 'logout')}
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
                          onClick={() => accountAction(account.id, 'login')}
                          disabled={Boolean(
                            loginProgress ||
                              disconnectingAccountId ||
                              (loggedInAccountId &&
                                loggedInAccountId !== account.id),
                          )}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <LogIn className="mr-1 inline" size={12} />
                          {loginProgress?.accountId === account.id
                            ? `登录中 ${loginProgress.elapsed}s`
                            : loginProgress
                              ? '等待登录'
                              : loggedInAccountId &&
                                  loggedInAccountId !== account.id
                                ? '已有账号登录'
                                : '登录'}
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
              disconnectingAccountId === selectedAccount.id ? (
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
              loginProgress?.accountId === selectedAccount.id ? (
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
                      : loginProgress.action === 'refresh'
                        ? '正在刷新当前账号'
                        : '正在登录账号'}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {loginProgress.detail}
                  </p>
                </div>
              </section>
            ) : activeTab !== 'presets' &&
              (!selectedAccount?.runtime.logged_in || !dashboard) ? (
              <section className={panelClass('p-12 text-center')}>
                <LogIn className="mx-auto text-slate-300" size={42} />
                <p className="mt-3 text-slate-500">
                  登录后可读取角色、卡组和育成状态。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      selectedAccount &&
                      accountAction(selectedAccount.id, 'login')
                    }
                    disabled={Boolean(
                      loginProgress ||
                        disconnectingAccountId ||
                        (loggedInAccountId &&
                          loggedInAccountId !== selectedAccount?.id),
                    )}
                    className="rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    {loginProgress?.accountId === selectedAccount?.id
                      ? `登录中 ${loginProgress?.elapsed || 0}s · ${loginProgress?.detail || '正在连接登录服务'}`
                      : loginProgress
                        ? '请等待其他账号登录完成'
                        : disconnectingAccountId
                          ? '请等待账号退出完成'
                          : loggedInAccountId &&
                              loggedInAccountId !== selectedAccount?.id
                            ? '请先退出当前账号'
                            : '登录账号'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('presets', 'preset-basic')}
                    className="rounded-md border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    先配置预设
                  </button>
                </div>
              </section>
            ) : (
              <>
                {dashboard && activeTab === 'accounts' ? (
                  <>
                    <section
                      className={`${panelClass('p-4')} grid gap-3 sm:grid-cols-2 lg:grid-cols-6`}
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
                          '育成',
                          dashboard.account.career?.active
                            ? `${dashboard.account.career.name} T${dashboard.account.career.turn}`
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
                        <button
                          type="button"
                          onClick={() =>
                            automationActive
                              ? navigateToTab('progress')
                              : navigateToTab('career', 'career-task')
                          }
                          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          {automationActive ? '查看养马进度' : '前往养马详设'}
                        </button>
                      </div>
                    </section>
                  </>
                ) : null}

                {activeTab === 'career' && unsupportedCareer ? (
                  <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
                    <h2 className="font-bold">当前养马暂时无法接管</h2>
                    <p className="mt-1 text-sm">
                      检测到进行中的剧本为 scenario_id=
                      {dashboard.account.career?.scenario_id}，目前只支持 URA。
                      请进入游戏手动退出这次养马，然后点击左侧“刷新”。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToTab('progress')}
                        className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                      >
                        查看当前进度
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
                    raceSearch={raceSearch}
                    setRaceSearch={setRaceSearch}
                    filteredRaces={filteredRaces}
                    selectedRaceIds={selectedRaceIds}
                    setSelectedRaceIds={setSelectedRaceIds}
                  />
                ) : null}

                {dashboard && activeTab === 'career' ? (
                  <CareerTab
                    dashboard={dashboard}
                    careerSaveOpen={careerSaveOpen}
                    accountCareerSettings={accountCareerSettings}
                    applyCareerSetting={applyCareerSetting}
                    deleteCareerSetting={deleteCareerSetting}
                    newCareerSaveName={newCareerSaveName}
                    setNewCareerSaveName={setNewCareerSaveName}
                    createCareerSave={createCareerSave}
                    careerSettingName={careerSettingName}
                    navigateToTab={navigateToTab}
                    automationActive={automationActive}
                    stopCareer={stopCareer}
                    runnerStopping={runnerStopping}
                    busy={busy}
                    activeCareer={activeCareer}
                    matchingCareerSettings={matchingCareerSettings}
                    activeCareerIconPath={activeCareerIconPath}
                    unsupportedCareer={unsupportedCareer}
                    openSavedRunDialog={openSavedRunDialog}
                    abandonCareer={abandonCareer}
                    continuingCurrentCareer={continuingCurrentCareer}
                    canContinueCurrentCareer={canContinueCurrentCareer}
                    saveCareerSetting={saveCareerSetting}
                    saveAndRunCareer={saveAndRunCareer}
                    careerPresetName={careerPresetName}
                    newCareerPresetName={newCareerPresetName}
                    setNewCareerPresetName={setNewCareerPresetName}
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
                  />
                ) : null}

                {dashboard && activeTab === 'progress' ? (
                  <ProgressTab
                    currentCareerActive={currentCareerActive}
                    activeCareerIconPath={activeCareerIconPath}
                    activeCareer={activeCareer}
                    currentCareerUma={currentCareerUma}
                    runner={runner}
                    runnerStopping={runnerStopping}
                    runnerSessionWaiting={runnerSessionWaiting}
                    automationActive={automationActive}
                    currentRunnerStats={currentRunnerStats}
                    busy={busy}
                    releaseSessionWait={releaseSessionWait}
                    dailyJewelSchedule={dailyJewelSchedule}
                    hasRunPlan={hasRunPlan}
                    stopCareer={stopCareer}
                  />
                ) : null}

                {dashboard && activeTab === 'history' ? (
                  <HistoryTab
                    dashboard={dashboard}
                    selectedCareerReport={selectedCareerReport}
                    setSelectedCareerReport={setSelectedCareerReport}
                    health={health}
                    showUmaRlTraining={SHOW_UMARL_TRAINING}
                    umarlTraining={umarlTraining}
                    startUmaRlTraining={startUmaRlTraining}
                    busy={busy}
                    historyCareerSetting={historyCareerSetting}
                    loadCareerHistory={loadCareerHistory}
                    selectedAccountId={selectedAccountId}
                    historyCareerSettingId={historyCareerSettingId}
                    setHistoryCareerSettingId={setHistoryCareerSettingId}
                    accountCareerSettings={accountCareerSettings}
                    umarlSettingModelAvailable={umarlSettingModelAvailable}
                    cancelUmaRlTraining={cancelUmaRlTraining}
                    refreshUmaRlTraining={refreshUmaRlTraining}
                    selectedTrainingReportIds={selectedTrainingReportIds}
                    setSelectedTrainingReportIds={setSelectedTrainingReportIds}
                    umarlTrainEpisodes={umarlTrainEpisodes}
                    setUmaRlTrainEpisodes={setUmaRlTrainEpisodes}
                    umarlTrainGenerations={umarlTrainGenerations}
                    setUmaRlTrainGenerations={setUmaRlTrainGenerations}
                    umarlTrainEpochs={umarlTrainEpochs}
                    setUmaRlTrainEpochs={setUmaRlTrainEpochs}
                    umarlTrainBatchSize={umarlTrainBatchSize}
                    setUmaRlTrainBatchSize={setUmaRlTrainBatchSize}
                    umarlTrainMaxStates={umarlTrainMaxStates}
                    setUmaRlTrainMaxStates={setUmaRlTrainMaxStates}
                    umarlTrainRolloutWorkers={umarlTrainRolloutWorkers}
                    setUmaRlTrainRolloutWorkers={setUmaRlTrainRolloutWorkers}
                    historyCareerReports={historyCareerReports}
                    openCareerReport={openCareerReport}
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
