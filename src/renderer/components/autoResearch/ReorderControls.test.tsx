/* eslint-disable react/jsx-props-no-spreading */
import { ComponentProps, ReactNode, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReorderControls from './ReorderControls';
import OfflineCareerSettings from './OfflineCareerSettings';
import PresetsTab from './PresetsTab';
import { OfflineFactorSelection } from './types';
import {
  createDefaultOfflineFactorSelection,
  createDefaultOfflineSkillSettings,
  createDefaultPreset,
} from './shared';

jest.mock('renderer/utils/umdb', () => ({ UMDB: {} }));
jest.mock('renderer/components/trainingHistory/AssetIcon', () => () => null);
jest.mock('./RaceSchedulePicker', () => () => null);
jest.mock('./EventChoiceSelector', () => () => null);
jest.mock('../AppMenuPortal', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./SkillSelector', () => ({
  __esModule: true,
  default: () => null,
  skillIconPath: () => '',
}));

test('direct transfer disables factor selection and can be switched off', () => {
  render(<OfflineForm />);
  const direct = screen.getByLabelText('养成完成后直接转队');
  expect(direct).not.toBeChecked();
  fireEvent.click(direct);
  expect(direct).toBeChecked();
  expect(screen.getByLabelText('筛选最优因子')).toBeDisabled();
  expect(screen.getByText('直接转队模式不使用因子筛选设置。')).toBeInTheDocument();
  fireEvent.click(direct);
  expect(screen.getByLabelText('筛选最优因子')).not.toBeDisabled();
});

function OfflineForm({ ancestor = false }: { ancestor?: boolean }) {
  const [factorSelection, setFactorSelection] =
    useState<OfflineFactorSelection>(() => ({
      ...createDefaultOfflineFactorSelection(),
      evaluation_mode: ancestor ? ('ancestor' as const) : ('parent' as const),
      targets: [
        {
          factor_group_id: 11,
          name: '草地',
          kind: 'aptitude' as const,
          weight: 2,
        },
        {
          factor_group_id: 12,
          name: '泥地',
          kind: 'aptitude' as const,
          weight: 3,
        },
      ],
    }));
  const [prioritySkillIds, setPrioritySkillIds] = useState([101, 102, 103]);
  const [skillSettings, setSkillSettings] = useState(() => ({
    ...createDefaultOfflineSkillSettings(),
    learn_skill_list: [['甲', '乙'], ['丙'], ['丁']],
    learn_skill_group_labels: ['组合', '单项', '末项'],
  }));
  return (
    <>
      <OfflineCareerSettings
        setup={null}
        selectedScenarioId={1}
        races={[]}
        selectedDeckNum={1}
        setSelectedDeckNum={jest.fn()}
        busy=""
        prepare={async () => null}
        saveDeck={async () => true}
        factorSelection={factorSelection}
        setFactorSelection={setFactorSelection}
        parents={[]}
        umas={[]}
        skills={[]}
        prioritySkillIds={prioritySkillIds}
        setPrioritySkillIds={setPrioritySkillIds}
        skillSettings={skillSettings}
        setSkillSettings={setSkillSettings}
      />
      <output data-testid="state">
        {JSON.stringify({ factorSelection, prioritySkillIds, skillSettings })}
      </output>
    </>
  );
}

const readState = () => JSON.parse(screen.getByTestId('state').textContent!);
const button = (name: string) => screen.getByRole('button', { name });

test('native keyboard-focusable buttons name their actions and guard both boundaries', () => {
  const onMove = jest.fn();
  const { rerender } = render(
    <ReorderControls label="技能甲" index={0} count={3} onMove={onMove} />,
  );
  const up = button('上移技能甲');
  expect(up).toHaveAttribute('type', 'button');
  expect(up.tabIndex).toBe(0);
  up.focus();
  expect(up).toHaveFocus();
  expect(up).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(up);
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.click(button('下移技能甲'));
  expect(onMove).toHaveBeenLastCalledWith(1);
  rerender(
    <ReorderControls label="技能甲" index={2} count={3} onMove={onMove} />,
  );
  fireEvent.click(button('上移技能甲'));
  expect(onMove).toHaveBeenLastCalledWith(1);
  fireEvent.click(button('下移技能甲'));
  expect(onMove).toHaveBeenCalledTimes(2);
  rerender(
    <ReorderControls label="技能甲" index={0} count={1} onMove={onMove} />,
  );
  fireEvent.click(button('上移技能甲'));
  fireEvent.click(button('下移技能甲'));
  expect(onMove).toHaveBeenCalledTimes(2);
});

test('offline priority skills move in both directions and stop at the boundary', () => {
  render(<OfflineForm />);
  const down = button('下移优先技能：技能 101');
  down.focus();
  fireEvent.click(down);
  expect(readState().prioritySkillIds).toEqual([102, 101, 103]);
  expect(down).toHaveFocus();
  fireEvent.click(down);
  fireEvent.click(down);
  expect(readState().prioritySkillIds).toEqual([102, 103, 101]);
  expect(down).toHaveAttribute('aria-disabled', 'true');
  expect(down).toHaveFocus();
  fireEvent.click(button('上移优先技能：技能 101'));
  expect(readState().prioritySkillIds).toEqual([102, 101, 103]);
});

test('final groups retain their members, labels and focused button when reordered', () => {
  render(<OfflineForm />);
  const down = button('下移结束技能：组合');
  down.focus();
  fireEvent.click(down);
  fireEvent.click(down);
  expect(readState().skillSettings.learn_skill_list).toEqual([
    ['丙'],
    ['丁'],
    ['甲', '乙'],
  ]);
  expect(readState().skillSettings.learn_skill_group_labels).toEqual([
    '单项',
    '末项',
    '组合',
  ]);
  expect(down).toHaveFocus();
  fireEvent.click(button('上移结束技能：组合'));
  expect(readState().skillSettings.learn_skill_group_labels).toEqual([
    '单项',
    '组合',
    '末项',
  ]);
});

test('factor ordering preserves weights and is unavailable in ancestor mode', () => {
  const { unmount } = render(<OfflineForm />);
  fireEvent.click(button('下移因子：草地'));
  expect(
    readState().factorSelection.targets.map(
      (target: { name: string; weight: number }) => [
        target.name,
        target.weight,
      ],
    ),
  ).toEqual([
    ['泥地', 3],
    ['草地', 2],
  ]);
  fireEvent.click(button('上移因子：草地'));
  expect(readState().factorSelection.targets[0].name).toBe('草地');
  unmount();
  render(<OfflineForm ancestor />);
  expect(screen.queryByRole('button', { name: '下移因子：草地' })).toBeNull();
});

test.each([
  ['下移优先技能：技能 101', '下移优先技能：技能 103', 'priority-skill:0'],
  ['下移结束技能：组合', '下移结束技能：末项', 'final-skill:0'],
  ['下移因子：草地', '下移因子：泥地', 'factor-target:aptitude:11'],
])('drag-and-drop remains available for %s', (source, target, payload) => {
  render(<OfflineForm />);
  const dataTransfer = { getData: () => payload, setData: jest.fn() };
  const sourceRow = button(source).closest('[draggable]')!;
  const targetRow = button(target).closest('[draggable]')!;
  fireEvent.dragStart(sourceRow, { dataTransfer });
  fireEvent.dragOver(targetRow, { dataTransfer });
  fireEvent.drop(targetRow, { dataTransfer });
  fireEvent.dragEnd(sourceRow, { dataTransfer });
  expect(button(source)).toHaveAttribute('aria-disabled', 'true');
});

function presetProps(): ComponentProps<typeof PresetsTab> {
  return {
    presetEditorOpen: false,
    presets: [createDefaultPreset('自定义')],
    newPresetName: '',
    setNewPresetName: jest.fn(),
    createPresetSlot: jest.fn(),
    openPresetEditor: jest.fn(),
    renamePreset: jest.fn(() => true),
    careerSettings: [],
    exportPreset: jest.fn(),
    deletePreset: jest.fn(),
    importPreset: jest.fn(),
    setPresetEditorOpen: jest.fn(),
    savePreset: jest.fn(),
    busy: '',
    presetSaved: false,
    presetDirty: true,
    presetSyncError: false,
    scenarioId: 1,
    setScenarioId: jest.fn(),
    runningStyle: 1,
    setRunningStyle: jest.fn(),
    skillSelections: [
      { id: 'a', label: '组合', skill_names: ['甲', '乙'] },
      { id: 'b', label: '丙', skill_names: ['丙'] },
    ],
    draggedPrioritySkill: '',
    setDraggedPrioritySkill: jest.fn(),
    reorderPrioritySkill: jest.fn(),
    setEditingSkillSelectionId: jest.fn(),
    setSkillSettingYearOffset: jest.fn(),
    setSkillPickerOpen: jest.fn(),
    skillByName: new Map(),
    skillLearningConditionLabel: () => '',
    setSkillSelections: jest.fn(),
    skipDoubleCircle: false,
    setSkipDoubleCircle: jest.fn(),
    maximizeSkillScoreAtEnd: false,
    setMaximizeSkillScoreAtEnd: jest.fn(),
    skillPurchaseYearOffset: 0,
    setSkillPurchaseYearOffset: jest.fn(),
    skillPurchaseTurns: [],
    setSkillPurchaseTurns: jest.fn(),
    fixedEventChoices: {},
    setFixedEventChoices: jest.fn(),
    stories: [],
    editingSkillSelectionId: '',
    setSkillLearningSettings: jest.fn(),
    targetAttributes: [1200, 800, 1000, 600, 1000],
    setTargetAttributes: jest.fn(),
    targetAttributeStages: [],
    setTargetAttributeStages: jest.fn(),
    targetAttributeStageYearOffset: 0,
    setTargetAttributeStageYearOffset: jest.fn(),
    races: [],
    selectedRaceIds: [],
    setSelectedRaceIds: jest.fn(),
  };
}

test('preset rename and create fields have labels and keep Enter behavior', () => {
  const props = presetProps();
  render(<PresetsTab {...props} />);
  const rename = screen.getByRole('textbox', { name: '重命名预设：自定义' });
  rename.focus();
  fireEvent.change(rename, { target: { value: '重命名' } });
  fireEvent.keyDown(rename, { key: 'Enter' });
  expect(props.renamePreset).toHaveBeenCalledWith('自定义', '重命名');
  const create = screen.getByRole('textbox', { name: '预设名称' });
  fireEvent.change(create, { target: { value: '新预设' } });
  expect(props.setNewPresetName).toHaveBeenCalledWith('新预设');
  fireEvent.keyDown(create, { key: 'Enter' });
  expect(props.createPresetSlot).toHaveBeenCalledTimes(1);
});

test('preset groups and single skills use the existing reorder callback for buttons and drops', () => {
  const props = { ...presetProps(), presetEditorOpen: true };
  render(<PresetsTab {...props} />);
  fireEvent.click(button('上移育成中技能：组合'));
  expect(props.reorderPrioritySkill).not.toHaveBeenCalled();
  fireEvent.click(button('下移育成中技能：组合'));
  expect(props.reorderPrioritySkill).toHaveBeenLastCalledWith('a', 'b');
  fireEvent.click(button('上移育成中技能：丙'));
  expect(props.reorderPrioritySkill).toHaveBeenLastCalledWith('b', 'a');
  fireEvent.drop(button('下移育成中技能：组合').closest('[draggable]')!, {
    dataTransfer: { getData: () => 'b' },
  });
  expect(props.reorderPrioritySkill).toHaveBeenLastCalledWith('b', 'a');
});

test('preset save state persists, sync can retry, and back uses the parent callback', () => {
  const props = { ...presetProps(), presetEditorOpen: true };
  const { rerender } = render(<PresetsTab {...props} />);
  expect(screen.getByRole('status')).toHaveTextContent('未保存');
  fireEvent.click(button('保存修改'));
  expect(props.savePreset).toHaveBeenCalledTimes(1);
  rerender(<PresetsTab {...props} presetDirty={false} presetSaved />);
  expect(screen.getByRole('status')).toHaveTextContent('已保存');
  expect(button('已保存')).toBeEnabled();
  rerender(<PresetsTab {...props} presetDirty={false} presetSyncError />);
  expect(screen.getByRole('status')).toHaveTextContent(
    '已保存到本地，运行配置同步失败',
  );
  expect(button('重试同步')).toBeEnabled();
  fireEvent.click(button('重试同步'));
  expect(props.savePreset).toHaveBeenCalledTimes(2);
  fireEvent.click(button('返回'));
  expect(props.setPresetEditorOpen).toHaveBeenCalledWith(false);
  rerender(<PresetsTab {...props} busy="preset" />);
  expect(button('保存中…')).toBeDisabled();
});
