import {
  cloudCareerSetting,
  describeLogAction,
  formatAccountError,
  needsRelogin,
  normalizeBlueFactorMinimums,
  normalizeOnlineScenarioId,
  onlineScenarioLabel,
} from './shared';

describe('attribute factor minimums', () => {
  const ones = { speed: 1, stamina: 1, power: 1, guts: 1, wit: 1 };

  it('leaves new settings and the old prefilled defaults unrestricted', () => {
    expect(normalizeBlueFactorMinimums()).toEqual({});
    expect(normalizeBlueFactorMinimums({ blue_factor_minimums: ones })).toEqual({});
    expect(normalizeBlueFactorMinimums({
      evaluation_mode: 'parent',
      blue_factor_minimums: { ...ones, speed: 3, stamina: 0 },
    })).toEqual({ speed: 3, stamina: 0 });
    expect(normalizeBlueFactorMinimums({ blue_factor_minimums: { speed: 0 } })).toEqual({});
  });

  it('keeps explicitly chosen one-star minimums when reloading', () => {
    expect(normalizeBlueFactorMinimums({
      blue_factor_minimums: { wit: 1 },
    })).toEqual({ wit: 1 });
    expect(normalizeBlueFactorMinimums({
      blue_factor_minimums_version: 2,
      blue_factor_minimums: ones,
    })).toEqual(ones);
  });
});

const cloudConfig = (setting: Record<string, unknown>) => ({
  uid: '10001',
  config_id: 'cloud-config-id',
  name: '云端详设',
  payload: { setting },
  version: 1,
  updated_at: '2026-09-16T12:00:00+08:00',
});

describe('cloudCareerSetting', () => {
  it('keeps explicit offline cloud settings offline', () => {
    const setting = cloudCareerSetting(
      cloudConfig({
        id: 'local-id',
        name: '离线详设',
        mode: 'offline',
      }) as never,
    );
    expect(setting).toMatchObject({
      id: 'cloud-config-id',
      name: '云端详设',
      account_uid: '10001',
      mode: 'offline',
    });
  });

  it('recognizes legacy offline settings without an explicit mode', () => {
    const setting = cloudCareerSetting(
      cloudConfig({
        id: 'legacy-offline',
        name: '旧离线详设',
        offline_scenario_id: 5,
        offline_race_deck_num: 2,
      }) as never,
    );
    expect(setting?.mode).toBe('offline');
  });

  it('defaults legacy non-offline settings to online', () => {
    const setting = cloudCareerSetting(
      cloudConfig({ id: 'legacy-online', name: '旧在线详设' }) as never,
    );
    expect(setting?.mode).toBe('online');
  });
});

describe('describeLogAction', () => {
  it('describes Grand Masters actions in Chinese', () => {
    expect(describeLogAction('venus_spirit_use')).toBe('发动女神知识');
    expect(describeLogAction('venus_race_progress')).toBe('女神杯比赛');
  });

  it('describes settings updates in Chinese', () => {
    expect(describeLogAction('settings_updated')).toBe('详设已更新');
  });
});

describe('online scenario presets', () => {
  it.each([
    [1, 1, 'URA'],
    [5, 5, '荣耀女神杯'],
    ['5', 5, '荣耀女神杯'],
    [undefined, 1, 'URA'],
    [99, 1, 'URA'],
  ])('normalizes %p to scenario %i', (value, scenarioId, label) => {
    expect(normalizeOnlineScenarioId(value)).toBe(scenarioId);
    expect(onlineScenarioLabel(value)).toBe(label);
  });
});

describe('formatAccountError', () => {
  it.each([
    '错误码 217：账号数据已发生变化，需要重新建立登录会话',
    '错误码 218：SID session changed',
    'ApiError: result_code=218',
    'SID 会话已失效',
  ])('keeps account session error details: %s', (message) => {
    expect(formatAccountError(message)).toBe(message);
  });

  it('keeps unrelated errors unchanged', () => {
    expect(formatAccountError('网络连接超时')).toBe('网络连接超时');
  });
});

describe('needsRelogin', () => {
  it('recognizes game result codes that require a new session', () => {
    expect(needsRelogin(new Error('API error 102 on factor_select'))).toBe(
      true,
    );
    expect(needsRelogin(new Error('错误码 217：需要重新登录'))).toBe(true);
    expect(needsRelogin(new Error('result_code=218'))).toBe(true);
    expect(needsRelogin(new Error('错误码 201'))).toBe(true);
    expect(needsRelogin(new Error('1503'))).toBe(true);
  });

  it('still recognizes actual session and network failures', () => {
    expect(needsRelogin(new Error('网络请求失败：connection reset'))).toBe(
      true,
    );
  });
});
