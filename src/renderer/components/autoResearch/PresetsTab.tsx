/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { Dispatch, SetStateAction } from 'react';
import {
  Check,
  Download,
  GripVertical,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { AutoResearchSkill, skillIconPath } from './SkillSelector';
import {
  DEFAULT_PRESET_NAME,
  MONTH_OPTIONS,
  panelClass,
  scrollToSection,
  skillPurchaseTurn,
  skillPurchaseTurnLabel,
  SKILL_PURCHASE_YEAR_OPTIONS,
  STAT_LABELS,
} from './shared';
import {
  AutoResearchTab,
  CareerSetting,
  Preset,
  RaceOption,
  SkillLearningSetting,
  SkillSelectionEntry,
} from './types';

type PresetsTabProps = {
  presetEditorOpen: boolean;
  presets: Preset[];
  presetName: string;
  newPresetName: string;
  setNewPresetName: Dispatch<SetStateAction<string>>;
  createPresetSlot: () => void;
  openPresetEditor: (name: string) => void;
  renamePreset: (name: string, nextName: string) => boolean;
  careerSettings: CareerSetting[];
  exportPreset: (preset: Preset) => void;
  deletePreset: (name: string) => void;
  importPreset: (file: File) => Promise<void>;
  setPresetEditorOpen: Dispatch<SetStateAction<boolean>>;
  navigateToTab: (tab: AutoResearchTab, target?: string) => void;
  savePreset: () => Promise<boolean>;
  busy: string;
  presetSaved: boolean;
  savePresetAndContinue: () => Promise<void>;
  runningStyle: number;
  setRunningStyle: Dispatch<SetStateAction<number>>;
  skillSelections: SkillSelectionEntry[];
  draggedPrioritySkill: string;
  setDraggedPrioritySkill: Dispatch<SetStateAction<string>>;
  reorderPrioritySkill: (sourceId: string, targetId: string) => void;
  setEditingSkillSelectionId: Dispatch<SetStateAction<string>>;
  setSkillSettingYearOffset: Dispatch<SetStateAction<number>>;
  setSkillPickerOpen: Dispatch<SetStateAction<boolean>>;
  skillByName: Map<string, AutoResearchSkill>;
  skillLearningConditionLabel: (entry: SkillSelectionEntry) => string;
  setSkillSelections: Dispatch<SetStateAction<SkillSelectionEntry[]>>;
  skillThreshold: number;
  setSkillThreshold: Dispatch<SetStateAction<number>>;
  skipDoubleCircle: boolean;
  setSkipDoubleCircle: Dispatch<SetStateAction<boolean>>;
  maximizeSkillScoreAtEnd: boolean;
  setMaximizeSkillScoreAtEnd: Dispatch<SetStateAction<boolean>>;
  skillPurchaseYearOffset: number;
  setSkillPurchaseYearOffset: Dispatch<SetStateAction<number>>;
  skillPurchaseTurns: number[];
  setSkillPurchaseTurns: Dispatch<SetStateAction<number[]>>;
  editingSkillSelectionId: string;
  setSkillLearningSettings: Dispatch<
    SetStateAction<Record<string, SkillLearningSetting>>
  >;
  health: any;
  uraAiTargetAttributes: number[];
  setUraAiTargetAttributes: Dispatch<SetStateAction<number[]>>;
  uraAiTimeBudget: number;
  setUraAiTimeBudget: Dispatch<SetStateAction<number>>;
  uraAiMinRollouts: number;
  setUraAiMinRollouts: Dispatch<SetStateAction<number>>;
  uraAiMaxRollouts: number;
  setUraAiMaxRollouts: Dispatch<SetStateAction<number>>;
  uraAiWorkers: number;
  setUraAiWorkers: Dispatch<SetStateAction<number>>;
  uraAiRiskFactor: number;
  setUraAiRiskFactor: Dispatch<SetStateAction<number>>;
  raceSearch: string;
  setRaceSearch: Dispatch<SetStateAction<string>>;
  filteredRaces: RaceOption[];
  selectedRaceIds: number[];
  setSelectedRaceIds: Dispatch<SetStateAction<number[]>>;
};

export default function PresetsTab(props: PresetsTabProps) {
  const {
    presetEditorOpen,
    presets,
    presetName,
    newPresetName,
    setNewPresetName,
    createPresetSlot,
    openPresetEditor,
    renamePreset,
    careerSettings,
    exportPreset,
    deletePreset,
    importPreset,
    setPresetEditorOpen,
    navigateToTab,
    savePreset,
    busy,
    presetSaved,
    savePresetAndContinue,
    runningStyle,
    setRunningStyle,
    skillSelections,
    draggedPrioritySkill,
    setDraggedPrioritySkill,
    reorderPrioritySkill,
    setEditingSkillSelectionId,
    setSkillSettingYearOffset,
    setSkillPickerOpen,
    skillByName,
    skillLearningConditionLabel,
    setSkillSelections,
    skillThreshold,
    setSkillThreshold,
    skipDoubleCircle,
    setSkipDoubleCircle,
    maximizeSkillScoreAtEnd,
    setMaximizeSkillScoreAtEnd,
    skillPurchaseYearOffset,
    setSkillPurchaseYearOffset,
    skillPurchaseTurns,
    setSkillPurchaseTurns,
    editingSkillSelectionId,
    setSkillLearningSettings,
    health,
    uraAiTargetAttributes,
    setUraAiTargetAttributes,
    uraAiTimeBudget,
    setUraAiTimeBudget,
    uraAiMinRollouts,
    setUraAiMinRollouts,
    uraAiMaxRollouts,
    setUraAiMaxRollouts,
    uraAiWorkers,
    setUraAiWorkers,
    uraAiRiskFactor,
    setUraAiRiskFactor,
    raceSearch,
    setRaceSearch,
    filteredRaces,
    selectedRaceIds,
    setSelectedRaceIds,
  } = props;
  return !presetEditorOpen ? (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Settings2 size={19} className="text-indigo-600" />
            选择预设槽位
          </h2>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Upload size={15} />
          导入预设
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPreset(file);
              event.target.value = '';
            }}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => {
          const isDefault = preset.name === DEFAULT_PRESET_NAME;
          const referencedCount = careerSettings.filter(
            (setting) => setting.preset_name === preset.name,
          ).length;
          const skillCount = (preset.learn_skill_list || []).flat().length;
          return (
            <article
              key={preset.name}
              className="rounded-lg border border-gray-200 bg-gray-50/60 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Settings2 size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  {isDefault ? (
                    <div>
                      <p className="truncate font-semibold text-gray-800">
                        {preset.name}
                      </p>
                      <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                        默认预设
                      </span>
                    </div>
                  ) : (
                    <label className="block text-xs text-gray-500">
                      预设名称
                      <input
                        key={preset.name}
                        defaultValue={preset.name}
                        onBlur={(event) => {
                          if (!renamePreset(preset.name, event.target.value)) {
                            event.currentTarget.value = preset.name;
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-800"
                      />
                    </label>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    URA · 手写策略 + 蒙特卡洛 · {skillCount} 个优先技能 ·{' '}
                    {(preset.extra_race_list || []).length} 场额外赛事
                  </p>
                  {referencedCount ? (
                    <p className="mt-1 text-xs text-slate-400">
                      被 {referencedCount} 个养马详设使用
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openPresetEditor(preset.name)}
                  className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  进入预设
                </button>
                <button
                  type="button"
                  onClick={() => exportPreset(preset)}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-600 hover:bg-gray-50"
                  aria-label={`导出预设${preset.name}`}
                  title="导出预设"
                >
                  <Download size={15} />
                </button>
                {!isDefault ? (
                  <button
                    type="button"
                    onClick={() => deletePreset(preset.name)}
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    aria-label={`删除预设${preset.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        <article className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4">
          <h3 className="font-semibold text-indigo-950">新建预设槽位</h3>
          <p className="mt-1 text-xs text-indigo-700">
            新预设会使用默认配置，进入后再调整技能、训练和赛事策略。
          </p>
          <input
            value={newPresetName}
            onChange={(event) => setNewPresetName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && createPresetSlot()}
            placeholder={`例如：URA 预设 ${presets.length}`}
            className="mt-4 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createPresetSlot}
            className="mt-2 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <Plus size={15} className="mr-1 inline" />
            新建并进入
          </button>
        </article>
      </div>
    </section>
  ) : (
    <>
      <nav className="sticky top-[52px] z-20 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        {[
          ['preset-basic', '基础设置'],
          ['preset-skills', '技能设置'],
          ['preset-training', '养成决策'],
          ['preset-races', '额外赛事'],
        ].map(([target, label]) => (
          <button
            key={target}
            type="button"
            onClick={() => scrollToSection(target)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {label}
          </button>
        ))}
      </nav>
      <section
        id="preset-basic"
        className={`${panelClass('p-5')} scroll-mt-28`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">预设编辑 · {presetName}</h2>
            <p className="text-sm text-slate-400">
              技能和赛事数据来自当前 master.mdb。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPresetEditorOpen(false)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              返回预设槽位
            </button>
            <button
              type="button"
              onClick={savePreset}
              disabled={busy === 'preset'}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                presetSaved
                  ? 'bg-emerald-600 hover:bg-emerald-600'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {presetSaved ? <Check size={15} /> : <Save size={15} />}
              {busy === 'preset'
                ? '保存中…'
                : presetSaved
                  ? '已保存'
                  : '保存预设'}
            </button>
            <button
              type="button"
              onClick={savePresetAndContinue}
              disabled={busy === 'preset'}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              保存并前往养马详设 →
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          预设的改名和删除只能在预设槽位界面操作。
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            跑法
            <select
              value={runningStyle}
              onChange={(event) => setRunningStyle(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value={0}>默认（使用游戏当前跑法）</option>
              <option value={1}>逃</option>
              <option value={2}>先行</option>
              <option value={3}>差</option>
              <option value={4}>追</option>
            </select>
          </label>
          <label className="text-sm">
            学技能最低技能点
            <input
              type="number"
              value={skillThreshold}
              onChange={(event) =>
                setSkillThreshold(Number(event.target.value))
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div id="preset-skills" className="mt-4 scroll-mt-28">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800">育成中技能选择</p>
                <p className="mt-1 text-xs text-slate-500">
                  只会学习这里选择的技能；越靠上越优先，可拖动调整顺序。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSkillPickerOpen(true)}
                className="flex flex-none items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={14} />
                添加技能
              </button>
            </div>
            <div className="grid max-h-[260px] min-h-[104px] auto-rows-max content-start gap-2 overflow-y-auto bg-slate-50/60 p-3 2xl:grid-cols-2">
              {skillSelections.map((entry, index) => {
                const isGroup = entry.skill_names.length > 1;
                const primaryName = entry.skill_names[0];
                const skill = skillByName.get(primaryName);
                return (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggedPrioritySkill(entry.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', entry.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      reorderPrioritySkill(
                        event.dataTransfer.getData('text/plain') ||
                          draggedPrioritySkill,
                        entry.id,
                      );
                      setDraggedPrioritySkill('');
                    }}
                    onDragEnd={() => setDraggedPrioritySkill('')}
                    className={`flex cursor-grab items-center gap-2 rounded-lg border bg-white p-1.5 shadow-sm active:cursor-grabbing ${
                      draggedPrioritySkill === entry.id
                        ? 'border-indigo-300 opacity-45'
                        : 'border-slate-200'
                    }`}
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                      {index + 1}
                    </span>
                    <span className="relative h-9 w-12 flex-none">
                      {entry.skill_names
                        .slice(0, isGroup ? 3 : 1)
                        .map((name, iconIndex) => {
                          const memberSkill = skillByName.get(name);
                          const memberIconPath = skillIconPath(memberSkill);
                          return (
                            <span
                              key={name}
                              className="absolute top-0 h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm"
                              style={{
                                left: `${iconIndex * 7}px`,
                                zIndex: 3 - iconIndex,
                              }}
                            >
                              {memberSkill && memberIconPath ? (
                                <AssetIcon
                                  path={memberIconPath}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                                  ?
                                </span>
                              )}
                            </span>
                          );
                        })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-800">
                        {isGroup ? entry.label || '技能组' : primaryName}
                      </span>
                      <span
                        className="mt-0.5 block truncate text-xs text-slate-500"
                        title={`${entry.skill_names.join('、')} · ${skillLearningConditionLabel(entry)}`}
                      >
                        {isGroup
                          ? `包含 ${entry.skill_names.length} 个技能 · ${skillLearningConditionLabel(entry)}`
                          : skill
                            ? skillLearningConditionLabel(entry)
                            : '当前技能数据中未找到'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSkillSettingYearOffset(0);
                        setEditingSkillSelectionId(entry.id);
                      }}
                      title="设置学习条件"
                      className="flex flex-none items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      <Settings2 size={13} />
                      设置
                    </button>
                    <GripVertical
                      size={18}
                      className="flex-none text-slate-300"
                      aria-label="拖动调整顺序"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSkillSelections((current) =>
                          current.filter(
                            (currentEntry) => currentEntry.id !== entry.id,
                          ),
                        );
                        setSkillLearningSettings((current) => {
                          const next = { ...current };
                          entry.skill_names.forEach(
                            (name) => delete next[name],
                          );
                          return next;
                        });
                        if (editingSkillSelectionId === entry.id) {
                          setEditingSkillSelectionId('');
                        }
                      }}
                      title="移除技能"
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
              {!skillSelections.length ? (
                <button
                  type="button"
                  onClick={() => setSkillPickerOpen(true)}
                  className="flex min-h-[80px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600 2xl:col-span-2"
                >
                  <Plus size={16} className="mr-1" />
                  添加育成中学习的技能
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={skipDoubleCircle}
                onChange={(event) => setSkipDoubleCircle(event.target.checked)}
                className="mt-1"
              />
              <span>
                <strong className="block font-medium text-slate-800">
                  技能 Hit 等级不足 4 时跳过 ◎ 技能
                </strong>
                <span className="mt-0.5 block text-xs text-slate-500">
                  避免过早购买折扣不足的双圈技能
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={maximizeSkillScoreAtEnd}
                onChange={(event) =>
                  setMaximizeSkillScoreAtEnd(event.target.checked)
                }
                className="mt-1"
              />
              <span>
                <strong className="block font-medium text-slate-800">
                  结束时用剩余技能点最大化评价分
                </strong>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  先学习上方指定的技能，再用背包优化选择其余可学技能；优先让评价分最高，同分时尽量用完技能点。
                </span>
              </span>
            </label>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  统一购买技能时间
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  育成中到达选中日期时统一检查所选技能；不选择则只在育成结束前检查
                </p>
              </div>
              {skillPurchaseTurns.length ? (
                <button
                  type="button"
                  onClick={() => setSkillPurchaseTurns([])}
                  className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                >
                  清空
                </button>
              ) : null}
            </div>
            <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
              {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
                <button
                  key={year.offset}
                  type="button"
                  onClick={() => setSkillPurchaseYearOffset(year.offset)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    skillPurchaseYearOffset === year.offset
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {year.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 2xl:grid-cols-6">
              {MONTH_OPTIONS.map((month) => (
                <div
                  key={month}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                >
                  <p className="mb-1 text-center text-[11px] font-medium text-slate-500">
                    {month}月
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {([1, 2] as const).map((half) => {
                      const turn = skillPurchaseTurn(
                        skillPurchaseYearOffset,
                        month,
                        half,
                      );
                      const selected = skillPurchaseTurns.includes(turn);
                      return (
                        <button
                          key={half}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setSkillPurchaseTurns((current) =>
                              current.includes(turn)
                                ? current.filter((value) => value !== turn)
                                : [...current, turn].sort(
                                    (left, right) => left - right,
                                  ),
                            )
                          }
                          className={`rounded px-1 py-1 text-[11px] font-medium ${
                            selected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {half === 1 ? '上' : '下'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
              {skillPurchaseTurns.map((turn) => (
                <button
                  key={turn}
                  type="button"
                  onClick={() =>
                    setSkillPurchaseTurns((current) =>
                      current.filter((value) => value !== turn),
                    )
                  }
                  title="点击移除"
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  {skillPurchaseTurnLabel(turn)} ×
                </button>
              ))}
              {!skillPurchaseTurns.length ? (
                <span className="py-1 text-xs text-slate-400">
                  尚未设置额外购买时间
                </span>
              ) : null}
            </div>
          </section>
        </div>

        <section
          id="preset-training"
          className="mt-4 scroll-mt-28 rounded-xl border border-violet-200 bg-violet-50/50 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-violet-950">
                手写策略 + 蒙特卡洛
              </h3>
              <p className="mt-1 text-xs leading-5 text-violet-700">
                手写策略负责模拟后续育成，蒙特卡洛比较当前合法动作。
              </p>
            </div>
            <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-700">
              {health?.umarl?.installed
                ? `UmaRL ${health.umarl.version || '-'}`
                : '未安装 UmaRL'}
            </span>
          </div>

          {health?.umarl?.installed ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-violet-200 bg-white p-4">
                <p className="text-sm font-semibold text-violet-950">
                  目标属性
                </p>
                <p className="mt-1 text-xs leading-5 text-violet-700">
                  超过目标后的属性收益会自动降权。填写 0 可关闭单项约束。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {STAT_LABELS.map((label, index) => (
                    <label key={label} className="text-xs text-violet-800">
                      {label}
                      <input
                        type="number"
                        min={0}
                        step={10}
                        value={uraAiTargetAttributes[index] ?? 0}
                        onChange={(event) =>
                          setUraAiTargetAttributes((current) =>
                            current.map((value, valueIndex) =>
                              valueIndex === index
                                ? Number(event.target.value)
                                : value,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-2 py-2 text-sm text-slate-800"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <details className="rounded-xl border border-violet-100 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-violet-950">
                  高级采样设置
                </summary>
                <div className="grid gap-3 border-t border-violet-100 p-4 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    [
                      '每回合秒数',
                      uraAiTimeBudget,
                      setUraAiTimeBudget,
                      0.5,
                      0.5,
                      2,
                    ],
                    [
                      '最少模拟次数',
                      uraAiMinRollouts,
                      setUraAiMinRollouts,
                      1,
                      32,
                      128,
                    ],
                    [
                      '最多模拟次数',
                      uraAiMaxRollouts,
                      setUraAiMaxRollouts,
                      1,
                      32,
                      256,
                    ],
                    ['CPU 并行进程', uraAiWorkers, setUraAiWorkers, 1, 1, 64],
                    [
                      '高分偏好',
                      uraAiRiskFactor,
                      setUraAiRiskFactor,
                      0.1,
                      -2,
                      2,
                    ],
                  ].map(([label, value, setter, step, min, max]) => (
                    <label
                      key={String(label)}
                      className="text-xs text-violet-800"
                    >
                      {String(label)}
                      <input
                        type="number"
                        step={Number(step)}
                        min={Number(min)}
                        max={Number(max)}
                        value={Number(value)}
                        onChange={(event) =>
                          (setter as (next: number) => void)(
                            Number(event.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                      />
                    </label>
                  ))}
                </div>
                <p className="px-4 pb-4 text-xs leading-5 text-violet-600">
                  当前快速模式的有效范围为 0.5–2 秒、32–128 次最少模拟和 32–256
                  次最多模拟。
                </p>
              </details>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong className="block">当前 AutoResearch 未安装 UmaRL</strong>
              <span className="mt-1 block text-xs leading-5">
                请在后端使用
                <code className="mx-1 rounded bg-white px-1.5 py-0.5">
                  uv run --extra umarl python main.py
                </code>
                启动。未安装时后端仍会使用内置兜底策略，但不再提供旧系数调节入口。
              </span>
            </div>
          )}
        </section>
        <div
          id="preset-races"
          className="mt-5 flex scroll-mt-28 flex-wrap items-end justify-between gap-3"
        >
          <label className="min-w-[260px] flex-1 text-sm">
            搜索预设比赛
            <input
              value={raceSearch}
              onChange={(event) => setRaceSearch(event.target.value)}
              placeholder="赛事名、日期、赛场或等级"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="text-right">
            <p className="text-sm text-slate-500">
              已选择 {selectedRaceIds.length} 场
            </p>
            <p className="mt-1 text-xs text-indigo-600">
              所选比赛可参加时必须执行，UmaRL 不会改选其他行动
            </p>
          </div>
        </div>
        <div className="mt-3 grid max-h-[440px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRaces.map((race) => {
            const checked = selectedRaceIds.includes(race.id);
            return (
              <label
                key={race.id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-2 ${
                  checked
                    ? 'border-indigo-400 bg-indigo-50'
                    : 'border-slate-100 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedRaceIds((current) =>
                      checked
                        ? current.filter((id) => id !== race.id)
                        : [...current, race.id],
                    )
                  }
                  className="mt-1"
                />
                <AssetIcon
                  path={`race_thumb/${race.thumbnail_id}.png`}
                  alt={race.name}
                  className="h-14 w-20 rounded-lg bg-slate-100 object-cover"
                />
                <span className="min-w-0 text-xs">
                  <strong className="block truncate text-sm">
                    {race.name}
                  </strong>
                  <span className="block text-slate-500">
                    {race.date} · {race.type} · {race.venue}
                  </span>
                  <span className="text-slate-400">
                    {race.terrain} · {race.distance}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
          <div>
            <h3 className="font-semibold text-indigo-950">预设配置完成后</h3>
            <p className="mt-1 text-sm text-indigo-700">
              前往养马详设，为账号选择育成马娘、继承马娘和支援卡。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => scrollToSection('preset-basic')}
              className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
            >
              返回顶部检查
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('career', 'career-task')}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              前往养马详设 →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
