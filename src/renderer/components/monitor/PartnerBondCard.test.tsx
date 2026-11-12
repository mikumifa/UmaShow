import { render, screen } from '@testing-library/react';
import type { PartnerStat } from 'types/gameTypes';
import PartnerBondCard from './PartnerBondCard';

test('hides absent or unconfirmed legacy NPC slots while retaining appeared friends', () => {
  const placeholders = [101, 104, 106, 108, 109, 111].map((position) => ({
    position,
    supportCardId: 0,
    evaluation: 0,
  }));
  render(
    <PartnerBondCard
      partnerStats={
        [
          { position: 1, supportCardId: 30185, evaluation: 0 },
          ...placeholders,
          { position: 103, supportCardId: 0, evaluation: 0, isAppear: false },
          { position: 110, supportCardId: 0, evaluation: 0, isAppear: true },
        ] as PartnerStat[]
      }
    />,
  );
  expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  placeholders.forEach(({ position }) => {
    expect(screen.queryByText(`伙伴 ${position}`)).toBeNull();
  });
  expect(
    screen.getByRole('progressbar', { name: '伙伴 110羁绊' }),
  ).toBeTruthy();
});

test('uses the training card bond-gauge rule and keeps zero-bond partners', () => {
  render(
    <PartnerBondCard
      partnerStats={
        [
          { position: 1, supportCardId: 30185, evaluation: 0 },
          { position: 1001, supportCardId: 0, evaluation: 90, isAppear: true },
          { position: 1002, supportCardId: 30185, evaluation: 50 },
          { position: 102, supportCardId: 0, evaluation: 20, isAppear: true },
          { position: 103, supportCardId: 0, evaluation: 30, isAppear: true },
        ] as PartnerStat[]
      }
    />,
  );
  expect(screen.queryByText('伙伴 1001')).toBeNull();
  expect(
    screen
      .getByRole('progressbar', { name: '伙伴 1羁绊' })
      .getAttribute('aria-valuenow'),
  ).toBe('0');
  expect(
    screen.getByRole('progressbar', { name: '伙伴 1002羁绊' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('progressbar', { name: '秋川理事长羁绊' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('progressbar', { name: '乙名史记者羁绊' }),
  ).toBeTruthy();
});

test.each([
  [20001, 0, 2],
  [30185, 1, 3],
  [30160, 2, 5],
  [30080, 3, 3],
])(
  'renders database totals for card %i at stage %i of %i',
  (cardId, step, total) => {
    render(
      <PartnerBondCard
        partnerStats={[
          {
            position: 1,
            supportCardId: cardId,
            evaluation: 85,
            storyStep: step,
          } as PartnerStat,
        ]}
      />,
    );
    const progress = screen.getByRole('img', {
      name: `伙伴 1故事进度：${step}/${total}`,
    });
    expect(
      progress.querySelectorAll('img[src*="storyprogress_01"]'),
    ).toHaveLength(step);
    expect(
      progress.querySelectorAll('img[src*="storyprogress_00"]'),
    ).toHaveLength(total - step);
  },
);

test('does not present a missing story step as zero completed stages', () => {
  render(
    <PartnerBondCard
      partnerStats={[
        { position: 1, supportCardId: 30185, evaluation: 85 } as PartnerStat,
      ]}
    />,
  );
  expect(screen.queryByRole('img')).toBeNull();
  expect(screen.getByText('暂无数据')).toBeTruthy();
});
