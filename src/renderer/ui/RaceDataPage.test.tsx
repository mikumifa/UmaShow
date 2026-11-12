import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SimulationStatus } from 'types/practiceRaceSimulation';
import PracticeRaceSimulationStatus from 'renderer/components/PracticeRaceSimulationStatus';
import RaceDataPage from './RaceDataPage';

jest.mock('renderer/utils/umdb', () => ({
  loadUMDB: jest.fn().mockResolvedValue({}),
  UMDB: { raceInstances: { 1: { name: '练习测试' } } },
}));
jest.mock('umdb/RaceDataParser', () => ({
  deserializeFromBase64: jest.fn(() => ({})),
}));
jest.mock('renderer/components/RaceDataPresenter', () => {
  function Presenter() {
    return <div>比赛内容</div>;
  }
  return Presenter;
});
jest.mock('renderer/components/RacePageLayout', () => ({
  __esModule: true,
  default: ({
    actions,
    children,
  }: {
    actions: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));

test('a running dialog can close and reopen without stopping, and its task stays accessible after navigation', async () => {
  const running: SimulationStatus = {
    running: true,
    stopping: false,
    accountId: 'account',
    progress: {
      stage: 'save',
      detail: '第 3 场已保存',
      current: 3,
      total: 20,
      archiveId: 'archive',
      archiveName: '测试模拟',
    },
  };
  let notify!: (status: SimulationStatus) => void;
  const stop = jest.fn().mockResolvedValue({ ...running, stopping: true });
  window.electron = {
    race: {
      getRepeatSimulationStatus: jest.fn().mockResolvedValue(running),
      onRepeatSimulationStatus: jest.fn((callback) => {
        notify = callback;
        return jest.fn();
      }),
      stopRepeatSimulation: stop,
      archives: jest.fn().mockResolvedValue({ archives: [] }),
      repeatSimulation: jest.fn(),
    },
    autoResearch: {
      accounts: jest
        .fn()
        .mockResolvedValue([{ id: 'account', uid: '123', label: '测试账号' }]),
    },
  } as unknown as typeof window.electron;
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/race',
          state: {
            scenario: 'race',
            horseInfo: '[]',
            raceMetaInfo: { race_instance_id: 1 },
          },
        },
      ]}
    >
      <PracticeRaceSimulationStatus />
      <Routes>
        <Route path="/race" element={<RaceDataPage />} />
        <Route path="/races" element={<div>存档页面</div>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('比赛内容');
  fireEvent.click(screen.getByRole('button', { name: '重复模拟' }));
  let dialog = await screen.findByRole('dialog', { name: '重复模拟' });
  await waitFor(() =>
    expect(within(dialog).getByLabelText('2. 模拟次数')).toHaveValue(20),
  );
  expect(
    within(dialog).getByRole('button', { name: '关闭重复模拟' }),
  ).toBeEnabled();
  const exitButton = within(dialog).getByRole('button', { name: '退出模拟' });
  expect(exitButton).toBeEnabled();
  expect(exitButton.parentElement).toBe(
    within(dialog).getByRole('button', { name: '模拟中…' }).parentElement,
  );
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭重复模拟' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(stop).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('3/20');
  fireEvent.click(screen.getByRole('button', { name: '重复模拟' }));
  dialog = await screen.findByRole('dialog', { name: '重复模拟' });
  expect(dialog).toHaveTextContent('第 3 场已保存');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '查看存档' }));
  await screen.findByText('存档页面');
  expect(screen.getByRole('status')).toHaveTextContent('3/20');
  fireEvent.click(screen.getByRole('button', { name: '退出模拟' }));
  expect(stop).toHaveBeenCalledTimes(1);
  act(() => notify({ ...running, stopping: true }));
  expect(screen.getByRole('button', { name: '正在退出…' })).toBeDisabled();
  act(() =>
    notify({
      ...running,
      running: false,
      progress: {
        ...running.progress!,
        stage: 'stopped',
        detail: '已停止，已保存 3 场模拟',
      },
      result: {
        ok: true,
        cancelled: true,
        completed: 3,
        total: 20,
        archiveId: 'archive',
      },
    }),
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    '已停止，已保存 3 场模拟',
  );
});
