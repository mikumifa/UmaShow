/* eslint-disable jsx-a11y/label-has-associated-control, no-nested-ternary */
import { Dispatch, SetStateAction } from 'react';
import { History, RefreshCw, Trophy } from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { horseIconPath } from './SelectionCards';
import {
  careerReportStatusLabel,
  describeLogAction,
  describeLogDetail,
  formatReportTime,
  HIDDEN_RUNNER_LOG_ACTIONS,
  panelClass,
  turnDateLabel,
} from './shared';
import {
  CareerReport,
  CareerReportSummary,
  CareerSetting,
  Dashboard,
  UmaRlTrainingStatus,
} from './types';

type HealthStatus = {
  umarl?: {
    installed?: boolean;
    training_available?: boolean;
  };
};

type HistoryTabProps = {
  dashboard: Dashboard;
  selectedCareerReport: CareerReport | null;
  setSelectedCareerReport: Dispatch<SetStateAction<CareerReport | null>>;
  health: HealthStatus | null;
  showUmaRlTraining: boolean;
  umarlTraining: UmaRlTrainingStatus | null;
  startUmaRlTraining: (reportIds: string[]) => Promise<void>;
  busy: string;
  historyCareerSetting?: CareerSetting;
  loadCareerHistory: (accountId: string) => Promise<void>;
  selectedAccountId: string;
  historyCareerSettingId: string;
  setHistoryCareerSettingId: Dispatch<SetStateAction<string>>;
  accountCareerSettings: CareerSetting[];
  umarlSettingModelAvailable: boolean | null;
  cancelUmaRlTraining: () => Promise<void>;
  refreshUmaRlTraining: () => Promise<void>;
  selectedTrainingReportIds: string[];
  setSelectedTrainingReportIds: Dispatch<SetStateAction<string[]>>;
  umarlTrainEpisodes: number;
  setUmaRlTrainEpisodes: Dispatch<SetStateAction<number>>;
  umarlTrainGenerations: number;
  setUmaRlTrainGenerations: Dispatch<SetStateAction<number>>;
  umarlTrainEpochs: number;
  setUmaRlTrainEpochs: Dispatch<SetStateAction<number>>;
  umarlTrainBatchSize: number;
  setUmaRlTrainBatchSize: Dispatch<SetStateAction<number>>;
  umarlTrainMaxStates: number;
  setUmaRlTrainMaxStates: Dispatch<SetStateAction<number>>;
  umarlTrainRolloutWorkers: number;
  setUmaRlTrainRolloutWorkers: Dispatch<SetStateAction<number>>;
  historyCareerReports: CareerReportSummary[];
  openCareerReport: (reportId: string) => Promise<void>;
};

export default function HistoryTab({
  dashboard,
  selectedCareerReport,
  setSelectedCareerReport,
  health,
  showUmaRlTraining,
  umarlTraining,
  startUmaRlTraining,
  busy,
  historyCareerSetting,
  loadCareerHistory,
  selectedAccountId,
  historyCareerSettingId,
  setHistoryCareerSettingId,
  accountCareerSettings,
  umarlSettingModelAvailable,
  cancelUmaRlTraining,
  refreshUmaRlTraining,
  selectedTrainingReportIds,
  setSelectedTrainingReportIds,
  umarlTrainEpisodes,
  setUmaRlTrainEpisodes,
  umarlTrainGenerations,
  setUmaRlTrainGenerations,
  umarlTrainEpochs,
  setUmaRlTrainEpochs,
  umarlTrainBatchSize,
  setUmaRlTrainBatchSize,
  umarlTrainMaxStates,
  setUmaRlTrainMaxStates,
  umarlTrainRolloutWorkers,
  setUmaRlTrainRolloutWorkers,
  historyCareerReports,
  openCareerReport,
}: HistoryTabProps) {
  return selectedCareerReport ? (
    <div className="space-y-4">
      <section className={panelClass('p-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setSelectedCareerReport(null)}
              className="mb-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              ← 返回养马记录
            </button>
            <h2 className="text-xl font-bold text-slate-900">
              {dashboard.umas.find(
                (uma) => uma.id === selectedCareerReport.card_id,
              )?.name || `育成马娘 ${selectedCareerReport.card_id || '-'}`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatReportTime(selectedCareerReport.started_at)} ·{' '}
              {selectedCareerReport.preset_name || '未命名预设'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showUmaRlTraining &&
            health?.umarl?.installed &&
            !['queued', 'running'].includes(umarlTraining?.state || '') ? (
              <button
                type="button"
                onClick={() => startUmaRlTraining([selectedCareerReport.id])}
                disabled={busy === 'umarl-train'}
                className="rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              >
                用此记录训练 UmaRL
              </button>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${selectedCareerReport.status === 'error' ? 'bg-red-100 text-red-700' : selectedCareerReport.status === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {careerReportStatusLabel(selectedCareerReport.status)}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <span>结束于 {turnDateLabel(selectedCareerReport.final_turn)}</span>
          <span>比赛 {selectedCareerReport.race_count || 0} 场</span>
          <span>
            宝石掉落 {selectedCareerReport.jewel_drop_count || 0} 次，共{' '}
            {selectedCareerReport.jewels_earned || 0} 个
          </span>
        </div>
        {selectedCareerReport.error_message ? (
          <p className="mt-4 border-t border-red-100 pt-4 text-sm text-red-700">
            {selectedCareerReport.error_message}
          </p>
        ) : null}
      </section>

      <section className={panelClass('overflow-hidden')}>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="font-bold">详细流程</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {(selectedCareerReport.turns || []).map((turn) => {
            const logEvents = (turn.events || []).filter(
              (event) =>
                event.event === 'log' &&
                !HIDDEN_RUNNER_LOG_ACTIONS.has(String(event.action || '')),
            );
            const apiCalls = (turn.api_calls || []).filter(
              (call) => !String(call.endpoint || '').includes('race_end'),
            );
            if (
              !logEvents.length &&
              !apiCalls.length &&
              !turn.selected_action
            ) {
              return null;
            }
            return (
              <article
                key={turn.turn}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[210px_minmax(0,1fr)]"
              >
                <p className="whitespace-nowrap font-semibold text-indigo-600">
                  {turnDateLabel(turn.turn)}
                </p>
                <div className="min-w-0 space-y-2">
                  {logEvents.map((event, index) => (
                    <div
                      key={`${event.action}-${index}`}
                      className="grid gap-1 text-sm sm:grid-cols-[110px_minmax(0,1fr)]"
                    >
                      <span className="font-medium text-slate-700">
                        {describeLogAction(String(event.action || ''))}
                      </span>
                      <span className="text-slate-500">
                        {describeLogDetail(String(event.detail || ''))}
                      </span>
                    </div>
                  ))}
                  {!logEvents.length && turn.selected_action ? (
                    <p className="text-sm text-slate-600">
                      {describeLogAction(turn.selected_action)}
                      {turn.decision_reason
                        ? ` · ${describeLogDetail(turn.decision_reason)}`
                        : ''}
                    </p>
                  ) : null}
                  {apiCalls.length ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {apiCalls.map((call, index) => (
                        <span
                          key={`${call.direction}-${call.endpoint}-${index}`}
                          className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-500"
                        >
                          {call.direction} {call.endpoint}
                          {call.result_code ? ` · ${call.result_code}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  ) : (
    <section className={panelClass('p-5')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <History size={19} className="text-indigo-600" />
            养马记录
            {historyCareerSetting ? ` · ${historyCareerSetting.name}` : ''}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            保存最近 3 天内的全部养马记录；每个详设独立训练并使用自己的模型。
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadCareerHistory(selectedAccountId)}
          disabled={busy === 'history'}
          className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={busy === 'history' ? 'animate-spin' : ''}
          />
          刷新记录
        </button>
      </div>
      <label className="mt-5 block max-w-xl text-sm font-medium text-slate-700">
        先选择养马详设
        <select
          value={historyCareerSettingId}
          onChange={(event) => setHistoryCareerSettingId(event.target.value)}
          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          <option value="">请选择详设后查看记录</option>
          {accountCareerSettings.map((setting) => (
            <option key={setting.id} value={setting.id}>
              {setting.name}
            </option>
          ))}
        </select>
      </label>
      {!historyCareerSetting ? (
        <p className="py-14 text-center text-sm text-slate-400">
          选择养马详设后，才会显示该详设的养马记录
        </p>
      ) : (
        <>
          {showUmaRlTraining && health?.umarl?.installed ? (
            <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-violet-950">
                    使用养马记录训练 UmaRL
                  </h3>
                  <p className="mt-1 text-xs text-violet-700">
                    训练会从所选记录提取局面；没有模型时先用手写策略冷启动，
                    随后进行多代 on-policy PPO。每代更新退化时会自动回滚。
                  </p>
                  <p className="mt-1 text-xs text-violet-600">
                    当前模型：
                    {umarlSettingModelAvailable
                      ? '已训练，将用于此详设之后的 UmaRL 决策'
                      : umarlSettingModelAvailable === false
                        ? '尚未训练，暂用手写后续策略'
                        : '正在读取'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={refreshUmaRlTraining}
                    disabled={busy === 'umarl-refresh'}
                    className="flex items-center gap-2 rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={busy === 'umarl-refresh' ? 'animate-spin' : ''}
                    />
                    刷新训练进度
                  </button>
                  {['queued', 'running'].includes(
                    umarlTraining?.state || '',
                  ) ? (
                    <button
                      type="button"
                      onClick={cancelUmaRlTraining}
                      disabled={busy === 'umarl-cancel'}
                      className="rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    >
                      请求取消
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        startUmaRlTraining(selectedTrainingReportIds)
                      }
                      disabled={
                        !selectedTrainingReportIds.length ||
                        busy === 'umarl-train' ||
                        !health.umarl.training_available
                      }
                      className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {busy === 'umarl-train'
                        ? '正在提交…'
                        : `开始训练（${selectedTrainingReportIds.length} 份）`}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-violet-600">
                训练状态不会自动刷新；需要查看进度时请点击“刷新训练进度”。
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-violet-800">
                  每代探索轨迹
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    value={umarlTrainEpisodes}
                    onChange={(event) =>
                      setUmaRlTrainEpisodes(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-violet-800">
                  训练代数
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={umarlTrainGenerations}
                    onChange={(event) =>
                      setUmaRlTrainGenerations(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-violet-800">
                  每代 Epoch
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={umarlTrainEpochs}
                    onChange={(event) =>
                      setUmaRlTrainEpochs(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-violet-800">
                  Batch Size
                  <input
                    type="number"
                    min={1}
                    max={8192}
                    value={umarlTrainBatchSize}
                    onChange={(event) =>
                      setUmaRlTrainBatchSize(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-violet-800">
                  最多历史局面
                  <input
                    type="number"
                    min={1}
                    max={2048}
                    value={umarlTrainMaxStates}
                    onChange={(event) =>
                      setUmaRlTrainMaxStates(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
                <label className="text-xs text-violet-800">
                  Rollout Workers
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={umarlTrainRolloutWorkers}
                    onChange={(event) =>
                      setUmaRlTrainRolloutWorkers(Number(event.target.value))
                    }
                    className="mt-1 w-full rounded border border-violet-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </label>
              </div>
              {umarlTraining ? (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-violet-800">
                    <span>{umarlTraining.detail || umarlTraining.state}</span>
                    <span>{umarlTraining.progress || 0}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="h-full bg-violet-500 transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(100, umarlTraining.progress || 0))}%`,
                      }}
                    />
                  </div>
                  {umarlTraining.error ? (
                    <p className="mt-2 text-xs text-red-600">
                      {umarlTraining.error}
                    </p>
                  ) : null}
                  {(umarlTraining.metrics?.actor_eval_pairs || 0) > 0 ? (
                    <p className="mt-2 text-xs text-violet-700">
                      最近一代评测：新策略平均{' '}
                      {Math.round(
                        umarlTraining.metrics?.actor_candidate_mean || 0,
                      )}
                      ，旧策略平均{' '}
                      {Math.round(
                        umarlTraining.metrics?.actor_incumbent_mean || 0,
                      )}
                      ，提升{' '}
                      {(umarlTraining.metrics?.actor_mean_improvement || 0) >= 0
                        ? '+'
                        : ''}
                      {Math.round(
                        umarlTraining.metrics?.actor_mean_improvement || 0,
                      )}
                      ，胜率{' '}
                      {(
                        (umarlTraining.metrics?.actor_win_rate || 0) * 100
                      ).toFixed(1)}
                      %，
                      {umarlTraining.metrics?.actor_update_accepted
                        ? '接受更新'
                        : '已回滚'}
                    </p>
                  ) : null}
                  {(umarlTraining.logs || []).length ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-violet-200 bg-slate-950 text-slate-200">
                      <div className="border-b border-slate-800 px-3 py-2 text-xs font-medium text-violet-300">
                        训练日志
                      </div>
                      <div className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-5">
                        {(umarlTraining.logs || [])
                          .slice()
                          .reverse()
                          .map((row) => (
                            <div key={row.id} className="flex gap-2">
                              <span className="flex-none text-slate-500">
                                {row.time}
                              </span>
                              <span className="flex-none text-violet-400">
                                [{row.stage}]
                              </span>
                              <span className="min-w-0 break-words">
                                {row.message}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {historyCareerReports.length ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                共 {historyCareerReports.length} 份记录，已选择{' '}
                {selectedTrainingReportIds.length} 份
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTrainingReportIds(
                      historyCareerReports.map((report) => report.id),
                    )
                  }
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  全选
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTrainingReportIds([])}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                >
                  清空
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {historyCareerReports.map((report) => {
              const reportUma = dashboard.umas.find(
                (uma) => uma.id === report.card_id,
              );
              const reportIconPath = reportUma
                ? horseIconPath(
                    reportUma.id,
                    reportUma.rarity,
                    reportUma.race_cloth_id,
                  )
                : undefined;
              return (
                <div
                  key={report.id}
                  className={`relative rounded-lg border bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm ${
                    selectedTrainingReportIds.includes(report.id)
                      ? 'border-violet-400 ring-2 ring-violet-100'
                      : 'border-slate-200'
                  }`}
                >
                  <label className="absolute right-3 top-3 z-10 flex cursor-pointer items-center gap-1.5 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
                    <input
                      type="checkbox"
                      checked={selectedTrainingReportIds.includes(report.id)}
                      onChange={(event) =>
                        setSelectedTrainingReportIds((current) =>
                          event.target.checked
                            ? [...new Set([...current, report.id])]
                            : current.filter((item) => item !== report.id),
                        )
                      }
                      className="accent-violet-600"
                    />
                    训练样本
                  </label>
                  <button
                    type="button"
                    onClick={() => openCareerReport(report.id)}
                    disabled={busy === `history-${report.id}`}
                    className="w-full text-left disabled:opacity-50"
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-16 w-16 flex-none overflow-hidden rounded-lg bg-slate-100">
                        {reportIconPath ? (
                          <AssetIcon
                            path={reportIconPath}
                            alt={reportUma?.name || '育成马娘'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Trophy size={22} className="m-5 text-slate-300" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <strong className="truncate text-slate-900">
                            {reportUma?.name ||
                              `育成马娘 ${report.card_id || '-'}`}
                          </strong>
                          <span
                            className={`mr-20 flex-none text-xs ${report.status === 'error' ? 'text-red-600' : report.status === 'finished' ? 'text-emerald-600' : 'text-slate-500'}`}
                          >
                            {careerReportStatusLabel(report.status)}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {formatReportTime(report.started_at)}
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-400">
                          {report.preset_name || '未命名预设'} ·{' '}
                          {turnDateLabel(report.final_turn)}
                        </span>
                        {!report.career_setting_id ? (
                          <span className="mt-1 block text-[11px] text-amber-600">
                            旧记录：按角色与预设归入此详设
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 border-t border-slate-100 pt-3 text-center text-xs">
                      <span>
                        <strong className="block text-sm text-slate-800">
                          {report.race_count || 0}
                        </strong>
                        比赛
                      </span>
                      <span>
                        <strong className="block text-sm text-violet-700">
                          {report.jewel_drop_count || 0}
                        </strong>
                        宝石掉落
                      </span>
                      <span>
                        <strong className="block text-sm text-violet-700">
                          {report.jewels_earned || 0}
                        </strong>
                        宝石
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          {!historyCareerReports.length && busy !== 'history' ? (
            <p className="py-14 text-center text-sm text-slate-400">
              该详设最近 3 天内暂无养马记录
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
