import { BrowserWindow } from 'electron';
import { UMDB } from './Data';
import { RACE_DIR } from '../paths';
import fs from 'fs';

import path from 'path';
import log from 'electron-log';
import { jsonReplacer } from '../util';

/**
 * ⭐ 处理赛马数据：race_scenario + race_horse_data_array
 */
export function handleRaceInfo(decodedData: any, win: BrowserWindow) {
  const data = decodedData?.data || decodedData;

  const raceScenario = data?.race_scenario ?? null;
  const raceHorseData = data?.race_horse_data_array ?? null;
  const raceResult = data?.race_result ?? null;

  if (!raceScenario && !raceHorseData && !raceResult) return;

  let raceName: string | null = null;
  if (raceResult?.race_instance_id != null) {
    raceName = UMDB.raceInstances[raceResult.race_instance_id]?.name ?? null;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = `race_info_${timestamp}.json`;
    const filepath = path.join(RACE_DIR, filename);

    const record = {
      saved_at: new Date().toISOString(),
      race_name: raceName,
      race_result: raceResult,
      race_scenario: raceScenario,
      race_horse_data: raceHorseData,
    };

    fs.writeFileSync(
      filepath,
      JSON.stringify(record, jsonReplacer, 2),
      'utf-8',
    );
    log.info(`[RaceData] ✅ Saved to ${filepath}`);

    win.webContents.send('race:new', {
      filename,
      fullPath: filepath,
      createdAt: Date.now(),
      raceName,
      raceResult,
      scenario: raceScenario,
      horses: raceHorseData,
      savedAt: record.saved_at,
    });
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
      .map((f) => {
        const full = path.join(RACE_DIR, f);
        const stat = fs.statSync(full);

        let json: any = {};

        try {
          const content = fs.readFileSync(full, 'utf-8');
          json = JSON.parse(content);
        } catch (e) {
          console.error('[RaceData] ❌ Failed to parse:', full, e);
        }

        return {
          filename: f,
          fullPath: full,
          createdAt: stat.birthtimeMs,
          raceName: json.race_name ?? null,
          raceResult: json.race_result ?? null,
          scenario: json.race_scenario ?? null,
          horses: json.race_horse_data ?? null,
          savedAt: json.saved_at ?? null,
        };
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
