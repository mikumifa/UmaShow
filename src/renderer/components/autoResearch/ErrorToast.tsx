import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ErrorToast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="autoResearchToast fixed right-4 top-4 z-[1600] flex w-[min(420px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-red-200 border-l-4 border-l-red-500 bg-white px-4 py-3 text-sm text-slate-700 shadow-2xl"
    >
      <AlertTriangle className="mt-0.5 flex-none text-red-500" size={18} />
      <p className="min-w-0 flex-1 break-words leading-5">
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭错误提示"
        className="flex-none rounded px-1 text-lg leading-5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ×
      </button>
    </div>
  );
}
