/* eslint no-console: off */
import { decode } from '@msgpack/msgpack';
import express from 'express';
import { persistDebugPacket, getDebugPacketDir } from './handle/DebugPackets';

const DEFAULT_SERVE_PORT = 4639;

function parsePort(value: unknown) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }
  return port;
}

function resolvePort() {
  return (
    parsePort(process.argv[2]) ??
    parsePort(process.env.SERVER_PORT) ??
    parsePort(process.env.PORT) ??
    DEFAULT_SERVE_PORT
  );
}

const serverApp = express();
const port = resolvePort();

serverApp.use(express.raw({ type: () => true, limit: '50mb' }));

const handleNotifyPacket =
  (packetType: 'request' | 'response'): express.RequestHandler =>
  async (req, res) => {
    try {
      const buffer = req.body;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.json({ status: 'ok', saved: false });
        return;
      }

      const decoded = decode(buffer, {
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
      console.log(`Saved ${packetType} packet (${buffer.length} bytes)`);
      res.json({ status: 'ok', saved: true });
    } catch (error: any) {
      console.error(`Failed to save ${packetType} packet:`, error);
      res.status(500).json({ status: 'error', message: error.message });
    }
  };

serverApp.post('/notify/response', handleNotifyPacket('response'));
serverApp.post('/notify/request', handleNotifyPacket('request'));

serverApp.listen(port, '0.0.0.0', () => {
  console.log(`Packet serve listening on port ${port}`);
  console.log(`Saving latest 50 packets to: ${getDebugPacketDir()}`);
});
