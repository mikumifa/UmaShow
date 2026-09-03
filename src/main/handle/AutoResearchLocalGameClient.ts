import {
  SuccessionGameClient,
  SuccessionGameProgress,
  SuccessionGameSession,
  isSuccessionGameRequestUncertain,
} from './SuccessionGameClient';

type AutoResearchCredentialStore = {
  getAutoResearchAccountCredential: (id: string) => {
    uid: string;
    accessKey: string;
  };
  getAutoResearchCurrentSession: (id: string) => SuccessionGameSession | null;
  saveAutoResearchAccountCredential: (credential: {
    uid: string;
    accessKey: string;
    source: string;
    capturedAt: string;
  }) => unknown;
  storeAutoResearchGameClientSession: (
    session: SuccessionGameSession,
  ) => unknown;
};

// AutoResearchCredentials also owns IPC handlers that use this manager. Keep
// the store lookup lazy so that module initialization stays acyclic; every
// lookup still happens inside the per-account queue.
function credentialStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  return require('./AutoResearchCredentials') as AutoResearchCredentialStore;
}

/**
 * `required` never creates a game login and is for operations that must be
 * explicitly authorized by the user first. `if-missing` establishes a login
 * only when no captured session is available. `force` deliberately replaces
 * the managed client and establishes a fresh game session.
 */
export type AutoResearchLocalGameClientLoginMode =
  | 'required'
  | 'if-missing'
  | 'force';

export type AutoResearchLocalGameClientOptions = {
  login: AutoResearchLocalGameClientLoginMode;
  credentialRefreshSource?: string;
  onProgress?: (progress: SuccessionGameProgress) => void;
};

type ManagedClient = {
  client: SuccessionGameClient;
  uid: string;
};

const managedClients = new Map<string, ManagedClient>();
const accountQueueTails = new Map<string, Promise<void>>();
const invalidationVersions = new Map<string, number>();
const untrustedSessions = new Set<string>();

function sessionFingerprint(session: SuccessionGameSession | null) {
  if (!session) return 'null';
  return JSON.stringify([
    session.uid,
    session.sid,
    session.viewer_id,
    session.device_id,
    session.udid,
    session.res_ver,
    session.app_ver,
    session.app_ver_code,
    session.buma_open_id,
  ]);
}

function hasUsableSession(session: SuccessionGameSession | null) {
  return Boolean(
    session?.sid && session.viewer_id && session.viewer_id !== '0',
  );
}

function enqueueForAccount<T>(accountId: string, operation: () => Promise<T>) {
  const previous = accountQueueTails.get(accountId) || Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  accountQueueTails.set(accountId, tail);
  tail
    .then(() => {
      if (accountQueueTails.get(accountId) === tail) {
        accountQueueTails.delete(accountId);
      }
      return undefined;
    })
    .catch(() => undefined);
  return result;
}

function createClient(
  uid: string,
  accessKey: string,
  session: SuccessionGameSession | null,
  onProgress?: (progress: SuccessionGameProgress) => void,
) {
  return new SuccessionGameClient(uid, accessKey, onProgress, session);
}

function isReusable(
  managed: ManagedClient | undefined,
  uid: string,
  accessKey: string,
  session: SuccessionGameSession | null,
) {
  if (!managed || managed.uid !== uid) return false;
  const { credential } = managed.client;
  return (
    credential.uid === uid &&
    credential.accessKey === accessKey &&
    sessionFingerprint(managed.client.session) === sessionFingerprint(session)
  );
}

function resolveClient(
  accountId: string,
  options: AutoResearchLocalGameClientOptions,
) {
  // These reads deliberately happen only after this account reaches the head
  // of its queue. A queued operation must never hydrate from a SID that a
  // preceding operation has just consumed.
  const credentials = credentialStore();
  const credential = credentials.getAutoResearchAccountCredential(accountId);
  const savedSession = credentials.getAutoResearchCurrentSession(accountId);
  const usableSavedSession = untrustedSessions.has(accountId)
    ? null
    : savedSession;
  let managed = managedClients.get(accountId);
  if (
    options.login === 'force' ||
    !isReusable(
      managed,
      credential.uid,
      credential.accessKey,
      usableSavedSession,
    )
  ) {
    managed = {
      client: createClient(
        credential.uid,
        credential.accessKey,
        savedSession,
        options.onProgress,
      ),
      uid: credential.uid,
    };
    managedClients.set(accountId, managed);
  }
  if (!managed) throw new Error('无法创建本地游戏客户端');

  return {
    client: managed.client,
    credential,
    savedSession: usableSavedSession,
  };
}

async function ensureLogin(
  client: SuccessionGameClient,
  savedSession: SuccessionGameSession | null,
  login: AutoResearchLocalGameClientLoginMode,
) {
  if (login === 'required') {
    if (!hasUsableSession(savedSession)) throw new Error('请先登录');
    return false;
  }
  if (login === 'force' || !hasUsableSession(savedSession)) {
    await client.login();
    return true;
  }
  return false;
}

function persistManagedClient(
  accountId: string,
  client: SuccessionGameClient,
  credentialAtStart: { uid: string; accessKey: string },
  savedSession: SuccessionGameSession | null,
  credentialRefreshSource: string,
) {
  // A credential import/delete can happen outside the IPC queue. Do not
  // resurrect an account or overwrite a newer captured credential with an
  // older client snapshot.
  let liveCredential: { uid: string; accessKey: string };
  try {
    liveCredential =
      credentialStore().getAutoResearchAccountCredential(accountId);
  } catch {
    return;
  }
  if (
    liveCredential.uid !== credentialAtStart.uid ||
    liveCredential.accessKey !== credentialAtStart.accessKey
  ) {
    managedClients.delete(accountId);
    return;
  }

  const refreshedCredential = client.credential;
  if (
    refreshedCredential.uid === credentialAtStart.uid &&
    refreshedCredential.accessKey !== credentialAtStart.accessKey
  ) {
    credentialStore().saveAutoResearchAccountCredential({
      ...refreshedCredential,
      source: credentialRefreshSource,
      capturedAt: new Date().toISOString(),
    });
  }
  // A successful game response can roll SID even if the higher-level
  // operation eventually throws. Persist it before releasing the next job.
  const session =
    !client.hasConfirmedResponse &&
    savedSession &&
    sessionFingerprint(client.session) !== sessionFingerprint(savedSession)
      ? savedSession
      : client.session;
  credentialStore().storeAutoResearchGameClientSession(session);
}

/**
 * Run an entire local game operation in FIFO order for one account.
 *
 * The callback owns the client only for the duration of the callback. Do not
 * retain it or start un-awaited work from the callback: that would bypass the
 * account queue and could reuse an already-advanced SID.
 */
export function withAutoResearchLocalGameClient<T>(
  accountId: string,
  options: AutoResearchLocalGameClientOptions,
  operation: (client: SuccessionGameClient) => Promise<T>,
) {
  return enqueueForAccount(accountId, async () => {
    const invalidationVersion = invalidationVersions.get(accountId) || 0;
    let resolved:
      | {
          client: SuccessionGameClient;
          credential: { uid: string; accessKey: string };
          savedSession: SuccessionGameSession | null;
        }
      | undefined;
    let establishedFreshSession = false;
    let requestOutcomeUncertain = false;
    try {
      resolved = resolveClient(accountId, options);
      establishedFreshSession = await ensureLogin(
        resolved.client,
        resolved.savedSession,
        options.login,
      );
      if (establishedFreshSession) untrustedSessions.delete(accountId);
      return await operation(resolved.client);
    } catch (error) {
      if (isSuccessionGameRequestUncertain(error)) {
        requestOutcomeUncertain = true;
        untrustedSessions.add(accountId);
        managedClients.delete(accountId);
      }
      throw error;
    } finally {
      const clientSessionUncertain = Boolean(
        resolved?.client.hasUncertainSession,
      );
      if (clientSessionUncertain) {
        untrustedSessions.add(accountId);
        managedClients.delete(accountId);
      }
      const current = managedClients.get(accountId);
      // An intercepted game packet can replace the captured SID while this
      // operation is in flight. Its invalidation is authoritative; never let
      // this older client write over that captured session in finally.
      if (
        resolved &&
        !requestOutcomeUncertain &&
        !clientSessionUncertain &&
        invalidationVersions.get(accountId) === invalidationVersion &&
        current?.client === resolved.client
      ) {
        persistManagedClient(
          accountId,
          resolved.client,
          resolved.credential,
          resolved.savedSession,
          options.credentialRefreshSource || 'UmaShow 本地游戏客户端刷新',
        );
      }
    }
  });
}

/**
 * Discard the in-memory client after an external packet updates credentials or
 * SID. The revision changes immediately, while the returned promise gives a
 * caller an optional FIFO barrier after any in-flight operation.
 */
export function invalidateAutoResearchLocalGameClient(accountId: string) {
  invalidationVersions.set(
    accountId,
    (invalidationVersions.get(accountId) || 0) + 1,
  );
  managedClients.delete(accountId);
  untrustedSessions.delete(accountId);
  return enqueueForAccount(accountId, async () => {
    managedClients.delete(accountId);
  });
}

export function getAutoResearchLocalGameClientStatus(accountId: string) {
  const managed = managedClients.get(accountId);
  return {
    managed: Boolean(managed),
    hasSession:
      !untrustedSessions.has(accountId) &&
      hasUsableSession(managed?.client.session || null),
    sessionUncertain: untrustedSessions.has(accountId),
    queued: accountQueueTails.has(accountId),
  };
}
