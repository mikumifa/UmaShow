import { BrowserWindow, IpcMain } from 'electron';
import fs from 'fs';

import path from 'path';
import log from 'electron-log';
import { RaceArchive, RaceMetaInfo, RaceRecord } from 'types/gameTypes';
import { jsonReplacer } from 'main/util';
import { RACE_DIR } from 'main/paths';
import { enrichPracticeRaceHorses } from './PracticeRaceRequest';
import archiveNameKey from './RaceArchiveName';

type RacePayload = {
  scenario: string;
  horses: any[];
  meta: any;
  raceNum?: number;
  roomKey?: string;
};

type PendingHistoryPayload = {
  scenario: string;
  historyHorses: any[];
  meta: any;
  raceNum?: number;
  roomKey: string;
};

const pendingHistoryByRoom = new Map<string, PendingHistoryPayload[]>();
const DEFAULT_ARCHIVE_ID = 'default';
const ARCHIVE_CONFIG_FILE = 'race_archives.config.json';
const ARCHIVES_DIR = 'archives';

type RaceArchiveConfig = {
  archives: RaceArchive[];
};

type RaceStatsCachePayload = {
  archiveId: string;
  version: number;
  archiveUpdatedAt: number;
  cacheUpdatedAt: number;
  data: unknown;
};

function archiveConfigPath() {
  return path.join(RACE_DIR, ARCHIVE_CONFIG_FILE);
}

function archivesRootPath() {
  return path.join(RACE_DIR, ARCHIVES_DIR);
}

function archiveDirPath(archiveId: string) {
  return archiveId === DEFAULT_ARCHIVE_ID
    ? RACE_DIR
    : path.join(archivesRootPath(), archiveId);
}

function statsCachePath(archiveId: string) {
  const safeArchiveId = archiveId.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
  return path.join(RACE_DIR, `race_stats_cache_${safeArchiveId}.json`);
}

function defaultArchive(): RaceArchive {
  return {
    id: DEFAULT_ARCHIVE_ID,
    name: '默认',
    createdAt: 0,
  };
}

function ensureArchiveDir() {
  if (!fs.existsSync(RACE_DIR)) {
    fs.mkdirSync(RACE_DIR, { recursive: true });
  }
  if (!fs.existsSync(archivesRootPath())) {
    fs.mkdirSync(archivesRootPath(), { recursive: true });
  }
}

function sanitizeArchiveId(name: string) {
  const base = name
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${Date.now()}-${base || 'archive'}`;
}

function ensureArchiveFolders(config: RaceArchiveConfig) {
  config.archives.forEach((archive) => {
    const dir = archiveDirPath(archive.id);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function writeArchiveConfig(config: RaceArchiveConfig) {
  ensureArchiveDir();
  fs.writeFileSync(
    archiveConfigPath(),
    JSON.stringify(config, jsonReplacer, 2),
    'utf-8',
  );
}

function raceRecordFilesInDir(dir: string) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('race_info_') && f.endsWith('.json'))
    .map((filename) => path.join(dir, filename));
}

function getArchiveUpdatedAt(archiveId: string) {
  const files = raceRecordFilesInDir(archiveDirPath(archiveId));
  let latest = 0;

  files.forEach((file) => {
    try {
      const stat = fs.statSync(file);
      latest = Math.max(latest, stat.mtimeMs);
    } catch (error) {
      log.error('[RaceData] Failed to stat race record:', file, error);
    }
  });

  return latest;
}

function removeStatsCache(archiveId: string) {
  const cachePath = statsCachePath(archiveId);
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
  }
}

function migrateLegacyArchivedRecords(config: RaceArchiveConfig) {
  raceRecordFilesInDir(RACE_DIR).forEach((file) => {
    try {
      const record = JSON.parse(fs.readFileSync(file, 'utf-8')) as RaceRecord;
      const archiveId = record.archiveId ?? DEFAULT_ARCHIVE_ID;
      if (archiveId === DEFAULT_ARCHIVE_ID) return;
      if (!config.archives.some((archive) => archive.id === archiveId)) return;

      const targetDir = archiveDirPath(archiveId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const target = path.join(targetDir, path.basename(file));
      record.fullPath = target;
      fs.writeFileSync(file, JSON.stringify(record, jsonReplacer, 2), 'utf-8');
      fs.renameSync(file, target);
    } catch (e) {
      log.error('[RaceData] Failed to migrate archived record:', file, e);
    }
  });
}

function uniqueMergedRaceRecordPath(
  targetDir: string,
  filename: string,
  sourceArchiveId: string,
) {
  const directTarget = path.join(targetDir, filename);
  if (!fs.existsSync(directTarget)) return directTarget;

  const parsed = path.parse(filename);
  const safeSourceId = sourceArchiveId.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
  let suffix = 1;
  let candidate = path.join(
    targetDir,
    `${parsed.name}_merged_${safeSourceId}_${suffix}${parsed.ext}`,
  );
  while (fs.existsSync(candidate)) {
    suffix += 1;
    candidate = path.join(
      targetDir,
      `${parsed.name}_merged_${safeSourceId}_${suffix}${parsed.ext}`,
    );
  }
  return candidate;
}

function mergeArchiveRecords(source: RaceArchive, target: RaceArchive) {
  const sourceDir = archiveDirPath(source.id);
  const targetDir = archiveDirPath(target.id);
  if (sourceDir === targetDir || !fs.existsSync(sourceDir)) return true;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let mergedAllRecords = true;
  raceRecordFilesInDir(sourceDir).forEach((sourceFile) => {
    const targetFile = uniqueMergedRaceRecordPath(
      targetDir,
      path.basename(sourceFile),
      source.id,
    );
    try {
      const record = JSON.parse(
        fs.readFileSync(sourceFile, 'utf-8'),
      ) as RaceRecord;
      record.archiveId = target.id;
      record.filename = path.basename(targetFile);
      record.fullPath = targetFile;
      fs.writeFileSync(targetFile, JSON.stringify(record, jsonReplacer, 2), {
        encoding: 'utf-8',
        flag: 'wx',
      });
      try {
        fs.unlinkSync(sourceFile);
      } catch (error) {
        fs.unlinkSync(targetFile);
        throw error;
      }
    } catch (error) {
      mergedAllRecords = false;
      log.error(
        `[RaceData] Failed to merge archive record ${sourceFile}:`,
        error,
      );
    }
  });

  removeStatsCache(source.id);
  removeStatsCache(target.id);
  return mergedAllRecords;
}

function mergeDuplicateArchives(config: RaceArchiveConfig) {
  const canonicalByName = new Map<string, RaceArchive>();
  const archives: RaceArchive[] = [];
  let changed = false;

  config.archives.forEach((archive) => {
    const key = archiveNameKey(archive.name);
    const canonical = canonicalByName.get(key);
    if (!canonical) {
      canonicalByName.set(key, archive);
      archives.push(archive);
      return;
    }

    if (!mergeArchiveRecords(archive, canonical)) {
      archives.push(archive);
      return;
    }

    changed = true;
    log.info(
      `[RaceData] Merged duplicate archive ${archive.id} into ${canonical.id} (${canonical.name})`,
    );
  });

  return {
    config: { archives },
    changed,
  };
}

function readArchiveConfig(runMigration = true): RaceArchiveConfig {
  ensureArchiveDir();
  const fallback: RaceArchiveConfig = {
    archives: [defaultArchive()],
  };
  const configPath = archiveConfigPath();
  if (!fs.existsSync(configPath)) return fallback;

  try {
    const config = JSON.parse(
      fs.readFileSync(configPath, 'utf-8'),
    ) as Partial<RaceArchiveConfig>;
    const archives = Array.isArray(config.archives)
      ? config.archives.filter((archive) => archive?.id && archive?.name)
      : [];
    if (!archives.some((archive) => archive.id === DEFAULT_ARCHIVE_ID)) {
      archives.unshift(defaultArchive());
    }
    let result = { archives };
    ensureArchiveFolders(result);
    if (runMigration) {
      migrateLegacyArchivedRecords(result);
      const merged = mergeDuplicateArchives(result);
      result = merged.config;
      if (merged.changed) {
        writeArchiveConfig(result);
      }
    }
    return result;
  } catch (e) {
    log.error('[RaceData] Failed to parse archive config:', e);
    return fallback;
  }
}

export function createRaceArchive(name: string) {
  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) throw new Error('存档名称不能为空');

  const config = readArchiveConfig();
  const existingArchive = config.archives.find(
    (archive) => archiveNameKey(archive.name) === archiveNameKey(trimmedName),
  );
  if (existingArchive) return existingArchive;

  const archive = {
    id: sanitizeArchiveId(trimmedName),
    name: trimmedName,
    createdAt: Date.now(),
  };
  config.archives.push(archive);
  ensureArchiveFolders(config);
  writeArchiveConfig(config);
  return archive;
}

function findRaceRecordFile(filename: string) {
  const config = readArchiveConfig(false);
  const candidates = config.archives.map((archive) =>
    path.join(archiveDirPath(archive.id), filename),
  );
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveArchiveIdFromFilePath(filePath: string, archiveIds?: string[]) {
  const config = readArchiveConfig(false);
  const ids = archiveIds ?? config.archives.map((archive) => archive.id);
  const matched = ids
    .map((archiveId) => ({
      archiveId,
      dir: archiveDirPath(archiveId),
    }))
    .filter(({ dir }) => filePath.startsWith(dir))
    .sort((a, b) => b.dir.length - a.dir.length);

  return matched[0]?.archiveId ?? DEFAULT_ARCHIVE_ID;
}

function toRoomKey(roomId: unknown): string | undefined {
  if (roomId == null) return undefined;
  if (typeof roomId === 'bigint') return roomId.toString();
  return String(roomId);
}

function resolveRoomKeyFromCandidate(candidate: any): string | undefined {
  const roomUserArray = candidate?.room_user_array;
  if (Array.isArray(roomUserArray) && roomUserArray.length > 0) {
    const keys = new Set(
      roomUserArray
        .map((u: any) => toRoomKey(u?.room_id))
        .filter((k: string | undefined): k is string => !!k),
    );
    if (keys.size === 1) {
      return [...keys][0];
    }
  }

  return (
    toRoomKey(candidate?.room_id) ??
    toRoomKey(candidate?.race_result_info?.room_id) ??
    toRoomKey(candidate?.result_info?.room_id)
  );
}

function resolveRaceNumFromCandidate(candidate: any): number | undefined {
  const raceNum = Number(
    candidate?.race_num ??
      candidate?.race_result_info?.race_num ??
      candidate?.result_info?.race_num,
  );
  if (!Number.isFinite(raceNum) || raceNum <= 0) {
    return undefined;
  }
  return raceNum;
}

function enqueueHistoryPayloads(candidates: any[]) {
  candidates.forEach((candidateRaw) => {
    const candidate = candidateRaw?.data ?? candidateRaw;
    if (!candidate || typeof candidate !== 'object') return;

    const historyInfoArray = candidate?.race_history_info_array;
    if (!Array.isArray(historyInfoArray)) return;

    historyInfoArray.forEach((historyInfo: any, historyIndex: number) => {
      const roomInfo = historyInfo?.room_info;
      const historyHorseData = historyInfo?.race_history_chara_result_array;
      const roomKey = toRoomKey(roomInfo?.room_id);

      if (
        !roomKey ||
        !roomInfo?.race_scenario ||
        !Array.isArray(historyHorseData) ||
        roomInfo?.random_seed == null
      ) {
        return;
      }

      const payload: PendingHistoryPayload = {
        scenario: roomInfo.race_scenario,
        historyHorses: historyHorseData,
        meta: roomInfo,
        raceNum: historyInfo?.race_num ?? historyIndex + 1,
        roomKey,
      };

      const queue = pendingHistoryByRoom.get(roomKey) ?? [];
      queue.push(payload);
      pendingHistoryByRoom.set(roomKey, queue);

      log.info(
        `[RaceData] Cached history payload room=${roomKey} raceNum=${payload.raceNum ?? -1}`,
      );
    });
  });
}

function extractDirectPayloads(candidates: any[]): RacePayload[] {
  const results: RacePayload[] = [];

  candidates.forEach((candidateRaw) => {
    const candidate = candidateRaw?.data ?? candidateRaw;
    if (!candidate || typeof candidate !== 'object') return;

    const raceScenario =
      candidate?.race_scenario ??
      candidate?.race_result_info?.race_scenario ??
      candidate?.result_info?.race_scenario ??
      null;

    const raceHorseData =
      candidate?.race_horse_data_array ??
      candidate?.race_result_info?.race_horse_data_array ??
      candidate?.result_info?.race_horse_data_array ??
      null;

    const raceMetaInfo =
      candidate?.race_result ??
      candidate?.race_result_info ??
      candidate?.result_info ??
      candidate ??
      null;

    if (
      raceScenario &&
      Array.isArray(raceHorseData) &&
      raceMetaInfo?.random_seed != null
    ) {
      results.push({
        scenario: raceScenario,
        horses: enrichPracticeRaceHorses(raceHorseData, candidate),
        meta: raceMetaInfo,
        raceNum: candidate?.race_num,
        roomKey: resolveRoomKeyFromCandidate(candidate),
      });
    }

    const roomInfoScenario = candidate?.room_info?.race_scenario ?? null;
    const roomInfoMeta = candidate?.room_info ?? null;
    if (
      roomInfoScenario &&
      Array.isArray(raceHorseData) &&
      roomInfoMeta?.random_seed != null
    ) {
      results.push({
        scenario: roomInfoScenario,
        horses: enrichPracticeRaceHorses(raceHorseData, candidate),
        meta: roomInfoMeta,
        raceNum: candidate?.race_num,
        roomKey: resolveRoomKeyFromCandidate(candidate),
      });
    }
  });

  return results;
}

function detailMatchKey(horse: any): string {
  return `${horse?.viewer_id ?? ''}|${horse?.team_id ?? ''}|${horse?.team_member_id ?? ''}`;
}

function detailFallbackKey(horse: any): string {
  return `${horse?.team_id ?? ''}|${horse?.team_member_id ?? ''}`;
}

function mergeHistoryAndDetailHorses(
  historyHorses: any[],
  detailHorses: any[],
) {
  const detailByMainKey = new Map<string, any>();
  const detailByFallbackKey = new Map<string, any>();

  detailHorses.forEach((horse) => {
    detailByMainKey.set(detailMatchKey(horse), horse);
    detailByFallbackKey.set(detailFallbackKey(horse), horse);
  });

  let matchedCount = 0;
  const merged = historyHorses.map((historyHorse) => {
    const detail =
      detailByMainKey.get(detailMatchKey(historyHorse)) ??
      detailByFallbackKey.get(detailFallbackKey(historyHorse));

    if (detail) matchedCount += 1;
    return detail ? { ...historyHorse, ...detail } : historyHorse;
  });

  if (historyHorses.length > 0 && matchedCount === 0) {
    return null;
  }

  return merged;
}

function tryCompletePendingPayloads(candidates: any[]): RacePayload[] {
  const completed: RacePayload[] = [];

  candidates.forEach((candidateRaw) => {
    const candidate = candidateRaw?.data ?? candidateRaw;
    if (!candidate || typeof candidate !== 'object') return;

    const detailHorses =
      candidate?.race_horse_data_array ??
      candidate?.race_result_info?.race_horse_data_array ??
      candidate?.result_info?.race_horse_data_array;

    if (!Array.isArray(detailHorses) || detailHorses.length === 0) return;

    const roomKey = resolveRoomKeyFromCandidate(candidate);
    if (!roomKey) return;

    const queue = pendingHistoryByRoom.get(roomKey);
    if (!queue || queue.length === 0) return;

    const candidateRaceNum = resolveRaceNumFromCandidate(candidate);
    let pendingIndex = queue.length - 1;
    if (candidateRaceNum != null) {
      const matchedIndex = queue.findIndex(
        (item) => item.raceNum === candidateRaceNum,
      );
      if (matchedIndex >= 0) {
        pendingIndex = matchedIndex;
      } else {
        log.warn(
          `[RaceData] room=${roomKey} got detail raceNum=${candidateRaceNum}, but no pending raceNum matched; fallback to latest pending`,
        );
      }
    }

    const pending = queue[pendingIndex];
    const mergedHorses = mergeHistoryAndDetailHorses(
      pending.historyHorses,
      detailHorses,
    );

    if (!mergedHorses) {
      log.warn(
        `[RaceData] Skip completion room=${roomKey}, horse match failed (pending=${pending.historyHorses.length}, detail=${detailHorses.length})`,
      );
      return;
    }

    completed.push({
      scenario: pending.scenario,
      horses: mergedHorses,
      meta: pending.meta,
      raceNum: pending.raceNum,
      roomKey,
    });

    queue.splice(pendingIndex, 1);
    if (queue.length === 0) {
      pendingHistoryByRoom.delete(roomKey);
    } else {
      pendingHistoryByRoom.set(roomKey, queue);
    }

    log.info(
      `[RaceData] Completed cached payload room=${roomKey} raceNum=${pending.raceNum ?? -1}`,
    );
  });

  return completed;
}

function dedupePayloads(payloads: RacePayload[]): RacePayload[] {
  const seen = new Set<string>();

  return payloads.filter((payload) => {
    const key = [
      payload.meta?.random_seed ?? '',
      payload.raceNum ?? '',
      payload.roomKey ?? '',
      payload.horses.length,
      payload.scenario.slice(0, 24),
    ].join('|');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function persistPayloads(
  payloads: RacePayload[],
  archiveId: string,
  notify?: (record: RaceRecord) => void,
) {
  const now = Date.now();
  const config = readArchiveConfig(false);
  if (!config.archives.some((archive) => archive.id === archiveId)) {
    throw new Error('目标比赛存档不存在');
  }
  const targetDir = archiveDirPath(archiveId);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const records = payloads.map((payload, index) => {
    const raceNum = payload.raceNum ?? index + 1;
    const filename = `race_info_${now}_r${raceNum}_${index}.json`;
    const filepath = path.join(targetDir, filename);

    const record = {
      filename,
      fullPath: filepath,
      createdAt: payload.meta?.start_time ?? new Date().toISOString(),
      archiveId,
      raceMetaInfo: {
        race_instance_id: payload.meta?.race_instance_id ?? -1,
        season: payload.meta?.season ?? -1,
        weather: payload.meta?.weather ?? -1,
        ground_condition: payload.meta?.ground_condition ?? -1,
        random_seed: payload.meta?.random_seed ?? -1,
        entry_num: payload.meta?.entry_num ?? -1,
        current_entry_num: payload.meta?.current_entry_num ?? -1,
      } as RaceMetaInfo,
      scenario: payload.scenario,
      horses: payload.horses,
    } as RaceRecord;

    fs.writeFileSync(
      filepath,
      JSON.stringify(record, jsonReplacer, 2),
      'utf-8',
    );
    log.info(`[RaceData] Saved to ${filepath}`);
    notify?.(record);
    return record;
  });
  removeStatsCache(archiveId);
  return records;
}

function collectRacePayloads(decodedData: any) {
  const root = decodedData?.data ?? decodedData;
  const candidates = Array.isArray(root) ? root : [root];

  enqueueHistoryPayloads(candidates);

  const directPayloads = extractDirectPayloads(candidates);
  const completedPayloads = tryCompletePendingPayloads(candidates);
  return dedupePayloads([...directPayloads, ...completedPayloads]);
}

export function persistRaceInfoToArchive(
  decodedData: any,
  archiveId: string,
  notify?: (record: RaceRecord) => void,
) {
  const payloads = collectRacePayloads(decodedData);
  if (payloads.length === 0) {
    throw new Error('练习接口没有返回可保存的 RaceData');
  }
  return persistPayloads(payloads, archiveId, notify);
}

export function handleRaceInfo(decodedData: any, win: BrowserWindow) {
  const payloads = collectRacePayloads(decodedData);

  if (payloads.length === 0) return;

  try {
    persistPayloads(payloads, DEFAULT_ARCHIVE_ID, (record) => {
      win.webContents.send('race:new', record);
    });
  } catch (e: any) {
    log.error(`[RaceData] Save failed: ${e.message}`);
  }
}

export function handleRaceList(ipcMain: IpcMain) {
  ipcMain.handle('race:list', async (_, archiveId?: string) => {
    const config = readArchiveConfig();
    const archivesToRead = archiveId
      ? config.archives.filter((archive) => archive.id === archiveId)
      : config.archives;

    const files = archivesToRead
      .flatMap((archive) =>
        raceRecordFilesInDir(archiveDirPath(archive.id)).map((file) => ({
          archiveId: archive.id,
          file,
        })),
      )
      .flatMap(({ archiveId: currentArchiveId, file }) => {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const record = JSON.parse(content) as RaceRecord;
          record.archiveId = currentArchiveId;
          record.fullPath = file;
          return [record];
        } catch (e) {
          log.error('[RaceData] Failed to parse:', file, e);
          return [];
        }
      });

    return files;
  });

  ipcMain.handle('race:archives', async () => readArchiveConfig());

  ipcMain.handle('race:stats-cache-get', async (_, archiveId: string) => {
    const resolvedArchiveId = archiveId || DEFAULT_ARCHIVE_ID;
    const cachePath = statsCachePath(resolvedArchiveId);
    const archiveUpdatedAt = getArchiveUpdatedAt(resolvedArchiveId);

    if (!fs.existsSync(cachePath)) {
      return {
        archiveId: resolvedArchiveId,
        archiveUpdatedAt,
        cachedArchiveUpdatedAt: 0,
        cacheUpdatedAt: 0,
        version: 0,
        data: null,
      };
    }

    try {
      const payload = JSON.parse(
        fs.readFileSync(cachePath, 'utf-8'),
      ) as RaceStatsCachePayload;
      return {
        archiveId: resolvedArchiveId,
        archiveUpdatedAt,
        cachedArchiveUpdatedAt: payload.archiveUpdatedAt ?? 0,
        cacheUpdatedAt: payload.cacheUpdatedAt ?? 0,
        version: payload.version ?? 0,
        data: payload.data ?? null,
      };
    } catch (error) {
      log.error('[RaceData] Failed to parse stats cache:', cachePath, error);
      return {
        archiveId: resolvedArchiveId,
        archiveUpdatedAt,
        cachedArchiveUpdatedAt: 0,
        cacheUpdatedAt: 0,
        version: 0,
        data: null,
      };
    }
  });

  ipcMain.handle(
    'race:stats-cache-set',
    async (
      _,
      archiveId: string,
      payload: { version: number; archiveUpdatedAt: number; data: unknown },
    ) => {
      const resolvedArchiveId = archiveId || DEFAULT_ARCHIVE_ID;
      const cachePath = statsCachePath(resolvedArchiveId);
      const cachePayload: RaceStatsCachePayload = {
        archiveId: resolvedArchiveId,
        version: payload?.version ?? 0,
        archiveUpdatedAt: payload?.archiveUpdatedAt ?? 0,
        cacheUpdatedAt: Date.now(),
        data: payload?.data ?? null,
      };
      fs.writeFileSync(
        cachePath,
        JSON.stringify(cachePayload, jsonReplacer, 2),
        'utf-8',
      );
      return {
        ...cachePayload,
        cachedArchiveUpdatedAt: cachePayload.archiveUpdatedAt,
      };
    },
  );

  ipcMain.handle('race:archive-create', async (_, name: string) => {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) return readArchiveConfig();

    createRaceArchive(trimmedName);
    return readArchiveConfig();
  });

  ipcMain.handle('race:archive-delete', async (_, archiveId: string) => {
    if (archiveId === DEFAULT_ARCHIVE_ID) return readArchiveConfig();

    const config = readArchiveConfig();
    const archive = config.archives.find((item) => item.id === archiveId);
    if (!archive) return config;

    const archiveDir = archiveDirPath(archiveId);
    if (fs.existsSync(archiveDir)) {
      fs.rmSync(archiveDir, { recursive: true, force: true });
    }

    const nextConfig = {
      archives: config.archives.filter((item) => item.id !== archiveId),
    };
    writeArchiveConfig(nextConfig);
    removeStatsCache(archiveId);
    return nextConfig;
  });

  ipcMain.handle(
    'race:archive-assign',
    async (_, filenames: string[], archiveId: string) => {
      const config = readArchiveConfig();
      if (!config.archives.some((archive) => archive.id === archiveId)) {
        return false;
      }

      const affectedArchives = new Set<string>();
      filenames.forEach((name) => {
        const file = findRaceRecordFile(name);
        if (!file || !fs.existsSync(file)) return;
        affectedArchives.add(resolveArchiveIdFromFilePath(file));
        try {
          const record = JSON.parse(
            fs.readFileSync(file, 'utf-8'),
          ) as RaceRecord;
          const targetDir = archiveDirPath(archiveId);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          const target = path.join(targetDir, name);
          record.archiveId = archiveId;
          record.fullPath = target;
          fs.writeFileSync(
            file,
            JSON.stringify(record, jsonReplacer, 2),
            'utf-8',
          );
          if (file !== target) {
            if (fs.existsSync(target)) fs.unlinkSync(target);
            fs.renameSync(file, target);
          }
        } catch (e) {
          log.error('[RaceData] Failed to assign archive:', file, e);
        }
      });
      affectedArchives.add(archiveId);
      affectedArchives.forEach((id) => removeStatsCache(id));
      return true;
    },
  );

  ipcMain.handle('race:delete', async (_, filenames: string[]) => {
    const affectedArchives = new Set<string>();
    filenames.forEach((name) => {
      const file = findRaceRecordFile(name);
      if (file && fs.existsSync(file)) {
        const archiveId = resolveArchiveIdFromFilePath(file);
        affectedArchives.add(archiveId);
        fs.unlinkSync(file);
      }
    });
    affectedArchives.forEach((archiveId) => removeStatsCache(archiveId));
    return true;
  });
}

export function ensureRaceDir() {
  ensureArchiveDir();
}
