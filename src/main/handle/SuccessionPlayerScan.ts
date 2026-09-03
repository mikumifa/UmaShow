import fs from 'fs';
import path from 'path';
import { app, IpcMain } from 'electron';
import {
  loginAutoResearchLocalGameClient,
  withAutoResearchLocalGameClient,
} from './AutoResearchLocalGameClient';
import {
  parseSuccessionPlayerIds,
  SuccessionGameProgress,
} from './SuccessionGameClient';

export type StoredSuccessionPlayer = {
  viewerId: string;
  name: string;
  fetchedAt: string;
  userInfo: Record<string, any>;
  practicePartner: Record<string, any>;
};

type StoredSuccessionPlayers = {
  version: 1;
  players: StoredSuccessionPlayer[];
};

function storagePath() {
  return path.join(app.getPath('userData'), 'succession-players.json');
}

function readPlayers() {
  try {
    const payload = JSON.parse(
      fs.readFileSync(storagePath(), 'utf8'),
    ) as StoredSuccessionPlayers;
    return Array.isArray(payload?.players) ? payload.players : [];
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }
}

function writePlayers(players: StoredSuccessionPlayer[]) {
  const destination = storagePath();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    JSON.stringify({ version: 1, players }, null, 2),
    'utf8',
  );
}

export function mergeStoredSuccessionPlayers(
  current: StoredSuccessionPlayer[],
  incoming: StoredSuccessionPlayer[],
) {
  const byViewerId = new Map(current.map((item) => [item.viewerId, item]));
  incoming.forEach((item) => byViewerId.set(item.viewerId, item));
  return [...byViewerId.values()].sort((left, right) =>
    right.fetchedAt.localeCompare(left.fetchedAt),
  );
}

export function selectSuccessionPlayerIdsForScan(
  playerIds: string[],
  current: StoredSuccessionPlayer[],
  updateExisting: boolean,
) {
  if (updateExisting) return { pending: playerIds, skipped: [] as string[] };
  const existingViewerIds = new Set(current.map((item) => item.viewerId));
  return {
    pending: playerIds.filter((viewerId) => !existingViewerIds.has(viewerId)),
    skipped: playerIds.filter((viewerId) => existingViewerIds.has(viewerId)),
  };
}

export function normalizeImportedSuccessionPlayers(
  payload: unknown,
): StoredSuccessionPlayer[] {
  const source = Array.isArray(payload)
    ? payload
    : (payload as { players?: unknown } | null)?.players;
  if (!Array.isArray(source)) {
    throw new Error('导入文件不是有效的种马数据');
  }
  const players = source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, any>;
    const viewerId = String(
      record.viewerId ?? record.userInfo?.viewer_id ?? '',
    ).trim();
    const { practicePartner } = record;
    if (
      !/^\d{6,16}$/.test(viewerId) ||
      !practicePartner ||
      typeof practicePartner !== 'object' ||
      Array.isArray(practicePartner)
    ) {
      return [];
    }
    const fetchedAt = Number.isNaN(Date.parse(String(record.fetchedAt || '')))
      ? new Date().toISOString()
      : new Date(record.fetchedAt).toISOString();
    return [
      {
        viewerId,
        name: String(
          record.name || record.userInfo?.name || `玩家 ${viewerId}`,
        ),
        fetchedAt,
        userInfo:
          record.userInfo && typeof record.userInfo === 'object'
            ? record.userInfo
            : { viewer_id: Number(viewerId) },
        practicePartner,
      },
    ];
  });
  if (!players.length && source.length) {
    throw new Error('导入文件中没有可识别的种马记录');
  }
  return mergeStoredSuccessionPlayers([], players);
}

let scanRunning = false;

export function handleSuccessionPlayerScan(ipcMain: IpcMain) {
  ipcMain.handle('succession-player-scan:list', () => readPlayers());
  ipcMain.handle('succession-player-scan:clear', () => {
    if (scanRunning) throw new Error('请等待当前玩家扫描完成');
    writePlayers([]);
    return [];
  });
  ipcMain.handle('succession-player-scan:import', (_, payload: unknown) => {
    if (scanRunning) throw new Error('请等待当前玩家扫描完成');
    const imported = normalizeImportedSuccessionPlayers(payload);
    const players = mergeStoredSuccessionPlayers(readPlayers(), imported);
    writePlayers(players);
    return { players, importedCount: imported.length };
  });
  ipcMain.handle(
    'succession-player-scan:scan',
    async (
      event,
      accountId: string,
      rawPlayerIds: string,
      updateExisting = true,
    ) => {
      if (scanRunning) throw new Error('已有玩家扫描任务正在运行');
      const playerIds = parseSuccessionPlayerIds(rawPlayerIds);
      if (!playerIds.length) throw new Error('请至少填写一个有效的玩家 ID');
      const currentPlayers = readPlayers();
      const { pending, skipped } = selectSuccessionPlayerIdsForScan(
        playerIds,
        currentPlayers,
        updateExisting,
      );
      if (!pending.length) {
        return { players: currentPlayers, added: [], errors: [], skipped };
      }
      scanRunning = true;
      const progress = (value: SuccessionGameProgress) => {
        event.sender.send('succession-player-scan:progress', {
          ...value,
          detail: value.stage === 'login' ? '正在准备所选账号' : value.detail,
        });
      };
      const added: StoredSuccessionPlayer[] = [];
      const errors: Array<{ viewerId: string; message: string }> = [];
      try {
        await loginAutoResearchLocalGameClient(accountId, {
          credentialRefreshSource: '玩家扫描登录刷新',
          onProgress: progress,
        });
        const result = await withAutoResearchLocalGameClient(
          accountId,
          async (client) => {
            let lastScanStartedAt = 0;
            for (let index = 0; index < pending.length; index += 1) {
              const viewerId = pending[index];
              const waitMs = 500 - (Date.now() - lastScanStartedAt);
              if (waitMs > 0) {
                // 玩家搜索固定按至少 0.5 秒的间隔顺序请求。
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => {
                  setTimeout(resolve, waitMs);
                });
              }
              lastScanStartedAt = Date.now();
              progress({
                stage: 'scan',
                detail: `正在扫描玩家 ${viewerId}`,
                viewerId,
                current: index + 1,
                total: pending.length,
              });
              try {
                // 游戏接口需要按顺序更新 SID，不能并发请求。
                // eslint-disable-next-line no-await-in-loop
                const playerResult = await client.searchPlayer(viewerId);
                added.push({
                  viewerId,
                  name: String(
                    playerResult.userInfo?.name || `玩家 ${viewerId}`,
                  ),
                  fetchedAt: new Date().toISOString(),
                  userInfo: playerResult.userInfo,
                  practicePartner: playerResult.practicePartner,
                });
              } catch (error) {
                errors.push({
                  viewerId,
                  message: (error as Error).message,
                });
              }
            }
            const players = mergeStoredSuccessionPlayers(readPlayers(), added);
            writePlayers(players);
            return { players, added, errors, skipped };
          },
        );
        return result;
      } finally {
        scanRunning = false;
      }
    },
  );
}
