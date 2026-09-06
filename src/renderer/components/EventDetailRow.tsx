import type { GameEvent, StoryDetail } from 'types/gameTypes';

export type EventDetailOption = {
  option: string;
  gains: EventDetailGain[];
  currentSelectIndex?: number;
};

export type EventDetailGain = {
  selectIndex: number;
  detail: string;
};

export type EventDetailData = {
  eventId: number;
  eventName: string;
  options: EventDetailOption[];
};

export function buildEventDetailRows(
  gameEvents: GameEvent[] | undefined,
  eventDetails: Record<number, StoryDetail> | undefined,
): EventDetailData[] {
  return (gameEvents ?? []).flatMap((event) => {
    const localOptions = event.options ?? [];
    const networkOptions = eventDetails?.[event.eventId]?.optionList ?? [];
    const optionCount = Math.max(localOptions.length, networkOptions.length);
    if (optionCount === 0) return [];

    const options = Array.from({ length: optionCount }, (_, index) => {
      const localOption = localOptions[index];
      const networkOption = networkOptions[index];
      const networkGains = (networkOption?.gainList ?? [])
        .map((gain) => gain.trim())
        .filter(Boolean);
      const currentSelectIndex = localOption?.selectIndex;
      const localDetail = localOption?.detail?.trim() ?? '';
      const gains = networkGains.map((detail, gainIndex) => ({
        selectIndex: gainIndex + 1,
        detail,
      }));
      if (gains.length === 0 && localDetail) {
        gains.push({
          selectIndex:
            currentSelectIndex != null && currentSelectIndex > 0
              ? currentSelectIndex
              : 1,
          detail: localDetail,
        });
      }

      return {
        option:
          networkOption?.option?.trim() ||
          localOption?.desp?.trim() ||
          '事件选项',
        gains,
        currentSelectIndex,
      };
    });

    return [
      {
        eventId: event.eventId,
        eventName: event.eventName,
        options,
      },
    ];
  });
}

type EventDetailRowProps = {
  eventName: string;
  options: EventDetailOption[];
};

const formatGain = (gain: string) =>
  gain
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' / ');

export default function EventDetailRow({
  eventName,
  options,
}: EventDetailRowProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-purple-200 bg-white shadow-sm">
      <div className="border-b border-purple-100 bg-purple-50 px-4 py-2.5 text-sm font-black text-purple-800">
        {eventName}
      </div>
      <div className="divide-y divide-slate-100">
        {options.map((option, optionIndex) => (
          <div key={optionIndex} className="bg-white px-4 py-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 text-sm font-bold text-slate-800">
                  {option.option}
                </span>
              </div>
              {option.gains.length > 0 ? (
                <div className="mt-1.5 space-y-1">
                  {option.gains.map((gain) => {
                    const formattedGain = formatGain(gain.detail);
                    const isCurrent =
                      option.currentSelectIndex === gain.selectIndex;
                    return (
                      <div
                        key={gain.selectIndex}
                        title={formattedGain}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 text-xs leading-5 ${
                          isCurrent
                            ? 'bg-purple-50 font-semibold text-purple-800'
                            : 'text-slate-600'
                        }`}
                      >
                        <span className="shrink-0 font-mono text-[10px] font-bold text-purple-600">
                          select_index: {gain.selectIndex}
                        </span>
                        <span>{formattedGain}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="font-mono font-bold text-purple-500">
                    select_index: {option.currentSelectIndex ?? '未提供'}
                  </span>
                  <span>暂无效果数据</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
