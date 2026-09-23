import {
  automationHasHostedTask,
  HOSTED_ATTACH_TIMEOUT_MS,
} from './hostedTask';
import type { AccountAutomation } from './types';

test.each(['running', 'paused'] as const)(
  'farm %s is hosted without a normal schedule',
  (status) => {
    const automation = {
      schedule: null,
      friend_farm: { status },
    } as AccountAutomation;
    expect(automationHasHostedTask(automation)).toBe(true);
  },
);
test('stopped farm can release its session; normal schedules remain hosted', () => {
  expect(
    automationHasHostedTask({
      schedule: null,
      friend_farm: { status: 'stopped' },
    } as AccountAutomation),
  ).toBe(false);
  expect(
    automationHasHostedTask({
      schedule: { items: [] },
    } as unknown as AccountAutomation),
  ).toBe(true);
  expect(automationHasHostedTask()).toBe(false);
  expect(HOSTED_ATTACH_TIMEOUT_MS).toBe(60000);
});
