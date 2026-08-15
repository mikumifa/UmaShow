import { useState } from 'react';
import { Check } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { UMDB } from 'renderer/utils/umdb';
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
  distance: 'border-pink-200 bg-pink-50 text-pink-700',
  unique: 'border-amber-200 bg-amber-50 text-amber-800',
  white: 'border-gray-200 bg-white text-gray-600',
};

function factorSummary(
  factors: FactorInfo[],
  summary?: FactorSummary,
): FactorSummary {
  return (
    summary || {
      stat: factors.find((factor) => factor.category === 'stat') || null,
      distance:
        factors.find((factor) => factor.category === 'distance') || null,
      unique:
        [...factors].reverse().find((factor) => factor.category === 'unique') ||
        null,
      white_count: factors.filter((factor) => factor.category === 'white')
        .length,
    }
  );
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
    <div className="flex flex-wrap gap-1">
      {featured.map((factor) => (
        <span
          key={factor.id}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${FACTOR_COLORS[factor.category] || FACTOR_COLORS.white}`}
        >
          {factor.name} {'★'.repeat(Math.max(1, factor.stars))}
        </span>
      ))}
      <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-500">
        白因子 ×{current.white_count}
      </span>
    </div>
  );
}

function FactorDetailList({ factors }: { factors: FactorInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {factors.map((factor) => (
        <span
          key={factor.id}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${FACTOR_COLORS[factor.category] || FACTOR_COLORS.white}`}
          title={`因子 ID ${factor.id}`}
        >
          {factor.name} {'★'.repeat(Math.max(1, factor.stars))}
        </span>
      ))}
    </div>
  );
}

export function ParentChoiceCard({
  parent,
  selected,
  disabled,
  onSelect,
}: {
  parent: Dashboard['parents'][number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
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
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                parent.source === 'rental'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {parent.source === 'rental' ? '借用' : '自己的'}
            </span>
          </span>
          <FactorSummaryView
            factors={parent.factors || []}
            summary={parent.factor_summary}
          />
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
        onClick={() => setExpanded((current) => !current)}
        className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
      >
        {expanded ? '收起详细因子' : '查看详细因子'}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          <div>
            <div className="mb-1 text-[11px] font-medium text-gray-500">
              本体因子
            </div>
            <FactorDetailList factors={parent.factors || []} />
          </div>
          {parent.ancestors.map((ancestor) => (
            <div key={`detail-${ancestor.position_id}`}>
              <div className="mb-1 text-[11px] font-medium text-gray-500">
                祖辈 {ancestor.position_id === 10 ? '1' : '2'} · {ancestor.name}
              </div>
              <FactorDetailList factors={ancestor.factors || []} />
            </div>
          ))}
        </div>
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
