export type ActiveIdleSingleMode = {
  info: Record<string, unknown>;
  playingState: number;
};

const ACTIVE_IDLE_SINGLE_MODE_STATES = new Set([1, 2, 3]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.trunc(parsed) > 0
    ? Math.trunc(parsed)
    : 0;
}

function stateContainers(data: unknown) {
  const root = asRecord(data);
  if (!root) return [];
  return [root, root.data, root.user_info, root.load_data].flatMap((source) => {
    const record = asRecord(source);
    return record ? [record] : [];
  });
}

function idleSingleModeInfoCandidates(data: unknown) {
  return stateContainers(data).flatMap((source) => {
    const info = asRecord(source.idle_single_mode_load_info);
    return info ? [info] : [];
  });
}

/**
 * Returns an idle-training state that still occupies the account.  The game
 * can include an empty or inactive marker alongside a later nested active
 * marker, so every known container must be checked rather than using the
 * first object-shaped value.
 */
export function findActiveIdleSingleMode(
  data: unknown,
): ActiveIdleSingleMode | undefined {
  return idleSingleModeInfoCandidates(data)
    .map((info) => ({
      info,
      playingState: positiveInteger(info.playing_state),
    }))
    .find(({ playingState }) =>
      ACTIVE_IDLE_SINGLE_MODE_STATES.has(playingState),
    );
}

function isNonEmptyRecord(value: unknown) {
  const chara = asRecord(value);
  return Boolean(chara && Object.keys(chara).length);
}

/**
 * Identifies an actual interactive career without treating protocol defaults
 * (`{}`) or an active idle-training character summary as a normal career.
 * This deliberately mirrors Python's dictionary truthiness: an empty decoded
 * message is absent, while any populated career record remains conservative.
 */
export function hasActiveSingleModeCareer(data: unknown) {
  if (findActiveIdleSingleMode(data)) return false;
  return stateContainers(data).some(
    (container) =>
      isNonEmptyRecord(container.single_mode_chara_light) ||
      isNonEmptyRecord(container.single_mode_chara),
  );
}
