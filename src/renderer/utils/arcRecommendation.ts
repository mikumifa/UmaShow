import { ARC_POTENTIALS, type ArcPotentialMeta } from 'constant/arc';
import type { ArcData } from 'types/gameTypes';
import type { MonteCarloActionResult } from 'types/monteCarlo';

const LARC_TRAIN_POTENTIAL_IDS = [4, 5, 1, 2, 6];

export const LARC_FIRST_EXPEDITION_PREP_TURN = 36;
export const LARC_REQUIRED_FIRST_EXPEDITION_POTENTIAL_IDS = [1, 2];
export const LARC_JUNIOR_YEAR_END_PREP_TURN = 24;
export const LARC_REQUIRED_JUNIOR_YEAR_END_POTENTIAL_IDS = [2, 5];

export type ArcPotentialPurchase = {
  id: number;
  name: string;
  currentLevel: number;
  targetLevel: number;
  cost: number;
  effect: string;
};

export type ArcPotentialPurchaseReminder = {
  label: string;
  purchases: ArcPotentialPurchase[];
};

export const compactArcPotentialEffect = (effect: string) =>
  effect
    .replace(/^训练时/, '')
    .replace(/^克服海外赛/, '海外赛')
    .replace(/适性下降$/, '适性')
    .replace(/\s*难关$/, '')
    .replace(/^远征时/, '')
    .replace(/^所有训练效果\s*\+/, '全训练+')
    .replace(/^友情训练效果\s*\+/, '友情+')
    .replace(/训练效果\s*\+/, '训练+')
    .replace(/^远征训练体力消耗\s*-/, '远征体力-')
    .replace(/^凯旋门奖中获得 3 个特定技能启发$/, '凯旋门技能启发×3')
    .replace(/^凯旋门奖赛事中获得的属性提升$/, '凯旋门属性提升');

export const recommendedArcPotentialIds = (
  action: MonteCarloActionResult | null | undefined,
) => {
  const result = new Set<number>();
  if (!action) return result;
  if (action.buy50p && action.train >= 0 && action.train < 5) {
    result.add(LARC_TRAIN_POTENTIAL_IDS[action.train]);
  }
  if (action.buyPt10) result.add(3);
  if (action.buyVital20) result.add(7);
  if (action.buyFriend20) result.add(8);
  return result;
};

const currentPotentialLevel = (arcData: ArcData, potentialId: number) =>
  arcData.potentials.find((potential) => potential.potentialId === potentialId)
    ?.level ?? 0;

const purchaseCost = (
  potential: ArcPotentialMeta,
  currentLevel: number,
  targetLevel: number,
) => {
  let cost = 0;
  for (
    let level = Math.max(1, currentLevel + 1);
    level <= targetLevel;
    level += 1
  ) {
    cost += potential.levelCosts[level] ?? 0;
  }
  return cost;
};

export const buildArcPotentialPurchases = (
  arcData: ArcData,
  potentialIds: Iterable<number>,
  targetLevel: number,
) => {
  const idSet = new Set(potentialIds);
  return ARC_POTENTIALS.filter((potential) => idSet.has(potential.id))
    .map((potential): ArcPotentialPurchase | null => {
      const currentLevel = currentPotentialLevel(arcData, potential.id);
      const resolvedTargetLevel = Math.min(targetLevel, potential.maxLevel);
      if (currentLevel >= resolvedTargetLevel) return null;
      return {
        id: potential.id,
        name: potential.name,
        currentLevel,
        targetLevel: resolvedTargetLevel,
        cost: purchaseCost(potential, currentLevel, resolvedTargetLevel),
        effect: compactArcPotentialEffect(
          potential.levelEffects[resolvedTargetLevel],
        ),
      };
    })
    .filter((purchase): purchase is ArcPotentialPurchase => purchase !== null);
};

export const requiredFirstExpeditionPurchases = (
  arcData: ArcData,
  turn: number,
) => {
  if (turn < LARC_FIRST_EXPEDITION_PREP_TURN) return [];
  return buildArcPotentialPurchases(
    arcData,
    LARC_REQUIRED_FIRST_EXPEDITION_POTENTIAL_IDS,
    2,
  );
};

export const requiredJuniorYearEndPurchases = (
  arcData: ArcData,
  turn: number,
) => {
  if (turn < LARC_JUNIOR_YEAR_END_PREP_TURN) return [];
  return buildArcPotentialPurchases(
    arcData,
    LARC_REQUIRED_JUNIOR_YEAR_END_POTENTIAL_IDS,
    2,
  );
};

export const requiredArcPotentialPurchaseReminders = (
  arcData: ArcData,
  turn: number,
): ArcPotentialPurchaseReminder[] => {
  const reminders = [
    {
      label: '初级 12月后半提醒',
      purchases: requiredJuniorYearEndPurchases(arcData, turn),
    },
    {
      label: '经典级 6月后半提醒',
      purchases: requiredFirstExpeditionPurchases(arcData, turn),
    },
  ];
  const claimedPotentialIds = new Set<number>();

  return reminders
    .reverse()
    .map((reminder) => {
      const purchases = reminder.purchases.filter((purchase) => {
        if (claimedPotentialIds.has(purchase.id)) return false;
        claimedPotentialIds.add(purchase.id);
        return true;
      });
      return { ...reminder, purchases };
    })
    .reverse()
    .filter((reminder) => reminder.purchases.length > 0);
};
