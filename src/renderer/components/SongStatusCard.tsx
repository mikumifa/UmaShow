import { type ComponentType } from 'react';

export type NoteType = 'da' | 'pa' | 'vo' | 'vi' | 'me';

export interface SongAttribute {
  icon?: ComponentType<{ size?: number; className?: string }> | string;
  label: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'warning';
  color?: string;
}

export interface SongStatus {
  // eslint-disable-next-line react/no-unused-prop-types
  id: number;
  title: string;
  tag: string;
  coverUrl?: string;
  attributes: SongAttribute[];
  notes: Record<NoteType, number>;
}

const NOTE_STYLES: Record<
  NoteType,
  { label: string; bg: string; text: string; border: string; ring: string }
> = {
  da: {
    label: 'Da',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    ring: 'ring-sky-200',
  },
  pa: {
    label: 'Pa',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    ring: 'ring-rose-200',
  },
  vo: {
    label: 'Vo',
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-200',
    ring: 'ring-fuchsia-200',
  },
  vi: {
    label: 'Vi',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
  },
  me: {
    label: 'Me',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    ring: 'ring-indigo-200',
  },
};

const TONE_STYLES: Record<
  NonNullable<SongAttribute['tone']>,
  { text: string; bg: string }
> = {
  positive: { text: 'text-orange-600', bg: 'bg-orange-50' },
  neutral: { text: 'text-slate-600', bg: 'bg-slate-50' },
  warning: { text: 'text-rose-600', bg: 'bg-rose-50' },
};

export default function SongStatusCard({
  title,
  tag,
  attributes,
  notes,
}: SongStatus) {
  return (
    <div className="bg-white rounded-lg border border-purple-200 shadow-sm overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-gradient-to-r from-purple-400 to-purple-300 text-white">
        <h3 className="font-black text-xs tracking-wide truncate">{title}</h3>
        <span className="shrink-0 bg-white/80 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {tag}
        </span>
      </header>

      <div className="p-2 flex gap-2.5">
        <div className="flex-1 space-y-1.5">
          {attributes.slice(0, 2).map((attr, idx) => {
            const tone =
              TONE_STYLES[attr.tone ?? 'positive'] ?? TONE_STYLES.positive;
            return (
              <div
                key={`${attr.label}-${idx}`}
                className={`flex items-center gap-2 rounded-md border border-purple-100 px-2 py-1 ${tone.bg}`}
              >
                <div className="flex-1 text-[11px] font-semibold text-slate-700 truncate">
                  {attr.label}
                </div>
                <div
                  className={`text-xs font-black ${tone.text}`}
                  style={attr.color ? { color: attr.color } : undefined}
                >
                  {/* eslint-disable-next-line react/no-danger */}
                  <span dangerouslySetInnerHTML={{ __html: attr.value }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-md border border-gray-200 px-2 py-1 flex items-center gap-2 shadow-inner">
          <div className="flex-1 flex flex-wrap items-center justify-start gap-1">
            {(Object.keys(NOTE_STYLES) as NoteType[]).map((key) => {
              const style = NOTE_STYLES[key];
              return (
                <div
                  key={key}
                  className={`min-w-[40px] px-1 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text} flex items-center justify-center gap-1 text-[11px] font-black`}
                >
                  <span
                    className={`w-5 h-5 rounded-full bg-white/90 border ${style.border} ${style.text} flex items-center justify-center text-[10px] font-black ring-1 ${style.ring}`}
                  >
                    {style.label}
                  </span>
                  <span className="tabular-nums">{notes[key]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
