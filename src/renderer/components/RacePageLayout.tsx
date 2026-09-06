import type { ReactNode } from 'react';
import AppMenuPortal from 'renderer/components/AppMenuPortal';

type RacePageLayoutProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export const raceHeaderButtonClass =
  'flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300';

export default function RacePageLayout({
  title,
  actions,
  children,
}: RacePageLayoutProps) {
  return (
    <div
      className="flex h-full min-h-full flex-col bg-gray-50 p-4 xl:px-6"
      aria-label={title}
    >
      {actions ? (
        <AppMenuPortal>
          <div className="flex min-w-0 items-center gap-1.5">{actions}</div>
        </AppMenuPortal>
      ) : null}
      <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
