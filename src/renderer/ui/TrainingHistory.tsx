import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Database,
  Heart,
  RotateCcw,
  Sparkles,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  COMMAND_NAME_MAP,
  TrainingHistoryConfig,
  TrainingHistoryRecord,
  TrainingHistoryTrainingEstimate,
  TrainingHistoryTrainingTargetEstimate,
  TrainingHistoryTurnDelta,
  TrainingHistoryTurnEntry,
  TrainingHistoryTurnSnapshot,
} from 'types/gameTypes';
import {
  getTrainingEventLabelByTurn,
  getTrainingTurnInfo,
} from 'constant/gameStat';
import RacePageLayout, {
  raceHeaderButtonClass,
} from 'renderer/components/RacePageLayout';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import { motivationLabels } from 'umdb/UMDatabaseUtils';
import {
  getSupportCardEffectRate,
  getSupportCardLevel,
  getSupportCardMaxLevel,
  getSupportCardSpecialtySummary,
} from 'utils/supportCardSpecialty';
import {
  SUPPORT_CARD_SPECIALTY_RATE_TYPE,
  type SupportCardSpecialtyUnique,
} from 'types/supportCard';

const iconUrlCache = new Map<string, Promise<string | null>>();

function getIconUrl(path: string) {
  const cached = iconUrlCache.get(path);
  if (cached) return cached;
  const promise = window.electron.utils.getFile(path) as Promise<string | null>;
  iconUrlCache.set(path, promise);
  return promise;
}

function AssetIcon({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getIconUrl(path).then((url) => {
      if (mounted) setSrc(url);
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  if (!src) {
    return <div className={`${className} bg-gray-100`} title={alt} />;
  }

  return <img src={src} alt={alt} className={className} draggable={false} />;
}

function formatDate(value?: string | number | Date) {
  if (value == null) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function supportCardName(id: number) {
  return UMDB.supportCards[id]?.name ?? `支援卡 ${id}`;
}

const SUPPORT_CARD_EFFECT_NAME_MAP: Record<string, string> = {
  '1': '友情加成',
  '2': '干劲效果提升',
  '3': '速度加成',
  '4': '耐力加成',
  '5': '力量加成',
  '6': '毅力加成',
  '7': '智力加成',
  '8': '训练效果提升',
  '9': '初始速度提升',
  '10': '初始耐力提升',
  '11': '初始力量提升',
  '12': '初始毅力提升',
  '13': '初始智力提升',
  '14': '初始友情槽提升',
  '15': '比赛加成',
  '16': '粉丝数加成',
  '17': '启发等级提升',
  '18': '启发出现率提升',
  '19': '擅长率提升',
  '25': '事件回复量提升',
  '26': '事件效果提升',
  '27': '失败率降低',
  '28': '体力消耗降低',
  '30': '技能点数加成',
  '31': '智力友情回复量提升',
};

function supportCardEffectLabel(type: string) {
  return (
    UMDB.supportCardEffectTypes[type] ??
    SUPPORT_CARD_EFFECT_NAME_MAP[type] ??
    `效果 ${type}`
  );
}

const SPECIAL_UNIQUE_SKILL_KIND_MAP: Record<number, string> = {
  1: '速度技能',
  2: '加速技能',
  3: '回复技能',
};

type SupportCardUniqueFormatter = (
  effect: SupportCardSpecialtyUnique,
) => string[];

const SUPPORT_CARD_SPECIAL_UNIQUE_FORMATTERS: Record<
  number,
  SupportCardUniqueFormatter
> = {
  101: (effect) => {
    const parts = [`羁绊达到 ${effect.value} 时生效`];
    if ((effect.value1 ?? 0) > 0 && (effect.value2 ?? 0) > 0) {
      parts.push(
        `${supportCardEffectLabel(String(effect.value1))} +${effect.value2}`,
      );
    }
    if ((effect.value3 ?? 0) > 0 && (effect.value4 ?? 0) > 0) {
      parts.push(
        `${supportCardEffectLabel(String(effect.value3))} +${effect.value4}`,
      );
    }
    return [parts.join(' / ')];
  },
  102: (effect) => [
    `羁绊 >= ${effect.value} 时，除根性外训练效果 +${effect.value1 ?? 0}`,
  ],
  103: (effect) => [
    `编成支援卡类型 >= ${effect.value} 时，训练效果 +${effect.value1 ?? 0}`,
  ],
  104: (effect) => [
    `粉丝每增加 ${effect.value}，训练效果 +1，最多 +${effect.value1 ?? 0}`,
  ],
  105: (effect) => [
    `编入速/耐/力/根/智卡时，对应初始属性 +${effect.value}`,
    `编入其他类型卡时，所有初始属性 +${effect.value1 ?? 0}`,
  ],
  106: (effect) => [
    `友情训练时，${supportCardEffectLabel(String(effect.value1 ?? 0))} +${effect.value2 ?? 0}，最多叠加 ${effect.value} 次`,
  ],
  107: (effect) => [
    `体力越低 ${supportCardEffectLabel(String(effect.value))} 越高`,
    `基础 +${effect.value4 ?? 0}，最大 +${effect.value3 ?? 0}，体力 <= ${effect.value2 ?? 0} 时达到最大`,
  ],
  108: (effect) => [
    `体力最大值越高，${supportCardEffectLabel(String(effect.value))} 越高`,
    '体力最大值每 +4，训练设施提高 3，最多提高 20',
  ],
  109: () => ['支援卡羁绊总和越高，训练效果越高，最高 +20'],
  110: (effect) => [
    `同时训练支援卡每多 1 张，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  111: (effect) => [
    `训练设施每升 1 级，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  112: (effect) => [`参与训练时，有 ${effect.value}% 概率令失败率变为 0%`],
  113: (effect) => [
    `友情训练时，${supportCardEffectLabel(String(effect.value))} +${effect.value1 ?? 0}`,
  ],
  114: () => ['训练时体力越高训练效果越高，100 体力时最大训练效果 +20'],
  115: () => ['所有支援卡初始羁绊 +5'],
  116: (effect) => [
    `每个${SPECIAL_UNIQUE_SKILL_KIND_MAP[effect.value] ?? `类型${effect.value}技能`}提供 ${supportCardEffectLabel(String(effect.value1 ?? 0))} +${effect.value2 ?? 0}`,
    `最多按 ${effect.value3 ?? 0} 个技能计算`,
  ],
  117: () => ['总训练设施等级越高训练效果越高，每级 +5，最高 +20'],
  118: (effect) => [
    `羁绊 >= ${effect.value1 ?? effect.value} 时，训练可同时出现位置数量 +2`,
  ],
};

function formatSupportCardUniqueEffect(effect: SupportCardSpecialtyUnique) {
  const formatter = SUPPORT_CARD_SPECIAL_UNIQUE_FORMATTERS[effect.type];
  if (formatter) {
    return formatter(effect);
  }
  return [`${supportCardEffectLabel(String(effect.type))} +${effect.value}`];
}

function getHistoryCharaId(cardId: number) {
  if (!Number.isFinite(cardId) || cardId <= 0) return undefined;
  const cardIdText = String(cardId);
  if (cardIdText.length < 4) return undefined;
  return Number(cardIdText.slice(0, 4));
}

function getHistoryHorseIconPath(cardId: number) {
  const charaId = getHistoryCharaId(cardId);
  if (charaId == null) return undefined;
  return `trained_chr_icon/${charaId}_${cardId}.png`;
}

function getHistoryHorseName(cardId: number) {
  const charaId = getHistoryCharaId(cardId);
  if (charaId == null) {
    return UMDB.cardName(cardId);
  }
  return UMDB.charaName(charaId);
}

function storyName(storyId?: number) {
  if (storyId == null) return '未知事件';
  const story = UMDB.stories.find((item: any) => item.id === storyId);
  return story?.name ?? `事件 ${storyId}`;
}

function SupportCardDetail({
  supportCardId,
  limitBreak,
  exp,
}: {
  supportCardId: number;
  limitBreak: number;
  exp: number;
}) {
  const supportCard = UMDB.supportCards[supportCardId];
  const level = getSupportCardLevel({
    exp,
    rarity: supportCard?.rarity,
    limitBreakCount: limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
  const maxLevel = getSupportCardMaxLevel(supportCard?.rarity, limitBreak);
  const specialtySummary = getSupportCardSpecialtySummary({
    supportCard,
    exp,
    limitBreakCount: limitBreak,
    supportCardLevels: UMDB.supportCardLevels,
  });
  const effectEntries = Object.entries(supportCard?.effectValues ?? {})
    .map(([type, values]) => ({
      type,
      label: supportCardEffectLabel(type),
      value: getSupportCardEffectRate(values, level),
    }))
    .filter(
      (item) =>
        item.value > 0 &&
        Number(item.type) !== SUPPORT_CARD_SPECIALTY_RATE_TYPE,
    )
    .sort((left, right) => Number(left.type) - Number(right.type));
  const uniqueEntries = Object.values(supportCard?.uniqueEffects ?? {})
    .filter(
      (item) =>
        level >= item.level &&
        item.value > 0 &&
        item.type !== SUPPORT_CARD_SPECIALTY_RATE_TYPE,
    )
    .sort((left, right) => left.type - right.type);
  const formattedUniqueEntries = uniqueEntries.flatMap((item) =>
    formatSupportCardUniqueEffect(item).map((text, index) => ({
      key: `${item.type}-${index}`,
      type: item.type,
      text,
    })),
  );

  return (
    <details className="group rounded-md border border-gray-200 bg-gray-50 p-2">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <AssetIcon
          path={`support_card_s/${supportCardId}.png`}
          alt={supportCardName(supportCardId)}
          className="h-8 w-8 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-gray-800">
            {supportCardName(supportCardId)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
            <span>Lv.{level}/{maxLevel}</span>
            <span>突破 {limitBreak}</span>
            <span>擅长 {specialtySummary.totalRate}%</span>
          </div>
        </div>
        <ChevronDown
          size={14}
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            稀有度 {supportCard?.rarity ?? '-'}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            等级 {level}/{maxLevel}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            EXP {exp}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            擅长率 {specialtySummary.totalRate}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {effectEntries.length === 0 ? (
            <span className="rounded bg-white px-2 py-1 text-gray-400">
              无可见效果
            </span>
          ) : (
            effectEntries.map((item) => (
              <span
                key={`effect-${supportCardId}-${item.type}`}
                className="rounded bg-white px-2 py-1 text-gray-700"
              >
                {item.label} {item.value}
              </span>
            ))
          )}
        </div>
        {formattedUniqueEntries.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-amber-700">固有</div>
            <div className="space-y-1">
              {formattedUniqueEntries.map((item) => (
                <div
                  key={`unique-${supportCardId}-${item.key}`}
                  className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
                >
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function commandLabel(commandResult: any) {
  const commandId = commandResult?.command_id;
  if (commandId == null) return '未知操作';
  return COMMAND_NAME_MAP[commandId] ?? `Command ${commandId}`;
}

function commandResultLabel(resultState: number | undefined) {
  if (resultState === 1) return '失败';
  if (resultState === 2) return '成功';
  return '未知';
}

function formatSignedValue(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function deltaTone(value: number) {
  if (value > 0) return 'text-emerald-700';
  if (value < 0) return 'text-red-700';
  return 'text-gray-500';
}

function effectName(effectId: number) {
  return UMDB.charaEffectTexts[effectId] ?? `effect_id=${effectId}`;
}

function targetTypeLabel(targetType: number) {
  switch (targetType) {
    case 1:
      return '速';
    case 2:
      return '耐';
    case 3:
      return '力';
    case 4:
      return '根';
    case 5:
      return '智';
    case 10:
      return '体';
    case 30:
      return 'PT';
    default:
      return String(targetType);
  }
}

function formatMultiplier(value: number) {
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function trainingPeriodShortLabel(period: ReturnType<typeof getTrainingTurnInfo>['period']) {
  if (period === 'junior') return '初级';
  if (period === 'classic') return '经典';
  if (period === 'senior') return '高级';
  return 'URA';
}

function venusSpiritLabel(spiritNum: number) {
  return `碎片${spiritNum}`;
}

function venusGoddessLabel(charaId: number) {
  return UMDB.charaName(charaId);
}

function isTrackedVenusFragment(spiritNum: number) {
  return spiritNum >= 1 && spiritNum <= 8;
}

function formatVenusSpiritAssetId(spiritId: number) {
  return String(spiritId).padStart(2, '0');
}

function getVenusFragmentIconPath(spiritId: number) {
  return `./icons/venusCup/fragement/utx_ico_fragment_${formatVenusSpiritAssetId(spiritId)}.png`;
}

function VenusFragmentIcon({
  spiritId,
  spiritNum,
  className,
}: {
  spiritId: number;
  spiritNum: number;
  className: string;
}) {
  return (
    <img
      src={getVenusFragmentIconPath(spiritId)}
      alt={venusSpiritLabel(spiritNum)}
      className={className}
      draggable={false}
      title={venusSpiritLabel(spiritNum)}
    />
  );
}

function DeltaSummary({ delta }: { delta?: TrainingHistoryTurnDelta | null }) {
  if (!delta) {
    return <div className="text-xs text-gray-400">无可用收益</div>;
  }
  const addedEffectIds = delta.addedEffectIds ?? [];
  const removedEffectIds = delta.removedEffectIds ?? [];
  const addedVenusSpirits = (delta.addedVenusSpirits ?? []).filter((item) =>
    isTrackedVenusFragment(item.spiritNum),
  );
  const removedVenusSpirits = (delta.removedVenusSpirits ?? []).filter((item) =>
    isTrackedVenusFragment(item.spiritNum),
  );
  const venusLevelChanges = delta.venusLevelChanges ?? [];

  const fields = [
    ['速', delta.speed],
    ['耐', delta.stamina],
    ['力', delta.power],
    ['根', delta.guts],
    ['智', delta.wiz],
    ['PT', delta.skillPoint],
    ['体', delta.vital],
    ['心', delta.motivation],
  ] as const;

  const changedFields = fields.filter(([, value]) => value !== 0);
  const hasEffectChange =
    addedEffectIds.length > 0 ||
    removedEffectIds.length > 0 ||
    addedVenusSpirits.length > 0 ||
    removedVenusSpirits.length > 0 ||
    venusLevelChanges.length > 0;

  if (changedFields.length === 0 && !hasEffectChange) {
    return <div className="text-xs text-gray-400">收益 0</div>;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      {changedFields.map(([label, value]) => (
        <span
          key={label}
          className={`rounded bg-white/80 px-2 py-1 ${deltaTone(value)}`}
        >
          {label} {formatSignedValue(value)}
        </span>
      ))}
      {addedEffectIds.map((effectId) => (
        <span
          key={`add-${effectId}`}
          className="rounded bg-emerald-50 px-2 py-1 text-emerald-700"
        >
          +{effectName(effectId)}
        </span>
      ))}
      {removedEffectIds.map((effectId) => (
        <span
          key={`remove-${effectId}`}
          className="rounded bg-red-50 px-2 py-1 text-red-700"
        >
          -{effectName(effectId)}
        </span>
      ))}
      {addedVenusSpirits.map((item) => (
        <span
          key={`venus-add-${item.spiritNum}`}
          className="inline-flex items-center gap-1 rounded bg-fuchsia-50 px-2 py-1 text-fuchsia-700"
          title={venusSpiritLabel(item.spiritNum)}
        >
          <span>+</span>
          <VenusFragmentIcon
            spiritId={item.spiritId}
            spiritNum={item.spiritNum}
            className="h-4 w-4 object-contain"
          />
        </span>
      ))}
      {removedVenusSpirits.map((item) => (
        <span
          key={`venus-remove-${item.spiritNum}`}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-slate-600"
          title={venusSpiritLabel(item.spiritNum)}
        >
          <span>-</span>
          <VenusFragmentIcon
            spiritId={item.spiritId}
            spiritNum={item.spiritNum}
            className="h-4 w-4 object-contain"
          />
        </span>
      ))}
      {venusLevelChanges.map((item) => (
        <span
          key={`venus-level-${item.charaId}`}
          className="rounded bg-amber-50 px-2 py-1 text-amber-700"
        >
          {venusGoddessLabel(item.charaId)} Lv{item.beforeLevel}{'->'}
          {item.afterLevel}
        </span>
      ))}
    </div>
  );
}

function DeltaText({ delta }: { delta?: TrainingHistoryTurnDelta | null }) {
  if (!delta) {
    return <span className="text-xs text-gray-400">无可用收益</span>;
  }
  const addedEffectIds = delta.addedEffectIds ?? [];
  const removedEffectIds = delta.removedEffectIds ?? [];
  const addedVenusSpirits = (delta.addedVenusSpirits ?? []).filter((item) =>
    isTrackedVenusFragment(item.spiritNum),
  );
  const removedVenusSpirits = (delta.removedVenusSpirits ?? []).filter((item) =>
    isTrackedVenusFragment(item.spiritNum),
  );
  const venusLevelChanges = delta.venusLevelChanges ?? [];

  const fields = [
    ['速度', delta.speed],
    ['耐力', delta.stamina],
    ['力量', delta.power],
    ['根性', delta.guts],
    ['智力', delta.wiz],
    ['PT', delta.skillPoint],
    ['体力', delta.vital],
    ['心情', delta.motivation],
  ] as const;

  const hasAnyChange =
    fields.some(([, value]) => value !== 0) ||
    addedEffectIds.length > 0 ||
    removedEffectIds.length > 0 ||
    addedVenusSpirits.length > 0 ||
    removedVenusSpirits.length > 0 ||
    venusLevelChanges.length > 0;

  if (!hasAnyChange) {
    return <span className="text-xs text-gray-400">无变化</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
      {fields
        .filter(([, value]) => value !== 0)
        .map(([label, value]) => (
          <span
            key={label}
            className={`rounded bg-white/80 px-1.5 py-0.5 ${deltaTone(value)}`}
          >
            {label}
            {formatSignedValue(value)}
          </span>
        ))}
      {addedEffectIds.map((effectId) => (
        <span
          key={`delta-text-add-effect-${effectId}`}
          className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
        >
          +{effectName(effectId)}
        </span>
      ))}
      {removedEffectIds.map((effectId) => (
        <span
          key={`delta-text-remove-effect-${effectId}`}
          className="rounded bg-red-50 px-1.5 py-0.5 text-red-700"
        >
          -{effectName(effectId)}
        </span>
      ))}
      {addedVenusSpirits.map((item) => (
        <span
          key={`delta-text-add-fragment-${item.spiritNum}`}
          className="inline-flex items-center gap-1 rounded bg-fuchsia-50 px-1.5 py-0.5 text-fuchsia-700"
          title={venusSpiritLabel(item.spiritNum)}
        >
          <span>+</span>
          <VenusFragmentIcon
            spiritId={item.spiritId}
            spiritNum={item.spiritNum}
            className="h-3.5 w-3.5 object-contain"
          />
        </span>
      ))}
      {removedVenusSpirits.map((item) => (
        <span
          key={`delta-text-remove-fragment-${item.spiritNum}`}
          className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
          title={venusSpiritLabel(item.spiritNum)}
        >
          <span>-</span>
          <VenusFragmentIcon
            spiritId={item.spiritId}
            spiritNum={item.spiritNum}
            className="h-3.5 w-3.5 object-contain"
          />
        </span>
      ))}
      {venusLevelChanges.map((item) => (
        <span
          key={`delta-text-venus-level-${item.charaId}`}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700"
        >
          {venusGoddessLabel(item.charaId)} Lv{item.beforeLevel}
          {'->'}
          {item.afterLevel}
        </span>
      ))}
    </span>
  );
}

function TurnSnapshotCard({
  snapshot,
}: {
  snapshot: TrainingHistoryTurnSnapshot;
}) {
  const venusGoddessLevels = snapshot.venusGoddessLevels ?? [];
  const venusSpirits = (snapshot.venusSpirits ?? []).filter((item) =>
    isTrackedVenusFragment(item.spiritNum),
  );
  const stats = [
    ['速度', snapshot.speed],
    ['耐力', snapshot.stamina],
    ['力量', snapshot.power],
    ['根性', snapshot.guts],
    ['智力', snapshot.wiz],
    ['PT', snapshot.skillPoint],
  ] as const;
  const goddessLevels = [...venusGoddessLevels].sort(
    (left, right) => left.charaId - right.charaId,
  );
  const spiritItems = [...venusSpirits]
    .sort((left, right) => left.spiritNum - right.spiritNum);

  return (
    <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
        {stats.map(([label, value]) => (
          <span
            key={label}
            className="rounded bg-white px-2 py-1 font-medium text-gray-800"
          >
            {label} {value}
          </span>
        ))}
        <span className="rounded bg-white px-2 py-1">
          心情 {motivationLabels[snapshot.motivation] ?? snapshot.motivation}
        </span>
        <span className="rounded bg-white px-2 py-1">
          体力 {snapshot.vital}/{snapshot.maxVital}
        </span>
        {snapshot.effectIds.length === 0 ? (
          <span className="rounded bg-white px-2 py-1 text-gray-400">
            无 effect
          </span>
        ) : (
          snapshot.effectIds.map((effectId) => (
            <span
              key={effectId}
              className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700"
            >
              {effectName(effectId)}
            </span>
          ))
        )}
      </div>
      {(goddessLevels.length > 0 || spiritItems.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-700">
          {goddessLevels.length > 0 && (
            <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">
              女神{' '}
              {goddessLevels
                .map(
                  (item) =>
                    `${venusGoddessLabel(item.charaId)} Lv${item.venusLevel}`,
                )
                .join(' / ')}
            </span>
          )}
          {spiritItems.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1 rounded bg-fuchsia-50 px-2 py-1 text-fuchsia-700">
              <span>碎片</span>
              {spiritItems.map((item) => (
                <VenusFragmentIcon
                  key={`snapshot-fragment-${item.spiritNum}`}
                  spiritId={item.spiritId}
                  spiritNum={item.spiritNum}
                  className="h-4 w-4 object-contain"
                />
              ))}
            </span>
          )}
        </div>
      )}

      <details className="group mt-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50">
          <span className="flex items-center gap-2">
            <Sparkles size={14} />
            技能与提示
            <span className="text-gray-400">
              {snapshot.skills.length} / {snapshot.skillTips.length}
            </span>
          </span>
          <ChevronDown
            size={14}
            className="text-gray-400 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <div className="rounded bg-white p-2">
            <div className="mb-1 text-xs font-semibold text-gray-500">
              已有技能
            </div>
            <div className="flex flex-wrap gap-2">
              {snapshot.skills.length === 0 ? (
                <span className="text-xs text-gray-400">无</span>
              ) : (
                snapshot.skills.map((skill) => (
                  <span
                    key={`${skill.skillId}-${skill.level}`}
                    className="rounded bg-sky-50 px-2 py-1 text-xs text-sky-700"
                  >
                    {UMDB.skillName(skill.skillId)} Lv.{skill.level}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="rounded bg-white p-2">
            <div className="mb-1 text-xs font-semibold text-gray-500">
              技能提示
            </div>
            <div className="flex flex-wrap gap-2">
              {snapshot.skillTips.length === 0 ? (
                <span className="text-xs text-gray-400">无</span>
              ) : (
                snapshot.skillTips.map((tip, index) => (
                  <span
                    key={`${tip.groupId}-${tip.rarity}-${tip.level}-${index}`}
                    className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700"
                  >
                    {UMDB.skillTipName(tip.groupId, tip.rarity)} / R
                    {tip.rarity} / Lv.{tip.level}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

function TrainingEstimateTargetCard({
  target,
}: {
  target: TrainingHistoryTrainingTargetEstimate;
}) {
  const supportBonusSources = target.supportBonusSources ?? [];
  const friendshipSources = target.friendshipSources ?? [];
  const trainingEffectSources = target.trainingEffectSources ?? [];
  const motivationSources = target.motivationSources ?? [];
  const approxScenarioBase = target.approxScenarioBase ?? 0;
  const supportBonus = target.supportBonus ?? 0;
  const friendshipMultiplier = target.friendshipMultiplier ?? 1;
  const trainingEffectPercent = target.trainingEffectPercent ?? 0;
  const motivationMultiplier = target.motivationMultiplier ?? 1;
  const growthMultiplier = target.growthMultiplier ?? 1;
  const partnerMultiplier = target.partnerMultiplier ?? 1;
  const growthPercent = target.growthPercent ?? 0;
  const partnerCount = target.partnerCount ?? 0;
  const motivationBase = target.motivationBase ?? 0;
  const motivationSupportPercent = target.motivationSupportPercent ?? 0;
  const observed = target.observed ?? 0;
  const estimated = target.estimated ?? 0;

  const baseBeforeFloor =
    (approxScenarioBase + supportBonus) *
    friendshipMultiplier *
    (1 + trainingEffectPercent / 100) *
    motivationMultiplier *
    growthMultiplier *
    partnerMultiplier;

  return (
    <div className="rounded border border-sky-100 bg-white/80 px-2 py-1.5 text-[11px] text-sky-950">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-sky-800">
          {targetTypeLabel(target.targetType)} 目标值 {observed} / 推算 {estimated}
        </span>
        <span>基础 {approxScenarioBase}+{supportBonus}</span>
        <span>友情 ×{formatMultiplier(friendshipMultiplier)}</span>
        <span>训练效果 +{trainingEffectPercent}%</span>
        <span>干劲 ×{formatMultiplier(motivationMultiplier)}</span>
        <span>成长率 +{growthPercent}%</span>
        <span>人数 ×{formatMultiplier(partnerMultiplier)}</span>
      </div>
      <div className="mt-1 rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
        ({approxScenarioBase} + {supportBonus}) ×{' '}
        {formatMultiplier(friendshipMultiplier)} ×{' '}
        {formatMultiplier(1 + trainingEffectPercent / 100)} ×{' '}
        {formatMultiplier(motivationMultiplier)} ×{' '}
        {formatMultiplier(growthMultiplier)} ×{' '}
        {formatMultiplier(partnerMultiplier)} ={' '}
        {baseBeforeFloor.toFixed(3)} → {estimated}
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-sky-700">
        {supportBonusSources.map((item, index) => (
          <span key={`support-${item.source}-${index}`} className="rounded bg-sky-50 px-1.5 py-0.5">
            属性加成 {item.source}+{item.value}
          </span>
        ))}
        {friendshipSources.map((item, index) => (
          <span key={`friend-${item.source}-${index}`} className="rounded bg-pink-50 px-1.5 py-0.5 text-pink-700">
            友情加成 {item.source}+{item.value}%
          </span>
        ))}
        {trainingEffectSources.map((item, index) => (
          <span key={`train-${item.source}-${index}`} className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
            训练效果 {item.source}+{item.value}%
          </span>
        ))}
        {motivationSources.map((item, index) => (
          <span key={`mot-${item.source}-${index}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
            干劲效果 {item.source}+{item.value}%
          </span>
        ))}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer list-none text-[10px] font-medium text-sky-700">
          展开详细步骤
        </summary>
        <div className="mt-1 space-y-1 rounded bg-white/90 p-2 text-[10px] leading-5 text-sky-950">
          <div>
            基础值 = 普通值基础 {approxScenarioBase} + 支援卡属性加成 {supportBonus}
          </div>
          <div>
            友情加成 = {friendshipSources.length === 0
              ? '1'
              : friendshipSources
                  .map((item) => `(1 + ${item.value}%)`)
                  .join(' × ')} = {formatMultiplier(friendshipMultiplier)}
          </div>
          <div>
            训练效果提升 = 1 + {trainingEffectPercent}% ={' '}
            {formatMultiplier(1 + trainingEffectPercent / 100)}
          </div>
          <div>
            干劲修正 = 1 + {formatSignedValue(Math.round(motivationBase * 100))}% ×
            (1 + {motivationSupportPercent}%) ={' '}
            {formatMultiplier(motivationMultiplier)}
          </div>
          <div>
            赛马娘成长率 = 1 + {growthPercent}% ={' '}
            {formatMultiplier(growthMultiplier)}
          </div>
          <div>
            到场人数加成 = 1 + 0.05 × {partnerCount} ={' '}
            {formatMultiplier(partnerMultiplier)}
          </div>
          <div className="border-t border-sky-100 pt-1 font-medium">
            target value = {observed}
          </div>
        </div>
      </details>
    </div>
  );
}

function TrainingEstimateCard({
  estimate,
}: {
  estimate?: TrainingHistoryTrainingEstimate;
}) {
  if (!estimate) return null;
  const presentSupportCardIds = estimate.presentSupportCardIds ?? [];
  const targets = estimate.targets ?? [];
  const notes = estimate.notes ?? [];

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/80 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sky-900">
        <span className="font-semibold">普通训练推算</span>
        <span>Lv {estimate.commandLevel}</span>
        <span>到场 {estimate.partnerCount}</span>
        <span>支援卡 {estimate.supportPartnerCount}</span>
      </div>
      {presentSupportCardIds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-sky-800">
          <span className="rounded bg-white/80 px-1.5 py-0.5">在场支援卡</span>
          {presentSupportCardIds.map((supportCardId) => (
            <span
              key={`present-support-${estimate.commandId}-${supportCardId}`}
              className="rounded bg-sky-50 px-1.5 py-0.5"
            >
              {supportCardName(supportCardId)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {targets.map((target) => (
          <TrainingEstimateTargetCard
            key={`estimate-${estimate.commandId}-${target.targetType}`}
            target={target}
          />
        ))}
      </div>
      {notes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-sky-700">
          {notes.map((note, index) => (
            <span key={`note-${index}`} className="rounded bg-white/80 px-1.5 py-0.5">
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainingEntryCard({ entry }: { entry: TrainingHistoryTurnEntry }) {
  if (entry.type === 'delta') {
    return (
      <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0 truncate whitespace-nowrap text-sm font-semibold text-gray-800">
            {entry.title}：<DeltaText delta={entry.delta} />
          </div>
          <div className="shrink-0 text-xs text-gray-500">
            包 #{entry.packetIndex + 1}
          </div>
        </summary>
        <div className="mt-3 space-y-2">
          <DeltaSummary delta={entry.delta} />
          <div className="text-xs text-gray-500">
            {formatDate(entry.receivedAt)}
          </div>
        </div>
      </details>
    );
  }

  if (entry.type === 'command') {
    const commandResult = entry.commandResult as any;
    const resultState = commandResult?.result_state;
    return (
      <details className="rounded-md border border-blue-100 bg-blue-50 p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="min-w-0 truncate whitespace-nowrap text-sm font-semibold text-blue-800">
            {commandLabel(commandResult)} / {commandResultLabel(resultState)} (
            {resultState ?? '-'}) / <DeltaText delta={entry.delta} />
          </div>
          <div className="shrink-0 text-xs text-blue-500">
            包 #{entry.packetIndex + 1}
          </div>
        </summary>
        <div className="mt-3 space-y-2 text-xs text-blue-900">
          <DeltaSummary delta={entry.delta} />
          <TrainingEstimateCard estimate={entry.trainingEstimate} />
          <div className="flex flex-wrap gap-3">
            <span>command_id: {commandResult?.command_id ?? '-'}</span>
            <span>sub_id: {commandResult?.sub_id ?? '-'}</span>
            <span>result_state: {resultState ?? '-'}</span>
            <span>{formatDate(entry.receivedAt)}</span>
          </div>
          <pre className="overflow-x-auto rounded bg-white/70 p-2 text-[11px] leading-5 text-blue-950">
            {JSON.stringify(commandResult, null, 2)}
          </pre>
        </div>
      </details>
    );
  }

  const event = entry.event as any;

  return (
    <details className="rounded-md border border-amber-100 bg-amber-50 p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0 truncate whitespace-nowrap text-sm font-semibold text-amber-900">
          <span>
            {storyName(entry.storyId)} / <DeltaText delta={entry.delta} />
          </span>
        </div>
        <div className="shrink-0 text-xs text-amber-600">
          包 #{entry.packetIndex + 1}
        </div>
      </summary>
      <div className="mt-3 space-y-2 text-xs text-amber-900">
        <DeltaSummary delta={entry.delta} />
        <div className="flex flex-wrap gap-3">
          <span>story_id: {entry.storyId ?? '-'}</span>
          <span>event_id: {event?.event_id ?? '-'}</span>
          <span>chara_id: {event?.chara_id ?? '-'}</span>
          <span>{formatDate(entry.receivedAt)}</span>
        </div>
        <pre className="overflow-x-auto rounded bg-white/70 p-2 text-[11px] leading-5 text-amber-950">
          {JSON.stringify(event, null, 2)}
        </pre>
      </div>
    </details>
  );
}

export default function TrainingHistory() {
  const [items, setItems] = useState<TrainingHistoryRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<TrainingHistoryConfig>({
    maxCachedRuns: 50,
  });
  const [draftMax, setDraftMax] = useState('50');
  const [ready, setReady] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const selectedMonthNav = useMemo(() => {
    if (!selected) {
      return {
        anchors: [] as Array<{ key: string; label: string; anchorId: string }>,
        turnAnchorIdMap: {} as Record<number, string>,
      };
    }

    const seen = new Set<string>();
    const anchors: Array<{ key: string; label: string; anchorId: string }> = [];
    const turnAnchorIdMap: Record<number, string> = {};

    selected.analysis.turns.forEach((turn) => {
      const info = getTrainingTurnInfo(turn.turn);
      const key =
        info.period === 'ura'
          ? 'ura'
          : `${info.period}-${info.month ?? 'unknown'}`;
      if (seen.has(key)) return;
      seen.add(key);

      const label =
        info.period === 'ura'
          ? 'URA'
          : `${trainingPeriodShortLabel(info.period)} ${info.month}月`;
      const anchorId = `training-history-${selected.id}-${key}`;
      anchors.push({ key, label, anchorId });
      turnAnchorIdMap[turn.turn] = anchorId;
    });

    return { anchors, turnAnchorIdMap };
  }, [selected]);

  const load = useCallback(async () => {
    const [list, nextConfig] = await Promise.all([
      window.electron.trainingHistory.list(),
      window.electron.trainingHistory.getConfig(),
      loadUMDB(),
    ]);
    setItems((list ?? []) as TrainingHistoryRecord[]);
    setConfig(nextConfig ?? { maxCachedRuns: 50 });
    setDraftMax(String(nextConfig?.maxCachedRuns ?? 50));
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = window.electron.trainingHistory.onNew(() => load());
    return () => unsubscribe?.();
  }, [load]);

  const saveConfig = async () => {
    const maxCachedRuns = Math.max(1, Math.floor(Number(draftMax) || 50));
    const next = await window.electron.trainingHistory.setConfig({
      maxCachedRuns,
    });
    setConfig(next);
    setDraftMax(String(next.maxCachedRuns));
    await load();
  };

  const toggleFavorite = async (record: TrainingHistoryRecord) => {
    const updated = await window.electron.trainingHistory.setFavorite(
      record.id,
      !record.favorite,
    );
    if (!updated) return;
    setItems((prev) =>
      prev.map((item) => (item.id === record.id ? updated : item)),
    );
  };

  const deleteRecord = async (record: TrainingHistoryRecord) => {
    if (!confirm(`确定删除这局养成记录？`)) return;
    await window.electron.trainingHistory.delete([record.id]);
    setSelectedId(null);
    await load();
  };

  const recalculateRecords = async (ids?: string[]) => {
    setRecalculating(true);
    try {
      await window.electron.trainingHistory.recalculate(ids);
      await load();
    } finally {
      setRecalculating(false);
    }
  };

  if (selected) {
    const horseName = getHistoryHorseName(selected.summary.cardId);
    const horseIconPath = getHistoryHorseIconPath(selected.summary.cardId);
    return (
      <RacePageLayout
        title={horseName}
        description={`${selected.summary.packetCount} 个包，${selected.summary.turnCount} 个 turn`}
        icon={<Database size={20} />}
        actions={
          <>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={raceHeaderButtonClass}
            >
              <ArrowLeft size={16} />
              返回
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(selected)}
              className={raceHeaderButtonClass}
            >
              <Heart
                size={16}
                fill={selected.favorite ? 'currentColor' : 'none'}
                className={selected.favorite ? 'text-red-500' : ''}
              />
              收藏
            </button>
            <button
              type="button"
              onClick={() => recalculateRecords([selected.id])}
              className={raceHeaderButtonClass}
              disabled={recalculating}
            >
              <RotateCcw size={16} />
              {recalculating ? '计算中' : '重新计算'}
            </button>
          </>
        }
      >
        <div className="mb-4 flex items-center gap-3 rounded-md border border-gray-200 bg-white p-4">
          {horseIconPath && (
            <AssetIcon
              path={horseIconPath}
              alt={horseName}
              className="h-16 w-16 rounded-md object-cover ring-1 ring-gray-100"
            />
          )}
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-gray-900">
              {horseName}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              card_id: {selected.summary.cardId}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
          <div className="mb-2 text-xs font-semibold text-gray-500">
            支援卡
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {selected.summary.supportCards.map((card) => (
            <SupportCardDetail
              key={`${card.position}-${card.supportCardId}`}
              supportCardId={card.supportCardId}
              limitBreak={card.limitBreak}
              exp={card.exp}
            />
          ))}
          </div>
        </div>

        {selectedMonthNav.anchors.length > 0 && (
          <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-gray-500">
              月份导航
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedMonthNav.anchors.map((anchor) => (
                <button
                  key={anchor.key}
                  type="button"
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-white"
                  onClick={() =>
                    document
                      .getElementById(anchor.anchorId)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  {anchor.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {selected.analysis.turns.map((turn) => {
            const turnInfo = getTrainingTurnInfo(turn.turn);
            const eventLabel = getTrainingEventLabelByTurn(turn.turn);
            const anchorId = selectedMonthNav.turnAnchorIdMap[turn.turn];

            return (
              <div
                key={turn.turn}
                id={anchorId}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800">
                      {turnInfo.timeLabel}
                    </div>
                    {eventLabel !== turnInfo.timeLabel && (
                      <div className="mt-1 truncate text-xs text-gray-500">
                        {eventLabel}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-gray-400">
                    {turn.entries.length} 条记录
                  </div>
                </div>
                <TurnSnapshotCard snapshot={turn.snapshot} />
                <div className="space-y-2">
                  {turn.entries.map((entry, index) => (
                    <TrainingEntryCard
                      key={`${entry.type}-${entry.packetIndex}-${index}`}
                      entry={entry}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </RacePageLayout>
    );
  }

  return (
    <RacePageLayout
      title="养成记录"
      description={`最多缓存 ${config.maxCachedRuns} 局，收藏记录不会被自动清理`}
      icon={<Database size={20} />}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => recalculateRecords()}
            className={raceHeaderButtonClass}
            disabled={recalculating}
          >
            <RotateCcw size={16} />
            {recalculating ? '计算中' : '重算全部'}
          </button>
          <Settings size={16} className="text-gray-400" />
          <input
            value={draftMax}
            onChange={(event) => setDraftMax(event.target.value)}
            className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
            type="number"
            min={1}
          />
          <button
            type="button"
            onClick={saveConfig}
            className={raceHeaderButtonClass}
          >
            保存
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {ready && items.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-20">
            <Database size={44} className="mb-3 text-gray-300" />
            <div className="text-sm font-medium text-gray-400">
              暂无养成记录
            </div>
          </div>
        )}

        {items.map((item) => {
          const horseName = getHistoryHorseName(item.summary.cardId);
          const horseIconPath = getHistoryHorseIconPath(item.summary.cardId);
          return (
            <div
              key={item.id}
              className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                className="flex flex-1 items-center gap-4 text-left"
              >
                {horseIconPath && (
                  <AssetIcon
                    path={horseIconPath}
                    alt={horseName}
                    className="h-16 w-16 rounded-md object-cover ring-1 ring-gray-100"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-base font-semibold text-gray-800">
                      {horseName}
                    </div>
                    {item.favorite && (
                      <Heart
                        size={14}
                        className="text-red-500"
                        fill="currentColor"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.summary.supportCards.map((card) => (
                      <AssetIcon
                        key={`${item.id}-${card.position}-${card.supportCardId}`}
                        path={`support_card_s/${card.supportCardId}.png`}
                        alt={supportCardName(card.supportCardId)}
                        className="h-9 w-9 rounded object-cover ring-1 ring-gray-100"
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(item.summary.startTime ?? item.createdAt)}
                    </span>
                    <span>card_id {item.summary.cardId}</span>
                    <span>{item.summary.packetCount} 个包</span>
                    <span>{item.summary.turnCount} 个 turn</span>
                  </div>
                </div>
              </button>

              <div className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => toggleFavorite(item)}
                  className={raceHeaderButtonClass}
                  title="收藏"
                >
                  <Heart
                    size={16}
                    fill={item.favorite ? 'currentColor' : 'none'}
                    className={item.favorite ? 'text-red-500' : ''}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => deleteRecord(item)}
                  className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </RacePageLayout>
  );
}
