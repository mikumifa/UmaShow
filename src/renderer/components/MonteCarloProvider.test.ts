import {
  DEFAULT_UMA_AI_SETTINGS,
  normalizeUmaAiSettings,
} from './MonteCarloProvider';

describe('recommendation settings', () => {
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
    });
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('seed');
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('maxDepth');
    expect(DEFAULT_UMA_AI_SETTINGS.options).not.toHaveProperty('scoringMode');
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
        graphSearchTopK: 30,
        graphSearchChanceOutcomes: -1,
        graphSearchCpuct: 2.25,
      },
    });

    expect(settings.options).toMatchObject({
      modelPath: 'D:\\models\\larc.onnx',
      graphSearchNodes: 8192,
      graphSearchDepth: 1,
      graphSearchTimeMs: 1200,
      graphSearchTopK: 12,
      graphSearchChanceOutcomes: 1,
      graphSearchCpuct: 2.25,
    });
  });
});
