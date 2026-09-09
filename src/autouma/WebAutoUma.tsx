/* eslint-disable jsx-a11y/label-has-associated-control */
import {
  ComponentProps,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CalendarCheck,
  CalendarClock,
  Database,
  Gem,
  History,
  ListChecks,
  PencilLine,
  Play,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react';
import AppMenuPortal from 'renderer/components/AppMenuPortal';
import AutomationControlCard from 'renderer/components/autoResearch/AutomationControlCard';
import CareerTab from 'renderer/components/autoResearch/CareerTab';
import HistoryTab from 'renderer/components/autoResearch/HistoryTab';
import ProgressTab from 'renderer/components/autoResearch/ProgressTab';
import RunTargetInput from 'renderer/components/autoResearch/RunTargetInput';
import {
  characterIconPath,
  umaSkinIconPath,
} from 'renderer/components/autoResearch/SelectionCards';
import {
  buildOfflinePrioritySkillArray,
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
  fileToBase64,
  normalizeOnlineScenarioId,
  normalizeServer,
  parentViewerIdFromSelection,
} from 'renderer/components/autoResearch/shared';
import {
  CareerSessionRecord,
  CareerSetting,
  CloudCareerConfig,
  CloudConfigurationResponse,
  Dashboard,
  HostedControlResponse,
  RaceOption,
  RunnerStats,
  RunMode,
  ScheduleGoal,
  ScheduleIntent,
  ScheduleItem,
  ScheduleTiming,
  SessionResponse,
} from 'renderer/components/autoResearch/types';
import autoResearchCatalog from '../../assets/data/auto_research_catalog.json';

const SERVER_KEY = 'autouma.web.server';
const ACCOUNT_KEY = 'autouma.web.accountId';

type WebTab = 'career' | 'history';
type CareerHistoryResponse = {
  success: boolean;
  reports: CareerSessionRecord[];
};
type RunnableCloudConfig = CloudCareerConfig & {
  payload: CloudCareerConfig['payload'] & { setting: CareerSetting };
};
type ImportedAccount = {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
};

const races = autoResearchCatalog.races as RaceOption[];
const noop = () => undefined;
const noopAsync = async () => undefined;

const emptyDashboard: Dashboard = {
  account: {
    tp: { current: 0, max: 0 },
    carrots: { total: 0 },
    gold: 0,
    clocks: 0,
    energy_drinks: 0,
  },
  offline_scenarios: [],
  umas: [],
  supports: [],
  decks: [],
  parents: [],
  friends: [],
  friend_exclude_ids: [],
};

const isScheduledDateTime = (value?: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(value || ''));

const defaultScheduledDateTime = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function errorMessage(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return String(
    record.detail || record.message || record.error || record.reason || '',
  );
}

function isMissingHostedTask(value: unknown) {
  const message = String((value as Error)?.message || value || '');
  return (
    message.includes('服务端没有该账号正在运行的托管任务') ||
    message.includes('服务端没有该账号正在运行的养马实例')
  );
}

async function serverRequest<T>(
  serverAddress: string,
  path: string,
  init?: RequestInit,
) {
  let response: Response;
  try {
    response = await fetch(`${serverAddress}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
  } catch (caught) {
    if (
      window.location.protocol === 'https:' &&
      serverAddress.startsWith('http:')
    ) {
      throw new Error(
        '当前网页是 HTTPS，但 UAR 地址是 HTTP，浏览器会阻止混合内容。请用 HTTP 打开本页面，或给 UAR 配置 HTTPS。',
      );
    }
    throw new Error(`无法连接 UAR：${String((caught as Error)?.message || caught)}`);
  }
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }
  if (!response.ok || (payload as { success?: boolean })?.success === false) {
    throw new Error(errorMessage(payload) || `UAR 返回 HTTP ${response.status}`);
  }
  return payload as T;
}

function runnableConfigs(configs: CloudCareerConfig[]) {
  return configs.filter(
    (config): config is RunnableCloudConfig => Boolean(config.payload?.setting),
  );
}

function buildScheduleItem(
  config: RunnableCloudConfig,
  goal: ScheduleGoal,
  target: number,
): ScheduleItem {
  const setting = config.payload.setting;
  const preset = config.payload.preset || {};
  const offline = setting.mode === 'offline';
  if (!offline && !config.payload.preset) {
    throw new Error(`详设“${config.name}”没有包含绑定预设，无法启动`);
  }
  if (offline && !setting.offline_race_deck_num) {
    throw new Error(`离线详设“${config.name}”尚未选择游戏赛程槽位`);
  }
  return {
    id: `web-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    career_setting_id: config.config_id,
    career_setting_name: config.name,
    career_mode: offline ? 'offline' : 'online',
    goal,
    target: ['count', 'jewel_drops'].includes(goal)
      ? Math.max(1, Math.min(goal === 'jewel_drops' ? 20 : 100, target))
      : 1,
    max_steps: Math.max(1, Number(setting.max_steps || 2500)),
    burn_clocks: Boolean(setting.burn_clocks),
    clock_use_limit: Math.max(1, Number(setting.clock_use_limit || 1)),
    preset,
    request: {
      career_config: setting,
      card_id: Number(setting.card_id || 0),
      support_card_ids: setting.support_card_ids || [],
      friend_viewer_id: 0,
      friend_card_id: Number(setting.friend_card_id || 0),
      parent_id_1: Number(setting.parent_id_1 || 0),
      parent_id_2: Number(setting.parent_id_2 || 0),
      parent_1_viewer_id: parentViewerIdFromSelection(setting.parent_key_1),
      parent_2_viewer_id: parentViewerIdFromSelection(setting.parent_key_2),
      scenario_id: offline
        ? Number(setting.offline_scenario_id || setting.scenario_id || 0)
        : normalizeOnlineScenarioId(
            config.payload.preset?.scenario_id || setting.scenario_id,
          ),
      deck_id: Number(setting.deck_id || 1),
      use_tp: offline ? 15 : 30,
      recover_tp_with_item: Boolean(setting.recover_tp_with_item),
      recover_tp_with_jewels: Boolean(setting.recover_tp_with_jewels),
      preset_name: setting.preset_name || config.payload.preset?.name || '',
      running_style: offline ? Number(setting.running_style || 0) : 0,
      priority_skill_array: buildOfflinePrioritySkillArray(
        setting.offline_priority_skill_ids || [],
      ),
      offline_skill_settings:
        setting.offline_skill_settings || createDefaultOfflineSkillSettings(),
      factor_selection:
        setting.factor_selection ||
        setting.offline_factor_selection ||
        createDefaultOfflineFactorSelection(),
      race_deck_num: Number(setting.offline_race_deck_num || 0),
    },
  };
}

export default function WebAutoUma() {
  const [activeTab, setActiveTab] = useState<WebTab>('career');
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem(SERVER_KEY) || 'http://127.0.0.1:18765',
  );
  const [accounts, setAccounts] = useState<ImportedAccount[]>([]);
  const [manualUid, setManualUid] = useState('');
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => localStorage.getItem(ACCOUNT_KEY) || '',
  );
  const [editingAccountId, setEditingAccountId] = useState('');
  const [accountAliasDraft, setAccountAliasDraft] = useState('');
  const [dragging, setDragging] = useState(false);
  const [server, setServer] = useState('');
  const [connectedAccountId, setConnectedAccountId] = useState('');
  const [connectedUid, setConnectedUid] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loginSettingsOpen, setLoginSettingsOpen] = useState(true);
  const [cloudConfigs, setCloudConfigs] = useState<CloudCareerConfig[]>([]);
  const [careerHistory, setCareerHistory] = useState<CareerSessionRecord[]>([]);
  const [selectedCareerRecords, setSelectedCareerRecords] = useState<
    CareerSessionRecord[] | null
  >(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [runConfig, setRunConfig] = useState<RunnableCloudConfig | null>(null);
  const [runMode, setRunMode] = useState<RunMode>('single');
  const [runCountTarget, setRunCountTarget] = useState(3);
  const [jewelDropTarget, setJewelDropTarget] = useState(20);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [scheduleTiming, setScheduleTiming] =
    useState<ScheduleTiming>('now');
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('05:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('05:00');

  useEffect(() => {
    window.electron.autoResearch
      .accounts()
      .then((value) => {
        const imported = (value || []) as ImportedAccount[];
        setAccounts(imported);
        setSelectedAccountId((current) =>
          imported.some((account) => account.id === current)
            ? current
            : imported[0]?.id || '',
        );
        return value;
      })
      .catch((caught) =>
        setError(String((caught as Error)?.message || caught)),
      );
  }, []);

  const configs = useMemo(() => runnableConfigs(cloudConfigs), [cloudConfigs]);
  const connectedAccount = accounts.find(
    (account) => account.id === connectedAccountId,
  );
  const editingAccount = useMemo(
    () => accounts.find((account) => account.id === editingAccountId),
    [accounts, editingAccountId],
  );
  const careerSettings = useMemo(
    () =>
      configs.map((config) => ({
        ...config.payload.setting,
        id: config.config_id,
        name: config.name,
        account_uid: connectedUid,
        updated_at:
          config.updated_at || config.payload.setting.updated_at || '',
      })),
    [configs, connectedUid],
  );
  const presets = useMemo(
    () =>
      configs.flatMap((config) =>
        config.payload.preset ? [config.payload.preset] : [],
      ),
    [configs],
  );
  const dashboard = useMemo<Dashboard>(() => {
    if (session?.dashboard) {
      return {
        ...emptyDashboard,
        ...session.dashboard,
        account: {
          ...emptyDashboard.account,
          ...(session.dashboard.account || {}),
        },
        offline_scenarios: session.dashboard.offline_scenarios || [],
        umas: session.dashboard.umas || [],
        supports: session.dashboard.supports || [],
        decks: session.dashboard.decks || [],
        parents: session.dashboard.parents || [],
        friends: session.dashboard.friends || [],
        friend_exclude_ids: session.dashboard.friend_exclude_ids || [],
      };
    }
    const account = session?.runtime?.account || session?.account;
    return account ? { ...emptyDashboard, account } : emptyDashboard;
  }, [session]);
  const automation = session?.runtime?.automation || session?.automation;
  const schedule = automation?.schedule;
  const observation = automation?.observation;
  const runner = observation?.runner;
  const automationActive = Boolean(schedule);
  const runnerStopping = Boolean(
    runner?.stopping || busy === 'pause' || busy === 'stop',
  );
  const runnerPaused = Boolean(schedule?.paused);
  const currentScheduleItem =
    schedule?.items[Math.max(0, observation?.current_index ?? 0)] ||
    schedule?.items[0];
  const activeAutomationSetting = careerSettings.find(
    (setting) => setting.id === currentScheduleItem?.career_setting_id,
  );
  const offlinePlanActive = currentScheduleItem?.career_mode === 'offline';
  const currentScheduleCardId = Number(
    currentScheduleItem?.request?.card_id ||
      activeAutomationSetting?.card_id ||
      runner?.card_id ||
      0,
  );
  const currentCareerUma = dashboard.umas.find(
    (uma) => uma.id === currentScheduleCardId,
  );
  const activeCareerIconPath = currentScheduleCardId
    ? umaSkinIconPath(
        currentScheduleCardId,
        currentCareerUma?.rarity || 0,
        currentCareerUma?.race_cloth_id || 0,
      )
    : undefined;
  const activeCareerFallbackIconPath = currentScheduleCardId
    ? characterIconPath(currentScheduleCardId)
    : undefined;
  const currentRunnerStats: RunnerStats =
    runner?.current_stats || runner?.action_history?.at(-1)?.stats || {};
  const remainingJewelDrops = Math.max(
    0,
    (runner?.daily_jewel_drop_limit || 20) -
      (observation?.daily_jewel_drops || 0),
  );

  useEffect(() => {
    if (!schedule) return;
    const item =
      schedule.items[Math.max(0, observation?.current_index ?? 0)] ||
      schedule.items[0];
    if (item?.goal) setRunMode(item.goal);
    if (item?.goal === 'count') setRunCountTarget(item.target);
    if (item?.goal === 'jewel_drops') setJewelDropTarget(item.target);
    const daily = schedule.cadence === 'daily';
    setRepeatDaily(daily);
    setScheduleStartTime(schedule.start_time || '05:00');
    setScheduleEndTime(schedule.end_time || '05:00');
    const delayed = !daily && isScheduledDateTime(schedule.start_time);
    setScheduleTiming(delayed ? 'scheduled' : 'now');
    setScheduledStartAt(delayed ? schedule.start_time.slice(0, 16) : '');
  }, [observation?.current_index, schedule]);

  const loadCloudData = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedServer = normalizeServer(serverAddress);
    if (!selectedAccountId) {
      setError('请先导入 users.db 并选择 UID');
      return;
    }
    setBusy('cloud-config-pull');
    setError('');
    setSuccessMessage('');
    try {
      const credential = (await window.electron.autoResearch.credential(
        selectedAccountId,
      )) as { uid: string; accessKey: string };
      setSessionToken('');
      setSession(null);
      let attached: HostedControlResponse | null = null;
      try {
        attached = await serverRequest<HostedControlResponse>(
          normalizedServer,
          '/api/auth/attach',
          {
            method: 'POST',
            body: JSON.stringify({
              uid: credential.uid,
              access_key: credential.accessKey,
            }),
          },
        );
      } catch (caught) {
        if (!isMissingHostedTask(caught)) throw caught;
      }

      const enterAccount = () => {
        setServer(normalizedServer);
        setConnectedAccountId(selectedAccountId);
        setConnectedUid(credential.uid);
        setServerAddress(normalizedServer);
        setLoginSettingsOpen(false);
        localStorage.setItem(SERVER_KEY, normalizedServer);
        localStorage.setItem(ACCOUNT_KEY, selectedAccountId);
      };

      if (attached) {
        setSession(attached);
        setSessionToken(attached.token || '');
        enterAccount();
      }

      const [configurationResult, historyResult] = await Promise.allSettled([
        serverRequest<CloudConfigurationResponse>(
          normalizedServer,
          '/api/account/configuration/query',
          {
            method: 'POST',
            body: JSON.stringify({
              uid: credential.uid,
              access_key: credential.accessKey,
            }),
          },
        ),
        serverRequest<CareerHistoryResponse>(
          normalizedServer,
          '/api/account/career/history/query',
          {
            method: 'POST',
            body: JSON.stringify({ uid: credential.uid }),
          },
        ),
      ]);

      if (configurationResult.status === 'fulfilled') {
        setCloudConfigs(configurationResult.value.career_configs || []);
      } else if (!attached) {
        throw configurationResult.reason;
      }
      if (historyResult.status === 'fulfilled') {
        setCareerHistory(historyResult.value.reports || []);
      }
      setSelectedCareerRecords(null);
      if (!attached) enterAccount();
      if (
        attached &&
        (configurationResult.status === 'rejected' ||
          historyResult.status === 'rejected')
      ) {
        setError('已进入正在运行的养马；部分云端详设或记录暂时加载失败');
      } else if (historyResult.status === 'rejected') {
        setError('云端详设已加载，但养马记录暂时加载失败');
      }
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const importUsersDb = async (file: File) => {
    setBusy('users-db');
    setError('');
    try {
      const content = await fileToBase64(file);
      const value = await window.electron.autoResearch.importUsersDb(content);
      const imported = (value || []) as ImportedAccount[];
      setAccounts(imported);
      const nextAccountId = imported[0]?.id || '';
      setSelectedAccountId(nextAccountId);
      if (nextAccountId) localStorage.setItem(ACCOUNT_KEY, nextAccountId);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
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

  const addManualAccount = async () => {
    const uid = manualUid.trim();
    const accessKey = manualAccessKey.trim();
    if (!uid || !accessKey) {
      setError('请填写 uid 和 access_key');
      return;
    }
    setBusy('manual-account');
    setError('');
    setSuccessMessage('');
    try {
      await window.electron.autoResearch.saveAccounts([
        {
          uid,
          accessKey,
          source: '手动填写',
          capturedAt: new Date().toISOString(),
        },
      ]);
      const updated = (await window.electron.autoResearch.accounts()) as
        | ImportedAccount[]
        | undefined;
      const nextAccounts = updated || [];
      const added = nextAccounts.find((account) => account.uid === uid);
      setAccounts(nextAccounts);
      if (added) {
        setSelectedAccountId(added.id);
        localStorage.setItem(ACCOUNT_KEY, added.id);
      }
      setManualUid('');
      setManualAccessKey('');
      setSuccessMessage(`已添加账号 ${uid}`);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const openAccountAliasEditor = (account: ImportedAccount) => {
    setEditingAccountId(account.id);
    setAccountAliasDraft(account.label || '');
    setError('');
  };

  const saveAccountAlias = async (label = accountAliasDraft) => {
    if (!editingAccount) return;
    const nextLabel = label.trim();
    if (nextLabel.length > 40) {
      setError('账号别名不能超过 40 个字符');
      return;
    }
    setBusy(`rename-${editingAccount.id}`);
    setError('');
    setSuccessMessage('');
    try {
      await window.electron.autoResearch.renameAccount(
        editingAccount.id,
        nextLabel,
      );
      const updated = (await window.electron.autoResearch.accounts()) as
        | ImportedAccount[]
        | undefined;
      setAccounts(updated || []);
      setEditingAccountId('');
      setAccountAliasDraft('');
      setSuccessMessage(
        nextLabel ? `账号别名已修改为“${nextLabel}”` : '账号别名已清除',
      );
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const refreshHistory = async () => {
    if (!server || !connectedUid) {
      setLoginSettingsOpen(true);
      return;
    }
    setBusy('history');
    setError('');
    try {
      const result = await serverRequest<CareerHistoryResponse>(
        server,
        '/api/account/career/history/query',
        {
          method: 'POST',
          body: JSON.stringify({ uid: connectedUid }),
        },
      );
      setCareerHistory(result.reports || []);
      setSelectedCareerRecords(null);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const commitHostedSession = (next: SessionResponse) => {
    setSession((current) => {
      const nextRuntimeAutomation =
        next.runtime?.automation || next.automation;
      const nextRuntimeAccount =
        next.runtime?.account !== undefined
          ? next.runtime.account
          : next.account !== undefined
            ? next.account
            : current?.runtime?.account;
      return {
        ...(current || { success: true }),
        ...next,
        dashboard: next.dashboard || current?.dashboard,
        runtime: {
          ...(current?.runtime || {}),
          ...(next.runtime || {}),
          automation:
            nextRuntimeAutomation || current?.runtime?.automation,
          account: nextRuntimeAccount,
        },
      };
    });
  };

  const hostedRequest = async <T,>(path: string, init?: RequestInit) => {
    if (!server || !sessionToken) {
      throw new Error('当前账号尚未连接到 UAR 运行实例');
    }
    return serverRequest<T>(server, path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${sessionToken}`,
      },
    });
  };

  const updateRunningAutomation = async () => {
    if (!schedule?.revision) {
      setError('当前计划尚未同步完成，请稍后重试');
      return;
    }
    if (
      !repeatDaily &&
      scheduleTiming === 'scheduled' &&
      (!isScheduledDateTime(scheduledStartAt) ||
        new Date(scheduledStartAt).getTime() <= Date.now())
    ) {
      setError('请选择晚于当前时间的定时启动日期和时间');
      return;
    }
    const goal = runMode === 'queue' ? 'single' : runMode;
    const target =
      goal === 'count'
        ? Math.max(1, runCountTarget)
        : goal === 'jewel_drops'
          ? Math.max(1, jewelDropTarget)
          : 1;
    const currentIndex = Math.max(0, observation?.current_index ?? 0);
    setBusy('update-schedule');
    setError('');
    try {
      const result = await hostedRequest<SessionResponse>(
        '/api/account/career/schedule',
        {
          method: 'PUT',
          body: JSON.stringify({
            cadence: repeatDaily ? 'daily' : 'once',
            start_time: repeatDaily
              ? scheduleStartTime
              : scheduleTiming === 'scheduled'
                ? `${scheduledStartAt}:00+08:00`
                : '05:00',
            end_time: scheduleEndTime,
            daily_tasks: schedule.daily_tasks,
            items: schedule.items.map((item, index) =>
              index === currentIndex ? { ...item, goal, target } : item,
            ),
            expected_revision: schedule.revision,
          }),
        },
      );
      commitHostedSession(result);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const setCareerPlanPaused = async (paused: boolean) => {
    setBusy(paused ? 'pause' : 'resume');
    setError('');
    try {
      const result = await hostedRequest<SessionResponse>(
        '/api/account/career/schedule',
        {
          method: 'PATCH',
          body: JSON.stringify({ paused }),
        },
      );
      commitHostedSession(result);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const closeCareerPlan = async () => {
    if (!window.confirm('确定关闭当前计划吗？游戏中的当前育成不会被放弃。')) {
      return;
    }
    setBusy('stop');
    setError('');
    try {
      const result = await hostedRequest<SessionResponse>(
        '/api/account/career/schedule',
        { method: 'DELETE' },
      );
      commitHostedSession(result);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!automationActive || !server || !sessionToken) return undefined;
    let cancelled = false;
    let retryDelay = 1000;
    let controller: AbortController | null = null;
    const handleStreamLine = (line: string) => {
      if (cancelled || !line.trim()) return;
      try {
        const event = JSON.parse(line) as {
          automation?: SessionResponse['automation'];
          account?: SessionResponse['account'];
        };
        if (!event.automation) return;
        retryDelay = 1000;
        setSession((current) => ({
          ...(current || { success: true }),
          automation: event.automation,
          dashboard:
            event.account !== undefined && event.account
              ? {
                  ...(current?.dashboard || emptyDashboard),
                  account: event.account,
                }
              : current?.dashboard,
          runtime: {
            ...(current?.runtime || {}),
            automation: event.automation,
            account:
              event.account !== undefined
                ? event.account
                : current?.runtime?.account,
          },
        }));
      } catch {
        // Ignore incomplete stream records and continue with the next line.
      }
    };
    const connect = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const response = await fetch(
            `${server}/api/account/career/schedule/stream`,
            {
              headers: { Authorization: `Bearer ${sessionToken}` },
              signal: controller.signal,
            },
          );
          if (!response.ok || !response.body) {
            throw new Error(`schedule stream HTTP ${response.status}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            const lines = `${buffer}${decoder.decode(value, { stream: true })}`.split(
              '\n',
            );
            buffer = lines.pop() || '';
            lines.forEach(handleStreamLine);
          }
        } catch (caught) {
          if ((caught as Error)?.name === 'AbortError' || cancelled) return;
        }
        if (!cancelled) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, retryDelay);
          });
          retryDelay = Math.min(retryDelay * 2, 8000);
        }
      }
    };
    connect().catch(() => undefined);
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [automationActive, server, sessionToken]);

  const openRunDialog = (settingId: string) => {
    const config = configs.find((item) => item.config_id === settingId);
    if (!config) return;
    setRunConfig(config);
    setRunMode('single');
    setRepeatDaily(false);
    setScheduleTiming('now');
    setScheduledStartAt('');
    setError('');
  };

  const confirmRunPlan = async () => {
    if (!runConfig || !server || !connectedUid || !connectedAccountId) return;
    if (
      !repeatDaily &&
      scheduleTiming === 'scheduled' &&
      (!isScheduledDateTime(scheduledStartAt) ||
        new Date(scheduledStartAt).getTime() <= Date.now())
    ) {
      setError('请选择晚于当前时间的定时启动日期和时间');
      return;
    }
    const goal = runMode === 'queue' ? 'single' : runMode;
    const target =
      goal === 'count'
        ? runCountTarget
        : goal === 'jewel_drops'
          ? jewelDropTarget
          : 1;
    setBusy(`run:${runConfig.config_id}`);
    setError('');
    setSuccessMessage('');
    try {
      const credential = (await window.electron.autoResearch.credential(
        connectedAccountId,
      )) as { uid: string; accessKey: string };
      const item = buildScheduleItem(runConfig, goal, target);
      const schedule: ScheduleIntent = {
        cadence: repeatDaily ? 'daily' : 'once',
        start_time: repeatDaily
          ? scheduleStartTime
          : scheduleTiming === 'scheduled'
            ? `${scheduledStartAt}:00+08:00`
            : '05:00',
        end_time: scheduleEndTime,
        items: [item],
      };
      const submitted = await serverRequest<HostedControlResponse>(
        server,
        '/api/tasks/schedule',
        {
          method: 'POST',
          body: JSON.stringify({
            uid: credential.uid,
            access_key: credential.accessKey,
            schedule,
          }),
        },
      );
      setSession(submitted);
      setSessionToken(submitted.token || '');
      setSuccessMessage(`已将“${runConfig.name}”提交到 UAR`);
      setRunConfig(null);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const careerTabProps = {
    dashboard,
    careerSaveOpen: false,
    accountCareerSettings: careerSettings,
    matchingCareerSettings: [],
    applyCareerSetting: noop,
    editPresetForCareerSetting: noop,
    continueWithSetting: openRunDialog,
    deleteCareerSetting: noop,
    uploadCareerSetting: noopAsync,
    pullCloudConfiguration: loadCloudData,
    cloudCareerConfigIds: new Set(configs.map((config) => config.config_id)),
    newCareerSaveName: '',
    setNewCareerSaveName: noop,
    createCareerSave: noop,
    automationActive,
    busy,
    activeCareer: dashboard.account.career || undefined,
    activeCareerIconPath,
    abandonCareer: noopAsync,
    continuingCurrentCareer: false,
    canContinueCurrentCareer: false,
    saveCareerSetting: () => false,
    saveAndApplyCareerSetting: noopAsync,
    saveAndRunCareer: noop,
    careerPresetName: '',
    newCareerPresetName: '',
    setNewCareerPresetName: noop,
    newCareerMode: 'online',
    setNewCareerMode: noop,
    editCareerPreset: noop,
    closeCareerEditor: noop,
    presets,
    selectedUma: undefined,
    cardId: 0,
    setCardId: noop,
    selectedParent1: undefined,
    selectedParent2: undefined,
    parent1: '',
    parent2: '',
    setParent1: noop,
    setParent2: noop,
    deckId: 0,
    setDeckId: noop,
    setSupportCardIds: noop,
    selectedDeckCharaIds: [],
    supportSearch: '',
    setSupportSearch: noop,
    friendCardId: 0,
    setFriendCardId: noop,
    selectedFriendSupport: undefined,
    visibleFriendSupports: [],
    availableFriendSupportIds: new Set<number>(),
    burnClocks: false,
    setBurnClocks: noop,
    clockUseLimit: 1,
    setClockUseLimit: noop,
    recoverTpWithItem: false,
    setRecoverTpWithItem: noop,
    recoverTpWithJewels: false,
    setRecoverTpWithJewels: noop,
    selectionConflict: '',
    refreshOptionsIndex: noopAsync,
    renameCareerSetting: noop,
    selectedAccountId: connectedUid,
    careerMode: 'online',
    offlineSetup: null,
    offlineScenarios: [],
    offlineScenarioId: 0,
    changeOfflineScenario: noop,
    offlineRunningStyle: 0,
    setOfflineRunningStyle: noop,
    offlineRaceDeckNum: 0,
    setOfflineRaceDeckNum: noop,
    resetOfflineCareer: noop,
    prepareOfflineCareer: async () => null,
    saveOfflineRaceDeck: async () => false,
    races,
    skills: [],
    offlineFactorSelection: createDefaultOfflineFactorSelection(),
    setOfflineFactorSelection: noop,
    offlinePrioritySkillIds: [],
    setOfflinePrioritySkillIds: noop,
    offlineSkillSettings: createDefaultOfflineSkillSettings(),
    setOfflineSkillSettings: noop,
  } as ComponentProps<typeof CareerTab>;

  const tabs = [
    { id: 'career' as const, label: '养马详设', icon: Settings2 },
    { id: 'history' as const, label: '养马记录', icon: History },
  ];

  return (
    <div
      className={`autoResearchPage h-full min-h-0 overflow-hidden bg-transparent px-4 text-gray-800 xl:px-6 ${
        activeTab === 'career' ? 'autoResearchCareerPage' : ''
      }`}
    >
      <style>
        {`
          .autoResearchMobileTabs { display: none; }
          @media (max-width: 639px) {
            html[data-autouma] .autoResearchPage { padding-right: .75rem; padding-left: .75rem; }
            html[data-autouma] .autoResearchDesktopTabs { display: none; }
            html[data-autouma] .autoResearchHeaderServer,
            html[data-autouma] .autoResearchHeaderActionLabel { display: none; }
            html[data-autouma] .autoResearchContentGrid {
              margin-top: 0; padding-top: .75rem;
              padding-bottom: 4.5rem;
            }
            html[data-autouma] .autoResearchCareerPage,
            html[data-autouma] .autoResearchCareerPage .autoResearchContentGrid,
            html[data-autouma] .autoResearchCareerPage .autoResearchContentGrid > *,
            html[data-autouma] .autoResearchCareerPage article {
              width: 100%; min-width: 0; max-width: 100%;
            }
            html[data-autouma] .autoResearchCareerPage {
              overflow-x: hidden; touch-action: pan-y;
            }
            html[data-autouma] .autoResearchCareerPage .autoResearchContentGrid {
              overflow-x: hidden;
            }
            html[data-autouma] .autoResearchCareerPage article {
              overflow: hidden;
            }
            html[data-autouma] .autoResearchMobileTabs {
              position: fixed; right: 0; bottom: 0; left: 0; z-index: 120;
              display: grid; grid-template-columns: repeat(2,minmax(0,1fr));
              min-height: calc(4rem + var(--autouma-safe-bottom));
              padding: .375rem calc(.5rem + var(--autouma-safe-right))
                calc(.375rem + var(--autouma-safe-bottom))
                calc(.5rem + var(--autouma-safe-left));
              border-top: 1px solid rgba(226,232,240,.96);
              background: rgba(255,255,255,.96);
              box-shadow: 0 -8px 24px rgba(15,23,42,.08);
              backdrop-filter: blur(18px);
            }
            html[data-autouma] .autoResearchMobileTab {
              display: flex; min-height: 3.25rem; flex-direction: column;
              align-items: center; justify-content: center; gap: .1875rem;
              border-radius: .75rem; color: #64748b; font-size: .6875rem; font-weight: 600;
            }
            html[data-autouma] .autoResearchMobileTab[aria-current='page'] {
              background: #eef2ff; color: #4f46e5;
            }
            html[data-autouma] .autoResearchCloudPullAction {
              position: fixed; z-index: 125;
              right: calc(.875rem + var(--autouma-safe-right));
              bottom: calc(4.75rem + var(--autouma-safe-bottom));
              width: 3.5rem; height: 3.5rem; justify-content: center;
              padding: 0; border: 0; border-radius: 9999px;
              background: #4f46e5; color: white;
              box-shadow: 0 .75rem 1.75rem rgba(79,70,229,.32);
            }
            html[data-autouma] .autoResearchCloudPullAction:hover {
              border: 0; background: #4338ca; color: white;
            }
            html[data-autouma] .autoResearchCloudPullAction:active {
              transform: scale(.94);
            }
            html[data-autouma] .autoResearchCloudPullAction svg {
              width: 1.375rem; height: 1.375rem;
            }
            html[data-autouma] .autoResearchMobileFabLabel { display: none; }
          }
        `}
      </style>

      <AppMenuPortal>
        <div className="autoResearchHeaderActions flex min-w-0 items-center gap-1.5">
          <span
            className="autoResearchHeaderServer max-w-44 truncate text-[11px] text-slate-400"
            title={server || '未连接服务器'}
          >
            {server || '未选择服务器'}
          </span>
          <button
            type="button"
            onClick={() => setLoginSettingsOpen(true)}
            className="autoResearchHeaderAction flex h-7 items-center gap-1 whitespace-nowrap rounded-md bg-indigo-600 px-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <Users size={15} />
            <span className="autoResearchHeaderActionLabel">
              {connectedUid
                ? connectedAccount?.label || `UID ${connectedUid}`
                : '账号与服务器'}
            </span>
          </button>
          {server ? (
            <button
              type="button"
              onClick={() =>
                activeTab === 'history' ? refreshHistory() : loadCloudData()
              }
              disabled={Boolean(busy)}
              className="autoResearchHeaderAction flex h-7 items-center gap-1 rounded-md px-2 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
              <span className="autoResearchHeaderActionLabel">刷新</span>
            </button>
          ) : null}
        </div>
      </AppMenuPortal>

      <AppMenuPortal targetId="app-page-tabs">
        <nav className="autoResearchDesktopTabs pointer-events-none px-3 pb-2.5 pt-1.5">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur-xl">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <IconComponent size={15} /> {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </AppMenuPortal>

      {error ? (
        <div className="fixed right-4 top-14 z-[2000] max-w-lg rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-xl">
          {error}
        </div>
      ) : null}
      {successMessage ? (
        <div className="fixed right-4 top-14 z-[2000] max-w-lg rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-700 shadow-xl">
          {successMessage}
        </div>
      ) : null}

      <div className="mx-auto flex h-full min-h-0 max-w-none flex-col">
        <div className="autoResearchContentGrid mt-14 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-5">
          {!server ? (
            <section className="flex min-h-full flex-col items-center justify-center p-8 text-center">
              <Users size={42} className="text-slate-300" />
              <h2 className="mt-4 font-bold text-slate-800">
                请选择账号与自动育成服务器
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                纯 Web 版只读取云端详设和养马记录，不执行本地游戏登录。
              </p>
              <button
                type="button"
                onClick={() => setLoginSettingsOpen(true)}
                className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                账号与服务器
              </button>
            </section>
          ) : activeTab === 'career' ? (
            automationActive ? (
              <div className="space-y-4">
                <AutomationControlCard
                  readOnly
                  automation={automation}
                  runnerStopping={runnerStopping}
                  runnerPaused={runnerPaused}
                  busy={busy}
                  runMode={runMode}
                  setRunMode={setRunMode}
                  runCountTarget={runCountTarget}
                  setRunCountTarget={setRunCountTarget}
                  jewelDropTarget={jewelDropTarget}
                  setJewelDropTarget={setJewelDropTarget}
                  remainingJewelDrops={remainingJewelDrops}
                  repeatDaily={repeatDaily}
                  scheduleStartTime={scheduleStartTime}
                  setScheduleStartTime={setScheduleStartTime}
                  scheduleEndTime={scheduleEndTime}
                  setScheduleEndTime={setScheduleEndTime}
                  scheduleTiming={scheduleTiming}
                  setScheduleTiming={setScheduleTiming}
                  scheduledStartAt={scheduledStartAt}
                  setScheduledStartAt={setScheduledStartAt}
                  runDailyTasksWithCareer={Boolean(schedule?.daily_tasks)}
                  updateRunningAutomation={updateRunningAutomation}
                  pauseCareer={() => setCareerPlanPaused(true)}
                  resumeCareer={() => setCareerPlanPaused(false)}
                  closeCareerPlan={closeCareerPlan}
                  activeSetting={activeAutomationSetting}
                  editPreset={noop}
                  canAppendCareerPlan={false}
                  openAppendCareerPlan={noop}
                />
                <div id="career-progress" className="scroll-mt-28">
                  <ProgressTab
                    currentCareerActive
                    activeCareerIconPath={activeCareerIconPath}
                    activeCareerFallbackIconPath={
                      activeCareerFallbackIconPath
                    }
                    activeCareer={dashboard.account.career || undefined}
                    currentCareerUma={currentCareerUma}
                    runner={runner}
                    runnerStopping={runnerStopping}
                    runnerPaused={runnerPaused}
                    automationActive={automationActive}
                    currentRunnerStats={currentRunnerStats}
                    busy={busy}
                    activeSetting={activeAutomationSetting}
                    automation={automation}
                    offlineMode={offlinePlanActive}
                    serverHostedMode
                    idleSingleMode={dashboard.account.idle_single_mode}
                    abandonCareer={noopAsync}
                  />
                </div>
              </div>
            ) : (
              <CareerTab {...careerTabProps} readOnly />
            )
          ) : (
            <HistoryTab
              readOnly
              selectedCareerRecords={selectedCareerRecords}
              setSelectedCareerRecords={setSelectedCareerRecords}
              busy={busy}
              loadCareerHistory={async () => refreshHistory()}
              selectedAccountId={connectedUid}
              accountCareerSettings={careerSettings}
              careerHistory={careerHistory}
              downloadCareerSetting={noopAsync}
              deleteCareerHistory={noopAsync}
              downloadTrainingHistory={noopAsync}
              localTrainingHistoryIds={new Set()}
              openTrainingHistory={noop}
              races={races}
            />
          )}
        </div>
      </div>

      <nav className="autoResearchMobileTabs" aria-label="自动育成设置">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className="autoResearchMobileTab"
            >
              <IconComponent size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {loginSettingsOpen ? (
        <div className="autoResearchAccountOverlay successionPickerCompactOverlay successionPickerTheme successionPickerOverlay z-[60]">
          <form
            className="successionPickerDialog w-full max-w-lg"
            onSubmit={loadCloudData}
          >
            <div className="plannerDialogHeaderBlock">
              <h3 className="text-lg font-bold text-slate-900">
                账号与自动育成服务器
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                这里只连接 UAR，不会在当前设备登录游戏。
              </p>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-medium text-slate-700">
                UAR 地址
                <input
                  value={serverAddress}
                  onChange={(event) => setServerAddress(event.target.value)}
                  placeholder="http://127.0.0.1:18765"
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
                  dragging
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <Database className="mx-auto text-slate-400" size={24} />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  导入 users.db
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  会自动读取其中的 UID 和 access_key
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  {busy === 'users-db' ? '正在导入…' : '选择 users.db'}
                  <input
                    type="file"
                    accept=".db,application/x-sqlite3"
                    className="hidden"
                    disabled={busy === 'users-db'}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) importUsersDb(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              <details className="group rounded-lg border border-slate-200 bg-white">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium text-slate-700 marker:content-none">
                  <span>手动添加账号</span>
                  <span className="text-[10px] font-normal text-slate-400 group-open:hidden">
                    UID + access_key
                  </span>
                  <span className="hidden text-[10px] font-normal text-slate-400 group-open:inline">
                    收起
                  </span>
                </summary>
                <div className="grid gap-1.5 border-t border-slate-100 p-2.5 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={manualUid}
                    onChange={(event) => setManualUid(event.target.value)}
                    placeholder="uid"
                    inputMode="numeric"
                    className="min-h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <input
                    value={manualAccessKey}
                    onChange={(event) =>
                      setManualAccessKey(event.target.value)
                    }
                    placeholder="access_key"
                    type="password"
                    className="min-h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => addManualAccount().catch(() => undefined)}
                    disabled={Boolean(busy)}
                    className="min-h-9 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy === 'manual-account' ? '添加中…' : '添加账号'}
                  </button>
                </div>
              </details>
              <section>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    游戏账号
                  </span>
                  <span className="text-xs text-slate-400">
                    {accounts.length} 个
                  </span>
                </div>
                <div className="mt-2 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-0.5 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className={`rounded-lg border px-2.5 py-2 transition-colors ${
                        selectedAccountId === account.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAccountId(account.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {account.label || `UID ${account.uid}`}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">
                            {account.uid} · {account.accessKeyPreview}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAccountAliasEditor(account)}
                          disabled={Boolean(busy)}
                          aria-label={`修改${account.label || `UID ${account.uid}`}的别名`}
                          title="修改账号别名"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <PencilLine size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!accounts.length ? (
                    <p className="col-span-full rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                      请先在上方导入 users.db
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
            <div className="successionPickerFooter flex justify-end gap-2">
              {server ? (
                <button
                  type="button"
                  onClick={() => setLoginSettingsOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
                >
                  取消
                </button>
              ) : null}
              <button
                type="submit"
                disabled={Boolean(busy) || !selectedAccountId}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
                连接并读取
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingAccount ? (
        <div className="successionPickerTheme successionPickerOverlay z-[70]">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="web-autouma-account-alias-title"
            className="successionPickerDialog w-full max-w-md"
            onSubmit={(event) => {
              event.preventDefault();
              saveAccountAlias().catch(() => undefined);
            }}
          >
            <div className="p-5">
              <label
                id="web-autouma-account-alias-title"
                className="block text-sm font-semibold text-slate-700"
                htmlFor="web-autouma-account-alias"
              >
                账号别名
              </label>
              <input
                id="web-autouma-account-alias"
                autoFocus
                value={accountAliasDraft}
                onChange={(event) => setAccountAliasDraft(event.target.value)}
                maxLength={40}
                placeholder={`UID ${editingAccount.uid}`}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span className="truncate">UID {editingAccount.uid}</span>
                <span>{accountAliasDraft.length}/40</span>
              </div>
            </div>
            <footer className="successionPickerFooter flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => saveAccountAlias('').catch(() => undefined)}
                disabled={busy === `rename-${editingAccount.id}`}
                className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                清除别名
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAccountId('')}
                  disabled={busy === `rename-${editingAccount.id}`}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy === `rename-${editingAccount.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === `rename-${editingAccount.id}` ? (
                    <RefreshCw className="animate-spin" size={13} />
                  ) : (
                    <PencilLine size={13} />
                  )}
                  保存
                </button>
              </div>
            </footer>
          </form>
        </div>
      ) : null}

      {runConfig ? (
        <div className="successionPickerTheme successionPickerOverlay z-[60]">
          <div className="successionPickerDialog max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="plannerDialogHeaderBlock">
              <h3 className="text-lg font-bold text-slate-900">选择运行方式</h3>
              <p className="mt-1 text-sm text-slate-500">{runConfig.name}</p>
            </div>
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { id: 'single' as const, title: '单次', detail: '完成当前这一次育成后停止。', icon: Play },
                  { id: 'continuous' as const, title: '持续', detail: '持续自动开始下一次，直到手动停止。', icon: RefreshCw },
                  { id: 'count' as const, title: '完成 X 次', detail: '完成指定次数的育成后停止。', icon: ListChecks },
                  { id: 'jewel_drops' as const, title: '获得 X 次', detail: '获得指定次数的宝石掉落后停止。', icon: Gem },
                ].map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setRunMode(option.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                        runMode === option.id
                          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <IconComponent size={18} />
                      </span>
                      <span>
                        <strong className="block text-sm text-slate-800">
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

              <section className="mt-4 rounded-xl bg-slate-50/80 p-2.5">
                <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg bg-white/90 p-1 shadow-sm ring-1 ring-slate-200/70">
                  {[
                    { id: 'now' as const, label: '立即启动', icon: Play },
                    { id: 'scheduled' as const, label: '定时启动', icon: CalendarClock },
                    { id: 'daily' as const, label: '每日重复', icon: CalendarCheck },
                  ].map((option) => {
                    const IconComponent = option.icon;
                    const selected =
                      option.id === 'daily'
                        ? repeatDaily
                        : !repeatDaily && scheduleTiming === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          const daily = option.id === 'daily';
                          setRepeatDaily(daily);
                          if (!daily) setScheduleTiming(option.id);
                          if (option.id === 'scheduled' && !scheduledStartAt) {
                            setScheduledStartAt(defaultScheduledDateTime());
                          }
                        }}
                        className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${
                          selected
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <IconComponent size={14} /> {option.label}
                      </button>
                    );
                  })}
                </div>
                {!repeatDaily && scheduleTiming === 'scheduled' ? (
                  <input
                    type="datetime-local"
                    value={scheduledStartAt}
                    onChange={(event) => setScheduledStartAt(event.target.value)}
                    className="mt-2 h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  />
                ) : null}
                {repeatDaily ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="text-xs text-slate-500">
                      每日启动
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(event) => setScheduleStartTime(event.target.value)}
                        className="ml-2 h-8 rounded-md border border-slate-200 px-2"
                      />
                    </label>
                    <label className="text-xs text-slate-500">
                      每日结束
                      <input
                        type="time"
                        value={scheduleEndTime}
                        onChange={(event) => setScheduleEndTime(event.target.value)}
                        className="ml-2 h-8 rounded-md border border-slate-200 px-2"
                      />
                    </label>
                  </div>
                ) : null}
              </section>

              {runMode === 'count' ? (
                <RunTargetInput
                  compact
                  embedded
                  className="mt-3 w-full"
                  prefix={repeatDaily ? '每天完成' : '从现在起完成'}
                  value={runCountTarget}
                  max={100}
                  suffix="次育成"
                  onValueChange={setRunCountTarget}
                />
              ) : null}
              {runMode === 'jewel_drops' ? (
                <RunTargetInput
                  compact
                  embedded
                  className="mt-3 w-full"
                  prefix={repeatDaily ? '每天累计达到' : '从现在起获得'}
                  value={jewelDropTarget}
                  max={20}
                  suffix="次宝石掉落"
                  onValueChange={setJewelDropTarget}
                />
              ) : null}
            </div>
            <div className="successionPickerFooter flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRunConfig(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmRunPlan}
                disabled={Boolean(busy)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Play size={14} /> {busy ? '正在启动…' : '开始运行'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
