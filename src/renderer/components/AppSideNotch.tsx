import { ReactNode } from 'react';

type AppSideNotchProps = {
  side: 'left' | 'right';
  children: ReactNode;
};

export default function AppSideNotch({ side, children }: AppSideNotchProps) {
  return (
    <div
      className={`pointer-events-auto mt-1.5 flex h-10 items-center rounded-xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-xl ${
        side === 'left' ? 'ml-3' : 'mr-3'
      }`}
    >
      {children}
    </div>
  );
}
