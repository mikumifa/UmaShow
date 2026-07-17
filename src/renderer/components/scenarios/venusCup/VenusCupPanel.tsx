import { useEffect, useMemo, useState } from 'react';
import { Brain, Upload, X } from 'lucide-react';
import type { CharInfo } from 'types/gameTypes';
import { VitalPanel } from 'renderer/components/monitor/SharedSections';
import EventCard from 'renderer/components/EventCard';
import EventDetailRow, {
  type EventDetailOption,
} from 'renderer/components/EventDetailRow';
import {
  actionIdForCommand,
  clearVenusOnnxModel,
  getVenusOnnxModelInfo,
  isVenusPassionActive,
  openVenusOnnxModel,
  predictVenusActions,
  recommendVenusFragmentChoices,
  type VenusModelAdvice,
  type VenusModelPrediction,
  type VenusOnnxModelInfo,
} from 'renderer/utils/venusModel';
import VenusCupTrainingCard, {
  VenusFragmentGrid,
  buildVenusFragmentSlots,
  findVenusSpiritBinding,
} from './TrainingCard';
import VenusFragmentChoicePrompt from './VenusFragmentChoicePrompt';
import VenusSpiritTree from './VenusSpiritTree';

const VENUS_FRAGMENT_CHOICE_STORY_ID = 830137003;
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
const HIDDEN_TRAINING_COMMAND_IDS = new Set([301, 302, 304, 801]);
const OUTING_COMMAND_IDS = new Set([301, 302, 304, 801]);
const WISDOM_ACTION_IDS = new Set([3909040, 3909041, 3909042]);
const isOutingCommand = (commandId: number, commandType: number) =>
  OUTING_COMMAND_IDS.has(commandId) && commandType !== 4;
const commandTypeLabel = (commandId: number, commandType: number) => {
  if (isOutingCommand(commandId, commandType)) {
    return '外出';
  }
  return NON_TRAINING_COMMAND_TYPE_LABELS[commandType] ?? `动作 ${commandId}`;
};
const nonTrainingCommandKey = (command: CharInfo['commands'][number]) =>
  isOutingCommand(command.commandId, command.commandType)
    ? 3
    : command.commandType;
const modelAdviceForAction = (
  prediction: VenusModelPrediction | null,
  actionId: number | null,
): VenusModelAdvice | undefined => {
  if (actionId == null) {
    return undefined;
  }
  return (
    prediction?.recommendations.find((item) => item.actionId === actionId) ??
    prediction?.adviceByActionId.get(actionId)
  );
};

export default function VenusCupPanel({ charInfo }: { charInfo: CharInfo }) {
  const [modelInfo, setModelInfo] = useState<VenusOnnxModelInfo>({
    loaded: false,
  });
  const [prediction, setPrediction] = useState<VenusModelPrediction | null>(
    null,
  );
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoading, setModelLoading] = useState(false);
  const trainingCommands = charInfo.commands.filter(
    (cmd) =>
      !NON_TRAINING_COMMAND_TYPES.has(cmd.commandType) &&
      !HIDDEN_TRAINING_COMMAND_IDS.has(cmd.commandId),
  );
  const actionCommands = Array.from(
    charInfo.commands
      .filter(
        (cmd) =>
          NON_TRAINING_COMMAND_TYPES.has(cmd.commandType) ||
          isOutingCommand(cmd.commandId, cmd.commandType),
      )
      .reduce((map, cmd) => {
        const key = nonTrainingCommandKey(cmd);
        if (!map.has(key)) {
          map.set(key, cmd);
        }
        return map;
      }, new Map<number, (typeof charInfo.commands)[number]>())
      .values(),
  ).sort(
    (left, right) =>
      NON_TRAINING_COMMAND_TYPE_ORDER.indexOf(nonTrainingCommandKey(left)) -
      NON_TRAINING_COMMAND_TYPE_ORDER.indexOf(nonTrainingCommandKey(right)),
  );
  const venusFragmentChoiceEvent = (charInfo.gameEvents ?? []).find(
    (event) => event.eventId === VENUS_FRAGMENT_CHOICE_STORY_ID,
  );
  const visibleGameEvents = (charInfo.gameEvents ?? []).filter(
    (event) => event.eventId !== VENUS_FRAGMENT_CHOICE_STORY_ID,
  );
  const eventDetailRows = visibleGameEvents
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
  const hasSpiritTree = !!charInfo.venusData;
  const modelActionIds = modelInfo.actionIds ?? [];
  const venusPassionActive = isVenusPassionActive(charInfo);
  const topRecommendations = useMemo(
    () => prediction?.recommendations.slice(0, 3) ?? [],
    [prediction],
  );
  const wisdomRecommendation = useMemo(
    () => prediction?.wisdomRecommendations[0],
    [prediction],
  );
  const afterWisdomRecommendation = useMemo(
    () => prediction?.recommendations[0],
    [prediction],
  );
  const fragmentChoiceRecommendations = useMemo(
    () => recommendVenusFragmentChoices(charInfo, prediction),
    [charInfo, prediction],
  );

  useEffect(() => {
    getVenusOnnxModelInfo()
      .then(setModelInfo)
      .catch((err) => setModelError(String(err?.message ?? err)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!modelInfo.loaded) {
      setPrediction(null);
      return () => {
        cancelled = true;
      };
    }
    predictVenusActions(modelInfo, charInfo)
      .then((result) => {
        if (!cancelled) {
          setPrediction(result);
          setModelError(null);
        }
        return null;
      })
      .catch((err) => {
        if (!cancelled) {
          setPrediction(null);
          setModelError(String(err?.message ?? err));
        }
        return null;
      });
    return () => {
      cancelled = true;
    };
  }, [charInfo, modelInfo]);

  const handleOpenModel = async () => {
    setModelLoading(true);
    try {
      const nextInfo = await openVenusOnnxModel();
      setModelInfo(nextInfo);
      setModelError(null);
    } catch (err: any) {
      setModelError(String(err?.message ?? err));
    } finally {
      setModelLoading(false);
    }
  };

  const handleClearModel = async () => {
    const nextInfo = await clearVenusOnnxModel();
    setModelInfo(nextInfo);
    setPrediction(null);
  };

  return (
    <div className="p-3">
      <VitalPanel charInfo={charInfo} showEffects={false} />

      <section className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-black text-indigo-800">
          <Brain size={16} />
          <span>AI提示</span>
        </div>
        <button
          type="button"
          onClick={handleOpenModel}
          disabled={modelLoading}
          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50 disabled:opacity-60"
        >
          <Upload size={14} />
          {modelInfo.loaded ? '更换模型' : '上传模型'}
        </button>
        {modelInfo.loaded ? (
          <button
            type="button"
            onClick={handleClearModel}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <X size={14} />
            卸载
          </button>
        ) : null}
        {modelInfo.loaded ? (
          <div className="text-xs font-semibold text-indigo-700">
            模型已加载
          </div>
        ) : (
          <div className="text-xs font-semibold text-indigo-500">
            选择 UmaRL 导出的 venus_manifest.json
          </div>
        )}
        {topRecommendations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {topRecommendations.map((item) => (
              <span
                key={item.actionId}
                className="rounded-full bg-white px-2 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-100"
              >
                #{item.rank}{' '}
                {WISDOM_ACTION_IDS.has(item.actionId)
                  ? `先开${item.label}`
                  : item.label}{' '}
                {Math.round(item.normalizedProbability * 100)}%
              </span>
            ))}
          </div>
        ) : null}
        {wisdomRecommendation && afterWisdomRecommendation ? (
          <div className="basis-full text-xs font-black text-indigo-800">
            建议：先启动{wisdomRecommendation.label}，再执行
            {afterWisdomRecommendation.label}
          </div>
        ) : null}
        {modelError ? (
          <div className="basis-full text-xs font-semibold text-red-600">
            {modelError}
          </div>
        ) : null}
      </section>

      <section className="mt-4">
        <div className="flex flex-wrap items-start justify-start gap-4">
          {trainingCommands.map((cmd) => {
            const actionId = actionIdForCommand(cmd, modelActionIds);
            return (
              <VenusCupTrainingCard
                key={cmd.commandId}
                command={cmd}
                venusData={charInfo.venusData}
                partnerStats={charInfo.partnerStats}
                currentStats={charInfo.stats}
                venusPassionActive={venusPassionActive}
                modelAdvice={modelAdviceForAction(prediction, actionId)}
              />
            );
          })}
        </div>
      </section>

      {venusFragmentChoiceEvent ? (
        <section className="mt-3">
          <VenusFragmentChoicePrompt
            event={venusFragmentChoiceEvent}
            venusData={charInfo.venusData}
            recommendations={fragmentChoiceRecommendations}
          />
        </section>
      ) : null}

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
                const actionId = actionIdForCommand(cmd, modelActionIds);
                const advice = modelAdviceForAction(prediction, actionId);

                return (
                  <section
                    key={cmd.commandId}
                    className={`relative flex h-[214px] w-fit max-w-full shrink-0 flex-col rounded-xl border p-3 shadow-sm ${style.border} ${style.bg}`}
                  >
                    {advice ? (
                      <div className="absolute -right-2 -top-2 z-10 flex min-w-[58px] flex-col items-center rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[10px] font-black leading-tight text-indigo-700 shadow">
                        <span>#{advice.rank}</span>
                        <span>
                          {Math.round(advice.normalizedProbability * 100)}%
                        </span>
                      </div>
                    ) : null}
                    <div className="inline-flex max-w-full items-start gap-3">
                      <div className="min-w-0">
                        <div
                          className={`rounded-full px-3 py-1 text-sm font-black ${style.badgeBg} ${style.badgeText}`}
                        >
                          {commandTypeLabel(cmd.commandId, cmd.commandType)}
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

      {visibleGameEvents.length > 0 || eventDetailRows.length > 0 ? (
        <section className="mt-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-4">
            {visibleGameEvents.map((ev) => (
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
