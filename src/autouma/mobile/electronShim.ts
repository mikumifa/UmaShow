export const app = {
  isPackaged: false,
  getAppPath: () => '.',
  getPath: () => '.',
};

export const BrowserWindow = class BrowserWindow {};
export const shell = {
  showItemInFolder: () => false,
};
export const ipcMain = {};
export const protocol = {};

export type IpcMain = never;
export type IpcRendererEvent = never;

export default {};
