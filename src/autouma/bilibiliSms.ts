import { createHash, randomUUID } from 'crypto';

const SMS_LOGIN_HOST = 'https://line1-sdk-center-login-sh.biligame.net';
const SMS_APP_KEY = '489185c6fdfd47f192d85f12ed7b35f4';
const SMS_RSA_MODULUS = BigInt(
  '0x9bd251710f53895feb03bc6d679fe4068bde702113fbd58d2bda3b38ecd8139989cc28ab7055b45d729bdcfcc61e3903f539409471008125a296a53b6cb887853e05d8948abb968a0aab12f9c73076aae1008a745545359a3e90f9bf445ee27e1be9266612be018d583642156b544f201d6905425459c1fe5fe93aeb91d3fe05',
);
const SMS_RSA_EXPONENT = 65_537n;

export type BilibiliSmsFields = Record<string, string>;

export type BilibiliSmsChallenge = {
  phone: string;
  captchaKey: string;
  expiresAt: number;
  commonFields: BilibiliSmsFields;
};

export type BilibiliSmsResult = {
  uid: string;
  accessKey: string;
};

export type BilibiliSmsResponse = {
  status: number;
  data: unknown;
};

export type BilibiliSmsTransport = (
  url: string,
  body: string,
) => Promise<BilibiliSmsResponse>;

function md5(value: string) {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

function randomDeviceId() {
  return randomUUID().replace(/-/g, '').toUpperCase();
}

function buildCommonFields() {
  const deviceId = randomDeviceId();
  return {
    cur_buvid: deviceId,
    old_buvid: deviceId,
    udid: deviceId,
    bd_id: randomUUID(),
    app_id: '6321',
    game_id: '6321',
    server_id: '5477',
    sdk_ver: '6.28.0',
    app_ver: '2.0.2',
    version_code: '11150',
    channel_id: '1',
    sdk_type: '1',
    merchant_id: '1',
    platform: '3',
    platform_type: '3',
    apk_sign: '4502a02a00395dec05a4134ad593224d',
    version: '3',
    domain_switch_count: '0',
    country_code: '86',
    domain: 'line1-sdk-center-login-sh.biligame.net',
    original_domain: `${SMS_LOGIN_HOST}`,
    sdk_log_type: '1',
    current_env: '0',
  };
}

export function signBilibiliForm(fields: BilibiliSmsFields) {
  const excluded = new Set([
    'feign_sign',
    'item_desc',
    'item_name',
    'token',
    'sign',
  ]);
  const joined = Object.keys(fields)
    .filter((key) => !excluded.has(key.toLowerCase()))
    .sort()
    .map((key) => fields[key] || '')
    .join('');
  return md5(`${joined}${SMS_APP_KEY}`);
}

export function encodeBilibiliForm(fields: BilibiliSmsFields) {
  return new URLSearchParams(fields).toString();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function bytesToBigInt(bytes: Uint8Array) {
  return bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n);
}

function bigIntToBytes(value: bigint, length: number) {
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function modularPower(base: bigint, exponent: bigint, modulus: bigint) {
  let result = 1n;
  let factor = base % modulus;
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
    power >>= 1n;
  }
  return result;
}

function randomNonZeroBytes(length: number) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('当前运行环境不支持短信登录加密');
  }
  const result = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const candidate = new Uint8Array(length - offset);
    globalThis.crypto.getRandomValues(candidate);
    candidate.forEach((value) => {
      if (value && offset < length) {
        result[offset] = value;
        offset += 1;
      }
    });
  }
  return result;
}

export function createBilibiliFeignSign(sign: string) {
  // The SDK uses RSA/ECB/PKCS1Padding. WebCrypto intentionally omits that
  // legacy encryption mode, so encode the public-key operation directly.
  const message = new TextEncoder().encode(sign);
  const blockSize = 128;
  if (message.length > blockSize - 11) throw new Error('短信登录签名过长');
  const block = new Uint8Array(blockSize);
  block[1] = 2;
  block.set(randomNonZeroBytes(blockSize - message.length - 3), 2);
  block[blockSize - message.length - 1] = 0;
  block.set(message, blockSize - message.length);
  const encrypted = modularPower(
    bytesToBigInt(block),
    SMS_RSA_EXPONENT,
    SMS_RSA_MODULUS,
  );
  return bytesToBase64(bigIntToBytes(encrypted, blockSize));
}

async function postForm(
  transport: BilibiliSmsTransport,
  endpoint: string,
  fields: BilibiliSmsFields,
) {
  const response = await transport(
    `${SMS_LOGIN_HOST}${endpoint}`,
    encodeBilibiliForm(fields),
  );
  const data =
    typeof response.data === 'string'
      ? JSON.parse(response.data)
      : response.data;
  if (response.status < 200 || response.status >= 300) {
    throw new Error('B 站登录服务暂时不可用，请稍后重试');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('B 站登录服务返回了无效响应');
  }
  const payload = data as Record<string, unknown>;
  if (Number(payload.code) !== 0) {
    throw new Error(
      String(payload.server_message || payload.message || 'B 站登录请求失败'),
    );
  }
  return payload;
}

export async function sendBilibiliSmsCode(
  transport: BilibiliSmsTransport,
  phone: string,
): Promise<BilibiliSmsChallenge> {
  const normalizedPhone = phone.replace(/\s+/g, '');
  if (!/^1\d{10}$/.test(normalizedPhone)) {
    throw new Error('请输入有效的 11 位手机号');
  }
  const commonFields = buildCommonFields();
  const fields = {
    ...commonFields,
    otp_type: 'login',
    otp_channel_no: normalizedPhone,
    otp_channel_category: 'tel',
    timestamp: String(Date.now()),
  };
  const payload = await postForm(transport, '/api/external/otp/send/v3', {
    ...fields,
    sign: signBilibiliForm(fields),
  });
  const captchaKey = String(payload.captcha_key || '');
  if (!captchaKey) throw new Error('B 站没有返回验证码会话，请重新发送');
  return {
    phone: normalizedPhone,
    captchaKey,
    expiresAt: Date.now() + 5 * 60_000,
    commonFields,
  };
}

export async function loginBilibiliSms(
  transport: BilibiliSmsTransport,
  challenge: BilibiliSmsChallenge,
  otp: string,
): Promise<BilibiliSmsResult> {
  if (!challenge.captchaKey || challenge.expiresAt <= Date.now()) {
    throw new Error('验证码会话已过期，请重新发送验证码');
  }
  if (!/^\d{6}$/.test(otp)) throw new Error('请输入 6 位短信验证码');
  const fields = {
    ...challenge.commonFields,
    captcha_key: challenge.captchaKey,
    mobile: challenge.phone,
    otp,
    timestamp: String(Date.now()),
  };
  const sign = signBilibiliForm(fields);
  const payload = await postForm(transport, '/api/external/login/otp/v3', {
    ...fields,
    sign,
    feign_sign: createBilibiliFeignSign(sign),
  });
  const uid = String(payload.uid || '');
  const accessKey = String(payload.access_key || '');
  if (!uid || !accessKey) throw new Error('B 站登录成功但没有返回 access_key');
  return { uid, accessKey };
}

export function createBilibiliSmsTransport(): BilibiliSmsTransport {
  return async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 BSGameSDK',
      },
      body,
    });
    const text = await response.text();
    return { status: response.status, data: text };
  };
}
