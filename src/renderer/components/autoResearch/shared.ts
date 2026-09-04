import { UMDB } from 'renderer/utils/umdb';
import {
  CareerSetting,
  LoginProgress,
  OfflineFactorSelection,
  OfflineSkillSettings,
  Preset,
  RaceOption,
  RunMode,
  SessionAccount,
  SkillLearningSetting,
  SkillSelectionEntry,
  TargetAttributeStage,
} from './types';

export const DEFAULT_SERVER = 'http://127.0.0.1:18765';
export const DEFAULT_PRESET_NAME = 'URA 默认';
export const LOCAL_PRESETS_KEY = 'autoResearch.presets';
export const CAREER_SETTINGS_KEY = 'autoResearch.careerSettings';

export function normalizeOnlineScenarioId(value: unknown): number {
  return Number(value) === 5 ? 5 : 1;
}

export function onlineScenarioLabel(value: unknown): string {
  return normalizeOnlineScenarioId(value) === 5 ? '荣耀女神杯' : 'URA';
}
export const LAST_ACCOUNT_KEY = 'autoResearch.lastLoggedInAccount';

export function getSharedStorageItem(key: string) {
  try {
    const value = window.electron.autoResearch.getUiSetting(key);
    if (value === null) {
      localStorage.removeItem(key);
    } else if (value !== localStorage.getItem(key)) {
      localStorage.setItem(key, value);
    }
    return value;
  } catch (error) {
    console.error('Failed to read shared auto research setting:', error);
    return null;
  }
}

export function setSharedStorageItem(key: string, value: string) {
  localStorage.setItem(key, value);
  try {
    if (!window.electron.autoResearch.setUiSetting(key, value)) {
      console.error('Failed to save shared auto research setting');
    }
  } catch (error) {
    console.error('Failed to save shared auto research setting:', error);
  }
}

export const STAT_LABELS = ['速度', '耐力', '力量', '毅力', '智力'];
export const SKILL_PURCHASE_YEAR_OPTIONS = [
  { offset: 0, label: '初级年' },
  { offset: 24, label: '经典年' },
  { offset: 48, label: '高级年' },
];
export const MONTH_OPTIONS = Array.from(
  { length: 12 },
  (_, index) => index + 1,
);
export const DEFAULT_EXPECT_ATTRIBUTE = [1200, 800, 1000, 600, 1000];

export function createDefaultOfflineFactorSelection(): OfflineFactorSelection {
  return {
    enabled: true,
    evaluation_mode: 'parent',
    use_skill_priority: true,
    blue_factor_minimums: {
      speed: 1,
      stamina: 1,
      power: 1,
      guts: 1,
      wit: 1,
    },
    targets: [],
    lineage: {
      mode: 'none',
      selection_id: '',
      tree: {
        parent: {
          chara_id: 0,
          red_factor_group_id: 0,
          red_factor_stars: 0,
          route_id: 'none',
        },
        ancestor_1: {
          chara_id: 0,
          red_factor_group_id: 0,
          red_factor_stars: 0,
          route_id: 'none',
        },
        ancestor_2: {
          chara_id: 0,
          red_factor_group_id: 0,
          red_factor_stars: 0,
          route_id: 'none',
        },
      },
      chara_ids: [],
      ancestor_chara_ids: [],
      min_parent_factor_stars: 0,
      min_ancestor_factor_stars: 0,
    },
  };
}

export function createDefaultOfflineSkillSettings(): OfflineSkillSettings {
  return {
    enabled: true,
    learn_skill_list: [],
    learn_skill_group_labels: [],
    learn_skill_settings: {},
    learn_skill_only_user_provided: false,
    skip_double_circle_unless_high_hint: false,
    maximize_skill_score_at_end: true,
  };
}

export function createDefaultPreset(name = DEFAULT_PRESET_NAME): Preset {
  return {
    name,
    scenario_id: 1,
    running_style: 0,
    learn_skill_list: [],
    learn_skill_group_labels: [],
    learn_skill_settings: {},
    learn_skill_blacklist: [],
    learn_skill_only_user_provided: true,
    skip_double_circle_unless_high_hint: false,
    maximize_skill_score_at_end: false,
    skill_purchase_turns: [],
    extra_race_list: [],
    ura_ai: {
      enabled: true,
      time_budget_s: 2,
      min_rollouts: 128,
      max_rollouts: 256,
      workers: 4,
      risk_factor: 0,
      target_attributes: [...DEFAULT_EXPECT_ATTRIBUTE],
      target_attribute_stages: [],
    },
  };
}

export class AutoResearchRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AutoResearchRequestError';
    this.status = status;
  }
}

export function formatAccountError(message: unknown) {
  const detail = String(message || '');
  if (
    /(?:错误码|result[_ ]?code|response[_ ]?code|code)[^\d]*(?:217|218)\b/i.test(
      detail,
    ) ||
    /\b(?:217|218)\b/.test(detail) ||
    /\b(?:sid|session)\b.*(?:失效|无效|变化|错误|不匹配|changed|invalid|expired)/i.test(
      detail,
    ) ||
    /账号.*(?:其他位置|别处).*(?:登录|操作)/.test(detail)
  ) {
    return '账号已在别处登录';
  }
  return detail;
}

export function needsRelogin(error: unknown) {
  if (error instanceof AutoResearchRequestError && error.status === 401) {
    return true;
  }
  const detail = String((error as Error)?.message || error || '').toLowerCase();
  if (detail.includes('刷新当前账号')) {
    return false;
  }
  return [
    '登录会话',
    '登录失效',
    '重新登录',
    'session',
    'sid',
    '401',
    '403',
    '网络请求失败',
  ].some((marker) => detail.includes(marker));
}

export function accountProgressPercent(progress: LoginProgress) {
  if (progress.action === 'login') {
    const stages: Record<string, number> = {
      queued: 5,
      validate: 10,
      oauth: 20,
      prepare: 30,
      delay: 45,
      request: 55,
      options: 72,
      career: 86,
      dashboard: 95,
      complete: 100,
    };
    return stages[progress.stage] ?? 35;
  }
  if (progress.stage === 'complete') return 100;
  if (progress.stage === 'dashboard') return 95;
  if (progress.stage.startsWith('career')) return 86;
  if (
    progress.stage.startsWith('options') ||
    progress.endpoint.includes('pre_single_mode')
  ) {
    return progress.stage === 'options_done' ? 78 : 62;
  }
  if (
    progress.stage.startsWith('account') ||
    progress.endpoint.includes('load/index') ||
    progress.endpoint === 'load_index'
  ) {
    return progress.stage === 'account_done' ? 45 : 25;
  }
  return 10;
}

export function parentViewerIdFromSelection(value?: string) {
  const [source, viewerId] = String(value || '').split(':');
  return source === 'rental' ? Number(viewerId || 0) : 0;
}

export function careerSettingMatchesCurrent(
  setting: CareerSetting,
  career: NonNullable<SessionAccount['career']>,
) {
  return Number(setting.card_id || 0) === Number(career.card_id || 0);
}

export function normalizeServer(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_SERVER;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

export function panelClass(extra = '') {
  return `rounded-lg border border-gray-200 bg-white ${extra}`;
}

export function statusBadgeClass(
  tone: 'slate' | 'emerald' | 'amber' | 'sky' | 'violet',
) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    sky: 'bg-sky-100 text-sky-700',
    violet: 'bg-violet-100 text-violet-700',
  }[tone];
  return `inline-flex flex-none items-center rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${toneClass}`;
}

export function careerSettingModeBadgeClass(offline: boolean) {
  return statusBadgeClass(offline ? 'sky' : 'violet');
}

export function scrollToSection(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  if (element instanceof HTMLDetailsElement) element.open = true;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function numberArray(
  value: number[] | undefined,
  fallback: number[],
): number[] {
  return fallback.map((defaultValue, index) => {
    const candidate = Number(value?.[index]);
    return Number.isFinite(candidate) ? candidate : defaultValue;
  });
}

export function normalizeTargetAttributeStages(
  value: TargetAttributeStage[] | undefined,
): TargetAttributeStage[] {
  const stagesByTurn = new Map<number, TargetAttributeStage>();
  (Array.isArray(value) ? value : []).forEach((rawStage) => {
    const turn = Math.trunc(Number(rawStage?.turn));
    if (!Number.isFinite(turn) || turn < 1 || turn > 76) return;
    if (!Array.isArray(rawStage?.target_attributes)) return;
    stagesByTurn.set(turn, {
      turn,
      target_attributes: numberArray(
        rawStage.target_attributes,
        [0, 0, 0, 0, 0],
      ).map((attribute) => Math.max(0, Math.trunc(attribute))),
    });
  });
  return [...stagesByTurn.values()].sort(
    (left, right) => left.turn - right.turn,
  );
}

export function normalizeTurnList(value: string | number[] | undefined) {
  const rows = Array.isArray(value)
    ? value
    : String(value || '').split(/[,，\s]+/);
  return Array.from(
    new Set(
      rows
        .map(Number)
        .filter((turn) => Number.isInteger(turn) && turn >= 1 && turn <= 76),
    ),
  ).sort((left, right) => left - right);
}

export function normalizeSkillLearningSettings(
  value: Record<string, Partial<SkillLearningSetting>> | undefined,
) {
  const result: Record<string, SkillLearningSetting> = {};
  Object.entries(value || {}).forEach(([rawName, rawSetting]) => {
    const name = String(rawName || '').trim();
    if (!name || !rawSetting || typeof rawSetting !== 'object') return;
    result[name] = {
      min_hint_level: Math.max(
        0,
        Math.min(5, Math.trunc(Number(rawSetting.min_hint_level) || 0)),
      ),
      learn_when_affordable: Boolean(rawSetting.learn_when_affordable),
      purchase_turns: normalizeTurnList(rawSetting.purchase_turns),
    };
  });
  return result;
}

let skillSelectionSequence = 0;

export function createSkillSelectionId() {
  skillSelectionSequence += 1;
  return `skill-selection-${Date.now()}-${skillSelectionSequence}`;
}

export function normalizeSkillSelections(
  rows: string[][] | undefined,
  labels: string[] | undefined,
) {
  const selected = new Set<string>();
  const result: SkillSelectionEntry[] = [];
  (rows || []).forEach((row, index) => {
    const names = Array.from(
      new Set(
        row
          .map((name) => String(name || '').trim())
          .filter((name) => name && !selected.has(name)),
      ),
    );
    names.forEach((name) => selected.add(name));
    if (!names.length) return;
    result.push({
      id: createSkillSelectionId(),
      label:
        names.length > 1
          ? String(labels?.[index] || '').trim() ||
            `技能组 ${result.length + 1}`
          : '',
      skill_names: names,
    });
  });
  return result;
}

export function skillPurchaseTurn(
  yearOffset: number,
  month: number,
  half: 1 | 2,
) {
  return yearOffset + (month - 1) * 2 + half;
}

export function skillPurchaseTurnLabel(turn: number) {
  const year = SKILL_PURCHASE_YEAR_OPTIONS.find(
    (option) => turn > option.offset && turn <= option.offset + 24,
  );
  if (!year) return `URA 决赛阶段 · 第 ${turn} 回合`;
  const yearTurn = turn - year.offset;
  const month = Math.ceil(yearTurn / 2);
  const half = yearTurn % 2 === 1 ? '上半' : '下半';
  return `${year.label} ${month}月${half}`;
}

export function turnDateLabel(value: number | string | undefined) {
  const turn = Number(value);
  if (!Number.isInteger(turn) || turn <= 0) return '-';
  return skillPurchaseTurnLabel(turn);
}

export const RACE_GRADE_ORDER: Record<string, number> = {
  G1: 1,
  G2: 2,
  G3: 3,
  OP: 4,
  'PRE-OP': 5,
};

export function compareRaces(left: RaceOption, right: RaceOption) {
  return (
    Number(left.turn || 0) - Number(right.turn || 0) ||
    (RACE_GRADE_ORDER[left.type] || 99) -
      (RACE_GRADE_ORDER[right.type] || 99) ||
    left.name.localeCompare(right.name, 'zh-CN') ||
    left.id - right.id
  );
}

export function normalizeRaceSelection(raceIds: number[], races: RaceOption[]) {
  const raceById = new Map(races.map((race) => [race.id, race]));
  const seenIds = new Set<number>();
  const seenTurns = new Set<number>();

  return raceIds.map(Number).filter((raceId) => {
    if (!Number.isFinite(raceId) || seenIds.has(raceId)) return false;
    seenIds.add(raceId);
    const race = raceById.get(raceId);
    if (!race) return true;
    if (seenTurns.has(race.turn)) return false;
    seenTurns.add(race.turn);
    return true;
  });
}

export function describeRunnerAction(value?: string) {
  const action = String(value || '').trim();
  if (!action) return '等待开始';
  if (action === 'started') return '正在准备养马';
  if (action === 'command') return '正在选择训练、休息或外出';
  if (action === 'event') return '正在处理育成事件';
  if (action === 'race') return '正在参加比赛';
  if (action === 'race_progress') return '正在完成比赛流程';
  if (action === 'finish') return '正在完成本次养马';
  if (action === 'idle') return '正在等待游戏进入下一状态';
  if (action.startsWith('skills:')) {
    return `刚刚学习了：${action.slice('skills:'.length)}`;
  }
  if (action.startsWith('skills ')) {
    return `刚刚学习了 ${action.slice('skills '.length)} 个技能`;
  }
  if (action.startsWith('blocked state')) return '游戏状态异常，正在尝试恢复';
  if (action.startsWith('items')) return '正在整理和使用道具';
  return action;
}

export function runModeLabel(mode?: RunMode) {
  const labels: Record<RunMode, string> = {
    single: '单次运行',
    continuous: '持续运行',
    count: '运行指定次数',
    daily_count: '每日运行次数',
    jewel_drops: '宝石掉落目标',
    daily_jewel_drops: '今日宝石累计目标',
    daily_jewel_schedule: '每日宝石计划',
    queue: '详设队列',
  };
  return labels[mode || 'single'];
}

export function dailyJewelScheduleStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    waiting: '等待启动时间',
    waiting_login: '等待账号登录',
    starting: '正在启动',
    running: '运行中',
    occupied: '等待当前操作结束',
    retry_wait: '稍后重试',
    paused: '已暂停',
    completed: '今日已完成',
    disabled: '已停止',
    invalid: '时间设置无效',
  };
  return labels[String(status || '')] || '等待启动时间';
}

export function formatDailyJewelScheduleWindow(start?: string, end?: string) {
  const normalizedStart = String(start || '05:00');
  const normalizedEnd = String(end || '05:00');
  if (normalizedStart === normalizedEnd) {
    const [hour, minute] = normalizedEnd.split(':').map(Number);
    const endMinutes = (hour * 60 + minute + 24 * 60 - 1) % (24 * 60);
    const inclusiveEnd = `${String(Math.floor(endMinutes / 60)).padStart(
      2,
      '0',
    )}:${String(endMinutes % 60).padStart(2, '0')}`;
    return `${normalizedStart}–次日${inclusiveEnd}`;
  }
  return normalizedStart > normalizedEnd
    ? `${normalizedStart}–次日${normalizedEnd}`
    : `${normalizedStart}–${normalizedEnd}`;
}

export function careerReportStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    finished: '已完成',
    stopped: '已停止',
    error: '异常结束',
    running: '运行中',
  };
  return labels[String(status || '')] || '状态未知';
}

export function formatReportTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function describeLogAction(value: string) {
  const labels: Record<string, string> = {
    started: '开始养马',
    command: '选择行动',
    event: '育成事件',
    event_choice: '事件选择',
    race_entry: '报名比赛',
    race_end: '比赛结束',
    race_out: '离开比赛',
    race_rank: '比赛结果',
    race_rank_retry: '再次比赛',
    g123_eight_length_win: '比赛大差',
    比赛大差: '比赛大差',
    race_clock: '使用闹钟',
    race_clock_failed: '闹钟使用失败',
    race_reject: '无法报名比赛',
    race_skip: '跳过比赛流程',
    race_end_skip: '比赛已经结束',
    race_end_reconciled: '比赛状态已恢复',
    race_out_reconciled: '比赛状态已恢复',
    venus_spirit_use: '发动女神知识',
    venus_race_progress: '女神杯比赛',
    daily_jewel_limit: '达到本周期上限',
    finish_reconciled: '结束状态已恢复',
    skills: '学习技能',
    skill_purchase_time: '按计划学习技能',
    items_buy: '购买道具',
    items_use: '使用道具',
    update_setting: '更新设置',
    recover: '恢复养马状态',
    finish: '完成养马',
    stop: '停止养马',
    error: '需要处理',
    session_recovery: '恢复登录',
    session_recovered: '登录已恢复',
    relogin: '重新登录',
    relogin_ok: '登录成功',
  };
  return labels[value] || value;
}

export function describeLogDetail(value: string) {
  const detail = String(value || '');
  const largeMarginMatch = detail.match(
    /race_id (\d+), margin_lengths ([\d.]+)/,
  );
  if (largeMarginMatch) {
    return `比赛 ID ${largeMarginMatch[1]} · 大差 ${largeMarginMatch[2]} 马身`;
  }
  const trainingMatch = detail.match(
    /^training (Speed|Stamina|Power|Guts|Wit)/,
  );
  if (trainingMatch) {
    const labels: Record<string, string> = {
      Speed: '速度训练',
      Stamina: '耐力训练',
      Power: '力量训练',
      Guts: '毅力训练',
      Wit: '智力训练',
    };
    return labels[trainingMatch[1]];
  }
  if (detail.startsWith('rest ')) return '休息恢复体力';
  if (detail.startsWith('recreation ')) return '外出调整状态';
  if (/^rank \d+/.test(detail)) {
    const rank = detail.match(/^rank (\d+)/)?.[1];
    const margin = detail.match(/margin_lengths ([\d.]+)/)?.[1];
    if (rank === '1' && margin) {
      return `第一名 ${margin} 马身`;
    }
    return rank ? `第 ${rank} 名` : '比赛结果已确认';
  }
  const eventChoiceMatch = detail.match(/^(\d+) -> (\d+)$/);
  if (eventChoiceMatch) {
    const storyId = Number(eventChoiceMatch[1]);
    const story = UMDB.stories.find((item: any) => item.id === storyId);
    const eventName = story?.name || `事件 ${storyId}`;
    return `${eventName} · 选择第 ${eventChoiceMatch[2]} 项`;
  }
  const singleEventMatch = detail.match(/^event (\d+)$/);
  if (singleEventMatch) {
    const storyId = Number(singleEventMatch[1]);
    const story = UMDB.stories.find((item: any) => item.id === storyId);
    return story?.name || `事件 ${storyId}`;
  }
  if (detail === 'short 1') return '正在快速完成比赛';
  if (detail === 'resume') return '继续处理尚未结束的比赛';
  if (/^\d+$/.test(detail)) return `${detail} 个`;
  if (detail === 'event') return '选择育成事件选项';
  if (detail === 'finished' || detail === 'ready to finish') {
    return '本次养马已到结束阶段';
  }
  if (detail.startsWith('preset ')) return '已加载养马预设';
  return detail || '-';
}

export const HIDDEN_RUNNER_LOG_ACTIONS = new Set([
  'command_exec',
  'race',
  'race_start',
  'race_end',
  'race_end_skip',
  'race_end_reconciled',
]);
