/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';
import { handleDataLoad, UMDBload } from './handle/Data';
import { startExpressServer } from './handle/Server';
import { ensureRaceDir, handleRaceList } from './handle/RaceInfo';

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
  }

  checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
/**
 * ⭐ 创建窗口（集成 Express）
 */

const createWindow = async () => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  startExpressServer(mainWindow);
  // eslint-disable-next-line no-new
  const appUpdater = new AppUpdater();
  appUpdater.checkForUpdates();
};

//race
handleRaceList(ipcMain);
handleDataLoad(ipcMain);

/**
 * App lifecycle
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app
  .whenReady()
  .then(() => {
    ensureRaceDir();
    UMDBload();
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch((err) => {
    console.error('Failed to start app:', err);
  });
