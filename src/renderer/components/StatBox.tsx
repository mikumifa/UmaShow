import {
  Zap,
  Heart,
  Dumbbell,
  Flame,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export const TARGET_TYPE = {
  SPEED: 1,
  STAMINA: 2,
  POWER: 3,
  GUTS: 4,
  WIZ: 5,
  VITAL: 10,
  SKILL_PTS: 30,
};

const getStatConfig = (key: string) => {
  switch (key) {
    case 'speed':
      return { label: '速度', icon: Zap, bg: 'bg-blue-500' };
    case 'stamina':
      return { label: '耐力', icon: Heart, bg: 'bg-rose-400' };
    case 'power':
      return { label: '力量', icon: Dumbbell, bg: 'bg-orange-500' };
    case 'guts':
      return { label: '毅力', icon: Flame, bg: 'bg-pink-500' };
    case 'wiz':
      return { label: '智力', icon: GraduationCap, bg: 'bg-emerald-500' };
    case 'skillPoint':
      return { label: '技能点', icon: Sparkles, bg: 'bg-amber-400' };
    default:
      return { label: key, icon: Zap, bg: 'bg-gray-500' };
  }
};

export default function StatBox({
  value,
  max,
  keyName,
}: {
  keyName: string;
  value: number;
  max: number;
}) {
  const conf = getStatConfig(keyName);
  const Icon = conf.icon;

  return (
    <div className="flex flex-col w-full">
      <div
        className={`${conf.bg} text-white text-xs font-bold py-1 px-2 rounded-t-lg flex items-center justify-center gap-1`}
      >
        <Icon size={14} fill="currentColor" className="opacity-90" />
        <span>{conf.label}</span>
      </div>

      <div className="bg-white border-x-2 border-b-2 border-gray-200 rounded-b-lg p-1 h-14 flex items-center justify-between relative">
        <div
          className={`absolute bottom-0 left-0 h-1 opacity-30 ${conf.bg}`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />

        <div className="flex flex-col items-end pr-2">
          <span className="text-xl font-bold text-gray-700 leading-none">
            {value}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">/{max}</span>
        </div>
      </div>
    </div>
  );
}
