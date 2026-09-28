import { IpcMain } from 'electron';
import { randomUUID } from 'crypto';
import {
  createBilibiliSmsTransport,
  loginBilibiliSms,
  sendBilibiliSmsCode,
  BilibiliSmsChallenge,
} from 'autouma/bilibiliSms';

const transport = createBilibiliSmsTransport();
const challenges = new Map<string, BilibiliSmsChallenge>();

export function handleBilibiliSmsLogin(ipcMain: IpcMain) {
  ipcMain.handle('autoresearch:bilibili-sms-send', async (_, phone: string) => {
    const challenge = await sendBilibiliSmsCode(transport, phone);
    const challengeId = randomUUID();
    challenges.set(challengeId, challenge);
    return { challengeId, expiresAt: challenge.expiresAt };
  });
  ipcMain.handle(
    'autoresearch:bilibili-sms-login',
    async (_, challengeId: string, otp: string) => {
      const challenge = challenges.get(challengeId);
      if (!challenge) throw new Error('验证码会话不存在，请重新发送验证码');
      const result = await loginBilibiliSms(transport, challenge, otp);
      challenges.delete(challengeId);
      return result;
    },
  );
}
