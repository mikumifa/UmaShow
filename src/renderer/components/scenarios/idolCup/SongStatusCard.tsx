/* eslint-disable no-nested-ternary */
import { type ComponentType } from 'react';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import {
  COMMAND_TARGET_TYPE_MAP,
  TARGET_TYPE,
  type NoteStat,
} from 'types/gameTypes';
import {
  getLessonPurchaseProbabilityAfterCurrent,
  type DoubleLessonYear,
} from 'renderer/utils/liveCourseProbability';
import MinNoteTransfer, {
  getMinNoteTypes,
  getMissingNoteTypes,
} from './MinNoteTransfer';
import { NOTE_STYLES, type NoteType } from './NoteStyles';

export interface SongAttribute {
  icon?: ComponentType<{ size?: number; className?: string }> | string;
  label: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'warning';
  color?: string;
}

export interface SongStatus {
  id: number;
  title: string;
  attributes: SongAttribute[];
  notes: Record<NoteType, number>;
  noteStat?: NoteStat;
  previewNoteStat?: NoteStat;
  trainingCommandsByNote?: Partial<Record<NoteType, number[]>>;
  recommended?: boolean;
  recommendedReason?: string;
  onHoverChange?: (id: number, isHovering: boolean) => void;
  remainingPurchasesToRefresh?: number;
  purchaseProbabilityYear?: DoubleLessonYear;
  hidePurchaseProbability?: boolean;
  reserveProbability?: number | null;
}

const TONE_STYLES: Record<
  NonNullable<SongAttribute['tone']>,
  { text: string; bg: string }
> = {
  positive: { text: 'text-orange-600', bg: 'bg-orange-50' },
  neutral: { text: 'text-slate-600', bg: 'bg-slate-50' },
  warning: { text: 'text-rose-600', bg: 'bg-rose-50' },
};

const formatProbabilityPercent = (probability: number) =>
  `${(probability * 100).toFixed(1)}%`;

export default function SongStatusCard({
  id,
  title,
  attributes,
  notes,
  noteStat,
  previewNoteStat,
  trainingCommandsByNote,
  recommended,
  recommendedReason,
  onHoverChange,
  remainingPurchasesToRefresh,
  purchaseProbabilityYear,
  hidePurchaseProbability,
  reserveProbability,
}: SongStatus) {
  const isPurpleTheme = String(id).startsWith('4');
  const cardBorderClass = isPurpleTheme
    ? 'border-purple-200'
    : 'border-[#8ED949]/60';
  const headerClass = isPurpleTheme
    ? 'bg-gradient-to-r from-purple-400 to-purple-300'
    : 'bg-[#8ED949]';
  const attributeBorderClass = isPurpleTheme
    ? 'border-purple-100'
    : 'border-[#8ED949]/35';
  const trainingLabelMap: Record<number, string> = {
    [TARGET_TYPE.SPEED]: '速',
    [TARGET_TYPE.POWER]: '力',
    [TARGET_TYPE.WIZ]: '智',
    [TARGET_TYPE.GUTS]: '毅',
    [TARGET_TYPE.STAMINA]: '耐',
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

  const transferBaseNoteStat = previewNoteStat ?? noteStat;
  const currentMinNotes = getMinNoteTypes(transferBaseNoteStat);
  const purchasedNoteStat = transferBaseNoteStat
    ? {
        da: { ...transferBaseNoteStat.da },
        pa: { ...transferBaseNoteStat.pa },
        vo: { ...transferBaseNoteStat.vo },
        vi: { ...transferBaseNoteStat.vi },
        me: { ...transferBaseNoteStat.me },
      }
    : null;

  if (purchasedNoteStat) {
    (Object.keys(notes) as NoteType[]).forEach((key) => {
      purchasedNoteStat[key].value -= notes[key] ?? 0;
    });
  }

  const previewMinNotes = getMinNoteTypes(purchasedNoteStat);
  const warningNoteTypes = getMissingNoteTypes(transferBaseNoteStat, notes);
  const purchaseProbability =
    !hidePurchaseProbability &&
    transferBaseNoteStat &&
    purchaseProbabilityYear &&
    remainingPurchasesToRefresh &&
    remainingPurchasesToRefresh > 0
      ? getLessonPurchaseProbabilityAfterCurrent({
          inventory: {
            da: transferBaseNoteStat.da.value,
            pa: transferBaseNoteStat.pa.value,
            vo: transferBaseNoteStat.vo.value,
            vi: transferBaseNoteStat.vi.value,
            me: transferBaseNoteStat.me.value,
          },
          currentLessonCost: notes,
          totalPurchaseCount: remainingPurchasesToRefresh,
          year: purchaseProbabilityYear,
        })
      : null;

  const badgeItems = [
    recommended
      ? {
          key: 'recommended',
          label:
            recommendedReason && recommendedReason.includes('预')
              ? '预订'
              : '推荐',
          icon: true,
          className:
            'border border-emerald-200/80 bg-emerald-400/20 shadow-emerald-900/20',
          tooltip: recommendedReason
            ? `${
                recommendedReason.includes('预') ? '预订' : '推荐'
              }：${recommendedReason}`
            : '推荐',
        }
      : null,
    purchaseProbability != null
      ? {
          key: 'purchase-probability',
          label: formatProbabilityPercent(purchaseProbability),
          icon: false,
          className: 'border border-white/35 bg-white/15',
          tooltip: `当前购买这门课程/歌曲后，连续买满${remainingPurchasesToRefresh}次课程并到达下一个紫色格的概率：${formatProbabilityPercent(
            purchaseProbability,
          )}`,
        }
      : null,
    reserveProbability != null
      ? {
          key: 'reserve-probability',
          label: formatProbabilityPercent(reserveProbability),
          icon: false,
          className:
            'border border-sky-200/80 bg-sky-400/20 shadow-sky-900/20',
          tooltip: `买到下一个紫色歌曲时，仍然够预订歌曲的概率：${formatProbabilityPercent(
            reserveProbability,
          )}`,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: boolean;
    className: string;
    tooltip: string;
  }>;

  return (
    <div
      className={`relative z-0 overflow-visible rounded-lg border bg-white shadow-sm hover:z-30 ${cardBorderClass}`}
      onMouseEnter={() => onHoverChange?.(id, true)}
      onMouseLeave={() => onHoverChange?.(id, false)}
    >
      {badgeItems.length > 0 ? (
        <div className="absolute right-1 top-0 flex flex-wrap items-center justify-end gap-1">
          {badgeItems.map((badge) => (
            <div key={badge.key} className="group relative">
              <div
                className={`inline-flex h-5 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black text-white shadow-sm cursor-default backdrop-blur-sm align-middle ${badge.className}`}
              >
                {badge.icon ? <Sparkles size={10} /> : null}
                <span>{badge.label}</span>
              </div>
              <div className="absolute right-0 top-full mt-1 hidden w-max max-w-[220px] rounded bg-gray-800 px-2 py-1 text-[10px] text-white shadow-lg group-hover:block">
                {badge.tooltip}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <header className={`px-2.5 py-1.5 text-white ${headerClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <h3 className="min-w-0 truncate text-xs font-black tracking-wide">
              {title}
            </h3>
          </div>
        </div>
      </header>

      <div className="flex gap-2.5 p-2">
        <div className="flex-1 space-y-1.5">
          {attributes.slice(0, 2).map((attr, idx) => {
            const tone =
              TONE_STYLES[attr.tone ?? 'positive'] ?? TONE_STYLES.positive;

            return (
              <div
                key={`${attr.label}-${idx}`}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 ${attributeBorderClass} ${tone.bg}`}
              >
                <div className="flex-1 truncate text-[11px] font-semibold text-slate-700">
                  {attr.label}
                </div>
                <div
                  className={`text-xs font-black ${tone.text}`}
                  style={attr.color ? { color: attr.color } : undefined}
                >
                  <span dangerouslySetInnerHTML={{ __html: attr.value }} />
                </div>
              </div>
            );
          })}
          <div className="flex justify-start">
            <MinNoteTransfer
              fromNotes={currentMinNotes}
              toNotes={previewMinNotes}
              warningNotes={warningNoteTypes}
              tooltipMode="lesson"
            />
          </div>
        </div>
      </div>

      <div className="px-2 pb-2">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-2 shadow-inner">
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
                        —
                      </span>
                    )}

                    <span
                      className={`flex-shrink-0 rounded-full border bg-white ${style.border} ${style.text} ${style.ring} flex items-center justify-center font-black ring-2 ${
                        hasPreview
                          ? 'mb-0.5 h-5 w-5 text-[9px]'
                          : 'mb-1 h-6 w-6 text-[10px]'
                      }`}
                    >
                      {style.label}
                    </span>

                    <span
                      className={`tabular-nums font-bold ${style.text} ${
                        hasPreview ? 'text-[12px]' : 'text-[13px]'
                      }`}
                    >
                      {displayNeed}
                    </span>
                  </div>

                  <div
                    className={`mt-auto flex flex-col items-center justify-center border-t border-dashed py-1 transition-all ${
                      isMetPreview
                        ? 'border-emerald-200 bg-emerald-100/50'
                        : `${style.border} ${style.accent}`
                    }`}
                  >
                    <div className="flex flex-col items-center leading-none">
                      <div className="flex w-[40px] items-center justify-center">
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
                          <span className="tabular-nums text-[9px] text-gray-400 line-through">
                            {isMetCurrent
                              ? displayRemainingCurrent
                              : displayMissingCurrent}
                          </span>
                          <span
                            className={`tabular-nums text-[11px] font-black ${
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
                          className={`tabular-nums text-[11px] font-black ${
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
