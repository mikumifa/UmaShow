/* eslint-disable no-nested-ternary */
import { type ComponentType } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  COMMAND_TARGET_TYPE_MAP,
  TARGET_TYPE,
  type NoteStat,
} from 'types/gameTypes';

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
  attributes: SongAttribute[];
  notes: Record<NoteType, number>;
  noteStat?: NoteStat;
  previewNoteStat?: NoteStat;
  trainingCommandIds?: number[];
  trainingCommandsByNote?: Partial<Record<NoteType, number[]>>;
  recommended?: boolean;
  recommendedReason?: string;
}

export const NOTE_STYLES: Record<
  NoteType,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    ring: string;
    accent: string;
  }
> = {
  da: {
    label: 'Da',
    bg: 'bg-rose-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    ring: 'ring-sky-200',
    accent: 'bg-rose-200/50',
  },
  pa: {
    label: 'Pa',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    ring: 'ring-rose-200',
    accent: 'bg-rose-200/50',
  },
  vo: {
    label: 'Vo',
    bg: 'bg-rose-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-200',
    ring: 'ring-fuchsia-200',
    accent: 'bg-rose-200/50',
  },
  vi: {
    label: 'Vi',
    bg: 'bg-rose-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    ring: 'ring-amber-200',
    accent: 'bg-rose-200/50',
  },
  me: {
    label: 'Me',
    bg: 'bg-rose-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    ring: 'ring-indigo-200',
    accent: 'bg-rose-200/50',
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
  attributes,
  notes,
  noteStat,
  previewNoteStat,
  trainingCommandIds,
  trainingCommandsByNote,
  recommended,
  recommendedReason,
}: SongStatus) {
  const trainingLabelMap: Record<number, string> = {
    [TARGET_TYPE.SPEED]: '\u901f',
    [TARGET_TYPE.POWER]: '\u529b',
    [TARGET_TYPE.WIZ]: '\u667a',
    [TARGET_TYPE.GUTS]: '\u6bc5',
    [TARGET_TYPE.STAMINA]: '\u8010',
  };
  const trainingLabelsByNote = (Object.keys(NOTE_STYLES) as NoteType[]).reduce(
    (acc, key) => {
      const ids = trainingCommandsByNote?.[key] ?? [];
      const labels = ids
        .map(
          (commandId) => trainingLabelMap[COMMAND_TARGET_TYPE_MAP[commandId]],
        )
        .filter(Boolean);
      acc[key] = Array.from(new Set(labels));
      return acc;
    },
    {} as Record<NoteType, string[]>,
  );
  return (
    <div className="relative bg-white rounded-lg border border-purple-200 shadow-sm overflow-visible">
      {recommended ? (
        <div className="absolute right-1 top-0 group">
          <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm cursor-default">
            推荐
          </span>
          {recommendedReason ? (
            <div className="absolute right-0 top-full mt-1 hidden w-max max-w-[220px] rounded bg-gray-800 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
              {recommendedReason}
            </div>
          ) : null}
        </div>
      ) : null}
      <header className="flex items-center gap-2 px-2.5 py-1.5 bg-gradient-to-r from-purple-400 to-purple-300 text-white">
        <div className="min-w-0 flex items-center gap-2">
          <h3 className="min-w-0 font-black text-xs tracking-wide truncate">
            {title}
          </h3>
        </div>
        {null}
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
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-2 shadow-inner">
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(NOTE_STYLES) as NoteType[]).map((key) => {
              const style = NOTE_STYLES[key];
              const currentValue = noteStat?.[key]?.value ?? null;
              const previewValue =
                previewNoteStat?.[key]?.value ?? currentValue;
              const targetValue = notes[key] ?? 0;
              const diffCurrent =
                currentValue == null ? null : targetValue - currentValue;
              const diffPreview =
                previewValue == null ? null : targetValue - previewValue;
              const isMetCurrent = diffCurrent != null && diffCurrent <= 0;
              const isMetPreview = diffPreview != null && diffPreview <= 0;
              const hasPreview =
                previewNoteStat != null &&
                currentValue != null &&
                previewValue != null &&
                previewValue !== currentValue;
              const displayNeed = targetValue;
              const displayRemainingCurrent =
                diffCurrent == null ? '--' : `${Math.max(-diffCurrent, 0)}`;
              const displayMissingCurrent =
                diffCurrent == null ? '--' : `${Math.max(diffCurrent, 0)}`;
              const displayRemainingPreview =
                diffPreview == null ? '--' : `${Math.max(-diffPreview, 0)}`;
              const displayMissingPreview =
                diffPreview == null ? '--' : `${Math.max(diffPreview, 0)}`;
              return (
                <div
                  key={key}
                  className={`relative flex flex-col overflow-hidden rounded-lg border shadow-sm transition-all ${
                    isMetPreview
                      ? 'border-emerald-200 bg-emerald-50'
                      : `${style.border} ${style.bg}`
                  }`}
                >
                  <div
                    className={`flex flex-col items-center px-1 ${
                      hasPreview ? 'pt-1' : 'pt-2'
                    }`}
                  >
                    {trainingLabelsByNote[key]?.length ? (
                      <span className="mb-0.5 text-[9px] font-black text-slate-500">
                        {trainingLabelsByNote[key].join('')}
                      </span>
                    ) : (
                      <span className="mb-0.5 text-[9px] font-black text-slate-400">
                        ❌
                      </span>
                    )}
                    <span
                      className={`flex-shrink-0 rounded-full bg-white border ${style.border} ${style.text} flex items-center justify-center font-black ring-2 ${style.ring} ${
                        hasPreview
                          ? 'w-5 h-5 text-[9px] mb-0.5'
                          : 'w-6 h-6 text-[10px] mb-1'
                      }`}
                    >
                      {style.label}
                    </span>
                    <span
                      className={`font-bold tabular-nums ${style.text} ${
                        hasPreview ? 'text-[12px]' : 'text-[13px]'
                      }`}
                    >
                      {displayNeed}
                    </span>
                  </div>

                  <div
                    className={`mt-auto py-1 flex flex-col items-center justify-center border-t border-dashed transition-all ${
                      isMetPreview
                        ? 'border-emerald-200 bg-emerald-100/50'
                        : `${style.border} ${style.accent}`
                    }`}
                  >
                    <div className="flex flex-col items-center leading-none">
                      <div className="flex items-center justify-center w-[40px]">
                        {hasPreview && isMetCurrent !== isMetPreview ? (
                          <div className="flex items-center gap-0.5">
                            {isMetCurrent ? (
                              <CheckCircle2
                                size={12}
                                className="text-emerald-400"
                              />
                            ) : (
                              <XCircle size={12} className="text-red-400" />
                            )}
                            <span className="text-[10px] text-gray-400">
                              -&gt;
                            </span>
                            {isMetPreview ? (
                              <CheckCircle2
                                size={12}
                                className="text-emerald-600"
                              />
                            ) : (
                              <XCircle size={12} className="text-red-600" />
                            )}
                          </div>
                        ) : isMetPreview ? (
                          <CheckCircle2
                            size={12}
                            className="text-emerald-600"
                          />
                        ) : (
                          <XCircle size={12} className="text-red-600" />
                        )}
                      </div>
                      {hasPreview ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-gray-400 line-through tabular-nums">
                            {isMetCurrent
                              ? displayRemainingCurrent
                              : displayMissingCurrent}
                          </span>
                          <span
                            className={`text-[11px] font-black tabular-nums ${
                              isMetPreview ? 'text-emerald-700' : style.text
                            }`}
                          >
                            {isMetPreview
                              ? displayRemainingPreview
                              : displayMissingPreview}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-[11px] font-black tabular-nums ${
                            isMetPreview ? 'text-emerald-700' : style.text
                          }`}
                        >
                          {isMetPreview
                            ? displayRemainingCurrent
                            : displayMissingCurrent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
