import type { ArcData } from 'types/gameTypes';
import type { MonteCarloActionResult } from 'types/monteCarlo';
import {
  buildArcPotentialPurchases,
  recommendedArcPotentialIds,
  requiredArcPotentialPurchaseReminders,
  requiredFirstExpeditionPurchases,
  requiredJuniorYearEndPurchases,
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

  it('starts the aptitude reminder at junior December late', () => {
    const arcData = makeArcData({ 2: 1, 5: 1 });

    expect(requiredJuniorYearEndPurchases(arcData, 23)).toEqual([]);
    expect(
      requiredJuniorYearEndPurchases(arcData, 24).map((item) => item.id),
    ).toEqual([2, 5]);
  });

  it('only reminds about junior year-end aptitudes that are not purchased', () => {
    const purchases = requiredJuniorYearEndPurchases(
      makeArcData({ 2: 2, 5: 1 }),
      24,
    );

    expect(purchases).toEqual([
      expect.objectContaining({ id: 5, name: '隆尚适应性', targetLevel: 2 }),
    ]);
  });

  it('assigns overlapping purchases to the latest reminder', () => {
    const reminders = requiredArcPotentialPurchaseReminders(
      makeArcData({ 1: 1, 2: 1, 5: 1 }),
      36,
    );

    expect(reminders).toEqual([
      expect.objectContaining({
        label: '初级 12月后半提醒',
        purchases: [expect.objectContaining({ id: 5 })],
      }),
      expect.objectContaining({
        label: '经典级 6月后半提醒',
        purchases: [
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 }),
        ],
      }),
    ]);
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
