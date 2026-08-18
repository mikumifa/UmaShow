/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';
import AppUpdater from './updater';
import { handleDataLoad, UMDBload } from './handle/Data';
import { startExpressServer } from './handle/Server';
import { ensureRaceDir, handleRaceList } from './handle/RaceInfo';
import {
  ensureTrainingHistory,
  handleTrainingHistoryList,
} from './handle/TrainingHistory';
import { handleLeaderboardRanking } from './handle/LeaderboardRanking';
import { handleAutoResearchCredentials } from './handle/AutoResearchCredentials';
import { handleAutoResearchUiSettings } from './handle/AutoResearchUiSettings';
import { handleSuccessionIndex } from './handle/SuccessionIndex';
import { handleSuccessionPlayerScan } from './handle/SuccessionPlayerScan';
import { getServerPort, setServerPort } from './config';

let mainWindow: BrowserWindow | null = null;
let appUpdater: AppUpdater | null = null;

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
  let port = '9223';
  if (process.env.MAIN_ARGS) {
    const [, parsedPort] = (
      [...process.env.MAIN_ARGS.matchAll(/"[^"]+"|[^\s"]+/g)]
        .flat()
        .filter((str) => str.includes('debugging-port'))[0] || '=9223'
    ).split('=');
    port = parsedPort ?? port;
  }
  app.commandLine.appendSwitch('remote-debugging-port', port);
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

/**
 * ⭐ 创建窗口（集成 Express）
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);
  if (process.platform === 'darwin') {
    app.dock.setIcon(getAssetPath('icon.png'));
  }
  mainWindow = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1200,
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
    mainWindow.webContents.send('ui:fullscreen-changed', {
      fullScreen: mainWindow.isFullScreen(),
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('ui:fullscreen-changed', { fullScreen: true });
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('ui:fullscreen-changed', {
      fullScreen: false,
    });
  });

  if (!appUpdater) {
    appUpdater = new AppUpdater();
  }
  const expressServer = await startExpressServer(mainWindow, getServerPort());
  const menuBuilder = new MenuBuilder(
    mainWindow,
    () => appUpdater?.checkForUpdates(true),
    () => expressServer.getPort(),
    async (port) => {
      await expressServer.restart(port);
      setServerPort(port);
    },
  );
  menuBuilder.buildMenu();
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  appUpdater.checkForUpdates();
};

// race
handleRaceList(ipcMain);
handleTrainingHistoryList(ipcMain);
handleDataLoad(ipcMain);
handleLeaderboardRanking(ipcMain);
handleAutoResearchCredentials(ipcMain);
handleAutoResearchUiSettings(ipcMain);
handleSuccessionIndex(ipcMain);
handleSuccessionPlayerScan(ipcMain);
ipcMain.handle('server:get-port', () => getServerPort());

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
    ensureTrainingHistory();
    UMDBload();
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch((err) => {
    console.error('Failed to start app:', err);
  });
