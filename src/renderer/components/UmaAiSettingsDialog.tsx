/* eslint-disable jsx-a11y/label-has-associated-control */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, RotateCcw, Trash2, X } from 'lucide-react';
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
    <label className="block min-w-0">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-right font-mono text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
      />
      <span className="mt-1 block text-[11px] leading-4 text-slate-400">
        {description}
      </span>
    </label>
  );
}

type AttributeFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function AttributeField({ label, value, onChange }: AttributeFieldProps) {
  return (
    <label className="min-w-0">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        min={0}
        max={3000}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-right font-mono text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
      />
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

  const updateOption = <Key extends Exclude<keyof UmaAiOptions, 'modelPath'>>(
    key: Key,
    value: UmaAiOptions[Key],
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
  const usingModel = Boolean(draft.options.modelPath);

  return createPortal(
    <div className="app-no-drag fixed inset-0 z-[1800] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-settings-title"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2
              id="recommendation-settings-title"
              className="text-base font-bold text-slate-900"
            >
              推荐设置
            </h2>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <section className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">启用推荐</h3>
              <p className="mt-1 text-xs text-slate-500">
                推荐结果会直接显示在现有育成界面中。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-[11px] font-medium ${
                  status?.engines?.[6] ? 'text-slate-500' : 'text-rose-600'
                }`}
              >
                {status?.engines?.[6] ? '计算组件可用' : '计算组件不可用'}
              </span>
              <button
                type="button"
                role="switch"
                aria-label="启用凯旋门推荐"
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
            </div>
          </section>

          <div className="grid border-t border-slate-200 md:grid-cols-2">
            <section className="py-5 md:pr-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  计算设置
                </h3>
              </div>
              {usingModel ? (
                <details>
                  <summary className="cursor-pointer select-none text-xs font-semibold text-slate-700">
                    模型搜索参数
                    <span className="ml-2 font-normal text-slate-400">
                      通常保持默认即可
                    </span>
                  </summary>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                    <label className="block min-w-0 sm:col-span-2 md:col-span-1 lg:col-span-2">
                      <span className="text-xs font-semibold text-slate-700">
                        根搜索算法
                      </span>
                      <select
                        value={draft.options.graphRootSelection}
                        onChange={(event) =>
                          updateOption(
                            'graphRootSelection',
                            event.target
                              .value as UmaAiOptions['graphRootSelection'],
                          )
                        }
                        className="mt-1.5 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                      >
                        <option value="puct">PUCT（稳定通用）</option>
                        <option value="gumbel">
                          Gumbel Sequential Halving（低预算）
                        </option>
                      </select>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                        Gumbel 会先覆盖更多当前回合行动，再把预算集中到较优
                        候选。
                      </span>
                    </label>
                    {draft.options.graphRootSelection === 'gumbel' ? (
                      <>
                        <NumberField
                          label="根候选行动数"
                          description="最多纳入逐轮淘汰的当前回合行动；低预算建议 8～16。"
                          value={draft.options.graphRootGumbelMaxActions}
                          min={1}
                          max={48}
                          onChange={(value) =>
                            updateOption('graphRootGumbelMaxActions', value)
                          }
                        />
                        <NumberField
                          label="Gumbel 探索强度"
                          description="0 为固定选择，1 为标准探索；越高越容易尝试冷门行动。"
                          value={draft.options.graphRootGumbelScale}
                          min={0}
                          max={10}
                          step={0.1}
                          onChange={(value) =>
                            updateOption('graphRootGumbelScale', value)
                          }
                        />
                      </>
                    ) : null}
                    <NumberField
                      label="搜索局数"
                      description="每回合最多搜索的局数。"
                      value={draft.options.graphSearchNodes}
                      min={16}
                      max={8192}
                      step={16}
                      onChange={(value) =>
                        updateOption('graphSearchNodes', value)
                      }
                    />
                    <NumberField
                      label="模型规划回合"
                      description="模型显式展开的回合数，之后由模型评估局面。"
                      value={draft.options.graphSearchDepth}
                      min={1}
                      max={16}
                      onChange={(value) =>
                        updateOption('graphSearchDepth', value)
                      }
                    />
                    <NumberField
                      label="timeout (ms)"
                      description="达到时间预算后停止追加搜索。"
                      value={draft.options.graphSearchTimeMs}
                      min={50}
                      max={30000}
                      step={50}
                      onChange={(value) =>
                        updateOption('graphSearchTimeMs', value)
                      }
                    />
                    <NumberField
                      label="batchsize"
                      description="批量计算的局数。"
                      value={draft.options.graphInferenceBatchSize}
                      min={1}
                      max={64}
                      onChange={(value) =>
                        updateOption('graphInferenceBatchSize', value)
                      }
                    />
                    <NumberField
                      label="后续行动分支"
                      description="后续回合按模型先验保留的候选行动数。"
                      value={draft.options.graphSearchTopK}
                      min={1}
                      max={12}
                      onChange={(value) =>
                        updateOption('graphSearchTopK', value)
                      }
                    />
                    <NumberField
                      label="随机结果分支"
                      description="同一行动保留的失败、事件等随机结果数。"
                      value={draft.options.graphSearchChanceOutcomes}
                      min={1}
                      max={32}
                      onChange={(value) =>
                        updateOption('graphSearchChanceOutcomes', value)
                      }
                    />
                    <NumberField
                      label="探索系数"
                      description="越高越倾向尝试访问较少的行动。"
                      value={draft.options.graphSearchCpuct}
                      min={0}
                      max={20}
                      step={0.1}
                      onChange={(value) =>
                        updateOption('graphSearchCpuct', value)
                      }
                    />
                  </div>
                </details>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  <NumberField
                    label="每项模拟次数"
                    description="每个候选行动的模拟次数；越高越稳定，也越耗时。"
                    value={draft.options.searchSingleMax}
                    min={16}
                    max={65536}
                    step={16}
                    onChange={(value) => updateOption('searchSingleMax', value)}
                  />
                  <NumberField
                    label="并行线程数"
                    description="建议接近 CPU 物理核心数，过高可能影响游戏流畅度。"
                    value={draft.options.threadNum}
                    min={1}
                    max={32}
                    onChange={(value) => updateOption('threadNum', value)}
                  />
                </div>
              )}
            </section>

            <section className="border-t border-slate-200 py-5 md:border-l md:border-t-0 md:pl-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  推荐偏好
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  调整高收益路线和未来随机事件收益的取舍。
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                <NumberField
                  label="路线倾向"
                  description="数值越高越偏向高收益路线；育成后期会自动收敛。"
                  value={draft.options.radicalFactor}
                  min={0}
                  max={20}
                  step={0.25}
                  onChange={(value) => updateOption('radicalFactor', value)}
                />
                <NumberField
                  label="事件收益预留"
                  description="预估后续支援卡随机事件带来的属性和技能点。"
                  value={draft.options.eventStrength}
                  min={0}
                  max={1000}
                  onChange={(value) => updateOption('eventStrength', value)}
                />
              </div>
            </section>
          </div>

          <section className="border-t border-slate-200 py-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  属性上限
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  填写本次育成希望达到的属性上限，0 表示自动使用本局实际上限。
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <AttributeField
                label="速度"
                value={draft.options.targetSpeed}
                onChange={(value) => updateOption('targetSpeed', value)}
              />
              <AttributeField
                label="耐力"
                value={draft.options.targetStamina}
                onChange={(value) => updateOption('targetStamina', value)}
              />
              <AttributeField
                label="力量"
                value={draft.options.targetPower}
                onChange={(value) => updateOption('targetPower', value)}
              />
              <AttributeField
                label="毅力"
                value={draft.options.targetGuts}
                onChange={(value) => updateOption('targetGuts', value)}
              />
              <AttributeField
                label="智力"
                value={draft.options.targetWisdom}
                onChange={(value) => updateOption('targetWisdom', value)}
              />
            </div>
          </section>

          <section className="border-t border-slate-200 py-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                ONNX 模型（可选）
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                选择 .onnx 使用 CPU；选择 .fp16.onnx 自动使用 GPU。
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={draft.options.modelPath}
                placeholder="未选择模型文件"
                title={draft.options.modelPath || '未选择模型文件'}
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none"
              />
              <button
                type="button"
                onClick={selectModel}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <FolderOpen size={14} /> 选择模型
              </button>
              {usingModel ? (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      options: { ...current.options, modelPath: '' },
                    }))
                  }
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-600"
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
            {result?.modelLoaded &&
            result.modelPath === settings.options.modelPath ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">
                推理设备：
                {result.inferenceProvider === 'directml'
                  ? 'DirectML（GPU）'
                  : 'CPU'}
                {result.resolvedModelPath?.toLowerCase().endsWith('.fp16.onnx')
                  ? ' · FP16'
                  : ' · FP32'}
              </p>
            ) : null}
            {result?.fallbackReason &&
            result.modelPath === settings.options.modelPath ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-amber-700">
                {result.fallbackReason}
              </p>
            ) : null}
          </section>
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
