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
import EditableNumberInput from './EditableNumberInput';
import {
  DEFAULT_PRESET_NAME,
  MONTH_OPTIONS,
  normalizeOnlineScenarioId,
  onlineScenarioLabel,
  panelClass,
  scrollToSection,
  skillPurchaseTurn,
  skillPurchaseTurnLabel,
  SKILL_PURCHASE_YEAR_OPTIONS,
  STAT_LABELS,
  statusBadgeClass,
} from './shared';
import RaceSchedulePicker from './RaceSchedulePicker';
import {
  CareerSetting,
  Preset,
  RaceOption,
  SkillLearningSetting,
  SkillSelectionEntry,
  TargetAttributeStage,
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
  savePreset: () => Promise<boolean>;
  busy: string;
  presetSaved: boolean;
  savePresetAndContinue: () => Promise<void>;
  scenarioId: number;
  setScenarioId: Dispatch<SetStateAction<number>>;
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
  uraAiTargetAttributes: number[];
  setUraAiTargetAttributes: Dispatch<SetStateAction<number[]>>;
  uraAiTargetAttributeStages: TargetAttributeStage[];
  setUraAiTargetAttributeStages: Dispatch<
    SetStateAction<TargetAttributeStage[]>
  >;
  targetAttributeStageYearOffset: number;
  setTargetAttributeStageYearOffset: Dispatch<SetStateAction<number>>;
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
  races: RaceOption[];
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
    savePreset,
    busy,
    presetSaved,
    savePresetAndContinue,
    scenarioId,
    setScenarioId,
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
    uraAiTargetAttributes,
    setUraAiTargetAttributes,
    uraAiTargetAttributeStages,
    setUraAiTargetAttributeStages,
    targetAttributeStageYearOffset,
    setTargetAttributeStageYearOffset,
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
    races,
    selectedRaceIds,
    setSelectedRaceIds,
  } = props;

  const toggleTargetAttributeStage = (turn: number) => {
    setUraAiTargetAttributeStages((current) => {
      if (current.some((stage) => stage.turn === turn)) {
        return current.filter((stage) => stage.turn !== turn);
      }
      const nextStage = [...current]
        .sort((left, right) => left.turn - right.turn)
        .find((stage) => stage.turn > turn);
      return [
        ...current,
        {
          turn,
          target_attributes: [
            ...(nextStage?.target_attributes || uraAiTargetAttributes),
          ],
        },
      ].sort((left, right) => left.turn - right.turn);
    });
  };

  const updateTargetAttributeStage = (
    turn: number,
    attributeIndex: number,
    value: number,
  ) => {
    setUraAiTargetAttributeStages((current) =>
      current.map((stage) =>
        stage.turn === turn
          ? {
              ...stage,
              target_attributes: stage.target_attributes.map(
                (attribute, index) =>
                  index === attributeIndex ? value : attribute,
              ),
            }
          : stage,
      ),
    );
  };
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
              className="relative rounded-lg border border-gray-200 bg-gray-50/60 p-3"
            >
              {isDefault ? (
                <span
                  className={`absolute right-3 top-3 ${statusBadgeClass('violet')}`}
                >
                  默认预设
                </span>
              ) : null}
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Settings2 size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  {isDefault ? (
                    <div className="pr-24">
                      <p className="truncate pt-1 font-semibold text-gray-800">
                        {preset.name}
                      </p>
                    </div>
                  ) : (
                    <label className="block text-xs text-gray-500">
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
                    {`${onlineScenarioLabel(preset.scenario_id)} · ${skillCount} 个优先技能 · ${(preset.extra_race_list || []).length} 场额外赛事`}
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
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPresetEditorOpen(false)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              返回
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
        <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="text-sm">
            育成剧本
            <select
              value={scenarioId}
              onChange={(event) =>
                setScenarioId(normalizeOnlineScenarioId(event.target.value))
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value={1}>URA</option>
              <option value={5}>荣耀女神杯</option>
            </select>
          </label>
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
        </div>

        <div id="preset-skills" className="mt-4 scroll-mt-28">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800">育成中技能选择</p>
                <p className="mt-1 text-xs text-slate-500">
                  越靠上优先级越高，可拖动调整顺序。
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
            <div className="grid min-h-[104px] grid-cols-2 auto-rows-max content-start gap-2 bg-slate-50/60 p-3 xl:grid-cols-3">
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

        <section id="preset-training" className="mt-4 scroll-mt-28">
          <div className="contents">
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                <p className="text-sm font-semibold text-indigo-950">
                  {scenarioId === 5
                    ? '使用女神杯手写规则策略'
                    : '默认使用 UmaRL 蒙特卡洛育成决策'}
                </p>
                <p className="mt-1 text-xs leading-5 text-indigo-700">
                  {scenarioId === 5
                    ? '不会进入 URA 的 MCTS 搜索；目标属性仍用于手写训练评分，当前不参考女神碎片。'
                    : 'UmaRL 已随 AutoResearch 默认安装；搜索异常、超时或样本不足时会自动回退到内置策略。'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">
                  最终目标属性
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  所有阶段结束后使用这组属性线。达到单项属性线后不再选择对应训练；填写
                  0 可关闭单项约束。
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {STAT_LABELS.map((label, index) => (
                    <label key={label} className="text-xs text-slate-600">
                      {label}
                      <EditableNumberInput
                        min={0}
                        step={10}
                        value={uraAiTargetAttributes[index] ?? 0}
                        onValueChange={(nextValue) =>
                          setUraAiTargetAttributes((current) =>
                            current.map((value, valueIndex) =>
                              valueIndex === index ? nextValue : value,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        分阶段目标属性
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-500">
                        选中日期并填写阶段属性线；到该日期为止使用这组目标，之后自动切换到下一阶段，最后使用上方最终目标。
                      </p>
                    </div>
                    {uraAiTargetAttributeStages.length ? (
                      <button
                        type="button"
                        onClick={() => setUraAiTargetAttributeStages([])}
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                      >
                        清空阶段
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                    {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
                      <button
                        key={year.offset}
                        type="button"
                        onClick={() =>
                          setTargetAttributeStageYearOffset(year.offset)
                        }
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                          targetAttributeStageYearOffset === year.offset
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
                              targetAttributeStageYearOffset,
                              month,
                              half,
                            );
                            const selected = uraAiTargetAttributeStages.some(
                              (stage) => stage.turn === turn,
                            );
                            return (
                              <button
                                key={half}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleTargetAttributeStage(turn)}
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

                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {uraAiTargetAttributeStages.map((stage) => (
                      <div
                        key={stage.turn}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            截至 {skillPurchaseTurnLabel(stage.turn)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              toggleTargetAttributeStage(stage.turn)
                            }
                            title="删除此阶段"
                            className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-5 gap-1.5">
                          {STAT_LABELS.map((label, index) => (
                            <label
                              key={label}
                              className="text-[11px] text-slate-600"
                            >
                              {label}
                              <EditableNumberInput
                                min={0}
                                step={10}
                                value={stage.target_attributes[index] ?? 0}
                                onValueChange={(nextValue) =>
                                  updateTargetAttributeStage(
                                    stage.turn,
                                    index,
                                    nextValue,
                                  )
                                }
                                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!uraAiTargetAttributeStages.length ? (
                      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 md:col-span-2 xl:col-span-3">
                        尚未设置阶段目标，当前会全程使用最终目标属性。
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {scenarioId === 1 ? (
                <details className="rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                    高级采样设置
                  </summary>
                  <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 xl:grid-cols-5">
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
                        className="text-xs text-slate-600"
                      >
                        {String(label)}
                        <EditableNumberInput
                          step={Number(step)}
                          min={Number(min)}
                          max={Number(max)}
                          value={Number(value)}
                          onValueChange={(nextValue) =>
                            (setter as (next: number) => void)(nextValue)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="px-4 pb-4 text-xs leading-5 text-slate-500">
                    当前快速模式的有效范围为 0.5–2 秒、32–128 次最少模拟和
                    32–256 次最多模拟。
                  </p>
                </details>
              ) : null}
            </div>
          </div>
        </section>
        <div className="mt-5">
          <RaceSchedulePicker
            id="preset-races"
            title="预设比赛"
            races={races}
            selectedRaceIds={selectedRaceIds}
            setSelectedRaceIds={setSelectedRaceIds}
          />
        </div>
      </section>
    </>
  );
}
