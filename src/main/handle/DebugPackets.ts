/* eslint global-require: off, import/prefer-default-export: off */
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { jsonReplacer } from '../util';

const MAX_DEBUG_PACKET_FILES = 50;
const DEBUG_PACKET_FILE_PREFIXES = ['request_packet_', 'response_packet_'];
const DEBUG_PACKET_FILE_SUFFIX = '.json';
const COMMON_HEADER =
  '5ccdf6135f246a2238161c64cad86ee00f1f2d90033e1f0aa7a9554f4cc06e6f';
const COMMON_HEADER2 = '97054987b32d477f6d24a1631329765f9fc43a57';

type DebugPacketType = 'request' | 'response';

let packetSequence = 0;

function resolveDebugPacketDir() {
  if (process.env.DEBUG_PACKET_DIR) {
    return process.env.DEBUG_PACKET_DIR;
  }

  try {
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'debug_packets');
    }
  } catch {
    // Standalone serve runs outside Electron.
  }

  return path.join(process.cwd(), 'debug_packets');
}

export function getDebugPacketDir() {
  return resolveDebugPacketDir();
}

function ensureDebugPacketDir() {
  const debugPacketDir = getDebugPacketDir();
  if (!fs.existsSync(debugPacketDir)) {
    fs.mkdirSync(debugPacketDir, { recursive: true });
  }
}

function safeTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function debugPacketFiles() {
  ensureDebugPacketDir();
  const debugPacketDir = getDebugPacketDir();
  return fs
    .readdirSync(debugPacketDir)
    .filter(
      (filename) =>
        DEBUG_PACKET_FILE_PREFIXES.some((prefix) =>
          filename.startsWith(prefix),
        ) && filename.endsWith(DEBUG_PACKET_FILE_SUFFIX),
    )
    .map((filename) => {
      const fullPath = path.join(debugPacketDir, filename);
      return {
        filename,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    });
}

function pruneDebugPackets() {
  const files = debugPacketFiles().sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return b.filename.localeCompare(a.filename);
  });

  files.slice(MAX_DEBUG_PACKET_FILES).forEach((file) => {
    try {
      fs.unlinkSync(file.fullPath);
    } catch (error) {
      log.error(
        '[DebugPackets] Failed to prune debug packet:',
        file.fullPath,
        error,
      );
    }
  });
}

export function persistDebugPacket(
  decodedData: unknown,
  packetType: DebugPacketType,
) {
  try {
    ensureDebugPacketDir();
    const receivedAt = new Date();
    packetSequence += 1;
    const filename = `${packetType}_packet_${safeTimestamp(
      receivedAt,
    )}_${process.pid}_${packetSequence}${DEBUG_PACKET_FILE_SUFFIX}`;
    const filepath = path.join(getDebugPacketDir(), filename);

    fs.writeFileSync(
      filepath,
      JSON.stringify(
        {
          receivedAt: receivedAt.toISOString(),
          ...(packetType === 'request'
            ? { COMMON_HEADER, COMMON_HEADER2 }
            : {}),
          data: decodedData,
        },
        jsonReplacer,
        2,
      ),
      'utf-8',
    );
    pruneDebugPackets();
  } catch (error) {
    log.error('[DebugPackets] Failed to save debug packet:', error);
  }
}
