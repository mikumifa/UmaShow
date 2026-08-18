import fs from 'fs';
import path from 'path';
import { app, IpcMain } from 'electron';
import {
  getAutoResearchAccountCredential,
  saveAutoResearchAccountCredential,
} from './AutoResearchCredentials';
import {
  parseSuccessionPlayerIds,
  SuccessionGameClient,
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

let scanRunning = false;

export function handleSuccessionPlayerScan(ipcMain: IpcMain) {
  ipcMain.handle('succession-player-scan:list', () => readPlayers());
  ipcMain.handle('succession-player-scan:clear', () => {
    if (scanRunning) throw new Error('请等待当前玩家扫描完成');
    writePlayers([]);
    return [];
  });
  ipcMain.handle(
    'succession-player-scan:scan',
    async (event, accountId: string, rawPlayerIds: string) => {
      if (scanRunning) throw new Error('已有玩家扫描任务正在运行');
      const playerIds = parseSuccessionPlayerIds(rawPlayerIds);
      if (!playerIds.length) throw new Error('请至少填写一个有效的玩家 ID');
      const credential = getAutoResearchAccountCredential(accountId);
      scanRunning = true;
      const progress = (value: SuccessionGameProgress) => {
        event.sender.send('succession-player-scan:progress', {
          ...value,
          detail: value.stage === 'login' ? '正在准备所选账号' : value.detail,
        });
      };
      const client = new SuccessionGameClient(
        credential.uid,
        credential.accessKey,
        progress,
      );
      const added: StoredSuccessionPlayer[] = [];
      const errors: Array<{ viewerId: string; message: string }> = [];
      try {
        await client.login();
        const refreshedCredential = client.credential;
        if (refreshedCredential.accessKey !== credential.accessKey) {
          saveAutoResearchAccountCredential({
            ...refreshedCredential,
            source: '玩家扫描登录刷新',
            capturedAt: new Date().toISOString(),
          });
        }
        let lastScanStartedAt = 0;
        for (let index = 0; index < playerIds.length; index += 1) {
          const viewerId = playerIds[index];
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
            total: playerIds.length,
          });
          try {
            // 游戏接口需要按顺序更新 SID，不能并发请求。
            // eslint-disable-next-line no-await-in-loop
            const result = await client.searchPlayer(viewerId);
            added.push({
              viewerId,
              name: String(result.userInfo?.name || `玩家 ${viewerId}`),
              fetchedAt: new Date().toISOString(),
              userInfo: result.userInfo,
              practicePartner: result.practicePartner,
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
        return { players, added, errors };
      } finally {
        scanRunning = false;
      }
    },
  );
}
