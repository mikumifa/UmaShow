/* eslint-disable react-hooks/rules-of-hooks */
import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NoteStat } from 'types/gameTypes';
import { NOTE_STYLES, type NoteType } from './NoteStyles';

interface MinNoteTransferProps {
  fromNotes: NoteType[];
  toNotes: NoteType[];
  warningNotes?: NoteType[];
  className?: string;
  tooltipMode?: 'lesson' | 'training';
}

const NOTE_ORDER: NoteType[] = ['da', 'pa', 'vo', 'vi', 'me'];

const renderNoteChip = (note: NoteType) => {
  const style = NOTE_STYLES[note];
  return (
    <span
      key={note}
      className={`flex h-4 w-4 items-center justify-center rounded-full border bg-white text-[8px] font-black leading-none ring-1 ${style.border} ${style.text} ${style.ring}`}
    >
      {style.label}
    </span>
  );
};

const formatNoteTypes = (notes: NoteType[]) =>
  notes.map((note) => NOTE_STYLES[note].label).join(' / ');

export function getMinNoteTypes(noteStat?: NoteStat | null): NoteType[] {
  if (!noteStat) return [];
  const values = NOTE_ORDER.map((key) => noteStat[key]?.value ?? 0);
  const minValue = Math.min(...values);
  return NOTE_ORDER.filter((key) => (noteStat[key]?.value ?? 0) === minValue);
}

export function getMissingNoteTypes(
  noteStat: NoteStat | null | undefined,
  targetCosts: Partial<Record<NoteType, number>>,
): NoteType[] {
  if (!noteStat) return [];
  return NOTE_ORDER.filter(
    (key) => (targetCosts[key] ?? 0) - (noteStat[key]?.value ?? 0) > 0,
  );
}

export default function MinNoteTransfer({
  fromNotes,
  toNotes,
  warningNotes = [],
  className = '',
  tooltipMode,
}: MinNoteTransferProps) {
  if (fromNotes.length === 0 || toNotes.length === 0) return null;

  const hasChanged =
    fromNotes.length !== toNotes.length ||
    fromNotes.some((note, index) => note !== toNotes[index]);
  if (!hasChanged) return null;

  const warningSet = new Set(warningNotes);
  const maxLength = Math.max(fromNotes.length, toNotes.length);

  const isWarning = Array.from({ length: maxLength }).some((_, index) => {
    const fromNote = fromNotes[index];
    const toNote = toNotes[index];
    return (
      fromNote != null &&
      warningSet.has(fromNote) &&
      toNote != null &&
      !warningSet.has(toNote)
    );
  });

  const isPositive =
    !isWarning &&
    Array.from({ length: maxLength }).some((_, index) => {
      const fromNote = fromNotes[index];
      const toNote = toNotes[index];
      return (
        fromNote != null &&
        !warningSet.has(fromNote) &&
        toNote != null &&
        warningSet.has(toNote)
      );
    });

  let containerTone = 'border-amber-200 bg-amber-50 text-amber-700';
  let arrowTone = 'text-amber-500';
  let toneReason = '当前最少代币的种类发生了变化，但不属于明显变好或变差。';

  if (isWarning) {
    containerTone = 'border-rose-300 bg-rose-100 text-rose-700';
    arrowTone = 'text-rose-500';
    toneReason =
      '当前是提醒，因为变化后最少代币的种类离你当前缺少的代币更远了。';
  } else if (isPositive) {
    containerTone = 'border-emerald-300 bg-emerald-100 text-emerald-700';
    arrowTone = 'text-emerald-500';
    toneReason = '当前是推荐，因为变化后最少代币的种类更接近你当前缺少的代币。';
  }

  const tooltipText =
    // eslint-disable-next-line no-nested-ternary
    tooltipMode === 'lesson'
      ? `购买这个课程/歌曲会改变数量最小的代币种类：${formatNoteTypes(fromNotes)} 到 ${formatNoteTypes(toNotes)}\n${toneReason}`
      : tooltipMode === 'training'
        ? `此训练会改变数量最小的代币种类： ${formatNoteTypes(fromNotes)} 到 ${formatNoteTypes(toNotes)}\n${toneReason}`
        : null;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    if (!isHovered || !tooltipText || !rootRef.current) return undefined;

    const updateTooltipPosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipStyle({
        left: rect.left,
        top: rect.top - 8,
      });
    };

    updateTooltipPosition();
    window.addEventListener('scroll', updateTooltipPosition, true);
    window.addEventListener('resize', updateTooltipPosition);

    return () => {
      window.removeEventListener('scroll', updateTooltipPosition, true);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [isHovered, tooltipText]);

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`inline-flex min-h-7 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold shadow-sm ${containerTone} ${tooltipText ? 'cursor-default' : ''}`}
      >
        <div className="flex items-center gap-0.5">
          {fromNotes.map(renderNoteChip)}
        </div>
        <ArrowRight size={10} className={arrowTone} />
        <div className="flex items-center gap-0.5">
          {toNotes.map(renderNoteChip)}
        </div>
      </div>

      {tooltipText && isHovered && tooltipStyle
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[99999] w-[220px] -translate-y-full whitespace-normal break-words rounded bg-gray-800 px-2 py-1 text-[10px] font-medium leading-4 text-white shadow-2xl"
              style={{
                left: tooltipStyle.left,
                top: tooltipStyle.top,
              }}
            >
              {tooltipText.split('\n').map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
