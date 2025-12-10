/* eslint-disable jsx-a11y/click-events-have-key-events */
import { useEffect, useState } from 'react';
import { Trash2, Square, CheckSquare, Trophy, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RaceRecord } from '../types/gameTypes';
import RaceMetaTag from '../components/RaceMetaTag';

export default function RaceList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RaceRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ... (保持原有的 loadFiles, toggle, toggleAll, deleteSelected 逻辑不变) ...
  // 为了简洁，这里省略了未修改的逻辑函数，请直接复制你原来代码中的逻辑部分
  // 只展示 return 部分的修改

  /** 加载比赛文件列表 */
  const loadFiles = async () => {
    const list = await window.electron.race.list();
    setItems((list ?? []) as any[]);
  };

  useEffect(() => {
    loadFiles();
    const unsubscribe = window.electron.packetListener.onNew(() => {
      loadFiles();
    });
    return () => unsubscribe?.();
  }, []);

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
            <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                <Trophy size={24} />
              </div>
              比赛记录
            </h1>
            <p className="text-gray-500 text-sm mt-1 ml-1">
              管理并回放已保存的比赛数据
            </p>
          </div>

          <div className="flex items-center gap-3">
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
              <button
                type="button"
                onClick={deleteSelected}
                className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-red-200"
              >
                <Trash2 size={16} />
                删除 ({selected.size})
              </button>
            )}
          </div>
        </div>

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
