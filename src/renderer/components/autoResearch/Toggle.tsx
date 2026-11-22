const toggleClass = (enabled: boolean) =>
  `dailyTaskToggle relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:-inset-2 after:content-[''] ${
    enabled ? 'bg-indigo-600' : 'bg-slate-300'
  }`;

export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  onDisabledClick,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  onDisabledClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled && !onDisabledClick}
      aria-disabled={disabled || undefined}
      className={`${toggleClass(checked)} aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
      onClick={() => disabled ? onDisabledClick?.() : onChange(!checked)}
    >
      <span
        className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
