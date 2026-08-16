/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { Dispatch, SetStateAction } from 'react';
import {
  CircleStop,
  Database,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  DeckChoiceCard,
  horseIconPath,
  ParentChoiceCard,
  SupportChoiceCard,
  UmaChoiceCard,
} from './SelectionCards';
import { panelClass, scrollToSection } from './shared';
import {
  AutoResearchTab,
  CareerSetting,
  Dashboard,
  Preset,
  SessionAccount,
  SupportInfo,
} from './types';

type CareerTabProps = {
  dashboard: Dashboard;
  careerSaveOpen: boolean;
  accountCareerSettings: CareerSetting[];
  applyCareerSetting: (settingId: string) => void;
  deleteCareerSetting: (settingId: string) => void;
  newCareerSaveName: string;
  setNewCareerSaveName: Dispatch<SetStateAction<string>>;
  createCareerSave: () => void;
  careerSettingName: string;
  navigateToTab: (tab: AutoResearchTab, target?: string) => void;
  automationActive: boolean;
  stopCareer: () => Promise<void>;
  runnerStopping: boolean;
  busy: string;
  activeCareer?: SessionAccount['career'];
  matchingCareerSettings: CareerSetting[];
  activeCareerIconPath?: string;
  unsupportedCareer: boolean;
  openSavedRunDialog: (settingId: string) => void;
  abandonCareer: () => Promise<void>;
  continuingCurrentCareer: boolean;
  canContinueCurrentCareer: boolean;
  saveCareerSetting: () => boolean;
  saveAndRunCareer: () => void;
  presetName: string;
  setPresetName: Dispatch<SetStateAction<string>>;
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
  setCareerSaveOpen: Dispatch<SetStateAction<boolean>>;
  renameCareerSetting: (settingId: string, name: string) => void;
  selectedAccountId: string;
};

export default function CareerTab(props: CareerTabProps) {
  const {
    dashboard,
    careerSaveOpen,
    accountCareerSettings,
    applyCareerSetting,
    deleteCareerSetting,
    newCareerSaveName,
    setNewCareerSaveName,
    createCareerSave,
    careerSettingName,
    navigateToTab,
    automationActive,
    stopCareer,
    runnerStopping,
    busy,
    activeCareer,
    matchingCareerSettings,
    activeCareerIconPath,
    unsupportedCareer,
    openSavedRunDialog,
    abandonCareer,
    continuingCurrentCareer,
    canContinueCurrentCareer,
    saveCareerSetting,
    saveAndRunCareer,
    presetName,
    setPresetName,
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
    setCareerSaveOpen,
    renameCareerSetting,
    selectedAccountId,
  } = props;
  return activeCareer?.active ? (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-gray-100">
            {activeCareerIconPath ? (
              <AssetIcon
                path={activeCareerIconPath}
                alt={activeCareer.name}
                className="h-full w-full object-cover"
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
          {automationActive ? (
            <>
              <button
                type="button"
                onClick={() => navigateToTab('progress')}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                查看养马进度
              </button>
              <button
                type="button"
                onClick={stopCareer}
                disabled={runnerStopping || busy === 'stop'}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {runnerStopping ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <CircleStop size={16} />
                )}
                {runnerStopping ? '正在停止…' : '停止自动操作'}
              </button>
            </>
          ) : null}
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

      {automationActive ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          自动育成正在接管本次育成。需要查看回合、行动和错误时，请前往“养马进度”。
        </div>
      ) : matchingCareerSettings.length ? (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <h3 className="font-semibold text-gray-800">
            可以继续使用的养马详设
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            以下详设选择了相同的育成马娘，可以直接继续当前育成。
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchingCareerSettings.map((setting) => (
              <article
                key={setting.id}
                className="rounded-lg border border-gray-200 bg-gray-50/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="h-14 w-14 flex-none overflow-hidden rounded-md bg-gray-100">
                    {activeCareerIconPath ? (
                      <AssetIcon
                        path={activeCareerIconPath}
                        alt={activeCareer.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Database size={20} className="m-4 text-gray-300" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate font-semibold text-gray-900">
                      {setting.name}
                    </h4>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {activeCareer.name} · {setting.preset_name}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      育成马娘一致
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSavedRunDialog(setting.id)}
                  disabled={Boolean(busy)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play size={16} />
                  继续自动育成
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
          <h3 className="font-semibold text-slate-800">
            没有找到可继续使用的养马详设
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            当前账号没有选择相同育成马娘的可用详设。若要重新开始养马，请先放弃本次育成。
          </p>
          {!accountCareerSettings.length ? (
            <p className="mt-3 text-xs text-slate-500">
              这个账号还没有保存过养马详设。
            </p>
          ) : null}
        </div>
      )}
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
          const iconPath = uma
            ? horseIconPath(uma.id, uma.rarity, uma.race_cloth_id)
            : undefined;
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
                    {uma?.name || '尚未选择育成马娘'} · {setting.preset_name}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyCareerSetting(setting.id)}
                  className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
          <input
            value={newCareerSaveName}
            onChange={(event) => setNewCareerSaveName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && createCareerSave()}
            placeholder={`例如：URA 详设 ${accountCareerSettings.length + 1}`}
            className="mt-4 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createCareerSave}
            className="mt-2 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
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
          ['career-options', '其他设置'],
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
              onClick={() => setCareerSaveOpen(false)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              返回详设选择界面
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('presets', 'preset-basic')}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              {presetName ? '编辑当前预设' : '新建预设'}
            </button>
            {automationActive ? (
              <button
                type="button"
                onClick={stopCareer}
                disabled={runnerStopping || busy === 'stop'}
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {runnerStopping ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <CircleStop size={17} />
                )}
                {runnerStopping ? '正在停止…' : '停止自动操作'}
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
                    busy === 'run' ||
                    unsupportedCareer ||
                    (continuingCurrentCareer && !canContinueCurrentCareer)
                  }
                  className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Play size={17} />
                  {busy === 'run'
                    ? dashboard.account.career?.active
                      ? '正在保存并继续…'
                      : '正在保存并开始…'
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
                    className="absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    value={umaSearch}
                    onChange={(event) => setUmaSearch(event.target.value)}
                    placeholder="搜索马娘"
                    className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
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
                      className="absolute left-3 top-2.5 text-gray-400"
                    />
                    <input
                      value={parentSearch}
                      onChange={(event) => setParentSearch(event.target.value)}
                      placeholder="搜索马娘名或因子"
                      className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
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
                    className="absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    value={supportSearch}
                    onChange={(event) => setSupportSearch(event.target.value)}
                    placeholder="搜索支援卡名称或类型"
                    className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
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
              id="career-options"
              className="scroll-mt-28 rounded-lg border border-gray-200 bg-gray-50/60 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  5
                </span>
                <div>
                  <h3 className="font-semibold text-gray-800">编辑其他设置</h3>
                </div>
              </div>

              {selectionConflict ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selectionConflict}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  预设
                  <button
                    type="button"
                    onClick={() => navigateToTab('presets', 'preset-basic')}
                    className="mt-2 text-xs block font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    编辑“{presetName || '新预设'}”的详细配置 →
                  </button>
                  <select
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {!presets.length ? (
                      <option value="">请先新建预设</option>
                    ) : null}
                    {presets.map((preset) => (
                      <option key={preset.name}>{preset.name}</option>
                    ))}
                  </select>
                </label>
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
              </div>

              <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
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
