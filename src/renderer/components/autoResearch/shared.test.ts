import { formatAccountError } from './shared';

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
