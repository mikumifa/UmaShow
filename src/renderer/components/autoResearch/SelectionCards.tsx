import { useState } from 'react';
import { Check } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  type PlannerFactor,
  PlannerLineageCard,
  PlannerPortrait,
} from 'renderer/components/succession/PlannerComponents';
import {
  SuccessionFactorDetailModal,
  type SuccessionFactorDetailFactor,
} from 'renderer/components/succession/SuccessionPicker';
import { UMDB } from 'renderer/utils/umdb';
import {
  parentCompatibilityTitle,
  type ParentCompatibilityPreview,
} from './successionCompatibility';
import { Dashboard, FactorInfo, FactorSummary, SupportInfo } from './types';

export function horseIconPath(cardId: number, rarity: number, raceClothId = 0) {
  if (!cardId) return undefined;
  const charaId = Number(String(cardId).slice(0, 4));
  const mappedDressId = UMDB.cardRarityData[cardId]?.[rarity];
  const dressId =
    raceClothId && raceClothId !== cardId
      ? raceClothId
      : mappedDressId || raceClothId || cardId;
  if (!charaId || !dressId) return undefined;
  return `trained_chr_icon/${charaId}_${String(dressId).padStart(6, '0')}.png`;
}

export function characterIconPath(cardId: number) {
  const charaId = Number(String(cardId).slice(0, 4));
  return charaId ? `chr_icon/${charaId}.png` : undefined;
}

export function supportIconPath(supportCardId: number) {
  return `support_card_s/${supportCardId}.png`;
}

export function UmaChoiceCard({
  uma,
  selected,
  onSelect,
}: {
  uma: Dashboard['umas'][number];
  selected: boolean;
  onSelect: () => void;
}) {
  const iconPath = characterIconPath(uma.id);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={uma.name}
      aria-label={`选择${uma.name}`}
      aria-pressed={selected}
      className={`relative h-16 w-16 flex-none overflow-hidden rounded-md border bg-gray-100 transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
      }`}
    >
      {iconPath ? (
        <AssetIcon
          path={iconPath}
          alt={uma.name}
          className="h-full w-full object-contain mix-blend-multiply"
        />
      ) : null}
      {selected ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

const APTITUDE_FACTOR_GROUP_IDS = new Set([
  11, 12, 21, 22, 23, 24, 31, 32, 33, 34,
]);

function isAptitudeFactor(factor: FactorInfo) {
  return (
    factor.factor_type === 2 ||
    factor.category === 'distance' ||
    factor.category === 'aptitude' ||
    APTITUDE_FACTOR_GROUP_IDS.has(factor.factor_group_id)
  );
}

function factorSummary(
  factors: FactorInfo[],
  summary?: FactorSummary,
): FactorSummary {
  return {
    stat:
      summary?.stat ||
      factors.find((factor) => factor.category === 'stat') ||
      null,
    distance:
      summary?.distance ||
      factors.find((factor) => isAptitudeFactor(factor)) ||
      null,
    unique:
      summary?.unique ||
      [...factors].reverse().find((factor) => factor.category === 'unique') ||
      null,
    white_count: factors.length
      ? factors.filter(
          (factor) => factor.category === 'white' && !isAptitudeFactor(factor),
        ).length
      : summary?.white_count || 0,
  };
}

function factorSummaryItems(
  factors: FactorInfo[],
  summary?: FactorSummary,
): PlannerFactor[] {
  const current = factorSummary(factors, summary);
  const featured = [current.stat, current.distance, current.unique].filter(
    Boolean,
  ) as FactorInfo[];
  return [
    ...featured.map((factor) => {
      let tone: PlannerFactor['tone'] = 'aptitude';
      if (factor.category === 'stat') tone = 'stat';
      if (factor.category === 'unique') tone = 'unique';
      return {
        id: factor.id,
        name: factor.name,
        stars: Math.max(1, factor.stars),
        tone,
      };
    }),
    {
      id: 'white-count',
      name: '白因子',
      count: current.white_count,
      tone: 'white' as const,
    },
  ];
}

function factorDetailTone(
  factor: FactorInfo,
): SuccessionFactorDetailFactor['tone'] {
  if (factor.category === 'stat') return 'stat';
  if (
    factor.category === 'distance' ||
    APTITUDE_FACTOR_GROUP_IDS.has(factor.factor_group_id)
  ) {
    return 'aptitude';
  }
  if (factor.category === 'unique' || factor.factor_type === 3) return 'unique';
  if (factor.factor_type === 5) return 'race';
  return 'white';
}

function factorDetails(factors: FactorInfo[]): SuccessionFactorDetailFactor[] {
  const toneOrder: Record<SuccessionFactorDetailFactor['tone'], number> = {
    stat: 0,
    aptitude: 1,
    unique: 2,
    race: 3,
    skill: 4,
    white: 5,
  };
  return factors
    .map((factor) => ({
      id: factor.id,
      name: factor.name,
      stars: factor.stars,
      tone: factorDetailTone(factor),
    }))
    .sort((left, right) => toneOrder[left.tone] - toneOrder[right.tone]);
}

export function ParentChoiceCard({
  parent,
  selected,
  disabled,
  compatibility,
  onSelect,
}: {
  parent: Dashboard['parents'][number];
  selected: boolean;
  disabled: boolean;
  compatibility?: ParentCompatibilityPreview;
  onSelect: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const iconPath = characterIconPath(parent.card_id);
  return (
    <>
      <PlannerLineageCard
        member={{
          key: `self:${parent.instance_id}`,
          name: UMDB.cards[parent.card_id]?.name || parent.name,
          subtitle:
            parent.source === 'rental'
              ? `借用 · ${parent.owner_name || '未知玩家'}`
              : '自己的马娘',
          portrait: (
            <PlannerPortrait path={iconPath} alt={parent.name} size="large" />
          ),
          factors: factorSummaryItems(
            parent.factors || [],
            parent.factor_summary,
          ),
        }}
        parents={parent.ancestors.map((ancestor, index) => ({
          key: `ancestor:${ancestor.position_id}:${ancestor.card_id}`,
          label: `父辈 ${index + 1}`,
          name: UMDB.cards[ancestor.card_id]?.name || ancestor.name,
          portrait: (
            <PlannerPortrait
              path={characterIconPath(ancestor.card_id)}
              alt={ancestor.name}
              size="medium"
            />
          ),
          factors: factorSummaryItems(
            ancestor.factors || [],
            ancestor.factor_summary,
          ),
        }))}
        selected={selected}
        disabled={disabled}
        onSelect={onSelect}
        onDetails={() => setDetailOpen(true)}
        extra={
          compatibility ? (
            <span className="successionCapturedCompatibility">
              <span
                title={parentCompatibilityTitle(compatibility)}
                aria-label={`契合度 ${compatibility.total}，悬停查看详细计算`}
              >
                <strong>契合度 {compatibility.total}</strong>
              </span>
            </span>
          ) : null
        }
      />
      {detailOpen ? (
        <SuccessionFactorDetailModal
          ariaLabel={`${parent.name}全部因子`}
          title={UMDB.cards[parent.card_id]?.name || parent.name}
          description={`${
            parent.source === 'rental'
              ? `借用 · ${parent.owner_name || '未知玩家'}`
              : '自己的马娘'
          } · 完整因子与父辈`}
          members={[
            {
              key: `self:${parent.instance_id}`,
              label: '本体',
              name: UMDB.cards[parent.card_id]?.name || parent.name,
              subtitle: parent.name,
              portrait: (
                <PlannerPortrait
                  path={iconPath}
                  alt={parent.name}
                  size="large"
                />
              ),
              factors: factorDetails(parent.factors || []),
            },
            ...parent.ancestors.map((ancestor, index) => {
              const ancestorIcon = characterIconPath(ancestor.card_id);
              return {
                key: `ancestor:${ancestor.position_id}:${ancestor.card_id}`,
                label: `父辈 ${index + 1}`,
                name: UMDB.cards[ancestor.card_id]?.name || ancestor.name,
                subtitle: ancestor.name,
                portrait: (
                  <PlannerPortrait
                    path={ancestorIcon}
                    alt={ancestor.name}
                    size="large"
                  />
                ),
                factors: factorDetails(ancestor.factors || []),
              };
            }),
          ]}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </>
  );
}

export function SupportChoiceCard({
  support,
  selected,
  disabled,
  onSelect,
}: {
  support: SupportInfo;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={support.name}
      aria-label={`选择好友支援卡${support.name}`}
      aria-pressed={selected}
      className={`relative h-14 w-14 flex-none overflow-hidden rounded-md border bg-gray-100 transition-all disabled:cursor-not-allowed disabled:opacity-25 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
      }`}
    >
      <AssetIcon
        path={supportIconPath(support.id)}
        alt={support.name}
        className="h-full w-full object-cover"
      />
      {selected ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

export function DeckChoiceCard({
  deck,
  selected,
  disabled,
  onSelect,
}: {
  deck: Dashboard['decks'][number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-fit max-w-full flex-none rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
        selected
          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
          : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-700">
          {deck.name}
        </span>
        {selected ? <Check size={16} className="text-indigo-600" /> : null}
      </span>
      <span className="flex flex-nowrap gap-1">
        {deck.cards.map((support) => (
          <span
            key={support.id}
            className="h-12 w-12 flex-none overflow-hidden rounded bg-gray-100"
            title={support.name}
          >
            <AssetIcon
              path={supportIconPath(support.id)}
              alt={support.name}
              className="h-full w-full object-cover"
            />
          </span>
        ))}
      </span>
    </button>
  );
}
