import type { AccountAutomation } from './types';

export const automationHasHostedTask = (automation?: AccountAutomation) =>
  Boolean(
    automation?.schedule ||
      automation?.friend_farm?.status === 'running' ||
      automation?.friend_farm?.status === 'paused',
  );

export const HOSTED_ATTACH_TIMEOUT_MS = 60000;
