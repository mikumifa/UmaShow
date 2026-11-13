import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import HistoryTab from './HistoryTab';
import { CareerSessionRecord, CareerSessionRun } from './types';

jest.mock('renderer/utils/umdb', () => ({ UMDB: { data: undefined } }));

test.each([false, true])(
  'history renders runs and totals without scanning race details (detail=%s)',
  (detail) => {
    const run = {
      run_id: '20261114T120000',
      completed: true,
      started_at: '2026-11-14T12:00:00+08:00',
      ended_at: '2026-11-14T12:30:00+08:00',
      jewel_drop_count: 2,
      jewels_earned: 20,
    } as CareerSessionRun;
    const record = {
      id: 'record-1',
      uid: '123',
      count: 1,
      career_setting_name: '育成详设',
      started_at: run.started_at,
      ended_at: run.ended_at,
      runs: [run],
    } as CareerSessionRecord;
    [run, record].forEach((source) => {
      Object.defineProperty(source, 'g123_race_records', {
        get: () => {
          throw new Error('History must not scan individual races');
        },
      });
    });
    render(
      <HistoryTab
        readOnly
        selectedCareerRecords={detail ? [record] : null}
        setSelectedCareerRecords={jest.fn()}
        busy=""
        loadCareerHistory={jest.fn()}
        loadCareerHistoryDetail={jest.fn()}
        selectedAccountId="123"
        accountCareerSettings={[]}
        careerHistory={[record]}
        assetSnapshots={[]}
        downloadCareerSetting={jest.fn()}
        downloadTrainingHistory={jest.fn()}
        localTrainingHistoryIds={new Set()}
        openTrainingHistory={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('group', { name: '育成累计指标' }),
    ).toHaveTextContent('总育成次数1次掉钻次数2次掉钻数量20个');
    expect(screen.queryByText('比赛掉落')).not.toBeInTheDocument();
    expect(screen.queryByText('大差情况')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '育成记录' }) !== null).toBe(
      detail,
    );
  },
);

test.each([true, false])(
  'detail loading uses a text-free spinner and closes after success or error (success=%s)',
  async (success) => {
    const summary = {
      id: 'summary-1',
      career_setting_name: '育成详设',
      started_at: '2026-11-14T12:00:00+08:00',
      count: 1,
      summary_only: true,
    } as CareerSessionRecord;
    let resolvePending!: (records: CareerSessionRecord[]) => void;
    let rejectPending!: (error: Error) => void;
    const pending = new Promise<CareerSessionRecord[]>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    const setSelectedCareerRecords = jest.fn();
    render(
      <HistoryTab
        readOnly
        selectedCareerRecords={null}
        setSelectedCareerRecords={setSelectedCareerRecords}
        busy=""
        loadCareerHistory={jest.fn()}
        loadCareerHistoryDetail={() => pending}
        selectedAccountId="123"
        accountCareerSettings={[]}
        careerHistory={[summary]}
        assetSnapshots={[]}
        downloadCareerSetting={jest.fn()}
        downloadTrainingHistory={jest.fn()}
        localTrainingHistoryIds={new Set()}
        openTrainingHistory={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /育成详设/ }));
    const spinner = screen.getByRole('status', { name: '正在读取育成记录' });
    expect(spinner.textContent).toBe('');
    expect(spinner.querySelector('svg')).toHaveClass('animate-spin');
    expect(screen.queryByText('正在读取记录详情…')).not.toBeInTheDocument();
    await act(async () => {
      if (success)
        resolvePending([
          {
            ...summary,
            summary_only: false,
            runs: [{ completed: true }] as CareerSessionRun[],
          },
        ]);
      else rejectPending(new Error('读取失败'));
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('status', { name: '正在读取育成记录' }),
      ).not.toBeInTheDocument(),
    );
    expect(setSelectedCareerRecords).toHaveBeenCalledTimes(success ? 1 : 0);
    expect(screen.queryByRole('alert') !== null).toBe(!success);
  },
);
