import {
  SuccessionGameClient,
  SuccessionGameProgress,
  SuccessionGameSession,
} from './SuccessionGameClient';

type AutoResearchCredentialStore = {
  getAutoResearchAccountCredential: (id: string) => {
    uid: string;
    accessKey: string;
  };
  saveAutoResearchAccountCredential: (credential: {
    uid: string;
    accessKey: string;
    source: string;
    capturedAt: string;
  }) => unknown;
  rememberAutoResearchAccountViewer: (uid: string, viewerId: string) => void;
};

// AutoResearchCredentials also owns IPC handlers that use this manager. Keep
// the store lookup lazy so module initialization stays acyclic.
function credentialStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  return require('./AutoResearchCredentials') as AutoResearchCredentialStore;
}

export type AutoResearchLocalGameLoginOptions = {
  credentialRefreshSource?: string;
  onProgress?: (progress: SuccessionGameProgress) => void;
};

type ActiveLocalGameClient = {
  accountId: string;
  uid: string;
  client: SuccessionGameClient;
};

// UmaShow can retain credentials for multiple accounts, but it owns at most
// one executable local game login. Hosted/server accounts never use this
// client. Switching local accounts always creates a completely new client.
let activeLocalGameClient: ActiveLocalGameClient | null = null;

// Login and shutdown change ownership of the one process-wide client. Keep
// those transitions ordered as well as the individual game calls themselves.
let localGameClientLifecycleTail: Promise<void> = Promise.resolve();
const retiringLocalGameClients = new Set<Promise<void>>();

function retireLocalGameClient(client: SuccessionGameClient) {
  const retirement = client.closeAndDrain();
  retiringLocalGameClients.add(retirement);
  retirement.finally(() => retiringLocalGameClients.delete(retirement));
  return retirement;
}

async function waitForRetiringLocalGameClients() {
  await Promise.all([...retiringLocalGameClients]);
}

async function enqueueLocalGameClientLifecycle<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const previous = localGameClientLifecycleTail;
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  localGameClientLifecycleTail = current;
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function hasUsableSession(session: SuccessionGameSession | null) {
  return Boolean(
    session?.sid && session.viewer_id && session.viewer_id !== '0',
  );
}

function persistLoggedInIdentity(
  client: SuccessionGameClient,
  credentialAtStart: { uid: string; accessKey: string },
  source: string,
) {
  const refreshedCredential = client.credential;
  if (refreshedCredential.uid !== credentialAtStart.uid) {
    throw new Error('游戏登录返回的 UID 与所选本地账号不一致');
  }
  if (refreshedCredential.accessKey !== credentialAtStart.accessKey) {
    credentialStore().saveAutoResearchAccountCredential({
      ...refreshedCredential,
      source,
      capturedAt: new Date().toISOString(),
    });
  }
  credentialStore().rememberAutoResearchAccountViewer(
    refreshedCredential.uid,
    client.viewerId,
  );
}

/**
 * Switch UmaShow to one local account and perform a complete game login.
 *
 * The previous local client is dropped before login starts. A failed login
 * therefore leaves UmaShow with no active local account instead of silently
 * falling back to the previous session.
 */
export async function loginAutoResearchLocalGameClient(
  accountId: string,
  options: AutoResearchLocalGameLoginOptions = {},
) {
  return enqueueLocalGameClientLifecycle(async () => {
    await waitForRetiringLocalGameClients();
    const previous = activeLocalGameClient;
    activeLocalGameClient = null;
    if (previous) {
      await retireLocalGameClient(previous.client);
    }
    const credential =
      credentialStore().getAutoResearchAccountCredential(accountId);
    const client = new SuccessionGameClient(
      credential.uid,
      credential.accessKey,
      options.onProgress,
      null,
    );
    try {
      const loginIndex = await client.login();
      options.onProgress?.({
        stage: 'load',
        detail: '正在读取育成角色、继承与好友支援信息',
      });
      const optionIndex = await client.loadSingleModeOptions();
      persistLoggedInIdentity(
        client,
        credential,
        options.credentialRefreshSource || '本地游戏登录刷新',
      );
      activeLocalGameClient = {
        accountId,
        uid: client.credential.uid,
        client,
      };
      return { loginIndex, optionIndex, session: { ...client.session } };
    } catch (error) {
      await retireLocalGameClient(client);
      throw error;
    }
  });
}

function requireCurrentLocalGameClient(accountId: string) {
  const active = activeLocalGameClient;
  if (!active || active.accountId !== accountId) {
    throw new Error('请先登录当前本地账号');
  }
  if (!hasUsableSession(active.client.session)) {
    throw new Error('当前本地游戏会话无效，请重新登录');
  }
  if (active.client.hasUncertainSession) {
    throw new Error('本地游戏会话状态未确认，请重新登录后再试');
  }
  return active.client;
}

/** Execute an operation with the one currently logged-in local account. */
export function withAutoResearchLocalGameClient<T>(
  accountId: string,
  operation: (client: SuccessionGameClient) => Promise<T>,
) {
  return operation(requireCurrentLocalGameClient(accountId));
}

/** Leave local mode and drop UmaShow's only local game client. */
export async function clearAutoResearchLocalGameClient() {
  await enqueueLocalGameClientLifecycle(async () => {
    await waitForRetiringLocalGameClients();
    const active = activeLocalGameClient;
    activeLocalGameClient = null;
    if (active) {
      await retireLocalGameClient(active.client);
    }
  });
}

/** Clear the current client only when the specified saved account owns it. */
export function clearAutoResearchLocalGameClientForAccount(accountId: string) {
  const active = activeLocalGameClient;
  if (active?.accountId === accountId) {
    activeLocalGameClient = null;
    void retireLocalGameClient(active.client);
  }
}

/** Clear the current client when externally captured credentials replace it. */
export function clearAutoResearchLocalGameClientForUid(uid: string) {
  const active = activeLocalGameClient;
  if (active?.uid === uid) {
    activeLocalGameClient = null;
    void retireLocalGameClient(active.client);
  }
}

export function getAutoResearchLocalGameClientSession(accountId: string) {
  const active = activeLocalGameClient;
  if (
    !active ||
    active.accountId !== accountId ||
    active.client.hasUncertainSession ||
    !hasUsableSession(active.client.session)
  ) {
    return null;
  }
  return { ...active.client.session };
}
