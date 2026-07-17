import type { GameEvent, VenusData } from 'types/gameTypes';
import type {
  VenusFragmentChoiceColor,
  VenusFragmentChoiceRecommendation,
} from 'renderer/utils/venusModel';

const VENUS_FRAGMENT_CHOICES = [
  {
    key: 'red',
    label: '红碎片',
    goddess: '达利阿拉伯',
    color: 'red',
    spiritId: 1,
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-100',
  },
  {
    key: 'blue',
    label: '蓝碎片',
    goddess: '高多芬柏布',
    color: 'blue',
    spiritId: 9,
    border: 'border-sky-200',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    ring: 'ring-sky-100',
  },
  {
    key: 'yellow',
    label: '黄碎片',
    goddess: '拜耶尔土耳其',
    color: 'yellow',
    spiritId: 17,
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-100',
  },
];

const formatSpiritAssetId = (spiritId: number) =>
  String(spiritId).padStart(2, '0');

const getSpiritIconPath = (spiritId: number) =>
  `./icons/venusCup/fragement/utx_ico_fragment_${formatSpiritAssetId(spiritId)}.png`;

const leafFragmentCount = (venusData?: VenusData) =>
  (venusData?.spiritInfo ?? []).filter(
    (item) => item.spiritNum >= 1 && item.spiritNum <= 8,
  ).length;

const formatProbability = (value?: number) =>
  value == null ? '--' : `${Math.round(value * 100)}%`;

const recommendationByColor = (
  recommendations?: VenusFragmentChoiceRecommendation[],
) =>
  new Map<VenusFragmentChoiceColor, VenusFragmentChoiceRecommendation>(
    (recommendations ?? []).map((item) => [item.color, item]),
  );

export default function VenusFragmentChoicePrompt({
  event,
  venusData,
  recommendations,
}: {
  event: GameEvent;
  venusData?: VenusData;
  recommendations?: VenusFragmentChoiceRecommendation[];
}) {
  const currentLeafCount = leafFragmentCount(venusData);
  const recommendationMap = recommendationByColor(recommendations);

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-3">
      {VENUS_FRAGMENT_CHOICES.map((choice) => {
        const recommendation = recommendationMap.get(
          choice.color as VenusFragmentChoiceColor,
        );

        return (
          <div
            key={choice.key}
            className={`min-w-0 rounded-lg border ${choice.border} ${choice.bg} p-3 ring-1 ${choice.ring}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/80 bg-white shadow-sm">
                <img
                  src={getSpiritIconPath(choice.spiritId)}
                  alt={choice.label}
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-black ${choice.text}`}>
                  {choice.label}
                </div>
                <div className="truncate text-xs font-semibold text-gray-600">
                  {choice.goddess}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between rounded-md bg-white/80 px-2.5 py-2 ring-1 ring-white/90">
              <span className="text-xs font-black text-gray-500">推荐概率</span>
              <span className={`text-lg font-black ${choice.text}`}>
                {formatProbability(recommendation?.probability)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
