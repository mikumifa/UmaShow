/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';
import AppUpdater from './updater';
import { handleDataLoad, UMDBload } from './handle/Data';
import { ExpressServerController, startExpressServer } from './handle/Server';
import { ensureRaceDir, handleRaceList } from './handle/RaceInfo';
import {
  ensureTrainingHistory,
  handleTrainingHistoryList,
} from './handle/TrainingHistory';
import { handleLeaderboardRanking } from './handle/LeaderboardRanking';
import { handleAutoResearchCredentials } from './handle/AutoResearchCredentials';
import handleAutoResearchUiSettings from './handle/AutoResearchUiSettings';
import handleAutoResearchDailyTasks from './handle/AutoResearchDailyTasks';
import handleAutoResearchIdleSingleMode from './handle/AutoResearchIdleSingleMode';
import { handleSuccessionIndex } from './handle/SuccessionIndex';
import { handleSuccessionPlayerScan } from './handle/SuccessionPlayerScan';
import handlePracticeRaceSimulation from './handle/PracticeRaceSimulation';
import { getServerPort, SERVER_PORT_OPTIONS, setServerPort } from './config';
import { ASSET_SCHEME, registerAssetProtocol } from './handle/AssetProtocol';

protocol.registerSchemesAsPrivileged([
  {
    scheme: ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let appUpdater: AppUpdater | null = null;
let expressServer: ExpressServerController | null = null;
let menuBuilder: MenuBuilder | null = null;

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
  const windowIcon =
    process.platform === 'win32'
      ? getAssetPath('icon.ico')
      : getAssetPath('icon.png');
  mainWindow = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1200,
    frame: process.platform !== 'win32',
    autoHideMenuBar: process.platform !== 'darwin',
    icon: windowIcon,
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
  const sendMaximizedState = () => {
    const window = mainWindow;
    window?.webContents.send('app-shell:maximized-changed', {
      maximized: window.isMaximized(),
    });
  };
  mainWindow.on('maximize', sendMaximizedState);
  mainWindow.on('unmaximize', sendMaximizedState);
  if (!appUpdater) {
    appUpdater = new AppUpdater();
  }
  const activeExpressServer = await startExpressServer(
    mainWindow,
    getServerPort(),
  );
  expressServer = activeExpressServer;
  menuBuilder = new MenuBuilder(
    mainWindow,
    () => appUpdater?.checkForUpdates(true),
    () => activeExpressServer.getPort(),
    async (port) => {
      await activeExpressServer.restart(port);
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
handleAutoResearchDailyTasks(ipcMain);
handleAutoResearchIdleSingleMode(ipcMain);
handleSuccessionIndex(ipcMain);
handleSuccessionPlayerScan(ipcMain);
handlePracticeRaceSimulation(ipcMain);
ipcMain.handle('server:get-port', () => getServerPort());
ipcMain.handle('app-shell:get-info', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return {
    version: app.getVersion(),
    platform: process.platform,
    serverPort: expressServer?.getPort() ?? getServerPort(),
    serverPortOptions: [...SERVER_PORT_OPTIONS],
    development: isDebug,
    maximized: window?.isMaximized() ?? false,
  };
});
ipcMain.handle('app-shell:set-server-port', async (_event, port: number) => {
  if (
    !SERVER_PORT_OPTIONS.includes(port as (typeof SERVER_PORT_OPTIONS)[number])
  ) {
    throw new Error(`不支持的监听端口：${port}`);
  }
  if (!expressServer) {
    throw new Error('监听服务尚未启动');
  }
  await expressServer.restart(port);
  setServerPort(port);
  menuBuilder?.buildMenu();
  return expressServer.getPort();
});
ipcMain.handle('app-shell:toggle-full-screen', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  window.setFullScreen(!window.isFullScreen());
  return window.isFullScreen();
});
ipcMain.handle('app-shell:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.handle('app-shell:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  if (window.isMaximized()) window.unmaximize();
  else window.maximize();
  return window.isMaximized();
});
ipcMain.handle('app-shell:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});
ipcMain.handle('app-shell:check-for-updates', () => {
  appUpdater?.checkForUpdates(true);
});

/**
 * App lifecycle
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app
  .whenReady()
  .then(() => {
    registerAssetProtocol();
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
