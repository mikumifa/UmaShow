import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { ASSETS_PATH } from './paths';

// 支持卡映射：supportCardId -> { charaId, iconPath }
export const SupportCardMap: Record<number, string | null> = {};

interface SupportCardRow {
  id: number;
  chara_id: number;
}

export function loadSupportCardMapping() {
  const dbPath = path.join(ASSETS_PATH, 'master.mdb');

  log.debug(`[SupportCard] Loading DB from: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    log.error(`[SupportCard] ❌ Database file not found: ${dbPath}`);
    return false;
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    const rows = db
      .prepare(
        `
        SELECT id, chara_id
        FROM support_card_data
      `,
      )
      .all() as SupportCardRow[];

    rows.forEach((row) => {
      const iconFullPath = path.join(
        ASSETS_PATH,
        'chr_icon',
        `${row.chara_id}.png`,
      );

      let iconBase64 = null;

      if (fs.existsSync(iconFullPath)) {
        const buffer = fs.readFileSync(iconFullPath);
        iconBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      }

      SupportCardMap[row.id] = iconBase64;
    });

    log.info(
      `[SupportCard] ✅ Loaded mapping (with icons): ${
        Object.keys(SupportCardMap).length
      } entries`,
    );
    return true;
  } catch (err: any) {
    log.error(`[SupportCard] ❌ Failed to load mapping.`);
    log.error(err);
    return false;
  }
}
