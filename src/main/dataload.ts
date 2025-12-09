import Database from "better-sqlite3";
import fs from "fs";
import { __assets } from "./paths";
import path from "path";

// 支持卡映射：supportCardId -> { charaId, iconPath }
export const SupportCardMap: Record<
  number, string | null
> = {};

interface SupportCardRow {
  id: number;
  chara_id: number;
}

export function loadSupportCardMapping() {
  const dbPath = path.join(__assets, "master.mdb");

  console.log(`[SupportCard] Loading DB from: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`[SupportCard] ❌ Database file not found: ${dbPath}`);
    return false;
  }

  try {
    const db = new Database(dbPath, { readonly: true });

    const rows = db
      .prepare<SupportCardRow[]>(`
        SELECT id, chara_id
        FROM support_card_data
      `)
      .all();

    for (const row of rows) {
      const iconFullPath  = path.join(__assets, "chr_icon", `${row.chara_id}.png`);
      let iconBase64 = null;

      if (fs.existsSync(iconFullPath)) {
        const buffer = fs.readFileSync(iconFullPath);
        iconBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
}
      SupportCardMap[row.id] = iconBase64
    }

    console.log(
      `[SupportCard] ✅ Loaded mapping (with icons): ${Object.keys(
        SupportCardMap
      ).length} entries`
    );
    return true;
  } catch (err: any) {
    console.error(`[SupportCard] ❌ Failed to load mapping.`);
    console.error(err);
    return false;
  }
}
