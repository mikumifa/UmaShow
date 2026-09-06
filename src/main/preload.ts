/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },

    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);

      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  utils: {
    getFile: (filePath: string) =>
      ipcRenderer.invoke('get-asset-file', filePath),
    getUmaDatabase: () => {
      return ipcRenderer.invoke('umdb-get');
    },
    getStoryDetail: (storyId: number) =>
      ipcRenderer.invoke('story-detail:get', storyId),
    navigation: {
      onNavigate: (callback: (data: { path: string; state: any }) => void) => {
        const subscription = (_event: IpcRendererEvent, data: any) =>
          callback(data);

        ipcRenderer.on('navigate-to', subscription);

        return () => {
          ipcRenderer.removeListener('navigate-to', subscription);
        };
      },
    },
  },
  appShell: {
    getInfo: () => ipcRenderer.invoke('app-shell:get-info'),
    setServerPort: (port: number) =>
      ipcRenderer.invoke('app-shell:set-server-port', port),
    toggleFullScreen: () => ipcRenderer.invoke('app-shell:toggle-full-screen'),
    minimize: () => ipcRenderer.invoke('app-shell:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('app-shell:toggle-maximize'),
    close: () => ipcRenderer.invoke('app-shell:close'),
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(!!data?.maximized);
      ipcRenderer.on('app-shell:maximized-changed', subscription);
      return () => {
        ipcRenderer.removeListener('app-shell:maximized-changed', subscription);
      };
    },
    checkForUpdates: () => ipcRenderer.invoke('app-shell:check-for-updates'),
  },
  race: {
    list: (archiveId?: string) => ipcRenderer.invoke('race:list', archiveId),
    delete: (names: string[]) => ipcRenderer.invoke('race:delete', names),
    archives: () => ipcRenderer.invoke('race:archives'),
    createArchive: (name: string) =>
      ipcRenderer.invoke('race:archive-create', name),
    deleteArchive: (archiveId: string) =>
      ipcRenderer.invoke('race:archive-delete', archiveId),
    getStatsCache: (archiveId: string) =>
      ipcRenderer.invoke('race:stats-cache-get', archiveId),
    setStatsCache: (
      archiveId: string,
      payload: { version: number; archiveUpdatedAt: number; data: unknown },
    ) => ipcRenderer.invoke('race:stats-cache-set', archiveId, payload),
    assignArchive: (names: string[], archiveId: string) =>
      ipcRenderer.invoke('race:archive-assign', names, archiveId),
    repeatSimulation: (payload: {
      accountId: string;
      archiveName: string;
      count: number;
      source: {
        raceMetaInfo: Record<string, unknown>;
        horses: Record<string, unknown>[];
      };
    }) => ipcRenderer.invoke('race:repeat-simulation', payload),
    onRepeatSimulationProgress(
      callback: (data: {
        stage: 'login' | 'prepare' | 'simulate' | 'save' | 'complete';
        detail: string;
        current?: number;
        total?: number;
        archiveId?: string;
        archiveName?: string;
      }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on('race:repeat-simulation:progress', subscription);
      return () => {
        ipcRenderer.removeListener(
          'race:repeat-simulation:progress',
          subscription,
        );
      };
    },
    onArchivesChanged(
      callback: (data: { archiveId?: string; archiveName?: string }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on('race:archives-changed', subscription);
      return () => {
        ipcRenderer.removeListener('race:archives-changed', subscription);
      };
    },
  },
  trainingHistory: {
    list: () => ipcRenderer.invoke('training-history:list'),
    get: (id: string) => ipcRenderer.invoke('training-history:get', id),
    importRemote: (history: {
      id: string;
      meta?: Record<string, unknown>;
      packets?: Array<Record<string, unknown>>;
    }) => ipcRenderer.invoke('training-history:import-remote', history),
    getConfig: () => ipcRenderer.invoke('training-history:config-get'),
    setConfig: (payload: { maxCachedRuns: number }) =>
      ipcRenderer.invoke('training-history:config-set', payload),
    setFavorite: (id: string, favorite: boolean) =>
      ipcRenderer.invoke('training-history:favorite', id, favorite),
    recalculate: (ids?: string[]) =>
      ipcRenderer.invoke('training-history:recalculate', ids),
    openFolder: (id: string) =>
      ipcRenderer.invoke('training-history:open-folder', id),
    delete: (ids: string[]) =>
      ipcRenderer.invoke('training-history:delete', ids),
    onNew(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('training-history:new', subscription);

      return () => {
        ipcRenderer.removeListener('training-history:new', subscription);
      };
    },
  },
  leaderboardRanking: {
    latest: () => ipcRenderer.invoke('leaderboard-ranking:latest'),
    onNew(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('leaderboard-ranking:new', subscription);

      return () => {
        ipcRenderer.removeListener('leaderboard-ranking:new', subscription);
      };
    },
  },
  autoResearch: {
    getUiSetting: (key: string) =>
      ipcRenderer.sendSync('autoresearch:ui-setting-get', key) as string | null,
    setUiSetting: (key: string, value: string) =>
      ipcRenderer.sendSync(
        'autoresearch:ui-setting-set',
        key,
        value,
      ) as boolean,
    credentials: () => ipcRenderer.invoke('autoresearch:credentials-list'),
    accounts: () => ipcRenderer.invoke('autoresearch:accounts-list'),
    saveAccounts: (
      credentials: Array<{
        uid: string;
        accessKey: string;
        capturedAt: string;
        source: string;
        label?: string;
      }>,
    ) => ipcRenderer.invoke('autoresearch:accounts-save', credentials),
    deleteAccount: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-delete', id),
    credential: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-credential', id),
    currentSession: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-current-session', id),
    loginSession: (id: string, loginId: string) =>
      ipcRenderer.invoke('autoresearch:account-login-session', id, loginId),
    localOverview: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-local-overview', id),
    localOptions: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-local-options', id),
    clearLocalSession: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-local-session-clear', id),
    dailyTasksOverview: (id: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('autoresearch:daily-tasks-overview', id, config),
    runDailyTasks: (id: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('autoresearch:daily-tasks-run', id, config),
    prepareIdleSingleMode: (id: string, request: Record<string, unknown>) =>
      ipcRenderer.invoke('autoresearch:idle-single-mode-prepare', id, request),
    saveIdleSingleModeRaceDeck: (
      id: string,
      request: Record<string, unknown>,
    ) =>
      ipcRenderer.invoke(
        'autoresearch:idle-single-mode-race-deck',
        id,
        request,
      ),
    abandonCareer: (id: string) =>
      ipcRenderer.invoke('autoresearch:account-abandon-career', id),
    abandonIdleSingleMode: (id: string, currentTurn: number) =>
      ipcRenderer.invoke(
        'autoresearch:account-abandon-idle-single-mode',
        id,
        currentTurn,
      ),
    onLoginProgress(
      callback: (data: {
        loginId: string;
        stage: 'login' | 'load' | 'scan';
        detail: string;
      }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on('autoresearch:local-login-progress', subscription);
      return () => {
        ipcRenderer.removeListener(
          'autoresearch:local-login-progress',
          subscription,
        );
      };
    },
    importUsersDb: (contentBase64: string) =>
      ipcRenderer.invoke(
        'autoresearch:accounts-import-users-db',
        contentBase64,
      ),
    onCredentialCaptured(
      callback: (data: {
        uid: string;
        accessKey: string;
        capturedAt: string;
        source: string;
      }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on('autoresearch:credential-captured', subscription);
      return () => {
        ipcRenderer.removeListener(
          'autoresearch:credential-captured',
          subscription,
        );
      };
    },
  },
  successionPlayerScan: {
    list: () => ipcRenderer.invoke('succession-player-scan:list'),
    clear: () => ipcRenderer.invoke('succession-player-scan:clear'),
    importPlayers: (payload: unknown) =>
      ipcRenderer.invoke('succession-player-scan:import', payload),
    scan: (accountId: string, playerIds: string, updateExisting = true) =>
      ipcRenderer.invoke(
        'succession-player-scan:scan',
        accountId,
        playerIds,
        updateExisting,
      ),
    onProgress(
      callback: (data: {
        stage: 'login' | 'load' | 'scan';
        detail: string;
        viewerId?: string;
        current?: number;
        total?: number;
      }) => void,
    ) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);
      ipcRenderer.on('succession-player-scan:progress', subscription);
      return () => {
        ipcRenderer.removeListener(
          'succession-player-scan:progress',
          subscription,
        );
      };
    },
  },
  packetListener: {
    getPort: () => ipcRenderer.invoke('server:get-port'),
    getSuccessionIndex: () => ipcRenderer.invoke('succession-index:get'),
    onSuccessionIndex(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('succession-index:update', subscription);

      return () => {
        ipcRenderer.removeListener('succession-index:update', subscription);
      };
    },
    onLog(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('server-log', subscription);

      return () => {
        ipcRenderer.removeListener('server-log', subscription);
      };
    },

    onGameEvent(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('new-game-event', subscription);

      return () => {
        ipcRenderer.removeListener('new-game-event', subscription);
      };
    },
    onCharInfo(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('core-info-update', subscription);
      return () => {
        ipcRenderer.removeListener('core-info-update', subscription);
      };
    },
    onNew(callback: (data: any) => void) {
      const subscription = (_event: IpcRendererEvent, data: any) =>
        callback(data);

      ipcRenderer.on('race:new', subscription);

      return () => {
        ipcRenderer.removeListener('race:new', subscription);
      };
    },
    openRaceFolder() {
      ipcRenderer.send('open-race-folder');
    },
  },
  // assets: __assets,
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
