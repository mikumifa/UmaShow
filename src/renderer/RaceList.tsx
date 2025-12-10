/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/button-has-type */
import React, { useEffect, useState } from 'react';
import { Trash2, Square, CheckSquare, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// eslint-disable-next-line react/prop-types
function RaceNameTag({ type, name }) {
  const colorMap = {
    1: 'bg-green-100 text-green-800 border-green-200',
    2: 'bg-red-100 text-red-800 border-red-200',
    3: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 font-bold text-lg w-40 text-center ${colorMap[type] || colorMap[3]}`}
    >
      {name}
    </div>
  );
}

export default function RaceList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const loadFiles = async () => {
    const list = await window.electron.race.list();
    setItems(list);
  };

  useEffect(() => {
    loadFiles();

    const unsubscribe = window.electron.packetListener.onNew(() => {
      loadFiles();
    });
    return () => {
      unsubscribe?.(); // 清理
    };
  }, []);

  const toggle = (filename: any) => {
    const s = new Set(selected);
    s.has(filename) ? s.delete(filename) : s.add(filename);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.filename)));
    }
  };

  const deleteSelected = async () => {
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!confirm(`确定删除 ${selected.size} 条记录？`)) return;
    await window.electron.race.delete([...selected]);
    setItems(items.filter((i) => !selected.has(i.filename)));
    setSelected(new Set());
  };
  const enterRace = (item: never) => {
    // eslint-disable-next-line no-alert
    if (!item.scenario) {
      // eslint-disable-next-line no-alert
      alert('无可解析的 scenario 数据');
      return;
    }

    navigate('/race', {
      state: {
        scenario: item.scenario, // Base64 字符串
        horseInfo: JSON.stringify(item.horses ?? {}), // Horses JSON序列化
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* 标题栏 */}
        <div className="mb-6 pb-2 border-b flex justify-between items-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy size={20} className="text-gray-500" />
            比赛记录
          </h1>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1 text-sm"
            >
              {selected.size === items.length ? <CheckSquare /> : <Square />}
              全选
            </button>

            {selected.size > 0 && (
              <button
                onClick={deleteSelected}
                className="flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1 rounded-full"
              >
                <Trash2 size={16} />
                删除 ({selected.size})
              </button>
            )}
          </div>
        </div>

        {/* 列表 */}
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="text-gray-400 text-center py-10">暂无比赛记录</div>
          )}

          {items.map((item) => {
            const name = item.raceName ?? '未知';
            const raceResult = item.raceResult ?? {};
            const type = 3; // 暂无 raceType 信息，统一蓝色
            const count =
              raceResult.current_entry_num ?? item.horses?.length ?? 0;

            const created = new Date(item.createdAt).toLocaleString();
            return (
              <div
                key={item.filename}
                onClick={() => enterRace(item)}
                className="relative bg-white border rounded-lg p-4 hover:shadow cursor-pointer flex gap-4"
              >
                {/* 选择框 */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(item.filename);
                  }}
                  className="absolute right-4 top-4 cursor-pointer"
                >
                  {selected.has(item.filename) ? (
                    <CheckSquare className="text-blue-600" />
                  ) : (
                    <Square className="text-gray-300" />
                  )}
                </div>

                {/* 比赛名标签 */}
                <RaceNameTag type={type} name={name} />

                {/* 信息区域 */}
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-2">
                    创建时间：{created}
                  </div>

                  <div className="flex gap-4 text-sm">
                    <span className="font-bold">参赛人数：</span>
                    {count}
                  </div>

                  {raceResult.start_time && (
                    <div className="flex gap-4 text-sm mt-1">
                      <span className="font-bold">开始时间：</span>
                      {raceResult.start_time}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
