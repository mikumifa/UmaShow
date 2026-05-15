import { useMemo, useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';

interface SequenceItem {
  type: 'green' | 'purple';
  segmentIdx: number;
  isLoopPart: boolean;
}

interface SequenceData {
  fullList: SequenceItem[];
  loopStartIndex: number;
  loopLength: number;
  loopItems: SequenceItem[];
}

interface LiveRefreshTrackerProps {
  pattern: string;
  progress: number;
  onJump?: (index: number) => void;
}

export const parseSequence = (patternInput: string): SequenceData => {
  const segments = patternInput
    .split('')
    .filter((char) => !Number.isNaN(Number.parseInt(char, 10)));
  if (segments.length === 0) {
    return { fullList: [], loopStartIndex: 0, loopLength: 0 };
  }

  const fullList: SequenceItem[] = [];
  let loopStartIndex = 0;
  let loopItems: SequenceItem[] = [];

  segments.forEach((char, idx) => {
    const count = Number.parseInt(char, 10);
    const isLast = idx === segments.length - 1;

    if (isLast) {
      loopStartIndex = fullList.length;
    }

    const currentSegment: SequenceItem[] = [];
    for (let i = 0; i < count; i += 1) {
      const item: SequenceItem = {
        type: 'green',
        segmentIdx: idx,
        isLoopPart: isLast,
      };
      fullList.push(item);
      if (isLast) {
        currentSegment.push(item);
      }
    }

    const purpleItem: SequenceItem = {
      type: 'purple',
      segmentIdx: idx,
      isLoopPart: isLast,
    };
    fullList.push(purpleItem);
    if (isLast) {
      currentSegment.push(purpleItem);
      loopItems = currentSegment;
    }
  });

  return {
    fullList,
    loopStartIndex,
    loopLength: fullList.length - loopStartIndex,
    loopItems,
  };
};

export const normalizeSequenceProgress = (
  progress: number,
  sequenceData: SequenceData,
) => {
  const { fullList, loopStartIndex, loopLength } = sequenceData;
  if (fullList.length === 0) return 0;
  if (progress < fullList.length) return progress;
  if (loopLength <= 0) return fullList.length - 1;
  return loopStartIndex + ((progress - loopStartIndex) % loopLength);
};

const getTileColorClass = (
  item: SequenceItem,
  isPassed: boolean,
  isActive: boolean,
) => {
  if (item.type === 'green') {
    if (isPassed) return 'bg-emerald-500';
    if (isActive) return 'bg-emerald-400';
    return 'bg-emerald-200';
  }
  if (isPassed) return 'bg-purple-600';
  if (isActive) return 'bg-purple-500';
  return 'bg-purple-200';
};

export default function LiveRefreshTracker({
  pattern,
  progress,
  onJump,
}: LiveRefreshTrackerProps) {
  const sequenceData = useMemo(() => parseSequence(pattern), [pattern]);
  const [pendingJumpIndex, setPendingJumpIndex] = useState<number | null>(null);

  const normalizedProgress = useMemo(() => {
    return normalizeSequenceProgress(progress, sequenceData);
  }, [progress, sequenceData]);

  return (
    <section className="inline-block w-fit max-w-full rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
      <div className="overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex w-fit items-start gap-0.5">
          {sequenceData.fullList.map((item, idx) => {
            const isActive = idx === normalizedProgress;
            const isPassed = idx < normalizedProgress;
            const tileColorClass = getTileColorClass(item, isPassed, isActive);

            return (
              <button
                key={`${item.segmentIdx}-${idx}`}
                type="button"
                onClick={() => setPendingJumpIndex(idx)}
                className={`relative flex h-7 w-5 shrink-0 items-center justify-center transition-all duration-300 ${
                  item.isLoopPart ? 'bg-indigo-50/40' : ''
                }`}
              >
                <div className="absolute inset-[1px] -z-10 rounded-[6px] bg-slate-100" />

                {item.isLoopPart ? (
                  <div
                    className={`pointer-events-none absolute inset-0 z-0 border-y border-dashed ${
                      isPassed ? 'border-indigo-400' : 'border-slate-300'
                    }`}
                  >
                    {idx === sequenceData.loopStartIndex ? (
                      <div className="absolute inset-y-0 left-0 border-l border-dashed border-indigo-400" />
                    ) : null}
                    {idx === sequenceData.fullList.length - 1 ? (
                      <div className="absolute inset-y-0 right-0 border-l border-dashed border-indigo-400" />
                    ) : null}
                  </div>
                ) : null}

                <div
                  className={`z-10 flex h-5 w-3.5 items-center justify-center rounded-[5px] shadow-sm transition-all duration-500 ${tileColorClass} ${
                    isActive
                      ? 'z-20 scale-105 ring-2 ring-indigo-500 shadow-md'
                      : ''
                  }`}
                >
                  {isPassed ? (
                    <Check className="h-3 w-3 text-white/60" strokeWidth={4} />
                  ) : null}
                </div>

                {isActive ? (
                  <div className="absolute -bottom-0.5 z-30 flex flex-col items-center">
                    <div className="h-0 w-0 border-b-[4px] border-l-[3px] border-r-[3px] border-b-indigo-700 border-l-transparent border-r-transparent" />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {pendingJumpIndex != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-base font-bold text-slate-900">
                跳转进度？
              </div>
              <div className="mt-1 text-sm text-slate-500">
                确认跳到第{' '}
                <span className="font-bold text-indigo-600">
                  {pendingJumpIndex}
                </span>{' '}
                格
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPendingJumpIndex(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onJump?.(pendingJumpIndex);
                  setPendingJumpIndex(null);
                }}
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
