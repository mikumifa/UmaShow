import { useState } from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  matchesParentFactorFilters,
  ParentFactorFilter,
} from 'renderer/utils/parentFactorFilters';
import type { Dashboard } from './types';
import ParentFactorFilters from './ParentFactorFilters';

test('each selected factor has an independent self 1–3 / lineage 1–9 star condition', () => {
  function Filters() {
    const [filters, setFilters] = useState<ParentFactorFilter[]>([]);
    return <ParentFactorFilters filters={filters} setFilters={setFilters} />;
  }
  const { getByRole, queryByRole } = render(<Filters />);
  fireEvent.click(getByRole('button', { name: '中距离' }));
  fireEvent.click(getByRole('button', { name: '领跑' }));
  const middle = getByRole('combobox', { name: '中距离星级' });
  const front = getByRole('combobox', { name: '领跑星级' });
  expect(
    within(middle).getByRole('option', { name: '本体至少 3 星' }),
  ).toBeInTheDocument();
  expect(
    within(middle).queryByRole('option', { name: '本体至少 4 星' }),
  ).not.toBeInTheDocument();
  expect(
    within(middle).getByRole('option', { name: '至少 9 星' }),
  ).toBeInTheDocument();
  fireEvent.change(middle, { target: { value: 'lineage:6' } });
  fireEvent.change(front, { target: { value: 'self:2' } });
  expect(middle).toHaveValue('lineage:6');
  expect(front).toHaveValue('self:2');
  fireEvent.click(getByRole('button', { name: '中距离' }));
  expect(
    queryByRole('combobox', { name: '中距离星级' }),
  ).not.toBeInTheDocument();
  expect(front).toHaveValue('self:2');
});

test('all conditions must match; self excludes ancestors while lineage includes their stars', () => {
  const factor = (group: number, stars: number) => ({
    factor_group_id: group,
    stars,
  });
  const parent = {
    factors: [factor(33, 3), factor(21, 2)],
    ancestors: [{ factors: [factor(33, 3)] }, { factors: [factor(33, 3)] }],
  } as Dashboard['parents'][number];
  const conditions: ParentFactorFilter[] = [
    { groupId: 33, scope: 'lineage', minimumStars: 9 },
    { groupId: 21, scope: 'self', minimumStars: 2 },
  ];
  expect(matchesParentFactorFilters(parent, conditions)).toBe(true);
  expect(
    matchesParentFactorFilters(parent, [
      conditions[0],
      { ...conditions[1], minimumStars: 3 },
    ]),
  ).toBe(false);
  expect(
    matchesParentFactorFilters(parent, [
      { ...conditions[0], scope: 'self', minimumStars: 4 },
    ]),
  ).toBe(false);
  expect(
    matchesParentFactorFilters(parent, [
      { groupId: 12, scope: 'lineage', minimumStars: 0 },
    ]),
  ).toBe(false);
  expect(matchesParentFactorFilters(parent, [])).toBe(true);
});
