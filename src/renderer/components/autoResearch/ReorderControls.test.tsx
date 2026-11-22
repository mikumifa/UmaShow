/* eslint-disable react/jsx-props-no-spreading */
import { ComponentProps, ReactNode, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReorderControls from './ReorderControls';
import OfflineCareerSettings from './OfflineCareerSettings';
import PresetsTab from './PresetsTab';
import { OfflineFactorSelection } from './types';
import { localAutoResearchSkillById } from './catalog';
import { offlineSkillRequest } from './offlineCareerSkills';
import {
  createDefaultOfflineFactorSelection,
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
        obtainableGroups={new Map([
          [20001, [{ label: '种马' }, { label: '事件', supportId: 30001, supportName: '特别周' }]],
          [90001, [{ label: '种马' }]],
        ])}
        skills={[200011, 200012, 201192, 201191, 900011].map(
          (id) => localAutoResearchSkillById.get(id)!,
        )}
      />
      <output data-testid="state">{JSON.stringify({ factorSelection })}</output>
    </>
  );
}

const readState = () => JSON.parse(screen.getByTestId('state').textContent!);
const button = (name: string) => screen.getByRole('button', { name });

test('mode and priority explanations expand independently of mode selection', () => {
  render(<OfflineForm />);
  const parent = button('父辈模式');
  const ancestor = button('祖辈模式');
  for (const [label, copy] of [
    ['父辈模式说明', /可以设置另一侧完整父辈/],
    ['祖辈模式说明', /只按自身因子继承概率/],
    ['适应性与技能优先级说明', /优先比较目标因子至少继承一次的概率/],
  ] as const) {
    const help = button(label);
    expect(screen.getByText(copy)).not.toBeVisible();
    fireEvent.click(help);
    expect(help).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(copy)).toBeVisible();
    expect(parent).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(help);
    expect(screen.getByText(copy)).not.toBeVisible();
  }
  fireEvent.click(ancestor);
  const weightHelp = button('适应性与技能因子权重说明');
  expect(weightHelp).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(weightHelp);
  expect(screen.getByText(/按两次继承的期望跳数加权累加/)).toBeVisible();
});

test('attribute star filters only store the selected minimums', () => {
  render(<OfflineForm />);
  const filters = within(screen.getByRole('group', { name: '属性因子最低星数' }));
  const speed = filters.getByRole('combobox', { name: '速度因子最低星数' });
  const power = filters.getByRole('combobox', { name: '力量因子最低星数' });
  expect(filters.getAllByRole('combobox').map((item) => (
    (item as HTMLSelectElement).value
  ))).toEqual(['', '', '', '', '']);
  fireEvent.change(power, { target: { value: '2' } });
  for (const stars of [1, 2, 3]) {
    fireEvent.change(speed, { target: { value: String(stars) } });
    expect(readState().factorSelection.blue_factor_minimums).toEqual({
      speed: stars, power: 2,
    });
  }
  fireEvent.change(speed, { target: { value: '' } });
  expect(readState().factorSelection.blue_factor_minimums).toEqual({ power: 2 });
});

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

test('disabling factor filtering collapses both editors and keeps score maximization', () => {
  render(<OfflineForm />);
  const toggle = screen.getByRole('switch', { name: '免费因子重抽与筛选' });
  expect(button('添加技能')).toBeVisible();
  expect(screen.queryByText('结束自动点技能')).toBeNull();
  expect(screen.queryByText('优先技能')).toBeNull();
  fireEvent.click(button('添加技能'));
  const picker = within(
    screen.getByRole('dialog', { name: '选择目标白因子技能' }),
  );
  expect(picker.queryByRole('button', { name: /璀璨流星/ })).toBeNull();
  fireEvent.click(picker.getByRole('button', { name: /顺时针◎/ }));
  fireEvent.click(picker.getByRole('button', { name: /顺时针○/ }));
  const request = offlineSkillRequest(readState().factorSelection);
  expect(request.priority_skill_array).toEqual([
    { priority: 1, skill_id: 200012 },
  ]);
  expect(request.offline_skill_settings.learn_skill_list).toEqual([
    ['顺时针○'],
  ]);
  fireEvent.click(picker.getByRole('button', { name: '完成' }));
  fireEvent.click(toggle);
  expect(screen.queryByText('适应性与技能优先级')).toBeNull();
  expect(screen.queryByRole('button', { name: '添加技能' })).toBeNull();
  expect(screen.queryByText(/已关闭筛选|筛选最优因子/)).toBeNull();
  const disabled = offlineSkillRequest(readState().factorSelection);
  expect(disabled.priority_skill_array).toEqual([]);
  expect(disabled.offline_skill_settings.learn_skill_list).toEqual([]);
  expect(disabled.offline_skill_settings.maximize_skill_score_at_end).toBe(true);
  fireEvent.click(toggle);
  expect(offlineSkillRequest(readState().factorSelection)).toEqual(request);
});

test('skill scopes preserve selections and search, and both views show the game description', () => {
  render(<OfflineForm />);
  fireEvent.click(button('添加技能'));
  const dialog = within(screen.getByRole('dialog', { name: '选择目标白因子技能' }));
  const all = dialog.getByRole('tab', { name: '全部技能' });
  const obtainable = dialog.getByRole('tab', { name: '可获得技能' });
  const search = dialog.getByRole('textbox', { name: '搜索技能名称' });
  const description = '在赛事中期领先一段距离时\n速度略微提升<长距离>';
  expect(all).toHaveAttribute('aria-selected', 'true');
  expect(dialog.queryByRole('button', { name: /璀璨流星|领头心得/ })).toBeNull();
  const skill = dialog.getByRole('button', { name: /保持领先/ });
  expect(skill.textContent).toContain(description);
  const pickerCopy = within(skill).getByText('保持领先').parentElement!;
  expect(within(pickerCopy).getByText('白')).toBeVisible();
  expect(within(pickerCopy).getByText('长距离')).toBeVisible();
  fireEvent.click(skill);
  fireEvent.change(search, { target: { value: '保持领先' } });
  fireEvent.keyDown(all, { key: 'ArrowRight' });
  expect(obtainable).toHaveFocus();
  expect(dialog.queryByRole('button', { name: /保持领先/ })).toBeNull();
  expect(search).toHaveValue('保持领先');
  fireEvent.change(search, { target: { value: '' } });
  const availableCard = within(dialog.getByRole('button', { name: /顺时针○/ }));
  expect(availableCard.getByText('种马')).toBeVisible();
  expect(availableCard.getByTitle('特别周 · 事件')).toBeVisible();
  expect(dialog.queryByRole('button', { name: /璀璨流星/ })).toBeNull();
  fireEvent.click(all);
  expect(dialog.queryByTitle('特别周 · 事件')).toBeNull();
  expect(dialog.getByRole('button', { name: /保持领先/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(dialog.getByRole('button', { name: '完成' }));
  const target = button('下移因子：保持领先').closest<HTMLElement>('[draggable]')!;
  const selectedCopy = within(target).getByText('保持领先').parentElement!;
  expect(selectedCopy.textContent).toBe(pickerCopy.textContent);
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

test('factor targets support drag-and-drop', () => {
  const source = '下移因子：草地';
  const target = '下移因子：泥地';
  const payload = 'factor-target:aptitude:11';
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

test('merges the current priority with the previous tier and splits it on a second click', () => {
  render(<OfflineForm />);
  fireEvent.click(button('短距离'));
  const ranks = () => readState().factorSelection.targets.map((target: { priority: number }) => target.priority);
  expect(screen.queryByRole('button', { name: '草地与上一项并列' })).toBeNull();
  fireEvent.click(button('泥地与上一项并列'));
  expect(ranks()).toEqual([1, 1, 2]);
  fireEvent.click(button('短距离与上一项并列'));
  expect(ranks()).toEqual([1, 1, 1]);
  fireEvent.click(button('泥地与上一项并列'));
  expect(ranks()).toEqual([1, 2, 2]);
  fireEvent.click(button('下移因子：草地'));
  expect(ranks()).toEqual([1, 2, 2]);
  fireEvent.click(button('泥地'));
  expect(screen.queryByRole('button', { name: '草地与上一项并列' })).toBeNull();
  expect(button('短距离与上一项并列')).toHaveAttribute('aria-pressed', 'true');
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
