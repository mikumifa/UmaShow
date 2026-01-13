import { AlertTriangle, TrendingUp } from 'lucide-react';
import { type ComponentType } from 'react';
import {
  TrainingCommand,
  COMMAND_NAME_MAP,
  PartnerStats,
  COMMAND_TARGET_TYPE_MAP,
  LiveCommands,
} from '../../types/gameTypes';
import { UMDB } from '../utils/umdb';
import FailureRateBadge from './FailureRateBadge';
import createImageIcon from './Icon';
import { NOTE_STYLES, type NoteType } from './SongStatusCard';

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
        label: '技能Pt',
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

export default function TrainingCard({
  command,
  partnerStats,
  liveCommands,
  onHoverChange,
}: {
  command: TrainingCommand;
  partnerStats: PartnerStats;
  liveCommands?: LiveCommands;
  onHoverChange?: (command: TrainingCommand, isHovering: boolean) => void;
}) {
  const isDisabled = command.isEnable === 0;
  const name =
    COMMAND_NAME_MAP[command.commandId] || `训练 ${command.commandId}`;

  const gains = command.params.filter(
    (p) => p.value > 0 && p.targetType !== 10,
  );
  const costs = command.params.filter((p) => p.value < 0);
  const recovery = command.params.filter(
    (p) => p.targetType === 10 && p.value > 0,
  );
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
  const hasPositiveImpact = gains.length > 0 || performanceGains.length > 0;

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

      {/* Header Image Area (Abstract representation) */}
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
      </div>

      {/* Stats Impact List */}
      <div className="p-3 space-y-2 bg-white rounded-b-lg flex-1">
        {/* Gains */}
        <div className="space-y-1">
          {gains.map((p, idx) => {
            const conf = getStatConfig(p.targetType);
            const Icon = conf.icon;
            const liveValue = liveParamsByTarget.get(p.targetType) ?? 0;
            const finalValue = p.value + liveValue;
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-1 text-gray-600">
                  <Icon size={18} className={conf.text} />
                  <span className="text-xs">{conf.label}</span>
                </div>
                {liveValue !== 0 ? (
                  <div className="flex items-baseline gap-.5">
                    <span className="text-xs font-semibold text-[#AA6533] tabular-nums">
                      {formatSigned(p.value)}
                    </span>
                    <span className="text-xs font-semibold text-[#9673D7] tabular-nums">
                      {formatSigned(liveValue)}
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
        <div className="bg-gray-50 p-2 rounded-b-lg border-t border-gray-100 flex flex-wrap gap-1.5 justify-start min-h-[46px]">
          {command.trainingPartners.map((p) => {
            const partner = partnerStats.find((c) => c.position === p);
            const progress =
              partner?.supportCardId === 0 && partner?.position >= 1000
                ? null // not a support card but a person -> no progress bar
                : Math.min(100, Math.max(0, partner?.evaluation ?? 0));

            const isMotivated =
              progress !== null &&
              progress >= 80 &&
              COMMAND_TARGET_TYPE_MAP[
                UMDB.supportCards[partner!.supportCardId!]?.commandId ?? 0
              ] === COMMAND_TARGET_TYPE_MAP[command.commandId];
            const isTip = command.tipsPartners?.includes(p);
            const progressColor =
              progress !== null &&
              // eslint-disable-next-line no-nested-ternary
              (progress >= 80
                ? 'bg-[#FFAD1E]'
                : progress >= 60
                  ? 'bg-[#A2E61E]'
                  : 'bg-[#2AC0FF]');
            return (
              <div
                key={p}
                className="relative group/partner flex flex-col items-center"
              >
                {/* 只有在 isMotivated 为 true 时显示 */}
                {isMotivated && (
                  <div className="absolute -top-[3px] w-[38px] h-[38px] rounded-full z-0 animate-spin-slow">
                    <div className="w-full h-full rounded-full bg-[conic-gradient(from_0deg,theme(colors.blue.400),theme(colors.green.400),theme(colors.yellow.400),theme(colors.red.400),theme(colors.pink.500),theme(colors.blue.400))] blur-[1px] opacity-90" />
                  </div>
                )}

                {/* --- (Circle Container) --- */}
                <div className="w-8 h-8 rounded-full bg-orange-100 border-[1.5px] border-white flex items-center justify-center text-[10px] overflow-hidden shadow-sm relative z-10 transition-transform hover:scale-110">
                  {partner && partner.charaPath ? (
                    <img
                      src={partner.charaPath}
                      className="w-full h-full object-cover"
                      alt="support card"
                    />
                  ) : (
                    <div className="bg-orange-300 w-full h-full flex items-center justify-center text-orange-800 font-bold">
                      P
                    </div>
                  )}
                </div>

                {/* Progress Bar (Below Circle) */}
                {progress !== null && (
                  <div className="w-7 h-1.5 bg-gray-700 rounded-[3px] border border-gray-600 -mt-1 relative overflow-hidden z-20 box-border">
                    <div
                      className={`h-full ${progressColor} transition-all duration-300 ease-out`}
                      style={{ width: `${progress}%` }}
                    />

                    <div className="absolute inset-0 w-full h-full grid grid-cols-5 pointer-events-none">
                      <div className="border-r border-black/20 h-full" />
                      <div className="border-r border-black/20 h-full" />
                      <div className="border-r border-black/20 h-full" />
                      <div className="border-r border-black/20 h-full" />
                      <div />
                    </div>
                  </div>
                )}
                {/* Exclamation Mark Alert (Example: Show on partner 4) */}
                {isTip && (
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 border-[1.5px] border-white rounded-full z-20 shadow-sm flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </button>
  );
}
