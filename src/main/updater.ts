import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

export default class AppUpdater {
  private manualCheck = false;

  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    autoUpdater.on('update-available', () => {
      if (this.manualCheck) {
        void dialog.showMessageBox({
          type: 'info',
          title: '发现新版本',
          message: '已开始下载更新，完成后会提示安装。',
        });
      }
    });

    autoUpdater.on('update-not-available', () => {
      if (this.manualCheck) {
        void dialog.showMessageBox({
          type: 'info',
          title: '已是最新',
          message: '当前已是最新版本。',
        });
      }
      this.manualCheck = false;
    });

    autoUpdater.on('update-downloaded', () => {
      dialog
        .showMessageBox({
          type: 'info',
          title: '更新已下载',
          message: '更新已下载，是否立即重启并安装？',
          buttons: ['现在重启', '稍后'],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall();
          }
        })
        .finally(() => {
          this.manualCheck = false;
        });
    });

    autoUpdater.on('error', (error) => {
      if (this.manualCheck) {
        void dialog.showMessageBox({
          type: 'error',
          title: '检查更新失败',
          message: `检查更新失败：${error.message}`,
        });
      }
      this.manualCheck = false;
    });
  }

  checkForUpdates(manual = false) {
    if (!app.isPackaged) {
      if (manual) {
        void dialog.showMessageBox({
          type: 'info',
          title: '无法检查更新',
          message: '开发模式下无法检查更新，请打包后再试。',
        });
      }
      return;
    }
    this.manualCheck = manual;
    autoUpdater.checkForUpdatesAndNotify({
      title: '发现新版本',
      body: '新版本正在下载，下载完成后会提示安装。',
    });
  }
}
