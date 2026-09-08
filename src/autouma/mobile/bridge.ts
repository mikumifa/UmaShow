import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { ElectronHandler } from 'main/preload';
import {
  buildLocalDashboard,
  buildLocalDashboardOptions,
} from 'main/handle/AutoResearchLocalDashboard';
import {
  overview as dailyTasksOverview,
  run as runDailyTasks,
} from 'main/handle/AutoResearchDailyTasks';
import {
  prepare as prepareIdleSingleMode,
  saveRaceDeck as saveIdleSingleModeRaceDeck,
} from 'main/handle/AutoResearchIdleSingleMode';
import type { SuccessionGameProgress } from 'main/handle/SuccessionGameClient';
import {
  deleteMobileAccount,
  getMobileCredential,
  importMobileUsersDb,
  listMobileAccounts,
  renameMobileAccount,
  saveMobileAccounts,
} from './accounts';
import { initializeMobileMasterDatabase } from './database';
import {
  clearMobileGameClient,
  getMobileGameSession,
  loginMobileGameClient,
  withAutoResearchLocalGameClient,
} from './localGame';
import {
  deleteMobileTrainingHistory,
  getMobileTrainingHistory,
  getMobileTrainingHistoryConfig,
  importMobileTrainingHistory,
  listMobileTrainingHistory,
  onMobileTrainingHistoryNew,
  recalculateMobileTrainingHistory,
  setMobileTrainingHistoryConfig,
  setMobileTrainingHistoryFavorite,
} from './history';
import { loadMobileUmaDatabase } from './umdb';

type UnknownRecord = Record<string, any>;

const loginProgressListeners = new Set<
  (progress: { loginId: string } & SuccessionGameProgress) => void
>();

function requireNativeGameAccess() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('纯 Web 版不执行本地游戏登录，请连接 UAR 服务器使用云端功能');
  }
}

function responseData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as UnknownRecord;
  return record.data && typeof record.data === 'object'
    ? record.data
    : record;
}

function mergeDashboardResponses(index: unknown, options: unknown) {
  const root =
    index && typeof index === 'object' && !Array.isArray(index)
      ? (index as UnknownRecord)
      : {};
  return {
    ...root,
    data: {
      ...responseData(index),
      ...responseData(options),
    },
  };
}

function localRuntime(dashboard: ReturnType<typeof buildLocalDashboard>) {
  return {
    logged_in: true,
    session_owner: 'local' as const,
    last_error: '',
    last_refreshed_at: new Date().toISOString(),
    runner: { running: false },
    account: dashboard.account,
  };
}

async function localOverview(accountId: string) {
  requireNativeGameAccess();
  return withAutoResearchLocalGameClient(accountId, async (client) => {
    const index = await client.loadIndex();
    const options = await client.loadSingleModeOptions();
    const dashboard = buildLocalDashboard(
      mergeDashboardResponses(index, options),
      { source: 'AutoUma Android 本地 load/index + pre_single_mode/index' },
    );
    return { success: true, dashboard, runtime: localRuntime(dashboard) };
  });
}

async function localOptions(accountId: string) {
  requireNativeGameAccess();
  return withAutoResearchLocalGameClient(accountId, async (client) => {
    const index = await client.loadIndex();
    const options = await client.loadSingleModeOptions();
    return {
      success: true,
      options: buildLocalDashboardOptions(
        mergeDashboardResponses(index, options),
        { source: 'AutoUma Android 本地 load/index + pre_single_mode/index' },
      ),
    };
  });
}

async function loginSession(accountId: string, loginId: string) {
  requireNativeGameAccess();
  const result = await loginMobileGameClient(accountId, (progress) => {
    loginProgressListeners.forEach((listener) =>
      listener({ loginId, ...progress }),
    );
  });
  const dashboard = buildLocalDashboard(
    mergeDashboardResponses(result.loginIndex, result.optionIndex),
    { source: 'AutoUma Android 本地登录 load/index + pre_single_mode/index' },
  );
  return {
    success: true,
    dashboard,
    session: result.session,
    runtime: localRuntime(dashboard),
  };
}

async function getStoryDetail(storyId: number) {
  if (!Number.isInteger(storyId) || storyId <= 0) return null;
  try {
    const response = await CapacitorHttp.get({
      url: `https://le3-api.game.bilibili.com/x/api/umav1/story/detail?story_id=${storyId}`,
      headers: {
        'User-Agent':
          'Dalvik/2.1.0 (Linux; U; Android 12; 22041216C Build/688207e.0)',
      },
      connectTimeout: 10_000,
      readTimeout: 10_000,
    });
    const payload =
      typeof response.data === 'string'
        ? JSON.parse(response.data)
        : response.data;
    if (response.status !== 200 || !payload?.data) return null;
    return {
      storyId,
      optionList: (Array.isArray(payload.data.option_list)
        ? payload.data.option_list
        : []
      ).map((option: any) => ({
        option: String(option?.option ?? ''),
        gainList: Array.isArray(option?.gain_list)
          ? option.gain_list.map(String)
          : [],
      })),
    };
  } catch {
    return null;
  }
}

function installBridge() {
  const bridge = {
    ipcRenderer: {
      sendMessage: () => undefined,
      on: () => () => undefined,
      once: () => undefined,
    },
    utils: {
      getFile: async (path: string) =>
        new URL(path.replace(/^[./\\]+/, ''), document.baseURI).toString(),
      getUmaDatabase: () => loadMobileUmaDatabase(),
      getStoryDetail,
      navigation: { onNavigate: () => () => undefined },
    },
    appShell: {
      getInfo: async () => ({
        platform: Capacitor.getPlatform(),
        isPackaged: true,
        version: 'AutoUma',
      }),
      setServerPort: async () => false,
      toggleFullScreen: async () => false,
      minimize: async () => false,
      toggleMaximize: async () => false,
      close: async () => false,
      onMaximizedChanged: () => () => undefined,
      checkForUpdates: async () => null,
    },
    trainingHistory: {
      list: listMobileTrainingHistory,
      get: getMobileTrainingHistory,
      importRemote: importMobileTrainingHistory,
      getConfig: getMobileTrainingHistoryConfig,
      setConfig: setMobileTrainingHistoryConfig,
      setFavorite: setMobileTrainingHistoryFavorite,
      recalculate: recalculateMobileTrainingHistory,
      openFolder: async () => false,
      delete: deleteMobileTrainingHistory,
      onNew: onMobileTrainingHistoryNew,
    },
    autoResearch: {
      getUiSetting: (key: string) => localStorage.getItem(`autouma.ui.${key}`),
      setUiSetting: (key: string, value: string) => {
        localStorage.setItem(`autouma.ui.${key}`, value);
        return true;
      },
      credentials: async () => [],
      accounts: async () => listMobileAccounts(),
      saveAccounts: async (credentials: any[]) =>
        saveMobileAccounts(credentials),
      renameAccount: async (id: string, label: string) =>
        renameMobileAccount(id, label),
      deleteAccount: async (id: string) => {
        await clearMobileGameClient(id);
        return deleteMobileAccount(id);
      },
      credential: async (id: string) => getMobileCredential(id),
      currentSession: async (id: string) =>
        Capacitor.isNativePlatform() ? getMobileGameSession(id) : null,
      loginSession,
      localOverview,
      localOptions,
      clearLocalSession: clearMobileGameClient,
      dailyTasksOverview: (id: string, config: UnknownRecord) => {
        requireNativeGameAccess();
        return dailyTasksOverview(id, config as any);
      },
      runDailyTasks: (id: string, config: UnknownRecord) => {
        requireNativeGameAccess();
        return runDailyTasks(id, config as any);
      },
      prepareIdleSingleMode: (id: string, request: UnknownRecord) => {
        requireNativeGameAccess();
        return prepareIdleSingleMode(id, request);
      },
      saveIdleSingleModeRaceDeck: (id: string, request: UnknownRecord) => {
        requireNativeGameAccess();
        return saveIdleSingleModeRaceDeck(id, request);
      },
      abandonCareer: (id: string) => {
        requireNativeGameAccess();
        return withAutoResearchLocalGameClient(id, async (client) => {
          const result = await client.abandonCareer();
          return { ...result, session: client.session };
        });
      },
      abandonIdleSingleMode: (id: string, currentTurn: number) => {
        requireNativeGameAccess();
        return withAutoResearchLocalGameClient(id, async (client) => {
          const result = await client.abandonIdleSingleMode(currentTurn);
          const options = await client.loadSingleModeOptions();
          const dashboard = buildLocalDashboard(
            mergeDashboardResponses(result.index, options),
            { source: 'AutoUma Android 本地放弃离线育成' },
          );
          return {
            success: true,
            dashboard,
            session: client.session,
            runtime: localRuntime(dashboard),
          };
        });
      },
      onLoginProgress: (callback: any) => {
        loginProgressListeners.add(callback);
        return () => loginProgressListeners.delete(callback);
      },
      importUsersDb: importMobileUsersDb,
      onCredentialCaptured: () => () => undefined,
    },
  };
  window.electron = bridge as unknown as ElectronHandler;
}

export async function initializeAutoUmaBridge() {
  installBridge();
  if (Capacitor.isNativePlatform()) {
    await initializeMobileMasterDatabase();
  }
}
