export type EventDetailOption = {
  option: string;
  gainList: string[];
};

type EventDetailRowProps = {
  eventName: string;
  options: EventDetailOption[];
};

export default function EventDetailRow({
  eventName,
  options,
}: EventDetailRowProps) {
  const formatGain = (gain: string) =>
    gain
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .join(' / ');
  const maxGainLength = 80;
  const trimGain = (gain: string) =>
    gain.length > maxGainLength ? `${gain.slice(0, maxGainLength)}...` : gain;

  return (
    <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
      <div className="text-sm font-semibold text-gray-800">{eventName}</div>
      <div className="mt-2 flex flex-wrap gap-3">
        {options.map((opt, idx) => (
          <div
            key={`${opt.option}-${idx}`}
            className="inline-flex flex-col rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <div className="text-xs font-bold text-gray-700">{opt.option}</div>
            <div className="mt-1">
              {opt.gainList.map((gain, gainIdx) => (
                <div key={`${opt.option}-${gainIdx}`}>
                  {gainIdx > 0 ? (
                    <div className="my-1.5 border-t-2 border-dashed border-gray-300" />
                  ) : null}
                  <div
                    className="text-xs text-gray-600 break-words"
                    title={formatGain(gain)}
                  >
                    ◇ {trimGain(formatGain(gain))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
