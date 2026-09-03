import type { IpcMain } from 'electron';
import type { RaceRecord } from 'types/gameTypes';
import { withAutoResearchLocalGameClient } from './AutoResearchLocalGameClient';
import { createRaceArchive, persistRaceInfoToArchive } from './RaceInfo';
import {
  buildPracticeRaceStartPayload,
  getPracticeRaceSourceViewerIds,
  PracticeRaceSource,
} from './PracticeRaceRequest';

type PracticeRaceSimulationInput = {
  accountId: string;
  archiveName: string;
  count: number;
  source: PracticeRaceSource;
};

let simulationRunning = false;

function wait(duration: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

export default function handlePracticeRaceSimulation(ipcMain: IpcMain) {
  ipcMain.handle(
    'race:repeat-simulation',
    async (event, rawInput: PracticeRaceSimulationInput) => {
      if (simulationRunning) {
        throw new Error('已有重复模拟任务正在运行');
      }

      const input = rawInput ?? ({} as PracticeRaceSimulationInput);
      const count = Math.floor(Number(input.count));
      const archiveName = String(input.archiveName ?? '').trim();
      if (!input.accountId) throw new Error('请先选择一个账号');
      if (!archiveName) throw new Error('请填写存档名称');
      if (!Number.isFinite(count) || count < 1 || count > 1000) {
        throw new Error('模拟次数需要在 1 到 1000 之间');
      }

      const requestPayload = buildPracticeRaceStartPayload(input.source);
      const sourceViewerIds = getPracticeRaceSourceViewerIds(requestPayload);
      let archive: ReturnType<typeof createRaceArchive> | undefined;
      let completed = 0;
      simulationRunning = true;

      const progress = (payload: Record<string, unknown>) => {
        event.sender.send('race:repeat-simulation:progress', payload);
      };
      try {
        const result = await withAutoResearchLocalGameClient(
          input.accountId,
          {
            login: 'force',
            credentialRefreshSource: '重复模拟登录刷新',
            onProgress: (value) => {
              progress({
                stage: 'login',
                detail:
                  value.stage === 'login' ? '正在准备所选账号' : value.detail,
                current: completed,
                total: count,
              });
            },
          },
          async (client) => {
            if (!sourceViewerIds.includes(client.viewerId)) {
              throw new Error(
                `当前 RaceData 的参赛玩家为 ${sourceViewerIds.join('、')}，所选账号登录后的玩家 ID 是 ${client.viewerId}`,
              );
            }

            archive = createRaceArchive(archiveName);
            event.sender.send('race:archives-changed', {
              archiveId: archive.id,
              archiveName: archive.name,
            });
            progress({
              stage: 'simulate',
              detail: `已创建存档「${archive.name}」`,
              current: 0,
              total: count,
              archiveId: archive.id,
              archiveName: archive.name,
            });

            let lastSimulationStartedAt = 0;
            for (let index = 0; index < count; index += 1) {
              const waitMs = 1000 - (Date.now() - lastSimulationStartedAt);
              if (waitMs > 0) {
                // 借马需要服务端完成上一场的清理；race_start 至少间隔 1 秒。
                // eslint-disable-next-line no-await-in-loop
                await wait(waitMs);
              }
              progress({
                stage: 'prepare',
                detail: `正在准备第 ${index + 1} / ${count} 场`,
                current: index,
                total: count,
                archiveId: archive.id,
                archiveName: archive.name,
              });

              // race_end 后重新进入练习首页，让服务端刷新包括借马在内的
              // account-side partner_trained_chara_id 映射。完整顺序必须是：
              // index -> race_start -> race_end。
              // eslint-disable-next-line no-await-in-loop
              const indexResult = await client.preparePracticeRace();
              if (Number(indexResult.data?.state ?? 0) !== 0) {
                throw new Error(
                  '所选账号当前有尚未结束的练习，请先在游戏中结束后重试',
                );
              }

              progress({
                stage: 'simulate',
                detail: `正在模拟第 ${index + 1} / ${count} 场`,
                current: index,
                total: count,
                archiveId: archive.id,
                archiveName: archive.name,
              });
              lastSimulationStartedAt = Date.now();

              let raceStarted = false;
              try {
                // eslint-disable-next-line no-await-in-loop
                const race = await client.startPracticeRace(requestPayload);
                raceStarted = true;
                const records = persistRaceInfoToArchive(
                  race,
                  archive.id,
                  (record: RaceRecord) => {
                    event.sender.send('race:new', record);
                  },
                );
                completed += records.length;
                progress({
                  stage: 'save',
                  detail: `第 ${index + 1} 场已保存到「${archive.name}」`,
                  current: completed,
                  total: count,
                  archiveId: archive.id,
                  archiveName: archive.name,
                });
              } finally {
                if (raceStarted) {
                  // 每次 race_start 后必须结束本场，才能继续下一次模拟。
                  // eslint-disable-next-line no-await-in-loop
                  await client.endPracticeRace();
                }
              }
            }

            progress({
              stage: 'complete',
              detail: `已完成 ${completed} 场重复模拟`,
              current: completed,
              total: count,
              archiveId: archive.id,
              archiveName: archive.name,
            });
            return {
              ok: true,
              completed,
              total: count,
              archiveId: archive.id,
              archiveName: archive.name,
            };
          },
        );
        return result;
      } catch (error) {
        return {
          ok: false,
          completed,
          total: count,
          archiveId: archive?.id,
          archiveName: archive?.name,
          error: (error as Error).message,
        };
      } finally {
        simulationRunning = false;
      }
    },
  );
}
