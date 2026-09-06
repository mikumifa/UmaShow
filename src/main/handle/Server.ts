import { decode } from '@msgpack/msgpack';
import { BrowserWindow } from 'electron';
import express from 'express';
import type { Server as HttpServer } from 'http';
import { extractCoreInfo } from './CoreInfo';
import { persistDebugPacket } from './DebugPackets';
import { persistLeaderboardSnapshotFromPacket } from './LeaderboardRanking';
import { handleRaceInfo } from './RaceInfo';
import { handleTrainingHistoryInfo } from './TrainingHistory';
import {
  captureAutoResearchCredentials,
  captureAutoResearchSessionResponse,
} from './AutoResearchCredentials';
import { captureSuccessionIndex } from './SuccessionIndex';
import { captureMonteCarloPacket } from './MonteCarloState';

export interface ExpressServerController {
  getPort: () => number;
  restart: (port: number) => Promise<void>;
  stop: () => Promise<void>;
}

export async function startExpressServer(
  _mainWindow: BrowserWindow,
  initialPort: number,
): Promise<ExpressServerController> {
  const serverApp = express();
  let server: HttpServer | null = null;
  let currentPort = initialPort;
  const isDebug =
    process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

  serverApp.use(express.raw({ type: () => true, limit: '50mb' }));

  const handleNotifyPacket =
    (packetType: 'request' | 'response'): express.RequestHandler =>
    async (req, res) => {
      try {
        const buffer = req.body;

        if (Buffer.isBuffer(buffer) && buffer.length > 0) {
          const decoded: any = decode(buffer, {
            mapKeyConverter: (key) => {
              if (key === null) {
                return '__null__';
              }
              if (typeof key === 'string' || typeof key === 'number') {
                return key;
              }
              return String(key);
            },
          });
          _mainWindow.webContents.send('server-log', {
            type: 'Info',
            message: `收到 ${
              packetType === 'request' ? 'Request' : 'Response'
            } 包 (${buffer.length} bytes)`,
          });
          if (isDebug) {
            const requestMetadata =
              packetType === 'request'
                ? {
                    BASE_URL: req.get('X-Umamusume-Base-Url'),
                    COMMON_HEADER: req.get('X-Umamusume-Common-Header'),
                    COMMON_HEADER2: req.get('X-Umamusume-Common-Header2'),
                    SID_SUFFIX: req.get('X-Umamusume-Sid-Suffix'),
                  }
                : undefined;
            persistDebugPacket(decoded, packetType, requestMetadata);
          }
          if (packetType === 'request') {
            captureAutoResearchCredentials(decoded, _mainWindow, {
              sid: req.get('X-Umamusume-Sid') || req.get('SID'),
              viewerId: req.get('X-Umamusume-Viewer-Id') || req.get('ViewerID'),
              appVer: req.get('X-Umamusume-App-Ver') || req.get('APP-VER'),
              appVerCode:
                req.get('X-Umamusume-App-Ver-Code') || req.get('APP-VER-CODE'),
              resVer: req.get('X-Umamusume-Res-Ver') || req.get('RES-VER'),
              bumaOpenId:
                req.get('X-Umamusume-Buma-Open-Id') || req.get('BUMA-OPEN-ID'),
            });
          }
          if (packetType === 'response') {
            captureAutoResearchSessionResponse(decoded);
            captureSuccessionIndex(decoded, _mainWindow);
          }
          captureMonteCarloPacket(decoded, packetType, _mainWindow);
          persistLeaderboardSnapshotFromPacket(decoded, _mainWindow);
          handleTrainingHistoryInfo(decoded, _mainWindow);
          await extractCoreInfo(decoded, _mainWindow);
          // handleUncheckedEventInfo(decoded, mainWindow);
          handleRaceInfo(decoded, _mainWindow);
        }
      } catch (e: any) {
        console.error(e);
        _mainWindow.webContents.send('server-log', {
          type: 'Error',
          message: e.message,
        });
      }

      res.json({ status: 'ok' });
    };

  serverApp.post('/notify/response', handleNotifyPacket('response'));
  serverApp.post('/notify/request', handleNotifyPacket('request'));

  const stop = () =>
    new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        server = null;
        resolve();
      });
    });

  const listen = (port: number) =>
    new Promise<void>((resolve, reject) => {
      const nextServer = serverApp.listen(port, '0.0.0.0', () => {
        server = nextServer;
        currentPort = port;
        console.log(`Server running on port ${port}`);
        _mainWindow.webContents.send('server-log', {
          type: 'System',
          message: `监听端口: ${port}`,
        });
        resolve();
      });

      nextServer.once('error', (error) => {
        reject(error);
      });
    });

  await listen(initialPort);

  return {
    getPort: () => currentPort,
    restart: async (port: number) => {
      if (port === currentPort) {
        return;
      }
      const previousPort = currentPort;
      await stop();
      try {
        await listen(port);
      } catch (error) {
        await listen(previousPort);
        throw error;
      }
    },
    stop,
  };
}
