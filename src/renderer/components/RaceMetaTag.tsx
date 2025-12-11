/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useEffect, useState } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Hash,
  Trophy,
  Loader2,
  Sprout, // 草地
  Footprints, // 泥地
  HelpCircle,
} from 'lucide-react';
import log from 'electron-log';
import { RaceInstance_GroundType } from 'umdb/data_pb';
import { loadUMDB, UMDB } from '../utils/umdb';

// =====================================================================================
// [PREVIEW MODE] MOCK DATA & IMPORTS
// 在您的实际项目中，请删除此区域的代码，并取消注释下方的真实 import 语句
// =====================================================================================

// 2. Mock UMDatabaseUtils
const seasonLabels: Record<number, string> = {
  1: '春',
  2: '夏',
  3: '秋',
  4: '冬',
};
const weatherLabels: Record<number, string> = {
  1: '晴',
  2: '阴',
  3: '雨',
  4: '雪',
};
const groundConditionLabels: Record<number, string> = {
  1: '良',
  2: '稍重',
  3: '重',
  4: '不良',
};

// 3. Mock Types
export interface RaceMetaInfo {
  race_instance_id: number;
  season: number;
  weather: number;
  ground_condition: number;
  random_seed: number;
  entry_num?: number | null;
  current_entry_num?: number | null;
  [key: string]: unknown;
}

export default function RaceMetaTag({
  meta: propsMeta,
  onClick,
}: {
  meta: RaceMetaInfo;
  onClick?: () => void;
}) {
  const [ready, setReady] = useState(false);

  const defaultMeta: RaceMetaInfo = {
    race_instance_id: 1001,
    season: 1,
    weather: 1,
    ground_condition: 1,
    random_seed: 123456789,
    entry_num: 18,
    current_entry_num: 18,
  };

  const meta = propsMeta || defaultMeta;

  useEffect(() => {
    loadUMDB()
      .then(() => setReady(true))
      .catch((err) => {
        log.error('UMDB load failed:', err);
      });
  }, []);

  // --- 数据处理逻辑 ---

  const instance = ready ? UMDB.raceInstances[meta.race_instance_id] : null;

  // 1. 比赛名称 & 距离
  const raceName =
    instance?.name ??
    (meta.race_instance_id === undefined
      ? `自定义赛事`
      : `未知赛事 (${meta.race_instance_id})`);

  const distance = instance?.distance ?? 0;

  const isTurf = instance?.groundType === RaceInstance_GroundType.TURF;
  const isDirt = instance?.groundType === RaceInstance_GroundType.DIRT;

  let SurfaceIcon = HelpCircle;
  let surfaceText = '未知';
  let surfaceStyle = 'text-gray-500 bg-gray-50 border-gray-200';

  if (isTurf) {
    SurfaceIcon = Sprout;
    surfaceText = '草地';
    surfaceStyle = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (isDirt) {
    SurfaceIcon = Footprints;
    surfaceText = '泥地';
    surfaceStyle = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  const season = seasonLabels[meta.season] ?? '-';
  const weather = weatherLabels[meta.weather] ?? '-';
  const groundCondition =
    groundConditionLabels[meta.ground_condition ?? -1] ?? '-';
  const current = meta.current_entry_num;
  const max = meta.entry_num;
  let entryText = '未知';

  if (current !== undefined && current !== null && current !== -1) {
    if (max !== undefined && max !== null && max > 0) {
      entryText = `${current} / ${max}`;
    } else {
      entryText = `${current}`;
    }
  } else if (max) {
    entryText = '?';
  }

  // 5. 季节颜色
  const seasonColors: Record<number, string> = {
    1: 'bg-pink-100 text-pink-600',
    2: 'bg-green-100 text-green-600',
    3: 'bg-orange-100 text-orange-600',
    4: 'bg-blue-100 text-blue-600',
  };
  const seasonClass = seasonColors[meta.season] || 'bg-gray-100 text-gray-600';

  if (!ready) {
    return (
      <div className="w-64 h-36 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-200 animate-pulse">
        <Loader2 className="animate-spin text-gray-400 mb-2" />
        <span className="text-xs text-gray-400">Loading DB...</span>
      </div>
    );
  }

  return (
    <div
      className={`
        w-64 h-36 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden
        transition-all duration-200 select-none group
        ${onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-md active:scale-[0.98]' : ''}
      `}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      {/* 顶部：比赛标题 */}
      <div className="flex-1 p-3 flex items-start gap-2 bg-gradient-to-b from-gray-50 to-white">
        <div className={`mt-1 p-1.5 rounded-md shrink-0 ${seasonClass}`}>
          <Trophy size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-bold text-gray-800 leading-tight line-clamp-2"
            title={raceName}
          >
            {raceName}
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-white grid grid-cols-2 gap-y-2 gap-x-2 text-xs text-gray-600 border-t border-gray-100">
        <div className="col-span-2 flex items-center justify-between">
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${surfaceStyle}`}
          >
            <SurfaceIcon size={12} />
            <span className="font-bold">{surfaceText}</span>
            <span className="w-[1px] h-3 bg-current opacity-30" />
            <span className="font-mono font-bold">{distance}m</span>
          </div>

          {/* 右上：参赛人数 */}
          <div
            className="flex items-center gap-1 text-gray-400"
            title="参赛人数"
          >
            <Users size={12} />
            <span className="font-mono">{entryText}</span>
          </div>
        </div>

        {/* 左下：场地状态 */}
        <div className="flex items-center gap-1.5" title="场地状况">
          <MapPin
            size={12}
            className={`text-ground-${meta.ground_condition}`}
          />
          <span>{groundCondition}</span>
        </div>

        {/* 右下：季节与天气 */}
        <div
          className="flex items-center gap-1.5 justify-end"
          title="季节与天气"
        >
          <Calendar size={12} className={`${seasonClass}`} />
          <span>
            {season} · {weather}
          </span>
        </div>
      </div>

      {/* 底部：Technical Info (Seed) */}
      <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-1.5 border-t border-gray-100">
        <Hash size={10} className="text-gray-400" />
        <span
          className="text-[10px] text-gray-400 font-mono truncate w-full"
          title={`Seed: ${meta.random_seed}`}
        >
          Seed: {meta.random_seed}
        </span>
      </div>
    </div>
  );
}
