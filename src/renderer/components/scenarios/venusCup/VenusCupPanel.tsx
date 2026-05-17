import type { CharInfo } from 'types/gameTypes';
import { getVenusEffectDescription } from 'constant/venusCup';
import { VitalPanel } from 'renderer/components/monitor/SharedSections';
import EventCard from 'renderer/components/EventCard';
import EventDetailRow, {
  type EventDetailOption,
} from 'renderer/components/EventDetailRow';
import { UMDB } from 'renderer/utils/umdb';
import VenusCupTrainingCard, {
  VenusFragmentGrid,
  buildVenusFragmentSlots,
  findVenusSpiritBinding,
} from './TrainingCard';
import VenusSpiritTree from './VenusSpiritTree';

const NON_TRAINING_COMMAND_TYPE_LABELS: Record<number, string> = {
  7: '休息',
  3: '外出',
  4: '比赛',
};
const NON_TRAINING_COMMAND_TYPE_ORDER = [7, 3, 4];
const NON_TRAINING_COMMAND_TYPE_STYLES: Record<
  number,
  {
    border: string;
    bg: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  7: {
    border: 'border-[#97D541]',
    bg: 'bg-[#F5FBEA]',
    badgeBg: 'bg-[#97D541]',
    badgeText: 'text-[#355B10]',
  },
  4: {
    border: 'border-[#FB669A]',
    bg: 'bg-[#FFF0F5]',
    badgeBg: 'bg-[#FB669A]',
    badgeText: 'text-[#8F1F49]',
  },
  3: {
    border: 'border-[#F7B018]',
    bg: 'bg-[#FFF7E7]',
    badgeBg: 'bg-[#F7B018]',
    badgeText: 'text-[#8A5800]',
  },
};

const NON_TRAINING_COMMAND_TYPES = new Set(
  Object.keys(NON_TRAINING_COMMAND_TYPE_LABELS).map(Number),
);
const HIDDEN_COMMAND_IDS = new Set([801]);

export default function VenusCupPanel({ charInfo }: { charInfo: CharInfo }) {
  const trainingCommands = charInfo.commands.filter(
    (cmd) =>
      !NON_TRAINING_COMMAND_TYPES.has(cmd.commandType) &&
      !HIDDEN_COMMAND_IDS.has(cmd.commandId),
  );
  const actionCommands = Array.from(
    charInfo.commands
      .filter(
        (cmd) =>
          NON_TRAINING_COMMAND_TYPES.has(cmd.commandType) &&
          !HIDDEN_COMMAND_IDS.has(cmd.commandId),
      )
      .reduce((map, cmd) => {
        if (!map.has(cmd.commandType)) {
          map.set(cmd.commandType, cmd);
        }
        return map;
      }, new Map<number, (typeof charInfo.commands)[number]>())
      .values(),
  ).sort(
    (left, right) =>
      NON_TRAINING_COMMAND_TYPE_ORDER.indexOf(left.commandType) -
      NON_TRAINING_COMMAND_TYPE_ORDER.indexOf(right.commandType),
  );
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
  const hasSpiritTree = (charInfo.venusData?.spiritInfo?.length ?? 0) > 0;

  return (
    <div className="p-3">
      <VitalPanel charInfo={charInfo} />

      <section className="mt-4">
        <div className="flex flex-wrap items-start justify-start gap-4">
          {trainingCommands.map((cmd) => (
            <VenusCupTrainingCard
              key={cmd.commandId}
              command={cmd}
              venusData={charInfo.venusData}
              partnerStats={charInfo.partnerStats}
              currentStats={charInfo.stats}
            />
          ))}
        </div>
      </section>

      {hasSpiritTree || actionCommands.length > 0 ? (
        <section className="mt-1">
          <div className="flex items-start gap-4">
            {hasSpiritTree ? (
              <VenusSpiritTree
                spiritInfo={charInfo.venusData?.spiritInfo}
                charaInfo={charInfo.venusData?.charaInfo}
              />
            ) : null}
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-4">
              {actionCommands.map((cmd) => {
                const spiritBinding = findVenusSpiritBinding(
                  charInfo.venusData?.charaCommandInfo,
                  cmd,
                );
                const fragmentSlots = buildVenusFragmentSlots(
                  charInfo.venusData?.spiritInfo,
                  spiritBinding,
                );
                const style = NON_TRAINING_COMMAND_TYPE_STYLES[cmd.commandType];

                return (
                  <section
                    key={cmd.commandId}
                    className={`flex h-[214px] w-fit max-w-full shrink-0 flex-col rounded-xl border p-3 shadow-sm ${style.border} ${style.bg}`}
                  >
                    <div className="inline-flex max-w-full items-start gap-3">
                      <div className="min-w-0">
                        <div
                          className={`rounded-full px-3 py-1 text-sm font-black ${style.badgeBg} ${style.badgeText}`}
                        >
                          {NON_TRAINING_COMMAND_TYPE_LABELS[cmd.commandType] ??
                            `动作 ${cmd.commandId}`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-start">
                      <VenusFragmentGrid slots={fragmentSlots} />
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {charInfo.gameEvents.length > 0 || eventDetailRows.length > 0 ? (
        <section className="mt-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-4">
            {charInfo.gameEvents.map((ev) => (
              <div key={ev.eventId} className="w-[248px] shrink-0">
                <EventCard event={ev} />
              </div>
            ))}
            {eventDetailRows.map((row) => (
              <div key={row.eventId} className="min-w-[420px] flex-1">
                <EventDetailRow
                  eventName={row.eventName}
                  options={row.options}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
