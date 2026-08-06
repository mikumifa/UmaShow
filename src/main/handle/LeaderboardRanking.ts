import fs from 'fs';
import path from 'path';
import { BrowserWindow, IpcMain } from 'electron';
import log from 'electron-log';
import { decode } from '@msgpack/msgpack';
import { jsonReplacer } from 'main/util';
import { RACE_DIR } from 'main/paths';
import { getDebugPacketDir } from './DebugPackets';

export type LeaderboardTeamMember = {
  team_member_id?: number;
  trained_chara_id?: number;
  card_id?: number;
  final_grade?: number;
  rarity?: number;
  talent_level?: number;
  race_cloth_id?: number;
  running_style?: number;
  [key: string]: unknown;
};

export type LeaderboardRankingEntry = {
  rank: number;
  league_score?: number;
  viewer_id?: string | number;
  snapshot_id?: string | number;
  team_name?: string;
  team_member_array: LeaderboardTeamMember[];
  leader_chara_id?: number;
  leader_chara_dress_id?: number;
  honor_id?: number;
  honor_data?: unknown;
  rankingKey?: string;
  [key: string]: unknown;
};

export type LeaderboardSuccessionChara = {
  position_id?: number;
  card_id?: number;
  rank?: number;
  rarity?: number;
  talent_level?: number;
  owner_viewer_id?: string | number;
  [key: string]: unknown;
};

export type LeaderboardCharaDetail = {
  key: string;
  viewer_id?: string | number;
  trained_chara_id?: string | number;
  card_id?: number;
  owner_viewer_id?: string | number;
  succession_chara_array: LeaderboardSuccessionChara[];
  updatedAt: number;
};

export type LeaderboardRankingSnapshot = {
  version: number;
  updatedAt: number;
  source: string;
  rankings: Record<string, LeaderboardRankingEntry[]>;
  details?: Record<string, LeaderboardCharaDetail>;
};

const SNAPSHOT_VERSION = 2;
const SNAPSHOT_FILENAME = 'leaderboard_ranking_latest.json';

function snapshotPath() {
  return path.join(RACE_DIR, SNAPSHOT_FILENAME);
}

function ensureRankingDir() {
  if (!fs.existsSync(RACE_DIR)) {
    fs.mkdirSync(RACE_DIR, { recursive: true });
  }
}

function numberValue(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function detailKey(viewerId: unknown, trainedCharaId: unknown) {
  if (viewerId == null || trainedCharaId == null) return undefined;
  return `${String(viewerId)}:${String(trainedCharaId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRankingEntry(value: unknown): value is LeaderboardRankingEntry {
  const item = value as Record<string, unknown> | null;
  return (
    !!item &&
    typeof item === 'object' &&
    numberValue(item.rank) != null &&
    Array.isArray(item.team_member_array)
  );
}

function normalizeRankingEntry(
  item: LeaderboardRankingEntry,
  rankingKey: string,
): LeaderboardRankingEntry {
  return {
    ...item,
    rank: numberValue(item.rank) ?? 0,
    rankingKey,
    team_member_array: item.team_member_array.map((member) => ({ ...member })),
  };
}

function collectRankingArrays(
  value: unknown,
  result: Record<string, LeaderboardRankingEntry[]>,
  pathParts: string[] = [],
) {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    if (value.some(isRankingEntry)) {
      const key = pathParts[pathParts.length - 1] ?? 'ranking_array';
      result[key] = value
        .filter(isRankingEntry)
        .map((entry) => normalizeRankingEntry(entry, key));
    } else {
      value.forEach((item, index) => {
        collectRankingArrays(item, result, [...pathParts, String(index)]);
      });
    }
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    if (/^ranking_array\d*$/i.test(key) && Array.isArray(child)) {
      const entries = child
        .filter(isRankingEntry)
        .map((entry) => normalizeRankingEntry(entry, key));
      if (entries.length > 0) {
        result[key] = entries;
        return;
      }
    }

    collectRankingArrays(child, result, [...pathParts, key]);
  });
}

function rankingsFromPacket(decodedData: unknown) {
  const rankings: Record<string, LeaderboardRankingEntry[]> = {};
  collectRankingArrays(decodedData, rankings);
  return rankings;
}

function collectCharaDetails(
  value: unknown,
  result: Record<string, LeaderboardCharaDetail>,
  updatedAt: number,
) {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectCharaDetails(item, result, updatedAt));
    return;
  }

  const record = value as Record<string, unknown>;
  const maybeChara = isRecord(record.trained_chara)
    ? record.trained_chara
    : record;
  const successionCharaArray = maybeChara.succession_chara_array;
  const key = detailKey(maybeChara.viewer_id, maybeChara.trained_chara_id);

  if (key && Array.isArray(successionCharaArray)) {
    result[key] = {
      key,
      viewer_id: maybeChara.viewer_id as string | number | undefined,
      trained_chara_id: maybeChara.trained_chara_id as
        | string
        | number
        | undefined,
      card_id: numberValue(maybeChara.card_id),
      owner_viewer_id: maybeChara.owner_viewer_id as
        | string
        | number
        | undefined,
      succession_chara_array: successionCharaArray.map((item) => ({
        ...(isRecord(item) ? item : {}),
      })) as LeaderboardSuccessionChara[],
      updatedAt,
    };
  }

  Object.values(record).forEach((child) => {
    collectCharaDetails(child, result, updatedAt);
  });
}

function detailsFromPacket(decodedData: unknown, updatedAt = Date.now()) {
  const details: Record<string, LeaderboardCharaDetail> = {};
  collectCharaDetails(decodedData, details, updatedAt);
  return details;
}

function writeSnapshot(snapshot: LeaderboardRankingSnapshot) {
  ensureRankingDir();
  fs.writeFileSync(
    snapshotPath(),
    JSON.stringify(snapshot, jsonReplacer, 2),
    'utf-8',
  );
}

function readSnapshotFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as LeaderboardRankingSnapshot;
}

function readExistingSnapshot() {
  const file = snapshotPath();
  if (!fs.existsSync(file)) return undefined;
  try {
    return readSnapshotFile(file);
  } catch (error) {
    log.error('[LeaderboardRanking] Failed to parse snapshot:', error);
    return undefined;
  }
}

function decodeDebugPacketFile(filePath: string) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    receivedAt?: string;
    rawBodyBase64?: string;
    data?: unknown;
  };

  if (content.data != null) {
    return {
      receivedAt: content.receivedAt,
      data: content.data,
    };
  }

  if (!content.rawBodyBase64) return undefined;
  const buffer = Buffer.from(content.rawBodyBase64, 'base64');
  return {
    receivedAt: content.receivedAt,
    data: decode(buffer, {
      mapKeyConverter: (key) => {
        if (key === null) return '__null__';
        if (typeof key === 'string' || typeof key === 'number') return key;
        return String(key);
      },
    }),
  };
}

function loadLatestSnapshotFromDebugPackets() {
  const debugPacketDirs = Array.from(
    new Set([
      getDebugPacketDir(),
      path.join(process.cwd(), 'debug_packets'),
      path.join(process.cwd(), 'tmp'),
    ]),
  ).filter((dir) => fs.existsSync(dir));

  if (debugPacketDirs.length === 0) return null;

  const candidates = debugPacketDirs
    .flatMap((debugPacketDir) =>
      fs
        .readdirSync(debugPacketDir)
        .filter((filename) => filename.startsWith('response_packet_'))
        .map((filename) => {
          const fullPath = path.join(debugPacketDir, filename);
          return {
            filename,
            fullPath,
            mtimeMs: fs.statSync(fullPath).mtimeMs,
          };
        }),
    )
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates.reduce<LeaderboardRankingSnapshot | null>(
    (found, candidate) => {
      if (found) return found;

      try {
        const packet = decodeDebugPacketFile(candidate.fullPath);
        if (!packet) return null;
        const updatedAt = packet.receivedAt
          ? new Date(packet.receivedAt).getTime()
          : candidate.mtimeMs;
        const rankings = rankingsFromPacket(packet.data);
        const details = detailsFromPacket(packet.data, updatedAt);
        const total = Object.values(rankings).reduce(
          (sum, entries) => sum + entries.length,
          0,
        );
        if (total === 0) return null;

        return {
          version: SNAPSHOT_VERSION,
          updatedAt,
          source: candidate.fullPath,
          rankings,
          details,
        } satisfies LeaderboardRankingSnapshot;
      } catch (error) {
        log.warn('[LeaderboardRanking] Failed to inspect debug packet:', error);
        return null;
      }
    },
    null,
  );
}

function loadDetailsFromDebugPackets() {
  const debugPacketDirs = Array.from(
    new Set([
      getDebugPacketDir(),
      path.join(process.cwd(), 'debug_packets'),
      path.join(process.cwd(), 'tmp'),
    ]),
  ).filter((dir) => fs.existsSync(dir));

  const details: Record<string, LeaderboardCharaDetail> = {};
  debugPacketDirs.forEach((debugPacketDir) => {
    fs.readdirSync(debugPacketDir)
      .filter((filename) => filename.startsWith('response_packet_'))
      .forEach((filename) => {
        const fullPath = path.join(debugPacketDir, filename);
        try {
          const packet = decodeDebugPacketFile(fullPath);
          if (!packet) return;
          const updatedAt = packet.receivedAt
            ? new Date(packet.receivedAt).getTime()
            : fs.statSync(fullPath).mtimeMs;
          Object.assign(details, detailsFromPacket(packet.data, updatedAt));
        } catch (error) {
          log.warn(
            '[LeaderboardRanking] Failed to inspect detail packet:',
            error,
          );
        }
      });
  });
  return details;
}

export function persistLeaderboardSnapshotFromPacket(
  decodedData: unknown,
  win?: BrowserWindow,
) {
  const rankings = rankingsFromPacket(decodedData);
  const details = detailsFromPacket(decodedData);
  const total = Object.values(rankings).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  const detailTotal = Object.keys(details).length;
  if (total === 0 && detailTotal === 0) return;

  const existing = readExistingSnapshot();

  const snapshot: LeaderboardRankingSnapshot = {
    version: SNAPSHOT_VERSION,
    updatedAt: Date.now(),
    source: total > 0 ? 'live-packet' : (existing?.source ?? 'live-packet'),
    rankings: total > 0 ? rankings : (existing?.rankings ?? {}),
    details: {
      ...(existing?.details ?? {}),
      ...details,
    },
  };

  try {
    writeSnapshot(snapshot);
    win?.webContents.send('leaderboard-ranking:new', snapshot);
    log.info(
      `[LeaderboardRanking] Saved ${total} ranking entries, ${detailTotal} detail entries`,
    );
  } catch (error) {
    log.error('[LeaderboardRanking] Save failed:', error);
  }
}

export function handleLeaderboardRanking(ipcMain: IpcMain) {
  ipcMain.handle('leaderboard-ranking:latest', async () => {
    ensureRankingDir();
    const existing = readExistingSnapshot();
    if (existing) {
      const debugDetails = loadDetailsFromDebugPackets();
      if (Object.keys(debugDetails).length > 0) {
        const snapshot = {
          ...existing,
          version: SNAPSHOT_VERSION,
          details: {
            ...(existing.details ?? {}),
            ...debugDetails,
          },
        } satisfies LeaderboardRankingSnapshot;
        writeSnapshot(snapshot);
        return snapshot;
      }
      return existing;
    }

    const snapshot = loadLatestSnapshotFromDebugPackets();
    if (snapshot) {
      writeSnapshot(snapshot);
      return snapshot;
    }

    return null;
  });
}
