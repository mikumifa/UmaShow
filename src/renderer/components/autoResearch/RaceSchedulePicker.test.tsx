import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { createOfflineDesign, normalizeOfflineDesign, offlineRaceRequest } from 'renderer/utils/offlineCareerDesign';
import { buildPlanningCalendar } from 'renderer/utils/racePlannerCatalog';
import OfflineCareerSettings from './OfflineCareerSettings';
import { OfflineCustomSchedule } from './OfflineDesignSettings';
import {
  createDefaultOfflineFactorSelection,
  skillPurchaseTurnLabel,
} from './shared';
import { OfflineSingleModeSetup, RaceOption } from './types';

jest.mock('renderer/utils/umdb', () => ({ UMDB: {} }));
jest.mock('renderer/components/trainingHistory/AssetIcon', () => () => null);

test('custom schedules show locked career goals while extra dates remain editable', () => {
  const calendar = buildPlanningCalendar(1001, 5);
  const design = normalizeOfflineDesign({ source: 'custom' });
  const setDesign = jest.fn();
  render(
    <OfflineCustomSchedule
      design={design}
      setDesign={setDesign}
      charaId={1001}
      scenarioId={5}
    />,
  );
  const goalTurn = Number(Object.keys(calendar.fixedRaces)[0]);
  const goal = screen.getByRole('button', {
    name: new RegExp(`^${skillPurchaseTurnLabel(goalTurn)}，生涯目标`),
  });
  expect(goal).toBeDisabled();
  fireEvent.click(goal);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  const extra = calendar.races.find((race) => !calendar.fixedRaces[race.turn])!;
  const date = skillPurchaseTurnLabel(extra.turn);
  const emptyDate = screen.getByRole('button', { name: `${date}，未选择比赛` });
  expect(emptyDate).toBeEmptyDOMElement();
  expect(screen.getAllByRole('button', { name: /，无赛事$/ })[0]).toBeEmptyDOMElement();
  expect(screen.queryAllByText(/^(上半|下半|未选择|无赛事)$/)).toHaveLength(0);
  fireEvent.click(emptyDate);
  const picker = screen.getByRole('dialog', { name: `${date}比赛选择` });
  fireEvent.click(within(picker).getAllByRole('radio')[0]);
  const updated = setDesign.mock.calls[0][0](design);
  expect(updated.raceIds).toHaveLength(1);
  expect(calendar.fixedRaces[extra.turn]).toBeUndefined();
  expect(Object.values(calendar.fixedRaces).flat()).not.toContain(
    updated.raceIds[0],
  );
  expect(screen.queryByText(/生涯目标由游戏自动执行/)).not.toBeInTheDocument();
  expect(screen.queryByText(/· 剧本$/)).not.toBeInTheDocument();
});

test('new local schedules apply only additional races and legacy game slots remain readable', () => {
  const design = createOfflineDesign();
  expect(design.source).toBe('custom');
  expect(offlineRaceRequest(undefined)).toEqual({ race_source: 'api' });
  const setDesign = jest.fn();
  const { rerender } = render(
    <OfflineCustomSchedule design={design} setDesign={setDesign} charaId={1001} scenarioId={5} />,
  );
  fireEvent.click(screen.getByRole('button', { name: '一键设置' }));
  const next = setDesign.mock.calls[0][0](design);
  const calendar = buildPlanningCalendar(1001, 5);
  expect(next.raceIds.length).toBeGreaterThan(0);
  expect(next.raceIds.some((id: number) => Object.values(calendar.fixedRaces).flat().includes(id))).toBe(false);
  rerender(<OfflineCustomSchedule design={next} setDesign={setDesign} charaId={1001} scenarioId={5} />);
  expect(screen.getAllByRole('button', { name: /，已选择/ })).toHaveLength(next.raceIds.length);
  expect(screen.queryByRole('heading', { name: '参赛计划' })).toBeNull();
  expect(screen.queryByText(/期望获得|其他生涯目标|已选择 \d+ 场/)).toBeNull();
});

test('a nested race picker keeps its selection and closes before the deck editor', () => {
  const saveDeck = jest.fn().mockResolvedValue(true);
  const race = {
    id: 201001,
    program_id: 1001,
    turn: 25,
    name: '测试比赛',
    date: '经典级1月上半月',
    type: 'G1',
  } as RaceOption;
  const setup = {
    scenario_id: 1,
    required_race_array: [],
    race_decks: [{ deck_num: 1, deck_name: '测试赛程', race_array: [] }],
  } as unknown as OfflineSingleModeSetup;
  const { container } = render(
    <OfflineCareerSettings
      setup={setup}
      selectedScenarioId={1}
      races={[race]}
      selectedDeckNum={1}
      setSelectedDeckNum={jest.fn()}
      busy=""
      prepare={jest.fn().mockResolvedValue(setup)}
      saveDeck={saveDeck}
      factorSelection={createDefaultOfflineFactorSelection()}
      setFactorSelection={jest.fn()}
      parents={[]}
      umas={[]}
      skills={[]}
    />,
  );

  fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);
  const editor = screen.getByRole('dialog', { name: '编辑游戏赛程槽位 1' });
  const footer = within(editor).getByRole('button', { name: '保存槽位 1' }).closest('footer')!;
  const count = within(footer).getByRole('status');
  expect(count).toHaveTextContent('已选择 0 场');
  expect(within(editor).queryByText('赛程详细')).toBeNull();
  expect(within(editor).queryByText(/此为赛程预设/)).toBeNull();
  const dateLabel = skillPurchaseTurnLabel(race.turn);
  fireEvent.click(
    within(editor).getByRole('button', { name: `${dateLabel}，未选择比赛` }),
  );
  const picker = screen.getByRole('dialog', { name: `${dateLabel}比赛选择` });
  expect(container).not.toContainElement(picker);
  fireEvent.click(within(picker).getByRole('radio'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(picker).not.toBeInTheDocument();
  expect(editor).toBeInTheDocument();
  expect(count).toHaveTextContent('已选择 1 场');
  expect(
    within(editor).getByRole('button', {
      name: `${dateLabel}，已选择测试比赛`,
    }),
  ).toBeInTheDocument();
  expect(saveDeck).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(editor).not.toBeInTheDocument();
});

test('local mode exposes the designer and the game preset switch opts into the slot editor', () => {
  const switchMode = jest.fn();
  const prepare = jest.fn();
  const props = {
    setup: null, selectedScenarioId: 5, races: [], selectedDeckNum: 0,
    setSelectedDeckNum: jest.fn(), busy: '', prepare, saveDeck: jest.fn(),
    factorSelection: createDefaultOfflineFactorSelection(), setFactorSelection: jest.fn(),
    parents: [], umas: [], skills: [], setCustomSchedule: switchMode,
    renderCustomSchedule: (actionHost: HTMLDivElement | null) => (
      <OfflineCustomSchedule
        design={createOfflineDesign()} setDesign={jest.fn()} charaId={1001} scenarioId={5}
        actionHost={actionHost}
      />
    ),
  };
  const { rerender } = render(<OfflineCareerSettings {...props} customSchedule />);
  const toggle = screen.getByRole('switch', { name: '游戏内预设赛程' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  const title = screen.getByRole('heading', { name: '赛程设置' });
  expect(within(title.parentElement!).getByRole('button', { name: '一键设置' })).toBeVisible();
  expect(screen.queryByText(/槽位 1 ·/)).toBeNull();
  expect(prepare).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  expect(switchMode).toHaveBeenCalledWith(false);
  rerender(<OfflineCareerSettings {...props} customSchedule={false} />);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText(/槽位 1 ·/)).toBeVisible();
  expect(screen.queryByRole('button', { name: '一键设置' })).toBeNull();
});
