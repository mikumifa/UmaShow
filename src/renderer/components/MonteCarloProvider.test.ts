import {
  analyzeRecommendationWithRetry,
  DEFAULT_UMA_AI_SETTINGS,
  mergeRecommendationResults,
  normalizeUmaAiSettings,
  recommendationStabilitySignature,
} from './MonteCarloProvider';

describe('recommendation settings', () => {
  it('retries a transient cancellation for the current turn', async () => {
    const analyze = jest
      .fn<Promise<{ ok: boolean; error?: string }>, []>()
      .mockResolvedValueOnce({ ok: false, error: '推荐已停用' })
      .mockResolvedValueOnce({ ok: true });
    const waitForStops = jest.fn(async () => undefined);

    await expect(
      analyzeRecommendationWithRetry({
        analyze,
        isCurrent: () => true,
        waitForStops,
        retryDelayMs: 0,
      }),
    ).resolves.toEqual({ ok: true });
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(waitForStops).toHaveBeenCalledTimes(2);
  });

  it('keeps attribute targets automatic by default', () => {
    expect(DEFAULT_UMA_AI_SETTINGS.options).toMatchObject({
      targetSpeed: 0,
      targetStamina: 0,
      targetPower: 0,
      targetGuts: 0,
      targetWisdom: 0,
      modelPath: '',
      graphSearchNodes: 384,
      graphSearchDepth: 5,
      graphInferenceBatchSize: 32,
      graphRootSelection: 'puct',
      graphRootGumbelMaxActions: 16,
      graphRootGumbelScale: 1,
    });
    expect(DEFAULT_UMA_AI_SETTINGS.refinementIntervalMs).toBe(500);
    expect(DEFAULT_UMA_AI_SETTINGS.refinementParallelism).toBe(1);
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('seed');
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('maxDepth');
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('scoringMode');
  });

  it('normalizes the automatic refinement interval', () => {
    const normalizeInterval = (refinementIntervalMs?: number) =>
      normalizeUmaAiSettings({ refinementIntervalMs }).refinementIntervalMs;

    expect(normalizeInterval(1250.4)).toBe(1250);
    expect(normalizeInterval(-1)).toBe(0);
    expect(normalizeInterval(99999)).toBe(10000);
    expect(normalizeInterval()).toBe(500);
  });

  it('normalizes the automatic refinement parallelism', () => {
    const normalizeParallelism = (refinementParallelism?: number) =>
      normalizeUmaAiSettings({ refinementParallelism }).refinementParallelism;

    expect(normalizeParallelism(2.6)).toBe(3);
    expect(normalizeParallelism(0)).toBe(1);
    expect(normalizeParallelism(99)).toBe(4);
    expect(normalizeParallelism()).toBe(1);
  });

  it('drops settings that are not used by the LArc recommendation engine', () => {
    const settings = normalizeUmaAiSettings({
      enabled: true,
      options: {
        seed: 123,
        searchTotalMax: 9999,
        searchGroupSize: 256,
        searchCpuct: 8,
        maxDepth: 12,
        scorePtRate: 4,
        scoringMode: 6,
      },
    });

    expect(settings.options).not.toHaveProperty('seed');
    expect(settings.options).not.toHaveProperty('searchTotalMax');
    expect(settings.options).not.toHaveProperty('searchGroupSize');
    expect(settings.options).not.toHaveProperty('searchCpuct');
    expect(settings.options).not.toHaveProperty('maxDepth');
    expect(settings.options).not.toHaveProperty('scorePtRate');
    expect(settings.options).not.toHaveProperty('scoringMode');
  });

  it('normalizes configured attribute targets', () => {
    const settings = normalizeUmaAiSettings({
      enabled: true,
      options: {
        targetSpeed: 1600.4,
        targetStamina: -10,
        targetPower: 1400,
        targetGuts: 9999,
        targetWisdom: 1200,
      },
    });

    expect(settings.options).toMatchObject({
      targetSpeed: 1600,
      targetStamina: 0,
      targetPower: 1400,
      targetGuts: 3000,
      targetWisdom: 1200,
    });
  });

  it('normalizes model search settings without adding training state', () => {
    const settings = normalizeUmaAiSettings({
      enabled: true,
      options: {
        modelPath: '  D:\\models\\larc.onnx  ',
        graphSearchNodes: 99999,
        graphSearchDepth: 0,
        graphSearchTimeMs: 1200.4,
        graphInferenceBatchSize: 99,
        graphSearchTopK: 30,
        graphSearchChanceOutcomes: -1,
        graphSearchCpuct: 2.25,
        graphRootSelection: 'gumbel',
        graphRootGumbelMaxActions: 99,
        graphRootGumbelScale: -1,
      },
    });

    expect(settings.options).toMatchObject({
      modelPath: 'D:\\models\\larc.onnx',
      graphSearchNodes: 8192,
      graphSearchDepth: 1,
      graphSearchTimeMs: 1200,
      graphInferenceBatchSize: 64,
      graphSearchTopK: 12,
      graphSearchChanceOutcomes: 1,
      graphSearchCpuct: 2.25,
      graphRootSelection: 'gumbel',
      graphRootGumbelMaxActions: 48,
      graphRootGumbelScale: 0,
    });
  });

  it('falls back to PUCT for an unknown root search algorithm', () => {
    const settings = normalizeUmaAiSettings({
      enabled: true,
      options: {
        graphRootSelection: 'unknown' as 'puct',
      },
    });

    expect(settings.options.graphRootSelection).toBe('puct');
  });

  it('merges additional samples into the current recommendation', () => {
    const merged = mergeRecommendationResults(
      {
        ok: true,
        backend: 'builtin',
        bestActionId: 1,
        actions: [
          {
            id: 1,
            label: '速度训练',
            type: 0,
            train: 0,
            overdrive: false,
            searches: 100,
            scoreMean: 1000,
            scoreStdev: 10,
            value: 1020,
            deltaFromBest: 0,
          },
          {
            id: 2,
            label: '耐力训练',
            type: 0,
            train: 1,
            overdrive: false,
            searches: 100,
            scoreMean: 990,
            scoreStdev: 8,
            value: 1000,
            deltaFromBest: 20,
          },
        ],
      },
      {
        ok: true,
        backend: 'builtin',
        bestActionId: 2,
        actions: [
          {
            id: 1,
            label: '速度训练',
            type: 0,
            train: 0,
            overdrive: false,
            searches: 100,
            scoreMean: 1010,
            scoreStdev: 10,
            value: 1020,
            deltaFromBest: 0,
          },
          {
            id: 2,
            label: '耐力训练',
            type: 0,
            train: 1,
            overdrive: false,
            searches: 100,
            scoreMean: 1000,
            scoreStdev: 8,
            value: 1010,
            deltaFromBest: 10,
          },
        ],
      },
    );

    expect(merged.bestActionId).toBe(1);
    expect(merged.predictedScore).toBe(1005);
    expect(merged.actions?.[0]).toMatchObject({
      id: 1,
      searches: 200,
      value: 1020,
      deltaFromBest: 0,
    });
    expect(merged.actions?.[1]).toMatchObject({
      id: 2,
      searches: 200,
      value: 1005,
      deltaFromBest: 15,
    });
  });

  it('merges model searches by root visits instead of value alone', () => {
    const result = (
      bestActionId: number,
      speedVisits: number,
      staminaVisits: number,
    ) => ({
      ok: true,
      backend: 'graph' as const,
      bestActionId,
      actions: [
        {
          id: 1,
          label: '速度训练',
          type: 0,
          train: 0,
          overdrive: false,
          searches: speedVisits,
          scoreMean: 1000,
          scoreStdev: 10,
          value: 100,
          deltaFromBest: 0,
        },
        {
          id: 2,
          label: '耐力训练',
          type: 0,
          train: 1,
          overdrive: false,
          searches: staminaVisits,
          scoreMean: 1010,
          scoreStdev: 10,
          value: 120,
          deltaFromBest: 0,
        },
      ],
    });

    const merged = mergeRecommendationResults(
      result(1, 60, 40),
      result(1, 55, 45),
    );

    expect(merged.bestActionId).toBe(1);
    expect(merged.bestAction).toBe('速度训练');
    expect(merged.actions?.[0]).toMatchObject({ id: 1, searches: 115 });
  });

  it('treats unchanged displayed scores and ranking as stable', () => {
    const result = {
      ok: true,
      bestActionId: 1,
      actions: [
        {
          id: 1,
          label: '速度训练',
          type: 0,
          train: 0,
          overdrive: false,
          searches: 100,
          scoreMean: 1000.4,
          scoreStdev: 10,
          value: 1020,
          deltaFromBest: 0,
        },
      ],
    };

    expect(recommendationStabilitySignature(result)).toBe(
      recommendationStabilitySignature({
        ...result,
        actions: result.actions.map((action) => ({
          ...action,
          scoreMean: 1000.2,
          deltaFromBest: 0.2,
        })),
      }),
    );
  });
});
