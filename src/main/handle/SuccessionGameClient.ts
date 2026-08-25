/* eslint-disable no-bitwise */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomUUID,
} from 'crypto';
import { decode, encode } from '@msgpack/msgpack';

const GAME_HOST = 'https://le1-prod-bili-gs-uma.bilibiligame.net';
const LOGIN_HOST = 'https://line1-sdk-center-login-sh.biligame.net';
const COMMON_HEADER =
  '5ccdf6135f246a2238161c64cad86ee00f1f2d90033e1f0aa7a9554f4cc06e6f';
const COMMON_HEADER2 = '97054987b32d477f6d24a1631329765f9fc43a57';
const SID_SUFFIX = 'sK5R8VeFU4';
const LOGIN_SIGN_KEY = '2a7ee43463114270bf2620ae5d6d59c4';

export type SuccessionGameProgress = {
  stage: 'login' | 'load' | 'scan';
  detail: string;
  viewerId?: string;
  current?: number;
  total?: number;
};

type BiliGameUser = {
  uid: string;
  accessKey: string;
  appVer: string;
  appVerCode: string;
  resVer: string;
  deviceId: string;
  udid: string;
  sid: string;
  bumaOpenId: string;
  viewerId: string;
};

function javaHexDigit(value: string) {
  if (value >= '0' && value <= '9') return value.charCodeAt(0) - 48;
  const lower = value.toLowerCase();
  if (lower >= 'a' && lower <= 'f') return lower.charCodeAt(0) - 87;
  return -1;
}

function hexToBytesJava(value: string) {
  const result = Buffer.alloc(Math.floor(value.length / 2));
  for (let index = 0; index < result.length; index += 1) {
    const offset = index * 2;
    result[index] =
      ((javaHexDigit(value[offset]) << 4) + javaHexDigit(value[offset + 1])) &
      0xff;
  }
  return result;
}

function md5Bytes(value: Buffer | string) {
  return createHash('md5').update(value).digest('hex');
}

function md5HexBytes(value: string) {
  return md5Bytes(hexToBytesJava(value));
}

function getSid(value: string) {
  return md5Bytes(`${value}${SID_SUFFIX}`);
}

function loginSign(pairs: Array<[string, string]>) {
  const values = new Map(pairs);
  const joined = [...values.keys()]
    .sort()
    .map((key) => values.get(key) || '')
    .join('');
  return md5Bytes(`${joined}${LOGIN_SIGN_KEY}`);
}

function xorBuffers(left: Buffer, middle: Buffer, right: Buffer) {
  return Buffer.from(
    left.map((value, index) => value ^ middle[index] ^ right[index]),
  );
}

function aesKey(user: BiliGameUser) {
  return hexToBytesJava(md5HexBytes(`${user.sid}${COMMON_HEADER2}`));
}

function aesIv(user: BiliGameUser) {
  return hexToBytesJava(md5HexBytes(`${user.udid}${COMMON_HEADER2}`));
}

export function encryptSuccessionGameRequest(
  user: BiliGameUser,
  payload: Record<string, unknown>,
) {
  const cipher = createCipheriv('aes-128-cbc', aesKey(user), aesIv(user));
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(encode(payload))),
    cipher.final(),
  ]);
  const randomData = `${md5Bytes(randomUUID())}${md5Bytes(randomUUID())}`;
  const header = xorBuffers(
    hexToBytesJava(`${user.sid}${user.udid}`),
    hexToBytesJava(COMMON_HEADER),
    hexToBytesJava(randomData),
  );
  return Buffer.concat([
    Buffer.from('40000000', 'hex'),
    header,
    hexToBytesJava(randomData),
    encrypted,
  ]).toString('base64');
}

export function decryptSuccessionGameResponse(
  user: BiliGameUser,
  responseText: string,
) {
  const raw = Buffer.from(responseText.trim(), 'base64');
  const encrypted = raw.subarray(36);
  if (!encrypted.length || encrypted.length % 16 !== 0) {
    throw new Error('游戏接口返回了无法识别的加密数据');
  }
  const decipher = createDecipheriv('aes-128-cbc', aesKey(user), aesIv(user));
  const packed = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decode(packed, {
    mapKeyConverter: (key) =>
      typeof key === 'string' || typeof key === 'number' ? key : String(key),
  }) as Record<string, any>;
}

function bumaClientTime() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.toISOString().replace('Z', '')}+08:00`;
}

async function fetchWithTimeout(
  url: string,
  init: Parameters<typeof fetch>[1],
  timeout = 30_000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function gameError(endpoint: string, result: Record<string, any>) {
  const headers = result.data_headers || {};
  const resultCode = Number(headers.result_code ?? result.response_code ?? 0);
  if (result.response_code === 1 && (resultCode === 0 || resultCode === 1)) {
    return null;
  }
  const message = String(
    result.message || result.data?.error_message || `错误码 ${resultCode}`,
  );
  return new Error(`${endpoint} 请求失败：${message}`);
}

export class SuccessionGameClient {
  private user: BiliGameUser;

  private lastRequestAt = 0;

  constructor(
    uid: string,
    accessKey: string,
    private readonly onProgress?: (progress: SuccessionGameProgress) => void,
  ) {
    const deviceId = randomUUID().toUpperCase();
    this.user = {
      uid,
      accessKey,
      appVer: '1.33.6',
      appVerCode: '10860',
      resVer: '10010670:TUqzSticaJSa',
      deviceId,
      udid: deviceId.replace(/-/g, '').toLowerCase(),
      sid: '',
      bumaOpenId: '0',
      viewerId: '0',
    };
  }

  get credential() {
    return { uid: this.user.uid, accessKey: this.user.accessKey };
  }

  get viewerId() {
    return this.user.viewerId;
  }

  private devicePayload(viewerId?: number) {
    return {
      viewer_id: viewerId ?? Number(this.user.viewerId),
      device: 2,
      device_id: this.user.udid,
      device_name: 'Redmi 22041211A',
      graphics_device_name: 'Adreno (TM) 640',
      ip_address: '10.0.2.15',
      platform_os_version: 'Android OS 12 / API-32 (V417IR/1598)',
      carrier: 'Redmi',
      keychain: 0,
      locale: 'JPN',
      button_info: '',
      dmm_viewer_id: null,
      dmm_onetime_token: null,
      buma_viewer_id: null,
      channel: '1',
      buma_client_time: bumaClientTime(),
      b_zone: 'CN',
      b_device_type: 2,
    };
  }

  private async oauthLogin() {
    const path = '/api/external/user.token.oauth.login/v3';
    const pairs: Array<[string, string]> = [
      [
        'bd_id',
        'E1E49DA4-10E5-4C05-9D5B-41906D6E9F90-47D49F88-4869-43CA-9320-B71',
      ],
      ['c', '1'],
      ['channel_id', '1000'],
      ['domain', 'line1-sdk-center-login-sh.biligame.net'],
      ['domain_switch_count', '0'],
      ['game_id', '125'],
      ['merchant_id', '1'],
      ['access_key', this.user.accessKey],
      ['uid', this.user.uid],
      ['req_method', path],
      ['request_id', randomUUID().toLowerCase()],
      ['sdk_log_type', '3'],
      ['sdk_type', '2'],
      ['sdk_ver', '5.9.5'],
      ['server_id', '5478'],
      ['timestamp', String(Date.now())],
      ['udid', this.user.deviceId],
      ['version', '3'],
    ];
    pairs.push(['sign', loginSign(pairs)]);
    const response = await fetchWithTimeout(`${LOGIN_HOST}${path}`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        Connection: 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 BSGameSDK',
      },
      body: new URLSearchParams(pairs),
    });
    if (!response.ok) throw new Error(`B站登录失败：HTTP ${response.status}`);
    const result = (await response.json()) as Record<string, any>;
    if (Number(result.code) !== 0) {
      const code = String(result.code ?? '');
      if (['200007', '200000', '-500'].includes(code)) {
        throw new Error('access_key 已触发验证码，请重新登录游戏获取凭据');
      }
      throw new Error(String(result.message || `B站登录失败：${code}`));
    }
    this.user.accessKey = String(result.access_key || this.user.accessKey);
    this.user.uid = String(result.uid || this.user.uid);
    this.user.bumaOpenId = this.user.uid;
  }

  private async postGame(endpoint: string, payload: Record<string, unknown>) {
    const body = encryptSuccessionGameRequest(this.user, payload);
    const response = await fetchWithTimeout(`${GAME_HOST}/${endpoint}`, {
      method: 'POST',
      headers: {
        Accept: '*/*',
        'APP-VER': this.user.appVer,
        'APP-VER-CODE': this.user.appVerCode,
        'BUMA-OPEN-ID': this.user.bumaOpenId,
        'BUMA-RID': md5HexBytes(randomUUID()),
        'BX-Accept-Language': 'zh',
        'Content-Type': 'application/x-msgpack',
        Device: '2',
        'Device-SubType': '1',
        'RES-VER': this.user.resVer,
        SID: this.user.sid,
        'User-Agent':
          'UnityPlayer/2020.3.49f1 (UnityWebRequest/1.0, libcurl/7.84.0-DEV)',
        ViewerID: this.user.viewerId,
        'X-Ba-Catch-Control': 'no-cache',
        'X-Ba-Charset': 'utf8',
        'X-Unity-Version': '2020.3.49f1',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`${endpoint} 网络请求失败：HTTP ${response.status}`);
    }
    const result = decryptSuccessionGameResponse(
      this.user,
      await response.text(),
    );
    const sid = result.data_headers?.sid;
    if (sid) this.user.sid = getSid(String(sid));
    const resourceVersion = result.data?.resource_version;
    if (resourceVersion) this.user.resVer = String(resourceVersion);
    const error = gameError(endpoint, result);
    if (error) throw error;
    return result;
  }

  private async call(endpoint: string, args: Record<string, unknown> = {}) {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < 160) {
      await new Promise((resolve) => {
        setTimeout(resolve, 160 - elapsed);
      });
    }
    this.lastRequestAt = Date.now();
    return this.postGame(endpoint, { ...args, ...this.devicePayload() });
  }

  async login() {
    this.onProgress?.({ stage: 'login', detail: '正在验证 UID 与 access_key' });
    this.user.sid = getSid(
      `${this.user.viewerId}${this.user.deviceId.toLowerCase()}`,
    );
    await this.oauthLogin();
    this.onProgress?.({ stage: 'login', detail: '正在建立游戏登录会话' });
    const signup = await this.postGame('tool/signup', {
      ...this.devicePayload(0),
      credential: '',
      error_code: 0,
      error_message: '',
      attestation_type: 2,
      buma_uid: this.user.uid,
      buma_access_token: this.user.accessKey,
    });
    this.user.viewerId = String(signup.data?.viewer_id || '0');
    if (this.user.viewerId === '0') {
      throw new Error('游戏登录没有返回 viewer_id');
    }
    this.user.sid = getSid(
      `${this.user.viewerId}${this.user.deviceId.toLowerCase()}`,
    );
    await this.postGame('tool/start_session', this.devicePayload());
    this.onProgress?.({ stage: 'load', detail: '正在读取账号基础数据' });
    await this.call('load/index', { adid: '' });
  }

  async searchPlayer(viewerId: string) {
    const result = await this.call('friend/search', {
      friend_viewer_id: Number(viewerId),
    });
    const data = result.data || {};
    if (!data.practice_partner_info) {
      throw new Error('该玩家没有可读取的代表马娘');
    }
    return {
      viewerId,
      userInfo: data.user_info_summary || { viewer_id: Number(viewerId) },
      practicePartner: data.practice_partner_info,
    };
  }

  async preparePracticeRace() {
    return this.call('practice_race/index');
  }

  async startPracticeRace(payload: Record<string, unknown>) {
    return this.call('practice_race/race_start', payload);
  }

  async endPracticeRace() {
    return this.call('practice_race/race_end', {
      is_save: 0,
      overwrite_race_id: 0,
    });
  }
}

export function parseSuccessionPlayerIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[^0-9]+/)
        .map((item) => item.trim())
        .filter((item) => /^\d{6,16}$/.test(item)),
    ),
  ];
}
