import {
  Zap,
  Heart,
  Dumbbell,
  Flame,
  GraduationCap,
  Sparkles,
  Battery,
  AlertTriangle,
} from 'lucide-react';
import { type ComponentType } from 'react';
import {
  TrainingCommand,
  COMMAND_NAME_MAP,
  PartnerStats,
  COMMAND_TARGET_TYPE_MAP,
} from '../types/gameTypes';

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
        icon: Zap,
        color: 'blue',
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        border: 'border-blue-300',
      };
    case TARGET_TYPE.STAMINA:
      return {
        label: '耐力',
        icon: Heart,
        color: 'rose',
        bg: 'bg-rose-400',
        text: 'text-rose-600',
        border: 'border-rose-300',
      };
    case TARGET_TYPE.POWER:
      return {
        label: '力量',
        icon: Dumbbell,
        color: 'orange',
        bg: 'bg-orange-500',
        text: 'text-orange-600',
        border: 'border-orange-300',
      };
    case TARGET_TYPE.GUTS:
      return {
        label: '毅力',
        icon: Flame,
        color: 'pink',
        bg: 'bg-pink-500',
        text: 'text-pink-600',
        border: 'border-pink-300',
      };
    case TARGET_TYPE.WIZ:
      return {
        label: '智力',
        icon: GraduationCap,
        color: 'emerald',
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        border: 'border-emerald-300',
      };
    case TARGET_TYPE.SKILL_PTS:
      return {
        label: '技能Pt',
        icon: Sparkles,
        color: 'amber',
        bg: 'bg-amber-400',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case TARGET_TYPE.VITAL:
      return {
        label: '体力',
        icon: Battery,
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

export default function TrainingCard({
  command,
  partnerStats,
}: {
  command: TrainingCommand;
  partnerStats: PartnerStats;
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
  return (
    <button
      disabled={isDisabled}
      type="button"
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
        <div className="absolute -top-3 -right-2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded-full border border-white shadow z-10">
          {command.failureRate}%
        </div>
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
            return (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-1 text-gray-600">
                  <Icon size={12} className={conf.text} />
                  <span className="text-xs">{conf.label}</span>
                </div>
                <span className="font-bold text-green-600">+{p.value}</span>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        {gains.length > 0 && (costs.length > 0 || recovery) && (
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
          {command.trainingPartners.slice(0, 7).map((p) => {
            // Mocking progress value for visual flair
            const partner = partnerStats.find((c) => c.position === p);
            const progress = Math.min(
              100,
              Math.max(0, partner?.evaluation ?? 0),
            );
            const isTip = command.tipsPartners?.includes(p);
            const progressColor =
              // eslint-disable-next-line no-nested-ternary
              progress > 80
                ? 'bg-orange-400'
                : progress > 40
                  ? 'bg-yellow-400'
                  : 'bg-gray-300';
            return (
              <div
                key={p}
                className="relative group/partner flex flex-col items-center"
              >
                {/* Circle Container - Thinner border */}
                <div className="w-8 h-8 rounded-full bg-orange-100 border-[1.5px] border-white flex items-center justify-center text-[10px] overflow-hidden shadow-sm relative z-10 transition-transform hover:scale-110">
                  {/* Placeholder Icon */}
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
                <div className="w-7 h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                  <div
                    className={`h-full ${progressColor}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
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
