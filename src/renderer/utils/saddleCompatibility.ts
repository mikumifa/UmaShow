import { PLANNER_CATALOG } from './racePlannerCatalog';

/** The backend counts each G1 entry on the first horse against all groups on the second. */
export function detailedCommonG1Count(
  first: number[] | undefined,
  second: number[] | undefined,
  g1SaddleIds: Iterable<number>,
) {
  if (!first?.length || !second?.length) return undefined;
  const g1 = new Set(g1SaddleIds);
  if (!g1.size) return undefined;
  const groupOf = (id: number) => PLANNER_CATALOG.saddleGroups[id] ?? id;
  const groups = new Set(second.filter(Boolean).map(groupOf).filter(Boolean));
  return first.filter((id) => g1.has(id) && groups.has(groupOf(id))).length;
}
