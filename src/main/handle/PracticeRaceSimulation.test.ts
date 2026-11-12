import type { IpcMain } from 'electron';
import type { RaceRecord } from 'types/gameTypes';
import handlePracticeRaceSimulation from './PracticeRaceSimulation';
import {
  loginAutoResearchLocalGameClient,
  withAutoResearchLocalGameClient,
} from './AutoResearchLocalGameClient';
import { createRaceArchive, persistRaceInfoToArchive } from './RaceInfo';
import {
  buildPracticeRaceStartPayload,
  getPracticeRaceSourceViewerIds,
} from './PracticeRaceRequest';

jest.mock('./AutoResearchLocalGameClient', () => ({
  loginAutoResearchLocalGameClient: jest.fn(),
  withAutoResearchLocalGameClient: jest.fn(),
}));
jest.mock('./RaceInfo', () => ({
  createRaceArchive: jest.fn(),
  persistRaceInfoToArchive: jest.fn(),
}));
jest.mock('./PracticeRaceRequest', () => ({
  buildPracticeRaceStartPayload: jest.fn(() => ({})),
  getPracticeRaceSourceViewerIds: jest.fn(() => ['123']),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
}

function setup() {
  jest.mocked(buildPracticeRaceStartPayload).mockReturnValue({} as never);
  jest.mocked(getPracticeRaceSourceViewerIds).mockReturnValue(['123']);
  const handlers = new Map<string, (...args: any[]) => any>();
  handlePracticeRaceSimulation({
    handle: (name: string, callback: (...args: any[]) => any) =>
      handlers.set(name, callback),
  } as unknown as IpcMain);
  const client = {
    viewerId: '123',
    preparePracticeRace: jest.fn().mockResolvedValue({ data: { state: 0 } }),
    startPracticeRace: jest.fn().mockResolvedValue({ data: {} }),
    endPracticeRace: jest.fn().mockResolvedValue({}),
  };
  jest
    .mocked(withAutoResearchLocalGameClient)
    .mockImplementation(async (_id, operation) => operation(client as never));
  jest
    .mocked(createRaceArchive)
    .mockReturnValue({ id: 'archive', name: '测试模拟', createdAt: 0 });
  jest.mocked(persistRaceInfoToArchive).mockReturnValue([{} as RaceRecord]);
  const sender = { isDestroyed: jest.fn(() => false), send: jest.fn() };
  return {
    client,
    sender,
    run: (count = 10) =>
      handlers.get('race:repeat-simulation')!(
        { sender },
        { accountId: 'account', archiveName: '测试模拟', count, source: {} },
      ),
    stop: () => handlers.get('race:repeat-simulation:stop')!(),
    status: () => handlers.get('race:repeat-simulation:status')!(),
  };
}

beforeEach(() => jest.resetAllMocks());

test('stopping during login does not create an archive or start a race', async () => {
  const { run, stop, status, client } = setup();
  const login = deferred<void>();
  jest
    .mocked(loginAutoResearchLocalGameClient)
    .mockReturnValueOnce(login.promise as never);
  const task = run();
  expect(status().running).toBe(true);
  stop();
  expect(status().stopping).toBe(true);
  login.resolve();
  expect(await task).toMatchObject({ ok: true, cancelled: true, completed: 0 });
  expect(createRaceArchive).not.toHaveBeenCalled();
  expect(client.startPracticeRace).not.toHaveBeenCalled();
  expect(status()).toMatchObject({
    running: false,
    stopping: false,
    progress: { stage: 'stopped' },
  });
});

test('stopping an in-flight race saves it and waits for race_end before releasing the task', async () => {
  const { run, stop, status, client } = setup();
  const started = deferred<void>();
  const race = deferred<{ data: {} }>();
  const ending = deferred<void>();
  const ended = deferred<void>();
  client.startPracticeRace.mockImplementationOnce(() => {
    started.resolve();
    return race.promise;
  });
  client.endPracticeRace.mockImplementationOnce(() => {
    ending.resolve();
    return ended.promise;
  });
  const task = run();
  await started.promise;
  stop();
  race.resolve({ data: {} });
  await ending.promise;
  expect(persistRaceInfoToArchive).toHaveBeenCalledTimes(1);
  expect(status()).toMatchObject({ running: true, stopping: true });
  await expect(run()).rejects.toThrow('已有重复模拟任务正在运行');
  ended.resolve();
  expect(await task).toMatchObject({
    cancelled: true,
    completed: 1,
    archiveId: 'archive',
  });
  expect(client.startPracticeRace).toHaveBeenCalledTimes(1);
  expect(status().result.completed).toBe(1);
});

test('stopping during preparation prevents race_start', async () => {
  const { run, stop, client } = setup();
  const preparing = deferred<void>();
  const ready = deferred<{ data: { state: number } }>();
  client.preparePracticeRace.mockImplementationOnce(() => {
    preparing.resolve();
    return ready.promise;
  });
  const task = run();
  await preparing.promise;
  stop();
  ready.resolve({ data: { state: 0 } });
  expect(await task).toMatchObject({ cancelled: true, completed: 0 });
  expect(client.startPracticeRace).not.toHaveBeenCalled();
});

test('a destroyed renderer does not interrupt saving or finishing a race', async () => {
  const { run, sender, status, client } = setup();
  sender.isDestroyed.mockReturnValue(true);
  expect(await run(1)).toMatchObject({ ok: true, completed: 1 });
  expect(sender.send).not.toHaveBeenCalled();
  expect(client.endPracticeRace).toHaveBeenCalledTimes(1);
  expect(status()).toMatchObject({ running: false, result: { completed: 1 } });
});

test('race_end errors remain visible with the count of saved races', async () => {
  const { run, stop, status, client } = setup();
  client.endPracticeRace.mockImplementationOnce(async () => {
    stop();
    throw new Error('race_end 失败');
  });
  expect(await run()).toMatchObject({
    ok: false,
    cancelled: false,
    completed: 1,
    error: 'race_end 失败',
  });
  expect(status()).toMatchObject({
    running: false,
    progress: { stage: 'error' },
  });
});
