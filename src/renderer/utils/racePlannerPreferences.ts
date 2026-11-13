export const RACE_PLANNER_STORAGE_KEY = 'uma-race-planner-v1';
export const RACE_PLANNER_SETTINGS_VERSION = 2;
export const DEFAULT_PLANNER_FAN_BONUS = 120;

export function plannerFanBonus(
  saved?: { fanBonus?: number; version?: number } | null,
) {
  const bonus = saved?.fanBonus;
  return typeof bonus === 'number' &&
    Number.isFinite(bonus) &&
    bonus >= 0 &&
    (saved?.version === RACE_PLANNER_SETTINGS_VERSION || bonus !== 0)
    ? bonus
    : DEFAULT_PLANNER_FAN_BONUS;
}

export function storedPlannerFanBonus(value: string | null) {
  try {
    return plannerFanBonus(JSON.parse(value || 'null'));
  } catch {
    return DEFAULT_PLANNER_FAN_BONUS;
  }
}
