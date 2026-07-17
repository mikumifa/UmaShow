import {
  TrainingHistoryTrainingEstimate,
  TrainingHistoryTrainingTargetEstimate,
} from 'types/gameTypes';
import { supportCardName } from 'renderer/utils/trainingHistorySupportCard';

function formatSignedValue(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function targetTypeLabel(targetType: number) {
  switch (targetType) {
    case 1:
      return '速';
    case 2:
      return '耐';
    case 3:
      return '力';
    case 4:
      return '根';
    case 5:
      return '智';
    case 10:
      return '体';
    case 30:
      return 'PT';
    default:
      return String(targetType);
  }
}

function formatMultiplier(value: number) {
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function TrainingEstimateTargetCard({
  target,
}: {
  target: TrainingHistoryTrainingTargetEstimate;
}) {
  const supportBonusSources = target.supportBonusSources ?? [];
  const friendshipSources = target.friendshipSources ?? [];
  const trainingEffectSources = target.trainingEffectSources ?? [];
  const motivationSources = target.motivationSources ?? [];
  const approxScenarioBase = target.approxScenarioBase ?? 0;
  const supportBonus = target.supportBonus ?? 0;
  const friendshipMultiplier = target.friendshipMultiplier ?? 1;
  const trainingEffectPercent = target.trainingEffectPercent ?? 0;
  const motivationMultiplier = target.motivationMultiplier ?? 1;
  const growthMultiplier = target.growthMultiplier ?? 1;
  const partnerMultiplier = target.partnerMultiplier ?? 1;
  const growthPercent = target.growthPercent ?? 0;
  const partnerCount = target.partnerCount ?? 0;
  const motivationBase = target.motivationBase ?? 0;
  const motivationSupportPercent = target.motivationSupportPercent ?? 0;
  const observed = target.observed ?? 0;
  const estimated = target.estimated ?? 0;

  const baseBeforeFloor =
    (approxScenarioBase + supportBonus) *
    friendshipMultiplier *
    (1 + trainingEffectPercent / 100) *
    motivationMultiplier *
    growthMultiplier *
    partnerMultiplier;

  return (
    <div className="rounded border border-sky-100 bg-white/80 px-2 py-1.5 text-[11px] text-sky-950">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-sky-800">
          {targetTypeLabel(target.targetType)} 目标值 {observed} / 推算{' '}
          {estimated}
        </span>
        <span>
          基础训练值 {approxScenarioBase}+{supportBonus}
        </span>
        <span>友情 ×{formatMultiplier(friendshipMultiplier)}</span>
        <span>训练效果 +{trainingEffectPercent}%</span>
        <span>干劲 ×{formatMultiplier(motivationMultiplier)}</span>
        <span>成长率 +{growthPercent}%</span>
        <span>人数 ×{formatMultiplier(partnerMultiplier)}</span>
      </div>
      <div className="mt-1 rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-800">
        ({approxScenarioBase} + {supportBonus}) ×{' '}
        {formatMultiplier(friendshipMultiplier)} ×{' '}
        {formatMultiplier(1 + trainingEffectPercent / 100)} ×{' '}
        {formatMultiplier(motivationMultiplier)} ×{' '}
        {formatMultiplier(growthMultiplier)} ×{' '}
        {formatMultiplier(partnerMultiplier)} = {baseBeforeFloor.toFixed(3)} →{' '}
        {estimated}
      </div>
      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-sky-700">
        {supportBonusSources.map((item, index) => (
          <span
            key={`support-${item.source}-${index}`}
            className="rounded bg-sky-50 px-1.5 py-0.5"
          >
            属性加成 {item.source}+{item.value}
          </span>
        ))}
        {friendshipSources.map((item, index) => (
          <span
            key={`friend-${item.source}-${index}`}
            className="rounded bg-pink-50 px-1.5 py-0.5 text-pink-700"
          >
            友情加成 {item.source}+{item.value}%
          </span>
        ))}
        {trainingEffectSources.map((item, index) => (
          <span
            key={`train-${item.source}-${index}`}
            className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
          >
            训练效果 {item.source}+{item.value}%
          </span>
        ))}
        {motivationSources.map((item, index) => (
          <span
            key={`mot-${item.source}-${index}`}
            className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700"
          >
            干劲效果 {item.source}+{item.value}%
          </span>
        ))}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer list-none text-[10px] font-medium text-sky-700">
          展开详细步骤
        </summary>
        <div className="mt-1 space-y-1 rounded bg-white/90 p-2 text-[10px] leading-5 text-sky-950">
          <div>
            基础训练值 = 表内基础值 {approxScenarioBase} + 支援卡属性加成{' '}
            {supportBonus}
          </div>
          <div>
            友情加成 ={' '}
            {friendshipSources.length === 0
              ? '1'
              : friendshipSources
                  .map((item) => `(1 + ${item.value}%)`)
                  .join(' × ')}{' '}
            = {formatMultiplier(friendshipMultiplier)}
          </div>
          <div>
            训练效果提升 = 1 + {trainingEffectPercent}% ={' '}
            {formatMultiplier(1 + trainingEffectPercent / 100)}
          </div>
          <div>
            干劲修正 = 1 + {formatSignedValue(Math.round(motivationBase * 100))}
            % × (1 + {motivationSupportPercent}%) ={' '}
            {formatMultiplier(motivationMultiplier)}
          </div>
          <div>
            赛马娘成长率 = 1 + {growthPercent}% ={' '}
            {formatMultiplier(growthMultiplier)}
          </div>
          <div>
            到场人数加成 = 1 + 0.05 × {partnerCount} ={' '}
            {formatMultiplier(partnerMultiplier)}
          </div>
          <div className="border-t border-sky-100 pt-1 font-medium">
            target value = {observed}
          </div>
        </div>
      </details>
    </div>
  );
}

export default function TrainingEstimateCard({
  estimate,
}: {
  estimate?: TrainingHistoryTrainingEstimate;
}) {
  if (!estimate) return null;
  const presentSupportCardIds = estimate.presentSupportCardIds ?? [];
  const targets = estimate.targets ?? [];
  const notes = estimate.notes ?? [];
  const fiveStatTargets = targets.filter(
    (target) => target.targetType >= 1 && target.targetType <= 5,
  );
  const observedFiveStatTotal = fiveStatTargets.reduce(
    (sum, target) => sum + (target.observed ?? 0),
    0,
  );
  const estimatedFiveStatTotal = fiveStatTargets.reduce(
    (sum, target) => sum + (target.estimated ?? 0),
    0,
  );

  return (
    <div className="rounded-md border border-sky-200 bg-sky-50/80 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sky-900">
        <span className="font-semibold">普通训练推算</span>
        <span>Lv {estimate.commandLevel}</span>
        <span>到场 {estimate.partnerCount}</span>
        <span>支援卡 {estimate.supportPartnerCount}</span>
        {fiveStatTargets.length > 0 && (
          <span className="rounded bg-white/80 px-2 py-0.5 font-medium text-sky-800">
            5维强度 {observedFiveStatTotal} / 推算 {estimatedFiveStatTotal}
          </span>
        )}
      </div>
      {presentSupportCardIds.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-sky-800">
          <span className="rounded bg-white/80 px-1.5 py-0.5">在场支援卡</span>
          {presentSupportCardIds.map((supportCardId) => (
            <span
              key={`present-support-${estimate.commandId}-${supportCardId}`}
              className="rounded bg-sky-50 px-1.5 py-0.5"
            >
              {supportCardName(supportCardId)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {targets.map((target) => (
          <TrainingEstimateTargetCard
            key={`estimate-${estimate.commandId}-${target.targetType}`}
            target={target}
          />
        ))}
      </div>
      {notes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-sky-700">
          {notes.map((note, index) => (
            <span
              key={`note-${index}`}
              className="rounded bg-white/80 px-1.5 py-0.5"
            >
              {note}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
