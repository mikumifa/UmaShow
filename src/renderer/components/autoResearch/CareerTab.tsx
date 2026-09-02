/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { Dispatch, SetStateAction } from 'react';
import {
  Database,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import OfflineCareerSettings from './OfflineCareerSettings';
import {
  DeckChoiceCard,
  horseIconPath,
  ParentChoiceCard,
  SupportChoiceCard,
  UmaChoiceCard,
} from './SelectionCards';
import { panelClass, scrollToSection } from './shared';
import { AutoResearchSkill } from './SkillSelector';
import {
  CareerSetting,
  Dashboard,
  OfflineFactorSelection,
  OfflineSkillSettings,
  OfflineSingleModeSetup,
  Preset,
  RaceOption,
  SessionAccount,
  SupportInfo,
} from './types';

type CareerTabProps = {
  dashboard: Dashboard;
  careerSaveOpen: boolean;
  accountCareerSettings: CareerSetting[];
  matchingCareerSettings: CareerSetting[];
  applyCareerSetting: (settingId: string) => void;
  continueWithSetting: (settingId: string) => void;
  deleteCareerSetting: (settingId: string) => void;
  newCareerSaveName: string;
  setNewCareerSaveName: Dispatch<SetStateAction<string>>;
  createCareerSave: () => void;
  careerSettingName: string;
  automationActive: boolean;
  busy: string;
  activeCareer?: SessionAccount['career'];
  activeCareerIconPath?: string;
  unsupportedCareer: boolean;
  abandonCareer: () => Promise<void>;
  continuingCurrentCareer: boolean;
  canContinueCurrentCareer: boolean;
  saveCareerSetting: () => boolean;
  saveAndApplyCareerSetting: () => Promise<void>;
  saveAndRunCareer: () => void;
  careerPresetName: string;
  newCareerPresetName: string;
  setNewCareerPresetName: Dispatch<SetStateAction<string>>;
  newCareerMode: 'online' | 'offline';
  setNewCareerMode: Dispatch<SetStateAction<'online' | 'offline'>>;
  editCareerPreset: () => void;
  closeCareerEditor: () => void;
  presets: Preset[];
  selectedUma?: Dashboard['umas'][number];
  cardId: number;
  setCardId: Dispatch<SetStateAction<number>>;
  filteredUmas: Dashboard['umas'];
  umaSearch: string;
  setUmaSearch: Dispatch<SetStateAction<string>>;
  selectedParent1?: Dashboard['parents'][number];
  selectedParent2?: Dashboard['parents'][number];
  parent1: string;
  parent2: string;
  setParent1: Dispatch<SetStateAction<string>>;
  setParent2: Dispatch<SetStateAction<string>>;
  filteredParents: Dashboard['parents'];
  parentSearch: string;
  setParentSearch: Dispatch<SetStateAction<string>>;
  parentSelectionSlot: 1 | 2;
  setParentSelectionSlot: Dispatch<SetStateAction<1 | 2>>;
  deckId: number;
  setDeckId: Dispatch<SetStateAction<number>>;
  setSupportCardIds: Dispatch<SetStateAction<number[]>>;
  selectedDeckCharaIds: number[];
  supportSearch: string;
  setSupportSearch: Dispatch<SetStateAction<string>>;
  friendCardId: number;
  setFriendCardId: Dispatch<SetStateAction<number>>;
  selectedFriendSupport?: SupportInfo;
  visibleFriendSupports: SupportInfo[];
  availableFriendSupportIds: Set<number>;
  maxSteps: number;
  setMaxSteps: Dispatch<SetStateAction<number>>;
  burnClocks: boolean;
  setBurnClocks: Dispatch<SetStateAction<boolean>>;
  recoverTpWithItem: boolean;
  setRecoverTpWithItem: Dispatch<SetStateAction<boolean>>;
  recoverTpWithJewels: boolean;
  setRecoverTpWithJewels: Dispatch<SetStateAction<boolean>>;
  selectionConflict: string;
  refreshOptionsIndex: () => Promise<void>;
  renameCareerSetting: (settingId: string, name: string) => void;
  selectedAccountId: string;
  careerMode: 'online' | 'offline';
  offlineSetup: OfflineSingleModeSetup | null;
  offlineScenarios: Dashboard['offline_scenarios'];
  offlineScenarioId: number;
  changeOfflineScenario: (scenarioId: number) => void;
  offlineChallengeMode: boolean;
  setOfflineChallengeMode: Dispatch<SetStateAction<boolean>>;
  offlineRaceDeckNum: number;
  setOfflineRaceDeckNum: Dispatch<SetStateAction<number>>;
  setOfflineRaceDeckName: Dispatch<SetStateAction<string>>;
  offlineRaceIds: number[];
  setOfflineRaceIds: Dispatch<SetStateAction<number[]>>;
  resetOfflineCareer: () => void;
  prepareOfflineCareer: () => Promise<void>;
  saveOfflineRaceDeck: () => Promise<void>;
  races: RaceOption[];
  skills: AutoResearchSkill[];
  offlineFactorSelection: OfflineFactorSelection;
  setOfflineFactorSelection: Dispatch<SetStateAction<OfflineFactorSelection>>;
  offlineSkillSettings: OfflineSkillSettings;
  setOfflineSkillSettings: Dispatch<SetStateAction<OfflineSkillSettings>>;
};

export default function CareerTab(props: CareerTabProps) {
  const {
    dashboard,
    careerSaveOpen,
    accountCareerSettings,
    matchingCareerSettings,
    applyCareerSetting,
    continueWithSetting,
    deleteCareerSetting,
    newCareerSaveName,
    setNewCareerSaveName,
    createCareerSave,
    careerSettingName,
    automationActive,
    busy,
    activeCareer,
    activeCareerIconPath,
    unsupportedCareer,
    abandonCareer,
    continuingCurrentCareer,
    canContinueCurrentCareer,
    saveCareerSetting,
    saveAndApplyCareerSetting,
    saveAndRunCareer,
    careerPresetName,
    newCareerPresetName,
    setNewCareerPresetName,
    newCareerMode,
    setNewCareerMode,
    editCareerPreset,
    closeCareerEditor,
    presets,
    selectedUma,
    cardId,
    setCardId,
    filteredUmas,
    umaSearch,
    setUmaSearch,
    selectedParent1,
    selectedParent2,
    parent1,
    parent2,
    setParent1,
    setParent2,
    filteredParents,
    parentSearch,
    setParentSearch,
    parentSelectionSlot,
    setParentSelectionSlot,
    deckId,
    setDeckId,
    setSupportCardIds,
    selectedDeckCharaIds,
    supportSearch,
    setSupportSearch,
    friendCardId,
    setFriendCardId,
    selectedFriendSupport,
    visibleFriendSupports,
    availableFriendSupportIds,
    maxSteps,
    setMaxSteps,
    burnClocks,
    setBurnClocks,
    recoverTpWithItem,
    setRecoverTpWithItem,
    recoverTpWithJewels,
    setRecoverTpWithJewels,
    selectionConflict,
    refreshOptionsIndex,
    renameCareerSetting,
    selectedAccountId,
    careerMode,
    offlineSetup,
    offlineScenarios,
    offlineScenarioId,
    changeOfflineScenario,
    offlineChallengeMode,
    setOfflineChallengeMode,
    offlineRaceDeckNum,
    setOfflineRaceDeckNum,
    setOfflineRaceDeckName,
    offlineRaceIds,
    setOfflineRaceIds,
    resetOfflineCareer,
    prepareOfflineCareer,
    saveOfflineRaceDeck,
    races,
    skills,
    offlineFactorSelection,
    setOfflineFactorSelection,
    offlineSkillSettings,
    setOfflineSkillSettings,
  } = props;
  return activeCareer?.active && !careerSaveOpen ? (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-gray-100">
            {activeCareerIconPath ? (
              <AssetIcon
                path={activeCareerIconPath}
                alt={activeCareer.name}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <Database size={28} className="m-6 text-gray-300" />
            )}
          </span>
          <div>
            <h2 className="text-lg font-bold">当前已有进行中的育成</h2>
            <p className="mt-1 font-medium text-gray-800">
              {activeCareer.name}
            </p>
            <p className="text-sm text-gray-500">
              第 {activeCareer.turn || 0} 回合
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abandonCareer}
            disabled={busy === 'abandon'}
            className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {busy === 'abandon' ? '正在放弃…' : '放弃本次育成'}
          </button>
        </div>
      </div>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">
          符合当前育成的养马详设
        </h3>
        {matchingCareerSettings.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {matchingCareerSettings.map((setting) => (
              <article
                key={setting.id}
                className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
              >
                <strong className="block truncate text-sm text-slate-800">
                  {setting.name}
                </strong>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {setting.preset_name}
                </span>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => applyCareerSetting(setting.id)}
                    className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                  >
                    查看详设
                  </button>
                  <button
                    type="button"
                    onClick={() => continueWithSetting(setting.id)}
                    disabled={Boolean(busy)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Play size={14} />
                    {busy === `resume-${setting.id}` ? '正在继续…' : '继续育成'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
            没有找到与当前育成匹配的养马详设。请放弃当前育成后重新选择。
          </p>
        )}
      </div>
    </section>
  ) : !careerSaveOpen && !automationActive ? (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Database size={19} className="text-indigo-600" />
            选择养马详设
          </h2>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {accountCareerSettings.map((setting) => {
          const uma = dashboard.umas.find(
            (item) => item.id === setting.card_id,
          );
          const offline = setting.mode === 'offline';
          const presetExists =
            offline ||
            presets.some((preset) => preset.name === setting.preset_name);
          // A saved setting already has enough information to show its base
          // portrait. Do not wait for the server-side dashboard. Once the
          // owned-card metadata arrives, switch to the exact race cloth.
          const iconPath = horseIconPath(
            setting.card_id,
            uma?.rarity || 0,
            uma?.race_cloth_id || setting.card_id,
          );
          return (
            <article
              key={setting.id}
              className="rounded-lg border border-gray-200 bg-gray-50/60 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="h-16 w-16 flex-none overflow-hidden rounded-md bg-gray-100">
                  {iconPath ? (
                    <AssetIcon
                      path={iconPath}
                      alt={uma?.name || setting.name}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <Database size={24} className="m-5 text-gray-300" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <label className="block text-xs text-gray-500">
                    详设名称
                    <input
                      key={`${setting.id}-${setting.name}`}
                      defaultValue={setting.name}
                      onBlur={(event) =>
                        renameCareerSetting(setting.id, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                      }}
                      className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-800"
                    />
                  </label>
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {uma?.name || '尚未选择育成马娘'} ·{' '}
                    {offline
                      ? `游戏离线育成 · 槽位 ${setting.offline_race_deck_num || '-'}`
                      : setting.preset_name}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      presetExists
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {offline
                      ? '离线详设'
                      : presetExists
                        ? '已绑定预设'
                        : '绑定预设不存在'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyCareerSetting(setting.id)}
                  disabled={!presetExists}
                  className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  进入详设
                </button>
                <button
                  type="button"
                  onClick={() => deleteCareerSetting(setting.id)}
                  className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  aria-label={`删除详设${setting.name}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          );
        })}

        <article className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4">
          <h3 className="font-semibold text-indigo-950">新建养马详设</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(['online', 'offline'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setNewCareerMode(mode)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  newCareerMode === mode
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-900'
                    : 'border-indigo-100 bg-white text-slate-600'
                }`}
              >
                {mode === 'online' ? '在线自动育成' : '游戏离线育成'}
              </button>
            ))}
          </div>
          {newCareerMode === 'online' ? (
            <>
              <label className="mt-3 block text-xs font-medium text-indigo-900">
                绑定预设
                <select
                  value={newCareerPresetName}
                  onChange={(event) =>
                    setNewCareerPresetName(event.target.value)
                  }
                  className="mt-1 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="">请手动选择预设</option>
                  {presets.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-1 text-xs leading-5 text-indigo-700">
                进入详设后将固定绑定，不能再切换到其他预设。
              </p>
            </>
          ) : (
            <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs leading-5 text-indigo-700">
              离线详设独立保存最后点技能与因子筛选设置，不绑定预设。
            </p>
          )}
          <input
            value={newCareerSaveName}
            onChange={(event) => setNewCareerSaveName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && createCareerSave()}
            placeholder={`例如：URA 详设 ${accountCareerSettings.length + 1}`}
            className="mt-3 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createCareerSave}
            disabled={
              !newCareerSaveName.trim() ||
              (newCareerMode === 'online' && !newCareerPresetName)
            }
            className="mt-2 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} className="mr-1 inline" />
            新建并进入
          </button>
        </article>
      </div>
    </section>
  ) : (
    <>
      <nav className="sticky top-[52px] z-20 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        {[
          ['career-task', '任务配置'],
          ['career-selection', '选择阵容'],
          ...(careerMode === 'offline'
            ? [
                ['offline-career-setup', '离线赛程'],
                ['career-options', '结束点技能'],
                ['career-factor-options', '因子筛选'],
              ]
            : [['career-options', '其他设置']]),
        ].map(([target, label]) => (
          <button
            key={target}
            type="button"
            onClick={() => scrollToSection(target)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {label}
          </button>
        ))}
      </nav>

      <section id="career-task" className={`${panelClass('p-5')} scroll-mt-28`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              育成任务配置 · {careerSettingName}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeCareerEditor}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              返回详设选择界面
            </button>
            {careerMode === 'online' ? (
              <button
                type="button"
                onClick={editCareerPreset}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              >
                编辑预设
              </button>
            ) : null}
            {automationActive && careerMode === 'online' ? (
              <button
                type="button"
                onClick={saveAndApplyCareerSetting}
                disabled={Boolean(busy)}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === 'update-runner' ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                {busy === 'update-runner' ? '正在应用…' : '保存并立即应用'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveCareerSetting}
                  disabled={busy === 'run'}
                  className="flex items-center gap-2 rounded-md border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <Save size={16} />
                  保存设置
                </button>
                <button
                  type="button"
                  onClick={saveAndRunCareer}
                  disabled={
                    Boolean(busy) ||
                    unsupportedCareer ||
                    (continuingCurrentCareer && !canContinueCurrentCareer) ||
                    (careerMode === 'offline' &&
                      (!offlineSetup || !offlineRaceDeckNum))
                  }
                  className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play size={17} />
                  {busy === 'run' || busy === 'idle-start'
                    ? dashboard.account.career?.active
                      ? '正在保存并继续…'
                      : careerMode === 'offline'
                        ? '正在启动离线育成…'
                        : '正在保存并开始…'
                    : careerMode === 'offline' &&
                        (!offlineSetup || !offlineRaceDeckNum)
                      ? '请先读取游戏赛程'
                      : unsupportedCareer
                        ? '请先放弃当前育成'
                        : continuingCurrentCareer
                          ? canContinueCurrentCareer
                            ? '保存并继续'
                            : '当前详设不匹配'
                          : '保存并开始'}
                </button>
              </>
            )}
            {dashboard.account.career?.active ? (
              <button
                type="button"
                onClick={abandonCareer}
                disabled={busy === 'abandon'}
                className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {busy === 'abandon' ? '正在放弃…' : '放弃本次育成'}
              </button>
            ) : null}
          </div>
        </div>

        {!dashboard.account.career?.active ? (
          <div id="career-selection" className="mt-5 scroll-mt-28 space-y-5">
            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      选择育成马娘
                    </h3>
                  </div>
                </div>
                <label className="relative block w-full sm:w-72">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    value={umaSearch}
                    onChange={(event) => setUmaSearch(event.target.value)}
                    placeholder="搜索马娘"
                    className="w-full cursor-text select-text rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex max-h-[420px] flex-wrap content-start gap-2 overflow-auto pr-1">
                {filteredUmas.map((uma) => (
                  <UmaChoiceCard
                    key={uma.id}
                    uma={uma}
                    selected={cardId === uma.id}
                    onSelect={() => {
                      setCardId(uma.id);
                      setDeckId(0);
                      setSupportCardIds([]);
                      setFriendCardId(0);
                      setParent1('');
                      setParent2('');
                      setParentSelectionSlot(1);
                      resetOfflineCareer();
                    }}
                  />
                ))}
              </div>
            </section>

            <section
              className={`rounded-lg border p-4 ${
                selectedUma
                  ? 'border-gray-200 bg-gray-50/60'
                  : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    2
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      选择继承马娘
                    </h3>
                  </div>
                </div>
                {selectedUma ? (
                  <label className="relative block w-full sm:w-80">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
                    />
                    <input
                      value={parentSearch}
                      onChange={(event) => setParentSearch(event.target.value)}
                      placeholder="搜索马娘名或因子"
                      className="w-full cursor-text select-text rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
                    />
                  </label>
                ) : null}
              </div>

              {!selectedUma ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  请先完成第 1 步，选择要养的马娘。
                </div>
              ) : (
                <>
                  <div className="mt-3 flex gap-2">
                    {[
                      [1, selectedParent1],
                      [2, selectedParent2],
                    ].map(([slot, parent]) => {
                      const slotNumber = slot as 1 | 2;
                      const selectedParent = parent as
                        | Dashboard['parents'][number]
                        | undefined;
                      return (
                        <button
                          key={slotNumber}
                          type="button"
                          onClick={() => setParentSelectionSlot(slotNumber)}
                          className={`flex h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-lg border p-1 text-center ${
                            parentSelectionSlot === slotNumber
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          {selectedParent ? (
                            <AssetIcon
                              path={
                                horseIconPath(
                                  selectedParent.card_id,
                                  selectedParent.rarity,
                                  selectedParent.race_cloth_id,
                                ) || ''
                              }
                              alt={selectedParent.name}
                              className="h-full w-full rounded object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-500">
                              继承马娘 {slotNumber}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid max-h-[720px] gap-2 overflow-auto pr-1 xl:grid-cols-2">
                    {filteredParents.map((parent) => {
                      const currentValue =
                        parentSelectionSlot === 1 ? parent1 : parent2;
                      const otherValue =
                        parentSelectionSlot === 1 ? parent2 : parent1;
                      const otherParent = dashboard.parents.find(
                        (item) => item.selection_id === otherValue,
                      );
                      const blockedCharaIds = new Set([
                        selectedUma.chara_id,
                        otherParent?.chara_id || 0,
                      ]);
                      return (
                        <ParentChoiceCard
                          key={parent.selection_id}
                          parent={parent}
                          selected={currentValue === parent.selection_id}
                          disabled={
                            otherValue === parent.selection_id ||
                            blockedCharaIds.has(parent.chara_id) ||
                            (parent.source === 'rental' &&
                              otherParent?.source === 'rental')
                          }
                          onSelect={() => {
                            if (parentSelectionSlot === 1) {
                              setParent1(parent.selection_id);
                              setParentSelectionSlot(2);
                            } else {
                              setParent2(parent.selection_id);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  3
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">选择支援卡组</h3>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap content-start gap-3">
                {dashboard.decks.map((deck) => {
                  const deckCharaIds = deck.cards.map(
                    (support) => support.chara_id,
                  );
                  const reservedCharaIds = new Set([
                    selectedUma?.chara_id || 0,
                    selectedFriendSupport?.chara_id || 0,
                  ]);
                  const disabled =
                    deck.cards.length !== 5 ||
                    new Set(deckCharaIds).size !== deckCharaIds.length ||
                    deckCharaIds.some((charaId) =>
                      reservedCharaIds.has(charaId),
                    );
                  return (
                    <DeckChoiceCard
                      key={deck.id}
                      deck={deck}
                      selected={deckId === deck.id}
                      disabled={disabled}
                      onSelect={() => {
                        setDeckId(deck.id);
                        setSupportCardIds(deck.support_card_ids);
                      }}
                    />
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    4
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      选择好友支援卡
                    </h3>
                    <p className="text-xs text-gray-500">
                      只允许借用满破满级支援。
                    </p>
                  </div>
                </div>
                <label className="relative block w-full sm:w-80">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    value={supportSearch}
                    onChange={(event) => setSupportSearch(event.target.value)}
                    placeholder="搜索支援卡名称或类型"
                    className="w-full cursor-text select-text rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={refreshOptionsIndex}
                  disabled={!selectedAccountId || busy === 'options-index'}
                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    className={busy === 'options-index' ? 'animate-spin' : ''}
                  />
                  {busy === 'options-index'
                    ? '正在刷新 …'
                    : `刷新 好友支援卡列表${availableFriendSupportIds.size ? `（${availableFriendSupportIds.size} 张可借）` : ''}`}
                </button>
              </div>
              <div className="mt-3 flex max-h-[460px] flex-wrap content-start gap-1.5 overflow-auto pr-1">
                {visibleFriendSupports.map((support) => {
                  const reservedCharaIds = new Set([
                    selectedUma?.chara_id || 0,
                    ...selectedDeckCharaIds,
                  ]);
                  return (
                    <SupportChoiceCard
                      key={support.id}
                      support={support}
                      selected={friendCardId === support.id}
                      disabled={reservedCharaIds.has(support.chara_id)}
                      onSelect={() => setFriendCardId(support.id)}
                    />
                  );
                })}
              </div>
              {!visibleFriendSupports.length && busy !== 'options-index' ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  当前没有找到符合条件的满破满级好友支援。
                </div>
              ) : null}
            </section>

            <section
              id={careerMode === 'online' ? 'career-options' : undefined}
              className={
                careerMode === 'online'
                  ? 'scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4'
                  : 'contents'
              }
            >
              {careerMode === 'online' ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    5
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      编辑其他设置
                    </h3>
                  </div>
                </div>
              ) : null}

              {selectionConflict ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selectionConflict}
                </div>
              ) : null}

              <div
                className={
                  careerMode === 'online'
                    ? 'mt-4 grid gap-4 md:grid-cols-2'
                    : 'contents'
                }
              >
                {careerMode === 'online' ? (
                  <>
                    <div className="text-sm">
                      绑定预设
                      <div className="mt-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                        <strong className="block text-sm text-violet-950">
                          {careerPresetName}
                        </strong>
                        <span className="mt-0.5 block text-xs text-violet-700">
                          该详设已与此预设绑定，不能切换
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={editCareerPreset}
                        className="mt-2 block text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        编辑“{careerPresetName}”的预设配置 →
                      </button>
                    </div>
                    <label className="text-sm">
                      单次养马防卡死上限
                      <span className="mt-0.5 block text-xs text-slate-400">
                        最多处理多少次训练、事件和比赛；不是养马次数，通常不用修改
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={3000}
                        value={maxSteps}
                        onChange={(event) =>
                          setMaxSteps(Number(event.target.value))
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2"
                      />
                    </label>
                  </>
                ) : (
                  <div className="contents">
                    <OfflineCareerSettings
                      setup={offlineSetup}
                      scenarios={offlineScenarios}
                      selectedScenarioId={offlineScenarioId}
                      onScenarioChange={changeOfflineScenario}
                      races={races}
                      selectedDeckNum={offlineRaceDeckNum}
                      setSelectedDeckNum={setOfflineRaceDeckNum}
                      setDeckName={setOfflineRaceDeckName}
                      selectedRaceIds={offlineRaceIds}
                      setSelectedRaceIds={setOfflineRaceIds}
                      challengeMode={offlineChallengeMode}
                      setChallengeMode={setOfflineChallengeMode}
                      busy={busy}
                      prepare={prepareOfflineCareer}
                      saveDeck={saveOfflineRaceDeck}
                      factorSelection={offlineFactorSelection}
                      setFactorSelection={setOfflineFactorSelection}
                      parents={dashboard.parents}
                      umas={dashboard.umas}
                      skills={skills}
                      skillSettings={offlineSkillSettings}
                      setSkillSettings={setOfflineSkillSettings}
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {careerMode === 'offline' ? (
                  <div className="px-3 py-3">
                    <strong className="block text-sm font-medium text-slate-800">
                      TP 恢复设置
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      离线赛程的基础消耗选项，不属于第 5、6 步。
                    </span>
                  </div>
                ) : null}
                {careerMode === 'online' ? (
                  <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={burnClocks}
                      onChange={(event) => setBurnClocks(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <strong className="block font-medium text-slate-800">
                        比赛失败时使用闹钟
                      </strong>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        失败后有可用闹钟时自动继续；当前有{' '}
                        {dashboard.account.clocks || 0} 个
                      </span>
                    </span>
                  </label>
                ) : null}
                <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={recoverTpWithItem}
                    onChange={(event) =>
                      setRecoverTpWithItem(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong className="block font-medium text-slate-800">
                      TP不足时使用体力药
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      优先使用能量饮料30；当前有{' '}
                      {dashboard.account.energy_drinks || 0} 个
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={recoverTpWithJewels}
                    onChange={(event) =>
                      setRecoverTpWithJewels(event.target.checked)
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong className="block font-medium text-slate-800">
                      仍不足时允许使用宝石
                    </strong>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      会实际消耗宝石恢复TP，默认关闭
                    </span>
                  </span>
                </label>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </>
  );
}
