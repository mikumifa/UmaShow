/* eslint-disable no-nested-ternary */
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { type ComponentType } from 'react';
import {
  TrainingCommand,
  COMMAND_NAME_MAP,
  PartnerStats,
  COMMAND_TARGET_TYPE_MAP,
  LiveCommands,
  type ArcData,
  type CharStats,
} from '../../types/gameTypes';
import { UMDB } from '../utils/umdb';
import {
  formatArcSelectionEffect,
  getArcSelectionEffectIconPath,
} from '../../constant/arc';
import { getSupportCardSpecialtySummary } from '../../utils/supportCardSpecialty';
import FailureRateBadge from './FailureRateBadge';
import createImageIcon from './Icon';
import { NOTE_STYLES, type NoteType } from './scenarios/idolCup/NoteStyles';
import MinNoteTransfer, {
  getMinNoteTypes,
} from './scenarios/idolCup/MinNoteTransfer';

export interface TargetConfig {
  label: string;
  icon: ComponentType<any>;
  color: string;
  bg: string;
}
export enum TARGET_TYPE {
  SPEED = 1,
  STAMINA = 2,
  POWER = 3,
  GUTS = 4,
  WIZ = 5,
  VITAL = 10,
  SKILL_PTS = 30,
  UNKNOWN = 0,
}

const getStatConfig = (typeId: number) => {
  switch (typeId) {
    case TARGET_TYPE.SPEED:
      return {
        label: '速度',
        icon: createImageIcon('./icons/status/speed.png'),
        color: 'blue',
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        border: 'border-blue-300',
      };
    case TARGET_TYPE.STAMINA:
      return {
        label: '耐力',
        icon: createImageIcon('./icons/status/stamina.png'),
        color: 'rose',
        bg: 'bg-rose-400',
        text: 'text-rose-600',
        border: 'border-rose-300',
      };
    case TARGET_TYPE.POWER:
      return {
        label: '力量',
        icon: createImageIcon('./icons/status/power.png'),
        color: 'orange',
        bg: 'bg-orange-500',
        text: 'text-orange-600',
        border: 'border-orange-300',
      };
    case TARGET_TYPE.GUTS:
      return {
        label: '毅力',
        icon: createImageIcon('./icons/status/guts.png'),
        color: 'pink',
        bg: 'bg-pink-500',
        text: 'text-pink-600',
        border: 'border-pink-300',
      };
    case TARGET_TYPE.WIZ:
      return {
        label: '智力',
        icon: createImageIcon('./icons/status/wiz.png'),
        color: 'emerald',
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        border: 'border-emerald-300',
      };
    case TARGET_TYPE.SKILL_PTS:
      return {
        label: 'PT',
        icon: createImageIcon('./icons/status/vital.png'),
        color: 'amber',
        bg: 'bg-amber-400',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case TARGET_TYPE.VITAL:
      return {
        label: '体力',
        icon: TrendingUp,
        color: 'green',
        bg: 'bg-green-500',
        text: 'text-green-600',
        border: 'border-green-300',
      };
    default:
      return {
        label: '未知',
        icon: AlertTriangle,
        color: 'gray',
        bg: 'bg-gray-500',
        text: 'text-gray-600',
        border: 'border-gray-300',
      };
  }
};

const PERFORMANCE_TYPE_MAP: Record<number, NoteType> = {
  1: 'da',
  2: 'pa',
  3: 'vo',
  4: 'vi',
  5: 'me',
};

const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const ARC_STAR_GAUGE_MAX = 3;

const clampArcStarGauge = (value: number) =>
  Math.min(ARC_STAR_GAUGE_MAX, Math.max(0, value));

function ArcStarGauge({
  current,
  preview,
  blocked,
}: {
  current: number;
  preview: number;
  blocked: boolean;
}) {
  const safeCurrent = clampArcStarGauge(current);
  const safePreview = clampArcStarGauge(preview);
  const gain = safePreview - safeCurrent;
  const title = blocked
    ? `群星槽 ${safeCurrent}/${ARC_STAR_GAUGE_MAX}（本次训练无法提升）`
    : `群星槽 ${safeCurrent} → ${safePreview}（本次训练 +${gain}）`;

  return (
    <div
      className="flex h-10 w-3 shrink-0 flex-col-reverse gap-1"
      title={title}
    >
      {Array.from({ length: ARC_STAR_GAUGE_MAX }, (_, index) => {
        let fill = 'border-slate-300 bg-transparent';
        if (index < safeCurrent) {
          fill = 'border-violet-600 bg-violet-600';
        } else if (index < safePreview) {
          fill = blocked
            ? 'border-slate-300 bg-transparent'
            : 'border-cyan-400 bg-cyan-300';
        }
        return (
          <span
            key={index}
            className={`w-full flex-1 rounded-[2px] border ${fill}`}
          />
        );
      })}
    </div>
  );
}

const getFiveStatStrength = (
  params: Array<{ targetType: number; value: number }>,
) =>
  params
    .filter(
      (param) =>
        param.targetType >= TARGET_TYPE.SPEED &&
        param.targetType <= TARGET_TYPE.WIZ &&
        param.value > 0,
    )
    .reduce((sum, param) => sum + param.value, 0);

const getStatKeyNameByTarget = (targetType: number) => {
  switch (targetType) {
    case TARGET_TYPE.SPEED:
      return 'speed';
    case TARGET_TYPE.STAMINA:
      return 'stamina';
    case TARGET_TYPE.POWER:
      return 'power';
    case TARGET_TYPE.GUTS:
      return 'guts';
    case TARGET_TYPE.WIZ:
      return 'wiz';
    case TARGET_TYPE.SKILL_PTS:
      return 'skillPoint';
    default:
      return null;
  }
};

export function StatTile({ value }: { value: number }) {
  return (
    <div className="flex flex-col w-auto min-w-[64px]">
      <div className="rounded-lg px-2 py-1 h-12 flex items-center justify-end">
        <span className="text-xl font-bold text-gray-700 leading-none">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function TrainingCard({
  command,
  partnerStats,
  liveCommands,
  onHoverChange,
  currentStats,
  currentNoteStat,
  warningNoteTypes,
  liveSpecialtyRateBonus,
  arcData,
}: {
  command: TrainingCommand;
  partnerStats: PartnerStats;
  liveCommands?: LiveCommands;
  onHoverChange?: (command: TrainingCommand, isHovering: boolean) => void;
  currentStats?: CharStats;
  currentNoteStat?: Record<NoteType, { value: number }>;
  warningNoteTypes?: NoteType[];
  liveSpecialtyRateBonus?: number;
  arcData?: ArcData;
}) {
  const isDisabled = command.isEnable === 0;
  const name = COMMAND_NAME_MAP[command.commandId] || `禁用`;
  const arcCommand = arcData?.commandInfo.find(
    (item) => item.commandId === command.commandId,
  );
  const arcParamsByTarget = new Map(
    (arcCommand?.params ?? []).map((param) => [param.targetType, param.value]),
  );

  const gains = command.params.filter(
    (p) => p.value > 0 && p.targetType !== 10,
  );
  const costs = command.params.filter((p) => p.value < 0);
  const recovery = command.params.filter(
    (p) => p.targetType === 10 && p.value > 0,
  );
  const fiveStatStrength =
    getFiveStatStrength(command.params) +
    getFiveStatStrength(arcCommand?.params ?? []);
  const mainConfig = getStatConfig(COMMAND_TARGET_TYPE_MAP[command.commandId]);

  // live command info
  const liveCommand = liveCommands?.find(
    (live) => live.commandId === command.commandId,
  );
  const liveParamsByTarget = new Map(
    (liveCommand?.params ?? []).map((p) => [p.targetType, p.value]),
  );
  const performanceGains = (liveCommand?.performance ?? []).filter(
    (p) => p.value !== 0,
  );
  const previewNoteStat =
    currentNoteStat && performanceGains.length > 0
      ? {
          da: { ...currentNoteStat.da },
          pa: { ...currentNoteStat.pa },
          vo: { ...currentNoteStat.vo },
          vi: { ...currentNoteStat.vi },
          me: { ...currentNoteStat.me },
        }
      : null;
  performanceGains.forEach((p) => {
    const noteType = PERFORMANCE_TYPE_MAP[p.performanceType];
    if (!noteType || !previewNoteStat) return;
    previewNoteStat[noteType].value += p.value;
  });
  const currentMinNotes = getMinNoteTypes(currentNoteStat);
  const previewMinNotes = getMinNoteTypes(previewNoteStat ?? currentNoteStat);
  const hasPositiveImpact = gains.length > 0 || performanceGains.length > 0;
  const mainStatKey =
    getStatKeyNameByTarget(COMMAND_TARGET_TYPE_MAP[command.commandId]) ??
    getStatKeyNameByTarget(
      command.params.find((p) => p.value > 0)?.targetType ??
        TARGET_TYPE.UNKNOWN,
    );
  type MainStatKey = Exclude<keyof CharStats, 'skillPoint'>;
  let mainStatValue: number | undefined;
  if (!currentStats || !mainStatKey) {
    mainStatValue = undefined;
  } else if (mainStatKey === 'skillPoint') {
    mainStatValue = currentStats.skillPoint;
  } else {
    mainStatValue = currentStats[mainStatKey as MainStatKey].value;
  }

  const arcCharaIdByTargetId = new Map(
    (arcData?.evaluationInfo ?? []).map((item) => [
      item.targetId,
      item.charaId,
    ]),
  );
  const arcRivalByCharaId = new Map(
    (arcData?.rivals ?? []).map((rival) => [rival.charaId, rival]),
  );
  const getArcCharaId = (position: number) =>
    arcCharaIdByTargetId.get(position) ??
    (position >= 1000 ? position : undefined);
  const isTagTrainingPartner = (position: number) => {
    const partner = partnerStats.find((item) => item.position === position);
    const supportCard = partner?.supportCardId
      ? UMDB.supportCards[partner.supportCardId]
      : undefined;
    return Boolean(
      partner &&
        supportCard &&
        partner.evaluation >= 80 &&
        COMMAND_TARGET_TYPE_MAP[supportCard.commandId] ===
          COMMAND_TARGET_TYPE_MAP[command.commandId],
    );
  };
  const tagTrainingPartnerCount =
    command.trainingPartners.filter(isTagTrainingPartner).length;
  const getArcGaugeState = (position: number) => {
    const arcCharaId = getArcCharaId(position);
    const arcRival = arcCharaId ? arcRivalByCharaId.get(arcCharaId) : undefined;
    if (!arcRival) return null;
    const blocked = Boolean(
      arcData?.allRivalBoostBlocked ||
        arcData?.rivalBoostBlockedCharaIds.includes(arcRival.charaId),
    );
    let gain = 1;
    if (blocked || arcRival.rivalBoost >= ARC_STAR_GAUGE_MAX) {
      gain = 0;
    } else if (arcData?.spTagBoostType === 1) {
      gain = isTagTrainingPartner(position) ? 2 : 1;
    } else if (arcData?.spTagBoostType === 2) {
      gain = tagTrainingPartnerCount > 0 ? 2 : 1;
    } else if (arcData?.spTagBoostType === 3) {
      gain = tagTrainingPartnerCount > 0 ? tagTrainingPartnerCount + 1 : 1;
    }
    const preview = clampArcStarGauge(arcRival.rivalBoost + gain);
    return {
      arcCharaId,
      arcRival,
      blocked,
      preview,
      gain: preview - clampArcStarGauge(arcRival.rivalBoost),
    };
  };
  const hasArcFriend9043 = Boolean(
    arcData &&
      command.trainingPartners.some(
        (position) => getArcCharaId(position) === 9043,
      ),
  );
  const arcChargeGain = command.trainingPartners.reduce(
    (sum, position) => sum + (getArcGaugeState(position)?.gain ?? 0),
    0,
  );
  const arcFullCount = command.trainingPartners.reduce((count, position) => {
    const gaugeState = getArcGaugeState(position);
    return (
      count +
      (gaugeState &&
      gaugeState.gain > 0 &&
      gaugeState.preview === ARC_STAR_GAUGE_MAX
        ? 1
        : 0)
    );
  }, 0);

  return (
    <button
      disabled={isDisabled}
      type="button"
      onMouseEnter={() => onHoverChange?.(command, true)}
      onMouseLeave={() => onHoverChange?.(command, false)}
      className={`
        relative group flex flex-col items-stretch text-left
        border-4 rounded-xl transition-all duration-150 transform active:scale-95
        ${
          isDisabled
            ? 'border-gray-300 bg-gray-100 grayscale cursor-not-allowed opacity-60'
            : `border-white hover:border-${mainConfig.color}-300 hover:-translate-y-1 shadow-md hover:shadow-xl bg-gradient-to-br from-gray-50 to-gray-100`
        }
      `}
    >
      {/* Level Badge */}
      {command.level > 0 && (
        <div className="absolute -top-3 -left-3 bg-yellow-400 text-yellow-900 border-2 border-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow z-10">
          Lv{command.level}
        </div>
      )}

      {/* Failure Rate */}
      {command.failureRate > 0 && (
        <FailureRateBadge failureRate={command.failureRate} />
      )}

      <div
        className={`h-20 rounded-t-lg flex items-center justify-center overflow-hidden relative ${mainConfig.bg} bg-opacity-10`}
      >
        <mainConfig.icon
          size={48}
          className={`opacity-20 ${mainConfig.text}`}
        />
        <span className={`absolute bottom-1 font-bold ${mainConfig.text}`}>
          {name}
        </span>
        {mainStatKey && typeof mainStatValue === 'number' ? (
          <div className="absolute top-1 right-1">
            <StatTile value={mainStatValue} />
          </div>
        ) : null}
        {hasArcFriend9043 ? (
          <img
            src={UMDB.charaIconPath(9043)}
            alt="友人 9043"
            title="友人参与本次训练（9043）"
            className="absolute bottom-1 left-1 z-20 h-8 w-8 object-contain drop-shadow-sm"
          />
        ) : null}
      </div>

      {/* Stats Impact List */}
      <div className="p-3 space-y-2 bg-white rounded-b-lg flex-1">
        {/* Gains */}
        <div className="space-y-1">
          <MinNoteTransfer
            fromNotes={currentMinNotes}
            toNotes={previewMinNotes}
            warningNotes={warningNoteTypes}
            className="mb-1"
            tooltipMode="training"
          />
          {fiveStatStrength > 0 && (
            <div className="flex items-center justify-between rounded-md border border-sky-100 bg-sky-50/70 px-2 py-1 text-sm">
              <div className="flex items-center gap-1 text-sky-700">
                <span className="text-xs font-semibold">总</span>
              </div>
              <span className="text-base font-black text-sky-700 tabular-nums">
                {formatSigned(fiveStatStrength)}
              </span>
            </div>
          )}
          {arcData ? (
            <div
              className={`grid divide-x divide-violet-200 rounded-md border border-violet-100 bg-violet-50/70 py-1 text-sm ${
                (arcCommand?.addGlobalExp ?? 0) > 0
                  ? 'grid-cols-3'
                  : 'grid-cols-2'
              }`}
            >
              <div className="flex items-center justify-between gap-1 px-2 text-violet-700">
                <span className="text-xs font-semibold">充电</span>
                <span className="text-base font-black tabular-nums">
                  +{arcChargeGain}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 px-2 text-fuchsia-700">
                <span className="text-xs font-semibold">充满</span>
                <span className="text-base font-black tabular-nums">
                  +{arcFullCount}
                </span>
              </div>
              {(arcCommand?.addGlobalExp ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-1 px-2 text-amber-700">
                  <span className="text-xs font-semibold">适性</span>
                  <span className="text-base font-black tabular-nums">
                    +{arcCommand?.addGlobalExp ?? 0}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          {gains.map((p, idx) => {
            const conf = getStatConfig(p.targetType);
            const liveValue = liveParamsByTarget.get(p.targetType) ?? 0;
            const arcValue = arcParamsByTarget.get(p.targetType) ?? 0;
            const scenarioValue = liveValue + arcValue;
            const finalValue = p.value + scenarioValue;
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center text-gray-600">
                  <span className="text-xs">{conf.label}</span>
                </div>
                {scenarioValue !== 0 ? (
                  <div className="flex items-baseline gap-.5">
                    <span className="text-xs font-semibold text-[#AA6533] tabular-nums">
                      {formatSigned(p.value)}
                    </span>
                    <span className="text-xs font-semibold text-[#9673D7] tabular-nums">
                      {formatSigned(scenarioValue)}
                    </span>
                    <span className="text-[10px] text-gray-400">=</span>
                    <span className="text-base font-black text-green-600 tabular-nums">
                      {formatSigned(finalValue)}
                    </span>
                  </div>
                ) : (
                  <span className="font-bold text-green-600">
                    {formatSigned(p.value)}
                  </span>
                )}
              </div>
            );
          })}
          {[...performanceGains]
            .sort((a, b) => a.performanceType - b.performanceType)
            .map((p, idx) => {
              const noteType = PERFORMANCE_TYPE_MAP[p.performanceType];
              const style = noteType ? NOTE_STYLES[noteType] : null;
              const label = style?.label ?? 'Perf';
              return (
                <div
                  key={`perf-${idx}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-1 text-gray-600">
                    <span
                      className={`w-5 h-5 flex-shrink-0 rounded-full bg-white border flex items-center justify-center ring-2 text-[9px] font-black leading-none ${
                        style
                          ? `${style.border} ${style.ring} ${style.text}`
                          : 'border-gray-200 ring-gray-200 text-gray-500'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-base font-black text-green-600 tabular-nums">
                      {formatSigned(p.value)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Divider */}
        {hasPositiveImpact && (costs.length > 0 || recovery) && (
          <hr className="border-dashed border-gray-200" />
        )}

        {/* Costs / Recovery */}
        <div className="space-y-1">
          {costs.map((p, idx) => {
            const conf = getStatConfig(p.targetType);
            return (
              <div
                key={`cost-${idx}`}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-500">{conf.label}</span>
                <span className="font-bold text-red-500">{p.value}</span>
              </div>
            );
          })}
          {recovery.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">体力</span>
              <span className="font-bold text-green-500">
                +{recovery[0].value}
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Partners Footer */}
      {command.trainingPartners.length > 0 && (
        <div className="min-h-[54px] flex flex-wrap justify-start gap-1.5 rounded-b-lg border-t border-gray-100 bg-gray-50 p-2">
          {command.trainingPartners.map((p) => {
            const partner = partnerStats.find((c) => c.position === p);
            const arcCharaId = getArcCharaId(p);
            const arcGaugeState = getArcGaugeState(p);
            const arcRival = arcGaugeState?.arcRival;
            const supportCard = partner?.supportCardId
              ? UMDB.supportCards[partner.supportCardId]
              : undefined;
            const progress =
              partner?.supportCardId === 0 && partner?.position >= 1000
                ? null // not a support card but a person -> no progress bar
                : Math.min(100, Math.max(0, partner?.evaluation ?? 0));
            const specialtySummary =
              partner && supportCard
                ? getSupportCardSpecialtySummary({
                    supportCard,
                    exp: partner.exp,
                    limitBreakCount: partner.limitBreak,
                    supportCardLevels: UMDB.supportCardLevels,
                    liveSpecialtyRateBonus,
                  })
                : null;

            const isMatchingTraining =
              COMMAND_TARGET_TYPE_MAP[supportCard?.commandId ?? 0] ===
              COMMAND_TARGET_TYPE_MAP[command.commandId];
            const isMotivated =
              progress !== null && progress >= 80 && isMatchingTraining;
            const rainbowRate = specialtySummary
              ? specialtySummary.targetAppearanceRate
              : null;
            const otherTrainingRate = specialtySummary
              ? specialtySummary.otherAppearanceRate
              : null;
            const absentRate = specialtySummary
              ? specialtySummary.absentRate
              : null;
            const partnerProbabilityLabel =
              rainbowRate !== null &&
              otherTrainingRate !== null &&
              absentRate !== null &&
              specialtySummary
                ? `擅长率 ${specialtySummary.totalRate}\nLive擅长 +${specialtySummary.liveBonusRate}\n彩圈概率 ${formatPercent(rainbowRate)}\n他训概率 ${formatPercent(otherTrainingRate)}\n外出概率 ${formatPercent(absentRate)}`
                : null;
            const isTip = command.tipsPartners?.includes(p);
            const progressColor =
              progress !== null &&
              // eslint-disable-next-line no-nested-ternary
              (progress >= 80
                ? 'bg-[#FFAD1E]'
                : progress >= 60
                  ? 'bg-[#A2E61E]'
                  : 'bg-[#2AC0FF]');
            const arcGaugeBlocked = arcGaugeState?.blocked ?? false;
            const arcGaugePreview = arcGaugeState?.preview ?? 0;
            const fallbackCharaPath =
              arcCharaId != null ? UMDB.charaIconPath(arcCharaId) : '';
            const arcRivalCharaPath = arcRival
              ? UMDB.arcRivalIconPath(arcRival.charaId)
              : '';
            const charaPath =
              arcRivalCharaPath || partner?.charaPath || fallbackCharaPath;
            const currentArcReward = arcRival?.selectionEffects
              .slice()
              .sort((left, right) => left.effectNum - right.effectNum)[0];
            const currentArcRewardIcon = currentArcReward
              ? getArcSelectionEffectIconPath(currentArcReward.effectGroupId)
              : null;
            const currentArcRewardLabel = currentArcReward
              ? formatArcSelectionEffect(
                  currentArcReward.effectGroupId,
                  currentArcReward.effectValue,
                )
              : '';
            return (
              <div
                key={p}
                className={`relative group/partner ${
                  arcData
                    ? `box-border flex h-[54px] w-[68px] items-start gap-1 rounded-lg border border-slate-300 p-1 ${
                        arcRival ? 'justify-start' : 'justify-center'
                      }`
                    : 'flex flex-col items-center'
                }`}
              >
                {arcRival ? (
                  <ArcStarGauge
                    current={arcRival.rivalBoost}
                    preview={arcGaugePreview}
                    blocked={arcGaugeBlocked}
                  />
                ) : null}
                <div className="relative flex flex-col items-center">
                  {/* Rainbow ring */}
                  {isMotivated && (
                    <div className="absolute -top-[3px] left-1/2 z-0 h-[46px] w-[46px] -translate-x-1/2 rounded-full animate-spin-slow">
                      <div className="h-full w-full rounded-full bg-[conic-gradient(from_0deg,theme(colors.blue.400),theme(colors.green.400),theme(colors.yellow.400),theme(colors.red.400),theme(colors.pink.500),theme(colors.blue.400))] opacity-90 blur-[1px]" />
                    </div>
                  )}

                  {/* --- (Circle Container) --- */}
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-white bg-orange-100 text-[10px] shadow-sm transition-transform hover:scale-110">
                    {charaPath ? (
                      <img
                        src={charaPath}
                        className="h-full w-full object-cover"
                        alt="support card"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src =
                            partner?.charaPath || fallbackCharaPath;
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-orange-300 font-bold text-orange-800">
                        P
                      </div>
                    )}
                  </div>

                  {/* Progress Bar (Below Circle) */}
                  {progress !== null && (
                    <div className="relative z-20 -mt-1 h-2 w-9 overflow-hidden rounded-[3px] border border-gray-600 bg-gray-700 box-border">
                      <div
                        className={`h-full ${progressColor} transition-all duration-300 ease-out`}
                        style={{ width: `${progress}%` }}
                      />

                      <div className="pointer-events-none absolute inset-0 grid h-full w-full grid-cols-5">
                        <div className="h-full border-r border-black/20" />
                        <div className="h-full border-r border-black/20" />
                        <div className="h-full border-r border-black/20" />
                        <div className="h-full border-r border-black/20" />
                        <div />
                      </div>
                    </div>
                  )}
                  {progress === null && arcData ? (
                    <div
                      className="-mt-1 h-2 w-9 shrink-0"
                      aria-hidden="true"
                    />
                  ) : null}
                  {/* Exclamation Mark Alert */}
                  {isTip && (
                    <div className="absolute -right-0.5 -top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-red-500 shadow-sm">
                      <span className="text-[10px] font-black text-white">
                        !
                      </span>
                    </div>
                  )}
                </div>
                {partnerProbabilityLabel && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden -translate-x-1/2 whitespace-pre rounded bg-gray-900/90 px-2 py-1 text-[10px] font-semibold leading-snug text-white shadow-lg group-hover/partner:block">
                    {partnerProbabilityLabel}
                  </div>
                )}
                {currentArcRewardIcon ? (
                  <img
                    src={currentArcRewardIcon}
                    alt={currentArcRewardLabel}
                    title={`当前轮转奖励：${currentArcRewardLabel}`}
                    className="absolute -bottom-1 -right-1 z-30 h-[18px] w-[18px] object-contain drop-shadow-sm"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
