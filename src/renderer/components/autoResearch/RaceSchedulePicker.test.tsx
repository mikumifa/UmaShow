import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { normalizeOfflineDesign } from 'renderer/utils/offlineCareerDesign';
import { buildPlanningCalendar } from 'renderer/utils/racePlannerCatalog';
import OfflineCareerSettings from './OfflineCareerSettings';
import { OfflineCustomSchedule } from './OfflineDesignSettings';
import {
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
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
  fireEvent.click(screen.getByRole('button', { name: `${date}，未选择比赛` }));
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
      prioritySkillIds={[]}
      setPrioritySkillIds={jest.fn()}
      skillSettings={createDefaultOfflineSkillSettings()}
      setSkillSettings={jest.fn()}
    />,
  );

  fireEvent.click(screen.getAllByRole('button', { name: '编辑' })[0]);
  const editor = screen.getByRole('dialog', { name: '编辑游戏赛程槽位 1' });
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
  expect(
    within(editor).getByRole('button', {
      name: `${dateLabel}，已选择测试比赛`,
    }),
  ).toBeInTheDocument();
  expect(saveDeck).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(editor).not.toBeInTheDocument();
});
