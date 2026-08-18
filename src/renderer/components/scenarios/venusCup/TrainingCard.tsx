import { AlertTriangle, TrendingUp } from 'lucide-react';
import { type ComponentType } from 'react';
import {
  COMMAND_NAME_MAP,
  COMMAND_TARGET_TYPE_MAP,
  type CharStats,
  type CommandParam,
  type PartnerStats,
  type TrainingCommand,
  type VenusData,
} from 'types/gameTypes';
import { getVenusTrainingModifierSummary } from 'constant/venusCup';
import { UMDB } from 'renderer/utils/umdb';
import { getSupportCardSpecialtySummary } from 'utils/supportCardSpecialty';
import FailureRateBadge from 'renderer/components/FailureRateBadge';
import createImageIcon from 'renderer/components/Icon';

interface TargetConfig {
  label: string;
  icon: ComponentType<any>;
  color: string;
  bg: string;
  text: string;
  border: string;
}

enum TARGET_TYPE {
  SPEED = 1,
  STAMINA = 2,
  POWER = 3,
  GUTS = 4,
  WIZ = 5,
  VITAL = 10,
  SKILL_PTS = 30,
  UNKNOWN = 0,
}

const getStatConfig = (typeId: number): TargetConfig => {
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

const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const getFiveStatStrength = (
  params: Array<{ targetType: number; finalValue: number }>,
) =>
  params
    .filter(
      (param) =>
        param.targetType >= TARGET_TYPE.SPEED &&
        param.targetType <= TARGET_TYPE.WIZ &&
        param.finalValue > 0,
    )
    .reduce((sum, param) => sum + param.finalValue, 0);

const mergeParamsWithBonus = (
  baseParams: CommandParam[],
  bonusParams: CommandParam[],
) => {
  const targetTypeSet = new Set([
    ...baseParams.map((param) => param.targetType),
    ...bonusParams.map((param) => param.targetType),
  ]);

  return Array.from(targetTypeSet).map((targetType) => {
    const baseValue = baseParams
      .filter((param) => param.targetType === targetType)
      .reduce((sum, param) => sum + param.value, 0);
    const bonusValue = bonusParams
      .filter((param) => param.targetType === targetType)
      .reduce((sum, param) => sum + param.value, 0);

    return {
      targetType,
      baseValue,
      bonusValue,
      finalValue: baseValue + bonusValue,
    };
  });
};

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

const getTrainingBonusByTarget = (
  targetType: number,
  activeModifierSummary: ReturnType<typeof getVenusTrainingModifierSummary>,
) => {
  switch (targetType) {
    case TARGET_TYPE.SPEED:
      return activeModifierSummary.speedBonus;
    case TARGET_TYPE.STAMINA:
      return activeModifierSummary.staminaBonus;
    case TARGET_TYPE.POWER:
      return activeModifierSummary.powerBonus;
    case TARGET_TYPE.GUTS:
      return activeModifierSummary.gutsBonus;
    case TARGET_TYPE.WIZ:
      return activeModifierSummary.wizBonus;
    default:
      return 0;
  }
};

const getFragmentPreviewCount = (
  spiritBinding?: VenusData['charaCommandInfo'][number],
) => {
  if (!spiritBinding?.spiritId) {
    return 0;
  }
  return spiritBinding.isBoost === 1 ? 2 : 1;
};

const getProgressColor = (progress: number | null) => {
  if (progress === null) {
    return '';
  }
  if (progress >= 80) {
    return 'bg-[#FFAD1E]';
  }
  if (progress >= 60) {
    return 'bg-[#A2E61E]';
  }
  return 'bg-[#2AC0FF]';
};

const buildPartnerProbabilityLabel = ({
  specialtySummary,
  rainbowRate,
  otherTrainingRate,
  absentRate,
  isVenusPassionShining,
}: {
  specialtySummary: ReturnType<typeof getSupportCardSpecialtySummary> | null;
  rainbowRate: number | null;
  otherTrainingRate: number | null;
  absentRate: number | null;
  isVenusPassionShining: boolean;
}) => {
  const lines: string[] = [];
  if (
    rainbowRate !== null &&
    otherTrainingRate !== null &&
    absentRate !== null &&
    specialtySummary
  ) {
    lines.push(
      `擅长率 ${specialtySummary.totalRate}`,
      `彩圈概率 ${formatPercent(rainbowRate)}`,
      `他训概率 ${formatPercent(otherTrainingRate)}`,
      `外出概率 ${formatPercent(absentRate)}`,
    );
  }
  if (isVenusPassionShining) {
    lines.push('情热状态：女神支援卡强制彩圈');
  }
  return lines.length > 0 ? lines.join('\n') : null;
};

function StatTile({ value }: { value: number }) {
  return (
    <div className="flex min-w-[64px] flex-col">
      <div className="flex h-12 items-center justify-end rounded-lg px-2 py-1">
        <span className="text-xl font-bold leading-none text-gray-700">
          {value}
        </span>
      </div>
    </div>
  );
}

const TOTAL_FRAGMENT_SLOTS = 8;
const VENUS_SUPPORT_CARD_ID = 30137;

const formatSpiritAssetId = (spiritId: number) =>
  String(spiritId).padStart(2, '0');

const getSpiritIconPath = (spiritId: number) =>
  `./icons/venusCup/fragement/utx_ico_fragment_${formatSpiritAssetId(spiritId)}.png`;

type FragmentSlotData = {
  spiritId?: number;
  isPreview?: boolean;
  isBoost?: boolean;
  showDoubleBadge?: boolean;
};

export function findVenusSpiritBinding(
  charaCommandInfo: VenusData['charaCommandInfo'] | undefined,
  command: Pick<TrainingCommand, 'commandType' | 'commandId'>,
) {
  return (charaCommandInfo ?? []).find((item) => {
    if (item.commandType !== command.commandType) {
      return false;
    }
    if (item.commandType === 1) {
      return item.commandId === command.commandId;
    }
    return true;
  });
}

export function buildVenusFragmentSlots(
  spiritInfoArray: VenusData['spiritInfo'] | undefined,
  spiritBinding?: VenusData['charaCommandInfo'][number],
) {
  const fragmentSlots: FragmentSlotData[] = Array.from(
    { length: TOTAL_FRAGMENT_SLOTS },
    () => ({}),
  );

  (spiritInfoArray ?? []).forEach((item) => {
    const slotIndex = item.spiritNum - 1;
    if (slotIndex < 0 || slotIndex >= TOTAL_FRAGMENT_SLOTS) {
      return;
    }
    fragmentSlots[slotIndex] = {
      spiritId: item.spiritId,
      isBoost:
        item.spiritId === spiritBinding?.spiritId &&
        spiritBinding?.isBoost === 1,
    };
  });

  if (spiritBinding?.spiritId != null) {
    const previewCount = spiritBinding.isBoost === 1 ? 2 : 1;
    for (let index = 0; index < previewCount; index += 1) {
      const emptyIndex = fragmentSlots.findIndex(
        (slot) => slot.spiritId == null,
      );
      if (emptyIndex < 0) {
        break;
      }
      fragmentSlots[emptyIndex] = {
        spiritId: spiritBinding.spiritId,
        isPreview: true,
        isBoost: spiritBinding.isBoost === 1,
        showDoubleBadge: spiritBinding.isBoost === 1 && index === 0,
      };
    }
  }

  return fragmentSlots;
}

function FragmentSlot({ slot }: { slot?: FragmentSlotData }) {
  if (!slot?.spiritId) {
    return (
      <div className="aspect-[4/3.4] rounded-md border border-amber-100 bg-amber-50/70 shadow-inner" />
    );
  }

  return (
    <div
      className={[
        'relative aspect-[4/3.4] overflow-hidden rounded-md border bg-white shadow-sm',
        slot.isPreview
          ? 'border-2 border-fuchsia-500 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-rose-50 shadow-[0_0_0_2px_rgba(217,70,239,0.18),0_8px_18px_rgba(217,70,239,0.22)]'
          : 'border-amber-200',
        slot.isBoost ? 'ring-2 ring-orange-300' : '',
      ].join(' ')}
    >
      {slot.isPreview ? (
        <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-300/45 via-transparent to-pink-300/70" />
      ) : null}
      {slot.showDoubleBadge ? (
        <div className="absolute right-0 top-0 z-10 rounded-bl-md bg-fuchsia-600 px-1 py-[1px] text-[9px] font-black leading-none text-white shadow-sm">
          x2
        </div>
      ) : null}
      <img
        src={getSpiritIconPath(slot.spiritId)}
        alt={`fragment-${slot.spiritId}`}
        className={`h-full w-full object-contain p-1 ${slot.isPreview ? 'scale-105 opacity-95' : ''}`}
      />
    </div>
  );
}

export function VenusFragmentGrid({ slots }: { slots: FragmentSlotData[] }) {
  return (
    <div className="grid w-[92px] shrink-0 grid-cols-2 gap-1.5 self-center rounded-lg border border-amber-200 bg-amber-50/70 p-1.5">
      {slots.map((slot, index) => (
        <FragmentSlot
          key={`${slot.spiritId ?? 'empty'}-${index}`}
          slot={slot}
        />
      ))}
    </div>
  );
}

function TrainingFragmentPreview({
  spiritId,
  count,
}: {
  spiritId?: number;
  count: number;
}) {
  const previewItems = Array.from({ length: count });

  return (
    <div className="flex min-h-[48px] items-center gap-2">
      {spiritId != null && count > 0
        ? previewItems.map((_, index) => (
            <div
              key={`${spiritId}-${index}`}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-rose-50 shadow-sm"
            >
              <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-fuchsia-300/30 via-transparent to-pink-300/45" />
              <img
                src={getSpiritIconPath(spiritId)}
                alt={`fragment-${spiritId}`}
                className="relative z-10 h-8 w-8 object-contain"
              />
              <div className="absolute -bottom-1 -right-1 z-20 rounded-full bg-fuchsia-600 px-1 py-[1px] text-[9px] font-black leading-none text-white shadow-sm">
                x{count}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

export default function VenusCupTrainingCard({
  command,
  venusData,
  partnerStats,
  currentStats,
  venusPassionActive,
}: {
  command: TrainingCommand;
  venusData?: VenusData;
  partnerStats: PartnerStats;
  currentStats?: CharStats;
  venusPassionActive?: boolean;
}) {
  const isDisabled = command.isEnable === 0;
  const name =
    COMMAND_NAME_MAP[command.commandId] ?? `训练 ${command.commandId}`;
  const activeModifierSummary = getVenusTrainingModifierSummary(
    (venusData?.spiritInfo ?? []).map((item) => item.effectGroupId),
  );
  const venusBonusParams =
    venusData?.commandInfo.find(
      (item) =>
        item.commandId === command.commandId &&
        item.commandType === command.commandType,
    )?.params ?? [];
  const extraGlobalBonusParams: CommandParam[] = [];
  if (activeModifierSummary.skillPointBonus > 0) {
    extraGlobalBonusParams.push({
      targetType: TARGET_TYPE.SKILL_PTS,
      value: activeModifierSummary.skillPointBonus,
    });
  }
  const mergedParams = mergeParamsWithBonus(command.params, [
    ...venusBonusParams,
    ...extraGlobalBonusParams,
  ]);
  const gains = mergedParams.filter(
    (param) => param.finalValue > 0 && param.targetType !== TARGET_TYPE.VITAL,
  );
  const costs = mergedParams.filter((param) => param.finalValue < 0);
  const recovery = mergedParams.filter(
    (param) => param.targetType === TARGET_TYPE.VITAL && param.finalValue > 0,
  );
  const fiveStatStrength = getFiveStatStrength(mergedParams);
  const mainConfig = getStatConfig(COMMAND_TARGET_TYPE_MAP[command.commandId]);
  const currentTrainingTargetType = COMMAND_TARGET_TYPE_MAP[command.commandId];
  const currentTrainingBonus = getTrainingBonusByTarget(
    currentTrainingTargetType,
    activeModifierSummary,
  );
  const mainStatKey =
    getStatKeyNameByTarget(COMMAND_TARGET_TYPE_MAP[command.commandId]) ??
    getStatKeyNameByTarget(
      command.params.find((param) => param.value > 0)?.targetType ??
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

  const spiritBinding = findVenusSpiritBinding(
    venusData?.charaCommandInfo,
    command,
  );
  const fragmentPreviewCount = getFragmentPreviewCount(spiritBinding);

  return (
    <button
      disabled={isDisabled}
      type="button"
      className={[
        'relative flex w-[224px] shrink-0 flex-col items-stretch rounded-xl border-4 text-left transition-all duration-150 transform active:scale-95',
        isDisabled
          ? 'cursor-not-allowed border-gray-300 bg-gray-100 opacity-60 grayscale'
          : `border-white bg-gradient-to-br from-gray-50 to-gray-100 shadow-md hover:-translate-y-1 hover:border-${mainConfig.color}-300 hover:shadow-xl`,
      ].join(' ')}
    >
      {command.level > 0 && (
        <div className="absolute -left-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-yellow-400 text-sm font-bold text-yellow-900 shadow">
          Lv{command.level}
        </div>
      )}

      {command.failureRate > 0 && (
        <FailureRateBadge failureRate={command.failureRate} />
      )}

      <div
        className={`relative flex h-20 items-center justify-center overflow-hidden rounded-t-lg ${mainConfig.bg} bg-opacity-10`}
      >
        {currentTrainingBonus > 0 ? (
          <div className="pointer-events-none absolute left-4 top-1 z-10 text-[30px] font-black leading-none text-black/80 drop-shadow-[0_2px_6px_rgba(255,255,255,0.25)]">
            +{currentTrainingBonus}
          </div>
        ) : null}
        {currentTrainingBonus > 0 ||
        activeModifierSummary.skillPointBonus > 0 ||
        activeModifierSummary.trainingVitalCostCutPercent > 0 ? (
          <div className="absolute left-4 top-10 z-10 flex max-w-[168px] flex-wrap gap-1.5">
            {activeModifierSummary.skillPointBonus > 0 ? (
              <div className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                PT +{activeModifierSummary.skillPointBonus}
              </div>
            ) : null}
            {activeModifierSummary.trainingVitalCostCutPercent > 0 ? (
              <div className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-black text-sky-800 ring-1 ring-sky-200">
                体耗 -{activeModifierSummary.trainingVitalCostCutPercent}%
              </div>
            ) : null}
          </div>
        ) : null}
        <mainConfig.icon
          size={48}
          className={`opacity-20 ${mainConfig.text}`}
        />
        <span className={`absolute bottom-1 font-bold ${mainConfig.text}`}>
          {name}
        </span>
        {mainStatKey && typeof mainStatValue === 'number' ? (
          <div className="absolute right-1 top-1">
            <StatTile value={mainStatValue} />
          </div>
        ) : null}
      </div>

      <div className="rounded-b-lg bg-white p-3">
        <div className="min-w-0 space-y-2">
          <div className="space-y-1">
            {fiveStatStrength > 0 ? (
              <div className="flex items-center justify-between rounded-md border border-sky-100 bg-sky-50/70 px-2 py-1 text-sm">
                <div className="flex items-center gap-1 text-sky-700">
                  <span className="text-xs font-semibold">总</span>
                </div>
                <span className="text-base font-black text-sky-700 tabular-nums">
                  {formatSigned(fiveStatStrength)}
                </span>
              </div>
            ) : null}
            {gains.map((param, index) => {
              const conf = getStatConfig(param.targetType);
              return (
                <div
                  key={`gain-${index}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center text-gray-600">
                    <span className="text-xs">{conf.label}</span>
                  </div>
                  {param.bonusValue !== 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-semibold text-[#AA6533] tabular-nums">
                        {formatSigned(param.baseValue)}
                      </span>
                      <span className="text-xs font-semibold text-[#9673D7] tabular-nums">
                        {formatSigned(param.bonusValue)}
                      </span>
                      <span className="text-[10px] text-gray-400">=</span>
                      <span className="text-base font-black text-green-600 tabular-nums">
                        {formatSigned(param.finalValue)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-green-600">
                      {formatSigned(param.finalValue)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {gains.length > 0 && (costs.length > 0 || recovery.length > 0) ? (
            <hr className="border-dashed border-gray-200" />
          ) : null}

          <div className="space-y-1">
            {costs.map((param, index) => {
              const conf = getStatConfig(param.targetType);
              return (
                <div
                  key={`cost-${index}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-500">{conf.label}</span>
                  {param.bonusValue !== 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-semibold text-[#AA6533] tabular-nums">
                        {formatSigned(param.baseValue)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#9673D7] tabular-nums">
                        {formatSigned(param.bonusValue)}
                      </span>
                      <span className="text-[10px] text-gray-400">=</span>
                      <span className="font-bold text-red-500">
                        {param.finalValue}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-red-500">
                      {param.finalValue}
                    </span>
                  )}
                </div>
              );
            })}
            {recovery.length > 0 ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">体力</span>
                {recovery[0].bonusValue !== 0 ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-semibold text-[#AA6533] tabular-nums">
                      {formatSigned(recovery[0].baseValue)}
                    </span>
                    <span className="text-[10px] font-semibold text-[#9673D7] tabular-nums">
                      {formatSigned(recovery[0].bonusValue)}
                    </span>
                    <span className="text-[10px] text-gray-400">=</span>
                    <span className="font-bold text-green-500">
                      +{recovery[0].finalValue}
                    </span>
                  </div>
                ) : (
                  <span className="font-bold text-green-500">
                    +{recovery[0].finalValue}
                  </span>
                )}
              </div>
            ) : null}
            {fragmentPreviewCount > 0 ? (
              <div className="pt-1">
                <TrainingFragmentPreview
                  spiritId={spiritBinding?.spiritId}
                  count={fragmentPreviewCount}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-[46px] flex-wrap justify-start gap-1.5 rounded-b-lg border-t border-gray-100 bg-gray-50 p-2">
        {command.trainingPartners.map((position) => {
          const partner = partnerStats.find(
            (item) => item.position === position,
          );
          const supportCard = partner?.supportCardId
            ? UMDB.supportCards[partner.supportCardId]
            : null;
          const progress =
            partner?.supportCardId === 0 && partner?.position >= 1000
              ? null
              : Math.min(100, Math.max(0, partner?.evaluation ?? 0));
          const specialtySummary =
            partner && supportCard
              ? getSupportCardSpecialtySummary({
                  supportCard,
                  exp: partner.exp,
                  limitBreakCount: partner.limitBreak,
                  supportCardLevels: UMDB.supportCardLevels,
                  liveSpecialtyRateBonus: 0,
                })
              : null;
          const isMatchingTraining =
            COMMAND_TARGET_TYPE_MAP[supportCard?.commandId ?? 0] ===
            COMMAND_TARGET_TYPE_MAP[command.commandId];
          const isVenusSupport =
            partner?.supportCardId === VENUS_SUPPORT_CARD_ID;
          const isVenusPassionShining = !!venusPassionActive && isVenusSupport;
          const isMotivated =
            isVenusPassionShining ||
            (!isVenusSupport &&
              progress !== null &&
              progress >= 80 &&
              isMatchingTraining);
          const rainbowRate =
            specialtySummary && !isVenusSupport
              ? specialtySummary.targetAppearanceRate
              : null;
          const otherTrainingRate = specialtySummary
            ? specialtySummary.otherAppearanceRate
            : null;
          const absentRate = specialtySummary
            ? specialtySummary.absentRate
            : null;
          const partnerProbabilityLabel = buildPartnerProbabilityLabel({
            specialtySummary,
            rainbowRate,
            otherTrainingRate,
            absentRate,
            isVenusPassionShining,
          });
          const isTip = command.tipsPartners?.includes(position);
          const progressColor = getProgressColor(progress);

          return (
            <div
              key={position}
              className="relative flex flex-col items-center group/partner"
            >
              {isMotivated ? (
                <div className="absolute -top-[3px] z-0 h-[38px] w-[38px] animate-spin-slow rounded-full">
                  <div className="h-full w-full rounded-full bg-[conic-gradient(from_0deg,theme(colors.blue.400),theme(colors.green.400),theme(colors.yellow.400),theme(colors.red.400),theme(colors.pink.500),theme(colors.blue.400))] opacity-90 blur-[1px]" />
                </div>
              ) : null}
              <div className="relative z-10 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-white bg-orange-100 text-[10px] shadow-sm transition-transform hover:scale-110">
                {partner?.charaPath ? (
                  <img
                    src={partner.charaPath}
                    className="h-full w-full object-cover"
                    alt={UMDB.charaName(position)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-orange-300 font-bold text-orange-800">
                    P
                  </div>
                )}
              </div>

              {progress !== null && (
                <div className="-mt-1 relative z-20 box-border h-1.5 w-7 overflow-hidden rounded-[3px] border border-gray-600 bg-gray-700">
                  <div
                    className={`h-full ${progressColor}`}
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
              {partnerProbabilityLabel ? (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-pre rounded bg-gray-900/90 px-2 py-1 text-[10px] font-semibold leading-snug text-white shadow-lg group-hover/partner:block">
                  {partnerProbabilityLabel}
                </div>
              ) : null}

              {isTip ? (
                <div className="absolute -right-0.5 -top-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-white bg-red-500 shadow-sm">
                  <span className="text-[10px] font-black text-white">!</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </button>
  );
}
