import { fireEvent, render, screen } from '@testing-library/react';
import type { CharInfo } from 'types/gameTypes';
import ArcPanel from './ArcPanel';

jest.mock('renderer/components/MonteCarloProvider', () => ({
  useMonteCarloRecommendation: () => ({
    settings: { enabled: false },
    capturedState: null,
    result: null,
  }),
}));

const charInfo = {
  scenarioType: 'arc',
  stats: { vital: { value: 86, max: 112 } },
  gameStats: { turn: 20 },
  commands: [],
  gameEvents: [],
  partnerStats: [
    { position: 1, supportCardId: 0, evaluation: 85, isAppear: true },
    { position: 2, supportCardId: 0, evaluation: 70, isAppear: false },
    { position: 3, supportCardId: 30185, evaluation: 60 },
  ],
} as unknown as CharInfo;

beforeEach(() => localStorage.clear());

test('only displays appeared partners and remains compatible with older packets', () => {
  render(<ArcPanel charInfo={charInfo} />);
  expect(screen.getByRole('progressbar', { name: '伙伴 1羁绊' })).toBeTruthy();
  expect(screen.queryByRole('progressbar', { name: '伙伴 2羁绊' })).toBeNull();
  expect(screen.getByRole('progressbar', { name: '伙伴 3羁绊' })).toBeTruthy();
});

test('bond switch defaults on, hides the card, and remembers the selection', () => {
  const first = render(<ArcPanel charInfo={charInfo} />);
  const toggle = screen.getByRole('switch', { name: '显示人物羁绊' });
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(
    screen.queryByRole('region', { name: '人物羁绊与故事进度' }),
  ).toBeNull();

  first.unmount();
  render(<ArcPanel charInfo={charInfo} />);
  const remembered = screen.getByRole('switch', { name: '显示人物羁绊' });
  expect(remembered.getAttribute('aria-checked')).toBe('false');
  fireEvent.click(remembered);
  expect(
    screen.getByRole('region', { name: '人物羁绊与故事进度' }),
  ).toBeTruthy();
});
