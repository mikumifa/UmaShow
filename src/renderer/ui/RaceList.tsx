/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useCallback, useEffect, useState } from 'react';
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

const fallbackArchives: RaceArchive[] = [
  {
    id: 'default',
    name: '默认',
    createdAt: 0,
  },
];

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

  const archiveNameById = new Map(
    archives.map((archive) => [archive.id, archive.name]),
  );

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
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6 pb-4 border-b border-gray-200 flex justify-between items-end">
          <div>
            <p className="text-gray-500 text-sm mt-1 ml-1">
              练习，自定义比赛，保存的比赛，星座杯比赛
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate('/race-stats', {
                  state: { archiveId: activeArchiveId },
                })
              }
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <BarChart3 size={16} />
              统计
            </button>
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
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
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-blue-200"
                >
                  归档所选 ({selected.size})
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-red-200"
                >
                  <Trash2 size={16} />
                  删除 ({selected.size})
                </button>
              </>
            )}
          </div>
        </div>

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

            return (
              <div
                key={item.filename}
                className={`group relative bg-white border rounded-xl p-1.5 flex gap-4 transition-all duration-200 hover:shadow-md
                  ${isSelected ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-50/10' : 'border-gray-200'}
                `}
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
                <div className="flex-1 py-2 flex flex-col justify-between pr-10">
                  {/* 这里可以放备注、ID或者文件名等辅助信息 */}
                  <div className="text-sm font-medium text-gray-400 font-mono truncate">
                    {item.filename}
                  </div>

                  {/* 底部信息：时间 */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                      <Clock size={12} />
                      <span>创建时间：{created}</span>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                      存档：
                      {archiveNameById.get(item.archiveId ?? 'default') ??
                        '默认'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
