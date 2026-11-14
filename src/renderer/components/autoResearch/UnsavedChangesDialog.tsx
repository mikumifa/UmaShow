import { useEffect, useRef, useState } from 'react';

export default function UnsavedChangesDialog({
  label,
  onCancel,
  onDiscard,
  onSave,
}: {
  label: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>('[data-default-action]')?.focus();
    return () => {
      element?.close();
      previouslyFocused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="unsaved-changes-title"
      aria-describedby="unsaved-changes-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onCancel();
      }}
      className="uma-dialog m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-800 backdrop:bg-slate-900/40"
    >
      <h2 id="unsaved-changes-title" className="text-section font-semibold">
        有未保存的修改
      </h2>
      <p
        id="unsaved-changes-description"
        className="mt-2 text-data leading-relaxed text-slate-600"
      >
        {label}尚未保存。
      </p>
      {failed ? (
        <p role="alert" className="mt-3 text-data text-rose-700">
          未能完成保存，请检查配置后重试。
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onDiscard}
          className="min-h-10 rounded-lg px-3 text-data text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          放弃修改
        </button>
        <button
          type="button"
          data-default-action
          disabled={saving}
          onClick={onCancel}
          className="min-h-10 rounded-lg border border-slate-200 px-3 text-data hover:bg-slate-50 disabled:opacity-50"
        >
          继续编辑
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              setFailed(!(await onSave()));
            } catch {
              setFailed(true);
            } finally {
              setSaving(false);
            }
          }}
          className="min-h-10 rounded-lg bg-indigo-600 px-3 text-data font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存后离开'}
        </button>
      </div>
    </dialog>
  );
}
