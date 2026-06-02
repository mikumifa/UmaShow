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
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import SupportCardDetail from 'renderer/components/trainingHistory/SupportCardDetail';
import TrainingEstimateCard from 'renderer/components/trainingHistory/TrainingEstimateCard';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import { motivationLabels } from 'umdb/UMDatabaseUtils';
import { supportCardName } from 'renderer/utils/trainingHistorySupportCard';

function formatDate(value?: string | number | Date) {
  if (value == null) return '未知时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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
