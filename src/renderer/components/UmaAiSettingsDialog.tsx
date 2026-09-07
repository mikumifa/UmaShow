/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Cpu,
  FolderOpen,
  Gauge,
  RotateCcw,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  DEFAULT_UMA_AI_SETTINGS,
  type UmaAiOptions,
  type UmaAiSettings,
  useMonteCarloRecommendation,
} from './MonteCarloProvider';

type NumberFieldProps = {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

function NumberField({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  return (
    <label className="grid min-w-0 gap-1 rounded-xl border border-slate-200 bg-white p-3 transition-colors focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-8 w-28 rounded-md border border-slate-200 bg-slate-50 px-2 text-right font-mono text-xs font-semibold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
        />
      </span>
      <span className="text-[11px] leading-4 text-slate-400">
        {description}
      </span>
    </label>
  );
}

export default function UmaAiSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { status, settings, saveSettings, result } =
    useMonteCarloRecommendation();
  const [draft, setDraft] = useState<UmaAiSettings>(settings);
  const [modelSelectError, setModelSelectError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(settings);
      setModelSelectError('');
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  const updateOption = (
    key: Exclude<keyof UmaAiOptions, 'modelPath'>,
    value: number,
  ) => {
    setDraft((current) => ({
      ...current,
      options: { ...current.options, [key]: value },
    }));
  };
  const restoreDefaults = () => {
    setDraft((current) => ({
      enabled: current.enabled,
      options: {
        ...DEFAULT_UMA_AI_SETTINGS.options,
        modelPath: current.options.modelPath,
      },
    }));
  };
  const selectModel = async () => {
    setModelSelectError('');
    try {
      const selected = (await window.electron.monteCarlo.selectModel()) as
        | string
        | null;
      if (selected) {
        setDraft((current) => ({
          ...current,
          options: { ...current.options, modelPath: selected },
        }));
      }
    } catch (reason) {
      setModelSelectError(
        reason instanceof Error ? reason.message : String(reason),
      );
    }
  };
  const save = () => {
    saveSettings(draft);
    onClose();
  };

  return createPortal(
    <div className="app-no-drag fixed inset-0 z-[1800] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-settings-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700">
              <Bot size={22} />
            </div>
            <div>
              <h2
                id="recommendation-settings-title"
                className="text-base font-bold text-slate-900"
              >
                推荐设置
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                启用后，UmaShow
                会根据当前育成数据计算行动建议，并直接显示在原有育成界面中。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭推荐设置"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <section
            className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 ${
              draft.enabled
                ? 'border-indigo-200 bg-indigo-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                {draft.enabled ? (
                  <CheckCircle2 size={17} className="text-indigo-600" />
                ) : (
                  <AlertCircle size={17} className="text-slate-400" />
                )}
                启用推荐
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-label="启用推荐"
              aria-checked={draft.enabled}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  enabled: !current.enabled,
                }))
              }
              className={`relative h-7 w-12 rounded-full transition-colors ${
                draft.enabled ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  draft.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </section>

          <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Cpu size={16} className="text-indigo-600" />
                  凯旋门多回合模型
                </h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  模型由独立 Python 工程训练。UmaShow
                  只加载导出的 ONNX 文件，不包含训练环境或训练按钮。
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                  draft.options.modelPath
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.options.modelPath
                  ? '已选择模型'
                  : '使用内置推荐逻辑'}
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={draft.options.modelPath}
                placeholder="未选择模型文件"
                title={draft.options.modelPath || '未选择模型文件'}
                className="h-9 min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 text-xs text-slate-600 outline-none"
              />
              <button
                type="button"
                onClick={selectModel}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <FolderOpen size={14} /> 选择模型
              </button>
              {draft.options.modelPath ? (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      options: { ...current.options, modelPath: '' },
                    }))
                  }
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Trash2 size={14} /> 清除
                </button>
              ) : null}
            </div>
            {modelSelectError ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">
                {modelSelectError}
              </p>
            ) : null}
            {result?.fallbackReason &&
            result.modelPath === settings.options.modelPath ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-700">
                {result.fallbackReason}
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <NumberField
                label="搜索节点预算"
                description="每回合最多进行的随机树搜索次数。默认 384，越高越稳定。"
                value={draft.options.graphSearchNodes}
                min={16}
                max={8192}
                step={16}
                onChange={(value) => updateOption('graphSearchNodes', value)}
              />
              <NumberField
                label="规划深度"
                description="显式向后规划的行动回合数；叶子局面由模型估值。"
                value={draft.options.graphSearchDepth}
                min={1}
                max={16}
                onChange={(value) => updateOption('graphSearchDepth', value)}
              />
              <NumberField
                label="时间预算（毫秒）"
                description="达到此时间后停止追加搜索，但至少会检查每个当前合法行动一次。"
                value={draft.options.graphSearchTimeMs}
                min={50}
                max={30000}
                step={50}
                onChange={(value) => updateOption('graphSearchTimeMs', value)}
              />
              <NumberField
                label="后续行动分支"
                description="后续回合按模型先验展开的候选数；当前回合仍完整比较全部行动。"
                value={draft.options.graphSearchTopK}
                min={1}
                max={12}
                onChange={(value) => updateOption('graphSearchTopK', value)}
              />
              <NumberField
                label="随机结果分支"
                description="同一行动保留的随机结果上限，用于模拟失败、事件和人物分布。"
                value={draft.options.graphSearchChanceOutcomes}
                min={1}
                max={32}
                onChange={(value) =>
                  updateOption('graphSearchChanceOutcomes', value)
                }
              />
              <NumberField
                label="探索系数"
                description="控制搜索尝试低访问行动的强度；默认 1.5。"
                value={draft.options.graphSearchCpuct}
                min={0}
                max={20}
                step={0.1}
                onChange={(value) => updateOption('graphSearchCpuct', value)}
              />
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div className="flex gap-1.5 text-[10px] font-semibold">
                <span
                  className={`rounded-full px-2 py-1 ${
                    status?.engines?.[6]
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  凯旋门推荐{status?.engines?.[6] ? '可用' : '不可用'}
                </span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <NumberField
                label="单个行动搜索量"
                description="每个候选行动的模拟次数。越高越稳定，但计算时间近似线性增加。"
                value={draft.options.searchSingleMax}
                min={16}
                max={65536}
                step={16}
                onChange={(value) => updateOption('searchSingleMax', value)}
              />
              <NumberField
                label="CPU 线程数"
                description="并行模拟线程。一般设置为物理核心数附近，过高可能影响游戏流畅度。"
                value={draft.options.threadNum}
                min={1}
                max={32}
                onChange={(value) => updateOption('threadNum', value)}
              />
              <NumberField
                label="激进度"
                description="提高后更偏向高收益路线，也会增加搜索开销；育成结束前会自动降低。"
                value={draft.options.radicalFactor}
                min={0}
                max={20}
                step={0.25}
                onChange={(value) => updateOption('radicalFactor', value)}
              />
              <NumberField
                label="随机事件强度"
                description="模拟支援卡随机事件时，每次追加的属性和技能点，用于控制属性预留。"
                value={draft.options.eventStrength}
                min={0}
                max={1000}
                onChange={(value) => updateOption('eventStrength', value)}
              />
              <NumberField
                label="随机种子"
                description="设为 0 时每次随机；填写固定整数可重复比较相同局面的参数差异。"
                value={draft.options.seed}
                min={0}
                max={2147483647}
                onChange={(value) => updateOption('seed', value)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="mb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Target size={16} className="text-amber-600" />
                凯旋门属性目标
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                按游戏界面显示的属性值填写。接近目标时会提前降低收益，达到目标后该属性不再增加推荐分；0
                表示使用本局实际属性上限。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <NumberField
                label="速度上限"
                description="最终速度目标，0 为自动。"
                value={draft.options.targetSpeed}
                min={0}
                max={3000}
                onChange={(value) => updateOption('targetSpeed', value)}
              />
              <NumberField
                label="耐力上限"
                description="最终耐力目标，0 为自动。"
                value={draft.options.targetStamina}
                min={0}
                max={3000}
                onChange={(value) => updateOption('targetStamina', value)}
              />
              <NumberField
                label="力量上限"
                description="最终力量目标，0 为自动。"
                value={draft.options.targetPower}
                min={0}
                max={3000}
                onChange={(value) => updateOption('targetPower', value)}
              />
              <NumberField
                label="毅力上限"
                description="最终毅力目标，0 为自动。"
                value={draft.options.targetGuts}
                min={0}
                max={3000}
                onChange={(value) => updateOption('targetGuts', value)}
              />
              <NumberField
                label="智力上限"
                description="最终智力目标，0 为自动。"
                value={draft.options.targetWisdom}
                min={0}
                max={3000}
                onChange={(value) => updateOption('targetWisdom', value)}
              />
            </div>
          </section>

          <div className="mb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Gauge size={16} className="text-cyan-600" /> 高级搜索参数
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <NumberField
              label="总搜索量上限"
              description="所有行动累计搜索次数，0 表示不限，由单个行动搜索量决定停止。"
              value={draft.options.searchTotalMax}
              min={0}
              max={10000000}
              step={128}
              onChange={(value) => updateOption('searchTotalMax', value)}
            />
            <NumberField
              label="搜索分组大小"
              description="每批分配的模拟量。官方 CPU 配置为 128，且不要小于线程数的 16 倍。"
              value={draft.options.searchGroupSize}
              min={Math.min(4096, draft.options.threadNum * 16)}
              max={4096}
              step={16}
              onChange={(value) => updateOption('searchGroupSize', value)}
            />
            <NumberField
              label="搜索 Cpuct"
              description="控制探索与利用的平衡；数值越小，搜索越集中在高价值行动。"
              value={draft.options.searchCpuct}
              min={0}
              max={50}
              step={0.1}
              onChange={(value) => updateOption('searchCpuct', value)}
            />
            <NumberField
              label="最大搜索深度"
              description="向后模拟的最大回合数；凯旋门会计算到当前育成结束。"
              value={draft.options.maxDepth}
              min={1}
              max={156}
              onChange={(value) => updateOption('maxDepth', value)}
            />
            <NumberField
              label="每技能点估值"
              description="普通评分时每 1 技能点折算的分数，默认 2.0。"
              value={draft.options.scorePtRate}
              min={0}
              max={20}
              step={0.05}
              onChange={(value) => updateOption('scorePtRate', value)}
            />
            <label className="grid min-w-0 gap-1 rounded-xl border border-slate-200 bg-white p-3">
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-700">
                  评分模式
                </span>
                <select
                  value={draft.options.scoringMode}
                  onChange={(event) =>
                    updateOption('scoringMode', Number(event.target.value))
                  }
                  className="h-8 w-36 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-400"
                >
                  <option value={0}>普通评价点</option>
                  <option value={1}>通用大赛</option>
                  <option value={6}>英里大赛</option>
                </select>
              </span>
              <span className="text-[11px] leading-4 text-slate-400">
                选择最终局面的打分方式。
              </span>
            </label>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={restoreDefaults}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <RotateCcw size={14} /> 恢复默认参数
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={save}
              className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              保存设置
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
