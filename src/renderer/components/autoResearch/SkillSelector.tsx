import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, Layers3, Search, X } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';

export type AutoResearchSkill = {
  id: number;
  name: string;
  rarity: number;
  group_id: number;
  grade_value: number;
  need_skill_point: number;
  disable_singlemode: number;
  tags: number[];
  icon_id: number;
  skill_category: number;
};

type EffectFilter = {
  id: string;
  label: string;
  iconId: number;
  matches: (skill: AutoResearchSkill) => boolean;
};

export function matchesSkillIconFamily(
  skill: AutoResearchSkill,
  representativeIconId: number,
) {
  return (
    skill.icon_id === representativeIconId ||
    skill.icon_id === representativeIconId + 1
  );
}

const EFFECT_FILTERS: EffectFilter[] = [
  {
    id: 'passive_speed',
    label: '被动·速度',
    iconId: 10011,
    matches: (skill) => matchesSkillIconFamily(skill, 10011),
  },
  {
    id: 'passive_stamina',
    label: '被动·耐力',
    iconId: 10021,
    matches: (skill) => matchesSkillIconFamily(skill, 10021),
  },
  {
    id: 'passive_power',
    label: '被动·力量',
    iconId: 10031,
    matches: (skill) => matchesSkillIconFamily(skill, 10031),
  },
  {
    id: 'passive_guts',
    label: '被动·毅力',
    iconId: 10041,
    matches: (skill) => matchesSkillIconFamily(skill, 10041),
  },
  {
    id: 'passive_wit',
    label: '被动·智力',
    iconId: 10051,
    matches: (skill) => matchesSkillIconFamily(skill, 10051),
  },
  {
    id: 'passive_all',
    label: '被动·综合',
    iconId: 10061,
    matches: (skill) => matchesSkillIconFamily(skill, 10061),
  },
  {
    id: 'speed',
    label: '速度',
    iconId: 20011,
    matches: (skill) => matchesSkillIconFamily(skill, 20011),
  },
  {
    id: 'recovery',
    label: '回复',
    iconId: 20021,
    matches: (skill) => matchesSkillIconFamily(skill, 20021),
  },
  {
    id: 'acceleration',
    label: '加速度',
    iconId: 20041,
    matches: (skill) => matchesSkillIconFamily(skill, 20041),
  },
  {
    id: 'position',
    label: '位置',
    iconId: 20051,
    matches: (skill) => matchesSkillIconFamily(skill, 20051),
  },
  {
    id: 'start',
    label: '起跑',
    iconId: 20061,
    matches: (skill) => matchesSkillIconFamily(skill, 20061),
  },
  {
    id: 'vision',
    label: '视野',
    iconId: 20091,
    matches: (skill) => matchesSkillIconFamily(skill, 20091),
  },
  {
    id: 'hindrance_speed',
    label: '妨碍·速度',
    iconId: 30011,
    matches: (skill) => matchesSkillIconFamily(skill, 30011),
  },
  {
    id: 'hindrance_stamina',
    label: '妨碍·耐力',
    iconId: 30021,
    matches: (skill) => matchesSkillIconFamily(skill, 30021),
  },
  {
    id: 'hindrance_acceleration',
    label: '妨碍·加速度',
    iconId: 30041,
    matches: (skill) => matchesSkillIconFamily(skill, 30041),
  },
  {
    id: 'hindrance_position',
    label: '妨碍·位置',
    iconId: 30051,
    matches: (skill) => matchesSkillIconFamily(skill, 30051),
  },
  {
    id: 'hindrance_vision',
    label: '妨碍·视野',
    iconId: 30071,
    matches: (skill) => matchesSkillIconFamily(skill, 30071),
  },
  {
    id: 'special',
    label: '特殊',
    iconId: 20101,
    matches: (skill) =>
      skill.icon_id >= 20000 &&
      skill.icon_id < 30000 &&
      ![20011, 20021, 20041, 20051, 20061, 20091].some((iconId) =>
        matchesSkillIconFamily(skill, iconId),
      ),
  },
];

const RUNNING_STYLE_FILTERS = [
  { id: 101, label: '领跑' },
  { id: 102, label: '前列' },
  { id: 103, label: '居中' },
  { id: 104, label: '后追' },
];

const DISTANCE_FILTERS = [
  { id: 201, label: '短距离' },
  { id: 202, label: '英里' },
  { id: 203, label: '中距离' },
  { id: 204, label: '长距离' },
];

export function skillRarityLabel(skill?: AutoResearchSkill) {
  if (!skill) return '未知';
  return skill.rarity === 2 ? '金' : '白';
}

export function skillIconPath(skill?: AutoResearchSkill) {
  if (!skill?.icon_id) return undefined;
  return `skill_icons/${skill.icon_id}.png`;
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN');
}

function skillEffectLabel(skill: AutoResearchSkill) {
  return (
    EFFECT_FILTERS.find((filter) => filter.matches(skill))?.label || '其他'
  );
}

function selectedTagLabels(
  skill: AutoResearchSkill,
  filters: Array<{ id: number; label: string }>,
) {
  return filters
    .filter((filter) => skill.tags.includes(filter.id))
    .map((filter) => filter.label);
}

export default function SkillSelector({
  open,
  title,
  description,
  skills,
  selectedNames,
  blockedNames = [],
  showRarityFilter = true,
  showSkillPoints = true,
  elevated = false,
  onToggle,
  onAddGroup,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  skills: AutoResearchSkill[];
  selectedNames: string[];
  blockedNames?: string[];
  showRarityFilter?: boolean;
  showSkillPoints?: boolean;
  elevated?: boolean;
  onToggle: (skill: AutoResearchSkill) => void;
  onAddGroup?: (skills: AutoResearchSkill[], label: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState<'all' | 'white' | 'gold'>('all');
  const [effectFilters, setEffectFilters] = useState<string[]>([]);
  const [runningStyleFilters, setRunningStyleFilters] = useState<number[]>([]);
  const [distanceFilters, setDistanceFilters] = useState<number[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    searchInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const blockedSet = useMemo(() => new Set(blockedNames), [blockedNames]);
  const filteredSkills = useMemo(() => {
    const keyword = normalizeSearch(search);
    return skills.filter((skill) => {
      if (rarity === 'white' && skill.rarity !== 1) return false;
      if (rarity === 'gold' && skill.rarity !== 2) return false;
      if (
        effectFilters.length &&
        !EFFECT_FILTERS.some(
          (filter) =>
            effectFilters.includes(filter.id) && filter.matches(skill),
        )
      ) {
        return false;
      }
      if (
        runningStyleFilters.length &&
        !runningStyleFilters.some((tag) => skill.tags.includes(tag))
      ) {
        return false;
      }
      if (
        distanceFilters.length &&
        !distanceFilters.some((tag) => skill.tags.includes(tag))
      ) {
        return false;
      }
      if (!keyword) return true;
      return (
        normalizeSearch(skill.name).includes(keyword) ||
        String(skill.id).includes(keyword)
      );
    });
  }, [
    distanceFilters,
    effectFilters,
    rarity,
    runningStyleFilters,
    search,
    skills,
  ]);

  const unselectedFilteredSkills = useMemo(
    () => filteredSkills.filter((skill) => !selectedSet.has(skill.name)),
    [filteredSkills, selectedSet],
  );

  const groupLabel = useMemo(() => {
    const labels: string[] = [];
    if (rarity === 'white') labels.push('白');
    if (rarity === 'gold') labels.push('金');
    labels.push(
      ...EFFECT_FILTERS.filter((filter) =>
        effectFilters.includes(filter.id),
      ).map((filter) => filter.label),
    );
    labels.push(
      ...RUNNING_STYLE_FILTERS.filter((filter) =>
        runningStyleFilters.includes(filter.id),
      ).map((filter) => filter.label),
    );
    labels.push(
      ...DISTANCE_FILTERS.filter((filter) =>
        distanceFilters.includes(filter.id),
      ).map((filter) => filter.label),
    );
    if (search.trim()) labels.push(`“${search.trim()}”`);
    return labels.length ? labels.join(' · ') : '全部技能';
  }, [distanceFilters, effectFilters, rarity, runningStyleFilters, search]);

  const toggleFilter = <T extends string | number>(
    value: T,
    setter: Dispatch<SetStateAction<T[]>>,
  ) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm ${elevated ? 'z-[1400]' : 'z-50'}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭技能选择"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={searchInputRef}
              aria-label="搜索技能名称或技能 ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索技能名称或技能 ID"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="mt-3 space-y-2.5">
            {showRarityFilter ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-10 flex-none text-xs font-medium text-slate-500">
                  稀有度
                </span>
                {[
                  ['all', '全部'],
                  ['white', '白'],
                  ['gold', '金'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRarity(value as typeof rarity)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      rarity === value
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 flex-none text-xs font-medium text-slate-500">
                效果
              </span>
              {EFFECT_FILTERS.map((filter) => {
                const active = effectFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleFilter(filter.id, setEffectFilters)}
                    className={`flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2.5 text-xs font-medium ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="h-5 w-5 overflow-hidden rounded-full bg-slate-100">
                      <AssetIcon
                        path={`skill_icons/${filter.iconId}.png`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </span>
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 flex-none text-xs font-medium text-slate-500">
                跑法
              </span>
              {RUNNING_STYLE_FILTERS.map((filter) => {
                const active = runningStyleFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      toggleFilter(filter.id, setRunningStyleFilters)
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-10 flex-none text-xs font-medium text-slate-500">
                距离
              </span>
              {DISTANCE_FILTERS.map((filter) => {
                const active = distanceFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleFilter(filter.id, setDistanceFilters)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              {(effectFilters.length ||
                runningStyleFilters.length ||
                distanceFilters.length ||
                rarity !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setRarity('all');
                    setEffectFilters([]);
                    setRunningStyleFilters([]);
                    setDistanceFilters([]);
                  }}
                  className="ml-auto rounded-full px-3 py-1 text-xs text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((skill) => {
              const selected = selectedSet.has(skill.name);
              const blocked = blockedSet.has(skill.name) && !selected;
              const iconPath = skillIconPath(skill);
              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => onToggle(skill)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                  }`}
                >
                  <span
                    className={`h-11 w-11 flex-none overflow-hidden rounded-lg border ${
                      skill.rarity === 2
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {iconPath ? (
                      <AssetIcon
                        path={iconPath}
                        alt={skill.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {skill.name}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
                      <span
                        className={
                          skill.rarity === 2
                            ? 'font-semibold text-amber-700'
                            : ''
                        }
                      >
                        {skillRarityLabel(skill)}
                      </span>
                      {showSkillPoints ? (
                        <span>{skill.need_skill_point} 技能点</span>
                      ) : null}
                      <span>{skillEffectLabel(skill)}</span>
                      {selectedTagLabels(skill, RUNNING_STYLE_FILTERS).map(
                        (label) => (
                          <span key={label}>{label}</span>
                        ),
                      )}
                      {selectedTagLabels(skill, DISTANCE_FILTERS).map(
                        (label) => (
                          <span key={label}>{label}</span>
                        ),
                      )}
                    </span>
                  </span>
                  {selected ? (
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-white">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {!filteredSkills.length ? (
            <div className="py-16 text-center text-sm text-slate-400">
              没有找到符合条件的技能
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 text-xs text-slate-500">
          <span>
            已选择 {selectedNames.length} 个 · 当前显示 {filteredSkills.length}{' '}
            个
          </span>
          <div className="flex items-center gap-2">
            {onAddGroup ? (
              <button
                type="button"
                disabled={!unselectedFilteredSkills.length}
                onClick={() => {
                  onAddGroup(unselectedFilteredSkills, groupLabel);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Layers3 size={15} />
                作为技能组加入（{unselectedFilteredSkills.length}）
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
