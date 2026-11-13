import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryMetrics, { totalRunMetrics } from './HistoryMetrics';
import { CareerSessionRecord, CareerSessionRun } from './types';

const run = (values: Partial<CareerSessionRun>) => values as CareerSessionRun;
const record = (values: Partial<CareerSessionRecord>) =>
  values as CareerSessionRecord;

test('combines completed runs and summary totals without averaging or counting them twice', () => {
  const values = totalRunMetrics([
    record({
      runs: [
        run({ completed: true, jewel_drop_count: 2, jewels_earned: 20 }),
        run({ completed: true, jewel_drop_count: 0, jewels_earned: 0 }),
        run({ completed: false, jewel_drop_count: 8, jewels_earned: 80 }),
      ],
    }),
    record({
      metric_totals: { jewel_drop_count: 3, jewels_earned: 30 },
      metric_samples: { jewel_drop_count: 2, jewels_earned: 2 },
      runs: [run({ completed: true, jewel_drop_count: 3, jewels_earned: 30 })],
    }),
  ]);
  expect(values).toEqual({ jewel_drop_count: 5, jewels_earned: 50 });
  render(<HistoryMetrics values={values} completedCount={4} />);
  expect(screen.getByRole('group')).toHaveTextContent(
    '总育成次数4次掉钻次数5次掉钻数量50个',
  );
  expect(screen.queryByText('总评分')).not.toBeInTheDocument();
  expect(screen.queryByText('胜场')).not.toBeInTheDocument();
  expect(screen.queryByText('比赛场次')).not.toBeInTheDocument();
});

test('preserves known zero drops and leaves missing data unknown', () => {
  expect(totalRunMetrics([])).toEqual({
    jewel_drop_count: null,
    jewels_earned: null,
  });
  expect(
    totalRunMetrics([
      record({ runs: [run({ completed: true, jewel_drop_count: 0 })] }),
    ]),
  ).toEqual({ jewel_drop_count: 0, jewels_earned: null });
});
