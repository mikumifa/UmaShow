import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { app, IpcMain } from 'electron';

let settingsDatabase: Database.Database | null = null;

function database() {
  if (settingsDatabase) return settingsDatabase;
  const directory = path.join(app.getPath('appData'), 'uma-show');
  fs.mkdirSync(directory, { recursive: true });
  settingsDatabase = new Database(
    path.join(directory, 'auto-research-ui-settings.db'),
  );
  settingsDatabase.pragma('journal_mode = WAL');
  settingsDatabase.pragma('busy_timeout = 5000');
  settingsDatabase.exec(`
    CREATE TABLE IF NOT EXISTS ui_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return settingsDatabase;
}

function readValue(key: string) {
  const row = database()
    .prepare('SELECT value FROM ui_settings WHERE key = ?')
    .get(key) as { value?: string } | undefined;
  return typeof row?.value === 'string' ? row.value : null;
}

function writeValue(key: string, value: string) {
  database()
    .prepare(
      `INSERT INTO ui_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run(key, value, new Date().toISOString());
}

function mergeLegacyValue(key: string, shared: string | null, legacy: string) {
  if (!shared) return legacy;
  try {
    const sharedItems = JSON.parse(shared);
    const legacyItems = JSON.parse(legacy);
    if (!Array.isArray(sharedItems) || !Array.isArray(legacyItems)) {
      return shared;
    }
    const identity = key === 'autoResearch.presets' ? 'name' : 'id';
    const merged = new Map<string, unknown>();
    [...sharedItems, ...legacyItems].forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const itemKey = String((item as Record<string, unknown>)[identity] || '');
      if (itemKey && !merged.has(itemKey)) merged.set(itemKey, item);
    });
    return JSON.stringify([...merged.values()]);
  } catch {
    return shared;
  }
}

function readAndMigrate(key: string, legacy: unknown, source: unknown) {
  const shared = readValue(key);
  if (typeof legacy !== 'string' || !legacy) return shared;

  const sourceId =
    typeof source === 'string' && source ? source.slice(0, 300) : 'unknown';
  const migrationKey = `migration:${sourceId}:${key}`;
  if (readValue(migrationKey)) return shared;

  const merged = mergeLegacyValue(key, shared, legacy);
  writeValue(key, merged);
  writeValue(migrationKey, '1');
  return merged;
}

export default function handleAutoResearchUiSettings(ipcMain: IpcMain) {
  ipcMain.on(
    'autoresearch:ui-setting-get',
    (event, key: unknown, legacy: unknown, source: unknown) => {
      try {
        if (typeof key !== 'string' || !key.trim()) {
          event.returnValue = typeof legacy === 'string' ? legacy : null;
          return;
        }
        event.returnValue = readAndMigrate(key, legacy, source);
      } catch (error) {
        console.error('Failed to read shared auto research setting:', error);
        event.returnValue = typeof legacy === 'string' ? legacy : null;
      }
    },
  );
  ipcMain.on(
    'autoresearch:ui-setting-set',
    (event, key: unknown, value: unknown) => {
      try {
        if (typeof key !== 'string' || !key.trim()) {
          event.returnValue = false;
          return;
        }
        if (typeof value !== 'string') throw new Error('设置内容格式无效');
        writeValue(key, value);
        event.returnValue = true;
      } catch (error) {
        console.error('Failed to save shared auto research setting:', error);
        event.returnValue = false;
      }
    },
  );
}
