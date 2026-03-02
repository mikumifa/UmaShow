import { BrowserWindow, IpcMain } from 'electron';
import fs from 'fs';

import path from 'path';
import log from 'electron-log';
import { RaceMetaInfo, RaceRecord } from 'types/gameTypes';
import { jsonReplacer } from 'main/util';
import { RACE_DIR } from 'main/paths';

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
        horses: raceHorseData,
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
        horses: raceHorseData,
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

function persistPayloads(payloads: RacePayload[], win: BrowserWindow) {
  const now = Date.now();

  payloads.forEach((payload, index) => {
    const raceNum = payload.raceNum ?? index + 1;
    const filename = `race_info_${now}_r${raceNum}_${index}.json`;
    const filepath = path.join(RACE_DIR, filename);

    const record = {
      filename,
      fullPath: filepath,
      createdAt: payload.meta?.start_time ?? new Date().toISOString(),
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
    win.webContents.send('race:new', record);
  });
}

export function handleRaceInfo(decodedData: any, win: BrowserWindow) {
  const root = decodedData?.data ?? decodedData;
  const candidates = Array.isArray(root) ? root : [root];

  enqueueHistoryPayloads(candidates);

  const directPayloads = extractDirectPayloads(candidates);
  const completedPayloads = tryCompletePendingPayloads(candidates);
  const payloads = dedupePayloads([...directPayloads, ...completedPayloads]);

  if (payloads.length === 0) return;

  try {
    persistPayloads(payloads, win);
  } catch (e: any) {
    log.error(`[RaceData] Save failed: ${e.message}`);
  }
}

export function handleRaceList(ipcMain: IpcMain) {
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
          log.error('[RaceData] Failed to parse:', full, e);
          return [];
        }
      });

    return files;
  });

  ipcMain.handle('race:delete', async (_, filenames: string[]) => {
    filenames.forEach((name) => {
      const file = path.join(RACE_DIR, name);
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    return true;
  });
}

export function ensureRaceDir() {
  if (!fs.existsSync(RACE_DIR)) {
    fs.mkdirSync(RACE_DIR, { recursive: true });
  }
}
