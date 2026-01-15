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
    windowControl: {
      listWindows: () => ipcRenderer.invoke('window:list'),
      setTopmost: (windowId: number, enabled: boolean) =>
        ipcRenderer.invoke('window:set-topmost', { windowId, enabled }),
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
    list: () => ipcRenderer.invoke('race:list'),
    delete: (names: string[]) => ipcRenderer.invoke('race:delete', names),
  },
  packetListener: {
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
