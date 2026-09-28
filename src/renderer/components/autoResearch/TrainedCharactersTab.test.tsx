import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrainedCharactersTab from './TrainedCharactersTab';

jest.mock('renderer/utils/umdb', () => ({
  UMDB: { charaName: (id: number) => `马娘${id}` },
}));

const response = {
  success: true,
  data: {
    trained_chara_array: [
      { trained_chara_id: 2, card_id: 100701, rank_score: 800, is_locked: 1, use_type: 0 },
      { trained_chara_id: 5, card_id: 105201, rank_score: 500, is_locked: 0, use_type: 0 },
    ],
  },
};

test('protected horses cannot be selected; deletion requires explicit confirmation', async () => {
  const request = jest.fn().mockResolvedValueOnce(response).mockResolvedValueOnce({ success: true, removed_ids: [5] });
  render(<TrainedCharactersTab request={request} />);
  fireEvent.click(screen.getByText('刷新殿堂'));
  expect(await screen.findByLabelText('选择 马娘1007 #2')).toBeDisabled();
  fireEvent.click(screen.getByText('选择筛选结果'));
  fireEvent.click(screen.getByText('转队所选 1 名'));
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('取消'));
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('转队所选 1 名'));
  fireEvent.click(screen.getByText('确认转队'));
  await screen.findByText('已转队 1 名马娘。请刷新列表。');
  expect(request.mock.calls[1][0]).toBe('/api/account/trained-characters/transfer');
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ trained_chara_ids: [5] });
});

test('failed request clears stale selections without resending', async () => {
  const request = jest.fn().mockResolvedValueOnce(response).mockRejectedValueOnce(new Error('超时'));
  render(<TrainedCharactersTab request={request} />);
  fireEvent.click(screen.getByText('刷新殿堂'));
  await screen.findByLabelText('选择 马娘1052 #5');
  fireEvent.click(screen.getByText('选择筛选结果'));
  fireEvent.click(screen.getByText('转队所选 1 名'));
  fireEvent.click(screen.getByText('确认转队'));
  await screen.findByText('超时；请刷新列表核实结果。');
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByText('转队所选 0 名')).toBeDisabled();
});

test('remounting for another account drops the old list', async () => {
  const request = jest.fn().mockResolvedValue(response);
  const { rerender } = render(<TrainedCharactersTab key="account-a" request={request} />);
  fireEvent.click(screen.getByText('刷新殿堂'));
  await screen.findByLabelText('选择 马娘1052 #5');
  rerender(<TrainedCharactersTab key="account-b" request={request} />);
  await waitFor(() => expect(screen.queryByLabelText('选择 马娘1052 #5')).not.toBeInTheDocument());
});
