import { HelpCircle } from 'lucide-react';
import { GameEvent } from '../types/gameTypes';

export const EVENT_OPTION_STYLE = {
  correct: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    indicator: 'bg-green-500',
    hoverBg: 'group-hover:bg-green-100',
  },
  wrong: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    indicator: 'bg-red-500',
    hoverBg: 'group-hover:bg-red-100',
  },
  neutral: {
    bg: 'bg-gray-50',
    text: 'text-gray-800',
    border: 'border-gray-200',
    indicator: 'bg-gray-500',
    hoverBg: 'group-hover:bg-gray-100',
  },
  unknown: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-200',
    indicator: 'bg-gray-400',
    hoverBg: 'group-hover:bg-gray-200',
  },
} as const;

export default function EventCard({ event }: { event: GameEvent }) {
  return (
    <div className="relative flex flex-col items-stretch text-left border-4 border-white bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      {/* Header */}
      <div className="bg-purple-100 py-1.5 px-3 flex items-center justify-center gap-2 border-b border-purple-200">
        <HelpCircle className="text-purple-600" size={14} />
        <span className="font-bold text-purple-800 text-xs">
          {event.eventName}
        </span>
      </div>

      {/* Body */}
      <div className="p-2 flex flex-col gap-1 bg-gray-50 flex-1">
        {event.options.map((opt, idx) => {
          const styles =
            EVENT_OPTION_STYLE[opt.type] ?? EVENT_OPTION_STYLE.unknown;
          return (
            <div
              key={idx}
              className="relative group cursor-help transition-all duration-200"
            >
              {/* Option pill */}
              <div
                className={`
                flex items-center gap-2 py-1.5 px-2 rounded border shadow-sm
                ${styles.bg} ${styles.border} ${styles.text} ${styles.hoverBg}
              `}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${styles.indicator}`}
                />
                <span className="text-xs font-bold truncate">{opt.desp}</span>
              </div>
              {/* Tooltip */}
              {opt.detail && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-full min-w-[180px] hidden group-hover:block z-50 pointer-events-none">
                  <div className="bg-gray-800 text-white text-[10px] p-2 rounded shadow-xl opacity-95 text-center">
                    {opt.detail}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
