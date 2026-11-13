import { render, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UmaAptitudeRows } from 'renderer/ui/SuccessionPlanner';
import { PLANNER_CATALOG } from 'renderer/utils/racePlannerCatalog';
import {
  PlannerLineageCard,
  PlannerSelectionCard,
} from 'renderer/components/succession/PlannerComponents';

test('shows inherited grades and highlights only changed aptitudes, then removes highlights when cleared', () => {
  const base = { ...PLANNER_CATALOG.characters[0].aptitudes, mile: 4 };
  const { getByTitle, rerender } = render(
    <UmaAptitudeRows
      uma={{ aptitudes: { ...base, mile: 7 } }}
      baseAptitudes={base}
    />,
  );
  const changed = getByTitle('英里：D → A');
  expect(changed).toHaveClass('successionAptitudeChanged');
  expect(within(changed).getByRole('img', { name: 'A' })).toBeInTheDocument();
  expect(getByTitle('草地')).not.toHaveClass('successionAptitudeChanged');
  rerender(<UmaAptitudeRows uma={{ aptitudes: base }} baseAptitudes={base} />);
  expect(getByTitle('英里')).not.toHaveClass('successionAptitudeChanged');
});

test('compact pickers show aptitudes and factors while keeping names accessible without visible identity text', () => {
  const factor = { id: 1, name: '中距离', stars: 3, tone: 'aptitude' as const };
  const { getByRole, queryByText, getAllByText } = render(
    <>
      <PlannerSelectionCard
        portrait={<span />}
        ariaLabel="选择特别周"
        details={<UmaAptitudeRows uma={PLANNER_CATALOG.characters[0]} picker />}
        onClick={() => {}}
      />
      <PlannerLineageCard
        member={{
          key: 'self',
          name: '[星光跃动]',
          subtitle: '自己的马娘',
          portrait: <span />,
          factors: [factor],
        }}
        parents={[
          {
            key: 'ancestor',
            label: '父辈 1',
            name: '[青云垂钓者]',
            portrait: <span />,
            factors: [factor],
          },
        ]}
        factorFocused
        viewOnly
        selected
      />
    </>,
  );
  expect(getByRole('button', { name: '选择特别周' })).toBeInTheDocument();
  expect(queryByText('[星光跃动]')).not.toBeInTheDocument();
  expect(queryByText('[青云垂钓者]')).not.toBeInTheDocument();
  expect(queryByText('自己的马娘')).not.toBeInTheDocument();
  expect(queryByText('父辈 1')).not.toBeInTheDocument();
  expect(queryByText('已选择')).not.toBeInTheDocument();
  expect(getAllByText('中距离')).toHaveLength(2);
  expect(getAllByText('3★')).toHaveLength(2);
});
