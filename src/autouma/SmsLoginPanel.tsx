import { FormEvent, useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, X } from 'lucide-react';

type Props = {
  onClose: () => void;
  onComplete: (result: { uid: string; accessKey: string }) => Promise<void>;
};

export default function SmsLoginPanel({ onClose, onComplete }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [challengeExpiresAt, setChallengeExpiresAt] = useState(0);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!resendAvailableAt && !challengeExpiresAt) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const next = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
      setRemaining(next);
      if (challengeExpiresAt && challengeExpiresAt <= now) {
        setChallengeId('');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [challengeExpiresAt, resendAvailableAt]);

  const sendCode = async () => {
    setBusy('send');
    setError('');
    try {
      const result =
        await window.electron.autoResearch.sendBilibiliSmsCode(phone);
      setChallengeId(String(result.challengeId || ''));
      setChallengeExpiresAt(Number(result.expiresAt || 0));
      setResendAvailableAt(Date.now() + 60_000);
      setRemaining(60);
      setCode('');
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeId) {
      setError('请先发送验证码');
      return;
    }
    setBusy('login');
    setError('');
    try {
      const result = await window.electron.autoResearch.loginBilibiliSms(
        challengeId,
        code,
      );
      await onComplete({
        uid: String(result.uid),
        accessKey: String(result.accessKey),
      });
      onClose();
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setBusy('');
    }
  };

  let sendButtonLabel = '发送验证码';
  if (remaining > 0) sendButtonLabel = `${remaining}s 后重发`;
  else if (challengeId) sendButtonLabel = '重新发送';

  return (
    <div
      className="successionPickerTheme successionPickerOverlay"
      style={{ zIndex: 1600 }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="autouma-sms-login-title"
        onSubmit={submit}
        className="successionPickerDialog w-full max-w-md"
      >
        <div className="plannerDialogHeaderBlock flex items-start justify-between gap-3">
          <div>
            <h3
              id="autouma-sms-login-title"
              className="text-lg font-bold text-slate-900"
            >
              B 站短信登录
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              验证码只保存在内存中，登录成功后只保存游戏 access_key。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭短信登录"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <label
            className="block text-sm font-medium text-slate-700"
            htmlFor="autouma-sms-phone"
          >
            手机号
            <input
              id="autouma-sms-phone"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
              }
              inputMode="tel"
              autoComplete="tel"
              placeholder="请输入 11 位手机号"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位验证码"
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="button"
              onClick={() => sendCode().catch(() => undefined)}
              disabled={Boolean(busy) || remaining > 0}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy === 'send' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <MessageSquare size={14} />
              )}
              {sendButtonLabel}
            </button>
          </div>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="successionPickerFooter flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={Boolean(busy) || !challengeId || code.length !== 6}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === 'login' ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : null}
            登录并添加
          </button>
        </div>
      </form>
    </div>
  );
}
