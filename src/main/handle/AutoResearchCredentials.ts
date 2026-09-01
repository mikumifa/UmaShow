import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { app, BrowserWindow, IpcMain, safeStorage } from 'electron';
import {
  SuccessionGameClient,
  SuccessionGameProgress,
} from './SuccessionGameClient';

export interface CapturedAutoResearchCredential {
  uid: string;
  accessKey: string;
  capturedAt: string;
  source: string;
  label?: string;
}

interface StoredAutoResearchAccount {
  id: string;
  uid: string;
  protectedAccessKey: string;
  label: string;
  source: string;
  updatedAt: string;
}

export interface LocalAutoResearchAccount {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
}

const capturedCredentials = new Map<string, CapturedAutoResearchCredential>();

function accountId(uid: string) {
  return createHash('sha256').update(uid).digest('hex');
}

function maskSecret(value: string) {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function storePath() {
  return path.join(app.getPath('userData'), 'auto-research-accounts.json');
}

function protectSecret(value: string) {
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function unprotectSecret(value: string) {
  if (value.startsWith('encrypted:')) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统凭据加密服务当前不可用');
    }
    return safeStorage.decryptString(
      Buffer.from(value.slice('encrypted:'.length), 'base64'),
    );
  }
  if (value.startsWith('plain:')) {
    return Buffer.from(value.slice('plain:'.length), 'base64').toString('utf8');
  }
  throw new Error('本地账号凭据格式无效');
}

function readAccounts(): StoredAutoResearchAccount[] {
  try {
    const payload = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    return Array.isArray(payload?.accounts) ? payload.accounts : [];
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }
}

function writeAccounts(accounts: StoredAutoResearchAccount[]) {
  const destination = storePath();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    JSON.stringify({ version: 1, accounts }, null, 2),
    'utf8',
  );
}

function publicAccount(
  account: StoredAutoResearchAccount,
): LocalAutoResearchAccount {
  return {
    id: account.id,
    uid: account.uid,
    label: account.label,
    source: account.source,
    accessKeyPreview: maskSecret(unprotectSecret(account.protectedAccessKey)),
    updatedAt: account.updatedAt,
  };
}

function upsertAccounts(credentials: CapturedAutoResearchCredential[]) {
  const accounts = readAccounts();
  const byUid = new Map(accounts.map((account) => [account.uid, account]));
  credentials.forEach((credential) => {
    const uid = credential.uid.trim();
    const accessKey = credential.accessKey.trim();
    if (!uid || !accessKey) return;
    const current = byUid.get(uid);
    byUid.set(uid, {
      id: current?.id || accountId(uid),
      uid,
      protectedAccessKey: protectSecret(accessKey),
      label: credential.label?.trim() || current?.label || '',
      source: credential.source || current?.source || 'UmaShow',
      updatedAt: new Date().toISOString(),
    });
  });
  const result = [...byUid.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  writeAccounts(result);
  return result.map(publicAccount);
}

export function getAutoResearchAccountCredential(id: string) {
  const account = readAccounts().find((item) => item.id === id);
  if (!account) throw new Error('本地账号不存在');
  return {
    uid: account.uid,
    accessKey: unprotectSecret(account.protectedAccessKey),
  };
}

export function saveAutoResearchAccountCredential(
  credential: CapturedAutoResearchCredential,
) {
  return upsertAccounts([credential]);
}

function importUsersDb(contentBase64: string) {
  const bytes = Buffer.from(contentBase64, 'base64');
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) {
    throw new Error('users.db 文件为空或过大');
  }
  const tempPath = path.join(
    app.getPath('temp'),
    `uma-users-${randomUUID()}.db`,
  );
  fs.writeFileSync(tempPath, bytes);
  try {
    const database = new Database(tempPath, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      const columnRows = database
        .prepare('PRAGMA table_info("users")')
        .all() as Array<{ name: string }>;
      const columns = new Set(columnRows.map((column) => column.name));
      if (!columns.has('uid') || !columns.has('access_key')) {
        throw new Error('users.db 的 users 表缺少 uid/access_key 字段');
      }
      let optionalName = "''";
      if (columns.has('uname')) optionalName = 'uname';
      else if (columns.has('username')) optionalName = 'username';
      const rows = database
        .prepare(`SELECT uid, access_key, ${optionalName} AS label FROM users`)
        .all() as Array<{ uid: unknown; access_key: unknown; label: unknown }>;
      return upsertAccounts(
        rows.map((row) => ({
          uid: String(row.uid ?? ''),
          accessKey: String(row.access_key ?? ''),
          label: String(row.label ?? ''),
          source: 'users.db',
          capturedAt: new Date().toISOString(),
        })),
      );
    } finally {
      database.close();
    }
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}

function visit(value: unknown, source: string) {
  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, source));
    return;
  }
  if (!value || typeof value !== 'object') return;

  const record = value as Record<string, unknown>;
  const uid = record.buma_uid ?? record.uid;
  const accessKey = record.buma_access_token ?? record.access_key;
  if (uid != null && accessKey != null) {
    const credential: CapturedAutoResearchCredential = {
      uid: String(uid),
      accessKey: String(accessKey),
      capturedAt: new Date().toISOString(),
      source,
    };
    capturedCredentials.set(credential.uid, credential);
  }

  Object.values(record).forEach((item) => visit(item, source));
}

export function captureAutoResearchCredentials(
  decodedData: unknown,
  mainWindow: BrowserWindow,
) {
  const before = new Map(
    [...capturedCredentials.values()].map((item) => [item.uid, item.accessKey]),
  );
  visit(decodedData, 'UmaShow request packet');
  const added = [...capturedCredentials.values()].filter(
    (item) => before.get(item.uid) !== item.accessKey,
  );
  if (added.length) upsertAccounts(added);
  added.forEach((credential) => {
    mainWindow.webContents.send('autoresearch:credential-captured', credential);
  });
  return added;
}

export function handleAutoResearchCredentials(ipcMain: IpcMain) {
  ipcMain.handle('autoresearch:credentials-list', () =>
    [...capturedCredentials.values()].sort((left, right) =>
      right.capturedAt.localeCompare(left.capturedAt),
    ),
  );
  ipcMain.handle('autoresearch:accounts-list', () =>
    readAccounts().map(publicAccount),
  );
  ipcMain.handle(
    'autoresearch:accounts-save',
    (_, credentials: CapturedAutoResearchCredential[]) =>
      upsertAccounts(credentials),
  );
  ipcMain.handle('autoresearch:account-delete', (_, id: string) => {
    const accounts = readAccounts().filter((account) => account.id !== id);
    writeAccounts(accounts);
    return accounts.map(publicAccount);
  });
  ipcMain.handle('autoresearch:account-credential', (_, id: string) => {
    return getAutoResearchAccountCredential(id);
  });
  ipcMain.handle(
    'autoresearch:account-login-session',
    async (event, id: string, loginId: string) => {
      const credential = getAutoResearchAccountCredential(id);
      const progress = (value: SuccessionGameProgress) => {
        event.sender.send('autoresearch:local-login-progress', {
          loginId,
          ...value,
        });
      };
      const client = new SuccessionGameClient(
        credential.uid,
        credential.accessKey,
        progress,
      );
      await client.login();
      const refreshedCredential = client.credential;
      if (refreshedCredential.accessKey !== credential.accessKey) {
        saveAutoResearchAccountCredential({
          ...refreshedCredential,
          source: '自动育成本地登录刷新',
          capturedAt: new Date().toISOString(),
        });
      }
      return client.session;
    },
  );
  ipcMain.handle(
    'autoresearch:accounts-import-users-db',
    (_, contentBase64: string) => importUsersDb(contentBase64),
  );
}
