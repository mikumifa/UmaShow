import { SuccessionGameClient } from './SuccessionGameClient';

const originalFetchDescriptor = Object.getOwnPropertyDescriptor(
  global,
  'fetch',
);

describe('SuccessionGameClient session safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetchDescriptor) {
      Object.defineProperty(global, 'fetch', originalFetchDescriptor);
    } else {
      Reflect.deleteProperty(global, 'fetch');
    }
  });

  test('serializes pending calls and refuses to reuse an uncertain SID', async () => {
    let rejectFetch: ((reason?: unknown) => void) | undefined;
    const pendingResponse = new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    });
    const fetch = jest.fn().mockReturnValue(pendingResponse);
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      value: fetch,
    });
    const client = new SuccessionGameClient('uid', 'access-key');

    const first = client.call('load/index');
    const second = client.call('daily_race/index');
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(rejectFetch).toBeDefined();
    rejectFetch?.(new Error('offline'));

    await expect(first).rejects.toThrow('请求结果未确认');
    expect(client.hasUncertainSession).toBe(true);
    await expect(second).rejects.toThrow('本地游戏会话状态未确认');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
