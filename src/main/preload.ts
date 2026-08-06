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
    ui: {
      onTogglePhonePanel: (callback: () => void) => {
        const subscription = () => callback();
        ipcRenderer.on('ui:toggle-phone-panel', subscription);
        return () => {
          ipcRenderer.removeListener('ui:toggle-phone-panel', subscription);
        };
      },
      onFullscreenChanged: (callback: (fullScreen: boolean) => void) => {
        const subscription = (_event: IpcRendererEvent, data: any) =>
          callback(!!data?.fullScreen);
        ipcRenderer.on('ui:fullscreen-changed', subscription);
        return () => {
          ipcRenderer.removeListener('ui:fullscreen-changed', subscription);
        };
      },
    },
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
  },
  trainingHistory: {
    list: () => ipcRenderer.invoke('training-history:list'),
    get: (id: string) => ipcRenderer.invoke('training-history:get', id),
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
  venusModel: {
    open: () => ipcRenderer.invoke('venus-model:open'),
    loadPath: (manifestPath: string) =>
      ipcRenderer.invoke('venus-model:load-path', manifestPath),
    clear: () => ipcRenderer.invoke('venus-model:clear'),
    info: () => ipcRenderer.invoke('venus-model:info'),
    predict: (features: number[]) =>
      ipcRenderer.invoke('venus-model:predict', features),
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
  packetListener: {
    getPort: () => ipcRenderer.invoke('server:get-port'),
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
