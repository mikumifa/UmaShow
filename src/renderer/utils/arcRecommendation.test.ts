import type { ArcData } from 'types/gameTypes';
import type { MonteCarloActionResult } from 'types/monteCarlo';
import {
  buildArcPotentialPurchases,
  recommendedArcPotentialIds,
  requiredFirstExpeditionPurchases,
} from './arcRecommendation';

const makeArcData = (levels: Record<number, number>): ArcData =>
  ({
    approvalRate: 0,
    globalExp: 0,
    spTagBoostType: 0,
    ssMatchWinCount: 0,
    specialSsMatchWinCount: 0,
    potentials: Object.entries(levels).map(([potentialId, level]) => ({
      potentialId: Number(potentialId),
      level,
      progress: [],
    })),
    rivals: [],
    rivalRaceInfo: [],
    raceHistory: [],
    commandInfo: [],
    evaluationInfo: [],
    rivalBoostBlockedCharaIds: [],
    allRivalBoostBlocked: false,
  }) satisfies ArcData;

const makeAction = (
  values: Partial<MonteCarloActionResult>,
): MonteCarloActionResult => ({
  id: 1,
  label: '速度训练',
  type: 0,
  train: 0,
  overdrive: false,
  searches: 1,
  scoreMean: 0,
  scoreStdev: 0,
  value: 0,
  deltaFromBest: 0,
  ...values,
});

describe('arc recommendation purchases', () => {
  it('starts the first-expedition reminder at classic June late', () => {
    const arcData = makeArcData({ 1: 1, 2: 1 });

    expect(requiredFirstExpeditionPurchases(arcData, 35)).toEqual([]);
    expect(
      requiredFirstExpeditionPurchases(arcData, 36).map((item) => item.id),
    ).toEqual([1, 2]);
  });

  it('removes mandatory reminders after each aptitude reaches level 2', () => {
    const purchases = requiredFirstExpeditionPurchases(
      makeArcData({ 1: 2, 2: 1 }),
      36,
    );

    expect(purchases.map((item) => item.id)).toEqual([2]);
    expect(purchases[0].cost).toBe(50);
  });

  it('maps the best action purchase flags to their aptitude ids', () => {
    const ids = recommendedArcPotentialIds(
      makeAction({ train: 0, buy50p: true, buyPt10: true }),
    );

    expect([...ids]).toEqual([4, 3]);
  });

  it('shows the remaining total cost when recommending level 3', () => {
    const purchases = buildArcPotentialPurchases(makeArcData({ 4: 1 }), [4], 3);

    expect(purchases).toEqual([
      expect.objectContaining({ id: 4, targetLevel: 3, cost: 300 }),
    ]);
  });
});
