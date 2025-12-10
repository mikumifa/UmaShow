import { BrowserWindow } from 'electron';
import { UMDB } from './Data';
import { RACE_DIR } from '../paths';
import fs from 'fs';

import path from 'path';
import log from 'electron-log';
import { jsonReplacer } from '../util';
import { RaceMetaInfo, RaceRecord } from '../../types/gameTypes';

/**
 * ⭐ 处理赛马数据：race_scenario + race_horse_data_array
 */
export function handleRaceInfo(decodedData: any, win: BrowserWindow) {
  const data = decodedData?.data || decodedData;

  const raceScenario =
    data?.race_scenario ??
    data?.race_result_info?.race_scenario ??
    data?.result_info?.race_scenario ??
    null;

  const raceHorseData =
    data?.race_horse_data_array ??
    data?.race_result_info?.race_horse_data_array ??
    data?.result_info?.race_horse_data_array ??
    null;

  const raceMetaInfo =
    data?.race_result ?? data?.race_result_info ?? data ?? null;
  if (!raceScenario || !raceHorseData || !raceMetaInfo) return;
  if (raceMetaInfo?.random_seed == null) return;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = `race_info_${timestamp}.json`;
    const filepath = path.join(RACE_DIR, filename);

    const record = {
      filename: filename,
      fullPath: filepath,
      createdAt: raceMetaInfo.start_time ?? new Date().toISOString(),
      raceMetaInfo: {
        race_instance_id: raceMetaInfo.race_instance_id,
        season: raceMetaInfo.season ?? -1,
        weather: raceMetaInfo.weather ?? -1,
        ground_condition: raceMetaInfo.ground_condition ?? -1,
        random_seed: raceMetaInfo.random_seed ?? -1,
        entry_num: raceMetaInfo.entry_num ?? -1,
        current_entry_num: raceMetaInfo.current_entry_num ?? -1,
      } as RaceMetaInfo,
      scenario: raceScenario,
      horses: raceHorseData,
    } as RaceRecord;

    fs.writeFileSync(
      filepath,
      JSON.stringify(record, jsonReplacer, 2),
      'utf-8',
    );
    log.info(`[RaceData] ✅ Saved to ${filepath}`);

    win.webContents.send('race:new', record);
  } catch (e: any) {
    log.error(`[RaceData] ❌ Save failed: ${e.message}`);
  }
}

export function handleRaceList(ipcMain: Electron.IpcMain) {
  ipcMain.handle('race:list', async () => {
    if (!fs.existsSync(RACE_DIR)) {
      fs.mkdirSync(RACE_DIR, { recursive: true });
    }

    const files = fs
      .readdirSync(RACE_DIR)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => {
        const full = path.join(RACE_DIR, f);
        try {
          const content = fs.readFileSync(full, 'utf-8');
          const record = JSON.parse(content) as RaceRecord;
          return [record];
        } catch (e) {
          console.error('[RaceData] ❌ Failed to parse:', full, e);
          return [];
        }
      });

    return files;
  });

  ipcMain.handle('race:delete', async (_, filenames: string[]) => {
    for (const name of filenames) {
      const file = path.join(RACE_DIR, name);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return true;
  });
}

export function ensureRaceDir() {
  if (!fs.existsSync(RACE_DIR)) {
    fs.mkdirSync(RACE_DIR, { recursive: true });
  }
}
