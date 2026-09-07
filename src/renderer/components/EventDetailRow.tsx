import type { GameEvent, StoryDetail } from 'types/gameTypes';

export type EventDetailOption = {
  option: string;
  gainList: string[];
  resultIndex?: number;
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
      const localDetail = localOption?.detail?.trim() ?? '';
      const gainList =
        networkGains.length > 0
          ? networkGains
          : localDetail
            ? [localDetail]
            : [];

      return {
        option:
          networkOption?.option?.trim() ||
          localOption?.desp?.trim() ||
          '事件选项',
        gainList,
        resultIndex: localOption?.selectIndex,
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
                {option.resultIndex != null ? (
                  <span className="inline-flex shrink-0 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    结果编号：{option.resultIndex}
                  </span>
                ) : null}
              </div>
              {option.gainList.length > 0 ? (
                <div className="mt-1.5 space-y-1">
                  {option.gainList.map((gain, gainIndex) => {
                    const formattedGain = formatGain(gain);
                    return (
                      <div
                        key={gainIndex}
                        title={formattedGain}
                        className="text-xs leading-5 text-slate-600"
                      >
                        {formattedGain}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-slate-400">
                  暂无效果数据
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
