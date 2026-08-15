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
  CONDITION_OPTIONS,
  DEFAULT_PRESET_NAME,
  MONTH_OPTIONS,
  panelClass,
  PERIOD_LABELS,
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
  uraAiEnabled: boolean;
  setUraAiEnabled: Dispatch<SetStateAction<boolean>>;
  uraAiDecisionMode: 'search' | 'model';
  setUraAiDecisionMode: Dispatch<SetStateAction<'search' | 'model'>>;
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
  expectAttribute: number[];
  setExpectAttribute: Dispatch<SetStateAction<number[]>>;
  baseScore: number[];
  setBaseScore: Dispatch<SetStateAction<number[]>>;
  statMultiplier: number[];
  setStatMultiplier: Dispatch<SetStateAction<number[]>>;
  scoreValue: number[][];
  setScoreValue: Dispatch<SetStateAction<number[][]>>;
  extraWeight: number[][];
  setExtraWeight: Dispatch<SetStateAction<number[][]>>;
  npcScoreValue: number[][];
  setNpcScoreValue: Dispatch<SetStateAction<number[][]>>;
  compensateFailure: boolean;
  setCompensateFailure: Dispatch<SetStateAction<boolean>>;
  summerScoreThreshold: number;
  setSummerScoreThreshold: Dispatch<SetStateAction<number>>;
  motivationThresholds: number[];
  setMotivationThresholds: Dispatch<SetStateAction<number[]>>;
  prioritizeRecreation: boolean;
  setPrioritizeRecreation: Dispatch<SetStateAction<boolean>>;
  palThresholds: number[][];
  setPalThresholds: Dispatch<SetStateAction<number[][]>>;
  palFriendshipScore: number[];
  setPalFriendshipScore: Dispatch<SetStateAction<number[]>>;
  palCardMultiplier: number;
  setPalCardMultiplier: Dispatch<SetStateAction<number>>;
  restThreshold: number;
  setRestThreshold: Dispatch<SetStateAction<number>>;
  cureConditions: string[];
  setCureConditions: Dispatch<SetStateAction<string[]>>;
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
    uraAiEnabled,
    setUraAiEnabled,
    uraAiDecisionMode,
    setUraAiDecisionMode,
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
    expectAttribute,
    setExpectAttribute,
    baseScore,
    setBaseScore,
    statMultiplier,
    setStatMultiplier,
    scoreValue,
    setScoreValue,
    extraWeight,
    setExtraWeight,
    npcScoreValue,
    setNpcScoreValue,
    compensateFailure,
    setCompensateFailure,
    summerScoreThreshold,
    setSummerScoreThreshold,
    motivationThresholds,
    setMotivationThresholds,
    prioritizeRecreation,
    setPrioritizeRecreation,
    palThresholds,
    setPalThresholds,
    palFriendshipScore,
    setPalFriendshipScore,
    palCardMultiplier,
    setPalCardMultiplier,
    restThreshold,
    setRestThreshold,
    cureConditions,
    setCureConditions,
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
          <p className="mt-1 text-sm text-gray-500">
            选择已有预设后才能编辑，也可以导入其他玩家分享的预设。
          </p>
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
                    URA ·{' '}
                    {preset.ura_ai?.enabled !== false ? 'UmaRL' : '手动系数'} ·{' '}
                    {skillCount} 个优先技能 ·{' '}
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

        <fieldset className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">
            养成决策模式
          </legend>
          <p className="mt-1 text-xs text-slate-500">
            两套设置独立保存。切换模式不会清空另一套参数。
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                uraAiEnabled
                  ? 'border-violet-400 bg-violet-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-violet-200'
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="preset-decision-mode"
                  checked={uraAiEnabled}
                  onChange={() => setUraAiEnabled(true)}
                  className="mt-1"
                />
                <span>
                  <strong className="block text-sm text-slate-900">
                    UmaRL
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    可由模型直接选择动作，也可模拟候选动作的后续育成结果后再决策。
                  </span>
                  <span className="mt-2 block text-[11px] text-violet-700">
                    {health?.umarl?.installed
                      ? `UmaRL ${health.umarl.version || '-'} · ${
                          health.umarl.cuda_available
                            ? health.umarl.cuda_device
                            : '未检测到 CUDA'
                        }`
                      : '当前后端未安装 UmaRL'}
                  </span>
                </span>
              </span>
            </label>
            <label
              className={`cursor-pointer rounded-xl border p-4 transition ${
                !uraAiEnabled
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <span className="flex items-start gap-3">
                <input
                  type="radio"
                  name="preset-decision-mode"
                  checked={!uraAiEnabled}
                  onChange={() => setUraAiEnabled(false)}
                  className="mt-1"
                />
                <span>
                  <strong className="block text-sm text-slate-900">
                    手动系数策略
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    使用属性目标、羁绊收益、失败率、休息阈值和分期权重进行快速决策。
                  </span>
                  <span className="mt-2 block text-[11px] text-indigo-700">
                    无需 UmaRL 或 CUDA，也作为 UmaRL 异常时的安全回退。
                  </span>
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            剧本
            <select
              value={scenarioId}
              onChange={(event) => setScenarioId(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value={1}>URA</option>
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
          {!uraAiEnabled ? (
            <label className="text-sm">
              休息体力阈值
              <input
                type="number"
                min={0}
                max={100}
                value={restThreshold}
                onChange={(event) =>
                  setRestThreshold(Number(event.target.value))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          ) : null}
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
            {!uraAiEnabled ? (
              <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={compensateFailure}
                  onChange={(event) =>
                    setCompensateFailure(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  <strong className="block font-medium text-slate-800">
                    训练评分考虑失败率
                  </strong>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    使用失败率系数降低高风险训练的优先度
                  </span>
                </span>
              </label>
            ) : null}
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
          className="mt-4 scroll-mt-28 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
        >
          <h3 className="font-semibold text-slate-900">
            {uraAiEnabled ? 'UmaRL 设置' : '手动系数策略设置'}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            {uraAiEnabled
              ? uraAiDecisionMode === 'model'
                ? '当前模式由该养马详设的神经网络直接选择动作，不执行后续模拟。手动系数只保留为异常回退。'
                : '当前模式根据目标属性和后续育成模拟选择训练、休息、外出、医务室和可选比赛。手动系数只保留为回退配置。'
              : '当前模式根据属性目标、训练收益、羁绊、失败率和体力阈值直接选择动作。'}
          </p>

          {uraAiEnabled ? (
            health?.umarl?.installed ? (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-violet-700">
                  <span>
                    {uraAiDecisionMode === 'model'
                      ? '育成时加载所选详设的独立模型；模型不可用时回退到手动系数策略'
                      : '育成时加载所选详设的独立模型；没有模型时使用手写后续策略'}
                    {' · '}
                    {health.umarl.cuda_available
                      ? health.umarl.cuda_device
                      : '未检测到 CUDA'}
                  </span>
                  <span>UmaRL {health.umarl.version || '-'}</span>
                </div>
                <fieldset className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
                  <legend className="px-1 text-sm font-semibold text-violet-950">
                    决策方式
                  </legend>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <label
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        uraAiDecisionMode === 'search'
                          ? 'border-violet-400 bg-white shadow-sm'
                          : 'border-violet-100 bg-white/60 hover:border-violet-300'
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="umarl-decision-mode"
                          checked={uraAiDecisionMode === 'search'}
                          onChange={() => setUraAiDecisionMode('search')}
                          className="mt-1"
                        />
                        <span>
                          <strong className="block text-sm text-violet-950">
                            搜索增强
                          </strong>
                          <span className="mt-1 block text-xs leading-5 text-violet-700">
                            模拟候选动作的后续育成，速度较慢，但能修正模型的单步误判。
                          </span>
                        </span>
                      </span>
                    </label>
                    <label
                      className={`cursor-pointer rounded-lg border p-3 transition ${
                        uraAiDecisionMode === 'model'
                          ? 'border-violet-400 bg-white shadow-sm'
                          : 'border-violet-100 bg-white/60 hover:border-violet-300'
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="umarl-decision-mode"
                          checked={uraAiDecisionMode === 'model'}
                          onChange={() => setUraAiDecisionMode('model')}
                          className="mt-1"
                        />
                        <span>
                          <strong className="block text-sm text-violet-950">
                            模型直接决策
                          </strong>
                          <span className="mt-1 block text-xs leading-5 text-violet-700">
                            直接采用 policy
                            概率最高的动作，几乎无需等待；建议仅对表现稳定的模型启用。
                          </span>
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
                <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4">
                  <p className="text-sm font-semibold text-violet-950">
                    目标属性
                  </p>
                  <p className="mt-1 text-xs leading-5 text-violet-700">
                    {uraAiDecisionMode === 'model'
                      ? '目标属性会作为模型输入，模型需使用相同目标的数据训练。填写 0 可关闭单项约束。'
                      : '搜索会优先减少未达目标的属性缺口；达到目标后继续按最终评价分优化。填写 0 可关闭单项约束。'}
                  </p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
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
                {uraAiDecisionMode === 'search' ? (
                  <div className="grid gap-3 rounded-xl border border-violet-100 bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      ['每回合秒数', uraAiTimeBudget, setUraAiTimeBudget, 1],
                      [
                        '最少模拟次数',
                        uraAiMinRollouts,
                        setUraAiMinRollouts,
                        1,
                      ],
                      [
                        '最多模拟次数',
                        uraAiMaxRollouts,
                        setUraAiMaxRollouts,
                        1,
                      ],
                      [
                        'CPU 并行进程（0 自动）',
                        uraAiWorkers,
                        setUraAiWorkers,
                        1,
                      ],
                      ['高分偏好', uraAiRiskFactor, setUraAiRiskFactor, 0.1],
                    ].map(([label, value, setter, step]) => (
                      <label
                        key={String(label)}
                        className="text-xs text-violet-800"
                      >
                        {String(label)}
                        <input
                          type="number"
                          step={Number(step)}
                          min={String(label).includes('高分') ? undefined : 0}
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
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-800">
                    此模式不会运行搜索，因此每回合秒数、模拟次数、CPU
                    进程和高分偏好均不生效。行动日志会显示模型概率与预测评分。
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <strong className="block">
                  当前 AutoResearch 未安装 UmaRL
                </strong>
                <span className="mt-1 block text-xs leading-5">
                  保存后仍会保留 UmaRL
                  模式，但实际育成会安全回退到手动系数策略。请在后端使用
                  <code className="mx-1 rounded bg-white px-1.5 py-0.5">
                    uv run --extra umarl python main.py
                  </code>
                  启动。
                </span>
              </div>
            )
          ) : null}

          {!uraAiEnabled ? (
            <>
              <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4 text-xs text-slate-600">
                <p className="text-sm font-semibold text-slate-800">
                  训练评分公式
                </p>
                <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-5 text-slate-700">
                  <p>
                    初始分 = 训练基础分 + 羁绊收益 + 技能 Hit 权重 + 属性收益 +
                    体力收益
                  </p>
                  <p>
                    最终分 = 初始分 × 友人卡倍率 × 失败率系数 × 训练类型额外权重
                  </p>
                </div>
                <div className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
                  <p>
                    <strong className="text-slate-700">属性收益：</strong>
                    属性增加值 × 属性收益倍率 × 目标衰减。当前属性达到目标的 70%
                    后会逐步降权，达到目标后该属性收益记为 0。
                  </p>
                  <p>
                    <strong className="text-slate-700">羁绊收益：</strong>
                    在低羁绊与高羁绊评分间按当前羁绊线性计算，再乘 max(0, (72 -
                    当前回合) / 72)；羁绊达到 60 后还会获得最多 1.5
                    倍的效率修正。
                  </p>
                  <p>
                    <strong className="text-slate-700">技能 Hit：</strong>
                    本次训练存在至少一个技能提示时，增加一次对应阶段的技能 Hit
                    权重，不按提示人数重复叠加。
                  </p>
                  <p>
                    <strong className="text-slate-700">失败率系数：</strong>
                    max(0, 1 - 失败率 / 50)。例如失败率 10% 时，训练分乘
                    0.8；关闭“考虑失败率”后不应用此项。
                  </p>
                  <p>
                    <strong className="text-slate-700">额外权重：</strong>
                    最终乘数为 clamp(1 + 权重, 0, 2)。0 表示不调整，0.2 表示乘
                    1.2，-1 表示直接排除该训练。
                  </p>
                  <p>
                    <strong className="text-slate-700">休息判断：</strong>
                    体力低于休息阈值、最佳训练失败率达到 35%，或最佳训练分低于 0
                    时，会优先休息；夏合宿期间会改为外出恢复。
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold">需要立即治疗的负面状态</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONDITION_OPTIONS.map((condition) => (
                    <label
                      key={condition.value}
                      className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={cureConditions.includes(condition.value)}
                        onChange={(event) =>
                          setCureConditions((current) =>
                            event.target.checked
                              ? [...current, condition.value]
                              : current.filter(
                                  (item) => item !== condition.value,
                                ),
                          )
                        }
                      />
                      {condition.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold">属性目标</p>
                  <p className="mt-1 text-xs text-slate-400">
                    达到目标后会降低对应属性训练的优先度，默认采用 URA
                    的通用推荐值
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {STAT_LABELS.map((label, index) => (
                      <label key={label} className="text-xs text-slate-500">
                        {label}
                        <input
                          type="number"
                          value={expectAttribute[index]}
                          onChange={(event) =>
                            setExpectAttribute((current) =>
                              current.map((value, valueIndex) =>
                                valueIndex === index
                                  ? Number(event.target.value)
                                  : value,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">训练基础分</p>
                  <p className="mt-1 text-xs text-slate-400">
                    0 表示不额外偏爱该训练，是正常的中立默认值
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {STAT_LABELS.map((label, index) => (
                      <label key={label} className="text-xs text-slate-500">
                        {label}
                        <input
                          type="number"
                          step="0.01"
                          value={baseScore[index]}
                          onChange={(event) =>
                            setBaseScore((current) =>
                              current.map((value, valueIndex) =>
                                valueIndex === index
                                  ? Number(event.target.value)
                                  : value,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-sm">
                  夏合宿保留训练分阈值
                  <input
                    type="number"
                    step="0.01"
                    value={summerScoreThreshold}
                    onChange={(event) =>
                      setSummerScoreThreshold(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                  />
                </label>
                {['初级年心情阈值', '经典年心情阈值', '高级年心情阈值'].map(
                  (label, index) => (
                    <label key={label} className="text-sm">
                      {label}
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={motivationThresholds[index]}
                        onChange={(event) =>
                          setMotivationThresholds((current) =>
                            current.map((value, valueIndex) =>
                              valueIndex === index
                                ? Number(event.target.value)
                                : value,
                            ),
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                      />
                    </label>
                  ),
                )}
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold">
                  属性收益倍率（速度、耐力、力量、毅力、智力、技能点）
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
                  {['速度', '耐力', '力量', '毅力', '智力', '技能点'].map(
                    (label, index) => (
                      <label key={label} className="text-xs text-slate-500">
                        {label}
                        <input
                          type="number"
                          step="0.001"
                          value={statMultiplier[index]}
                          onChange={(event) =>
                            setStatMultiplier((current) =>
                              current.map((value, valueIndex) =>
                                valueIndex === index
                                  ? Number(event.target.value)
                                  : value,
                              ),
                            )
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <p className="text-sm font-semibold">
                  分期评分参数（低羁绊、高羁绊、体力、技能 Hit）
                </p>
                <div className="mt-2 min-w-[620px] space-y-2">
                  {scoreValue.map((row, rowIndex) => (
                    <div
                      key={PERIOD_LABELS[rowIndex]}
                      className="grid grid-cols-[120px_repeat(4,1fr)] gap-2"
                    >
                      <span className="py-2 text-xs text-slate-500">
                        {PERIOD_LABELS[rowIndex]}
                      </span>
                      {row.map((value, columnIndex) => (
                        <input
                          key={`${rowIndex}-${columnIndex}`}
                          type="number"
                          step="0.001"
                          value={value}
                          aria-label={`${PERIOD_LABELS[rowIndex]} 参数 ${columnIndex + 1}`}
                          onChange={(event) =>
                            setScoreValue((current) =>
                              current.map((currentRow, currentRowIndex) =>
                                currentRowIndex === rowIndex
                                  ? currentRow.map(
                                      (currentValue, currentColumnIndex) =>
                                        currentColumnIndex === columnIndex
                                          ? Number(event.target.value)
                                          : currentValue,
                                    )
                                  : currentRow,
                              ),
                            )
                          }
                          className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <p className="text-sm font-semibold">各阶段训练类型额外权重</p>
                <p className="mt-1 text-xs text-slate-400">
                  0 表示该阶段不额外调整；正数提高优先度，负数降低优先度
                </p>
                <div className="mt-2 min-w-[700px] space-y-2">
                  {extraWeight.map((row, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="grid grid-cols-[120px_repeat(5,1fr)] gap-2"
                    >
                      <span className="py-2 text-xs text-slate-500">
                        {
                          ['初级年', '经典年', '高级年普通阶段', '夏合宿'][
                            rowIndex
                          ]
                        }
                      </span>
                      {row.map((value, columnIndex) => (
                        <label
                          key={`${rowIndex}-${columnIndex}`}
                          className="text-xs text-slate-500"
                        >
                          {STAT_LABELS[columnIndex]}
                          <input
                            type="number"
                            step="0.01"
                            value={value}
                            onChange={(event) =>
                              setExtraWeight((current) =>
                                current.map((currentRow, currentRowIndex) =>
                                  currentRowIndex === rowIndex
                                    ? currentRow.map(
                                        (currentValue, currentColumnIndex) =>
                                          currentColumnIndex === columnIndex
                                            ? Number(event.target.value)
                                            : currentValue,
                                      )
                                    : currentRow,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="overflow-x-auto">
                  <p className="text-sm font-semibold">
                    分期非卡组角色羁绊评分
                  </p>
                  <div className="mt-2 min-w-[360px] space-y-2">
                    {npcScoreValue.map((row, rowIndex) => (
                      <div
                        key={PERIOD_LABELS[rowIndex]}
                        className="grid grid-cols-[120px_repeat(2,1fr)] gap-2"
                      >
                        <span className="py-2 text-xs text-slate-500">
                          {PERIOD_LABELS[rowIndex]}
                        </span>
                        {row.slice(0, 2).map((value, columnIndex) => (
                          <label
                            key={`${rowIndex}-${columnIndex}`}
                            className="text-xs text-slate-500"
                          >
                            {columnIndex === 0 ? '低羁绊' : '高羁绊'}
                            <input
                              type="number"
                              step="0.001"
                              value={value}
                              onChange={(event) =>
                                setNpcScoreValue((current) =>
                                  current.map((currentRow, currentRowIndex) =>
                                    currentRowIndex === rowIndex
                                      ? currentRow.map(
                                          (currentValue, currentColumnIndex) =>
                                            currentColumnIndex === columnIndex
                                              ? Number(event.target.value)
                                              : currentValue,
                                        )
                                      : currentRow,
                                  ),
                                )
                              }
                              className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">友人卡羁绊评分</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {['低羁绊', '高羁绊', '友人卡倍率'].map((label, index) => (
                      <label key={label} className="text-xs text-slate-500">
                        {label}
                        <input
                          type="number"
                          step="0.001"
                          value={
                            index < 2
                              ? palFriendshipScore[index]
                              : palCardMultiplier
                          }
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (index < 2) {
                              setPalFriendshipScore((current) =>
                                current.map((currentValue, currentIndex) =>
                                  currentIndex === index ? value : currentValue,
                                ),
                              );
                            } else {
                              setPalCardMultiplier(value);
                            }
                          }}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-white p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={prioritizeRecreation}
                    onChange={(event) =>
                      setPrioritizeRecreation(event.target.checked)
                    }
                  />
                  按条件优先外出
                </label>
                <label className="mt-3 block text-xs text-slate-500">
                  外出条件：每行填写“心情, 体力, 最高训练评分”
                  <textarea
                    value={palThresholds
                      .map((row) => row.join(', '))
                      .join('\n')}
                    onChange={(event) =>
                      setPalThresholds(
                        event.target.value
                          .split(/\r?\n/)
                          .map((line) =>
                            line
                              .split(/[,，]/)
                              .map((value) => Number(value.trim())),
                          )
                          .filter(
                            (row) =>
                              row.length >= 2 &&
                              row.every((value) => Number.isFinite(value)),
                          ),
                      )
                    }
                    rows={3}
                    placeholder={'3, 60, 0.30\n4, 45, 0.20'}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </label>
              </div>
            </>
          ) : null}
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
