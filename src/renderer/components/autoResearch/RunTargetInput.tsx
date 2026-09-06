export default function RunTargetInput({
  prefix,
  value,
  min = 1,
  max,
  suffix,
  hint,
  compact = false,
  className = '',
  onValueChange,
}: {
  prefix: string;
  value: number;
  min?: number;
  max: number;
  suffix: string;
  hint?: string;
  compact?: boolean;
  className?: string;
  onValueChange: (value: number) => void;
}) {
  const content = (
    <>
      <span>{prefix}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={`${prefix}${suffix}`}
        onChange={(event) =>
          onValueChange(
            Math.max(min, Math.min(max, Number(event.currentTarget.value))),
          )
        }
        className={`rounded-md border border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
          compact ? 'w-16 px-2 py-1' : 'w-24 px-3 py-2'
        }`}
      />
      <span>{suffix}</span>
    </>
  );

  if (compact) {
    return (
      <div
        className={`flex max-w-full flex-wrap items-center gap-1.5 rounded-md bg-slate-100/80 px-2.5 py-1.5 text-xs text-slate-600 ${className}`.trim()}
      >
        {content}
        {hint ? <span className="text-slate-400">（{hint}）</span> : null}
      </div>
    );
  }

  return (
    <div
      className={`block rounded-lg bg-slate-100/80 px-3 py-3 text-sm text-slate-600 ${className}`.trim()}
    >
      <span className="flex flex-wrap items-center gap-2">{content}</span>
      {hint ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
