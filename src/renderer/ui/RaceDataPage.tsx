/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import RaceDataPresenter from 'renderer/components/RaceDataPresenter';
import type { RaceArchive, RaceMetaInfo } from 'types/gameTypes';
import { RaceSimulateData } from 'umdb/race_data_pb';
import { deserializeFromBase64 } from 'umdb/RaceDataParser';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';
import RacePageLayout, {
  raceHeaderButtonClass,
} from 'renderer/components/RacePageLayout';

// 1. Props 定义：只接收路由跳转过来的参数
type RaceDataPageProps = {
  initialValues?: {
    scenario?: string;
    horseInfo?: string;
    raceMetaInfo?: RaceMetaInfo;
    archiveId?: string;
  };
  navigate: NavigateFunction; // 传入 navigate 函数以便支持返回操作
};

type SimulationAccount = {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
};

type SimulationProgress = {
  stage: 'login' | 'prepare' | 'simulate' | 'save' | 'complete';
  detail: string;
  current?: number;
  total?: number;
  archiveId?: string;
  archiveName?: string;
};

type SimulationResult = {
  ok: boolean;
  completed: number;
  total: number;
  archiveId?: string;
  archiveName?: string;
  error?: string;
};

// 2. State 定义：不再需要 input 字符串，只需要解析后的对象
type RaceDataPageState = {
  parsedHorseInfo: any;
  parsedRaceData: RaceSimulateData | undefined;
  error?: string; // 增加一个错误状态，万一解析失败显示提示
  showLegacyPage: boolean;
  simulationOpen: boolean;
  simulationAccounts: SimulationAccount[];
  selectedSimulationAccountId: string;
  simulationCount: number;
  simulationArchiveName: string;
  simulationBusy: boolean;
  simulationProgress?: SimulationProgress;
  simulationError?: string;
  simulationResult?: SimulationResult;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class RaceDataPageClass extends React.Component<
  RaceDataPageProps,
  RaceDataPageState
> {
  private unsubscribeSimulationProgress?: () => void;

  constructor(props: RaceDataPageProps) {
    super(props);
    this.state = {
      parsedHorseInfo: undefined,
      parsedRaceData: undefined,
      error: undefined,
      showLegacyPage: true,
      simulationOpen: false,
      simulationAccounts: [],
      selectedSimulationAccountId: '',
      simulationCount: 10,
      simulationArchiveName: '',
      simulationBusy: false,
      simulationProgress: undefined,
      simulationError: undefined,
      simulationResult: undefined,
    };
  }

  async componentDidMount() {
    this.unsubscribeSimulationProgress =
      window.electron.race.onRepeatSimulationProgress((progress) => {
        this.setState({ simulationProgress: progress });
      });
    const { initialValues } = this.props;
    await loadUMDB();
    if (!initialValues || !initialValues.scenario) {
      this.setState({
        error: '未提供比赛数据，请从比赛记录页打开。',
      });
      return;
    }
    const { scenario, horseInfo } = initialValues;
    try {
      const parsedData = deserializeFromBase64(scenario.trim());
      let parsedHorse;
      if (horseInfo) {
        try {
          parsedHorse = JSON.parse(horseInfo);
        } catch (e) {
          console.warn('Horse info parse warning:', e);
        }
      }

      this.setState({
        parsedRaceData: parsedData,
        parsedHorseInfo: parsedHorse,
      });
    } catch (e) {
      console.error('Parse error:', e);
      this.setState({
        error: '比赛数据解析失败，数据格式可能无效。',
      });
    }
  }

  componentWillUnmount() {
    this.unsubscribeSimulationProgress?.();
  }

  getPracticeRaceName = () => {
    const { initialValues } = this.props;
    const raceInstanceId = initialValues?.raceMetaInfo?.race_instance_id;
    if (raceInstanceId == null) return undefined;
    return UMDB.raceInstances[raceInstanceId]?.name;
  };

  openSimulation = async () => {
    const { initialValues } = this.props;
    this.setState({
      simulationOpen: true,
      simulationError: undefined,
      simulationResult: undefined,
      simulationProgress: undefined,
    });
    try {
      const [accounts, archiveConfig] = await Promise.all([
        window.electron.autoResearch.accounts() as Promise<SimulationAccount[]>,
        window.electron.race.archives() as Promise<{
          archives: RaceArchive[];
        }>,
      ]);
      const storedAccountId = localStorage.getItem(
        'race.repeatSimulation.account',
      );
      const selectedAccountId = accounts.some(
        (account) => account.id === storedAccountId,
      )
        ? storedAccountId || ''
        : accounts[0]?.id || '';
      const raceName =
        this.getPracticeRaceName() ??
        `练习 ${initialValues?.raceMetaInfo?.race_instance_id ?? ''}`.trim();
      const archivePattern = new RegExp(
        `^${escapeRegExp(raceName)} 模拟(\\d+)$`,
      );
      const nextNumber =
        Math.max(
          0,
          ...(archiveConfig.archives ?? []).map((archive) => {
            const matched = archive.name.match(archivePattern);
            return matched ? Number(matched[1]) || 0 : 0;
          }),
        ) + 1;

      if (selectedAccountId) {
        localStorage.setItem(
          'race.repeatSimulation.account',
          selectedAccountId,
        );
      }
      this.setState({
        simulationAccounts: accounts,
        selectedSimulationAccountId: selectedAccountId,
        simulationArchiveName: `${raceName} 模拟${nextNumber}`,
      });
    } catch (error) {
      this.setState({
        simulationError: `读取账号或存档失败：${(error as Error).message}`,
      });
    }
  };

  startSimulation = async () => {
    const { initialValues } = this.props;
    const {
      selectedSimulationAccountId,
      simulationArchiveName,
      simulationCount,
      parsedHorseInfo,
    } = this.state;
    if (!selectedSimulationAccountId) {
      this.setState({ simulationError: '请先选择一个账号' });
      return;
    }
    if (!simulationArchiveName.trim()) {
      this.setState({ simulationError: '请填写存档名称' });
      return;
    }
    if (!Array.isArray(parsedHorseInfo)) {
      this.setState({ simulationError: '当前 RaceData 缺少马匹数据' });
      return;
    }

    this.setState({
      simulationBusy: true,
      simulationError: undefined,
      simulationResult: undefined,
      simulationProgress: {
        stage: 'login',
        detail: '正在准备所选账号',
        current: 0,
        total: simulationCount,
      },
    });
    try {
      const result = (await window.electron.race.repeatSimulation({
        accountId: selectedSimulationAccountId,
        archiveName: simulationArchiveName.trim(),
        count: simulationCount,
        source: {
          raceMetaInfo: initialValues?.raceMetaInfo ?? {},
          horses: parsedHorseInfo,
        },
      })) as SimulationResult;
      this.setState({
        simulationResult: result,
        simulationError: result.ok ? undefined : result.error || '重复模拟失败',
      });
    } catch (error) {
      this.setState({ simulationError: (error as Error).message });
    } finally {
      this.setState({ simulationBusy: false });
    }
  };

  downloadParsedRaceData = () => {
    const { parsedRaceData } = this.state;
    const { initialValues } = this.props;
    if (!parsedRaceData) return;

    const raceInstanceId =
      initialValues?.raceMetaInfo?.race_instance_id ?? 'unknown';
    const payload = parsedRaceData.toJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .replace('Z', '');

    anchor.href = url;
    anchor.download = `race_data_${raceInstanceId}_${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  renderSimulationDialog = () => {
    const { navigate } = this.props;
    const {
      simulationOpen,
      simulationAccounts,
      selectedSimulationAccountId,
      simulationCount,
      simulationArchiveName,
      simulationBusy,
      simulationProgress,
      simulationError,
      simulationResult,
    } = this.state;
    if (!simulationOpen) return null;

    const progressCurrent = simulationProgress?.current ?? 0;
    const progressTotal = simulationProgress?.total ?? simulationCount;
    const progressPercent = progressTotal
      ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100))
      : 0;
    const resultArchiveId =
      simulationResult?.archiveId ?? simulationProgress?.archiveId;

    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
        onMouseDown={() => {
          if (!simulationBusy) this.setState({ simulationOpen: false });
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="重复模拟"
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <RefreshCw size={18} className="text-blue-600" />
                重复模拟
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                直接根据当前 RaceData
                构造练习请求，每场结果自动保存到同一个存档。
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭重复模拟"
              disabled={simulationBusy}
              onClick={() => this.setState({ simulationOpen: false })}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </header>

          <div className="space-y-5 px-5 py-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-sm text-slate-800">1. 选择账号</strong>
                <span className="text-xs text-slate-400">
                  账号请在 AutoUma 中添加
                </span>
              </div>
              {simulationAccounts.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {simulationAccounts.map((account) => {
                    const selected = selectedSimulationAccountId === account.id;
                    return (
                      <button
                        type="button"
                        key={account.id}
                        disabled={simulationBusy}
                        onClick={() => {
                          localStorage.setItem(
                            'race.repeatSimulation.account',
                            account.id,
                          );
                          this.setState({
                            selectedSimulationAccountId: account.id,
                            simulationError: undefined,
                          });
                        }}
                        className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <strong className="block truncate text-sm text-slate-900">
                          {account.label || `UID ${account.uid}`}
                        </strong>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {account.uid} · {account.accessKeyPreview}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  还没有可用账号，请先前往自动育成页面添加账号。
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <label htmlFor="practice-simulation-count" className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  2. 模拟次数
                </span>
                <input
                  id="practice-simulation-count"
                  type="number"
                  min={1}
                  max={1000}
                  value={simulationCount}
                  disabled={simulationBusy}
                  onChange={(event) =>
                    this.setState({
                      simulationCount: Math.max(
                        1,
                        Math.min(1000, Number(event.target.value) || 1),
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </label>
              <label htmlFor="practice-simulation-archive" className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  3. 存档名称
                </span>
                <input
                  id="practice-simulation-archive"
                  type="text"
                  value={simulationArchiveName}
                  disabled={simulationBusy}
                  onChange={(event) =>
                    this.setState({
                      simulationArchiveName: event.target.value,
                    })
                  }
                  placeholder="练习 xxx 模拟1"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                />
              </label>
            </section>

            {simulationProgress && (
              <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-blue-800">
                    {simulationBusy && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {simulationProgress.detail}
                  </span>
                  <span className="font-mono text-xs text-blue-600">
                    {progressCurrent}/{progressTotal}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </section>
            )}

            {simulationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {simulationError}
                {simulationResult?.completed ? (
                  <span className="mt-1 block text-xs">
                    已成功保存 {simulationResult.completed} /{' '}
                    {simulationResult.total} 场。
                  </span>
                ) : null}
              </div>
            )}

            {simulationResult?.ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                已完成 {simulationResult.completed} 场模拟，结果已保存到“
                {simulationResult.archiveName}”。
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4">
            {resultArchiveId && !simulationBusy && (
              <button
                type="button"
                onClick={() =>
                  navigate('/races', {
                    state: { archiveId: resultArchiveId },
                  })
                }
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                查看存档
              </button>
            )}
            <button
              type="button"
              disabled={
                simulationBusy ||
                !selectedSimulationAccountId ||
                !simulationArchiveName.trim() ||
                simulationAccounts.length === 0
              }
              onClick={this.startSimulation}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {simulationBusy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Play size={15} />
              )}
              {simulationBusy ? '模拟中…' : '开始模拟'}
            </button>
          </footer>
        </section>
      </div>
    );
  };

  render() {
    const { initialValues, navigate } = this.props;
    const { error, parsedHorseInfo, parsedRaceData, showLegacyPage } =
      this.state;
    const archiveId = initialValues?.archiveId ?? 'default';
    const isDetailPage = showLegacyPage;
    const pageTitle = isDetailPage ? '比赛详情' : '比赛回放';
    const pageDescription = isDetailPage
      ? '查看出赛表、曲线和事件分析'
      : '查看比赛过程回放';
    const backToRaces = () => navigate('/races', { state: { archiveId } });
    const isPracticeRace = this.getPracticeRaceName()?.startsWith('练习');

    if (error) {
      return (
        <RacePageLayout
          title={pageTitle}
          description={pageDescription}
          icon={<FileText size={20} />}
          actions={
            <button
              type="button"
              onClick={backToRaces}
              className={raceHeaderButtonClass}
            >
              <ArrowLeft size={16} />
              返回记录
            </button>
          }
        >
          <div className="rounded-lg border border-red-200 bg-white px-4 py-10 text-center text-red-600">
            {error}
          </div>
        </RacePageLayout>
      );
    }

    if (parsedRaceData) {
      return (
        <RacePageLayout
          title={pageTitle}
          description={pageDescription}
          icon={<FileText size={20} />}
          actions={
            <>
              <button
                type="button"
                onClick={this.downloadParsedRaceData}
                className={raceHeaderButtonClass}
              >
                <Download size={16} />
                导出 RaceData JSON
              </button>
              {isPracticeRace && (
                <button
                  type="button"
                  onClick={this.openSimulation}
                  className={raceHeaderButtonClass}
                >
                  <RefreshCw size={16} />
                  重复模拟
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  this.setState((state) => ({
                    showLegacyPage: !state.showLegacyPage,
                  }))
                }
                className={raceHeaderButtonClass}
              >
                <FileText size={16} />
                {isDetailPage ? '回放' : '返回详细'}
              </button>
              <button
                type="button"
                onClick={backToRaces}
                className={raceHeaderButtonClass}
              >
                <ArrowLeft size={16} />
                返回记录
              </button>
            </>
          }
        >
          <>
            <RaceDataPresenter
              raceHorseInfo={parsedHorseInfo}
              raceData={parsedRaceData}
              raceMetaInfo={initialValues?.raceMetaInfo}
              umdb={UMDB}
              showLegacyPage={showLegacyPage}
            />
            {this.renderSimulationDialog()}
          </>
        </RacePageLayout>
      );
    }

    return (
      <RacePageLayout
        title={pageTitle}
        description={pageDescription}
        icon={<FileText size={20} />}
        actions={
          <button
            type="button"
            onClick={backToRaces}
            className={raceHeaderButtonClass}
          >
            <ArrowLeft size={16} />
            返回记录
          </button>
        }
      >
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-10 text-center text-gray-400">
          Loading and parsing data...
        </div>
      </RacePageLayout>
    );
  }
}

// 导出包装组件
export default function RaceDataPage() {
  const location = useLocation();
  const navigate = useNavigate(); // 获取 navigate
  const state = location.state as {
    scenario?: string;
    horseInfo?: string;
    raceMetaInfo?: RaceMetaInfo;
    archiveId?: string;
  } | null;

  return (
    <RaceDataPageClass initialValues={state || undefined} navigate={navigate} />
  );
}
