import { decode } from '@msgpack/msgpack';
import { BrowserWindow } from 'electron';
import express from 'express';
import { extractCoreInfo } from './CoreInfo';
import { handleRaceInfo } from './RaceInfo';
const PORT = 4639;

export function startExpressServer(_mainWindow: BrowserWindow) {
  const serverApp = express();
  serverApp.use(express.raw({ type: '*/*', limit: '50mb' }));

  serverApp.post('/notify/response', async (req, res) => {
    try {
      const buffer = req.body;

      if (buffer && buffer.length > 0) {
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
          message: `收到 Response 包 (${buffer.length} bytes)`,
        });
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
  });

  serverApp.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    _mainWindow.webContents.send('server-log', {
      type: 'System',
      message: `监听端口: ${PORT}`,
    });
  });
}
