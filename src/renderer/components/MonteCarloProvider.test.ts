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
    });
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
});
