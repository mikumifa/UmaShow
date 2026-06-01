import type { ReactNode } from 'react';

type RacePageLayoutProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export const raceHeaderButtonClass =
  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300';

export default function RacePageLayout({
  title,
  description,
  icon,
  actions,
  children,
}: RacePageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex min-h-[60px] items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              {icon}
              <span className="truncate">{title}</span>
            </div>
            {description && (
              <p className="ml-1 mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>

          {actions && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
