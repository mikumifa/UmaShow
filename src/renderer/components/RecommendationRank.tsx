import type {
  MonteCarloActionResult,
  MonteCarloResult,
} from 'types/monteCarlo';

export type RankedRecommendation = {
  action: MonteCarloActionResult;
  rank: number;
  isBest: boolean;
};

type RankTone = {
  card: string;
  footer: string;
  badge: string;
  delta: string;
};

const RANK_TONES: RankTone[] = [
  {
    card: 'border-amber-400 bg-gradient-to-br from-amber-50 to-white shadow-lg ring-4 ring-amber-200',
    footer: 'border-amber-300 bg-amber-100 text-amber-950',
    badge: 'bg-amber-500 text-white',
    delta: 'bg-amber-200 text-amber-950',
  },
  {
    card: 'border-slate-200 bg-white shadow-md',
    footer: 'border-slate-200 bg-white text-slate-700',
    badge: 'bg-slate-200 text-slate-700',
    delta: 'bg-slate-100 text-slate-600',
  },
];

export const recommendationRankTone = (rank: number) =>
  RANK_TONES[Math.min(Math.max(rank, 1), RANK_TONES.length) - 1];

export const rankRecommendationActions = (
  result: MonteCarloResult | null,
): RankedRecommendation[] => {
  if (!result?.ok) return [];
  const bestByActionType = new Map<number, MonteCarloActionResult>();
  result.actions?.forEach((action) => {
    if (action.train < 0) return;
    const current = bestByActionType.get(action.train);
    if (!current || action.value > current.value) {
      bestByActionType.set(action.train, action);
    }
  });
  return [...bestByActionType.values()]
    .sort((left, right) => right.value - left.value)
    .map((action, index) => ({
      action,
      rank: index + 1,
      isBest: action.id === result.bestActionId,
    }));
};

export const recommendationDeltaLabel = (action: MonteCarloActionResult) => {
  const delta = Math.max(0, Math.round(action.deltaFromBest));
  return delta === 0 ? '±0' : `-${delta}`;
};

export function RecommendationScoreFooter({
  recommendation,
}: {
  recommendation: RankedRecommendation;
}) {
  const { action, rank } = recommendation;
  const tone = recommendationRankTone(rank);
  const deltaLabel = recommendationDeltaLabel(action);
  return (
    <div
      title={`第 ${rank} 名 · ${action.label} · 预测最终分 ${Math.round(
        action.scoreMean,
      )} · 相对第一名 ${deltaLabel}`}
      className={`flex min-h-14 items-center justify-between gap-2 rounded-b-lg border-t px-3 py-2 ${tone.footer}`}
    >
      <span
        className={`rounded-md px-2 py-1 text-sm font-black tabular-nums shadow-sm ${tone.badge}`}
        aria-label={`排名第 ${rank}`}
      >
        #{rank}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums">
        <span className="flex items-baseline gap-0.5 whitespace-nowrap">
          <span className="text-xl font-black leading-none">
            {Math.round(action.scoreMean)}
          </span>
          <span className="text-[11px] font-bold opacity-65">分</span>
        </span>
        <span
          className={`min-w-12 rounded-md px-2 py-1 text-center text-base font-black ${tone.delta}`}
        >
          {deltaLabel}
        </span>
      </span>
    </div>
  );
}

export function RecommendationRankChip({
  recommendation,
}: {
  recommendation: RankedRecommendation;
}) {
  const { action, rank } = recommendation;
  const tone = recommendationRankTone(rank);
  const deltaLabel = recommendationDeltaLabel(action);
  return (
    <span
      title={`第 ${rank} 名 · 预测最终分 ${Math.round(
        action.scoreMean,
      )} · 相对第一名 ${deltaLabel}`}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-black tabular-nums ${tone.footer}`}
    >
      <span className={`rounded px-1 py-0.5 ${tone.badge}`}>#{rank}</span>
      <span>{Math.round(action.scoreMean)}分</span>
      <span className={`rounded px-1 py-0.5 ${tone.delta}`}>{deltaLabel}</span>
    </span>
  );
}
