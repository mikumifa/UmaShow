import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FriendFarmTab from './FriendFarmTab';

const state = {
  status: 'stopped',
  stage: 'prepare',
  target_viewer_id: 0,
  viewer_id: 0,
  runs: 0,
  rebuilds: 0,
  retry_at: 0,
  message: '',
  tp: 0,
  potions: 0,
  jewels: 0,
};

test('requires a target and explicit disposable-account selection before starting', async () => {
  const request = jest.fn().mockResolvedValue({ success: true, data: state });
  render(<FriendFarmTab request={request} />);
  await screen.findByText('等待开始');
  const start = screen.getByRole('button', { name: '开始循环' });
  expect(start).toBeDisabled();
  fireEvent.change(screen.getByLabelText('大号游戏 ID'), {
    target: { value: '136561905459' },
  });
  expect(start).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  request.mockResolvedValue({
    success: true,
    data: { ...state, status: 'running', target_viewer_id: 136561905459 },
  });
  fireEvent.click(start);
  await screen.findByRole('button', { name: '暂停' });
  expect(request).toHaveBeenLastCalledWith(
    '/api/account/friend-farm',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'start', target_viewer_id: 136561905459 }),
    }),
  );
});

test('changing accounts clears target and the destructive-mode checkbox', async () => {
  const request = jest.fn().mockResolvedValue({ success: true, data: state });
  const { rerender } = render(<FriendFarmTab key="a" request={request} />);
  await screen.findByText('等待开始');
  fireEvent.change(screen.getByLabelText('大号游戏 ID'), {
    target: { value: '123' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  rerender(<FriendFarmTab key="b" request={request} />);
  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked());
  expect(screen.getByLabelText('大号游戏 ID')).toHaveValue('');
  expect(screen.getByRole('button', { name: '开始循环' })).toBeDisabled();
});
