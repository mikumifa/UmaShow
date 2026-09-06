import { ReactNode } from 'react';

export default function AutoResearchNotice({
  title,
  children,
  actions,
  compact = false,
  className = '',
}: {
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <aside
      className={`rounded-lg bg-slate-100/80 text-slate-600 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm leading-6'
      } ${className}`.trim()}
    >
      {title ? (
        <strong className="block font-semibold text-slate-700">{title}</strong>
      ) : null}
      <div className={title ? 'mt-1' : ''}>{children}</div>
      {actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </aside>
  );
}
