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
     getAssetsPath: () => ipcRenderer.invoke("get-assets-path"),
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
    openRaceFolder() {
      ipcRenderer.send('open-race-folder');
    },
  },
  // assets: __assets,
};

contextBridge.exposeInMainWorld('electron', electronHandler);
export type ElectronHandler = typeof electronHandler;
