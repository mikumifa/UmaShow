import { useState } from 'react';
import { BadgeCheck, Bot, Globe2, ShoppingCart, Users } from 'lucide-react';
import {
  ARC_POTENTIAL_CONDITIONS,
  ARC_POTENTIALS,
  formatArcApprovalRate,
  formatArcSelectionEffect,
  getArcPotentialIconPath,
  getArcSelectionEffectIconPath,
  getArcTrainingEffect,
} from 'constant/arc';
import {
  TARGET_TYPE,
  type ArcData,
  type ArcRivalInfo,
  type CharInfo,
  type CommandParam,
} from 'types/gameTypes';
import { UMDB } from 'renderer/utils/umdb';
import assetUrl from 'renderer/utils/assetUrl';
import {
  TrainingEventsSection,
  VitalPanel,
} from 'renderer/components/monitor/SharedSections';
import { useMonteCarloRecommendation } from 'renderer/components/MonteCarloProvider';
import {
  RecommendationRankChip,
  rankRecommendationActions,
} from 'renderer/components/RecommendationRank';
import {
  buildArcPotentialPurchases,
  compactArcPotentialEffect,
  recommendedArcPotentialIds,
} from 'renderer/utils/arcRecommendation';

const TRAINING_ORDER = [101, 105, 102, 103, 106];
type ArcStatusPanel = 'potential' | 'rivals' | null;
const ARC_STATUS_PANEL_STORAGE_KEY = 'arcStatusBar.openPanel';

function readArcStatusPanel(): ArcStatusPanel {
  if (typeof window === 'undefined') return 'rivals';

  try {
    const stored = window.localStorage.getItem(ARC_STATUS_PANEL_STORAGE_KEY);
    if (stored === 'potential' || stored === 'rivals') return stored;
    if (stored === 'closed') return null;
  } catch {
    // Keep the default when storage is unavailable.
  }
  return 'rivals';
}

function saveArcStatusPanel(panel: ArcStatusPanel) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      ARC_STATUS_PANEL_STORAGE_KEY,
      panel ?? 'closed',
    );
  } catch {
    // The panel still works for the current session when storage is unavailable.
  }
}

const PARAM_LABELS: Record<number, string> = {
  [TARGET_TYPE.SPEED]: '速',
  [TARGET_TYPE.STAMINA]: '耐',
  [TARGET_TYPE.POWER]: '力',
  [TARGET_TYPE.GUTS]: '毅',
  [TARGET_TYPE.WIZ]: '智',
  [TARGET_TYPE.VITAL]: '体',
  [TARGET_TYPE.SKILL_PTS]: '技Pt',
};

const PARAM_STYLES: Record<number, string> = {
  [TARGET_TYPE.SPEED]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TARGET_TYPE.STAMINA]: 'border-rose-200 bg-rose-50 text-rose-700',
  [TARGET_TYPE.POWER]: 'border-orange-200 bg-orange-50 text-orange-700',
  [TARGET_TYPE.GUTS]: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  [TARGET_TYPE.WIZ]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TARGET_TYPE.VITAL]: 'border-lime-200 bg-lime-50 text-lime-700',
  [TARGET_TYPE.SKILL_PTS]: 'border-amber-200 bg-amber-50 text-amber-700',
};

const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const SS_MATCH_MARKS: Record<number, { iconPath: string; label: string }> = {
  1: {
    iconPath: './icons/arc/ss_match_mark_double_circle.png',
    label: '极高',
  },
  2: {
    iconPath: './icons/arc/ss_match_mark_circle.png',
    label: '较高',
  },
  3: {
    iconPath: './icons/arc/ss_match_mark_triangle_hollow.png',
    label: '一般',
  },
  4: {
    iconPath: './icons/arc/ss_match_mark_cross.png',
    label: '较低',
  },
};

const UNKNOWN_SS_MATCH_MARK = {
  iconPath: null,
  label: '未知',
};

const useArcUmaAiAction = () => {
  const { settings, capturedState, result } = useMonteCarloRecommendation();
  if (!settings.enabled || capturedState?.scenarioId !== 6 || !result?.ok) {
    return null;
  }
  return (
    result.actions?.find((action) => action.id === result.bestActionId) ?? null
  );
};

const useArcRankedRecommendations = () => {
  const { settings, capturedState, result } = useMonteCarloRecommendation();
  if (!settings.enabled || capturedState?.scenarioId !== 6 || !result?.ok) {
    return [];
  }
  return rankRecommendationActions(result);
};

const mergeParams = (...groups: Array<CommandParam[] | undefined>) => {
  const values = new Map<number, number>();
  groups
    .flatMap((group) => group ?? [])
    .forEach((param) => {
      values.set(
        param.targetType,
        (values.get(param.targetType) ?? 0) + param.value,
      );
    });
  return Array.from(values.entries())
    .map(([targetType, value]) => ({ targetType, value }))
    .filter((item) => item.value !== 0)
    .sort((left, right) => left.targetType - right.targetType);
};

const getPotentialCardStyle = (canUpgrade: boolean, unlocked: boolean) => {
  if (canUpgrade) {
    return 'border-amber-300 bg-amber-50 shadow-[0_0_0_2px_rgba(251,191,36,.12)]';
  }
  if (unlocked) return 'border-[#71BCFF] bg-[#71BCFF]/10';
  return 'border-gray-200 bg-gray-50';
};

const getPotentialEffectStyle = (
  effectLevel: number,
  currentLevel: number,
  nextLevel: number,
) => {
  if (effectLevel <= currentLevel) return 'font-bold text-slate-700';
  if (effectLevel === nextLevel) return 'font-medium text-amber-700';
  return 'text-gray-400';
};

const compactSelectionEffect = (effect: string) =>
  effect.replace(/^获得/, '').replace(/\s+/g, '');

function ParamChips({ params }: { params: CommandParam[] }) {
  if (params.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {params.map((param) => (
        <span
          key={param.targetType}
          className={`rounded-md border px-1.5 py-0.5 text-xs font-black ${
            PARAM_STYLES[param.targetType] ??
            'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {PARAM_LABELS[param.targetType] ?? `参数${param.targetType}`}{' '}
          {formatSigned(param.value)}
        </span>
      ))}
    </div>
  );
}

function RivalAvatar({
  rival,
  large = false,
  showLevel = true,
}: {
  rival: ArcRivalInfo;
  large?: boolean;
  showLevel?: boolean;
}) {
  const iconUrl = UMDB.arcRivalIconPath(rival.charaId);
  const fallbackIconUrl = UMDB.charaIconPath(rival.charaId);
  const name = UMDB.charaName(rival.charaId);
  return (
    <div
      className="group relative shrink-0"
      title={`${name} / 排名 ${rival.rank || '-'} / 协助者积分 ${rival.approvalPoint}`}
    >
      <div className={large ? 'h-12 w-12' : 'h-9 w-9'}>
        {iconUrl ? (
          <img
            src={assetUrl(iconUrl)}
            alt={name}
            className="h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = assetUrl(fallbackIconUrl);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-gray-400">
            {rival.charaId || '?'}
          </div>
        )}
      </div>
      {showLevel ? (
        <div className="absolute -bottom-1 -right-1 rounded-full border border-white bg-violet-600 px-1 text-[8px] font-black leading-3 text-white shadow-sm">
          {rival.starLevel}
        </div>
      ) : null}
    </div>
  );
}

function RivalBoostGauge({
  value,
  blocked,
}: {
  value: number;
  blocked: boolean;
}) {
  const current = Math.min(3, Math.max(0, value));
  return (
    <div
      className="flex h-12 w-3 shrink-0 flex-col-reverse gap-0.5"
      title={`群星槽 ${current}/3${blocked ? '（本回合锁定）' : ''}`}
    >
      {Array.from({ length: 3 }, (_, index) => {
        const filledStyles = [
          'border-[#FFD53C] bg-[#FFD53C]',
          'border-[#FFAB30] bg-[#FFAB30]',
          'border-[#FF852C] bg-[#FF852C]',
        ];
        let fill = 'border-[#EBEAEF] bg-[#EBEAEF]';
        if (index < current) {
          fill = filledStyles[index];
        }
        return (
          <span key={index} className={`flex-1 rounded-[2px] border ${fill}`} />
        );
      })}
    </div>
  );
}

function RivalBondGauge({ value }: { value: number }) {
  const progress = Math.min(100, Math.max(0, value));
  let progressColor = 'bg-[#2AC0FF]';
  if (progress >= 80) {
    progressColor = 'bg-[#FFAD1E]';
  } else if (progress >= 60) {
    progressColor = 'bg-[#A2E61E]';
  }
  return (
    <div
      className="relative z-20 -mt-1 h-2 w-9 overflow-hidden rounded-[3px] border border-gray-600 bg-gray-700"
      title={`羁绊 ${progress}/100`}
    >
      <div
        className={`h-full ${progressColor}`}
        style={{ width: `${progress}%` }}
      />
      <div className="pointer-events-none absolute inset-0 grid h-full w-full grid-cols-5">
        <div className="border-r border-black/20" />
        <div className="border-r border-black/20" />
        <div className="border-r border-black/20" />
        <div className="border-r border-black/20" />
        <div />
      </div>
    </div>
  );
}

function RivalSelectionEffects({
  rival,
  currentOnly = false,
}: {
  rival: ArcRivalInfo;
  currentOnly?: boolean;
}) {
  const sortedEffects = rival.selectionEffects
    .slice()
    .sort((left, right) => left.effectNum - right.effectNum)
    .slice(0, 3);
  const effects = currentOnly ? sortedEffects.slice(0, 1) : sortedEffects;
  const activeEffectNum = effects[0]?.effectNum;

  return (
    <div className="grid min-w-0 flex-1 gap-0.5">
      {effects.map((effect) => {
        const label = formatArcSelectionEffect(
          effect.effectGroupId,
          effect.effectValue,
        );
        const iconPath = getArcSelectionEffectIconPath(effect.effectGroupId);
        const isActive = effect.effectNum === activeEffectNum;
        return (
          <div
            key={effect.effectNum}
            className={`flex min-w-0 items-center gap-0.5 rounded border font-bold ${
              currentOnly
                ? 'px-1.5 py-1 text-[11px]'
                : 'px-1 py-0.5 text-[9px] leading-3'
            } ${
              isActive
                ? 'border-[#FF9741] bg-[#FF9741] text-[#875632]'
                : 'border-[#FF9741]/30 bg-white text-[#875632]'
            }`}
            title={isActive ? `当前词条：${label}` : label}
          >
            {iconPath ? (
              <img
                src={iconPath}
                alt=""
                className="h-3 w-3 shrink-0 object-contain"
              />
            ) : null}
            <span className="truncate">{compactSelectionEffect(label)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* eslint-disable no-use-before-define -- 展开内容组件定义在状态卡之后，保持页面组件按视觉顺序排列。 */
function ArcStatusBar({
  arcData,
  partnerStats,
}: {
  arcData: ArcData;
  partnerStats: CharInfo['partnerStats'];
}) {
  const umaAiAction = useArcUmaAiAction();
  const rankedRecommendations = useArcRankedRecommendations();
  const umaAiPotentialIds = recommendedArcPotentialIds(umaAiAction);
  const ssRecommendation = rankedRecommendations.find(
    ({ action }) => action.train === 5,
  );
  const recommendedPotentialPurchases = buildArcPotentialPurchases(
    arcData,
    umaAiPotentialIds,
    3,
  );
  const [openPanel, setOpenPanel] =
    useState<ArcStatusPanel>(readArcStatusPanel);
  const togglePanel = (panel: Exclude<ArcStatusPanel, null>) => {
    setOpenPanel((current) => {
      const next = current === panel ? null : panel;
      saveArcStatusPanel(next);
      return next;
    });
  };
  const trainingEffect = getArcTrainingEffect(arcData.approvalRate);
  const upgradeable = ARC_POTENTIALS.filter((meta) => {
    const current = arcData.potentials.find(
      (potential) => potential.potentialId === meta.id,
    );
    const currentLevel = current?.level ?? 0;
    const nextCost = meta.levelCosts[currentLevel + 1];
    return nextCost != null && arcData.globalExp >= nextCost;
  }).length;
  const selection = arcData.selectionInfo;
  const matchParams = selection
    ? mergeParams(selection.params, selection.bonusParams)
    : [];
  const arcCharaIdByTargetId = new Map(
    arcData.evaluationInfo.map((item) => [item.targetId, item.charaId]),
  );
  const evaluationByCharaId = new Map(
    partnerStats.flatMap((partner) => {
      const hasBondGauge = !(
        partner.supportCardId === 0 && partner.position >= 1000
      );
      if (!hasBondGauge) return [];

      const charaId =
        arcCharaIdByTargetId.get(partner.position) ??
        (partner.position >= 1000 ? partner.position : undefined);
      return charaId != null ? [[charaId, partner.evaluation] as const] : [];
    }),
  );
  const rivalByCharaId = new Map(
    arcData.rivals.map((rival) => [rival.charaId, rival]),
  );
  const chargedSelectionRivals =
    selection?.rivals.filter(
      (selectionRival) =>
        (rivalByCharaId.get(selectionRival.charaId)?.rivalBoost ?? 0) > 0,
    ) ?? [];
  const visibleSelection =
    selection && chargedSelectionRivals.length > 0
      ? { ...selection, rivals: chargedSelectionRivals }
      : null;
  const hasExpandedContent =
    recommendedPotentialPurchases.length > 0 ||
    visibleSelection !== null ||
    openPanel !== null;
  return (
    <section
      className={`relative h-fit flex-none rounded-xl bg-white shadow-sm ${
        hasExpandedContent ? 'px-3 py-2' : 'px-2 py-1'
      }`}
    >
      {visibleSelection?.isSpecialMatch ? (
        <div className="pointer-events-none absolute -inset-[3px] z-20 animate-pulse rounded-[14px] border-2 border-[#FB689D] shadow-[0_0_14px_4px_rgba(251,104,157,0.75)] [animation-duration:0.5s]" />
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <div className="mr-1 flex items-center gap-1 font-black text-slate-800">
          <Globe2 className="text-[#3CA2FF]" size={16} />
          凯旋门
        </div>
        <span className="rounded-md border border-[#71BCFF] bg-white/80 px-2 py-1 font-bold text-[#3CA2FF]">
          期待 {formatArcApprovalRate(arcData.approvalRate)} · 训练 +
          {trainingEffect}%
        </span>
        <span className="rounded-md border border-[#71BCFF] bg-white/80 px-2 py-1 font-bold text-[#3CA2FF]">
          适性Pt {arcData.globalExp}
          {upgradeable > 0 ? ` · ${upgradeable}项可升` : ''}
        </span>
        <span className="rounded-md border border-[#71BCFF] bg-white/80 px-2 py-1 font-bold text-[#3CA2FF]">
          SS {arcData.ssMatchWinCount}胜 · SSS {arcData.specialSsMatchWinCount}
          胜
        </span>
        {ssRecommendation ? (
          <RecommendationRankChip recommendation={ssRecommendation} />
        ) : null}
        {visibleSelection ? <ParamChips params={matchParams} /> : null}
        {arcData.allRivalBoostBlocked ? (
          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 font-black text-rose-700">
            群星槽锁定
          </span>
        ) : null}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-black transition-colors ${
              openPanel === 'potential'
                ? 'border-[#3CA2FF] bg-gradient-to-r from-[#71BCFF] to-[#3CA2FF] text-white'
                : 'border-[#71BCFF] bg-white/80 text-[#3CA2FF] hover:bg-[#71BCFF]/10'
            }`}
            onClick={() => togglePanel('potential')}
          >
            <BadgeCheck size={13} /> 海外适应性
            {umaAiPotentialIds.size > 0
              ? ` · 推荐${umaAiPotentialIds.size}项`
              : ''}
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-black transition-colors ${
              openPanel === 'rivals'
                ? 'border-[#3CA2FF] bg-gradient-to-r from-[#71BCFF] to-[#3CA2FF] text-white'
                : 'border-[#71BCFF] bg-white/80 text-[#3CA2FF] hover:bg-[#71BCFF]/10'
            }`}
            onClick={() => togglePanel('rivals')}
          >
            <Users size={13} /> 凯旋门计划成员
          </button>
        </div>
      </div>
      {recommendedPotentialPurchases.length > 0 ? (
        <div className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border-2 border-amber-400 bg-amber-100/70 px-2 py-1 ring-2 ring-amber-200">
          <span className="inline-flex items-center gap-1 text-xs font-black text-amber-900">
            <ShoppingCart size={13} strokeWidth={2.5} /> 先购买
          </span>
          {recommendedPotentialPurchases.map((purchase) => (
            <span
              key={purchase.id}
              className="rounded-md border border-amber-300 bg-white/85 px-2 py-0.5 text-xs font-black text-amber-900"
            >
              {purchase.name} Lv3
              {purchase.cost ? ` · ${purchase.cost}Pt` : ''} · {purchase.effect}
            </span>
          ))}
        </div>
      ) : null}
      {visibleSelection ? (
        <div className="mt-1.5">
          <div
            className="inline-flex max-w-full flex-wrap items-stretch gap-1 rounded-lg"
            title={
              ssRecommendation
                ? `第 ${ssRecommendation.rank} 名 · ${ssRecommendation.action.label}`
                : ''
            }
          >
            {openPanel === 'rivals'
              ? visibleSelection.rivals.map((selectionRival) => {
                  const rival = arcData.rivals.find(
                    (item) => item.charaId === selectionRival.charaId,
                  );
                  const isFullyCharged = (rival?.rivalBoost ?? 0) >= 3;
                  let compactSelectionStyle =
                    'border border-[#3CA2FF] bg-[#71BCFF]/10 p-1';
                  if (isFullyCharged) {
                    compactSelectionStyle =
                      'border-0 bg-gradient-to-r from-[#FFC2D3] via-[#FFE8EF] to-white p-1 ring-0';
                  }
                  return rival ? (
                    <div
                      key={selectionRival.charaId}
                      className={`relative min-w-28 overflow-hidden rounded-lg ${compactSelectionStyle}`}
                    >
                      <div>
                        <RivalSelectionEffects rival={rival} currentOnly />
                      </div>
                    </div>
                  ) : null;
                })
              : visibleSelection.rivals.map((selectionRival) => {
                  const rival = arcData.rivals.find(
                    (item) => item.charaId === selectionRival.charaId,
                  );
                  const name = UMDB.charaName(selectionRival.charaId);
                  const evaluation = evaluationByCharaId.get(
                    selectionRival.charaId,
                  );
                  const matchMark =
                    SS_MATCH_MARKS[selectionRival.mark] ??
                    UNKNOWN_SS_MATCH_MARK;
                  const isFullyCharged = (rival?.rivalBoost ?? 0) >= 3;
                  let selectionCardStyle =
                    'border border-[#3CA2FF] bg-[#71BCFF]/10 p-1';
                  if (isFullyCharged) {
                    selectionCardStyle =
                      'border-0 bg-gradient-to-r from-[#FFC2D3] via-[#FFE8EF] to-white p-1 ring-0';
                  }
                  return (
                    <article
                      key={selectionRival.charaId}
                      className={`relative min-w-0 overflow-hidden rounded-lg ${selectionCardStyle}`}
                      title={`${name} · 胜算${matchMark.label}${visibleSelection.isSpecialMatch ? ' · SSS超星赛' : ''}`}
                    >
                      <div>
                        <div className="flex items-center gap-1">
                          {rival ? (
                            <div className="flex shrink-0 flex-col items-center">
                              <div className="relative">
                                <RivalAvatar
                                  rival={rival}
                                  large
                                  showLevel={false}
                                />
                                {matchMark.iconPath ? (
                                  <img
                                    src={matchMark.iconPath}
                                    alt={`胜算：${matchMark.label}`}
                                    title={`胜算：${matchMark.label}`}
                                    className="absolute -right-1 -top-1 z-30 h-[18px] w-[18px] object-contain drop-shadow-sm"
                                  />
                                ) : (
                                  <span className="absolute -right-1 -top-1 z-30 text-2xl font-black text-slate-500">
                                    ?
                                  </span>
                                )}
                              </div>
                              {evaluation !== undefined ? (
                                <RivalBondGauge value={evaluation} />
                              ) : null}
                            </div>
                          ) : null}
                          {rival ? (
                            <RivalSelectionEffects rival={rival} currentOnly />
                          ) : null}
                        </div>
                        {!rival ? (
                          <div className="flex h-12 items-center justify-between gap-2 px-1 text-xs font-bold text-slate-500">
                            <span className="truncate">{name}</span>
                            {matchMark.iconPath ? (
                              <img
                                src={matchMark.iconPath}
                                alt={`胜算：${matchMark.label}`}
                                className="h-[18px] w-[18px] object-contain"
                              />
                            ) : (
                              <span>?</span>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
          </div>
        </div>
      ) : null}
      {openPanel ? (
        <div className="mt-2 border-t border-[#71BCFF]/40 pt-2">
          {openPanel === 'potential' ? (
            <ArcPotentialPanel arcData={arcData} />
          ) : (
            <ArcRivalPanel arcData={arcData} />
          )}
        </div>
      ) : null}
    </section>
  );
}
/* eslint-enable no-use-before-define */

function ArcPotentialPanel({ arcData }: { arcData: ArcData }) {
  const umaAiAction = useArcUmaAiAction();
  const umaAiPotentialIds = recommendedArcPotentialIds(umaAiAction);
  const currentById = new Map(
    arcData.potentials.map((potential) => [potential.potentialId, potential]),
  );
  const sorted = [...ARC_POTENTIALS].sort(
    (left, right) => left.row - right.row || left.queue - right.queue,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
        {sorted.map((meta) => {
          const current = currentById.get(meta.id);
          const level = current?.level ?? 0;
          const nextLevel = level + 1;
          const nextCost = meta.levelCosts[nextLevel];
          const canUpgrade = nextCost != null && arcData.globalExp >= nextCost;
          const progress = current?.progress ?? [];
          const unlocked = level > 0;
          const isUmaAiRecommended = umaAiPotentialIds.has(meta.id);
          const cardStyle = isUmaAiRecommended
            ? 'border-indigo-500 bg-indigo-50 shadow-[0_0_0_2px_rgba(99,102,241,.18)]'
            : getPotentialCardStyle(canUpgrade, unlocked);
          let upgradeStatus = null;
          if (level >= meta.maxLevel) {
            upgradeStatus = (
              <div className="mt-1 rounded bg-emerald-100 py-0.5 text-center text-[9px] font-black text-emerald-700">
                已满级
              </div>
            );
          } else if (nextCost != null) {
            upgradeStatus = (
              <div
                className={`mt-1 rounded py-0.5 text-center text-[9px] font-black ${
                  canUpgrade
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-white text-slate-500'
                }`}
              >
                升 Lv{nextLevel}：{nextCost} Pt
              </div>
            );
          }
          return (
            <article
              key={meta.id}
              className={`min-w-0 rounded-lg border p-2 transition-colors ${cardStyle}`}
            >
              <div className="flex items-center gap-1.5">
                <img
                  src={getArcPotentialIconPath(meta.id)}
                  alt={meta.name}
                  className={`h-8 w-8 shrink-0 object-contain ${unlocked ? '' : 'grayscale opacity-45'}`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[11px] font-black text-slate-800"
                    title={meta.name}
                  >
                    {meta.name}
                  </div>
                  <div
                    className="mt-1 flex items-center gap-1"
                    title={`Lv${level}/${meta.maxLevel}`}
                  >
                    {Array.from(
                      { length: meta.maxLevel },
                      (_, index) => index + 1,
                    ).map((itemLevel) => (
                      <span
                        key={itemLevel}
                        className={`h-2 flex-1 rounded-full ${
                          itemLevel <= level ? 'bg-cyan-500' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {isUmaAiRecommended ? (
                <div className="mt-1 flex items-center justify-center gap-1 rounded bg-indigo-600 py-0.5 text-[9px] font-black text-white">
                  <Bot size={10} /> 建议升至 Lv3
                </div>
              ) : null}

              <div className="mt-1 space-y-0.5">
                {Object.entries(meta.levelEffects).map(([rawLevel, effect]) => {
                  const effectLevel = Number(rawLevel);
                  return (
                    <div
                      key={rawLevel}
                      title={effect}
                      className={`truncate text-[9px] leading-3.5 ${getPotentialEffectStyle(
                        effectLevel,
                        level,
                        nextLevel,
                      )}`}
                    >
                      L{effectLevel} · {compactArcPotentialEffect(effect)}
                    </div>
                  );
                })}
              </div>

              {progress.length > 0 ? (
                <div className="mt-1 space-y-0.5 border-t border-black/5 pt-1">
                  {progress.map((item) => {
                    const total = item.totalCount || 1;
                    const rate = Math.min(
                      100,
                      (item.currentCount / total) * 100,
                    );
                    return (
                      <div key={item.conditionId}>
                        <div className="flex justify-between gap-1 text-[8px] font-bold text-slate-500">
                          <span className="truncate">
                            {ARC_POTENTIAL_CONDITIONS[item.conditionId] ??
                              `条件 ${item.conditionId}`}
                          </span>
                          <span>
                            {item.currentCount}/{item.totalCount}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                        className="h-full rounded-full bg-gradient-to-r from-[#71BCFF] to-[#3CA2FF]"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {upgradeStatus}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArcRivalPanel({ arcData }: { arcData: ArcData }) {
  const blockedRivalIds = new Set(arcData.rivalBoostBlockedCharaIds);
  const currentRivalOrder = new Map(
    (arcData.selectionInfo?.rivals ?? []).map((rival, index) => [
      rival.charaId,
      index,
    ]),
  );
  const currentRivalIds = new Set(currentRivalOrder.keys());
  const sorted = arcData.rivals
    .filter((rival) => rival.selectionEffects.length > 0)
    .sort((left, right) => {
      const leftCurrentOrder = currentRivalOrder.get(left.charaId);
      const rightCurrentOrder = currentRivalOrder.get(right.charaId);
      const leftIsCurrent = leftCurrentOrder !== undefined;
      const rightIsCurrent = rightCurrentOrder !== undefined;
      if (leftIsCurrent !== rightIsCurrent) return leftIsCurrent ? -1 : 1;
      if (leftIsCurrent && rightIsCurrent) {
        return (leftCurrentOrder ?? 0) - (rightCurrentOrder ?? 0);
      }

      const leftIsFullyCharged = left.rivalBoost >= 3;
      const rightIsFullyCharged = right.rivalBoost >= 3;
      if (leftIsFullyCharged !== rightIsFullyCharged) {
        return leftIsFullyCharged ? -1 : 1;
      }
      if (left.rivalBoost !== right.rivalBoost) {
        return right.rivalBoost - left.rivalBoost;
      }

      const leftOrder = TRAINING_ORDER.indexOf(left.commandId);
      const rightOrder = TRAINING_ORDER.indexOf(right.commandId);
      return (
        (leftOrder < 0 ? 99 : leftOrder) - (rightOrder < 0 ? 99 : rightOrder) ||
        right.starLevel - left.starLevel ||
        left.rank - right.rank
      );
    });
  if (sorted.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {sorted.map((rival) => {
          const isCurrent = currentRivalIds.has(rival.charaId);
          const isFullyCharged = rival.rivalBoost >= 3;
          const isBlocked =
            arcData.allRivalBoostBlocked || blockedRivalIds.has(rival.charaId);
          let rivalCardStyle = 'border border-[#515055]/40 bg-[#515055]/5';
          if (isFullyCharged) {
            rivalCardStyle =
              'border-0 bg-gradient-to-r from-[#FFC2D3] via-[#FFE8EF] to-white ring-0';
          } else if (isCurrent) {
            rivalCardStyle =
              'border border-[#3CA2FF] bg-[#71BCFF]/10 ring-1 ring-[#3CA2FF]/30';
          }
          return (
            <article
              key={rival.charaId}
              className={`relative min-w-0 rounded-lg p-1.5 ${rivalCardStyle}`}
            >
              <div className="flex items-center gap-1.5">
                <RivalAvatar rival={rival} large showLevel={false} />
                <RivalSelectionEffects rival={rival} />
                <RivalBoostGauge value={rival.rivalBoost} blocked={isBlocked} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function ArcPanel({ charInfo }: { charInfo: CharInfo }) {
  const { arcData } = charInfo;
  if (!arcData) {
    return (
      <>
        <VitalPanel charInfo={charInfo} />
        <section className="rounded-2xl border border-[#71BCFF] bg-gradient-to-r from-[#71BCFF]/20 to-[#3CA2FF]/20 p-5 text-center shadow-sm">
          <Globe2 className="mx-auto text-[#3CA2FF]" size={30} />
          <h2 className="mt-2 font-black text-slate-800">已识别凯旋门剧本</h2>
          <p className="mt-1 text-xs text-slate-500">
            等待下一份包含 arc_data_set 的游戏数据包。
          </p>
        </section>
        <TrainingEventsSection charInfo={charInfo} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <VitalPanel charInfo={charInfo} />
      <ArcStatusBar arcData={arcData} partnerStats={charInfo.partnerStats} />
      <TrainingEventsSection charInfo={charInfo} compact />
    </div>
  );
}
