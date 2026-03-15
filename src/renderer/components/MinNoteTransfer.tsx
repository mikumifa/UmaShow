import { ArrowRight } from 'lucide-react';
import type { NoteStat } from 'types/gameTypes';
import { NOTE_STYLES, type NoteType } from './NoteStyles';

interface MinNoteTransferProps {
  fromNotes: NoteType[];
  toNotes: NoteType[];
  warningNotes?: NoteType[];
  className?: string;
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
}: MinNoteTransferProps) {
  if (fromNotes.length === 0 || toNotes.length === 0) return null;

  const warningSet = new Set(warningNotes);
  const fromHasWarning = fromNotes.some((note) => warningSet.has(note));
  const toHasWarning = toNotes.some((note) => warningSet.has(note));
  const isWarning = fromHasWarning && !toHasWarning;

  return (
    <div
      className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-[9px] font-semibold shadow-sm ${
        isWarning
          ? 'border-rose-300 bg-rose-100 text-rose-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      } ${className}`}
    >
      <div className="flex items-center gap-0.5">
        {fromNotes.map(renderNoteChip)}
      </div>
      <ArrowRight
        size={10}
        className={isWarning ? 'text-rose-500' : 'text-amber-500'}
      />
      <div className="flex items-center gap-0.5">
        {toNotes.map(renderNoteChip)}
      </div>
    </div>
  );
}
