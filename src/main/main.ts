/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { execFile } from 'child_process';
import { windowManager } from 'node-window-manager';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';
import AppUpdater from './updater';
import { handleDataLoad, UMDBload } from './handle/Data';
import { startExpressServer } from './handle/Server';
import { ensureRaceDir, handleRaceList } from './handle/RaceInfo';

let mainWindow: BrowserWindow | null = null;
let appUpdater: AppUpdater | null = null;

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
  let port = '9223';
  if (process.env.MAIN_ARGS) {
    port = (
      [...process.env.MAIN_ARGS.matchAll(/"[^"]+"|[^\s"]+/g)]
        .flat()
        .filter((str) => str.includes('debugging-port'))[0] || '=9223'
    ).split('=')[1];
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
  mainWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 1000,
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
    mainWindow?.webContents.send('ui:fullscreen-changed', { fullScreen: false });
  });

  if (!appUpdater) {
    appUpdater = new AppUpdater();
  }
  const menuBuilder = new MenuBuilder(mainWindow, () =>
    appUpdater?.checkForUpdates(true),
  );
  menuBuilder.buildMenu();
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  startExpressServer(mainWindow);
  appUpdater.checkForUpdates();
};

//race
handleRaceList(ipcMain);
handleDataLoad(ipcMain);

ipcMain.handle('window:list', () => {
  return windowManager
    .getWindows()
    .filter((win) => win.isVisible())
    .map((win) => ({
      id: win.id,
      title: win.getTitle(),
      pid: win.processId,
    }))
    .filter((win) => win.title && win.title.trim().length > 0);
});

ipcMain.handle(
  'window:set-topmost',
  (_event, payload: { windowId: number; enabled: boolean }) => {
    if (process.platform !== 'win32') {
      return { ok: false };
    }
    const { windowId, enabled } = payload;
    const win = windowManager.getWindows().find((w) => w.id === windowId);
    if (!win) {
      return { ok: false };
    }
    const insertAfter = enabled ? -1 : -2;
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@;
$HWND = [IntPtr]${windowId};
$HWND_INSERT = [IntPtr](${insertAfter});
$SWP_NOSIZE = 0x0001;
$SWP_NOMOVE = 0x0002;
$SWP_NOACTIVATE = 0x0010;
[Win32]::SetWindowPos($HWND, $HWND_INSERT, 0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE) | Out-Null;
`;
    return new Promise((resolve) => {
      execFile(
        'powershell',
        ['-NoProfile', '-Command', script],
        { windowsHide: true },
        (err) => {
          if (err) {
            resolve({ ok: false });
            return;
          }
          if (mainWindow) {
            mainWindow.setAlwaysOnTop(false);
          }
          resolve({ ok: true });
        },
      );
    });
  },
);

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
