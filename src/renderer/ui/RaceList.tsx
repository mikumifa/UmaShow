/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trash2,
  Square,
  CheckSquare,
  Trophy,
  Clock,
  Plus,
  X,
  BarChart3,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RaceArchive, RaceRecord } from 'types/gameTypes';
import RaceMetaTag from 'renderer/components/RaceMetaTag';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import RacePageLayout, {
  raceHeaderButtonClass,
} from 'renderer/components/RacePageLayout';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import * as UMDatabaseUtils from 'umdb/UMDatabaseUtils';

const fallbackArchives: RaceArchive[] = [
  {
    id: 'default',
    name: '默认',
    createdAt: 0,
  },
];

function getHorseRank(horse: Record<string, unknown>, fallbackIndex: number) {
  const rankFields = [
    horse.rank,
    horse.result_rank,
    horse.final_rank,
    horse.frame_order,
  ];
  const rank = rankFields
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);
  if (rank != null) return rank;
  return fallbackIndex + 1;
}

function getHorseFinishRank(
  horse: Record<string, unknown>,
  finishOrderByFrameOrder?: Map<number, number>,
  fallbackIndex = 0,
) {
  const frameOrder = Number(horse.frame_order);
  if (
    finishOrderByFrameOrder &&
    Number.isFinite(frameOrder) &&
    frameOrder > 0
  ) {
    const finishOrder = finishOrderByFrameOrder.get(frameOrder - 1);
    if (finishOrder != null && Number.isFinite(finishOrder) && finishOrder >= 0) {
      return finishOrder + 1;
    }
  }

  return getHorseRank(horse, fallbackIndex);
}

function getHorseIconPath(horse: Record<string, unknown>) {
  const charaId = Number(horse.chara_id);
  const raceDressId = Number(horse.race_dress_id);
  if (!Number.isFinite(charaId) || !Number.isFinite(raceDressId)) return undefined;
  return `trained_chr_icon/${charaId}_${raceDressId}.png`;
}

function getOrderIconPath(rank: number) {
  if (!Number.isFinite(rank) || rank <= 0 || rank > 20) return undefined;
  return `order/utx_txt_order_s_${String(rank - 1).padStart(2, '0')}.png`;
}

function getHorseDisplayName(horse: Record<string, unknown>) {
  const charaId = Number(horse.chara_id);
  const cardId = Number(horse.card_id);
  const charaName = Number.isFinite(charaId) ? UMDB.charas[charaId]?.name : undefined;
  const cardName = Number.isFinite(cardId) ? UMDB.cards[cardId]?.name : undefined;
  return charaName ?? cardName ?? String(horse.owner_trainer_name ?? horse.trainer_name ?? horse.viewer_id ?? 'Unknown');
}

function getHorseOwnerName(horse: Record<string, unknown>) {
  const ownerName = String(horse.owner_trainer_name ?? '').trim();
  if (ownerName) return ownerName;

  const trainerName = String(horse.trainer_name ?? '').trim();
  if (trainerName) return trainerName;

  return 'NPC';
}

function horseNumberField(horse: Record<string, unknown>, key: string) {
  const value = Number(horse[key]);
  return Number.isFinite(value) ? value : undefined;
}

function properRank(value: unknown) {
  const rank = Number(value);
  return Number.isFinite(rank)
    ? (UMDatabaseUtils.charaProperLabels[rank] ?? '-')
    : '-';
}

function valueTone(value: string | number) {
  if (typeof value === 'number') {
    if (value >= 1200) return 'text-blue-700';
    if (value >= 1000) return 'text-indigo-700';
    if (value >= 800) return 'text-emerald-700';
    if (value >= 600) return 'text-amber-700';
    return 'text-gray-700';
  }

  const properTone: Record<string, string> = {
    S: 'text-yellow-700',
    A: 'text-orange-600',
    B: 'text-amber-600',
    C: 'text-lime-700',
    D: 'text-green-700',
    E: 'text-teal-700',
    F: 'text-sky-700',
    G: 'text-gray-500',
  };
  return properTone[value] ?? 'text-gray-700';
}

function valueBadgeTone(value: string | number) {
  if (value === 'S') return 'bg-yellow-50 ring-1 ring-yellow-200';
  if (value === 'A') return 'bg-orange-50 ring-1 ring-orange-200';
  if (value === 'B') return 'bg-amber-50 ring-1 ring-amber-200';
  if (value === 'C') return 'bg-lime-50 ring-1 ring-lime-200';
  if (value === 'D') return 'bg-green-50 ring-1 ring-green-200';
  if (value === 'E') return 'bg-teal-50 ring-1 ring-teal-200';
  if (value === 'F') return 'bg-sky-50 ring-1 ring-sky-200';
  if (typeof value === 'number' && value >= 1000)
    return 'bg-blue-50 ring-1 ring-blue-200';
  return 'bg-white';
}

function HoverStatPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span
        className={`rounded px-1 font-mono font-semibold ${valueTone(
          value,
        )} ${valueBadgeTone(value)}`}
      >
        {value}
      </span>
    </span>
  );
}

function HorseHoverCard({
  horse,
  iconPath,
}: {
  horse: Record<string, unknown>;
  iconPath?: string;
}) {
  const title = getHorseDisplayName(horse);
  const ownerName = getHorseOwnerName(horse);
  const statusItems = [
    { label: '速', value: horseNumberField(horse, 'speed') ?? '-' },
    { label: '耐', value: horseNumberField(horse, 'stamina') ?? '-' },
    {
      label: '力',
      value:
        horseNumberField(horse, 'pow') ?? horseNumberField(horse, 'power') ?? '-',
    },
    { label: '根', value: horseNumberField(horse, 'guts') ?? '-' },
    { label: '智', value: horseNumberField(horse, 'wiz') ?? '-' },
  ];
  const properGroups = [
    {
      label: '距',
      items: [
        { label: '短', value: properRank(horse.proper_distance_short) },
        { label: '英', value: properRank(horse.proper_distance_mile) },
        { label: '中', value: properRank(horse.proper_distance_middle) },
        { label: '长', value: properRank(horse.proper_distance_long) },
      ],
    },
    {
      label: '脚',
      items: [
        { label: '逃', value: properRank(horse.proper_running_style_nige) },
        { label: '先', value: properRank(horse.proper_running_style_senko) },
        { label: '差', value: properRank(horse.proper_running_style_sashi) },
        { label: '追', value: properRank(horse.proper_running_style_oikomi) },
      ],
    },
    {
      label: '场',
      items: [
        { label: '草', value: properRank(horse.proper_ground_turf) },
        { label: '泥', value: properRank(horse.proper_ground_dirt) },
      ],
    },
  ];

  return (
    <div className="w-[320px] rounded-md border border-gray-200 bg-white p-2 text-left shadow-xl">
      <div className="flex gap-2">
        <div className="h-11 w-11 flex-none overflow-hidden rounded-full bg-gray-100">
          {iconPath ? (
            <AssetIcon
              path={iconPath}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-gray-200" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900" title={title}>
            {title}
          </div>
          <div className="truncate text-xs text-gray-500">{ownerName}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            {statusItems.map((item) => (
              <HoverStatPill
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {properGroups.map((group) => (
          <div key={group.label} className="flex items-center gap-1.5">
            <span className="w-4 text-gray-400">{group.label}</span>
            <div className="flex flex-wrap gap-1">
              {group.items.map((item) => (
                <HoverStatPill
                  key={`${group.label}-${item.label}`}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RaceList() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialArchiveId =
    (location.state as { archiveId?: string } | null)?.archiveId ?? 'default';
  const [items, setItems] = useState<RaceRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [archives, setArchives] = useState<RaceArchive[]>([]);
  const [activeArchiveId, setActiveArchiveId] = useState(initialArchiveId);
  const [targetArchiveId, setTargetArchiveId] = useState('default');
  const [newArchiveName, setNewArchiveName] = useState('');
  const [showCreateArchive, setShowCreateArchive] = useState(false);
  const [showArchiveTarget, setShowArchiveTarget] = useState(false);
  const [umdbReady, setUmdbReady] = useState(false);
  const [hoveredHorsePreview, setHoveredHorsePreview] = useState<{
    horse: Record<string, unknown>;
    iconPath?: string;
    left: number;
    top: number;
  } | null>(null);

  const archiveNameById = new Map(
    archives.map((archive) => [archive.id, archive.name]),
  );
  const finishOrderMapByFilename = useMemo(() => {
    const map = new Map<string, Map<number, number>>();

    items.forEach((item) => {
      if (!item.scenario) return;
      try {
        const raceData = deserializeFromBase64(item.scenario.trim());
        map.set(
          item.filename,
          new Map(
            raceData.horseResult.map((result, frameOrder) => [
              frameOrder,
              result.finishOrder ?? frameOrder,
            ]),
          ),
        );
      } catch {
        // Ignore malformed scenario so the rest of the list still renders.
      }
    });

    return map;
  }, [items]);

  /** 加载比赛文件列表 */
  const loadFiles = useCallback(async () => {
    const list = await window.electron.race.list(activeArchiveId);
    setItems((list ?? []) as any[]);
  }, [activeArchiveId]);

  const loadArchives = useCallback(async () => {
    try {
      const config = await window.electron.race.archives();
      setArchives(config.archives ?? fallbackArchives);
      setTargetArchiveId('default');
      setActiveArchiveId((prev) =>
        config.archives?.some((archive: RaceArchive) => archive.id === prev)
          ? prev
          : 'default',
      );
    } catch {
      setArchives(fallbackArchives);
      setTargetArchiveId('default');
    }
  }, []);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  useEffect(() => {
    loadUMDB()
      .then(() => setUmdbReady(true))
      .catch(() => setUmdbReady(false));
  }, []);

  useEffect(() => {
    loadFiles();
    const unsubscribe = window.electron.packetListener.onNew(() => {
      loadFiles();
    });
    return () => unsubscribe?.();
  }, [loadFiles]);

  useEffect(() => {
    setSelected(new Set());
    setShowArchiveTarget(false);
  }, [activeArchiveId]);

  const toggle = (filename: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(filename)) s.delete(filename);
      else s.add(filename);
      return s;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map((i) => i.filename));
    });
  };

  const deleteSelected = async () => {
    if (!confirm(`确定删除 ${selected.size} 条记录？`)) return;
    await window.electron.race.delete([...selected]);
    setItems((prev) => prev.filter((i) => !selected.has(i.filename)));
    setSelected(new Set());
  };

  const createArchive = async () => {
    const name = newArchiveName.trim();
    if (!name) return;
    try {
      const config = await window.electron.race.createArchive(name);
      setArchives(config.archives ?? fallbackArchives);
      const createdId = config.archives?.[config.archives.length - 1]?.id;
      setTargetArchiveId(createdId);
      setActiveArchiveId(createdId);
      setNewArchiveName('');
      setShowCreateArchive(false);
    } catch {
      alert('存档功能尚未在主进程注册，请重启应用后再试');
    }
  };

  const deleteArchive = async (archive: RaceArchive) => {
    if (archive.id === 'default') return;
    if (!confirm(`确定删除存档「${archive.name}」及其中所有比赛？`)) return;

    try {
      const config = await window.electron.race.deleteArchive(archive.id);
      setArchives(config.archives ?? fallbackArchives);
      setTargetArchiveId('default');
      setActiveArchiveId('default');
    } catch {
      alert('存档功能尚未在主进程注册，请重启应用后再试');
    }
  };

  const activateArchive = async (archiveId: string) => {
    setActiveArchiveId(archiveId);
    setTargetArchiveId(archiveId);
    setSelected(new Set());
  };

  const archiveSelected = async () => {
    if (selected.size === 0) return;
    try {
      await window.electron.race.assignArchive([...selected], targetArchiveId);
      await loadFiles();
      setSelected(new Set());
      setShowArchiveTarget(false);
    } catch {
      alert('存档功能尚未在主进程注册，请重启应用后再试');
    }
  };

  const enterRace = (item: RaceRecord) => {
    if (!item.scenario) {
      alert('无可解析的 scenario 数据');
      return;
    }
    navigate('/race', {
      state: {
        scenario: item.scenario,
        horseInfo: JSON.stringify(item.horses ?? {}),
        raceMetaInfo: item.raceMetaInfo,
        archiveId: activeArchiveId,
      },
    });
  };

  return (
    <RacePageLayout
      title="比赛记录"
      description="练习，自定义比赛，保存的比赛，星座杯比赛"
      icon={<Trophy size={20} />}
      actions={
        <>
          <button
            type="button"
            onClick={() =>
              navigate('/race-stats', {
                state: { archiveId: activeArchiveId },
              })
            }
            className={raceHeaderButtonClass}
          >
            <BarChart3 size={16} />
            统计
          </button>
          <button
            type="button"
            onClick={toggleAll}
            className={raceHeaderButtonClass}
          >
            {selected.size === items.length && items.length > 0 ? (
              <CheckSquare size={18} className="text-blue-600" />
            ) : (
              <Square size={18} />
            )}
            全选
          </button>

          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowArchiveTarget((prev) => !prev)}
                className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100"
              >
                归档所选 ({selected.size})
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 size={16} />
                删除 ({selected.size})
              </button>
            </>
          )}
        </>
      }
    >
      <div className="mb-4 border-b border-gray-200">
        <div className="flex flex-wrap items-end gap-2">
          {archives.map((archive) => (
            <div
              key={archive.id}
              className={`flex items-center gap-1 border-b-2 transition-colors ${
                activeArchiveId === archive.id
                  ? 'border-blue-600'
                  : 'border-transparent'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  activateArchive(archive.id);
                }}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  activeArchiveId === archive.id
                    ? 'text-blue-700'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {archive.name}
              </button>
              {archive.id !== 'default' && (
                <button
                  type="button"
                  onClick={() => deleteArchive(archive)}
                  className="p-1 text-gray-300 hover:text-red-600"
                  title="删除存档"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowCreateArchive((prev) => !prev)}
            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <Plus size={16} />
            新建
          </button>
        </div>
      </div>

      {showCreateArchive && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <input
            value={newArchiveName}
            onChange={(e) => setNewArchiveName(e.target.value)}
            placeholder="新存档名称"
            className="w-48 border border-gray-200 rounded-md bg-white px-2 py-1 text-gray-700 placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={createArchive}
            disabled={!newArchiveName.trim()}
            className="px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            创建
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateArchive(false);
              setNewArchiveName('');
            }}
            className="px-3 py-1.5 text-gray-500 hover:text-gray-800"
          >
            取消
          </button>
        </div>
      )}

      {showArchiveTarget && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>归档到</span>
          <select
            value={targetArchiveId}
            onChange={(e) => setTargetArchiveId(e.target.value)}
            className="border border-gray-200 rounded-md bg-white px-2 py-1 text-gray-700"
          >
            {archives.map((archive) => (
              <option key={archive.id} value={archive.id}>
                {archive.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={archiveSelected}
            className="px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            确认归档
          </button>
          <button
            type="button"
            onClick={() => setShowArchiveTarget(false)}
            className="px-2 py-1.5 text-gray-500 hover:text-gray-800"
          >
            取消
          </button>
        </div>
      )}

      {/* 列表 */}
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <Trophy size={48} className="text-gray-300 mb-4" />
            <div className="text-gray-400 font-medium">暂无比赛记录</div>
          </div>
        )}

        {items.map((item) => {
          const created = new Date(item.createdAt).toLocaleString();
          const isSelected = selected.has(item.filename);
          const finishOrderByFrameOrder = finishOrderMapByFilename.get(
            item.filename,
          );
          const topHorses = (item.horses ?? [])
            .map((horse, index) => ({
              horse: horse as Record<string, unknown>,
              rank: getHorseFinishRank(
                horse as Record<string, unknown>,
                finishOrderByFrameOrder,
                index,
              ),
            }))
            .sort((left, right) => left.rank - right.rank);

          return (
            <div
              key={item.filename}
              className={`group relative bg-white border rounded-xl p-1.5 flex items-start gap-3 transition-all duration-200 hover:shadow-md
                  ${isSelected ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-50/10' : 'border-gray-200'}
                `}
              onMouseLeave={() => setHoveredHorsePreview(null)}
            >
              {/* 勾选框 (绝对定位在右上角，稍微优化点击区域) */}
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(item.filename);
                }}
                className="absolute right-3 top-3 z-10 p-1 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity"
              >
                {isSelected ? (
                  <CheckSquare
                    className="text-blue-600 drop-shadow-sm"
                    size={20}
                  />
                ) : (
                  <Square
                    className="text-gray-400 hover:text-gray-600"
                    size={20}
                  />
                )}
              </div>

              {/* 左侧：漂亮的 MetaTag 卡片 */}
              <div
                className="shrink-0"
                role="button"
                tabIndex={0}
                onClick={() => enterRace(item)}
              >
                <RaceMetaTag meta={item.raceMetaInfo} />
              </div>

              {/* 右侧：剩余信息区域 */}
              <div className="flex-1 self-start py-2 flex flex-col justify-between pr-10">
                {/* 这里可以放备注、ID或者文件名等辅助信息 */}
                <div className="text-sm font-medium text-gray-400 font-mono truncate">
                  {item.filename}
                </div>

                {topHorses.length > 0 && (
                  <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                    <div className="flex max-h-[68px] flex-wrap gap-1.5 overflow-hidden">
                      {topHorses.map(({ horse, rank }) => (
                        <div
                          key={`${item.filename}-${rank}-${String(horse.viewer_id ?? '')}-${String(horse.card_id ?? '')}`}
                          className="group/horse relative flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-white/80 px-2 py-1"
                          onMouseEnter={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setHoveredHorsePreview({
                              horse,
                              iconPath: getHorseIconPath(horse),
                              left: rect.left,
                              top: rect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setHoveredHorsePreview(null)}
                        >
                          <div
                            className={`flex-none ${
                              rank <= 3 ? 'w-10' : 'w-8'
                            }`}
                          >
                            {getOrderIconPath(rank) ? (
                              <AssetIcon
                                path={getOrderIconPath(rank)!}
                                alt={`第${rank}名`}
                                className={`object-contain ${
                                  rank <= 3 ? 'h-5 w-10' : 'h-4 w-8'
                                }`}
                              />
                            ) : (
                              <div className="rounded bg-amber-100 px-1.5 py-0.5 text-center text-[10px] font-bold text-amber-700">
                                #{rank}
                              </div>
                            )}
                          </div>
                          <div className="h-6 w-6 flex-none overflow-hidden rounded-full bg-gray-100">
                            {getHorseIconPath(horse) ? (
                              <AssetIcon
                                path={getHorseIconPath(horse)!}
                                alt={umdbReady ? getHorseDisplayName(horse) : getHorseOwnerName(horse)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full rounded-full bg-gray-200" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-medium text-gray-800">
                              {getHorseOwnerName(horse)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 底部信息：时间 */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                    <Clock size={12} />
                    <span>创建时间：{created}</span>
                  </div>
                  <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    存档：
                    {archiveNameById.get(item.archiveId ?? 'default') ?? '默认'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hoveredHorsePreview && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: hoveredHorsePreview.left,
            top: hoveredHorsePreview.top,
            transform: 'translateY(-100%)',
          }}
        >
          <HorseHoverCard
            horse={hoveredHorsePreview.horse}
            iconPath={hoveredHorsePreview.iconPath}
          />
        </div>
      )}
    </RacePageLayout>
  );
}
