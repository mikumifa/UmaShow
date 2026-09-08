import { CapacitorHttp } from '@capacitor/core';
import {
  SuccessionGameClient,
  SuccessionGameHttpTransport,
  SuccessionGameProgress,
} from 'main/handle/SuccessionGameClient';
import {
  getMobileCredential,
  rememberMobileViewer,
  saveMobileAccounts,
} from './accounts';

type ActiveClient = {
  accountId: string;
  uid: string;
  client: SuccessionGameClient;
};

let activeClient: ActiveClient | null = null;

export const capacitorGameTransport: SuccessionGameHttpTransport = async (
  url,
  request,
) => {
  const response = await CapacitorHttp.request({
    url,
    method: request.method,
    headers: request.headers,
    data: request.body,
    responseType: 'text',
    connectTimeout: request.timeoutMs,
    readTimeout: request.timeoutMs,
  });
  const text =
    typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data ?? {});
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    text,
  };
};

function usable(client: SuccessionGameClient) {
  const session = client.session;
  return Boolean(
    !client.hasUncertainSession &&
      session.sid &&
      session.viewer_id &&
      session.viewer_id !== '0',
  );
}

export async function loginMobileGameClient(
  accountId: string,
  onProgress?: (progress: SuccessionGameProgress) => void,
) {
  if (activeClient) await activeClient.client.closeAndDrain();
  activeClient = null;
  const credential = getMobileCredential(accountId);
  const client = new SuccessionGameClient(
    credential.uid,
    credential.accessKey,
    onProgress,
    null,
    capacitorGameTransport,
  );
  try {
    const loginIndex = await client.login();
    onProgress?.({
      stage: 'load',
      detail: '正在读取育成角色、继承与好友支援信息',
    });
    const optionIndex = await client.loadSingleModeOptions();
    const refreshed = client.credential;
    saveMobileAccounts([
      {
        uid: refreshed.uid,
        accessKey: refreshed.accessKey,
        source: 'Android 本地登录刷新',
      },
    ]);
    rememberMobileViewer(refreshed.uid, client.viewerId);
    activeClient = { accountId, uid: refreshed.uid, client };
    return { loginIndex, optionIndex, session: client.session };
  } catch (error) {
    await client.closeAndDrain();
    throw error;
  }
}

export function withAutoResearchLocalGameClient<T>(
  accountId: string,
  operation: (client: SuccessionGameClient) => Promise<T>,
) {
  if (!activeClient || activeClient.accountId !== accountId) {
    throw new Error('请先登录当前本地账号');
  }
  if (!usable(activeClient.client)) {
    throw new Error('当前本地游戏会话无效，请重新登录');
  }
  return operation(activeClient.client);
}

export function getMobileGameSession(accountId: string) {
  if (
    !activeClient ||
    activeClient.accountId !== accountId ||
    !usable(activeClient.client)
  ) {
    return null;
  }
  return activeClient.client.session;
}

export async function clearAutoResearchLocalGameClient() {
  const current = activeClient;
  activeClient = null;
  if (current) await current.client.closeAndDrain();
}

export async function clearMobileGameClient(accountId?: string) {
  if (accountId && activeClient?.accountId !== accountId) return;
  await clearAutoResearchLocalGameClient();
}

export function clearAutoResearchLocalGameClientForAccount(accountId: string) {
  if (activeClient?.accountId === accountId) {
    void clearAutoResearchLocalGameClient();
  }
}

export function clearAutoResearchLocalGameClientForUid(uid: string) {
  if (activeClient?.uid === uid) {
    void clearAutoResearchLocalGameClient();
  }
}

export function getAutoResearchLocalGameClientSession(accountId: string) {
  return getMobileGameSession(accountId);
}
