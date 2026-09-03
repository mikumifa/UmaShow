import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { app, BrowserWindow, IpcMain } from 'electron';
import {
  SuccessionGameProgress,
  SuccessionGameSession,
} from './SuccessionGameClient';
import {
  invalidateAutoResearchLocalGameClient,
  withAutoResearchLocalGameClient,
} from './AutoResearchLocalGameClient';
import { buildLocalDashboard } from './AutoResearchLocalDashboard';

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
  accessKey: string;
  label: string;
  source: string;
  updatedAt: string;
  viewerId?: string;
}

interface SerializedAutoResearchAccount
  extends Omit<StoredAutoResearchAccount, 'accessKey'> {
  accessKey?: unknown;
  protectedAccessKey?: unknown;
}

export interface LocalAutoResearchAccount {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
  viewerId?: string;
}

export interface CapturedAutoResearchSession {
  uid: string;
  sid: string;
  viewer_id: string;
  device_id: string;
  udid: string;
  res_ver: string;
  app_ver: string;
  app_ver_code: string;
  buma_open_id: string;
  captured_at: string;
}

export interface AutoResearchSessionMetadata {
  sid?: string;
  viewerId?: string;
  appVer?: string;
  appVerCode?: string;
  resVer?: string;
  bumaOpenId?: string;
}

const capturedCredentials = new Map<string, CapturedAutoResearchCredential>();
const capturedSessions = new Map<string, CapturedAutoResearchSession>();
const DEFAULT_APP_VER = '2.0.2';
const DEFAULT_APP_VER_CODE = '11150';
const DEFAULT_RES_VER = '10012300:TS7TsHl6FUZl';

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

function readStoredAccessKey(account: SerializedAutoResearchAccount) {
  if (typeof account.accessKey === 'string' && account.accessKey) {
    return account.accessKey;
  }
  const value = account.protectedAccessKey;
  if (typeof value !== 'string') {
    throw new Error('本地账号凭据格式无效');
  }
  if (value.startsWith('plain:')) {
    return Buffer.from(value.slice('plain:'.length), 'base64').toString('utf8');
  }
  throw new Error('本地账号仍是旧的加密格式，请重新抓取账号凭据');
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

function readAccounts(): StoredAutoResearchAccount[] {
  try {
    const payload = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    if (!Array.isArray(payload?.accounts)) return [];
    let needsMigration = false;
    const accounts = payload.accounts.map(
      (account: SerializedAutoResearchAccount): StoredAutoResearchAccount => {
        if (typeof account.accessKey !== 'string') needsMigration = true;
        return {
          id: account.id,
          uid: account.uid,
          accessKey: readStoredAccessKey(account),
          label: account.label,
          source: account.source,
          updatedAt: account.updatedAt,
          viewerId:
            typeof account.viewerId === 'string' ? account.viewerId : undefined,
        };
      },
    );
    if (needsMigration) writeAccounts(accounts);
    return accounts;
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }
}

function publicAccount(
  account: StoredAutoResearchAccount,
): LocalAutoResearchAccount {
  return {
    id: account.id,
    uid: account.uid,
    label: account.label,
    source: account.source,
    accessKeyPreview: maskSecret(account.accessKey),
    updatedAt: account.updatedAt,
    viewerId: account.viewerId,
  };
}

function invalidateLocalClientsForUid(uid: string) {
  if (!uid) return;
  readAccounts()
    .filter((account) => account.uid === uid)
    .forEach((account) => {
      // The broker revision prevents an in-flight older client from writing
      // its SID back after an externally captured session wins.
      invalidateAutoResearchLocalGameClient(account.id).catch(() => undefined);
    });
}

function upsertAccounts(credentials: CapturedAutoResearchCredential[]) {
  const accounts = readAccounts();
  const byUid = new Map(accounts.map((account) => [account.uid, account]));
  const invalidatedUids = new Set<string>();
  credentials.forEach((credential) => {
    const uid = credential.uid.trim();
    const accessKey = credential.accessKey.trim();
    if (!uid || !accessKey) return;
    const current = byUid.get(uid);
    if (current && current.accessKey !== accessKey) {
      // An access_key change establishes a different server-side authority.
      // Its previous SID must never be reused for this UID.
      capturedSessions.delete(uid);
      invalidatedUids.add(uid);
    }
    byUid.set(uid, {
      id: current?.id || accountId(uid),
      uid,
      accessKey,
      label: credential.label?.trim() || current?.label || '',
      source: credential.source || current?.source || 'UmaShow',
      updatedAt: new Date().toISOString(),
      viewerId: current?.viewerId,
    });
  });
  const result = [...byUid.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  writeAccounts(result);
  invalidatedUids.forEach(invalidateLocalClientsForUid);
  return result.map(publicAccount);
}

export function getAutoResearchAccountCredential(id: string) {
  const account = readAccounts().find((item) => item.id === id);
  if (!account) throw new Error('本地账号不存在');
  return {
    uid: account.uid,
    accessKey: account.accessKey,
  };
}

export function saveAutoResearchAccountCredential(
  credential: CapturedAutoResearchCredential,
) {
  return upsertAccounts([credential]);
}

function savedUidForViewer(viewerId: string) {
  const accounts = readAccounts();
  const matched = accounts.find((account) => account.viewerId === viewerId);
  if (matched) return matched.uid;
  return accounts.length === 1 ? accounts[0].uid : '';
}

function rememberAccountViewer(uid: string, viewerId: string) {
  if (!uid || !viewerId || viewerId === '0') return;
  const accounts = readAccounts();
  const account = accounts.find((item) => item.uid === uid);
  if (!account || account.viewerId === viewerId) return;
  account.viewerId = viewerId;
  writeAccounts(accounts);
}

function storeCapturedSession(
  uid: string,
  viewerId: string,
  deviceId: string,
  sid: string,
  metadata: AutoResearchSessionMetadata,
  udid = deviceId,
) {
  if (!uid || !viewerId || viewerId === '0' || !deviceId || !sid) return null;
  const session: CapturedAutoResearchSession = {
    uid,
    sid,
    viewer_id: viewerId,
    // Captured game packets expose the normalized Android device id. It is
    // also the value used as the protocol UDID/AES IV.
    device_id: deviceId,
    udid: udid || deviceId,
    res_ver: metadata.resVer || DEFAULT_RES_VER,
    app_ver: metadata.appVer || DEFAULT_APP_VER,
    app_ver_code: metadata.appVerCode || DEFAULT_APP_VER_CODE,
    buma_open_id: metadata.bumaOpenId || uid,
    captured_at: new Date().toISOString(),
  };
  capturedSessions.set(uid, session);
  rememberAccountViewer(uid, viewerId);
  return session;
}

function storeGameClientSession(session: SuccessionGameSession) {
  return storeCapturedSession(
    session.uid,
    session.viewer_id,
    session.device_id,
    session.sid,
    {
      appVer: session.app_ver,
      appVerCode: session.app_ver_code,
      resVer: session.res_ver,
      bumaOpenId: session.buma_open_id,
    },
    session.udid,
  );
}

export function getAutoResearchCurrentSession(id: string) {
  const credential = getAutoResearchAccountCredential(id);
  return capturedSessions.get(credential.uid) || null;
}

export function storeAutoResearchGameClientSession(
  session: SuccessionGameSession,
) {
  return storeGameClientSession(session);
}

export async function clearAutoResearchLocalSession(id: string) {
  const credential = getAutoResearchAccountCredential(id);
  capturedSessions.delete(credential.uid);
  // Invalidation is also a FIFO barrier. A local request that was already
  // queued can finish between the first delete and this barrier, so discard
  // its rolled SID once more before handing the account to a server Worker.
  await invalidateAutoResearchLocalGameClient(id);
  capturedSessions.delete(credential.uid);
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
  metadata: AutoResearchSessionMetadata = {},
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
  const record =
    decodedData && typeof decodedData === 'object'
      ? (decodedData as Record<string, unknown>)
      : {};
  const viewerId = String(metadata.viewerId || record.viewer_id || '0');
  const packetUid = String(record.buma_uid || '').trim();
  const uid =
    packetUid ||
    savedUidForViewer(viewerId) ||
    (added.length === 1 ? added[0].uid : '');
  if (uid) {
    // Packet notifications do not contain a request correlation ID.  Reusing
    // a game-client SID observed here could attach an A response to B's
    // request.  External activity therefore only invalidates UmaShow's local
    // client; the next local operation must explicitly establish a fresh
    // session through the shared broker.
    capturedSessions.delete(uid);
    invalidateLocalClientsForUid(uid);
  }
  return added;
}

export function captureAutoResearchSessionResponse(decodedData: unknown) {
  // See captureAutoResearchCredentials: a response cannot be safely matched
  // to the intercepted request, so it must never become an executable local
  // SID. Credential discovery still happens on the corresponding request.
  if (!decodedData) return null;
  return null;
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
    const previous = readAccounts();
    const deleted = previous.find((account) => account.id === id);
    const accounts = previous.filter((account) => account.id !== id);
    writeAccounts(accounts);
    if (deleted) {
      capturedSessions.delete(deleted.uid);
      invalidateAutoResearchLocalGameClient(id).catch(() => undefined);
    }
    return accounts.map(publicAccount);
  });
  ipcMain.handle('autoresearch:account-credential', (_, id: string) => {
    return getAutoResearchAccountCredential(id);
  });
  ipcMain.handle('autoresearch:account-current-session', (_, id: string) => {
    return getAutoResearchCurrentSession(id);
  });
  ipcMain.handle('autoresearch:account-local-session-clear', (_, id: string) =>
    clearAutoResearchLocalSession(id),
  );
  ipcMain.handle('autoresearch:account-local-overview', async (_, id: string) =>
    withAutoResearchLocalGameClient(
      id,
      {
        login: 'required',
        credentialRefreshSource: '详设本地数据刷新',
      },
      async (client) => {
        const index = await client.loadIndex();
        const dashboard = buildLocalDashboard(index, {
          source: 'UmaShow 本地 load/index',
        });
        return {
          success: true,
          dashboard,
          runtime: {
            logged_in: true,
            session_owner: 'local',
            last_error: '',
            last_refreshed_at: new Date().toISOString(),
            runner: { running: false },
            account: dashboard.account,
          },
        };
      },
    ),
  );
  ipcMain.handle(
    'autoresearch:account-login-session',
    async (event, id: string, loginId: string) => {
      const progress = (value: SuccessionGameProgress) => {
        event.sender.send('autoresearch:local-login-progress', {
          loginId,
          ...value,
        });
      };
      return withAutoResearchLocalGameClient(
        id,
        {
          login: 'force',
          credentialRefreshSource: '自动育成本地登录刷新',
          onProgress: progress,
        },
        async (client) => client.session,
      );
    },
  );
  ipcMain.handle(
    'autoresearch:account-abandon-career',
    async (_, id: string, scenarioId: number, currentTurn: number) => {
      return withAutoResearchLocalGameClient(
        id,
        {
          login: 'required',
          credentialRefreshSource: '本地放弃育成刷新',
        },
        async (client) => {
          const result = await client.abandonCareer(scenarioId, currentTurn);
          return { ...result, session: client.session };
        },
      );
    },
  );
  ipcMain.handle(
    'autoresearch:accounts-import-users-db',
    (_, contentBase64: string) => importUsersDb(contentBase64),
  );
}
