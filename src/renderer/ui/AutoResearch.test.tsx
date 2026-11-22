import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import AutoResearch from './AutoResearch';
import { CAREER_SETTINGS_KEY } from 'renderer/components/autoResearch/shared';
import type { DailyTasksConfig } from 'renderer/components/autoResearch/types';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

jest.mock('renderer/utils/umdb', () => ({
  UMDB: { data: { cards: {}, charas: {} } },
  loadUMDB: jest.fn().mockResolvedValue({ cards: {}, charas: {} }),
}));
jest.mock('renderer/components/AppMenuPortal', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock(
  'renderer/components/autoResearch/AutomationControlCard',
  () => () => null,
);
jest.mock('renderer/components/autoResearch/ProgressTab', () => () => null);

const savedServer = 'http://hosted.test:18765';
const account = {
  id: 'last-account',
  uid: '123',
  label: '上次账号',
  source: 'manual',
  accessKeyPreview: '',
  updatedAt: '',
};
const options = {
  umas: [],
  supports: [],
  decks: [],
  parents: [],
  friends: [],
  friend_exclude_ids: [],
  offline_scenarios: [],
};

function setup(hosted: boolean, health = true, rememberAccount = true, idleCareer = false) {
  localStorage.clear();
  localStorage.setItem('autoResearch.server', savedServer);
  if (rememberAccount)
    localStorage.setItem('autoResearch.lastLoggedInAccount', account.id);
  const api = {
    accounts: jest
      .fn()
      .mockResolvedValue([
        account,
        { ...account, id: 'other-account', uid: '456' },
      ]),
    credentials: jest.fn().mockResolvedValue([]),
    currentSession: jest.fn().mockResolvedValue(null),
    dailyTasksOverview: jest.fn(async (_id: string, config: DailyTasksConfig) => ({
      success: true, daily_tasks: config, options: {},
    })),
    localOverview: jest.fn().mockResolvedValue({
      success: true,
      runtime: { logged_in: true, session_owner: 'local' },
      dashboard: {
        ...options,
        account: {
          idle_single_mode: idleCareer ? { active: true, state: 'playing', name: '北部玄驹' } : null,
          tp: { current: 0, max: 100 },
          carrots: { total: 0 },
          gold: 0,
          clocks: 0,
          energy_drinks: 0,
        },
      },
    }),
    credential: jest
      .fn()
      .mockResolvedValue({ uid: '123', accessKey: 'test-key' }),
    clearLocalSession: jest.fn().mockResolvedValue(undefined),
    loginSession: jest.fn(),
    onCredentialCaptured: jest.fn(() => () => {}),
    onLoginProgress: jest.fn(() => () => {}),
    getUiSetting: jest.fn((key: string) => idleCareer && key === CAREER_SETTINGS_KEY
      ? JSON.stringify([{ id: 'offline-save', account_uid: account.uid, name: '离线育成', mode: 'offline',
          preset_name: '', card_id: 0, deck_id: 0, offline_design: { source: 'custom', raceIds: [] } }])
      : null),
    setUiSetting: jest.fn().mockReturnValue(true),
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { autoResearch: api },
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
  });
  const fetchMock = jest.fn(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }> => {
      const url = String(input);
      if (url.endsWith('/api/health'))
        return {
          ok: health,
          json: async () => ({ success: health, detail: '服务器不可达' }),
        };
      if (url.endsWith('/api/auth/attach'))
        return {
          ok: hosted,
          status: hosted ? 200 : 404,
          json: async () =>
            hosted
              ? {
                  success: true,
                  token: 'hosted-token',
                  runtime: {
                    logged_in: true,
                    session_owner: 'server',
                    account: null,
                    automation: {
                      schedule: {
                        id: 'existing-task',
                        items: [],
                        cadence: 'once',
                      },
                      observation: {
                        phase: 'waiting',
                        current_index: -1,
                        completed_runs: 0,
                        daily_jewel_drops: 0,
                        runner: { running: false },
                      },
                    },
                  },
                }
              : { detail: '服务端没有该账号正在运行的托管任务' },
        };
      if (url.endsWith('/api/account/options'))
        return { ok: true, json: async () => ({ success: true, options }) };
      if (url.endsWith('/api/account/career/schedule/stream'))
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        });
      throw new Error(`Unexpected request: ${url}`);
    },
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<AutoResearch />);
  return { api, fetchMock };
}

test.each([true, false])(
  'restores the last hosted account on startup without a game login (hosted=%s)',
  async (hosted) => {
    const { api, fetchMock } = setup(hosted);
    await waitFor(() =>
      expect(api.credential).toHaveBeenCalledWith(account.id),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('正在连接服务器上的托管任务'),
      ).not.toBeInTheDocument(),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/api/health'),
      ),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        String(url).endsWith('/api/auth/attach'),
      ),
    ).toHaveLength(1);
    expect(api.credential).toHaveBeenCalledTimes(1);
    expect(api.loginSession).not.toHaveBeenCalled();
    expect(screen.queryAllByText('服务器托管').length > 0).toBe(hosted);
  },
);

test('a failed startup reconnect does not retry or perform a game login', async () => {
  const { api, fetchMock } = setup(false, false);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('服务器不可达'),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(api.credential).not.toHaveBeenCalled();
  expect(api.loginSession).not.toHaveBeenCalled();
});

test('does not automatically pick another account when there is no saved last account', async () => {
  const { api, fetchMock } = setup(false, true, false);
  await waitFor(() =>
    expect(screen.getByText('请先选择要使用的账号。')).toBeInTheDocument(),
  );
  expect(api.currentSession).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(api.loginSession).not.toHaveBeenCalled();
});

test('restores an existing local session without reconnecting the hosted server', async () => {
  const { api, fetchMock } = setup(false);
  api.currentSession.mockResolvedValue({ sid: 'local-sid', viewer_id: '123' });
  await waitFor(() =>
    expect(api.localOverview).toHaveBeenCalledWith(account.id),
  );
  await waitFor(() =>
    expect(screen.queryAllByText('本地').length > 0).toBe(true),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(api.credential).not.toHaveBeenCalled();
  expect(api.loginSession).not.toHaveBeenCalled();
});

test('shows the active offline career on the overview and hides it while editing a setting', async () => {
  const { api } = setup(false, true, true, true);
  api.currentSession.mockResolvedValue({ sid: 'local-sid', viewer_id: '123' });
  expect(await screen.findByText('检测到离线自动育成')).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: '进入详设' }));
  expect(await screen.findByText('离线育成设置')).toBeVisible();
  expect(screen.queryByText('检测到离线自动育成')).toBeNull();
  expect(screen.queryByRole('button', { name: '放弃离线育成' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  expect(await screen.findByText('检测到离线自动育成')).toBeVisible();
});

const dailyConfig: DailyTasksConfig = {
  schema_version: 3,
  run_with_career: true,
  daily_race: { enabled: true, daily_race_id: 11, trained_chara_id: 12, running_style: 1 },
  daily_legend_race: { enabled: false, daily_legend_race_id: 0, trained_chara_id: 0, running_style: 0 },
  team_stadium: { enabled: false, opponent_strength: 3 },
  limited_shop: { enabled: false, buy_all: true },
  race_mission: { enabled: false },
};

async function openDaily(config: DailyTasksConfig | null, online = true) {
  const { api, fetchMock } = setup(false);
  api.currentSession.mockResolvedValue({ sid: 'local-sid', viewer_id: account.uid });
  api.getUiSetting.mockImplementation((key) => localStorage.getItem(key));
  localStorage.setItem('autoResearch.dailyTasks.v1', JSON.stringify({
    [account.uid]: { ...dailyConfig, run_with_career: false },
  }));
  await waitFor(() => expect(api.localOverview).toHaveBeenCalledWith(account.id));
  let remote = config;
  fetchMock.mockImplementation(async (url) => {
    if (!online || String(url) !== savedServer + '/api/account/configuration/query')
      throw new Error('offline');
    return { ok: true, json: async () => ({
      success: true, daily_config: remote && { payload: { daily_tasks: remote } },
    }) };
  });
  fireEvent.click((await screen.findAllByRole('button', { name: '日常' }))[0]);
  const toggle = await screen.findByRole('switch', { name: '养马同时完成日常' });
  return { api, fetchMock, toggle, changeRemote: (next: DailyTasksConfig) => { remote = next; } };
}

test('downloads daily settings on entry and preserves local edits until the server settings change', async () => {
  const { api, fetchMock, toggle, changeRemote } = await openDaily(dailyConfig);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(savedServer + '/api/account/configuration/query',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ uid: account.uid, access_key: 'test-key' }) }));
  expect(api.dailyTasksOverview).toHaveBeenCalledWith(account.id, dailyConfig);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(toggle);
  const refresh = screen.getAllByRole('button', { name: '刷新' }).at(-1)!;
  fireEvent.click(refresh);
  await waitFor(() => expect(api.dailyTasksOverview).toHaveBeenCalledTimes(2));
  expect(api.dailyTasksOverview).toHaveBeenLastCalledWith(account.id, { ...dailyConfig, run_with_career: false });
  const updated = { ...dailyConfig, race_mission: { enabled: true } };
  changeRemote(updated);
  fireEvent.click(refresh);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  expect(api.dailyTasksOverview).toHaveBeenLastCalledWith(account.id, updated);
  expect(api.loginSession).not.toHaveBeenCalled();
});

test.each([true, false])('keeps the saved local daily settings when no cloud config is available (online=%s)', async (online) => {
  const { api, toggle } = await openDaily(null, online);
  expect(api.dailyTasksOverview).toHaveBeenCalledWith(account.id, { ...dailyConfig, run_with_career: false });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('refreshing the cloud configuration keeps unsaved daily edits on screen', async () => {
  const { api, changeRemote } = await openDaily(dailyConfig);
  const race = screen.getByRole('switch', { name: '启用每日竞赛' });
  fireEvent.click(race);
  changeRemote({ ...dailyConfig, run_with_career: false });
  fireEvent.click(screen.getAllByRole('button', { name: '刷新' }).at(-1)!);
  await waitFor(() => expect(api.dailyTasksOverview).toHaveBeenCalledTimes(2));
  expect(race).toHaveAttribute('aria-checked', 'false');
});
