import { Dispatch, SetStateAction, useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  PlannerButton,
  PlannerSkillCard,
} from 'renderer/components/succession/PlannerComponents';
import { SuccessionPickerDialog } from 'renderer/components/succession/SuccessionPicker';

export type AutoResearchSkill = {
  id: number;
  name: string;
  rarity: number;
  group_id: number;
  grade_value: number;
  disp_order?: number;
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

export function isInheritedUniqueSkill(skill: AutoResearchSkill) {
  return skill.skill_category === 5 && skill.rarity === 1;
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
    iconId: 30051,
    matches: (skill) => matchesSkillIconFamily(skill, 30051),
  },
  {
    id: 'hindrance_acceleration',
    label: '妨碍·加速度',
    iconId: 30021,
    matches: (skill) => matchesSkillIconFamily(skill, 30021),
  },
  {
    id: 'hindrance_temptation',
    label: '妨碍·失控',
    iconId: 30041,
    matches: (skill) => matchesSkillIconFamily(skill, 30041),
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

type SkillTagFilter = {
  id: number;
  label: string;
  groupLabel?: string;
};

const GENERAL_TAG_FILTER_ID = 0;

const RUNNING_STYLE_FILTERS: SkillTagFilter[] = [
  { id: GENERAL_TAG_FILTER_ID, label: '通用', groupLabel: '跑法通用' },
  { id: 101, label: '领跑' },
  { id: 102, label: '前列' },
  { id: 103, label: '居中' },
  { id: 104, label: '后追' },
];

const DISTANCE_FILTERS: SkillTagFilter[] = [
  { id: GENERAL_TAG_FILTER_ID, label: '通用', groupLabel: '距离通用' },
  { id: 201, label: '短距离' },
  { id: 202, label: '英里' },
  { id: 203, label: '中距离' },
  { id: 204, label: '长距离' },
];

const RUNNING_STYLE_TAG_IDS = RUNNING_STYLE_FILTERS.filter(
  (filter) => filter.id !== GENERAL_TAG_FILTER_ID,
).map((filter) => filter.id);
const DISTANCE_TAG_IDS = DISTANCE_FILTERS.filter(
  (filter) => filter.id !== GENERAL_TAG_FILTER_ID,
).map((filter) => filter.id);

export function matchesSkillTagFilters(
  skill: AutoResearchSkill,
  selectedFilters: number[],
  categoryTagIds: number[],
) {
  if (!selectedFilters.length) return true;
  const isGeneral = !categoryTagIds.some((tag) => skill.tags.includes(tag));
  return selectedFilters.some((tag) =>
    tag === GENERAL_TAG_FILTER_ID ? isGeneral : skill.tags.includes(tag),
  );
}

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

export function skillEffectFilterId(skill: AutoResearchSkill) {
  return EFFECT_FILTERS.find((filter) => filter.matches(skill))?.id || 'other';
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
  const [skillKind, setSkillKind] = useState<'all' | 'unique' | 'normal'>(
    'all',
  );
  const [rarity, setRarity] = useState<'all' | 'white' | 'gold'>('all');
  const [effectFilters, setEffectFilters] = useState<string[]>([]);
  const [runningStyleFilters, setRunningStyleFilters] = useState<number[]>([]);
  const [distanceFilters, setDistanceFilters] = useState<number[]>([]);

  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const blockedSet = useMemo(() => new Set(blockedNames), [blockedNames]);
  const filteredSkills = useMemo(() => {
    const keyword = normalizeSearch(search);
    return skills.filter((skill) => {
      const inheritedUnique = isInheritedUniqueSkill(skill);
      if (skillKind === 'unique' && !inheritedUnique) return false;
      if (skillKind === 'normal' && inheritedUnique) return false;
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
        !matchesSkillTagFilters(
          skill,
          runningStyleFilters,
          RUNNING_STYLE_TAG_IDS,
        )
      ) {
        return false;
      }
      if (!matchesSkillTagFilters(skill, distanceFilters, DISTANCE_TAG_IDS)) {
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
    skillKind,
    skills,
  ]);

  const unselectedFilteredSkills = useMemo(
    () => filteredSkills.filter((skill) => !selectedSet.has(skill.name)),
    [filteredSkills, selectedSet],
  );

  const groupLabel = useMemo(() => {
    const labels: string[] = [];
    if (skillKind === 'unique') labels.push('固有');
    if (skillKind === 'normal') labels.push('普通');
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
      ).map((filter) => filter.groupLabel || filter.label),
    );
    labels.push(
      ...DISTANCE_FILTERS.filter((filter) =>
        distanceFilters.includes(filter.id),
      ).map((filter) => filter.groupLabel || filter.label),
    );
    if (search.trim()) labels.push(`“${search.trim()}”`);
    return labels.length ? labels.join(' · ') : '全部技能';
  }, [
    distanceFilters,
    effectFilters,
    rarity,
    runningStyleFilters,
    search,
    skillKind,
  ]);

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
    <SuccessionPickerDialog
      ariaLabel={title}
      title={title}
      description={description}
      onClose={onClose}
      hideHeader
      overlayClassName={elevated ? 'plannerElevatedOverlay' : undefined}
      dialogClassName="plannerSkillDialog"
      searchValue={search}
      searchPlaceholder="搜索技能名称或技能 ID"
      searchAriaLabel="搜索技能名称或技能 ID"
      onSearchChange={setSearch}
      footer={
        <>
          <span>选择顺序会保留在当前配置中</span>
          <div className="plannerSkillFooterActions">
            {onAddGroup ? (
              <PlannerButton
                variant="secondary"
                disabled={!unselectedFilteredSkills.length}
                onClick={() => {
                  onAddGroup(unselectedFilteredSkills, groupLabel);
                  onClose();
                }}
              >
                <Layers3 size={15} />
                作为技能组加入（{unselectedFilteredSkills.length}）
              </PlannerButton>
            ) : null}
            <PlannerButton variant="primary" onClick={onClose}>
              完成
            </PlannerButton>
          </div>
        </>
      }
    >
      <div className="plannerSkillFilters">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-10 flex-none text-xs font-medium text-slate-500">
              类型
            </span>
            {[
              ['all', '全部'],
              ['unique', '固有'],
              ['normal', '普通'],
            ].map(([value, label]) => (
              <PlannerButton
                key={value}
                variant="filter"
                size="small"
                active={skillKind === value}
                onClick={() => setSkillKind(value as typeof skillKind)}
              >
                {label}
              </PlannerButton>
            ))}
          </div>
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
                <PlannerButton
                  key={value}
                  variant="filter"
                  size="small"
                  active={rarity === value}
                  onClick={() => setRarity(value as typeof rarity)}
                >
                  {label}
                </PlannerButton>
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
                <PlannerButton
                  key={filter.id}
                  variant="filter"
                  size="small"
                  active={active}
                  aria-pressed={active}
                  onClick={() => toggleFilter(filter.id, setEffectFilters)}
                >
                  <span className="h-5 w-5 overflow-hidden rounded-full bg-slate-100">
                    <AssetIcon
                      path={`skill_icons/${filter.iconId}.png`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  {filter.label}
                </PlannerButton>
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
                <PlannerButton
                  key={filter.id}
                  variant="filter"
                  size="small"
                  active={active}
                  aria-pressed={active}
                  onClick={() =>
                    toggleFilter(filter.id, setRunningStyleFilters)
                  }
                >
                  {filter.label}
                </PlannerButton>
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
                <PlannerButton
                  key={filter.id}
                  variant="filter"
                  size="small"
                  active={active}
                  aria-pressed={active}
                  onClick={() => toggleFilter(filter.id, setDistanceFilters)}
                >
                  {filter.label}
                </PlannerButton>
              );
            })}
            {(effectFilters.length ||
              runningStyleFilters.length ||
              distanceFilters.length ||
              skillKind !== 'all' ||
              rarity !== 'all') && (
              <PlannerButton
                variant="ghost"
                size="small"
                onClick={() => {
                  setSkillKind('all');
                  setRarity('all');
                  setEffectFilters([]);
                  setRunningStyleFilters([]);
                  setDistanceFilters([]);
                }}
                className="ml-auto"
              >
                清除筛选
              </PlannerButton>
            )}
          </div>
        </div>
      </div>

      <div className="plannerSkillGridBody">
        <div className="plannerSkillGrid">
          {filteredSkills.map((skill) => {
            const selected = selectedSet.has(skill.name);
            const blocked = blockedSet.has(skill.name) && !selected;
            const iconPath = skillIconPath(skill);
            return (
              <PlannerSkillCard
                key={skill.id}
                disabled={blocked}
                selected={selected}
                iconPath={iconPath}
                name={skill.name}
                rarity={skill.rarity}
                meta={
                  <>
                    <span
                      className={
                        skill.rarity === 2 ? 'font-semibold text-amber-700' : ''
                      }
                    >
                      {skillRarityLabel(skill)}
                    </span>
                    {isInheritedUniqueSkill(skill) ? (
                      <span className="font-semibold text-violet-700">
                        继承固有
                      </span>
                    ) : null}
                    {showSkillPoints ? (
                      <span>{skill.need_skill_point} 技能点</span>
                    ) : null}
                    <span>{skillEffectLabel(skill)}</span>
                    {selectedTagLabels(skill, RUNNING_STYLE_FILTERS).map(
                      (label) => (
                        <span key={label}>{label}</span>
                      ),
                    )}
                    {selectedTagLabels(skill, DISTANCE_FILTERS).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </>
                }
                onClick={() => onToggle(skill)}
              />
            );
          })}
        </div>
        {!filteredSkills.length ? (
          <div className="py-16 text-center text-sm text-slate-400">
            没有找到符合条件的技能
          </div>
        ) : null}
      </div>
    </SuccessionPickerDialog>
  );
}
