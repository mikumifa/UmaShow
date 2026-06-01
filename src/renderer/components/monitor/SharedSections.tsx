import { Battery } from 'lucide-react';
import TrainingCard from 'renderer/components/TrainingCard';
import EventCard from 'renderer/components/EventCard';
import EventDetailRow, {
  type EventDetailOption,
} from 'renderer/components/EventDetailRow';
import type { CharInfo } from 'types/gameTypes';
import type { NoteType } from 'renderer/components/scenarios/idolCup/NoteStyles';

export function VitalPanel({ charInfo }: { charInfo: CharInfo }) {
  const vitalPercent =
    charInfo.stats.vital.max > 0
      ? (charInfo.stats.vital.value / charInfo.stats.vital.max) * 100
      : 0;
  let vitalBarClass = 'bg-gradient-to-r from-red-500 to-red-400';
  if (vitalPercent > 50) {
    vitalBarClass = 'bg-gradient-to-r from-green-500 to-green-400';
  } else if (vitalPercent > 30) {
    vitalBarClass = 'bg-gradient-to-r from-yellow-500 to-yellow-400';
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <section className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-green-600 font-bold shrink-0">
            <Battery size={22} />
            <span>体力</span>
          </div>

          <div className="flex-1 relative h-5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
            <div
              className={`absolute top-0 left-0 h-full transition-all duration-300 ${vitalBarClass}`}
              style={{
                width: `${vitalPercent}%`,
              }}
            />
          </div>

          <div className="text-base font-black text-gray-700 shrink-0 min-w-[70px] text-right">
            {charInfo.stats.vital.value}
            <span className="text-[10px] text-gray-400 font-normal">
              /{charInfo.stats.vital.max}
            </span>
          </div>
        </div>

        {charInfo.charaEffects && charInfo.charaEffects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pl-8">
            {charInfo.charaEffects.map((effect) => (
              <span
                key={effect.id}
                title={`effect_id: ${effect.id}`}
                className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
              >
                {effect.text}
              </span>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function TrainingEventsSection({
  charInfo,
  currentNoteStat,
  warningNoteTypes,
  liveSpecialtyRateBonus,
  onTrainingHoverChange,
}: {
  charInfo: CharInfo;
  currentNoteStat?: CharInfo['noteStat'];
  warningNoteTypes?: NoteType[];
  liveSpecialtyRateBonus?: number;
  onTrainingHoverChange?: (commandId: number | null) => void;
}) {
  const eventDetailRows = (charInfo.gameEvents ?? [])
    .map((event) => {
      const detail = charInfo.eventDetails?.[event.eventId];
      if (!detail) {
        return null;
      }
      const options: EventDetailOption[] = detail.optionList.map((opt) => ({
        option: opt.option,
        gainList: opt.gainList,
      }));
      return {
        eventId: event.eventId,
        eventName: event.eventName,
        options: options.filter((opt) => opt.gainList.length > 0),
      };
    })
    .filter(
      (
        row,
      ): row is {
        eventId: number;
        eventName: string;
        options: EventDetailOption[];
      } => !!row && row.options.length > 0,
    );

  return (
    <>
      <section className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {charInfo.commands
            .filter((cmd) => {
              return (
                cmd.trainingPartners?.length > 0 ||
                cmd.tipsPartners?.length > 0 ||
                cmd.params?.length > 0
              );
            })
            .map((cmd) => (
              <TrainingCard
                key={cmd.commandId}
                command={cmd}
                partnerStats={charInfo.partnerStats}
                liveCommands={charInfo.liveCommands}
                currentStats={charInfo.stats}
                currentNoteStat={currentNoteStat}
                warningNoteTypes={warningNoteTypes}
                liveSpecialtyRateBonus={liveSpecialtyRateBonus}
                onHoverChange={(command, isHovering) =>
                  onTrainingHoverChange?.(isHovering ? command.commandId : null)
                }
              />
            ))}
          {charInfo.gameEvents.map((ev) => (
            <EventCard key={ev.eventId} event={ev} />
          ))}
        </div>
      </section>

      {eventDetailRows.length > 0 && (
        <section className="mt-2 space-y-3">
          {eventDetailRows.map((row) => (
            <EventDetailRow
              key={row.eventId}
              eventName={row.eventName}
              options={row.options}
            />
          ))}
        </section>
      )}
    </>
  );
}
