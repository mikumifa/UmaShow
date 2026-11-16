import { fireEvent, render, waitFor } from '@testing-library/react';
import DailyTasksTab from './DailyTasksTab';
import type { DailyTasksResponse } from './types';

test('renders pending race missions and saves/uploads race_mission toggle', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const onUpload = jest.fn().mockResolvedValue(undefined);
  const overview: DailyTasksResponse = {
    success: true,
    daily_tasks: {
      schema_version: 3,
      run_with_career: false,
      daily_race: {
        enabled: false,
        daily_race_id: 0,
        trained_chara_id: 0,
        running_style: 0,
      },
      daily_legend_race: {
        enabled: false,
        daily_legend_race_id: 0,
        trained_chara_id: 0,
        running_style: 0,
      },
      team_stadium: { enabled: false, opponent_strength: 3 },
      limited_shop: { enabled: false, buy_all: true },
      race_mission: { enabled: false },
    },
    options: {
      race_missions: [
        {
          mission_id: 1001864,
          event_title: '秋季一级赛事纪念任务第3弹 全国初级优俊',
          text: '【全国初级优俊】在养成中获得全国初级优俊的胜利',
          race_name: '全国初级优俊',
          end_date: '2026-11-20 04:59:59',
        },
        {
          mission_id: 1001874,
          event_title: '秋季一级赛事纪念任务第3弹 朝日杯未来锦标赛',
          text: '【朝日杯未来锦标赛】在养成中获得每日杯初级锦标赛的胜利',
          race_name: '每日杯初级锦标赛',
          end_date: '2026-11-24 04:59:59',
        },
      ],
      availability: {
        daily_race: {
          available: true,
          can_run_now: false,
          ticket_count: 0,
          reason: '入场券不足',
        },
        daily_legend_race: {
          available: true,
          can_run_now: false,
          ticket_count: 0,
          reason: '入场券不足',
        },
        team_stadium: {
          available: true,
          can_run_now: true,
          current_rp: 5,
          term_open: true,
          reason: '',
        },
        race_mission: {
          available: true,
          can_run_now: true,
          pending_count: 2,
          reason: '',
        },
      },
    },
  };

  const { getByRole, getByText } = render(
    <DailyTasksTab
      overview={overview}
      loading={false}
      loadError=""
      busy=""
      locked={false}
      onRetry={jest.fn()}
      onSave={onSave}
      onUpload={onUpload}
      onRun={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(getByText('自动完成比赛任务')).toBeTruthy();
  expect(
    getByText(/当前待完成 2 项：全国初级优俊、每日杯初级锦标赛/),
  ).toBeTruthy();

  const toggle = getByRole('switch', { name: '启用自动完成比赛任务' });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-checked')).toBe('true');

  fireEvent.click(getByRole('button', { name: '上传配置到服务器' }));
  await waitFor(() =>
    expect(onUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        race_mission: { enabled: true },
      }),
    ),
  );
});
