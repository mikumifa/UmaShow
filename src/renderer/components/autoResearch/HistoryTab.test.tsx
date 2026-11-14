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

test('history uses unified toolbar refresh, empty loading state, and sticky detail back bar without pull-to-refresh', () => {
  const setSelectedCareerRecords = jest.fn();
  const { rerender, container } = render(
    <HistoryTab
      readOnly
      selectedCareerRecords={null}
      setSelectedCareerRecords={setSelectedCareerRecords}
      busy="history"
      loadCareerHistory={jest.fn()}
      loadCareerHistoryDetail={jest.fn()}
      selectedAccountId="123"
      accountCareerSettings={[]}
      careerHistory={[]}
      assetSnapshots={[]}
      downloadCareerSetting={jest.fn()}
      downloadTrainingHistory={jest.fn()}
      localTrainingHistoryIds={new Set()}
      openTrainingHistory={jest.fn()}
    />,
  );
  expect(screen.getByText('读取中…')).toBeInTheDocument();
  expect(screen.queryByText('下拉刷新')).not.toBeInTheDocument();

  const record = {
    id: 'record-2',
    uid: '123',
    count: 1,
    career_setting_name: '统一返回测试',
    started_at: '2026-11-14T12:00:00+08:00',
    ended_at: '2026-11-14T12:30:00+08:00',
    runs: [{ run_id: 'r1', completed: true } as CareerSessionRun],
  } as CareerSessionRecord;

  rerender(
    <HistoryTab
      readOnly
      selectedCareerRecords={[record]}
      setSelectedCareerRecords={setSelectedCareerRecords}
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
  const toolbar = container.querySelector('header.autoResearchEditorToolbar');
  expect(toolbar).not.toBeNull();
  const backButton = screen.getByRole('button', { name: '返回' });
  expect(backButton).toHaveClass('autoResearchBackButton');
  fireEvent.click(backButton);
  expect(setSelectedCareerRecords).toHaveBeenCalledWith(null);
});

test('history and tracking auto-load next page on scroll threshold without manual load-more button', async () => {
  const makeRecord = (id: string, date: string): CareerSessionRecord =>
    ({
      id,
      uid: '123',
      count: 1,
      career_setting_name: `详设-${id}`,
      started_at: `${date}T12:00:00+08:00`,
      ended_at: `${date}T12:30:00+08:00`,
      runs: [{ run_id: `run-${id}`, completed: true } as CareerSessionRun],
    }) as CareerSessionRecord;

  let resolveSecondPage!: (value: {
    reports: CareerSessionRecord[];
    has_more: boolean;
    next_offset: number | null;
  }) => void;

  const loadHistoryPage = jest.fn((view: 'day' | 'task', offset: number) => {
    if (offset === 0) {
      return Promise.resolve({
        reports: [makeRecord(`${view}-1`, '2026-11-14')],
        has_more: true,
        next_offset: 10,
      });
    }
    return new Promise<{
      reports: CareerSessionRecord[];
      has_more: boolean;
      next_offset: number | null;
    }>((resolve) => {
      resolveSecondPage = resolve;
    });
  });

  const loadTrackingPage = jest.fn((_metric: string, offset: number) => {
    if (offset === 0) {
      return Promise.resolve({
        rows: [
          {
            business_day: '2026-11-14',
            captured_at: '2026-11-14T12:00:00+08:00',
            value: 1500,
            delta: 50,
          },
        ],
        has_more: true,
        next_offset: 30,
      });
    }
    return Promise.resolve({
      rows: [
        {
          business_day: '2026-11-13',
          captured_at: '2026-11-13T12:00:00+08:00',
          value: 1450,
          delta: null,
        },
      ],
      has_more: false,
      next_offset: null,
    });
  });

  const { getByTestId } = render(
    <div
      data-testid="scroll-host"
      style={{ overflowY: 'auto', height: '500px' }}
    >
      <HistoryTab
        readOnly
        selectedCareerRecords={null}
        setSelectedCareerRecords={jest.fn()}
        busy=""
        loadHistoryPage={loadHistoryPage}
        loadTrackingPage={loadTrackingPage}
        loadCareerHistoryDetail={jest.fn()}
        selectedAccountId="123"
        accountCareerSettings={[]}
        downloadCareerSetting={jest.fn()}
        downloadTrainingHistory={jest.fn()}
        localTrainingHistoryIds={new Set()}
        openTrainingHistory={jest.fn()}
      />
    </div>,
  );

  await waitFor(() => expect(screen.getByText('详设-day-1')).toBeInTheDocument());
  expect(loadHistoryPage).toHaveBeenCalledTimes(1);
  expect(loadHistoryPage).toHaveBeenLastCalledWith('day', 0);
  expect(
    screen.queryByRole('button', { name: /加载更多/ }),
  ).not.toBeInTheDocument();
  expect(getByTestId('history-scroll-sentinel')).toBeInTheDocument();

  const scrollHost = getByTestId('scroll-host');
  let scrollTop = 0;
  Object.defineProperty(scrollHost, 'clientHeight', {
    configurable: true,
    get: () => 500,
  });
  Object.defineProperty(scrollHost, 'scrollHeight', {
    configurable: true,
    get: () => 1200,
  });
  Object.defineProperty(scrollHost, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
  });

  // Far from bottom (1200 - (100 + 500) = 600 > 320): should not load next page yet
  scrollTop = 100;
  fireEvent.scroll(scrollHost);
  expect(loadHistoryPage).toHaveBeenCalledTimes(1);

  // Within threshold (1200 - (450 + 500) = 250 <= 320): auto-loads next_offset=10 once
  scrollTop = 450;
  fireEvent.scroll(scrollHost);
  fireEvent.scroll(scrollHost);
  await waitFor(() => expect(loadHistoryPage).toHaveBeenCalledTimes(2));
  expect(loadHistoryPage).toHaveBeenLastCalledWith('day', 10);
  expect(
    screen.getByRole('status', { name: '正在加载更多' }),
  ).toBeInTheDocument();

  await act(async () => {
    resolveSecondPage({
      reports: [makeRecord('day-2', '2026-11-13')],
      has_more: false,
      next_offset: null,
    });
  });

  await waitFor(() => expect(screen.getByText('详设-day-2')).toBeInTheDocument());
  expect(
    screen.queryByTestId('history-scroll-sentinel'),
  ).not.toBeInTheDocument();

  // Switch to tracking view and verify scroll threshold auto-loads next_offset=30
  scrollTop = 0;
  fireEvent.click(screen.getByRole('button', { name: '追踪' }));
  await waitFor(() => expect(loadTrackingPage).toHaveBeenCalledTimes(1));
  expect(loadTrackingPage).toHaveBeenLastCalledWith('jewels', 0);

  scrollTop = 450;
  fireEvent.scroll(scrollHost);
  await waitFor(() => expect(loadTrackingPage).toHaveBeenCalledTimes(2));
  expect(loadTrackingPage).toHaveBeenLastCalledWith('jewels', 30);
  await waitFor(() => expect(screen.getByText('2026-11-13')).toBeInTheDocument());
});

