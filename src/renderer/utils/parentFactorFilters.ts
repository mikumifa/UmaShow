import type { Dashboard } from 'renderer/components/autoResearch/types';

export type ParentFactorFilter = {
  groupId: number;
  scope: 'self' | 'lineage';
  minimumStars: number;
};

export function matchesParentFactorFilters(
  parent: Dashboard['parents'][number],
  filters: ParentFactorFilter[],
) {
  return filters.every((filter) => {
    const members =
      filter.scope === 'self'
        ? [parent]
        : [parent, ...(parent.ancestors || [])];
    const stars = members.reduce(
      (total, member) =>
        total +
        (member.factors || [])
          .filter((factor) => factor.factor_group_id === filter.groupId)
          .reduce((sum, factor) => sum + factor.stars, 0),
      0,
    );
    return stars >= Math.max(1, filter.minimumStars);
  });
}
