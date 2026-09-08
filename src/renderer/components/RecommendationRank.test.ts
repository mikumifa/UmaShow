import type {
  MonteCarloActionResult,
  MonteCarloResult,
} from 'types/monteCarlo';
import { rankRecommendationActions } from './RecommendationRank';

const action = (
  values: Partial<MonteCarloActionResult> &
    Pick<MonteCarloActionResult, 'id' | 'train' | 'label'>,
): MonteCarloActionResult => ({
  type: 0,
  overdrive: false,
  searches: 1,
  scoreMean: 0,
  scoreStdev: 0,
  value: 0,
  deltaFromBest: 0,
  ...values,
});

describe('recommendation ranking', () => {
  it('keeps the model-selected action first even when another value is higher', () => {
    const result: MonteCarloResult = {
      ok: true,
      backend: 'graph',
      bestActionId: 1,
      actions: [
        action({
          id: 1,
          train: 0,
          label: '速度训练 + 购买训练效果',
          searches: 60,
          value: 100,
        }),
        action({
          id: 2,
          train: 1,
          label: '耐力训练',
          searches: 40,
          value: 120,
        }),
      ],
    };

    expect(
      rankRecommendationActions(result).map(({ action: item }) => item.id),
    ).toEqual([1, 2]);
  });

  it('uses the exact selected variant when one training has several actions', () => {
    const result: MonteCarloResult = {
      ok: true,
      backend: 'graph',
      bestActionId: 1,
      actions: [
        action({
          id: 1,
          train: 0,
          label: '速度训练 + 购买训练效果',
          searches: 60,
          value: 100,
        }),
        action({
          id: 3,
          train: 0,
          label: '速度训练',
          searches: 20,
          value: 130,
        }),
        action({
          id: 2,
          train: 1,
          label: '耐力训练',
          searches: 40,
          value: 120,
        }),
      ],
    };

    const ranked = rankRecommendationActions(result);
    expect(ranked[0]).toMatchObject({
      action: expect.objectContaining({ id: 1 }),
      rank: 1,
      isBest: true,
    });
    expect(ranked.map(({ action: item }) => item.id)).not.toContain(3);
  });
});
