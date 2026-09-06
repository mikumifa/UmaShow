import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import type { Story } from 'umdb/UMDatabaseUtils';
import type { StoryDetail } from 'types/gameTypes';

type EventChoiceSelectorProps = {
  stories: Story[];
  fixedEventChoices: Record<string, number>;
  setFixedEventChoices: Dispatch<SetStateAction<Record<string, number>>>;
};

export default function EventChoiceSelector({
  stories,
  fixedEventChoices,
  setFixedEventChoices,
}: EventChoiceSelectorProps) {
  const [search, setSearch] = useState('');
  const [details, setDetails] = useState<
    Record<string, StoryDetail | null | undefined>
  >({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});

  const storyById = useMemo(
    () => new Map(stories.map((story) => [Number(story.id), story])),
    [stories],
  );
  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return stories
      .filter((story) => {
        const id = String(story.id);
        const name = String(story.name || '').toLocaleLowerCase();
        return id.includes(query) || name.includes(query);
      })
      .slice(0, 30);
  }, [search, stories]);

  const loadDetail = useCallback(
    async (storyId: number, force = false) => {
      const key = String(storyId);
      if (!force && details[key] !== undefined) return details[key] ?? null;
      setLoadingIds((current) => new Set(current).add(key));
      try {
        const detail = (await window.electron.utils.getStoryDetail(
          storyId,
        )) as StoryDetail | null;
        setDetails((current) => ({ ...current, [key]: detail }));
        return detail;
      } catch {
        setDetails((current) => ({ ...current, [key]: null }));
        return null;
      } finally {
        setLoadingIds((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
    },
    [details],
  );

  useEffect(() => {
    Object.keys(fixedEventChoices).forEach((storyId) => {
      if (details[storyId] === undefined && !loadingIds.has(storyId)) {
        loadDetail(Number(storyId))
          .then((detail) => {
            if (!detail) return null;
            if (!detail.optionList.length) {
              setFixedEventChoices((current) => {
                const next = { ...current };
                delete next[storyId];
                return next;
              });
              return detail;
            }
            setFixedEventChoices((current) => {
              const choice = current[storyId];
              if (choice >= 1 && choice <= detail.optionList.length) {
                return current;
              }
              return { ...current, [storyId]: 1 };
            });
            return detail;
          })
          .catch(() => null);
      }
    });
  }, [
    details,
    fixedEventChoices,
    loadDetail,
    loadingIds,
    setFixedEventChoices,
  ]);

  const addEvent = async (story: Story) => {
    const storyId = Number(story.id);
    const key = String(storyId);
    setMessages((current) => ({ ...current, [key]: '' }));
    const detail = await loadDetail(storyId, details[key] === null);
    if (!detail) {
      setMessages((current) => ({
        ...current,
        [key]: '读取选项失败，请稍后重试',
      }));
      return;
    }
    if (!detail.optionList.length) {
      setMessages((current) => ({
        ...current,
        [key]: '该事件没有可选择选项',
      }));
      return;
    }
    setFixedEventChoices((current) => ({ ...current, [key]: 1 }));
    setMessages((current) => ({ ...current, [key]: '' }));
  };

  const selectedEntries = Object.entries(fixedEventChoices).sort(
    ([left], [right]) => Number(left) - Number(right),
  );

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          3
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">事件固定选项</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            在线育成遇到已配置事件时固定选择指定项；未配置事件继续使用自动策略。
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索事件名称或 story ID"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {search.trim() ? (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          {searchResults.map((story) => {
            const key = String(story.id);
            const selected = fixedEventChoices[key] !== undefined;
            const loading = loadingIds.has(key);
            const hasNoChoices = messages[key] === '该事件没有可选择选项';
            let actionLabel = '添加';
            if (selected) actionLabel = '已添加';
            else if (loading) actionLabel = '读取中';
            else if (hasNoChoices) actionLabel = '无可选项';
            return (
              <div
                key={key}
                className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {story.name || `事件 ${story.id}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    story_id: {story.id}
                    {messages[key] ? ` · ${messages[key]}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={selected || loading || hasNoChoices}
                  onClick={() => addEvent(story)}
                  className="flex flex-none items-center gap-1 rounded-md border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:border-slate-200 disabled:text-slate-400"
                >
                  {loading ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <Plus size={13} />
                  )}
                  {actionLabel}
                </button>
              </div>
            );
          })}
          {!searchResults.length ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">
              没有找到匹配事件
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {selectedEntries.map(([storyId, choiceNumber]) => {
          const story = storyById.get(Number(storyId));
          const detail = details[storyId];
          const loading = loadingIds.has(storyId);
          let pendingChoiceLabel = `第 ${choiceNumber} 项`;
          if (loading) pendingChoiceLabel = '正在读取选项…';
          else if (detail === null) {
            pendingChoiceLabel = `第 ${choiceNumber} 项（详情读取失败）`;
          }
          return (
            <div
              key={storyId}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5"
            >
              <div className="min-w-[180px] flex-1">
                <p className="truncate text-sm font-medium text-slate-700">
                  {story?.name || `事件 ${storyId}`}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  story_id: {storyId}
                </p>
              </div>
              <select
                value={choiceNumber}
                disabled={loading || !detail?.optionList.length}
                onChange={(event) =>
                  setFixedEventChoices((current) => ({
                    ...current,
                    [storyId]: Number(event.target.value),
                  }))
                }
                className="min-w-[240px] max-w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 disabled:text-slate-400"
              >
                {detail?.optionList.length ? (
                  detail.optionList.map((option, index) => (
                    <option key={`${storyId}-${index + 1}`} value={index + 1}>
                      {`第 ${index + 1} 项：${option.option || '（无选项文本）'}`}
                    </option>
                  ))
                ) : (
                  <option value={choiceNumber}>{pendingChoiceLabel}</option>
                )}
              </select>
              <button
                type="button"
                title="移除此事件"
                onClick={() =>
                  setFixedEventChoices((current) => {
                    const next = { ...current };
                    delete next[storyId];
                    return next;
                  })
                }
                className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
        {!selectedEntries.length ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
            尚未添加固定事件选项
          </p>
        ) : null}
      </div>
    </section>
  );
}
