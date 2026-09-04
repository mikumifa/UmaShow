import {
  formatAccountError,
  needsRelogin,
  normalizeOnlineScenarioId,
  onlineScenarioLabel,
} from './shared';

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
  ])('shortens account session errors: %s', (message) => {
    expect(formatAccountError(message)).toBe('账号已在别处登录');
  });

  it('keeps unrelated errors unchanged', () => {
    expect(formatAccountError('网络连接超时')).toBe('网络连接超时');
  });
});

describe('needsRelogin', () => {
  it('does not treat ordinary API result codes as session failures', () => {
    expect(needsRelogin(new Error('API error 102 on factor_select'))).toBe(
      false,
    );
  });

  it('still recognizes actual session and network failures', () => {
    expect(needsRelogin(new Error('错误码 217：需要重新登录'))).toBe(true);
    expect(needsRelogin(new Error('网络请求失败：connection reset'))).toBe(
      true,
    );
  });
});
