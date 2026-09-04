import { useState } from 'react';
import { Check } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
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
  const iconPath = horseIconPath(uma.id, uma.rarity, uma.race_cloth_id);
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
          className="h-full w-full object-cover"
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

const FACTOR_COLORS: Record<string, string> = {
  stat: 'border-blue-200 bg-blue-50 text-blue-700',
  distance: 'border-rose-200 bg-rose-50 text-rose-700',
  aptitude: 'border-rose-200 bg-rose-50 text-rose-700',
  unique: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  white: 'border-slate-200 bg-white text-slate-600',
};

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

function FactorSummaryView({
  factors,
  summary,
}: {
  factors: FactorInfo[];
  summary?: FactorSummary;
}) {
  const current = factorSummary(factors, summary);
  const featured = [current.stat, current.distance, current.unique].filter(
    Boolean,
  ) as FactorInfo[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {featured.map((factor) => (
        <span
          key={factor.id}
          className={`rounded-md border px-2 py-1 text-xs font-medium leading-none ${FACTOR_COLORS[factor.category] || FACTOR_COLORS.white}`}
        >
          {factor.name} {'★'.repeat(Math.max(1, factor.stars))}
        </span>
      ))}
      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium leading-none text-slate-500">
        白因子 ×{current.white_count}
      </span>
    </div>
  );
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
    white: 4,
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
  const iconPath = horseIconPath(
    parent.card_id,
    parent.rarity,
    parent.race_cloth_id,
  );
  return (
    <div
      className={`rounded-lg border bg-white p-3 transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-100'
          : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`选择继承马娘${parent.name}`}
        aria-pressed={selected}
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span className="relative h-16 w-16 flex-none overflow-hidden rounded-md bg-gray-100">
          {iconPath ? (
            <AssetIcon
              path={iconPath}
              alt={parent.name}
              className="h-full w-full object-cover"
            />
          ) : null}
          {selected ? (
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
              <Check size={13} strokeWidth={3} />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-gray-800">
              {parent.name}
            </span>
            <span
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {parent.source === 'rental' ? '借用' : '自己的'}
            </span>
          </span>
          {parent.source === 'rental' ? (
            <span className="mb-1 block truncate text-[11px] text-slate-500">
              借用玩家：{parent.owner_name || '未知玩家'}
            </span>
          ) : null}
          <FactorSummaryView
            factors={parent.factors || []}
            summary={parent.factor_summary}
          />
          {compatibility ? (
            <span className="successionCapturedCompatibility">
              <span
                title={parentCompatibilityTitle(compatibility)}
                aria-label={`契合度 ${compatibility.total}，悬停查看详细计算`}
              >
                <strong>契合度 {compatibility.total}</strong>
              </span>
            </span>
          ) : null}
        </span>
      </button>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {parent.ancestors.map((ancestor) => {
          const ancestorIcon = horseIconPath(
            ancestor.card_id,
            ancestor.rarity,
            ancestor.race_cloth_id,
          );
          return (
            <div
              key={ancestor.position_id}
              className="flex min-w-0 items-center gap-2 rounded-md bg-gray-50 p-1.5"
            >
              <span className="h-9 w-9 flex-none overflow-hidden rounded bg-gray-100">
                {ancestorIcon ? (
                  <AssetIcon
                    path={ancestorIcon}
                    alt={ancestor.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <FactorSummaryView
                  factors={ancestor.factors || []}
                  summary={ancestor.factor_summary}
                />
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="mt-1.5 inline-flex rounded px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        查看详细
      </button>

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
                <span className="successionCapturedPortrait">
                  {iconPath ? (
                    <AssetIcon
                      path={iconPath}
                      alt={parent.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
              ),
              factors: factorDetails(parent.factors || []),
            },
            ...parent.ancestors.map((ancestor, index) => {
              const ancestorIcon = horseIconPath(
                ancestor.card_id,
                ancestor.rarity,
                ancestor.race_cloth_id,
              );
              return {
                key: `ancestor:${ancestor.position_id}:${ancestor.card_id}`,
                label: `父辈 ${index + 1}`,
                name: UMDB.cards[ancestor.card_id]?.name || ancestor.name,
                subtitle: ancestor.name,
                portrait: (
                  <span className="successionCapturedPortrait">
                    {ancestorIcon ? (
                      <AssetIcon
                        path={ancestorIcon}
                        alt={ancestor.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                ),
                factors: factorDetails(ancestor.factors || []),
              };
            }),
          ]}
          onClose={() => setDetailOpen(false)}
        />
      ) : null}
    </div>
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
