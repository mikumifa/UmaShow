export type NoteType = 'da' | 'pa' | 'vo' | 'vi' | 'me';

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
