import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { app, BrowserWindow, IpcMain } from 'electron';
import { SuccessionGameProgress } from './SuccessionGameClient';
import {
  clearAutoResearchLocalGameClient,
  clearAutoResearchLocalGameClientForAccount,
  clearAutoResearchLocalGameClientForUid,
  getAutoResearchLocalGameClientSession,
  loginAutoResearchLocalGameClient,
  withAutoResearchLocalGameClient,
} from './AutoResearchLocalGameClient';
import {
  buildLocalDashboard,
  buildLocalDashboardOptions,
} from './AutoResearchLocalDashboard';

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

export interface AutoResearchSessionMetadata {
  sid?: string;
  viewerId?: string;
  appVer?: string;
  appVerCode?: string;
  resVer?: string;
  bumaOpenId?: string;
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

function responseData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const { data } = record;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : record;
}

function mergeDashboardResponses(index: unknown, options: unknown) {
  const indexRecord =
    index && typeof index === 'object' && !Array.isArray(index)
      ? (index as Record<string, unknown>)
      : {};
  return {
    ...indexRecord,
    data: {
      ...responseData(index),
      ...responseData(options),
    },
  };
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
  return null;
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
    const accounts: StoredAutoResearchAccount[] = [];
    payload.accounts.forEach((account: SerializedAutoResearchAccount) => {
      const accessKey = readStoredAccessKey(account);
      if (accessKey === null) {
        needsMigration = true;
        return;
      }
      if (account.accessKey !== accessKey) needsMigration = true;
      accounts.push({
        id: account.id,
        uid: account.uid,
        accessKey,
        label: account.label,
        source: account.source,
        updatedAt: account.updatedAt,
        viewerId:
          typeof account.viewerId === 'string' ? account.viewerId : undefined,
      });
    });
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

function clearLocalClientForUid(uid: string) {
  if (uid) clearAutoResearchLocalGameClientForUid(uid);
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
  invalidatedUids.forEach(clearLocalClientForUid);
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

export function rememberAutoResearchAccountViewer(
  uid: string,
  viewerId: string,
) {
  rememberAccountViewer(uid, viewerId);
}

export async function clearAutoResearchLocalSession() {
  await clearAutoResearchLocalGameClient();
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
    // request. External activity drops UmaShow's one local client; another
    // local login must be explicitly selected before local operations resume.
    clearLocalClientForUid(uid);
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
      clearAutoResearchLocalGameClientForAccount(id);
    }
    return accounts.map(publicAccount);
  });
  ipcMain.handle('autoresearch:account-credential', (_, id: string) => {
    return getAutoResearchAccountCredential(id);
  });
  ipcMain.handle('autoresearch:account-current-session', (_, id: string) => {
    return getAutoResearchLocalGameClientSession(id);
  });
  ipcMain.handle('autoresearch:account-local-session-clear', () =>
    clearAutoResearchLocalSession(),
  );
  ipcMain.handle('autoresearch:account-local-overview', async (_, id: string) =>
    withAutoResearchLocalGameClient(id, async (client) => {
      const index = await client.loadIndex();
      const options = await client.loadSingleModeOptions();
      const dashboard = buildLocalDashboard(
        mergeDashboardResponses(index, options),
        {
          source: 'UmaShow 本地 load/index + pre_single_mode/index',
        },
      );
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
    }),
  );
  ipcMain.handle('autoresearch:account-local-options', async (_, id: string) =>
    withAutoResearchLocalGameClient(id, async (client) => {
      const index = await client.loadIndex();
      const options = await client.loadSingleModeOptions();
      return {
        success: true,
        options: buildLocalDashboardOptions(
          mergeDashboardResponses(index, options),
          {
            source: 'UmaShow 本地 load/index + pre_single_mode/index',
          },
        ),
      };
    }),
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
      const { loginIndex, optionIndex, session } =
        await loginAutoResearchLocalGameClient(id, {
          credentialRefreshSource: '自动育成本地登录刷新',
          onProgress: progress,
        });
      if (!loginIndex) throw new Error('游戏登录没有返回账号数据');
      const dashboard = buildLocalDashboard(
        mergeDashboardResponses(loginIndex, optionIndex),
        {
          source: 'UmaShow 本地登录 load/index + pre_single_mode/index',
        },
      );
      return {
        success: true,
        dashboard,
        session,
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
  );
  ipcMain.handle(
    'autoresearch:account-abandon-career',
    async (_, id: string) => {
      return withAutoResearchLocalGameClient(id, async (client) => {
        const result = await client.abandonCareer();
        return { ...result, session: client.session };
      });
    },
  );
  ipcMain.handle(
    'autoresearch:account-abandon-idle-single-mode',
    async (_, id: string, currentTurn: number) => {
      return withAutoResearchLocalGameClient(id, async (client) => {
        const result = await client.abandonIdleSingleMode(currentTurn);
        const optionIndex = await client.loadSingleModeOptions();
        const dashboard = buildLocalDashboard(
          mergeDashboardResponses(result.index, optionIndex),
          {
            source:
              'UmaShow 本地放弃离线育成 load/index + pre_single_mode/index',
          },
        );
        return {
          success: true,
          dashboard,
          session: client.session,
          runtime: {
            logged_in: true,
            session_owner: 'local',
            last_error: '',
            last_refreshed_at: new Date().toISOString(),
            runner: { running: false },
            account: dashboard.account,
          },
        };
      });
    },
  );
  ipcMain.handle(
    'autoresearch:accounts-import-users-db',
    (_, contentBase64: string) => importUsersDb(contentBase64),
  );
}
