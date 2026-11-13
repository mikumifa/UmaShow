import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
} from 'renderer/utils/racePlannerCatalog';
import rankings from 'renderer/data/race_planner_rankings.json';
import RacePlanningTab from './RacePlanningTab';
import { skillPurchaseTurnLabel } from './shared';

jest.mock('renderer/utils/umdb', () => ({ UMDB: {} }));
jest.mock('renderer/components/trainingHistory/AssetIcon', () => () => null);
jest.mock('./shared', () => ({
  ...jest.requireActual('./shared'),
  getSharedStorageItem: (key: string) => localStorage.getItem(key),
  setSharedStorageItem: (key: string, value: string) =>
    localStorage.setItem(key, value),
}));

const savedSettings = () =>
  JSON.parse(localStorage.getItem('uma-race-planner-v1') || '{}');
const calendar = buildPlanningCalendar(1001, 5);
const electiveRace = calendar.races.find(
  (race) => !calendar.fixedRaces[race.turn],
)!;
const date = skillPurchaseTurnLabel(electiveRace.turn);

beforeEach(() => localStorage.clear());

test('fan bonus defaults to 120 and persists edited values including zero across remounts', () => {
  let view = render(<RacePlanningTab />);
  expect(
    screen.getByRole('spinbutton', { name: '粉丝加成百分比' }),
  ).toHaveValue(120);
  fireEvent.change(screen.getByRole('spinbutton', { name: '粉丝加成百分比' }), {
    target: { value: '150' },
  });
  expect(savedSettings().fanBonus).toBe(150);
  view.unmount();
  view = render(<RacePlanningTab />);
  expect(
    screen.getByRole('spinbutton', { name: '粉丝加成百分比' }),
  ).toHaveValue(150);
  fireEvent.change(screen.getByRole('spinbutton', { name: '粉丝加成百分比' }), {
    target: { value: '0' },
  });
  view.unmount();
  render(<RacePlanningTab />);
  expect(
    screen.getByRole('spinbutton', { name: '粉丝加成百分比' }),
  ).toHaveValue(0);
});

test('the old saved default zero fan bonus migrates to 120', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({ charaId: 1001, fanBonus: 0 }),
  );
  render(<RacePlanningTab />);
  expect(
    screen.getByRole('spinbutton', { name: '粉丝加成百分比' }),
  ).toHaveValue(120);
  expect(savedSettings().fanBonus).toBe(120);
});

test('only win optimization shows a grade selector and defaults to GI even after loading an old GIII setting', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({ charaId: 1001, objective: 'fans', gradeThreshold: 300 }),
  );
  render(<RacePlanningTab />);
  expect(
    screen.queryByRole('combobox', { name: '胜场统计级别' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '优化目标' }), {
    target: { value: 'wins' },
  });
  expect(screen.getByRole('combobox', { name: '胜场统计级别' })).toHaveValue(
    '100',
  );
  fireEvent.change(screen.getByRole('combobox', { name: '优化目标' }), {
    target: { value: 'jewels' },
  });
  expect(
    screen.queryByRole('combobox', { name: '胜场统计级别' }),
  ).not.toBeInTheDocument();
});

test('the result list shows database base fans separately from expected fans with a bonus', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({ charaId: 1001, fanBonus: 100 }),
  );
  render(<RacePlanningTab />);
  const table = screen.getByRole('table', { name: '最优赛程' });
  expect(
    within(table).getByRole('columnheader', { name: '基础粉丝' }),
  ).toBeInTheDocument();
  const debut = calendar.races.find(
    (item) => item.id === calendar.fixedRaces[calendar.startTurn][0],
  )!;
  const firstRow = within(table).getAllByRole('row')[1];
  const cells = within(firstRow).getAllByRole('cell');
  expect(cells[4]).toHaveTextContent(debut.fans.toLocaleString());
  expect(cells[5]).toHaveTextContent(
    Math.round(debut.fans * 2 * 1.1).toLocaleString(),
  );
});

test('a date switches between fixed race, rest and automatic planning and persists', () => {
  const view = render(<RacePlanningTab />);
  fireEvent.click(screen.getByRole('button', { name: `${date}，自动规划` }));
  let picker = screen.getByRole('dialog', { name: `${date}比赛选择` });
  const raceChoice = within(picker).getByRole('radio', {
    name: new RegExp(electiveRace.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  });
  fireEvent.click(raceChoice);
  expect(savedSettings().manualIds).toEqual([electiveRace.id]);
  fireEvent.click(within(picker).getByRole('button', { name: '固定休息' }));
  expect(savedSettings().manualIds).toEqual([]);
  expect(savedSettings().restTurns).toEqual([electiveRace.turn]);
  expect(raceChoice).not.toBeChecked();
  fireEvent.click(raceChoice);
  expect(savedSettings().manualIds).toEqual([electiveRace.id]);
  expect(savedSettings().restTurns).toEqual([]);
  fireEvent.keyDown(window, { key: 'Escape' });
  view.unmount();

  render(<RacePlanningTab />);
  fireEvent.click(
    screen.getByRole('button', { name: `${date}，已选择${electiveRace.name}` }),
  );
  picker = screen.getByRole('dialog', { name: `${date}比赛选择` });
  fireEvent.click(within(picker).getByRole('button', { name: '恢复自动规划' }));
  expect(savedSettings().manualIds).toEqual([]);
  expect(savedSettings().restTurns).toEqual([]);
});

test('mandatory goals are visible in the calendar and cannot be changed to rest', () => {
  render(<RacePlanningTab />);
  const goalTurn = Number(Object.keys(calendar.fixedRaces)[0]);
  const goalDate = skillPurchaseTurnLabel(goalTurn);
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(`^${goalDate}，生涯目标`) }),
  );
  const picker = screen.getByRole('dialog', { name: `${goalDate}比赛选择` });
  expect(
    within(picker).queryByRole('button', { name: '固定休息' }),
  ).not.toBeInTheDocument();
  expect(
    within(picker).queryByRole('button', { name: '恢复自动规划' }),
  ).not.toBeInTheDocument();
  expect(within(picker).getByRole('radio')).toBeChecked();
  expect(within(picker).getByRole('radio')).toBeDisabled();
  expect(
    screen.getByRole('button', {
      name: `${skillPurchaseTurnLabel(1)}，规划范围外`,
    }),
  ).toBeDisabled();
});

test('switching a character uses shared portrait cards and clears manual constraints', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({ charaId: 1001, fanBonus: 85 }),
  );
  render(<RacePlanningTab />);
  fireEvent.click(screen.getByRole('button', { name: `${date}，自动规划` }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: '固定休息',
    }),
  );
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: '育成马娘' }));
  const picker = screen.getByRole('dialog', { name: '选择规划马娘' });
  const character = PLANNER_CATALOG.characters.find(
    (item) => item.id !== 1001,
  )!;
  fireEvent.change(within(picker).getByRole('textbox'), {
    target: { value: String(character.id) },
  });
  fireEvent.click(
    within(picker).getByRole('button', {
      name: new RegExp(`角色 ID ${character.id}`),
    }),
  );
  expect(savedSettings().charaId).toBe(character.id);
  expect(savedSettings().fanBonus).toBe(85);
  expect(savedSettings().restTurns).toEqual([]);
  expect(savedSettings().manualIds).toEqual([]);
  expect(picker).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '育成马娘' }));
  const reopenedPicker = screen.getByRole('dialog', { name: '选择规划马娘' });
  fireEvent.change(within(reopenedPicker).getByRole('textbox'), {
    target: { value: '不存在的角色' },
  });
  expect(
    within(reopenedPicker).getByText('没有符合条件的马娘'),
  ).toBeInTheDocument();
});

test('results switch between a race list and a read-only calendar', () => {
  render(<RacePlanningTab />);
  expect(
    screen.queryByRole('checkbox', { name: '显示休息／训练回合' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('table', { name: '最优赛程' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '赛程日历' }));
  expect(
    screen.queryByRole('table', { name: '最优赛程' }),
  ).not.toBeInTheDocument();
  const resultCalendar = screen
    .getByRole('heading', { name: '最优赛程日历' })
    .closest('section')!;
  const goalTurn = Number(Object.keys(calendar.fixedRaces)[0]);
  fireEvent.click(
    within(resultCalendar).getByRole('button', {
      name: new RegExp(`^${skillPurchaseTurnLabel(goalTurn)}，生涯目标`),
    }),
  );
  const detail = screen.getByRole('dialog');
  expect(within(detail).getByRole('radio')).toBeDisabled();
  expect(
    within(detail).queryByRole('button', { name: '固定休息' }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: '列表' }));
  expect(screen.getByRole('table', { name: '最优赛程' })).toBeInTheDocument();
});

test('win rates are fixed and hidden, and legacy overrides do not affect the plan', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({
      charaId: 1001,
      rateModel: 'samples',
      inheritance: ['dirt'],
      targets: { dirt: 7 },
      rateOverrides: { '7:7:0': '10' },
    }),
  );
  const view = render(<RacePlanningTab />);
  expect(
    screen.queryByRole('combobox', { name: '胜率数据来源' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /养成马娘.*继承.*适性/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/胜率模型/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('spinbutton', { name: /连战胜率/ }),
  ).not.toBeInTheDocument();
  expect(savedSettings().rateOverrides).toBeUndefined();
  const legacyFans = screen.getByText('期望粉丝', { selector: 'dt' })
    .nextElementSibling!.textContent!;
  view.unmount();
  localStorage.clear();
  render(<RacePlanningTab />);
  expect(
    screen.getByText('期望粉丝', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent(legacyFans);
});

test('goddess is the only scenario and all three year-end races appear in both result views', () => {
  render(<RacePlanningTab />);
  expect(
    screen.queryByRole('combobox', { name: '规划剧本' }),
  ).not.toBeInTheDocument();
  const table = screen.getByRole('table', { name: '最优赛程' });
  calendar.automaticRaces.forEach((race) => {
    const row = within(table).getByText(race.name).closest('tr')!;
    expect(within(row).getByText('剧本')).toBeInTheDocument();
    expect(within(row).getByText('100.0%')).toBeInTheDocument();
    expect(within(row).getByText('0.050')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByRole('button', { name: '赛程日历' }));
  calendar.automaticRaces.forEach((race) => {
    expect(screen.getAllByText(`${race.name} · 剧本`)).toHaveLength(2);
  });
});

test('offline leaderboard follows the objective and applies a reproducible plan then closes', () => {
  localStorage.setItem(
    'uma-race-planner-v1',
    JSON.stringify({
      charaId: 1001,
      objective: 'jewels',
      fanBonus: 40,
      rateOverrides: { '7:7:0': '10' },
    }),
  );
  render(<RacePlanningTab />);
  fireEvent.click(screen.getByRole('button', { name: '排行榜' }));
  const dialog = screen.getByRole('dialog', { name: '赛程排行榜' });
  expect(
    within(dialog).getByRole('button', { name: '期望掉钻' }),
  ).toHaveAttribute('aria-pressed', 'true');
  const winner = rankings.rankings.jewels[0];
  const expectedFans = Math.round(
    (winner.expectedFans * 1.4) / (1 + rankings.fanBonus / 100),
  ).toLocaleString();
  const winnerRow = within(dialog)
    .getByRole('button', { name: `使用${winner.name}的排名方案` })
    .closest('tr')!;
  expect(within(winnerRow).getByText(expectedFans)).toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: `使用${winner.name}的排名方案`,
    }),
  );
  expect(dialog).not.toBeInTheDocument();
  expect(savedSettings()).toMatchObject({
    charaId: winner.charaId,
    routeId: winner.routeId,
    fanBonus: 40,
    manualIds: [],
    restTurns: [],
  });
  const dropStat = screen
    .getByText('期望掉落次数', { selector: 'dt' })
    .closest('div')!;
  expect(
    within(dropStat).getByText(winner.expectedDrops.toFixed(2)),
  ).toBeInTheDocument();
  expect(
    screen.getByText('期望粉丝', { selector: 'dt' }).nextElementSibling,
  ).toHaveTextContent(expectedFans);
});
