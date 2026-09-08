import { createHash } from 'crypto';
import { Buffer } from 'buffer';
import { openImportedDatabase } from './database';

const ACCOUNT_STORAGE_KEY = 'autouma.mobile.accounts';

export type StoredMobileAccount = {
  id: string;
  uid: string;
  accessKey: string;
  label: string;
  source: string;
  updatedAt: string;
  viewerId?: string;
};

function accountId(uid: string) {
  return createHash('sha256').update(uid).digest('hex');
}

function readAccounts(): StoredMobileAccount[] {
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredMobileAccount[]) {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(accounts));
}

function publicAccount(account: StoredMobileAccount) {
  const secret = account.accessKey;
  return {
    id: account.id,
    uid: account.uid,
    label: account.label,
    source: account.source,
    accessKeyPreview:
      secret.length <= 8
        ? '*'.repeat(secret.length)
        : `${secret.slice(0, 4)}…${secret.slice(-4)}`,
    updatedAt: account.updatedAt,
    viewerId: account.viewerId,
  };
}

export function listMobileAccounts() {
  return readAccounts().map(publicAccount);
}

export function getMobileCredential(id: string) {
  const account = readAccounts().find((item) => item.id === id);
  if (!account) throw new Error('本地账号不存在');
  return { uid: account.uid, accessKey: account.accessKey };
}

export function saveMobileAccounts(
  credentials: Array<{
    uid: string;
    accessKey: string;
    source?: string;
    label?: string;
  }>,
) {
  const accounts = readAccounts();
  const byUid = new Map(accounts.map((account) => [account.uid, account]));
  credentials.forEach((credential) => {
    const uid = String(credential.uid || '').trim();
    const accessKey = String(credential.accessKey || '').trim();
    if (!uid || !accessKey) return;
    const current = byUid.get(uid);
    byUid.set(uid, {
      id: current?.id || accountId(uid),
      uid,
      accessKey,
      label: String(credential.label || current?.label || '').trim(),
      source: String(credential.source || current?.source || 'AutoUma'),
      updatedAt: new Date().toISOString(),
      viewerId: current?.viewerId,
    });
  });
  const result = [...byUid.values()].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  writeAccounts(result);
  return result.map(publicAccount);
}

export function renameMobileAccount(id: string, label: string) {
  const accounts = readAccounts();
  const account = accounts.find((item) => item.id === id);
  if (!account) throw new Error('本地账号不存在');
  account.label = String(label || '').trim().slice(0, 40);
  account.updatedAt = new Date().toISOString();
  writeAccounts(accounts);
  return publicAccount(account);
}

export function deleteMobileAccount(id: string) {
  const accounts = readAccounts().filter((item) => item.id !== id);
  writeAccounts(accounts);
  return accounts.map(publicAccount);
}

export function rememberMobileViewer(uid: string, viewerId: string) {
  const accounts = readAccounts();
  const account = accounts.find((item) => item.uid === uid);
  if (!account || !viewerId || viewerId === '0') return;
  account.viewerId = viewerId;
  account.updatedAt = new Date().toISOString();
  writeAccounts(accounts);
}

export async function importMobileUsersDb(contentBase64: string) {
  const bytes = Uint8Array.from(Buffer.from(contentBase64, 'base64'));
  if (!bytes.length || bytes.length > 32 * 1024 * 1024) {
    throw new Error('users.db 文件为空或过大');
  }
  const database = await openImportedDatabase(bytes);
  try {
    const columns = new Set(
      (database.prepare('PRAGMA table_info("users")').all() as Array<{
        name?: unknown;
      }>).map((column) => String(column.name || '')),
    );
    if (!columns.has('uid') || !columns.has('access_key')) {
      throw new Error('users.db 的 users 表缺少 uid/access_key 字段');
    }
    const optionalName = columns.has('uname')
      ? 'uname'
      : columns.has('username')
        ? 'username'
        : "''";
    const rows = database
      .prepare(`SELECT uid, access_key, ${optionalName} AS label FROM users`)
      .all() as Array<Record<string, unknown>>;
    return saveMobileAccounts(
      rows.map((row) => ({
        uid: String(row.uid || ''),
        accessKey: String(row.access_key || ''),
        label: String(row.label || ''),
        source: 'users.db',
      })),
    );
  } finally {
    database.close();
  }
}
