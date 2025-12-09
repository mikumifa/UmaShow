/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process.
 */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import express from 'express';
import { decode } from '@msgpack/msgpack';
import { resolveHtmlPath } from './util';
import MenuBuilder from './menu';
import { CharStats, GameStats } from '../types/gameTypes';
import { loadSupportCardMapping, SupportCardMap } from './dataload';
import { ASSETS_PATH } from './paths';
import { resolveEventRule } from '../constant/events';

const PORT = 4639;
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

function extractCoreInfo(decodedData: any, _mainWindow: BrowserWindow) {
  const chara = decodedData.data?.chara_info;
  if (!chara) return;
  const home = decodedData.data?.home_info;
  const stats: CharStats = {
    speed: { value: chara?.speed, max: chara?.max_speed },
    stamina: { value: chara?.stamina, max: chara?.max_stamina },
    power: { value: chara?.power, max: chara?.max_power },
    wiz: { value: chara?.wiz, max: chara?.max_wiz },
    guts: { value: chara?.guts, max: chara?.max_guts },
    vital: { value: chara?.vital, max: chara?.max_vital },
    skillPoint: chara?.skill_point,
  };
  const gameStats: GameStats = {
    turn: chara?.turn,
  };

  const commands = (home?.command_info_array || []).map((cmd: any) => ({
    commandId: cmd.command_id,
    commandType: cmd.command_type,
    isEnable: cmd.is_enable,
    failureRate: cmd.failure_rate,
    level: cmd.level,
    trainingPartners: cmd.training_partner_array || [],
    tipsPartners: cmd.tips_event_partner_array || [],
    params: (cmd.params_inc_dec_info_array || []).map((p: any) => ({
      targetType: p.target_type,
      value: p.value,
    })),
  }));

  // ---------- partner Stats ----------
  const supportCards: any[] = chara?.support_card_array || [];
  const evaluations: any[] = chara?.evaluation_info_array || [];

  const partnerStats = evaluations.map((evalEntry) => {
    const position = evalEntry.training_partner_id;
    const matchedCard = supportCards.find((card) => card.position === position);
    const result = {
      position,
      evaluation: evalEntry.evaluation ?? 0,
      supportCardId: null,
      charaPath: '',
      limitBreak: 0,
      exp: 0,
    };
    if (matchedCard) {
      result.supportCardId = matchedCard.support_card_id;
      result.charaPath = SupportCardMap[matchedCard.support_card_id] ?? '';
      result.limitBreak = matchedCard.limit_break_count;
      result.exp = matchedCard.exp;
    }
    return result;
  });

  const rawEvents = decodedData.data?.unchecked_event_array || [];
  const gameEvents = rawEvents.flatMap((ev: any) => {
    const storyId = ev.story_id;
    const choiceArray = ev.event_contents_info?.choice_array || [];

    log.log('=== Event ===');
    log.log('story_id:', storyId);
    log.log('choice_array:');
    choiceArray.forEach((choice: any) => {
      log.log('  -', choice);
    });
    log.log('================\n');
    const rule = resolveEventRule(storyId);
    if (!rule) {
      return [];
    }
    const options = choiceArray.map((choice: any, position: number) => {
      const idx = choice.select_index;
      const group = rule.options?.[position];
      const matched = group?.[idx];

      return (
        matched ?? {
          desp: 'unknown',
          detail: '',
          type: 'unknown',
        }
      );
    });

    return [
      {
        eventId: storyId,
        eventName: rule.name,
        options,
      },
    ];
  });
  _mainWindow.webContents.send('core-info-update', {
    gameStats,
    stats,
    commands,
    partnerStats,
    gameEvents,
  });
}

/**
 * ⭐ Express server 启动（完整）
 */
function startExpressServer(_mainWindow: BrowserWindow) {
  const serverApp = express();
  serverApp.use(express.raw({ type: '*/*', limit: '50mb' }));

  serverApp.post('/notify/response', (req, res) => {
    try {
      const buffer = req.body;

      if (buffer && buffer.length > 0) {
        const decoded: any = decode(buffer);
        _mainWindow.webContents.send('server-log', {
          type: 'Info',
          message: `收到 Response 包 (${buffer.length} bytes)`,
        });
        extractCoreInfo(decoded, _mainWindow);
        // handleUncheckedEventInfo(decoded, mainWindow);
        // handleRaceInfo(decoded, mainWindow);
      }
    } catch (e: any) {
      console.error(e);
      _mainWindow.webContents.send('server-log', {
        type: 'Error',
        message: e.message,
      });
    }

    res.json({ status: 'ok' });
  });

  serverApp.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    _mainWindow.webContents.send('server-log', {
      type: 'System',
      message: `监听端口: ${PORT}`,
    });
  });
}

/**
 * ⭐ 处理赛马数据：race_scenario + race_horse_data_array
 */
// function handleRaceInfo(decodedData: any, win: BrowserWindow) {
//   const data = decodedData.data || decodedData;
//   const raceScenario = data.race_scenario;
//   const raceHorseData = data.race_horse_data_array;

//   if (!raceScenario && !raceHorseData) return;

//   try {
//     const timestamp = Math.floor(Date.now() / 1000);
//     const filename = `race_info_${timestamp}.txt`;
//     const filepath = path.join(RACE_DIR, filename);

//     const content =
//       JSON.stringify(raceScenario, jsonReplacer) +
//       '\n' +
//       JSON.stringify(raceHorseData, jsonReplacer) +
//       '\n';

//     fs.writeFileSync(filepath, content, 'utf-8');

//     win.webContents.send('server-log', {
//       type: 'Race',
//       message: `赛马数据已保存: ${filename}`,
//     });
//   } catch (e: any) {
//     win.webContents.send('server-log', {
//       type: 'Error',
//       message: `保存失败: ${e.message}`,
//     });
//   }
// }

/**
 * ⭐ 创建窗口（集成 Express）
 */
const createWindow = async () => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);
  loadSupportCardMapping();
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
  ipcMain.handle('get-assets-path', () => ASSETS_PATH);
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  startExpressServer(mainWindow);
  // eslint-disable-next-line no-new
  const appUpdater = new AppUpdater();
  appUpdater.checkForUpdates();
};

/**
 * App lifecycle
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch((err) => {
    console.error('Failed to start app:', err);
  });
