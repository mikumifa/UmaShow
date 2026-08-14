/* eslint-disable promise/always-return, promise/catch-or-return, jsx-a11y/label-has-associated-control, no-nested-ternary */
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Check,
  CircleStop,
  Database,
  Download,
  Gem,
  GripVertical,
  History,
  ListChecks,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  Trash2,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import SkillSelector, {
  AutoResearchSkill,
  skillIconPath,
} from 'renderer/components/autoResearch/SkillSelector';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';

type CapturedCredential = {
  uid: string;
  accessKey: string;
  capturedAt: string;
  source: string;
};

type RunnerStats = {
  hp?: number;
  max_hp?: number;
  motivation?: number;
  speed?: number;
  stamina?: number;
  power?: number;
  guts?: number;
  wit?: number;
  skill_point?: number;
};

type Runner = {
  running?: boolean;
  stopping?: boolean;
  session_waiting?: boolean;
  session_wait_until?: number;
  session_wait_seconds?: number;
  session_wait_reason?: string;
  turn?: number;
  steps?: number;
  last_action?: string;
  last_error?: string;
  finished?: boolean;
  log?: Array<{
    id: number;
    action: string;
    turn: number | string;
    detail: string;
    time: string;
  }>;
  action_history?: Array<{
    turn: number;
    action: string;
    facility: string;
    detail: string;
    stats?: RunnerStats;
  }>;
  card_id?: number;
  current_stats?: RunnerStats;
  jewels_earned?: number;
  jewel_drop_count?: number;
  daily_jewel_drop_count?: number;
  daily_jewels_earned?: number;
  daily_jewel_drop_limit?: number;
  daily_jewel_reset_time?: string;
  run_plan?: {
    active: boolean;
    mode: 'single' | 'continuous' | 'daily_count' | 'jewel_drops';
    target: number;
    completed_runs: number;
    completed_jewel_drops: number;
    daily_completed_runs: number;
    stop_reason: string;
  };
  daily_jewel_schedule?: {
    enabled: boolean;
    target: number;
    start_time: string;
    end_time: string;
    status: string;
    last_error: string;
    daily_jewel_drop_count: number;
    updated_at: string;
  };
  jewel_history?: Array<{
    turn: number;
    program_id: number;
    race_name: string;
    rank: number;
    amount: number;
    time: string;
  }>;
};

type SessionAccount = {
  tp: { current: number; max: number };
  carrots: { total: number };
  gold: number;
  clocks: number;
  energy_drinks: number;
  career?: {
    active: boolean;
    card_id?: number | string;
    name: string;
    turn: number;
    scenario_id: number;
    vital: number;
    max_vital: number;
    support_card_ids?: number[];
    friend_viewer_id?: number;
    friend_card_id?: number;
    parent_id_1?: number;
    parent_id_2?: number;
  } | null;
};

type Account = {
  id: string;
  uid: string;
  label: string;
  source: string;
  accessKeyPreview: string;
  updatedAt: string;
  runtime: {
    logged_in: boolean;
    last_error: string;
    last_refreshed_at?: string;
    runner: Runner;
    account?: SessionAccount | null;
  };
};

type FactorInfo = {
  id: number;
  name: string;
  stars: number;
  category: string;
  factor_type: number;
  factor_group_id: number;
};

type FactorSummary = {
  stat: FactorInfo | null;
  distance: FactorInfo | null;
  unique: FactorInfo | null;
  white_count: number;
};

type SupportInfo = {
  id: number;
  chara_id: number;
  name: string;
  rarity: string;
  type: string;
  max_level: number;
  max_exp: number;
  owned: boolean;
  exp: number;
  limit_break_count: number;
};

type Dashboard = {
  account: SessionAccount;
  umas: Array<{
    id: number;
    chara_id: number;
    name: string;
    rarity: number;
    talent_level: number;
    race_cloth_id: number;
  }>;
  supports: SupportInfo[];
  decks: Array<{
    id: number;
    name: string;
    support_card_ids: number[];
    cards: SupportInfo[];
  }>;
  parents: Array<{
    selection_id: string;
    source: 'own' | 'rental';
    viewer_id: number;
    owner_name: string;
    instance_id: number;
    card_id: number;
    chara_id: number;
    name: string;
    rank: number;
    rank_score: number;
    rarity: number;
    talent_level: number;
    race_cloth_id: number;
    scenario_id: number;
    running_style: number;
    stats: {
      speed: number;
      stamina: number;
      power: number;
      guts: number;
      wiz: number;
    };
    factors: FactorInfo[];
    factor_summary: FactorSummary;
    ancestors: Array<{
      position_id: number;
      card_id: number;
      chara_id: number;
      race_cloth_id: number;
      rarity: number;
      name: string;
      factors: FactorInfo[];
      factor_summary: FactorSummary;
    }>;
  }>;
  friends: Array<{
    viewer_id: number;
    name: string;
    support_card_id: number;
    support_name: string;
    rarity: string;
    type: string;
    chara_id: number;
    exp: number;
    limit_break_count: number;
  }>;
  friend_exclude_ids: number[];
};

type AutoResearchTab =
  | 'accounts'
  | 'presets'
  | 'career'
  | 'progress'
  | 'history';

type CareerReportSummary = {
  id: string;
  started_at?: string;
  ended_at?: string;
  preset_name: string;
  scenario_id: number;
  status: string;
  final_turn: number;
  card_id: number;
  race_count: number;
  jewel_drop_count: number;
  jewels_earned: number;
  final_stats?: RunnerStats;
  error_message?: string;
};

type CareerReport = CareerReportSummary & {
  turns?: Array<{
    turn: number;
    selected_action?: string;
    decision_reason?: string;
    events?: Array<{
      event?: string;
      action?: string;
      detail?: string;
      time?: string;
    }>;
    api_calls?: Array<{
      direction?: string;
      endpoint?: string;
      result_code?: number;
    }>;
  }>;
};

type CareerSetting = {
  id: string;
  name: string;
  account_uid: string;
  preset_name: string;
  card_id: number;
  deck_id: number;
  support_card_ids: number[];
  friend_card_id: number;
  friend_key?: string;
  parent_id_1: number;
  parent_id_2: number;
  parent_key_1?: string;
  parent_key_2?: string;
  scenario_id?: number;
  max_steps: number;
  burn_clocks: boolean;
  recover_tp_with_item: boolean;
  recover_tp_with_jewels: boolean;
  updated_at: string;
};

type RunMode =
  | 'single'
  | 'continuous'
  | 'daily_count'
  | 'jewel_drops'
  | 'daily_jewel_schedule';

type PendingRun = { type: 'current' } | { type: 'saved'; settingId: string };

type SessionResponse = {
  success: boolean;
  dashboard?: Dashboard;
  runtime?: Partial<Account['runtime']>;
  runner?: Runner;
  relogged_in?: boolean;
};

type AuthResponse = SessionResponse & {
  token: string;
  expires_at: number;
};

type SkillLearningSetting = {
  min_hint_level: number;
  learn_when_affordable: boolean;
  purchase_turns: number[];
};

type SkillSelectionEntry = {
  id: string;
  label: string;
  skill_names: string[];
};

type Preset = {
  name: string;
  scenario_id?: number;
  running_style?: number;
  recover_tp_with_item?: boolean;
  recover_tp_with_jewels?: boolean;
  learn_skill_list?: string[][];
  learn_skill_group_labels?: string[];
  learn_skill_settings?: Record<string, SkillLearningSetting>;
  learn_skill_blacklist?: string[];
  learn_skill_threshold?: number;
  learn_skill_only_user_provided?: boolean;
  skip_double_circle_unless_high_hint?: boolean;
  skill_purchase_turns?: number[];
  extra_race_list?: number[];
  cure_asap_conditions?: string[];
  expect_attribute?: number[];
  score_value?: number[][];
  base_score?: number[];
  stat_value_multiplier?: number[];
  extra_weight?: number[][];
  npc_score_value?: number[][];
  compensate_failure?: boolean;
  summer_score_threshold?: number;
  motivation_threshold_year1?: number;
  motivation_threshold_year2?: number;
  motivation_threshold_year3?: number;
  prioritize_recreation?: boolean;
  pal_thresholds?: number[][];
  pal_friendship_score?: number[];
  pal_card_multiplier?: number;
  rest_threshold?: number;
};

type SkillOption = Partial<Omit<AutoResearchSkill, 'id'>> & {
  name?: string;
};

type RaceOption = {
  id: number;
  program_id: number;
  turn: number;
  name: string;
  date: string;
  type: string;
  terrain: string;
  distance: string;
  venue: string;
  thumbnail_id: number;
};

type LoginProgress = {
  accountId: string;
  loginId: string;
  action: 'login' | 'refresh';
  stage: string;
  endpoint: string;
  detail: string;
  delay: number;
  elapsed: number;
};

type LoginProgressResponse = {
  found: boolean;
  stage?: string;
  endpoint?: string;
  detail?: string;
  delay?: number;
  done?: boolean;
  error?: string;
};

const DEFAULT_SERVER = 'http://127.0.0.1:18765';
const DEFAULT_PRESET_NAME = 'URA 默认';
const LOCAL_PRESETS_KEY = 'autoResearch.presets';
const DELETED_PRESETS_KEY = 'autoResearch.deletedPresets';
const CAREER_SETTINGS_KEY = 'autoResearch.careerSettings';
const LAST_ACCOUNT_KEY = 'autoResearch.lastLoggedInAccount';

function getSharedStorageItem(key: string) {
  const legacyValue = localStorage.getItem(key);
  try {
    const value = window.electron.autoResearch.getUiSetting(
      key,
      legacyValue,
      window.location.origin,
    );
    if (value === null) {
      localStorage.removeItem(key);
    } else if (value !== legacyValue) {
      localStorage.setItem(key, value);
    }
    return value;
  } catch (error) {
    console.error('Failed to read shared auto research setting:', error);
    return legacyValue;
  }
}

function setSharedStorageItem(key: string, value: string) {
  localStorage.setItem(key, value);
  try {
    if (!window.electron.autoResearch.setUiSetting(key, value)) {
      console.error('Failed to save shared auto research setting');
    }
  } catch (error) {
    console.error('Failed to save shared auto research setting:', error);
  }
}

const STAT_LABELS = ['速度', '耐力', '力量', '毅力', '智力'];
const PERIOD_LABELS = [
  '初级年',
  '经典年',
  '高级年前半',
  '高级年后半',
  'URA 决赛阶段',
];
const SKILL_PURCHASE_YEAR_OPTIONS = [
  { offset: 0, label: '初级年' },
  { offset: 24, label: '经典年' },
  { offset: 48, label: '高级年' },
];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const CONDITION_OPTIONS = [
  { value: 'Migraine', label: '偏头痛' },
  { value: 'Night Owl', label: '熬夜' },
  { value: 'Skin Outbreak', label: '皮肤粗糙' },
  { value: 'Slacker', label: '偷懒癖' },
  { value: 'Slow Metabolism', label: '发胖' },
];

const DEFAULT_EXPECT_ATTRIBUTE = [1200, 800, 1000, 600, 1000];
const DEFAULT_BASE_SCORE = [0, 0, 0, 0, 0];
const DEFAULT_STAT_MULTIPLIER = [0.01, 0.01, 0.01, 0.01, 0.01, 0.005];
const DEFAULT_SCORE_VALUE = [
  [0.11, 0.1, 0.006, 0.09],
  [0.11, 0.1, 0.006, 0.09],
  [0.11, 0.1, 0.006, 0.09],
  [0.03, 0.05, 0.006, 0.09],
  [0, 0, 0.006, 0],
];
const DEFAULT_EXTRA_WEIGHT = Array.from({ length: 4 }, () => [0, 0, 0, 0, 0]);
const DEFAULT_NPC_SCORE = [
  [0.05, 0.05, 0.05],
  [0.05, 0.05, 0.05],
  [0.05, 0.05, 0.05],
  [0.03, 0.05, 0.05],
  [0, 0, 0.05],
];

function createDefaultPreset(name = DEFAULT_PRESET_NAME): Preset {
  return {
    name,
    scenario_id: 1,
    running_style: 0,
    learn_skill_list: [],
    learn_skill_group_labels: [],
    learn_skill_settings: {},
    learn_skill_blacklist: [],
    learn_skill_threshold: 888,
    learn_skill_only_user_provided: true,
    skip_double_circle_unless_high_hint: false,
    skill_purchase_turns: [],
    extra_race_list: [],
    cure_asap_conditions: CONDITION_OPTIONS.map((item) => item.value),
    expect_attribute: [...DEFAULT_EXPECT_ATTRIBUTE],
    score_value: DEFAULT_SCORE_VALUE.map((row) => [...row]),
    base_score: [...DEFAULT_BASE_SCORE],
    stat_value_multiplier: [...DEFAULT_STAT_MULTIPLIER],
    extra_weight: DEFAULT_EXTRA_WEIGHT.map((row) => [...row]),
    npc_score_value: DEFAULT_NPC_SCORE.map((row) => [...row]),
    compensate_failure: true,
    summer_score_threshold: 0.34,
    motivation_threshold_year1: 3,
    motivation_threshold_year2: 4,
    motivation_threshold_year3: 4,
    prioritize_recreation: false,
    pal_thresholds: [],
    pal_friendship_score: [0.08, 0.057, 0.018],
    pal_card_multiplier: 0.1,
    rest_threshold: 48,
  };
}

class AutoResearchRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AutoResearchRequestError';
    this.status = status;
  }
}

function needsRelogin(error: unknown) {
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
    'api error',
    '网络请求失败',
  ].some((marker) => detail.includes(marker));
}

function accountProgressPercent(progress: LoginProgress) {
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

function waitTimeLabel(seconds?: number) {
  const total = Math.max(0, Math.ceil(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
}

function parentViewerIdFromSelection(value?: string) {
  const [source, viewerId] = String(value || '').split(':');
  return source === 'rental' ? Number(viewerId || 0) : 0;
}

function careerSettingMatchesCurrent(
  setting: CareerSetting,
  career: NonNullable<SessionAccount['career']>,
) {
  return Number(setting.card_id || 0) === Number(career.card_id || 0);
}

function normalizeServer(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_SERVER;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

async function fileToBase64(file: File) {
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

function panelClass(extra = '') {
  return `rounded-lg border border-gray-200 bg-white ${extra}`;
}

function scrollToSection(target: string) {
  const element = document.getElementById(target);
  if (!element) return;
  if (element instanceof HTMLDetailsElement) element.open = true;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function horseIconPath(cardId: number, rarity: number, raceClothId = 0) {
  if (!cardId) return undefined;
  const charaId = Number(String(cardId).slice(0, 4));
  const mappedDressId = UMDB.cardRarityData[cardId]?.[rarity];
  const dressId =
    raceClothId && raceClothId !== cardId
      ? raceClothId
      : mappedDressId || raceClothId || cardId;
  if (!charaId || !dressId) return undefined;
  return `trained_chr_icon/${charaId}_${String(dressId).padStart(6, '0')}.png`;
}

function supportIconPath(supportCardId: number) {
  return `support_card_s/${supportCardId}.png`;
}

function UmaChoiceCard({
  uma,
  selected,
  onSelect,
}: {
  uma: Dashboard['umas'][number];
  selected: boolean;
  onSelect: () => void;
}) {
  const iconPath = horseIconPath(uma.id, uma.rarity, uma.race_cloth_id);
  return (
    <button
      type="button"
      onClick={onSelect}
      title={uma.name}
      aria-label={`选择${uma.name}`}
      aria-pressed={selected}
      className={`relative h-16 w-16 flex-none overflow-hidden rounded-md border bg-gray-100 transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
      }`}
    >
      {iconPath ? (
        <AssetIcon
          path={iconPath}
          alt={uma.name}
          className="h-full w-full object-cover"
        />
      ) : null}
      {selected ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

const FACTOR_COLORS: Record<string, string> = {
  stat: 'border-blue-200 bg-blue-50 text-blue-700',
  distance: 'border-pink-200 bg-pink-50 text-pink-700',
  unique: 'border-amber-200 bg-amber-50 text-amber-800',
  white: 'border-gray-200 bg-white text-gray-600',
};

function factorSummary(
  factors: FactorInfo[],
  summary?: FactorSummary,
): FactorSummary {
  return (
    summary || {
      stat: factors.find((factor) => factor.category === 'stat') || null,
      distance:
        factors.find((factor) => factor.category === 'distance') || null,
      unique:
        [...factors].reverse().find((factor) => factor.category === 'unique') ||
        null,
      white_count: factors.filter((factor) => factor.category === 'white')
        .length,
    }
  );
}

function FactorSummaryView({
  factors,
  summary,
}: {
  factors: FactorInfo[];
  summary?: FactorSummary;
}) {
  const current = factorSummary(factors, summary);
  const featured = [current.stat, current.distance, current.unique].filter(
    Boolean,
  ) as FactorInfo[];
  return (
    <div className="flex flex-wrap gap-1">
      {featured.map((factor) => (
        <span
          key={factor.id}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${FACTOR_COLORS[factor.category] || FACTOR_COLORS.white}`}
        >
          {factor.name} {'★'.repeat(Math.max(1, factor.stars))}
        </span>
      ))}
      <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-500">
        白因子 ×{current.white_count}
      </span>
    </div>
  );
}

function FactorDetailList({ factors }: { factors: FactorInfo[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {factors.map((factor) => (
        <span
          key={factor.id}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${FACTOR_COLORS[factor.category] || FACTOR_COLORS.white}`}
          title={`因子 ID ${factor.id}`}
        >
          {factor.name} {'★'.repeat(Math.max(1, factor.stars))}
        </span>
      ))}
    </div>
  );
}

function ParentChoiceCard({
  parent,
  selected,
  disabled,
  onSelect,
}: {
  parent: Dashboard['parents'][number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const iconPath = horseIconPath(
    parent.card_id,
    parent.rarity,
    parent.race_cloth_id,
  );
  return (
    <div
      className={`rounded-lg border bg-white p-3 transition-all ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-100'
          : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`选择继承马娘${parent.name}`}
        aria-pressed={selected}
        className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-30"
      >
        <span className="relative h-16 w-16 flex-none overflow-hidden rounded-md bg-gray-100">
          {iconPath ? (
            <AssetIcon
              path={iconPath}
              alt={parent.name}
              className="h-full w-full object-cover"
            />
          ) : null}
          {selected ? (
            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
              <Check size={13} strokeWidth={3} />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-gray-800">
              {parent.name}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                parent.source === 'rental'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              {parent.source === 'rental' ? '借用' : '自己的'}
            </span>
          </span>
          <FactorSummaryView
            factors={parent.factors || []}
            summary={parent.factor_summary}
          />
        </span>
      </button>

      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {parent.ancestors.map((ancestor) => {
          const ancestorIcon = horseIconPath(
            ancestor.card_id,
            ancestor.rarity,
            ancestor.race_cloth_id,
          );
          return (
            <div
              key={ancestor.position_id}
              className="flex min-w-0 items-center gap-2 rounded-md bg-gray-50 p-1.5"
            >
              <span className="h-9 w-9 flex-none overflow-hidden rounded bg-gray-100">
                {ancestorIcon ? (
                  <AssetIcon
                    path={ancestorIcon}
                    alt={ancestor.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <FactorSummaryView
                  factors={ancestor.factors || []}
                  summary={ancestor.factor_summary}
                />
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
      >
        {expanded ? '收起详细因子' : '查看详细因子'}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          <div>
            <div className="mb-1 text-[11px] font-medium text-gray-500">
              本体因子
            </div>
            <FactorDetailList factors={parent.factors || []} />
          </div>
          {parent.ancestors.map((ancestor) => (
            <div key={`detail-${ancestor.position_id}`}>
              <div className="mb-1 text-[11px] font-medium text-gray-500">
                祖辈 {ancestor.position_id === 10 ? '1' : '2'} · {ancestor.name}
              </div>
              <FactorDetailList factors={ancestor.factors || []} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SupportChoiceCard({
  support,
  selected,
  disabled,
  onSelect,
}: {
  support: SupportInfo;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      title={support.name}
      aria-label={`选择好友支援卡${support.name}`}
      aria-pressed={selected}
      className={`relative h-14 w-14 flex-none overflow-hidden rounded-md border bg-gray-100 transition-all disabled:cursor-not-allowed disabled:opacity-25 ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-200'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'
      }`}
    >
      <AssetIcon
        path={supportIconPath(support.id)}
        alt={support.name}
        className="h-full w-full object-cover"
      />
      {selected ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

function DeckChoiceCard({
  deck,
  selected,
  disabled,
  onSelect,
}: {
  deck: Dashboard['decks'][number];
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-fit max-w-full flex-none rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
        selected
          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100'
          : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-gray-700">
          {deck.name}
        </span>
        {selected ? <Check size={16} className="text-indigo-600" /> : null}
      </span>
      <span className="flex flex-nowrap gap-1">
        {deck.cards.map((support) => (
          <span
            key={support.id}
            className="h-12 w-12 flex-none overflow-hidden rounded bg-gray-100"
            title={support.name}
          >
            <AssetIcon
              path={supportIconPath(support.id)}
              alt={support.name}
              className="h-full w-full object-cover"
            />
          </span>
        ))}
      </span>
    </button>
  );
}

function numberArray(
  value: number[] | undefined,
  fallback: number[],
): number[] {
  return fallback.map((defaultValue, index) => {
    const candidate = Number(value?.[index]);
    return Number.isFinite(candidate) ? candidate : defaultValue;
  });
}

function numberMatrix(
  value: number[][] | undefined,
  fallback: number[][],
): number[][] {
  return fallback.map((row, index) => numberArray(value?.[index], row));
}

function normalizeTurnList(value: string | number[] | undefined) {
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

function normalizeSkillLearningSettings(
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

function createSkillSelectionId() {
  skillSelectionSequence += 1;
  return `skill-selection-${Date.now()}-${skillSelectionSequence}`;
}

function normalizeSkillSelections(
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

function skillPurchaseTurn(yearOffset: number, month: number, half: 1 | 2) {
  return yearOffset + (month - 1) * 2 + half;
}

function skillPurchaseTurnLabel(turn: number) {
  const year = SKILL_PURCHASE_YEAR_OPTIONS.find(
    (option) => turn > option.offset && turn <= option.offset + 24,
  );
  if (!year) return `URA 决赛阶段 · 第 ${turn} 回合`;
  const yearTurn = turn - year.offset;
  const month = Math.ceil(yearTurn / 2);
  const half = yearTurn % 2 === 1 ? '上半' : '下半';
  return `${year.label} ${month}月${half}`;
}

function turnDateLabel(value: number | string | undefined) {
  const turn = Number(value);
  if (!Number.isInteger(turn) || turn <= 0) return '-';
  return skillPurchaseTurnLabel(turn);
}

const RACE_GRADE_ORDER: Record<string, number> = {
  G1: 1,
  G2: 2,
  G3: 3,
  OP: 4,
  'PRE-OP': 5,
};

function compareRaces(left: RaceOption, right: RaceOption) {
  return (
    Number(left.turn || 0) - Number(right.turn || 0) ||
    (RACE_GRADE_ORDER[left.type] || 99) -
      (RACE_GRADE_ORDER[right.type] || 99) ||
    left.name.localeCompare(right.name, 'zh-CN') ||
    left.id - right.id
  );
}

function describeRunnerAction(value?: string) {
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

function runModeLabel(mode?: RunMode) {
  const labels: Record<RunMode, string> = {
    single: '单次运行',
    continuous: '持续运行',
    daily_count: '每日运行次数',
    jewel_drops: '宝石掉落目标',
    daily_jewel_schedule: '每日宝石计划',
  };
  return labels[mode || 'single'];
}

function dailyJewelScheduleStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    waiting: '等待启动时间',
    waiting_login: '等待账号登录',
    starting: '正在启动',
    running: '运行中',
    occupied: '等待当前操作结束',
    retry_wait: '稍后重试',
    completed: '今日已完成',
    disabled: '已停止',
    invalid: '时间设置无效',
  };
  return labels[String(status || '')] || '等待启动时间';
}

function careerReportStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    finished: '已完成',
    stopped: '已停止',
    error: '异常结束',
    running: '运行中',
  };
  return labels[String(status || '')] || '状态未知';
}

function formatReportTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function describeLogAction(value: string) {
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
    race_clock: '使用闹钟',
    race_clock_failed: '闹钟使用失败',
    race_reject: '无法报名比赛',
    race_skip: '跳过比赛流程',
    race_end_skip: '比赛已经结束',
    race_end_reconciled: '比赛状态已恢复',
    race_out_reconciled: '比赛状态已恢复',
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
    session_wait: '等待重新登录',
    session_wait_released: '提前结束等待',
    relogin: '重新登录',
    relogin_ok: '登录成功',
  };
  return labels[value] || value;
}

function describeLogDetail(value: string) {
  const detail = String(value || '');
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

const HIDDEN_RUNNER_LOG_ACTIONS = new Set([
  'command_exec',
  'race',
  'race_start',
  'race_end',
  'race_end_skip',
  'race_end_reconciled',
]);

export default function AutoResearch() {
  const [activeTab, setActiveTab] = useState<AutoResearchTab>('accounts');
  const [serverAddress, setServerAddress] = useState(
    () => localStorage.getItem('autoResearch.server') || DEFAULT_SERVER,
  );
  const [server, setServer] = useState('');
  const [health, setHealth] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [captured, setCaptured] = useState<CapturedCredential[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [presets, setPresets] = useState<Preset[]>(() => [
    createDefaultPreset(),
  ]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [skills, setSkills] = useState<AutoResearchSkill[]>([]);
  const [busy, setBusy] = useState('');
  const [stoppingAccountId, setStoppingAccountId] = useState('');
  const [error, setError] = useState('');
  const [manualUid, setManualUid] = useState('');
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loginProgress, setLoginProgress] = useState<LoginProgress | null>(
    null,
  );
  const sessionTokens = useRef(new Map<string, string>());
  const autoConnectAttempted = useRef(false);
  const autoLoginAttempted = useRef('');
  const activeLoginOperation = useRef('');
  const accountActionRef = useRef<
    | ((
        accountId: string,
        action: 'login' | 'logout' | 'refresh',
      ) => Promise<void>)
    | null
  >(null);

  const [cardId, setCardId] = useState(0);
  const [deckId, setDeckId] = useState(0);
  const [supportCardIds, setSupportCardIds] = useState<number[]>([]);
  const [friendCardId, setFriendCardId] = useState(0);
  const [parent1, setParent1] = useState('');
  const [parent2, setParent2] = useState('');
  const [scenarioId, setScenarioId] = useState(1);
  const [presetName, setPresetName] = useState(DEFAULT_PRESET_NAME);
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetSaved, setPresetSaved] = useState(false);
  const presetSaveFeedbackTimer = useRef<number | null>(null);
  const [maxSteps, setMaxSteps] = useState(2500);
  const [burnClocks, setBurnClocks] = useState(false);
  const [runningStyle, setRunningStyle] = useState(0);
  const [recoverTpWithItem, setRecoverTpWithItem] = useState(false);
  const [recoverTpWithJewels, setRecoverTpWithJewels] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runMode, setRunMode] = useState<RunMode>('single');
  const [dailyRunTarget, setDailyRunTarget] = useState(3);
  const [jewelDropTarget, setJewelDropTarget] = useState(20);
  const [scheduleStartTime, setScheduleStartTime] = useState('05:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('23:59');
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
  const [skillSelections, setSkillSelections] = useState<SkillSelectionEntry[]>(
    [],
  );
  const [skillLearningSettings, setSkillLearningSettings] = useState<
    Record<string, SkillLearningSetting>
  >({});
  const [editingSkillSelectionId, setEditingSkillSelectionId] = useState('');
  const [skillSettingYearOffset, setSkillSettingYearOffset] = useState(0);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [draggedPrioritySkill, setDraggedPrioritySkill] = useState('');
  const [skillThreshold, setSkillThreshold] = useState(888);
  const [skipDoubleCircle, setSkipDoubleCircle] = useState(false);
  const [skillPurchaseTurns, setSkillPurchaseTurns] = useState<number[]>([]);
  const [skillPurchaseYearOffset, setSkillPurchaseYearOffset] = useState(0);
  const [cureConditions, setCureConditions] = useState<string[]>(
    CONDITION_OPTIONS.map((item) => item.value),
  );
  const [expectAttribute, setExpectAttribute] = useState(
    DEFAULT_EXPECT_ATTRIBUTE,
  );
  const [baseScore, setBaseScore] = useState(DEFAULT_BASE_SCORE);
  const [statMultiplier, setStatMultiplier] = useState(DEFAULT_STAT_MULTIPLIER);
  const [scoreValue, setScoreValue] = useState(DEFAULT_SCORE_VALUE);
  const [extraWeight, setExtraWeight] = useState(DEFAULT_EXTRA_WEIGHT);
  const [npcScoreValue, setNpcScoreValue] = useState(DEFAULT_NPC_SCORE);
  const [compensateFailure, setCompensateFailure] = useState(true);
  const [summerScoreThreshold, setSummerScoreThreshold] = useState(0.34);
  const [motivationThresholds, setMotivationThresholds] = useState([3, 4, 4]);
  const [prioritizeRecreation, setPrioritizeRecreation] = useState(false);
  const [palThresholds, setPalThresholds] = useState<number[][]>([]);
  const [palFriendshipScore, setPalFriendshipScore] = useState([
    0.08, 0.057, 0.018,
  ]);
  const [palCardMultiplier, setPalCardMultiplier] = useState(0.1);
  const [restThreshold, setRestThreshold] = useState(48);
  const [selectedRaceIds, setSelectedRaceIds] = useState<number[]>([]);
  const [raceSearch, setRaceSearch] = useState('');
  const [umaSearch, setUmaSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [supportSearch, setSupportSearch] = useState('');
  const [parentSelectionSlot, setParentSelectionSlot] = useState<1 | 2>(1);
  const [careerSettings, setCareerSettings] = useState<CareerSetting[]>([]);
  const [selectedCareerSettingId, setSelectedCareerSettingId] = useState('');
  const [careerSettingName, setCareerSettingName] = useState('');
  const [careerSaveOpen, setCareerSaveOpen] = useState(false);
  const [newCareerSaveName, setNewCareerSaveName] = useState('');
  const [careerHistory, setCareerHistory] = useState<CareerReportSummary[]>([]);
  const [selectedCareerReport, setSelectedCareerReport] =
    useState<CareerReport | null>(null);

  const skillPriorityNames = useMemo(
    () => skillSelections.flatMap((entry) => entry.skill_names),
    [skillSelections],
  );
  const editingSkillSelection = skillSelections.find(
    (entry) => entry.id === editingSkillSelectionId,
  );

  const dashboard = session?.dashboard;
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const runner = session?.runtime?.runner || selectedAccount?.runtime.runner;
  const runnerStopping = Boolean(
    runner?.stopping || stoppingAccountId === selectedAccountId,
  );
  const runnerSessionWaiting = Boolean(runner?.session_waiting);
  const dailyJewelSchedule = runner?.daily_jewel_schedule;
  const automationActive = Boolean(
    runner?.running || runner?.run_plan?.active || dailyJewelSchedule?.enabled,
  );
  const dailyRunCount = runner?.run_plan?.daily_completed_runs || 0;
  const hasRunPlan = Boolean(
    runner?.run_plan?.active ||
      runner?.run_plan?.stop_reason ||
      runner?.run_plan?.completed_runs ||
      runner?.run_plan?.completed_jewel_drops,
  );
  const remainingJewelDrops = Math.max(
    0,
    (runner?.daily_jewel_drop_limit || 20) -
      (runner?.daily_jewel_drop_count || 0),
  );
  const activeCareer = dashboard?.account.career;
  const activeCareerUma = dashboard?.umas.find(
    (uma) => uma.id === Number(activeCareer?.card_id || 0),
  );
  const currentCareerActive = Boolean(activeCareer?.active || runner?.running);
  const currentCareerUma =
    activeCareerUma ||
    (runner?.running
      ? dashboard?.umas.find((uma) => uma.id === Number(runner?.card_id || 0))
      : undefined);
  const activeCareerIconPath = currentCareerUma
    ? horseIconPath(
        currentCareerUma.id,
        currentCareerUma.rarity,
        currentCareerUma.race_cloth_id,
      )
    : undefined;
  const currentRunnerStats =
    runner?.current_stats || runner?.action_history?.at(-1)?.stats || {};
  const unsupportedCareer = Boolean(
    activeCareer?.active && Number(activeCareer.scenario_id) !== 1,
  );
  const selectedUma = dashboard?.umas.find((uma) => uma.id === cardId);
  const selectedParent1 = dashboard?.parents.find(
    (parent) => parent.selection_id === parent1,
  );
  const selectedParent2 = dashboard?.parents.find(
    (parent) => parent.selection_id === parent2,
  );
  const selectedDeck = dashboard?.decks.find((deck) => deck.id === deckId);
  const selectedFriendSupport = dashboard?.supports.find(
    (support) => support.id === friendCardId,
  );
  const selectedDeckCharaIds = useMemo(
    () => (selectedDeck?.cards || []).map((support) => support.chara_id),
    [selectedDeck],
  );
  const accountCareerSettings = useMemo(
    () =>
      careerSettings.filter(
        (setting) => setting.account_uid === selectedAccount?.uid,
      ),
    [careerSettings, selectedAccount?.uid],
  );
  const matchingCareerSettings = useMemo(() => {
    if (!activeCareer?.active) return [];
    return accountCareerSettings.filter(
      (setting) =>
        careerSettingMatchesCurrent(setting, activeCareer) &&
        presets.some((preset) => preset.name === setting.preset_name),
    );
  }, [accountCareerSettings, activeCareer, presets]);
  const selectedCareerSetting = useMemo(
    () =>
      careerSettings.find((setting) => setting.id === selectedCareerSettingId),
    [careerSettings, selectedCareerSettingId],
  );
  const continuingCurrentCareer = Boolean(activeCareer?.active);
  const effectiveCardId =
    cardId ||
    (continuingCurrentCareer ? Number(selectedCareerSetting?.card_id || 0) : 0);
  const effectiveDeckId =
    deckId ||
    (continuingCurrentCareer ? Number(selectedCareerSetting?.deck_id || 0) : 0);
  const effectiveSupportCardIds = useMemo(() => {
    if (
      continuingCurrentCareer &&
      activeCareer?.support_card_ids?.length === 5
    ) {
      return activeCareer.support_card_ids;
    }
    if (selectedDeck?.support_card_ids.length === 5) {
      return selectedDeck.support_card_ids;
    }
    if (supportCardIds.length === 5) return supportCardIds;
    return continuingCurrentCareer
      ? selectedCareerSetting?.support_card_ids || []
      : supportCardIds;
  }, [
    activeCareer,
    continuingCurrentCareer,
    selectedCareerSetting,
    selectedDeck,
    supportCardIds,
  ]);
  const effectiveFriendCardId =
    friendCardId ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.friend_card_id || 0)
      : 0);
  const effectiveParentKey1 =
    parent1 ||
    (continuingCurrentCareer ? selectedCareerSetting?.parent_key_1 : '') ||
    '';
  const effectiveParentKey2 =
    parent2 ||
    (continuingCurrentCareer ? selectedCareerSetting?.parent_key_2 : '') ||
    '';
  const effectiveParentId1 =
    selectedParent1?.instance_id ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.parent_id_1 || 0)
      : 0);
  const effectiveParentId2 =
    selectedParent2?.instance_id ||
    (continuingCurrentCareer
      ? Number(selectedCareerSetting?.parent_id_2 || 0)
      : 0);
  const careerConfigDifferences = useMemo(() => {
    if (!activeCareer?.active) return [];
    if (!selectedCareerSetting) return ['尚未选择养马详设'];
    const differences: string[] = [];
    if (Number(activeCareer.card_id || 0) !== effectiveCardId) {
      differences.push('育成马娘');
    }
    return differences;
  }, [activeCareer, effectiveCardId, selectedCareerSetting]);
  const canContinueCurrentCareer =
    continuingCurrentCareer && careerConfigDifferences.length === 0;
  const skillByName = useMemo(
    () => new Map(skills.map((skill) => [skill.name, skill])),
    [skills],
  );
  const filteredUmas = useMemo(() => {
    const keyword = umaSearch.trim().toLowerCase();
    return (dashboard?.umas || []).filter(
      (uma) =>
        !keyword || `${uma.name} ${uma.id}`.toLowerCase().includes(keyword),
    );
  }, [dashboard?.umas, umaSearch]);
  const filteredParents = useMemo(() => {
    const keyword = parentSearch.trim().toLowerCase();
    return (dashboard?.parents || [])
      .filter((parent) => {
        if (!keyword) return true;
        const factorText = [
          ...(parent.factors || []),
          ...(parent.ancestors || []).flatMap(
            (ancestor) => ancestor.factors || [],
          ),
        ]
          .map((factor) => factor.name)
          .join(' ');
        return `${parent.name} ${parent.card_id} ${factorText}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort(
        (left, right) =>
          right.rank_score - left.rank_score || right.rank - left.rank,
      );
  }, [dashboard?.parents, parentSearch]);
  const filteredSupports = useMemo(() => {
    const keyword = supportSearch.trim().toLowerCase();
    const rarityOrder: Record<string, number> = { SSR: 0, SR: 1, R: 2 };
    return (dashboard?.supports || [])
      .filter(
        (support) =>
          !keyword ||
          `${support.name} ${support.type} ${support.rarity}`
            .toLowerCase()
            .includes(keyword),
      )
      .sort(
        (left, right) =>
          (rarityOrder[left.rarity] ?? 9) - (rarityOrder[right.rarity] ?? 9) ||
          right.id - left.id,
      );
  }, [dashboard?.supports, supportSearch]);
  const availableFriendSupportIds = useMemo(() => {
    const supports = new Map(
      (dashboard?.supports || []).map((support) => [support.id, support]),
    );
    return new Set(
      (dashboard?.friends || [])
        .filter((friend) => {
          const support = supports.get(friend.support_card_id);
          return (
            friend.limit_break_count >= 4 &&
            (!support?.max_exp || friend.exp >= support.max_exp)
          );
        })
        .map((friend) => friend.support_card_id),
    );
  }, [dashboard?.friends, dashboard?.supports]);
  const visibleFriendSupports = useMemo(
    () =>
      filteredSupports.filter((support) =>
        availableFriendSupportIds.has(support.id),
      ),
    [availableFriendSupportIds, filteredSupports],
  );
  const selectionConflict = useMemo(() => {
    if (!selectedUma || !selectedFriendSupport) return '';
    if (effectiveSupportCardIds.length !== 5) {
      return '支援卡组必须正好包含 5 张卡';
    }
    const ownSupports = effectiveSupportCardIds
      .map((supportId) =>
        dashboard?.supports.find((support) => support.id === supportId),
      )
      .filter((support): support is SupportInfo => Boolean(support));
    if (ownSupports.length !== 5) return '支援卡组资料不完整，请刷新当前账号';
    const ownCharaIds = ownSupports.map((support) => support.chara_id);
    if (new Set(ownCharaIds).size !== ownCharaIds.length) {
      return '支援卡组中有相同马娘';
    }
    if (ownCharaIds.includes(selectedUma.chara_id)) {
      return '育成马娘与支援卡组中的马娘重复';
    }
    if (
      selectedFriendSupport.chara_id === selectedUma.chara_id ||
      ownCharaIds.includes(selectedFriendSupport.chara_id)
    ) {
      return '好友支援与育成马娘或支援卡组中的马娘重复';
    }
    const parentCharaIds = [
      selectedParent1?.chara_id || 0,
      selectedParent2?.chara_id || 0,
    ].filter(Boolean);
    if (
      selectedParent1?.source === 'rental' &&
      selectedParent2?.source === 'rental'
    ) {
      return '每次育成最多只能借用一位继承马娘';
    }
    if (
      parentCharaIds.length === 2 &&
      parentCharaIds[0] === parentCharaIds[1]
    ) {
      return '两位继承马娘不能是同一马娘';
    }
    if (parentCharaIds.some((charaId) => charaId === selectedUma.chara_id)) {
      return '育成马娘和继承马娘不能是同一马娘';
    }
    return '';
  }, [
    dashboard?.supports,
    effectiveSupportCardIds,
    selectedFriendSupport,
    selectedParent1,
    selectedParent2,
    selectedUma,
  ]);
  const filteredRaces = useMemo(() => {
    const keyword = raceSearch.trim().toLowerCase();
    return races
      .filter(
        (race) =>
          !keyword ||
          `${race.name} ${race.date} ${race.venue} ${race.type}`
            .toLowerCase()
            .includes(keyword),
      )
      .sort(compareRaces);
  }, [raceSearch, races]);

  const request = useCallback(
    async <T,>(
      path: string,
      init?: Parameters<typeof fetch>[1],
    ): Promise<T> => {
      const response = await fetch(`${server}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new AutoResearchRequestError(
          body.detail || `HTTP ${response.status}`,
          response.status,
        );
      }
      return body as T;
    },
    [server],
  );

  const loadAccounts = useCallback(async () => {
    const localAccounts =
      (await window.electron.autoResearch.accounts()) as Array<
        Omit<Account, 'runtime'>
      >;
    setAccounts((current) =>
      localAccounts.map((account) => ({
        ...account,
        runtime: current.find((item) => item.id === account.id)?.runtime || {
          logged_in: false,
          last_error: '',
          runner: { running: false },
          account: null,
        },
      })),
    );
    const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY) || '';
    setSelectedAccountId((current) => {
      if (current && localAccounts.some((account) => account.id === current)) {
        return current;
      }
      if (
        lastAccountId &&
        localAccounts.some((account) => account.id === lastAccountId)
      ) {
        return lastAccountId;
      }
      return '';
    });
  }, []);

  const updateRuntime = useCallback(
    (accountId: string, response: SessionResponse | null) => {
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? {
                ...account,
                runtime: response
                  ? {
                      ...account.runtime,
                      ...(response.runtime || {}),
                      runner:
                        response.runtime?.runner ||
                        response.runner ||
                        account.runtime.runner,
                      logged_in: !!response.success,
                      account:
                        response.dashboard?.account ?? account.runtime.account,
                    }
                  : {
                      logged_in: false,
                      last_error: '',
                      runner: { running: false },
                      account: null,
                    },
              }
            : account,
        ),
      );
    },
    [],
  );

  const accountRequest = useCallback(
    async <T,>(
      accountId: string,
      path: string,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const token = sessionTokens.current.get(accountId);
      if (!token) {
        throw new AutoResearchRequestError('账号尚未登录此服务器', 401);
      }
      return request<T>(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [request],
  );

  const loadSession = useCallback(
    async (accountId: string) => {
      if (!accountId) return;
      if (!sessionTokens.current.has(accountId)) {
        setSession(null);
        return;
      }
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/session',
      );
      setSession(result);
      updateRuntime(accountId, result);
    },
    [accountRequest, updateRuntime],
  );

  const loadCareerHistory = useCallback(
    async (accountId: string) => {
      if (!accountId || !sessionTokens.current.has(accountId)) return;
      setBusy('history');
      try {
        const result = await accountRequest<{
          success: boolean;
          reports: CareerReportSummary[];
        }>(accountId, '/api/account/career/history');
        setCareerHistory(result.reports || []);
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy('');
      }
    },
    [accountRequest],
  );

  const openCareerReport = async (reportId: string) => {
    if (!selectedAccountId) return;
    setBusy(`history-${reportId}`);
    setError('');
    try {
      const result = await accountRequest<{
        success: boolean;
        report: CareerReport;
      }>(
        selectedAccountId,
        `/api/account/career/history/${encodeURIComponent(reportId)}`,
      );
      setSelectedCareerReport(result.report);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const connect = useCallback(
    async (address?: string) => {
      const nextServer = normalizeServer(address ?? serverAddress);
      setBusy('connect');
      setError('');
      try {
        const response = await fetch(`${nextServer}/api/health`);
        const body = await response.json();
        if (!response.ok || !body.success) {
          throw new Error(body.detail || '服务端未就绪');
        }
        localStorage.setItem('autoResearch.server', nextServer);
        sessionTokens.current.clear();
        setAccounts((current) =>
          current.map((account) => ({
            ...account,
            runtime: {
              logged_in: false,
              last_error: '',
              runner: { running: false },
              account: null,
            },
          })),
        );
        setSession(null);
        setServerAddress(nextServer);
        autoLoginAttempted.current = '';
        setServer(nextServer);
        setHealth(body);
      } catch (caught) {
        setError(`无法连接后端：${(caught as Error).message}`);
      } finally {
        setBusy('');
      }
    },
    [serverAddress],
  );

  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    const storedServer = localStorage.getItem('autoResearch.server');
    if (storedServer) connect(storedServer).catch(() => undefined);
  }, [connect]);

  useEffect(() => {
    loadUMDB().catch(() => undefined);
    try {
      const stored = JSON.parse(
        getSharedStorageItem(CAREER_SETTINGS_KEY) || '[]',
      );
      if (Array.isArray(stored)) setCareerSettings(stored);
    } catch {
      setCareerSettings([]);
    }
  }, []);

  useEffect(
    () => () => {
      if (presetSaveFeedbackTimer.current !== null) {
        window.clearTimeout(presetSaveFeedbackTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    window.electron.autoResearch.credentials().then(setCaptured);
    loadAccounts().catch((caught) => setError((caught as Error).message));
    return window.electron.autoResearch.onCredentialCaptured((credential) => {
      setCaptured((current) => [
        credential,
        ...current.filter((item) => item.uid !== credential.uid),
      ]);
      loadAccounts().catch((caught) => setError((caught as Error).message));
    });
  }, [loadAccounts]);

  useEffect(() => {
    if (!server) return;
    request<{ presets: Preset[] }>('/api/presets')
      .then((result) => {
        let localPresets: Preset[] = [];
        let deletedPresetNames: string[] = [];
        try {
          const stored = JSON.parse(
            getSharedStorageItem(LOCAL_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(stored)) localPresets = stored;
          const deleted = JSON.parse(
            getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(deleted)) deletedPresetNames = deleted;
        } catch {
          localPresets = [];
          deletedPresetNames = [];
        }
        const merged = new Map<string, Preset>();
        [...(result.presets || []), ...localPresets].forEach((preset) => {
          if (
            preset?.name &&
            (preset.name === DEFAULT_PRESET_NAME ||
              !deletedPresetNames.includes(preset.name))
          ) {
            merged.set(preset.name, preset);
          }
        });
        if (!merged.has(DEFAULT_PRESET_NAME)) {
          merged.set(DEFAULT_PRESET_NAME, createDefaultPreset());
        }
        const nextPresets = [
          merged.get(DEFAULT_PRESET_NAME) as Preset,
          ...[...merged.values()].filter(
            (preset) => preset.name !== DEFAULT_PRESET_NAME,
          ),
        ];
        setSharedStorageItem(
          DELETED_PRESETS_KEY,
          JSON.stringify(
            deletedPresetNames.filter((name) => name !== DEFAULT_PRESET_NAME),
          ),
        );
        setPresets(nextPresets);
        setPresetName((current) =>
          nextPresets.some((preset) => preset.name === current)
            ? current
            : DEFAULT_PRESET_NAME,
        );
      })
      .catch((caught) => setError((caught as Error).message));
    request<{ races: RaceOption[] }>('/api/races')
      .then((result) => setRaces(result.races || []))
      .catch((caught) => setError((caught as Error).message));
    request<{ skills: Record<string, SkillOption> }>('/api/skills')
      .then((result) => {
        const byName = new Map<string, AutoResearchSkill>();
        Object.entries(result.skills || {}).forEach(([rawId, rawSkill]) => {
          const name = String(rawSkill.name || '').trim();
          const needSkillPoint = Number(rawSkill.need_skill_point || 0);
          if (!name || needSkillPoint <= 0 || name.endsWith('×')) return;

          const skill: AutoResearchSkill = {
            id: Number(rawId),
            name,
            rarity: Number(rawSkill.rarity || 0),
            group_id: Number(rawSkill.group_id || 0),
            grade_value: Number(rawSkill.grade_value || 0),
            need_skill_point: needSkillPoint,
            disable_singlemode: Number(rawSkill.disable_singlemode || 0),
            tags: Array.isArray(rawSkill.tags)
              ? rawSkill.tags.map(Number).filter(Number.isFinite)
              : [],
            icon_id: Number(rawSkill.icon_id || 0),
            skill_category: Number(rawSkill.skill_category || 0),
          };
          if (!byName.has(name)) byName.set(name, skill);
        });
        setSkills(
          [...byName.values()].sort(
            (left, right) =>
              right.rarity - left.rarity ||
              left.skill_category - right.skill_category ||
              left.name.localeCompare(right.name, 'zh-CN'),
          ),
        );
      })
      .catch((caught) => setError((caught as Error).message));
  }, [request, server]);

  useEffect(() => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) return;
    setScenarioId(Number(preset.scenario_id || 1));
    setRunningStyle(Number(preset.running_style ?? 0));
    setSkillSelections(
      normalizeSkillSelections(
        preset.learn_skill_list,
        preset.learn_skill_group_labels,
      ),
    );
    setSkillLearningSettings(
      normalizeSkillLearningSettings(preset.learn_skill_settings),
    );
    setSkillThreshold(Number(preset.learn_skill_threshold || 888));
    setSkipDoubleCircle(Boolean(preset.skip_double_circle_unless_high_hint));
    setSkillPurchaseTurns(normalizeTurnList(preset.skill_purchase_turns));
    setCureConditions(
      preset.cure_asap_conditions ||
        CONDITION_OPTIONS.map((item) => item.value),
    );
    const loadedTargets = numberArray(
      preset.expect_attribute,
      DEFAULT_EXPECT_ATTRIBUTE,
    );
    setExpectAttribute(
      preset.name === 'URA 默认' &&
        loadedTargets.every((value) => value >= 9999)
        ? DEFAULT_EXPECT_ATTRIBUTE
        : loadedTargets,
    );
    setBaseScore(numberArray(preset.base_score, DEFAULT_BASE_SCORE));
    setStatMultiplier(
      numberArray(preset.stat_value_multiplier, DEFAULT_STAT_MULTIPLIER),
    );
    setScoreValue(numberMatrix(preset.score_value, DEFAULT_SCORE_VALUE));
    setExtraWeight(numberMatrix(preset.extra_weight, DEFAULT_EXTRA_WEIGHT));
    setNpcScoreValue(numberMatrix(preset.npc_score_value, DEFAULT_NPC_SCORE));
    setCompensateFailure(preset.compensate_failure !== false);
    setSummerScoreThreshold(Number(preset.summer_score_threshold ?? 0.34));
    setMotivationThresholds([
      Number(preset.motivation_threshold_year1 ?? 3),
      Number(preset.motivation_threshold_year2 ?? 4),
      Number(preset.motivation_threshold_year3 ?? 4),
    ]);
    setPrioritizeRecreation(Boolean(preset.prioritize_recreation));
    setPalThresholds(preset.pal_thresholds || []);
    setPalFriendshipScore(
      numberArray(preset.pal_friendship_score, [0.08, 0.057, 0.018]),
    );
    setPalCardMultiplier(Number(preset.pal_card_multiplier ?? 0.1));
    setRestThreshold(Number(preset.rest_threshold ?? 48));
    setScenarioId(1);
    setSelectedRaceIds((preset.extra_race_list || []).map(Number));
  }, [presetName, presets]);

  useEffect(() => {
    if (!selectedAccountId) {
      setSession(null);
      return;
    }
    loadSession(selectedAccountId).catch((caught) =>
      setError((caught as Error).message),
    );
  }, [loadSession, selectedAccountId]);

  useEffect(() => {
    const selectedSetting = careerSettings.find(
      (setting) => setting.id === selectedCareerSettingId,
    );
    if (
      selectedSetting &&
      selectedSetting.account_uid !== selectedAccount?.uid
    ) {
      setSelectedCareerSettingId('');
      setCareerSettingName('');
      setCareerSaveOpen(false);
    }
  }, [careerSettings, selectedAccount?.uid, selectedCareerSettingId]);

  useEffect(() => {
    setSelectedCareerSettingId('');
    setCareerSettingName('');
    setCareerSaveOpen(false);
    setNewCareerSaveName('');
    setCareerHistory([]);
    setSelectedCareerReport(null);
  }, [selectedAccountId]);

  useEffect(() => {
    if (
      activeTab !== 'history' ||
      !selectedAccountId ||
      !selectedAccount?.runtime.logged_in
    ) {
      return;
    }
    loadCareerHistory(selectedAccountId).catch(() => undefined);
  }, [
    activeTab,
    loadCareerHistory,
    selectedAccount?.runtime.logged_in,
    selectedAccountId,
  ]);

  useEffect(() => {
    if (!selectedAccountId || !automationActive) return undefined;
    const timer = window.setInterval(() => {
      loadSession(selectedAccountId).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [automationActive, loadSession, selectedAccountId]);

  useEffect(() => {
    if (!stoppingAccountId) return;
    const account = accounts.find((item) => item.id === stoppingAccountId);
    const accountRunner =
      stoppingAccountId === selectedAccountId
        ? session?.runtime?.runner || account?.runtime.runner
        : account?.runtime.runner;
    if (!accountRunner?.running && !accountRunner?.run_plan?.active) {
      setStoppingAccountId('');
    }
  }, [accounts, selectedAccountId, session, stoppingAccountId]);

  useEffect(() => {
    if (!dashboard) return;
    if (cardId && !dashboard.umas.some((uma) => uma.id === cardId))
      setCardId(0);
    if (
      parent1 &&
      !dashboard.parents.some((parent) => parent.selection_id === parent1)
    ) {
      setParent1('');
    }
    if (
      parent2 &&
      !dashboard.parents.some((parent) => parent.selection_id === parent2)
    ) {
      setParent2('');
    }
    if (
      friendCardId &&
      !dashboard.supports.some((support) => support.id === friendCardId)
    ) {
      setFriendCardId(0);
    }
    if (deckId && !dashboard.decks.some((deck) => deck.id === deckId)) {
      setDeckId(0);
      setSupportCardIds([]);
    }
  }, [cardId, dashboard, deckId, friendCardId, parent1, parent2]);

  const addCredentials = async (credentials: CapturedCredential[]) => {
    if (!credentials.length) return;
    setBusy('credentials');
    setError('');
    try {
      await window.electron.autoResearch.saveAccounts(credentials);
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const addManual = async () => {
    if (!manualUid.trim() || !manualAccessKey.trim()) {
      setError('请填写 uid 和 access_key');
      return;
    }
    await addCredentials([
      {
        uid: manualUid.trim(),
        accessKey: manualAccessKey.trim(),
        source: '手动填写',
        capturedAt: new Date().toISOString(),
      },
    ]);
    setManualUid('');
    setManualAccessKey('');
  };

  const importUsersDb = async (file: File) => {
    setBusy('users-db');
    setError('');
    try {
      const content = await fileToBase64(file);
      await window.electron.autoResearch.importUsersDb(content);
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
      setDragging(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) importUsersDb(file);
  };

  const accountAction = async (
    accountId: string,
    action: 'login' | 'logout' | 'refresh',
  ) => {
    const connectionOperationId =
      action === 'login' || action === 'refresh'
        ? `${action}-${accountId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        : '';
    if (connectionOperationId && activeLoginOperation.current) {
      setError('另一个账号正在登录或刷新，请等待当前操作完成');
      return;
    }
    if (connectionOperationId) {
      activeLoginOperation.current = connectionOperationId;
    }
    setBusy(`${action}-${accountId}`);
    setError('');
    try {
      let result: SessionResponse | null = null;
      const authenticate = async (forceLogin = false, recoveryDetail = '') => {
        const loginId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (activeLoginOperation.current !== connectionOperationId) {
          throw new Error('另一个账号正在登录，请等待当前登录完成');
        }
        const startedAt = Date.now();
        let polling = true;
        setSelectedAccountId(accountId);
        setLoginProgress({
          accountId,
          loginId,
          action: 'login',
          stage: 'queued',
          endpoint: '',
          detail:
            recoveryDetail ||
            (forceLogin ? '登录已过期，正在重新登录' : '正在连接登录服务'),
          delay: 0,
          elapsed: 0,
        });
        const progressTimer = window.setInterval(() => {
          const elapsed = Math.max(
            0,
            Math.floor((Date.now() - startedAt) / 1000),
          );
          setLoginProgress((current) =>
            current?.loginId === loginId ? { ...current, elapsed } : current,
          );
          request<LoginProgressResponse>(
            `/api/auth/login-progress/${encodeURIComponent(loginId)}`,
          )
            .then((progress) => {
              if (!polling || !progress.found) return;
              setLoginProgress((current) =>
                current?.loginId === loginId
                  ? {
                      ...current,
                      stage: progress.stage || current.stage,
                      endpoint: progress.endpoint || '',
                      detail: progress.detail || current.detail,
                      delay: Number(progress.delay || 0),
                      elapsed,
                    }
                  : current,
              );
            })
            .catch(() => undefined);
        }, 500);
        try {
          const credential = (await window.electron.autoResearch.credential(
            accountId,
          )) as { uid: string; accessKey: string };
          const authenticated = await request<AuthResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              uid: credential.uid,
              access_key: credential.accessKey,
              login_id: loginId,
              force_login: forceLogin,
            }),
          });
          sessionTokens.current.set(accountId, authenticated.token);
          return authenticated;
        } finally {
          polling = false;
          window.clearInterval(progressTimer);
          setLoginProgress((current) =>
            current?.loginId === loginId ? null : current,
          );
        }
      };
      if (action === 'login') {
        result = await authenticate(false);
      } else if (action === 'refresh') {
        let relogged = false;
        const accountRunning = Boolean(
          accounts.find((account) => account.id === accountId)?.runtime.runner
            .running,
        );
        const restoreLogin = async (recoveryDetail = '') => {
          try {
            await authenticate(false, recoveryDetail);
          } catch (caught) {
            if (
              !(caught instanceof AutoResearchRequestError) ||
              caught.status !== 401
            ) {
              throw caught;
            }
            await authenticate(true, '登录凭据需要重新验证，正在重新登录');
          }
          relogged = true;
        };
        const refreshStatus = async () => {
          if (accountRunning) {
            return accountRequest<SessionResponse>(
              accountId,
              '/api/account/session',
            );
          }
          const refreshId = `refresh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const startedAt = Date.now();
          let polling = true;
          setLoginProgress({
            accountId,
            loginId: refreshId,
            action: 'refresh',
            stage: 'queued',
            endpoint: '',
            detail: '准备刷新当前账号',
            delay: 0,
            elapsed: 0,
          });
          const progressTimer = window.setInterval(() => {
            const elapsed = Math.max(
              0,
              Math.floor((Date.now() - startedAt) / 1000),
            );
            setLoginProgress((current) =>
              current?.loginId === refreshId
                ? { ...current, elapsed }
                : current,
            );
            request<LoginProgressResponse>(
              `/api/auth/login-progress/${encodeURIComponent(refreshId)}`,
            )
              .then((progress) => {
                if (!polling || !progress.found) return;
                setLoginProgress((current) =>
                  current?.loginId === refreshId
                    ? {
                        ...current,
                        stage: progress.stage || current.stage,
                        endpoint: progress.endpoint || '',
                        detail: progress.detail || current.detail,
                        delay: Number(progress.delay || 0),
                        elapsed,
                      }
                    : current,
                );
              })
              .catch(() => undefined);
          }, 500);
          try {
            return await accountRequest<SessionResponse>(
              accountId,
              '/api/account/refresh',
              {
                method: 'POST',
                body: JSON.stringify({ refresh_id: refreshId }),
              },
            );
          } finally {
            polling = false;
            window.clearInterval(progressTimer);
            setLoginProgress((current) =>
              current?.loginId === refreshId ? null : current,
            );
          }
        };
        if (!sessionTokens.current.has(accountId)) {
          await restoreLogin();
        }
        try {
          result = await refreshStatus();
        } catch (caught) {
          if (!needsRelogin(caught)) throw caught;
          sessionTokens.current.delete(accountId);
          if (
            caught instanceof AutoResearchRequestError &&
            caught.status === 401
          ) {
            try {
              await restoreLogin('服务器会话已失效，正在重新登录后继续刷新');
            } catch (loginError) {
              throw new Error(
                `服务器会话已失效，自动重新登录失败：${(loginError as Error).message}。请在账号页重新登录；如果 access_key 已变化，请先更新账号凭据。`,
              );
            }
          } else {
            await authenticate(true);
            relogged = true;
          }
          try {
            result = await refreshStatus();
          } catch (retryError) {
            if (
              retryError instanceof AutoResearchRequestError &&
              retryError.status === 401
            ) {
              throw new Error(
                '自动重新登录后刷新仍返回 401 Unauthorized。请在账号页重新登录；如果 access_key 已变化，请先更新账号凭据。',
              );
            }
            if (String((retryError as Error)?.message || '').includes('217')) {
              throw new Error(
                '重新登录后仍出现错误码 217，账号可能正在其他位置操作。请稍后再次刷新。',
              );
            }
            throw retryError;
          }
        }
        result.relogged_in = relogged;
      } else {
        await accountRequest(accountId, '/api/auth/logout', {
          method: 'POST',
          body: '{}',
        });
        sessionTokens.current.delete(accountId);
      }
      setSession(result);
      updateRuntime(accountId, result);
      setSelectedAccountId(accountId);
      if (action === 'logout') {
        if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
          localStorage.removeItem(LAST_ACCOUNT_KEY);
        }
      } else if (result?.success) {
        localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      if (activeLoginOperation.current === connectionOperationId) {
        activeLoginOperation.current = '';
      }
      setBusy('');
    }
  };

  accountActionRef.current = accountAction;

  useEffect(() => {
    if (
      !server ||
      !accounts.length ||
      loginProgress ||
      activeLoginOperation.current
    )
      return;
    const accountId = localStorage.getItem(LAST_ACCOUNT_KEY) || '';
    if (!accountId) return;
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      localStorage.removeItem(LAST_ACCOUNT_KEY);
      return;
    }
    setSelectedAccountId(accountId);
    if (account.runtime.logged_in || sessionTokens.current.has(accountId))
      return;
    const attemptKey = `${server}|${accountId}`;
    if (autoLoginAttempted.current === attemptKey) return;
    autoLoginAttempted.current = attemptKey;
    accountActionRef.current?.(accountId, 'login').catch(() => undefined);
  }, [accounts, loginProgress, server]);

  const refreshOptionsIndex = async () => {
    if (!selectedAccountId) return;
    setBusy('options-index');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/options/refresh',
        { method: 'POST', body: '{}' },
      );
      setSession(result);
      updateRuntime(selectedAccountId, result);
    } catch (caught) {
      setError(
        needsRelogin(caught)
          ? '登录会话已失效，请返回账号页重新登录后再刷新 index 数据'
          : (caught as Error).message,
      );
    } finally {
      setBusy('');
    }
  };

  const deleteAccount = async (accountId: string) => {
    setBusy(`delete-${accountId}`);
    try {
      if (sessionTokens.current.has(accountId)) {
        await accountRequest(accountId, '/api/auth/logout', {
          method: 'POST',
          body: '{}',
        }).catch(() => undefined);
        sessionTokens.current.delete(accountId);
      }
      await window.electron.autoResearch.deleteAccount(accountId);
      if (selectedAccountId === accountId) {
        setSelectedAccountId('');
        setSession(null);
      }
      if (localStorage.getItem(LAST_ACCOUNT_KEY) === accountId) {
        localStorage.removeItem(LAST_ACCOUNT_KEY);
      }
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const togglePrioritySkill = (skill: AutoResearchSkill) => {
    const removing = skillPriorityNames.includes(skill.name);
    setSkillSelections((current) => {
      if (!removing) {
        return [
          ...current,
          {
            id: createSkillSelectionId(),
            label: '',
            skill_names: [skill.name],
          },
        ];
      }
      return current
        .map((entry) => ({
          ...entry,
          skill_names: entry.skill_names.filter((name) => name !== skill.name),
        }))
        .filter((entry) => entry.skill_names.length);
    });
    if (removing) {
      setSkillLearningSettings((settings) => {
        const next = { ...settings };
        delete next[skill.name];
        return next;
      });
      if (editingSkillSelection?.skill_names.includes(skill.name)) {
        setEditingSkillSelectionId('');
      }
    }
  };

  const addSkillGroup = (groupSkills: AutoResearchSkill[], label: string) => {
    const selected = new Set(skillPriorityNames);
    const names = Array.from(
      new Set(
        groupSkills
          .map((skill) => skill.name.trim())
          .filter((name) => name && !selected.has(name)),
      ),
    );
    if (!names.length) return;
    setSkillSelections((current) => [
      ...current,
      {
        id: createSkillSelectionId(),
        label: label.trim() || `技能组 ${current.length + 1}`,
        skill_names: names,
      },
    ]);
  };

  const reorderPrioritySkill = (source: string, target: string) => {
    if (!source || !target || source === target) return;
    setSkillSelections((current) => {
      const next = [...current];
      const sourceIndex = next.findIndex((entry) => entry.id === source);
      const targetIndex = next.findIndex((entry) => entry.id === target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, source);
      return next;
    });
  };

  const updateSkillLearningSetting = (
    names: string[],
    update: Partial<SkillLearningSetting>,
  ) => {
    setSkillLearningSettings((current) => {
      const next = { ...current };
      names.forEach((name) => {
        const existing = current[name] || {
          min_hint_level: 0,
          learn_when_affordable: false,
          purchase_turns: [],
        };
        next[name] = {
          ...existing,
          ...update,
        };
      });
      return next;
    });
  };

  const skillSelectionSetting = (entry: SkillSelectionEntry) => {
    const settings = entry.skill_names.map(
      (name) =>
        skillLearningSettings[name] || {
          min_hint_level: 0,
          learn_when_affordable: false,
          purchase_turns: [],
        },
    );
    const first = settings[0];
    const mixed = settings.some(
      (setting) => JSON.stringify(setting) !== JSON.stringify(first),
    );
    return { setting: first, mixed };
  };

  const skillLearningConditionLabel = (entry: SkillSelectionEntry) => {
    const { setting, mixed } = skillSelectionSetting(entry);
    if (mixed) return '组内技能使用了不同的学习条件';
    const normalizedSetting = setting || {
      min_hint_level: 0,
      learn_when_affordable: false,
      purchase_turns: [],
    };
    const parts = [`Hint ≥ ${normalizedSetting.min_hint_level}`];
    if (normalizedSetting.learn_when_affordable) parts.push('PT 足够立即学习');
    if (normalizedSetting.purchase_turns.length) {
      parts.push(
        `独立时间：${normalizedSetting.purchase_turns.map(skillPurchaseTurnLabel).join('、')}`,
      );
    }
    return parts.join(' · ');
  };

  const draftPreset = () => ({
    name: presetName.trim(),
    scenario_id: scenarioId,
    running_style: runningStyle,
    learn_skill_list: skillSelections.map((entry) => entry.skill_names),
    learn_skill_group_labels: skillSelections.map((entry) => entry.label),
    learn_skill_settings: Object.fromEntries(
      skillPriorityNames
        .filter((name) => skillLearningSettings[name])
        .map((name) => [name, skillLearningSettings[name]]),
    ),
    learn_skill_blacklist: [],
    learn_skill_threshold: skillThreshold,
    learn_skill_only_user_provided: true,
    skip_double_circle_unless_high_hint: skipDoubleCircle,
    skill_purchase_turns: normalizeTurnList(skillPurchaseTurns),
    cure_asap_conditions: cureConditions,
    expect_attribute: expectAttribute,
    score_value: scoreValue,
    base_score: baseScore,
    stat_value_multiplier: statMultiplier,
    extra_weight: extraWeight,
    npc_score_value: npcScoreValue,
    compensate_failure: compensateFailure,
    summer_score_threshold: summerScoreThreshold,
    motivation_threshold_year1: motivationThresholds[0],
    motivation_threshold_year2: motivationThresholds[1],
    motivation_threshold_year3: motivationThresholds[2],
    prioritize_recreation: prioritizeRecreation,
    pal_thresholds: palThresholds,
    pal_friendship_score: palFriendshipScore,
    pal_card_multiplier: palCardMultiplier,
    rest_threshold: restThreshold,
    extra_race_list: [...selectedRaceIds].sort((leftId, rightId) => {
      const left = races.find((race) => race.id === leftId);
      const right = races.find((race) => race.id === rightId);
      if (left && right) return compareRaces(left, right);
      if (left) return -1;
      if (right) return 1;
      return leftId - rightId;
    }),
  });

  const runCareer = async (mode: RunMode, target: number) => {
    if (!selectedAccountId || !dashboard) return false;
    if (unsupportedCareer) {
      setError(
        `当前进行中的育成剧本（scenario_id=${dashboard.account.career?.scenario_id}）暂不支持。请在游戏中手动退出本次养马，再刷新账号状态。`,
      );
      return false;
    }
    const active = dashboard.account.career?.active;
    if (active && !canContinueCurrentCareer) {
      setError(
        `当前育成与所选养马详设不一致：${careerConfigDifferences.join('、')}。请选择匹配的详设后继续，或放弃本次育成。`,
      );
      return false;
    }
    if (
      !active &&
      (!cardId || !deckId || !parent1 || !parent2 || !friendCardId)
    ) {
      setError('开始新育成前，请完整选择角色、卡组、好友支援和两位继承马娘');
      return false;
    }
    if (!active && selectionConflict) {
      setError(selectionConflict);
      return false;
    }
    setBusy('run');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/run',
        {
          method: 'POST',
          body: JSON.stringify({
            card_id: effectiveCardId,
            support_card_ids: effectiveSupportCardIds,
            friend_viewer_id: 0,
            friend_card_id: effectiveFriendCardId,
            parent_id_1: effectiveParentId1,
            parent_id_2: effectiveParentId2,
            parent_1_viewer_id:
              selectedParent1?.viewer_id ||
              parentViewerIdFromSelection(effectiveParentKey1),
            parent_2_viewer_id:
              selectedParent2?.viewer_id ||
              parentViewerIdFromSelection(effectiveParentKey2),
            scenario_id: scenarioId,
            deck_id: effectiveDeckId || 1,
            use_tp: 30,
            recover_tp_with_item: recoverTpWithItem,
            recover_tp_with_jewels: recoverTpWithJewels,
            run_mode: mode,
            run_target: target,
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
            preset_name: presetName,
            preset: draftPreset(),
            max_steps: maxSteps,
            burn_clocks: burnClocks,
          }),
        },
      );
      setSession(result);
      updateRuntime(selectedAccountId, result);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const resumeCareerWithSetting = async (
    setting: CareerSetting,
    mode: RunMode,
    target: number,
  ) => {
    if (!selectedAccountId || !activeCareer?.active) return false;
    const preset = presets.find((item) => item.name === setting.preset_name);
    if (!preset) {
      setError(`养马详设使用的预设不存在：${setting.preset_name}`);
      return false;
    }
    if (!careerSettingMatchesCurrent(setting, activeCareer)) {
      setError('当前育成与这个养马详设不一致，请刷新账号后重新选择');
      return false;
    }
    const busyKey = `resume-${setting.id}`;
    const currentDeck = dashboard?.decks.find(
      (deck) => deck.id === setting.deck_id,
    );
    const resumeSupportCardIds =
      activeCareer.support_card_ids?.length === 5
        ? activeCareer.support_card_ids
        : currentDeck?.support_card_ids.length === 5
          ? currentDeck.support_card_ids
          : setting.support_card_ids || [];
    setBusy(busyKey);
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/run',
        {
          method: 'POST',
          body: JSON.stringify({
            card_id: setting.card_id,
            support_card_ids: resumeSupportCardIds,
            friend_viewer_id: 0,
            friend_card_id: setting.friend_card_id,
            parent_id_1: setting.parent_id_1,
            parent_id_2: setting.parent_id_2,
            parent_1_viewer_id: parentViewerIdFromSelection(
              setting.parent_key_1,
            ),
            parent_2_viewer_id: parentViewerIdFromSelection(
              setting.parent_key_2,
            ),
            scenario_id: Number(setting.scenario_id || preset.scenario_id || 1),
            deck_id: setting.deck_id || 1,
            use_tp: 30,
            recover_tp_with_item: setting.recover_tp_with_item,
            recover_tp_with_jewels: setting.recover_tp_with_jewels,
            run_mode: mode,
            run_target: target,
            schedule_start_time: scheduleStartTime,
            schedule_end_time: scheduleEndTime,
            preset_name: setting.preset_name,
            preset,
            max_steps: setting.max_steps || 2500,
            burn_clocks: setting.burn_clocks,
          }),
        },
      );
      setSelectedCareerSettingId(setting.id);
      setCareerSettingName(setting.name);
      setSession(result);
      updateRuntime(selectedAccountId, result);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const stopCareer = async () => {
    if (!selectedAccountId) return;
    const accountId = selectedAccountId;
    setStoppingAccountId(accountId);
    setBusy('stop');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/career/runner/stop',
        {
          method: 'POST',
          body: '{}',
        },
      );
      setSession((current) =>
        current
          ? {
              ...current,
              runner: result.runner || current.runner,
              runtime: {
                ...current.runtime,
                runner: result.runner ||
                  result.runtime?.runner ||
                  current.runtime?.runner || { running: false },
              },
            }
          : current,
      );
      updateRuntime(accountId, result);
      loadSession(accountId).catch(() => undefined);
    } catch (caught) {
      setStoppingAccountId('');
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const releaseSessionWait = async () => {
    if (!selectedAccountId || !runnerSessionWaiting) return;
    const accountId = selectedAccountId;
    setBusy('release-session-wait');
    setError('');
    try {
      const result = await accountRequest<SessionResponse>(
        accountId,
        '/api/account/career/runner/release-wait',
        { method: 'POST', body: '{}' },
      );
      setSession((current) =>
        current
          ? {
              ...current,
              runner: result.runner || current.runner,
              runtime: {
                ...current.runtime,
                runner: result.runner ||
                  result.runtime?.runner ||
                  current.runtime?.runner || { running: false },
              },
            }
          : current,
      );
      updateRuntime(accountId, result);
      loadSession(accountId).catch(() => undefined);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const abandonCareer = async () => {
    if (!selectedAccountId || !dashboard?.account.career?.active) return;
    if (
      !window.confirm('确定放弃当前育成吗？本次育成会立即结束，且无法恢复。')
    ) {
      return;
    }
    setBusy('abandon');
    setError('');
    try {
      if (automationActive) {
        await accountRequest(
          selectedAccountId,
          '/api/account/career/runner/stop',
          { method: 'POST', body: '{}' },
        );
      }
      await accountRequest(selectedAccountId, '/api/account/career/delete', {
        method: 'POST',
        body: JSON.stringify({
          current_turn: runner?.turn ?? dashboard.account.career.turn ?? 1,
        }),
      });
      await loadSession(selectedAccountId);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const savePreset = async () => {
    if (
      !presetEditorOpen ||
      !presets.some((preset) => preset.name === presetName)
    ) {
      setError('请先从预设槽位界面选择一个预设');
      return false;
    }
    setPresetSaved(false);
    setBusy('preset');
    try {
      const preset = draftPreset();
      const nextPresets = presets.map((item) =>
        item.name === preset.name ? preset : item,
      );
      setPresets(nextPresets);
      setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
      const deletedPresetNames = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      ) as string[];
      setSharedStorageItem(
        DELETED_PRESETS_KEY,
        JSON.stringify(
          deletedPresetNames.filter((name) => name !== preset.name),
        ),
      );
      setError('');
      setPresetSaved(true);
      if (presetSaveFeedbackTimer.current !== null) {
        window.clearTimeout(presetSaveFeedbackTimer.current);
      }
      presetSaveFeedbackTimer.current = window.setTimeout(() => {
        setPresetSaved(false);
        presetSaveFeedbackTimer.current = null;
      }, 1800);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const exportPreset = (preset: Preset) => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'umashow-autoresearch-preset',
            version: 1,
            preset,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${preset.name.replace(/[<>:"/\\|?*]+/g, '_') || '预设'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      const raw = parsed?.preset ?? parsed;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('文件中没有可用的预设数据');
      }
      const requestedName = String(
        raw.name || file.name.replace(/\.json$/i, ''),
      ).trim();
      const baseName = requestedName || '导入预设';
      let name = baseName;
      let suffix = 2;
      const existingNames = new Set(presets.map((preset) => preset.name));
      while (existingNames.has(name)) {
        name = `${baseName} (${suffix})`;
        suffix += 1;
      }
      const importedPreset: Preset = {
        ...createDefaultPreset(name),
        ...(raw as Partial<Preset>),
        name,
        scenario_id: 1,
      };
      const nextPresets = [...presets, importedPreset];
      setPresets(nextPresets);
      setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
      setPresetName(name);
      setPresetEditorOpen(true);
      setPresetSaved(false);
      setError('');
    } catch (caught) {
      setError(`预设导入失败：${(caught as Error).message}`);
    }
  };

  const navigateToTab = (tab: AutoResearchTab, target?: string) => {
    if (tab === 'presets') {
      if (target) {
        const selectedName = presets.some(
          (preset) => preset.name === presetName,
        )
          ? presetName
          : DEFAULT_PRESET_NAME;
        setPresetName(selectedName);
        setPresetEditorOpen(true);
      } else {
        setPresetEditorOpen(false);
      }
    }
    setActiveTab(tab);
    if (target) {
      window.setTimeout(() => scrollToSection(target), 0);
    }
  };

  const savePresetAndContinue = async () => {
    if (await savePreset()) {
      navigateToTab('career', 'career-task');
    }
  };

  const openPresetEditor = (name: string) => {
    if (!presets.some((preset) => preset.name === name)) return;
    setPresetName(name);
    setPresetEditorOpen(true);
    setPresetSaved(false);
    setError('');
  };

  const createPresetSlot = () => {
    const name = newPresetName.trim();
    if (!name) {
      setError('请先填写新预设名称');
      return;
    }
    if (presets.some((preset) => preset.name === name)) {
      setError(`预设“${name}”已经存在`);
      return;
    }
    const nextPresets = [...presets, createDefaultPreset(name)];
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(deletedPresetNames.filter((item) => item !== name)),
    );
    setPresetName(name);
    setPresetEditorOpen(true);
    setPresetSaved(false);
    setNewPresetName('');
    setError('');
  };

  const renamePreset = (currentName: string, nextName: string) => {
    const name = nextName.trim();
    if (currentName === DEFAULT_PRESET_NAME) return true;
    if (!name) {
      setError('预设名称不能为空');
      return false;
    }
    if (name === currentName) return true;
    if (presets.some((preset) => preset.name === name)) {
      setError(`预设“${name}”已经存在`);
      return false;
    }
    const nextPresets = presets.map((preset) =>
      preset.name === currentName ? { ...preset, name } : preset,
    );
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));

    const nextCareerSettings = careerSettings.map((setting) =>
      setting.preset_name === currentName
        ? { ...setting, preset_name: name }
        : setting,
    );
    setCareerSettings(nextCareerSettings);
    setSharedStorageItem(
      CAREER_SETTINGS_KEY,
      JSON.stringify(nextCareerSettings),
    );

    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(
        Array.from(
          new Set([
            ...deletedPresetNames.filter((item) => item !== name),
            currentName,
          ]),
        ),
      ),
    );
    if (presetName === currentName) setPresetName(name);
    setError('');
    return true;
  };

  const deletePreset = (requestedName = presetName) => {
    const name = requestedName.trim();
    if (!name) return;
    if (name === DEFAULT_PRESET_NAME) {
      setError('默认预设用于兜底，不能删除');
      return;
    }
    const referencedSettings = careerSettings.filter(
      (setting) => setting.preset_name === name,
    );
    if (referencedSettings.length) {
      setError(
        `“${name}”仍被 ${referencedSettings.length} 个养马详设使用。请先到“自动育成”中删除这些详设。`,
      );
      return;
    }
    if (!window.confirm(`确定删除预设“${name}”吗？`)) return;
    const nextPresets = presets.filter((preset) => preset.name !== name);
    setPresets(nextPresets);
    setSharedStorageItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        getSharedStorageItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    setSharedStorageItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(Array.from(new Set([...deletedPresetNames, name]))),
    );
    setPresetName(DEFAULT_PRESET_NAME);
    setPresetEditorOpen(false);
    setError('');
  };

  const persistCareerSettings = (nextSettings: CareerSetting[]) => {
    setCareerSettings(nextSettings);
    setSharedStorageItem(CAREER_SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  const applyCareerSetting = (settingId: string) => {
    setSelectedCareerSettingId(settingId);
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) return;
    setCareerSettingName(setting.name);
    setPresetName(setting.preset_name);
    setCardId(setting.card_id);
    setDeckId(setting.deck_id);
    setSupportCardIds(setting.support_card_ids || []);
    setFriendCardId(
      setting.friend_card_id ||
        Number(setting.friend_key?.split(':').pop()) ||
        0,
    );
    setParent1(
      setting.parent_key_1 ||
        dashboard?.parents.find(
          (parent) =>
            parent.source === 'own' &&
            parent.instance_id === setting.parent_id_1,
        )?.selection_id ||
        '',
    );
    setParent2(
      setting.parent_key_2 ||
        dashboard?.parents.find(
          (parent) =>
            parent.source === 'own' &&
            parent.instance_id === setting.parent_id_2,
        )?.selection_id ||
        '',
    );
    setMaxSteps(setting.max_steps || 2500);
    setBurnClocks(Boolean(setting.burn_clocks));
    setRecoverTpWithItem(Boolean(setting.recover_tp_with_item));
    setRecoverTpWithJewels(Boolean(setting.recover_tp_with_jewels));
    setCareerSaveOpen(true);
  };

  const createCareerSave = () => {
    const name = newCareerSaveName.trim();
    if (!name) {
      setError('请先填写新详设名称');
      return;
    }
    setSelectedCareerSettingId('');
    setCareerSettingName(name);
    setCardId(0);
    setDeckId(0);
    setSupportCardIds([]);
    setFriendCardId(0);
    setParent1('');
    setParent2('');
    setParentSelectionSlot(1);
    setPresetName(presets[0]?.name || '');
    setMaxSteps(2500);
    setBurnClocks(false);
    setRecoverTpWithItem(false);
    setRecoverTpWithJewels(false);
    setCareerSaveOpen(true);
    setNewCareerSaveName('');
    setError('');
  };

  const renameCareerSetting = (settingId: string, nextName: string) => {
    const name = nextName.trim();
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting || !name || name === setting.name) return;
    persistCareerSettings(
      careerSettings.map((item) =>
        item.id === settingId ? { ...item, name } : item,
      ),
    );
    if (selectedCareerSettingId === settingId) setCareerSettingName(name);
    setError('');
  };

  const saveCareerSetting = () => {
    if (!selectedAccount || !dashboard) return false;
    const name = careerSettingName.trim();
    if (!name) {
      setError('养马详设名称不能为空，请返回详设界面修改');
      return false;
    }
    if (!presetName || !presets.some((preset) => preset.name === presetName)) {
      setError('请选择一个已保存的预设');
      return false;
    }
    if (
      !effectiveCardId ||
      !effectiveDeckId ||
      !effectiveFriendCardId ||
      !effectiveParentId1 ||
      !effectiveParentId2
    ) {
      setError('请先完整选择育成马娘、卡组、好友支援和两位继承马娘');
      return false;
    }
    if (!continuingCurrentCareer && selectionConflict) {
      setError(selectionConflict);
      return false;
    }
    const existing = careerSettings.find(
      (setting) => setting.id === selectedCareerSettingId,
    );
    const setting: CareerSetting = {
      id: existing?.id || `${selectedAccount.uid}-${Date.now()}`,
      name,
      account_uid: selectedAccount.uid,
      preset_name: presetName,
      card_id: effectiveCardId,
      deck_id: effectiveDeckId,
      support_card_ids: [...effectiveSupportCardIds],
      friend_card_id: effectiveFriendCardId,
      parent_id_1: effectiveParentId1,
      parent_id_2: effectiveParentId2,
      parent_key_1: effectiveParentKey1,
      parent_key_2: effectiveParentKey2,
      scenario_id: scenarioId,
      max_steps: maxSteps,
      burn_clocks: burnClocks,
      recover_tp_with_item: recoverTpWithItem,
      recover_tp_with_jewels: recoverTpWithJewels,
      updated_at: new Date().toISOString(),
    };
    const nextSettings = [
      setting,
      ...careerSettings.filter((item) => item.id !== setting.id),
    ];
    persistCareerSettings(nextSettings);
    setSelectedCareerSettingId(setting.id);
    setError('');
    return true;
  };

  const saveAndRunCareer = () => {
    if (!saveCareerSetting()) return;
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '23:59');
    setPendingRun({ type: 'current' });
    setRunDialogOpen(true);
  };

  const openSavedRunDialog = (settingId: string) => {
    setScheduleStartTime(dailyJewelSchedule?.start_time || '05:00');
    setScheduleEndTime(dailyJewelSchedule?.end_time || '23:59');
    setPendingRun({ type: 'saved', settingId });
    setRunDialogOpen(true);
    setError('');
  };

  const confirmRunPlan = async () => {
    if (!pendingRun) return;
    if (
      runMode === 'daily_jewel_schedule' &&
      scheduleStartTime >= scheduleEndTime
    ) {
      setError('每日结束时间必须晚于启动时间');
      return;
    }
    const target =
      runMode === 'daily_count'
        ? Math.max(1, dailyRunTarget)
        : runMode === 'jewel_drops' || runMode === 'daily_jewel_schedule'
          ? Math.max(1, jewelDropTarget)
          : 1;
    let started = false;
    if (pendingRun.type === 'saved') {
      const setting = careerSettings.find(
        (item) => item.id === pendingRun.settingId,
      );
      if (!setting) {
        setError('所选养马详设不存在');
        return;
      }
      started = await resumeCareerWithSetting(setting, runMode, target);
    } else {
      started = await runCareer(runMode, target);
    }
    if (started) {
      setRunDialogOpen(false);
      setPendingRun(null);
      navigateToTab('progress');
    }
  };

  const deleteCareerSetting = (settingId: string) => {
    const setting = careerSettings.find((item) => item.id === settingId);
    if (!setting) return;
    if (!window.confirm(`确定删除养马详设“${setting.name}”吗？`)) return;
    persistCareerSettings(
      careerSettings.filter((item) => item.id !== setting.id),
    );
    if (selectedCareerSettingId === setting.id) {
      setSelectedCareerSettingId('');
      setCareerSettingName('');
      setCareerSaveOpen(false);
    }
    setError('');
  };

  if (!server) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-600">
            <Server size={30} />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                连接 UmaAutoResearch
              </h1>
              <p className="text-sm text-slate-500">
                UmaAutoResearch实现暂不开源
              </p>
            </div>
          </div>
          <label
            className="mt-8 block text-sm font-semibold text-slate-700"
            htmlFor="auto-server"
          >
            服务器地址
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="auto-server"
              value={serverAddress}
              onChange={(event) => setServerAddress(event.target.value)}
              onKeyDown={(event) =>
                event.key === 'Enter' && connect().catch(() => undefined)
              }
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-indigo-400"
              placeholder={DEFAULT_SERVER}
            />
            <button
              type="button"
              onClick={() => connect().catch(() => undefined)}
              disabled={busy === 'connect'}
              className="rounded-md bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy === 'connect' ? '连接中…' : '连接'}
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 text-gray-800 xl:px-6">
      {editingSkillSelection ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${editingSkillSelection.label || editingSkillSelection.skill_names[0]}的学习设置`}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-slate-900">
                  {editingSkillSelection.label ||
                    editingSkillSelection.skill_names[0]}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingSkillSelection.skill_names.length > 1
                    ? `这组设置会应用到其中 ${editingSkillSelection.skill_names.length} 个技能。`
                    : '单独设置这个技能的学习条件。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSkillSelectionId('')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                完成
              </button>
            </div>
            {(() => {
              const { setting } = skillSelectionSetting(editingSkillSelection);
              return (
                <div className="max-h-[75vh] overflow-y-auto p-4">
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                    <label className="flex items-center justify-between gap-4 px-3 py-3 text-sm text-slate-700">
                      <span>
                        <strong className="block font-medium text-slate-800">
                          最低学习 Hint 等级
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          当前 Hint 低于此等级时不会学习
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        step={1}
                        value={setting.min_hint_level}
                        onChange={(event) =>
                          updateSkillLearningSetting(
                            editingSkillSelection.skill_names,
                            {
                              min_hint_level: Math.max(
                                0,
                                Math.min(
                                  5,
                                  Math.trunc(Number(event.target.value) || 0),
                                ),
                              ),
                            },
                          )
                        }
                        className="w-20 rounded-md border border-slate-200 px-3 py-2 text-center"
                      />
                    </label>
                    <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={setting.learn_when_affordable}
                        onChange={(event) =>
                          updateSkillLearningSetting(
                            editingSkillSelection.skill_names,
                            {
                              learn_when_affordable: event.target.checked,
                            },
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        <strong className="block font-medium text-slate-800">
                          PT 足够就学
                        </strong>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          不等待购买时间，也不受技能点购买阈值限制
                        </span>
                      </span>
                    </label>
                  </div>

                  <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          指定学习时间
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          未选择时使用预设中的统一购买技能时间
                        </p>
                      </div>
                      {setting.purchase_turns.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateSkillLearningSetting(
                              editingSkillSelection.skill_names,
                              { purchase_turns: [] },
                            )
                          }
                          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                        >
                          改用统一时间
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                      {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
                        <button
                          key={year.offset}
                          type="button"
                          onClick={() => setSkillSettingYearOffset(year.offset)}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                            skillSettingYearOffset === year.offset
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {year.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                      {MONTH_OPTIONS.map((month) => (
                        <div
                          key={month}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                        >
                          <p className="mb-1 text-center text-[11px] font-medium text-slate-500">
                            {month}月
                          </p>
                          <div className="grid grid-cols-2 gap-1">
                            {([1, 2] as const).map((half) => {
                              const turn = skillPurchaseTurn(
                                skillSettingYearOffset,
                                month,
                                half,
                              );
                              const selected =
                                setting.purchase_turns.includes(turn);
                              return (
                                <button
                                  key={half}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() =>
                                    updateSkillLearningSetting(
                                      editingSkillSelection.skill_names,
                                      {
                                        purchase_turns: selected
                                          ? setting.purchase_turns.filter(
                                              (value) => value !== turn,
                                            )
                                          : [
                                              ...setting.purchase_turns,
                                              turn,
                                            ].sort(
                                              (left, right) => left - right,
                                            ),
                                      },
                                    )
                                  }
                                  className={`rounded px-1 py-1 text-[11px] font-medium ${
                                    selected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                                  }`}
                                >
                                  {half === 1 ? '上' : '下'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                      {setting.purchase_turns.map((turn) => (
                        <button
                          key={turn}
                          type="button"
                          onClick={() =>
                            updateSkillLearningSetting(
                              editingSkillSelection.skill_names,
                              {
                                purchase_turns: setting.purchase_turns.filter(
                                  (value) => value !== turn,
                                ),
                              },
                            )
                          }
                          title="点击移除"
                          className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          {skillPurchaseTurnLabel(turn)} ×
                        </button>
                      ))}
                      {!setting.purchase_turns.length ? (
                        <span className="py-1 text-xs text-slate-400">
                          当前使用统一购买技能时间
                        </span>
                      ) : null}
                    </div>
                  </section>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
      {runDialogOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="选择自动育成运行方式"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">选择运行方式</h3>
              <p className="mt-1 text-sm text-slate-500">
                本次选择只控制如何连续运行，不会写入养马详设。
              </p>
            </div>
            <div className="p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    id: 'single' as const,
                    title: '单次运行',
                    detail: '完成当前这一次育成后停止。',
                    icon: Play,
                  },
                  {
                    id: 'continuous' as const,
                    title: '持续运行',
                    detail:
                      '每次育成结束后自动开始下一次，直到手动停止或无法继续。',
                    icon: RefreshCw,
                  },
                  {
                    id: 'daily_count' as const,
                    title: '每日运行次数',
                    detail: `限制这个账号今天完成的育成次数；今日已完成 ${dailyRunCount} 次。`,
                    icon: ListChecks,
                  },
                  {
                    id: 'jewel_drops' as const,
                    title: '完成宝石掉落',
                    detail: `从现在起累计指定次数的宝石掉落；本周期还可掉落 ${remainingJewelDrops} 次。`,
                    icon: Gem,
                  },
                  {
                    id: 'daily_jewel_schedule' as const,
                    title: '每日宝石计划',
                    detail:
                      '每天在指定时间段内自动运行，达到每日目标或结束时间后停止。',
                    icon: Gem,
                  },
                ].map((option) => {
                  const IconComponent = option.icon;
                  const disabled =
                    (option.id === 'jewel_drops' && remainingJewelDrops <= 0) ||
                    (option.id === 'daily_count' && dailyRunCount >= 100);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setRunMode(option.id);
                        if (option.id === 'daily_count') {
                          setDailyRunTarget((current) =>
                            Math.max(current, dailyRunCount + 1),
                          );
                        } else if (option.id === 'jewel_drops') {
                          setJewelDropTarget(
                            Math.max(1, Math.min(20, remainingJewelDrops)),
                          );
                        } else if (option.id === 'daily_jewel_schedule') {
                          setJewelDropTarget(dailyJewelSchedule?.target || 20);
                        }
                      }}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        runMode === option.id
                          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                      }`}
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                        <IconComponent size={18} />
                      </span>
                      <span>
                        <strong className="block text-sm font-semibold text-slate-800">
                          {option.title}
                        </strong>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {option.detail}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {runMode === 'daily_count' ? (
                <label className="mt-4 block rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  今日总计完成
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={Math.min(100, dailyRunCount + 1)}
                      max={100}
                      value={dailyRunTarget}
                      onChange={(event) =>
                        setDailyRunTarget(
                          Math.max(
                            Math.min(100, dailyRunCount + 1),
                            Math.min(100, Number(event.target.value)),
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold"
                    />
                    <span className="text-slate-500">次育成</span>
                  </div>
                  <span className="mt-2 block text-xs text-slate-500">
                    次数按账号和日期持久化。今天已经完成的育成也会计入上限。
                  </span>
                </label>
              ) : null}

              {runMode === 'jewel_drops' ? (
                <label className="mt-4 block rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
                  从现在起完成
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, remainingJewelDrops)}
                      value={jewelDropTarget}
                      onChange={(event) =>
                        setJewelDropTarget(
                          Math.max(
                            1,
                            Math.min(
                              Math.max(1, remainingJewelDrops),
                              Number(event.target.value),
                            ),
                          ),
                        )
                      }
                      className="w-28 rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                    />
                    <span className="text-violet-700">次宝石掉落</span>
                  </div>
                  <span className="mt-2 block text-xs text-violet-600">
                    达到目标后会在当前比赛结束处停止，未完成的育成之后可以继续。
                  </span>
                </label>
              ) : null}

              {runMode === 'daily_jewel_schedule' ? (
                <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      每日掉落目标
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={jewelDropTarget}
                          onChange={(event) =>
                            setJewelDropTarget(
                              Math.max(
                                1,
                                Math.min(20, Number(event.target.value)),
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                        />
                        <span className="whitespace-nowrap text-violet-700">
                          次
                        </span>
                      </div>
                    </label>
                    <label>
                      每日启动时间
                      <input
                        type="time"
                        value={scheduleStartTime}
                        onChange={(event) =>
                          setScheduleStartTime(event.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                      />
                    </label>
                    <label>
                      每日结束时间
                      <input
                        type="time"
                        value={scheduleEndTime}
                        onChange={(event) =>
                          setScheduleEndTime(event.target.value)
                        }
                        className="mt-2 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-violet-700">
                    时间使用北京时间。位于时间段内会立即开始；到达结束时间会停止当前自动操作，第二天到启动时间后继续。
                  </p>
                </section>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => {
                  setRunDialogOpen(false);
                  setPendingRun(null);
                }}
                disabled={Boolean(busy)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmRunPlan}
                disabled={
                  Boolean(busy) ||
                  (runMode === 'jewel_drops' && remainingJewelDrops <= 0) ||
                  (runMode === 'daily_count' && dailyRunCount >= 100)
                }
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Play size={16} />
                {busy ? '正在启动…' : '开始运行'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SkillSelector
        open={skillPickerOpen}
        title="选择育成中学习的技能"
        description="只会学习这里选择的技能；新技能添加到队列末尾，可拖动调整购买顺序。"
        skills={skills}
        selectedNames={skillPriorityNames}
        blockedNames={[]}
        onToggle={togglePrioritySkill}
        onAddGroup={addSkillGroup}
        onClose={() => setSkillPickerOpen(false)}
      />
      <div className="mx-auto max-w-none space-y-4">
        <header className="flex min-h-[60px] flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <Activity size={24} />
              <h1 className="text-xl font-semibold text-gray-800">自动育成</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {server} · 游戏版本 {health?.app_ver} · 当前服务器允许运行上限{' '}
              {health?.max_accounts}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                selectedAccountId && accountAction(selectedAccountId, 'refresh')
              }
              disabled={
                !selectedAccountId || busy === `refresh-${selectedAccountId}`
              }
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`mr-1 inline ${busy === `refresh-${selectedAccountId}` ? 'animate-spin' : ''}`}
                size={15}
              />
              {busy === `refresh-${selectedAccountId}`
                ? '刷新中…'
                : automationActive
                  ? '刷新养马进度'
                  : '刷新当前账号'}
            </button>
            <button
              type="button"
              onClick={() => {
                setServer('');
                setHealth(null);
              }}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              更换服务器
            </button>
          </div>
        </header>

        <div className={`${panelClass('px-3')} sticky top-0 z-30 shadow-sm`}>
          <nav
            className="-mb-px flex space-x-8 overflow-x-auto"
            aria-label="自动育成设置"
          >
            {[
              { id: 'accounts' as const, label: '账号', icon: Users },
              { id: 'presets' as const, label: '预设', icon: Settings2 },
              { id: 'career' as const, label: '详设', icon: ListChecks },
              { id: 'progress' as const, label: '当前养马', icon: Activity },
              { id: 'history' as const, label: '养马记录', icon: History },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateToTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-150 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <IconComponent size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {loginProgress ? (
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <div className="flex items-center gap-2 font-semibold">
              <RefreshCw className="animate-spin" size={15} />
              {loginProgress.action === 'refresh'
                ? '正在刷新当前账号'
                : '登录中'}{' '}
              · {loginProgress.elapsed}s
            </div>
            <p className="mt-1">
              {loginProgress.detail}
              {loginProgress.endpoint ? ` · ${loginProgress.endpoint}` : ''}
              {loginProgress.delay > 0
                ? ` · 本阶段等待约 ${loginProgress.delay.toFixed(3)}s`
                : ''}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cyan-100">
              <div
                className="h-full rounded-full bg-cyan-500 transition-[width] duration-300"
                style={{ width: `${accountProgressPercent(loginProgress)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-cyan-700">
              {loginProgress.action === 'refresh'
                ? '等待全部账号接口完成后才会更新页面，请勿重复点击刷新。'
                : '接口包含模拟操作间隔，请勿重复点击登录。'}
            </p>
          </div>
        ) : null}

        <div
          className={`grid gap-4 ${
            activeTab === 'accounts'
              ? 'xl:grid-cols-[390px_minmax(0,1fr)]'
              : 'grid-cols-1'
          }`}
        >
          <aside className={activeTab === 'accounts' ? 'space-y-4' : 'hidden'}>
            <section className={panelClass('p-4')}>
              <h2 className="flex items-center gap-2 font-bold">
                <Plus size={18} />
                添加账号
              </h2>
              {captured.length ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                  UmaShow 已捕获并持久化 {captured.length} 个登录凭据。
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-700">
                  方法一：导入 users.db
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  可以拖入文件，也可以手动选择文件。
                </p>
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-2 rounded-xl border-2 border-dashed p-4 text-center text-sm ${
                    dragging
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200'
                  }`}
                >
                  <Database className="mx-auto mb-2 text-slate-400" size={24} />
                  <p>拖入手机导出的 users.db</p>
                  <p className="mt-1 text-xs text-slate-400">
                    /data/user/0/com.bilibili.umamusu/databases/
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50">
                    <Upload className="mr-1" size={14} />
                    选择文件
                    <input
                      type="file"
                      accept=".db,application/x-sqlite3"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) importUsersDb(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-700">
                  方法二：手动填写
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  直接填写账号的 UID 和 access_key。
                </p>
                <div className="mt-2 grid gap-2">
                  <input
                    value={manualUid}
                    onChange={(event) => setManualUid(event.target.value)}
                    placeholder="uid"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={manualAccessKey}
                    onChange={(event) => setManualAccessKey(event.target.value)}
                    placeholder="access_key"
                    type="password"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addManual}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    手动添加
                  </button>
                </div>
              </div>
            </section>

            <section className={panelClass('p-4')}>
              <h2 className="flex items-center gap-2 font-bold">
                <Users size={18} />
                账号列表
              </h2>
              <div className="mt-3 space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedAccountId === account.id
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {account.label || `UID ${account.uid}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {account.uid} · {account.accessKeyPreview}
                        </p>
                        {account.runtime.last_refreshed_at ? (
                          <p className="mt-0.5 text-xs text-slate-400">
                            上次完整刷新：
                            {new Date(
                              account.runtime.last_refreshed_at,
                            ).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${account.runtime.logged_in ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {loginProgress?.accountId === account.id
                          ? loginProgress.action === 'refresh'
                            ? '刷新中'
                            : '登录中'
                          : account.runtime.logged_in
                            ? '已登录'
                            : '离线'}
                      </span>
                    </button>
                    <div className="mt-3 flex gap-1">
                      {account.runtime.logged_in ? (
                        <>
                          <button
                            type="button"
                            onClick={() => accountAction(account.id, 'refresh')}
                            disabled={
                              Boolean(loginProgress) ||
                              busy === `refresh-${account.id}`
                            }
                            className="rounded-lg bg-white px-2 py-1 text-xs disabled:opacity-50"
                          >
                            <RefreshCw
                              className={`mr-1 inline ${busy === `refresh-${account.id}` ? 'animate-spin' : ''}`}
                              size={12}
                            />
                            {busy === `refresh-${account.id}`
                              ? '刷新中'
                              : '刷新状态'}
                          </button>
                          <button
                            type="button"
                            onClick={() => accountAction(account.id, 'logout')}
                            className="rounded-lg bg-white px-2 py-1 text-xs"
                          >
                            <LogOut className="mr-1 inline" size={12} />
                            退出
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => accountAction(account.id, 'login')}
                          disabled={Boolean(loginProgress)}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <LogIn className="mr-1 inline" size={12} />
                          {loginProgress?.accountId === account.id
                            ? `登录中 ${loginProgress.elapsed}s`
                            : loginProgress
                              ? '等待登录'
                              : '登录'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteAccount(account.id)}
                        className="ml-auto rounded-lg bg-white px-2 py-1 text-xs text-red-600"
                      >
                        <Trash2 className="inline" size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {!accounts.length ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    还没有账号
                  </p>
                ) : null}
              </div>
            </section>
          </aside>

          <main className="space-y-4 min-w-0">
            {activeTab !== 'presets' && !selectedAccount ? (
              <section
                className={panelClass('p-12 text-center text-slate-400')}
              >
                <p>请先选择要使用的账号。</p>
              </section>
            ) : activeTab !== 'presets' &&
              (!selectedAccount?.runtime.logged_in || !dashboard) ? (
              <section className={panelClass('p-12 text-center')}>
                <LogIn className="mx-auto text-slate-300" size={42} />
                <p className="mt-3 text-slate-500">
                  登录后可读取角色、卡组和育成状态。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      selectedAccount &&
                      accountAction(selectedAccount.id, 'login')
                    }
                    disabled={Boolean(loginProgress)}
                    className="rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                  >
                    {loginProgress?.accountId === selectedAccount?.id
                      ? `登录中 ${loginProgress?.elapsed || 0}s · ${loginProgress?.detail || '正在连接登录服务'}`
                      : loginProgress
                        ? '请等待其他账号登录完成'
                        : '登录账号'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('presets', 'preset-basic')}
                    className="rounded-md border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    先配置预设
                  </button>
                </div>
              </section>
            ) : (
              <>
                {dashboard && activeTab === 'accounts' ? (
                  <>
                    <section
                      className={`${panelClass('p-4')} grid gap-3 sm:grid-cols-2 lg:grid-cols-6`}
                    >
                      {[
                        [
                          'TP',
                          `${dashboard.account.tp.current}/${dashboard.account.tp.max}`,
                        ],
                        ['萝卜', dashboard.account.carrots.total],
                        ['金币', dashboard.account.gold],
                        ['闹钟', dashboard.account.clocks],
                        ['能量饮料30', dashboard.account.energy_drinks || 0],
                        [
                          '育成',
                          dashboard.account.career?.active
                            ? `${dashboard.account.career.name} T${dashboard.account.career.turn}`
                            : '无',
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <p className="text-xs text-slate-400">{label}</p>
                          <p className="mt-1 truncate font-bold">{value}</p>
                        </div>
                      ))}
                    </section>
                    <section
                      className={`${panelClass('p-4')} flex flex-wrap items-center justify-between gap-3`}
                    >
                      <div>
                        <h2 className="font-bold">账号已经准备好</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          {presets.length
                            ? '接下来可以编辑预设，或进入养马详设选择阵容。'
                            : '开始养马前需要先创建一个预设。'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigateToTab('presets')}
                          className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          选择预设
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            automationActive
                              ? navigateToTab('progress')
                              : navigateToTab('career', 'career-task')
                          }
                          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          {automationActive ? '查看养马进度' : '前往养马详设'}
                        </button>
                      </div>
                    </section>
                  </>
                ) : null}

                {activeTab === 'career' && unsupportedCareer ? (
                  <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
                    <h2 className="font-bold">当前养马暂时无法接管</h2>
                    <p className="mt-1 text-sm">
                      检测到进行中的剧本为 scenario_id=
                      {dashboard.account.career?.scenario_id}，目前只支持 URA。
                      请进入游戏手动退出这次养马，然后点击左侧“刷新”。
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigateToTab('progress')}
                        className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
                      >
                        查看当前进度
                      </button>
                    </div>
                  </section>
                ) : null}

                {activeTab === 'presets' ? (
                  !presetEditorOpen ? (
                    <section className={panelClass('p-5')}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="flex items-center gap-2 text-lg font-bold">
                            <Settings2 size={19} className="text-indigo-600" />
                            选择预设槽位
                          </h2>
                          <p className="mt-1 text-sm text-gray-500">
                            选择已有预设后才能编辑，也可以导入其他玩家分享的预设。
                          </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                          <Upload size={15} />
                          导入预设
                          <input
                            type="file"
                            accept=".json,application/json"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) importPreset(file);
                              event.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {presets.map((preset) => {
                          const isDefault = preset.name === DEFAULT_PRESET_NAME;
                          const referencedCount = careerSettings.filter(
                            (setting) => setting.preset_name === preset.name,
                          ).length;
                          const skillCount = (
                            preset.learn_skill_list || []
                          ).flat().length;
                          return (
                            <article
                              key={preset.name}
                              className="rounded-lg border border-gray-200 bg-gray-50/60 p-3"
                            >
                              <div className="flex items-start gap-3">
                                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                                  <Settings2 size={22} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  {isDefault ? (
                                    <div>
                                      <p className="truncate font-semibold text-gray-800">
                                        {preset.name}
                                      </p>
                                      <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                                        默认预设
                                      </span>
                                    </div>
                                  ) : (
                                    <label className="block text-xs text-gray-500">
                                      预设名称
                                      <input
                                        key={preset.name}
                                        defaultValue={preset.name}
                                        onBlur={(event) => {
                                          if (
                                            !renamePreset(
                                              preset.name,
                                              event.target.value,
                                            )
                                          ) {
                                            event.currentTarget.value =
                                              preset.name;
                                          }
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.currentTarget.blur();
                                          }
                                        }}
                                        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-800"
                                      />
                                    </label>
                                  )}
                                  <p className="mt-2 text-xs text-gray-500">
                                    URA · {skillCount} 个优先技能 ·{' '}
                                    {(preset.extra_race_list || []).length}{' '}
                                    场额外赛事
                                  </p>
                                  {referencedCount ? (
                                    <p className="mt-1 text-xs text-slate-400">
                                      被 {referencedCount} 个养马详设使用
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openPresetEditor(preset.name)}
                                  className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                                >
                                  进入预设
                                </button>
                                <button
                                  type="button"
                                  onClick={() => exportPreset(preset)}
                                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-600 hover:bg-gray-50"
                                  aria-label={`导出预设${preset.name}`}
                                  title="导出预设"
                                >
                                  <Download size={15} />
                                </button>
                                {!isDefault ? (
                                  <button
                                    type="button"
                                    onClick={() => deletePreset(preset.name)}
                                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                    aria-label={`删除预设${preset.name}`}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}

                        <article className="rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4">
                          <h3 className="font-semibold text-indigo-950">
                            新建预设槽位
                          </h3>
                          <p className="mt-1 text-xs text-indigo-700">
                            新预设会使用默认配置，进入后再调整技能、训练和赛事策略。
                          </p>
                          <input
                            value={newPresetName}
                            onChange={(event) =>
                              setNewPresetName(event.target.value)
                            }
                            onKeyDown={(event) =>
                              event.key === 'Enter' && createPresetSlot()
                            }
                            placeholder={`例如：URA 预设 ${presets.length}`}
                            className="mt-4 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={createPresetSlot}
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
                          ['preset-basic', '基础设置'],
                          ['preset-skills', '技能设置'],
                          ['preset-training', '训练策略'],
                          ['preset-races', '额外赛事'],
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
                      <section
                        id="preset-basic"
                        className={`${panelClass('p-5')} scroll-mt-28`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold">
                              预设编辑 · {presetName}
                            </h2>
                            <p className="text-sm text-slate-400">
                              技能和赛事数据来自当前 master.mdb。
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPresetEditorOpen(false)}
                              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                              返回预设槽位
                            </button>
                            <button
                              type="button"
                              onClick={savePreset}
                              disabled={busy === 'preset'}
                              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                                presetSaved
                                  ? 'bg-emerald-600 hover:bg-emerald-600'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {presetSaved ? (
                                <Check size={15} />
                              ) : (
                                <Save size={15} />
                              )}
                              {busy === 'preset'
                                ? '保存中…'
                                : presetSaved
                                  ? '已保存'
                                  : '保存预设'}
                            </button>
                            <button
                              type="button"
                              onClick={savePresetAndContinue}
                              disabled={busy === 'preset'}
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              保存并前往养马详设 →
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                          预设的改名和删除只能在预设槽位界面操作。
                        </p>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="text-sm">
                            剧本
                            <select
                              value={scenarioId}
                              onChange={(event) =>
                                setScenarioId(Number(event.target.value))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            >
                              <option value={1}>URA</option>
                            </select>
                          </label>
                          <label className="text-sm">
                            跑法
                            <select
                              value={runningStyle}
                              onChange={(event) =>
                                setRunningStyle(Number(event.target.value))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            >
                              <option value={0}>
                                默认（使用游戏当前跑法）
                              </option>
                              <option value={1}>逃</option>
                              <option value={2}>先行</option>
                              <option value={3}>差</option>
                              <option value={4}>追</option>
                            </select>
                          </label>
                          <label className="text-sm">
                            学技能最低技能点
                            <input
                              type="number"
                              value={skillThreshold}
                              onChange={(event) =>
                                setSkillThreshold(Number(event.target.value))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            />
                          </label>
                          <label className="text-sm">
                            休息体力阈值
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={restThreshold}
                              onChange={(event) =>
                                setRestThreshold(Number(event.target.value))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            />
                          </label>
                        </div>

                        <div id="preset-skills" className="mt-4 scroll-mt-28">
                          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  育成中技能选择
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  只会学习这里选择的技能；越靠上越优先，可拖动调整顺序。
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSkillPickerOpen(true)}
                                className="flex flex-none items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                <Plus size={14} />
                                添加技能
                              </button>
                            </div>
                            <div className="grid max-h-[260px] min-h-[104px] auto-rows-max content-start gap-2 overflow-y-auto bg-slate-50/60 p-3 2xl:grid-cols-2">
                              {skillSelections.map((entry, index) => {
                                const isGroup = entry.skill_names.length > 1;
                                const primaryName = entry.skill_names[0];
                                const skill = skillByName.get(primaryName);
                                return (
                                  <div
                                    key={entry.id}
                                    draggable
                                    onDragStart={(event) => {
                                      setDraggedPrioritySkill(entry.id);
                                      event.dataTransfer.effectAllowed = 'move';
                                      event.dataTransfer.setData(
                                        'text/plain',
                                        entry.id,
                                      );
                                    }}
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      event.dataTransfer.dropEffect = 'move';
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      reorderPrioritySkill(
                                        event.dataTransfer.getData(
                                          'text/plain',
                                        ) || draggedPrioritySkill,
                                        entry.id,
                                      );
                                      setDraggedPrioritySkill('');
                                    }}
                                    onDragEnd={() =>
                                      setDraggedPrioritySkill('')
                                    }
                                    className={`flex cursor-grab items-center gap-2 rounded-lg border bg-white p-1.5 shadow-sm active:cursor-grabbing ${
                                      draggedPrioritySkill === entry.id
                                        ? 'border-indigo-300 opacity-45'
                                        : 'border-slate-200'
                                    }`}
                                  >
                                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                                      {index + 1}
                                    </span>
                                    <span className="relative h-9 w-12 flex-none">
                                      {entry.skill_names
                                        .slice(0, isGroup ? 3 : 1)
                                        .map((name, iconIndex) => {
                                          const memberSkill =
                                            skillByName.get(name);
                                          const memberIconPath =
                                            skillIconPath(memberSkill);
                                          return (
                                            <span
                                              key={name}
                                              className="absolute top-0 h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm"
                                              style={{
                                                left: `${iconIndex * 7}px`,
                                                zIndex: 3 - iconIndex,
                                              }}
                                            >
                                              {memberSkill && memberIconPath ? (
                                                <AssetIcon
                                                  path={memberIconPath}
                                                  alt={name}
                                                  className="h-full w-full object-cover"
                                                />
                                              ) : (
                                                <span className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                                                  ?
                                                </span>
                                              )}
                                            </span>
                                          );
                                        })}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-semibold text-slate-800">
                                        {isGroup
                                          ? entry.label || '技能组'
                                          : primaryName}
                                      </span>
                                      <span
                                        className="mt-0.5 block truncate text-xs text-slate-500"
                                        title={`${entry.skill_names.join('、')} · ${skillLearningConditionLabel(entry)}`}
                                      >
                                        {isGroup
                                          ? `包含 ${entry.skill_names.length} 个技能 · ${skillLearningConditionLabel(entry)}`
                                          : skill
                                            ? skillLearningConditionLabel(entry)
                                            : '当前技能数据中未找到'}
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSkillSettingYearOffset(0);
                                        setEditingSkillSelectionId(entry.id);
                                      }}
                                      title="设置学习条件"
                                      className="flex flex-none items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                    >
                                      <Settings2 size={13} />
                                      设置
                                    </button>
                                    <GripVertical
                                      size={18}
                                      className="flex-none text-slate-300"
                                      aria-label="拖动调整顺序"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSkillSelections((current) =>
                                          current.filter(
                                            (currentEntry) =>
                                              currentEntry.id !== entry.id,
                                          ),
                                        );
                                        setSkillLearningSettings((current) => {
                                          const next = { ...current };
                                          entry.skill_names.forEach(
                                            (name) => delete next[name],
                                          );
                                          return next;
                                        });
                                        if (
                                          editingSkillSelectionId === entry.id
                                        ) {
                                          setEditingSkillSelectionId('');
                                        }
                                      }}
                                      title="移除技能"
                                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                );
                              })}
                              {!skillSelections.length ? (
                                <button
                                  type="button"
                                  onClick={() => setSkillPickerOpen(true)}
                                  className="flex min-h-[80px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600 2xl:col-span-2"
                                >
                                  <Plus size={16} className="mr-1" />
                                  添加育成中学习的技能
                                </button>
                              ) : null}
                            </div>
                          </section>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,2fr)]">
                          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                            <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={skipDoubleCircle}
                                onChange={(event) =>
                                  setSkipDoubleCircle(event.target.checked)
                                }
                                className="mt-1"
                              />
                              <span>
                                <strong className="block font-medium text-slate-800">
                                  技能 Hit 等级不足 4 时跳过 ◎ 技能
                                </strong>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  避免过早购买折扣不足的双圈技能
                                </span>
                              </span>
                            </label>
                            <label className="flex items-start gap-3 px-3 py-3 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={compensateFailure}
                                onChange={(event) =>
                                  setCompensateFailure(event.target.checked)
                                }
                                className="mt-1"
                              />
                              <span>
                                <strong className="block font-medium text-slate-800">
                                  训练评分考虑失败率
                                </strong>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  使用失败率系数降低高风险训练的优先度
                                </span>
                              </span>
                            </label>
                          </div>

                          <section className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  统一购买技能时间
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  育成中到达选中日期时统一检查所选技能；不选择则只在育成结束前检查
                                </p>
                              </div>
                              {skillPurchaseTurns.length ? (
                                <button
                                  type="button"
                                  onClick={() => setSkillPurchaseTurns([])}
                                  className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                                >
                                  清空
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                              {SKILL_PURCHASE_YEAR_OPTIONS.map((year) => (
                                <button
                                  key={year.offset}
                                  type="button"
                                  onClick={() =>
                                    setSkillPurchaseYearOffset(year.offset)
                                  }
                                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                    skillPurchaseYearOffset === year.offset
                                      ? 'bg-white text-indigo-700 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-700'
                                  }`}
                                >
                                  {year.label}
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-4 2xl:grid-cols-6">
                              {MONTH_OPTIONS.map((month) => (
                                <div
                                  key={month}
                                  className="rounded-lg border border-slate-200 bg-slate-50 p-1.5"
                                >
                                  <p className="mb-1 text-center text-[11px] font-medium text-slate-500">
                                    {month}月
                                  </p>
                                  <div className="grid grid-cols-2 gap-1">
                                    {([1, 2] as const).map((half) => {
                                      const turn = skillPurchaseTurn(
                                        skillPurchaseYearOffset,
                                        month,
                                        half,
                                      );
                                      const selected =
                                        skillPurchaseTurns.includes(turn);
                                      return (
                                        <button
                                          key={half}
                                          type="button"
                                          aria-pressed={selected}
                                          onClick={() =>
                                            setSkillPurchaseTurns((current) =>
                                              current.includes(turn)
                                                ? current.filter(
                                                    (value) => value !== turn,
                                                  )
                                                : [...current, turn].sort(
                                                    (left, right) =>
                                                      left - right,
                                                  ),
                                            )
                                          }
                                          className={`rounded px-1 py-1 text-[11px] font-medium ${
                                            selected
                                              ? 'bg-indigo-600 text-white'
                                              : 'bg-white text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
                                          }`}
                                        >
                                          {half === 1 ? '上' : '下'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                              {skillPurchaseTurns.map((turn) => (
                                <button
                                  key={turn}
                                  type="button"
                                  onClick={() =>
                                    setSkillPurchaseTurns((current) =>
                                      current.filter((value) => value !== turn),
                                    )
                                  }
                                  title="点击移除"
                                  className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                >
                                  {skillPurchaseTurnLabel(turn)} ×
                                </button>
                              ))}
                              {!skillPurchaseTurns.length ? (
                                <span className="py-1 text-xs text-slate-400">
                                  尚未设置额外购买时间
                                </span>
                              ) : null}
                            </div>
                          </section>
                        </div>

                        <details
                          id="preset-training"
                          className="mt-4 scroll-mt-28 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                        >
                          <summary className="cursor-pointer font-semibold">
                            高级训练决策设置
                          </summary>
                          <p className="mt-2 text-xs text-slate-500">
                            这些数值会直接影响训练、休息、外出和属性目标的选择。不了解评分逻辑时建议保留默认值。
                          </p>

                          <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4 text-xs text-slate-600">
                            <p className="text-sm font-semibold text-slate-800">
                              训练评分公式
                            </p>
                            <div className="mt-2 space-y-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-5 text-slate-700">
                              <p>
                                初始分 = 训练基础分 + 羁绊收益 + 技能 Hit 权重 +
                                属性收益 + 体力收益
                              </p>
                              <p>
                                最终分 = 初始分 × 友人卡倍率 × 失败率系数 ×
                                训练类型额外权重
                              </p>
                            </div>
                            <div className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
                              <p>
                                <strong className="text-slate-700">
                                  属性收益：
                                </strong>
                                属性增加值 × 属性收益倍率 ×
                                目标衰减。当前属性达到目标的 70%
                                后会逐步降权，达到目标后该属性收益记为 0。
                              </p>
                              <p>
                                <strong className="text-slate-700">
                                  羁绊收益：
                                </strong>
                                在低羁绊与高羁绊评分间按当前羁绊线性计算，再乘
                                max(0, (72 - 当前回合) / 72)；羁绊达到 60
                                后还会获得最多 1.5 倍的效率修正。
                              </p>
                              <p>
                                <strong className="text-slate-700">
                                  技能 Hit：
                                </strong>
                                本次训练存在至少一个技能提示时，增加一次对应阶段的技能
                                Hit 权重，不按提示人数重复叠加。
                              </p>
                              <p>
                                <strong className="text-slate-700">
                                  失败率系数：
                                </strong>
                                max(0, 1 - 失败率 / 50)。例如失败率 10%
                                时，训练分乘 0.8；关闭“考虑失败率”后不应用此项。
                              </p>
                              <p>
                                <strong className="text-slate-700">
                                  额外权重：
                                </strong>
                                最终乘数为 clamp(1 + 权重, 0, 2)。0
                                表示不调整，0.2 表示乘 1.2，-1
                                表示直接排除该训练。
                              </p>
                              <p>
                                <strong className="text-slate-700">
                                  休息判断：
                                </strong>
                                体力低于休息阈值、最佳训练失败率达到
                                35%，或最佳训练分低于 0
                                时，会优先休息；夏合宿期间会改为外出恢复。
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <p className="text-sm font-semibold">
                              需要立即治疗的负面状态
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {CONDITION_OPTIONS.map((condition) => (
                                <label
                                  key={condition.value}
                                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                                >
                                  <input
                                    type="checkbox"
                                    checked={cureConditions.includes(
                                      condition.value,
                                    )}
                                    onChange={(event) =>
                                      setCureConditions((current) =>
                                        event.target.checked
                                          ? [...current, condition.value]
                                          : current.filter(
                                              (item) =>
                                                item !== condition.value,
                                            ),
                                      )
                                    }
                                  />
                                  {condition.label}
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="text-sm font-semibold">属性目标</p>
                              <p className="mt-1 text-xs text-slate-400">
                                达到目标后会降低对应属性训练的优先度，默认采用
                                URA 的通用推荐值
                              </p>
                              <div className="mt-2 grid grid-cols-5 gap-2">
                                {STAT_LABELS.map((label, index) => (
                                  <label
                                    key={label}
                                    className="text-xs text-slate-500"
                                  >
                                    {label}
                                    <input
                                      type="number"
                                      value={expectAttribute[index]}
                                      onChange={(event) =>
                                        setExpectAttribute((current) =>
                                          current.map((value, valueIndex) =>
                                            valueIndex === index
                                              ? Number(event.target.value)
                                              : value,
                                          ),
                                        )
                                      }
                                      className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                训练基础分
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                0 表示不额外偏爱该训练，是正常的中立默认值
                              </p>
                              <div className="mt-2 grid grid-cols-5 gap-2">
                                {STAT_LABELS.map((label, index) => (
                                  <label
                                    key={label}
                                    className="text-xs text-slate-500"
                                  >
                                    {label}
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={baseScore[index]}
                                      onChange={(event) =>
                                        setBaseScore((current) =>
                                          current.map((value, valueIndex) =>
                                            valueIndex === index
                                              ? Number(event.target.value)
                                              : value,
                                          ),
                                        )
                                      }
                                      className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="text-sm">
                              夏合宿保留训练分阈值
                              <input
                                type="number"
                                step="0.01"
                                value={summerScoreThreshold}
                                onChange={(event) =>
                                  setSummerScoreThreshold(
                                    Number(event.target.value),
                                  )
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                              />
                            </label>
                            {[
                              '初级年心情阈值',
                              '经典年心情阈值',
                              '高级年心情阈值',
                            ].map((label, index) => (
                              <label key={label} className="text-sm">
                                {label}
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={motivationThresholds[index]}
                                  onChange={(event) =>
                                    setMotivationThresholds((current) =>
                                      current.map((value, valueIndex) =>
                                        valueIndex === index
                                          ? Number(event.target.value)
                                          : value,
                                      ),
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                                />
                              </label>
                            ))}
                          </div>

                          <div className="mt-4">
                            <p className="text-sm font-semibold">
                              属性收益倍率（速度、耐力、力量、毅力、智力、技能点）
                            </p>
                            <div className="mt-2 grid grid-cols-3 gap-2 md:grid-cols-6">
                              {[
                                '速度',
                                '耐力',
                                '力量',
                                '毅力',
                                '智力',
                                '技能点',
                              ].map((label, index) => (
                                <label
                                  key={label}
                                  className="text-xs text-slate-500"
                                >
                                  {label}
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={statMultiplier[index]}
                                    onChange={(event) =>
                                      setStatMultiplier((current) =>
                                        current.map((value, valueIndex) =>
                                          valueIndex === index
                                            ? Number(event.target.value)
                                            : value,
                                        ),
                                      )
                                    }
                                    className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                  />
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 overflow-x-auto">
                            <p className="text-sm font-semibold">
                              分期评分参数（低羁绊、高羁绊、体力、技能 Hit）
                            </p>
                            <div className="mt-2 min-w-[620px] space-y-2">
                              {scoreValue.map((row, rowIndex) => (
                                <div
                                  key={PERIOD_LABELS[rowIndex]}
                                  className="grid grid-cols-[120px_repeat(4,1fr)] gap-2"
                                >
                                  <span className="py-2 text-xs text-slate-500">
                                    {PERIOD_LABELS[rowIndex]}
                                  </span>
                                  {row.map((value, columnIndex) => (
                                    <input
                                      key={`${rowIndex}-${columnIndex}`}
                                      type="number"
                                      step="0.001"
                                      value={value}
                                      aria-label={`${PERIOD_LABELS[rowIndex]} 参数 ${columnIndex + 1}`}
                                      onChange={(event) =>
                                        setScoreValue((current) =>
                                          current.map(
                                            (currentRow, currentRowIndex) =>
                                              currentRowIndex === rowIndex
                                                ? currentRow.map(
                                                    (
                                                      currentValue,
                                                      currentColumnIndex,
                                                    ) =>
                                                      currentColumnIndex ===
                                                      columnIndex
                                                        ? Number(
                                                            event.target.value,
                                                          )
                                                        : currentValue,
                                                  )
                                                : currentRow,
                                          ),
                                        )
                                      }
                                      className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 overflow-x-auto">
                            <p className="text-sm font-semibold">
                              各阶段训练类型额外权重
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              0
                              表示该阶段不额外调整；正数提高优先度，负数降低优先度
                            </p>
                            <div className="mt-2 min-w-[700px] space-y-2">
                              {extraWeight.map((row, rowIndex) => (
                                <div
                                  key={rowIndex}
                                  className="grid grid-cols-[120px_repeat(5,1fr)] gap-2"
                                >
                                  <span className="py-2 text-xs text-slate-500">
                                    {
                                      [
                                        '初级年',
                                        '经典年',
                                        '高级年普通阶段',
                                        '夏合宿',
                                      ][rowIndex]
                                    }
                                  </span>
                                  {row.map((value, columnIndex) => (
                                    <label
                                      key={`${rowIndex}-${columnIndex}`}
                                      className="text-xs text-slate-500"
                                    >
                                      {STAT_LABELS[columnIndex]}
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={value}
                                        onChange={(event) =>
                                          setExtraWeight((current) =>
                                            current.map(
                                              (currentRow, currentRowIndex) =>
                                                currentRowIndex === rowIndex
                                                  ? currentRow.map(
                                                      (
                                                        currentValue,
                                                        currentColumnIndex,
                                                      ) =>
                                                        currentColumnIndex ===
                                                        columnIndex
                                                          ? Number(
                                                              event.target
                                                                .value,
                                                            )
                                                          : currentValue,
                                                    )
                                                  : currentRow,
                                            ),
                                          )
                                        }
                                        className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                      />
                                    </label>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <div className="overflow-x-auto">
                              <p className="text-sm font-semibold">
                                分期非卡组角色羁绊评分
                              </p>
                              <div className="mt-2 min-w-[360px] space-y-2">
                                {npcScoreValue.map((row, rowIndex) => (
                                  <div
                                    key={PERIOD_LABELS[rowIndex]}
                                    className="grid grid-cols-[120px_repeat(2,1fr)] gap-2"
                                  >
                                    <span className="py-2 text-xs text-slate-500">
                                      {PERIOD_LABELS[rowIndex]}
                                    </span>
                                    {row
                                      .slice(0, 2)
                                      .map((value, columnIndex) => (
                                        <label
                                          key={`${rowIndex}-${columnIndex}`}
                                          className="text-xs text-slate-500"
                                        >
                                          {columnIndex === 0
                                            ? '低羁绊'
                                            : '高羁绊'}
                                          <input
                                            type="number"
                                            step="0.001"
                                            value={value}
                                            onChange={(event) =>
                                              setNpcScoreValue((current) =>
                                                current.map(
                                                  (
                                                    currentRow,
                                                    currentRowIndex,
                                                  ) =>
                                                    currentRowIndex === rowIndex
                                                      ? currentRow.map(
                                                          (
                                                            currentValue,
                                                            currentColumnIndex,
                                                          ) =>
                                                            currentColumnIndex ===
                                                            columnIndex
                                                              ? Number(
                                                                  event.target
                                                                    .value,
                                                                )
                                                              : currentValue,
                                                        )
                                                      : currentRow,
                                                ),
                                              )
                                            }
                                            className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                          />
                                        </label>
                                      ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                友人卡羁绊评分
                              </p>
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                {['低羁绊', '高羁绊', '友人卡倍率'].map(
                                  (label, index) => (
                                    <label
                                      key={label}
                                      className="text-xs text-slate-500"
                                    >
                                      {label}
                                      <input
                                        type="number"
                                        step="0.001"
                                        value={
                                          index < 2
                                            ? palFriendshipScore[index]
                                            : palCardMultiplier
                                        }
                                        onChange={(event) => {
                                          const value = Number(
                                            event.target.value,
                                          );
                                          if (index < 2) {
                                            setPalFriendshipScore((current) =>
                                              current.map(
                                                (currentValue, currentIndex) =>
                                                  currentIndex === index
                                                    ? value
                                                    : currentValue,
                                              ),
                                            );
                                          } else {
                                            setPalCardMultiplier(value);
                                          }
                                        }}
                                        className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                                      />
                                    </label>
                                  ),
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-white p-3">
                            <label className="flex items-center gap-2 text-sm font-semibold">
                              <input
                                type="checkbox"
                                checked={prioritizeRecreation}
                                onChange={(event) =>
                                  setPrioritizeRecreation(event.target.checked)
                                }
                              />
                              按条件优先外出
                            </label>
                            <label className="mt-3 block text-xs text-slate-500">
                              外出条件：每行填写“心情, 体力, 最高训练评分”
                              <textarea
                                value={palThresholds
                                  .map((row) => row.join(', '))
                                  .join('\n')}
                                onChange={(event) =>
                                  setPalThresholds(
                                    event.target.value
                                      .split(/\r?\n/)
                                      .map((line) =>
                                        line
                                          .split(/[,，]/)
                                          .map((value) => Number(value.trim())),
                                      )
                                      .filter(
                                        (row) =>
                                          row.length >= 2 &&
                                          row.every((value) =>
                                            Number.isFinite(value),
                                          ),
                                      ),
                                  )
                                }
                                rows={3}
                                placeholder={'3, 60, 0.30\n4, 45, 0.20'}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                              />
                            </label>
                          </div>
                        </details>

                        <div
                          id="preset-races"
                          className="mt-5 flex scroll-mt-28 flex-wrap items-end justify-between gap-3"
                        >
                          <label className="min-w-[260px] flex-1 text-sm">
                            搜索额外赛事
                            <input
                              value={raceSearch}
                              onChange={(event) =>
                                setRaceSearch(event.target.value)
                              }
                              placeholder="赛事名、日期、赛场或等级"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            />
                          </label>
                          <p className="text-sm text-slate-400">
                            已选择 {selectedRaceIds.length} 场
                          </p>
                        </div>
                        <div className="mt-3 grid max-h-[440px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                          {filteredRaces.map((race) => {
                            const checked = selectedRaceIds.includes(race.id);
                            return (
                              <label
                                key={race.id}
                                className={`flex cursor-pointer gap-3 rounded-xl border p-2 ${
                                  checked
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : 'border-slate-100 bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedRaceIds((current) =>
                                      checked
                                        ? current.filter((id) => id !== race.id)
                                        : [...current, race.id],
                                    )
                                  }
                                  className="mt-1"
                                />
                                <AssetIcon
                                  path={`race_thumb/${race.thumbnail_id}.png`}
                                  alt={race.name}
                                  className="h-14 w-20 rounded-lg bg-slate-100 object-cover"
                                />
                                <span className="min-w-0 text-xs">
                                  <strong className="block truncate text-sm">
                                    {race.name}
                                  </strong>
                                  <span className="block text-slate-500">
                                    {race.date} · {race.type} · {race.venue}
                                  </span>
                                  <span className="text-slate-400">
                                    {race.terrain} · {race.distance}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                          <div>
                            <h3 className="font-semibold text-indigo-950">
                              预设配置完成后
                            </h3>
                            <p className="mt-1 text-sm text-indigo-700">
                              前往养马详设，为账号选择育成马娘、继承马娘和支援卡。
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => scrollToSection('preset-basic')}
                              className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                            >
                              返回顶部检查
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigateToTab('career', 'career-task')
                              }
                              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                              前往养马详设 →
                            </button>
                          </div>
                        </div>
                      </section>
                    </>
                  )
                ) : null}

                {dashboard && activeTab === 'career' ? (
                  activeCareer?.active ? (
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
                              <Database
                                size={28}
                                className="m-6 text-gray-300"
                              />
                            )}
                          </span>
                          <div>
                            <h2 className="text-lg font-bold">
                              当前已有进行中的育成
                            </h2>
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
                                  <RefreshCw
                                    size={16}
                                    className="animate-spin"
                                  />
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
                                      <Database
                                        size={20}
                                        className="m-4 text-gray-300"
                                      />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="truncate font-semibold text-gray-900">
                                      {setting.name}
                                    </h4>
                                    <p className="mt-1 truncate text-xs text-gray-500">
                                      {activeCareer.name} ·{' '}
                                      {setting.preset_name}
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
                          <p className="mt-1 text-sm text-gray-500">
                            选择已有详设继续配置，或者创建一个新的详设。
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {accountCareerSettings.map((setting) => {
                          const uma = dashboard.umas.find(
                            (item) => item.id === setting.card_id,
                          );
                          const iconPath = uma
                            ? horseIconPath(
                                uma.id,
                                uma.rarity,
                                uma.race_cloth_id,
                              )
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
                                    <Database
                                      size={24}
                                      className="m-5 text-gray-300"
                                    />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <label className="block text-xs text-gray-500">
                                    详设名称
                                    <input
                                      key={`${setting.id}-${setting.name}`}
                                      defaultValue={setting.name}
                                      onBlur={(event) =>
                                        renameCareerSetting(
                                          setting.id,
                                          event.target.value,
                                        )
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
                                    {setting.preset_name}
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
                                  onClick={() =>
                                    deleteCareerSetting(setting.id)
                                  }
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
                          <h3 className="font-semibold text-indigo-950">
                            新建养马详设
                          </h3>
                          <p className="mt-1 text-xs text-indigo-700">
                            创建后再选择马娘、继承马娘和支援卡。
                          </p>
                          <input
                            value={newCareerSaveName}
                            onChange={(event) =>
                              setNewCareerSaveName(event.target.value)
                            }
                            onKeyDown={(event) =>
                              event.key === 'Enter' && createCareerSave()
                            }
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

                      <section
                        id="career-task"
                        className={`${panelClass('p-5')} scroll-mt-28`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold">
                              育成任务配置 · {careerSettingName}
                            </h2>
                            <p className="text-sm text-gray-500">
                              依次选择育成马娘、继承马娘、支援卡组和好友支援。当前仅支持
                              URA。
                            </p>
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
                              onClick={() =>
                                navigateToTab('presets', 'preset-basic')
                              }
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
                                  <RefreshCw
                                    size={17}
                                    className="animate-spin"
                                  />
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
                                    (continuingCurrentCareer &&
                                      !canContinueCurrentCareer)
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
                                {busy === 'abandon'
                                  ? '正在放弃…'
                                  : '放弃本次育成'}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {!dashboard.account.career?.active ? (
                          <div
                            id="career-selection"
                            className="mt-5 scroll-mt-28 space-y-5"
                          >
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
                                    <p className="text-xs text-gray-500">
                                      点击头像选择要育成的马娘。
                                    </p>
                                  </div>
                                </div>
                                <label className="relative block w-full sm:w-72">
                                  <Search
                                    size={15}
                                    className="absolute left-3 top-2.5 text-gray-400"
                                  />
                                  <input
                                    value={umaSearch}
                                    onChange={(event) =>
                                      setUmaSearch(event.target.value)
                                    }
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
                                    <p className="text-xs text-gray-500">
                                      显示本体与两位祖辈的重点因子；白因子仅统计数量。
                                    </p>
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
                                      onChange={(event) =>
                                        setParentSearch(event.target.value)
                                      }
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
                                          onClick={() =>
                                            setParentSelectionSlot(slotNumber)
                                          }
                                          className={`flex h-20 w-20 flex-col items-center justify-center overflow-hidden rounded-lg border p-1 text-center ${
                                            parentSelectionSlot === slotNumber
                                              ? 'border-indigo-400 bg-indigo-50'
                                              : 'border-gray-200 bg-white'
                                          }`}
                                        >
                                          {selectedParent ? (
                                            <AssetIcon
                                              path={horseIconPath(
                                                selectedParent.card_id,
                                                selectedParent.rarity,
                                                selectedParent.race_cloth_id,
                                              )}
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
                                        parentSelectionSlot === 1
                                          ? parent1
                                          : parent2;
                                      const otherValue =
                                        parentSelectionSlot === 1
                                          ? parent2
                                          : parent1;
                                      const otherParent =
                                        dashboard.parents.find(
                                          (item) =>
                                            item.selection_id === otherValue,
                                        );
                                      const blockedCharaIds = new Set([
                                        selectedUma.chara_id,
                                        otherParent?.chara_id || 0,
                                      ]);
                                      return (
                                        <ParentChoiceCard
                                          key={parent.selection_id}
                                          parent={parent}
                                          selected={
                                            currentValue === parent.selection_id
                                          }
                                          disabled={
                                            otherValue ===
                                              parent.selection_id ||
                                            blockedCharaIds.has(
                                              parent.chara_id,
                                            ) ||
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
                                  <h3 className="font-semibold text-gray-800">
                                    选择支援卡组
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    卡组直接显示五张支援卡，不显示卡组编号。
                                  </p>
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
                                    new Set(deckCharaIds).size !==
                                      deckCharaIds.length ||
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
                                        setSupportCardIds(
                                          deck.support_card_ids,
                                        );
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
                                      开始育成时会自动寻找这张卡，只借用满破满级支援。
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
                                    onChange={(event) =>
                                      setSupportSearch(event.target.value)
                                    }
                                    placeholder="搜索支援卡名称或类型"
                                    className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm"
                                  />
                                </label>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={refreshOptionsIndex}
                                  disabled={
                                    !selectedAccountId ||
                                    busy === 'options-index'
                                  }
                                  className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                                >
                                  <RefreshCw
                                    size={13}
                                    className={
                                      busy === 'options-index'
                                        ? 'animate-spin'
                                        : ''
                                    }
                                  />
                                  {busy === 'options-index'
                                    ? '正在刷新 index…'
                                    : `刷新 index 数据${availableFriendSupportIds.size ? `（${availableFriendSupportIds.size} 张可借）` : ''}`}
                                </button>
                                <span className="text-xs text-gray-400">
                                  直接读取 index 中好友的
                                  support_card_id，只保留满破满级卡。
                                </span>
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
                                      disabled={reservedCharaIds.has(
                                        support.chara_id,
                                      )}
                                      onSelect={() =>
                                        setFriendCardId(support.id)
                                      }
                                    />
                                  );
                                })}
                              </div>
                              {!visibleFriendSupports.length &&
                              busy !== 'options-index' ? (
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
                                  <h3 className="font-semibold text-gray-800">
                                    编辑其他设置
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    选择预设，并设置运行上限与TP恢复方式。
                                  </p>
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
                                    onClick={() =>
                                      navigateToTab('presets', 'preset-basic')
                                    }
                                    className="mt-2 text-xs block font-medium text-indigo-600 hover:text-indigo-800"
                                  >
                                    编辑“{presetName || '新预设'}”的详细配置 →
                                  </button>
                                  <select
                                    value={presetName}
                                    onChange={(event) =>
                                      setPresetName(event.target.value)
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                                  >
                                    {!presets.length ? (
                                      <option value="">请先新建预设</option>
                                    ) : null}
                                    {presets.map((preset) => (
                                      <option key={preset.name}>
                                        {preset.name}
                                      </option>
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
                                    onChange={(event) =>
                                      setBurnClocks(event.target.checked)
                                    }
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
                                      setRecoverTpWithJewels(
                                        event.target.checked,
                                      )
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
                  )
                ) : null}

                {dashboard && activeTab === 'progress' ? (
                  currentCareerActive ? (
                    <div className="min-h-[calc(100vh-170px)] space-y-4">
                      <section className={panelClass('p-5')}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <span className="h-20 w-20 flex-none overflow-hidden rounded-lg bg-gray-100">
                              {activeCareerIconPath ? (
                                <AssetIcon
                                  path={activeCareerIconPath}
                                  alt={
                                    activeCareer?.name ||
                                    currentCareerUma?.name ||
                                    '当前育成'
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Database
                                  size={28}
                                  className="m-6 text-gray-300"
                                />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="truncate text-xl font-bold text-slate-900">
                                  {activeCareer?.name ||
                                    currentCareerUma?.name ||
                                    '当前养马'}
                                </h2>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs ${runnerStopping || runnerSessionWaiting ? 'bg-amber-100 text-amber-700' : automationActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                                >
                                  {runnerStopping
                                    ? '正在停止…'
                                    : runnerSessionWaiting
                                      ? '等待重新登录'
                                      : automationActive
                                        ? '自动育成中'
                                        : runner?.run_plan?.stop_reason ||
                                          (runner?.finished
                                            ? '本次已完成'
                                            : '等待开始')}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-medium text-indigo-600">
                                {turnDateLabel(
                                  runner?.turn || activeCareer?.turn,
                                )}
                              </p>
                              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                                {runnerStopping || runnerSessionWaiting ? (
                                  <RefreshCw
                                    size={15}
                                    className={
                                      runnerStopping
                                        ? 'animate-spin text-amber-500'
                                        : 'text-amber-500'
                                    }
                                  />
                                ) : (
                                  <Activity
                                    size={15}
                                    className="text-indigo-500"
                                  />
                                )}
                                {runnerStopping
                                  ? '已收到停止请求，正在等待当前操作完成'
                                  : runnerSessionWaiting
                                    ? `账号可能正在其他位置操作，${waitTimeLabel(runner?.session_wait_seconds)}后重新登录`
                                    : describeRunnerAction(runner?.last_action)}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>
                                  体力{' '}
                                  {currentRunnerStats.hp ??
                                    activeCareer?.vital ??
                                    0}
                                  /
                                  {currentRunnerStats.max_hp ??
                                    activeCareer?.max_vital ??
                                    100}
                                </span>
                                <span>
                                  干劲 {currentRunnerStats.motivation ?? '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {runner?.last_error ? (
                          <div className="mt-4 flex items-start gap-2 border-t border-red-100 pt-4 text-sm text-red-700">
                            <CircleStop
                              size={16}
                              className="mt-0.5 flex-none"
                            />
                            <span>{runner.last_error}</span>
                          </div>
                        ) : null}

                        {runnerStopping ? (
                          <div className="mt-4 border-t border-amber-100 pt-4 text-sm text-amber-700">
                            自动运行会在当前接口处理结束后停止；当前育成不会被放弃，之后仍可继续。
                          </div>
                        ) : null}

                        {runnerSessionWaiting ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 pt-4 text-sm text-amber-700">
                            <span>
                              错误码 217 再次出现，自动操作已暂停。将在{' '}
                              {waitTimeLabel(runner?.session_wait_seconds)}
                              后重新登录并继续当前养马。
                            </span>
                            <button
                              type="button"
                              onClick={releaseSessionWait}
                              disabled={busy === 'release-session-wait'}
                              className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              <RefreshCw
                                size={14}
                                className={
                                  busy === 'release-session-wait'
                                    ? 'animate-spin'
                                    : ''
                                }
                              />
                              {busy === 'release-session-wait'
                                ? '正在重新登录…'
                                : '立即继续'}
                            </button>
                          </div>
                        ) : null}

                        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 sm:grid-cols-3 xl:grid-cols-6">
                          {[
                            ['速度', currentRunnerStats.speed],
                            ['耐力', currentRunnerStats.stamina],
                            ['力量', currentRunnerStats.power],
                            ['毅力', currentRunnerStats.guts],
                            ['智力', currentRunnerStats.wit],
                            ['PT', currentRunnerStats.skill_point],
                          ].map(([label, value]) => (
                            <div
                              key={String(label)}
                              className="border-b border-r border-slate-100 px-4 py-3 last:border-r-0 sm:border-b-0"
                            >
                              <p className="text-xs text-slate-400">{label}</p>
                              <p className="mt-1 text-xl font-bold text-slate-800">
                                {value ?? '-'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {dailyJewelSchedule?.enabled ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-4 text-sm">
                            <div>
                              <span className="font-semibold text-violet-800">
                                每日宝石计划
                              </span>
                              <span className="ml-2 text-xs text-violet-600">
                                {dailyJewelSchedule.start_time}–
                                {dailyJewelSchedule.end_time} · 今日{' '}
                                {dailyJewelSchedule.daily_jewel_drop_count}/
                                {dailyJewelSchedule.target} 次
                              </span>
                            </div>
                            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
                              {dailyJewelScheduleStatusLabel(
                                dailyJewelSchedule.status,
                              )}
                            </span>
                          </div>
                        ) : null}

                        {runner?.run_plan && hasRunPlan ? (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                            <div>
                              <span className="font-semibold text-slate-800">
                                {runModeLabel(runner.run_plan.mode)}
                              </span>
                              <span className="ml-2 text-xs text-slate-500">
                                {runner.run_plan.mode === 'single'
                                  ? `完成 ${runner.run_plan.completed_runs}/1 局`
                                  : runner.run_plan.mode === 'continuous'
                                    ? `已连续完成 ${runner.run_plan.completed_runs} 局`
                                    : runner.run_plan.mode === 'daily_count'
                                      ? `今日 ${runner.run_plan.daily_completed_runs}/${runner.run_plan.target} 局`
                                      : `本次 ${runner.run_plan.completed_jewel_drops}/${runner.run_plan.target} 次掉落`}
                              </span>
                            </div>
                            {automationActive ? (
                              <div className="flex flex-wrap gap-2">
                                {runnerSessionWaiting ? (
                                  <button
                                    type="button"
                                    onClick={releaseSessionWait}
                                    disabled={busy === 'release-session-wait'}
                                    className="rounded-md bg-amber-500 px-3 py-2 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                                  >
                                    {busy === 'release-session-wait'
                                      ? '正在继续…'
                                      : '立即继续'}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={stopCareer}
                                  disabled={runnerStopping || busy === 'stop'}
                                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {runnerStopping ? (
                                    <RefreshCw
                                      size={15}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <CircleStop size={15} />
                                  )}
                                  {runnerStopping
                                    ? '正在停止…'
                                    : '停止自动运行'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </section>

                      <section className={panelClass('overflow-hidden')}>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              当前流程
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              按游戏日期显示训练、事件和比赛结果。
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Gem size={14} className="text-violet-500" />
                              本局 {runner?.jewel_drop_count || 0} 次 /{' '}
                              {runner?.jewels_earned || 0} 个
                            </span>
                            <span>
                              今天 {runner?.daily_jewel_drop_count || 0}/
                              {runner?.daily_jewel_drop_limit || 20} 次
                            </span>
                          </div>
                        </div>
                        <div className="max-h-[560px] overflow-auto">
                          {(runner?.log || [])
                            .filter(
                              (row) =>
                                !HIDDEN_RUNNER_LOG_ACTIONS.has(row.action),
                            )
                            .slice()
                            .reverse()
                            .map((row) => (
                              <div
                                key={row.id}
                                className="grid gap-1 border-b border-slate-50 px-5 py-3 text-sm last:border-0 md:grid-cols-[210px_110px_minmax(0,1fr)] md:gap-3"
                              >
                                <span className="whitespace-nowrap font-medium text-indigo-600">
                                  {turnDateLabel(row.turn)}
                                </span>
                                <span className="font-semibold text-slate-700">
                                  {describeLogAction(row.action)}
                                </span>
                                <span className="text-slate-500">
                                  {describeLogDetail(row.detail)}
                                </span>
                              </div>
                            ))}
                          {!(runner?.log || []).some(
                            (row) => !HIDDEN_RUNNER_LOG_ACTIONS.has(row.action),
                          ) ? (
                            <p className="p-10 text-center text-sm text-slate-400">
                              暂无流程记录
                            </p>
                          ) : null}
                        </div>
                      </section>
                    </div>
                  ) : (
                    <section
                      className={panelClass(
                        'flex min-h-[calc(100vh-170px)] items-center justify-center p-8 text-center',
                      )}
                    >
                      <div>
                        <Activity
                          size={38}
                          className={`mx-auto ${automationActive ? 'animate-pulse text-indigo-300' : 'text-slate-300'}`}
                        />
                        <h2 className="mt-4 font-bold text-slate-700">
                          {dailyJewelSchedule?.enabled
                            ? dailyJewelSchedule.status === 'completed'
                              ? '今日宝石目标已完成'
                              : `每日宝石计划：${dailyJewelScheduleStatusLabel(
                                  dailyJewelSchedule.status,
                                )}`
                            : runner?.run_plan?.active
                              ? '正在准备下一次育成'
                              : '当前没有进行中的养马'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-400">
                          {dailyJewelSchedule?.enabled
                            ? `每日 ${dailyJewelSchedule.start_time}–${dailyJewelSchedule.end_time} 运行，今天 ${dailyJewelSchedule.daily_jewel_drop_count}/${dailyJewelSchedule.target} 次掉落。`
                            : runner?.run_plan?.active
                              ? '新的育成开始后，这里会显示实时状态。'
                              : '开始或继续育成后，这里会显示当前属性和流程。'}
                        </p>
                        {dailyJewelSchedule?.last_error ? (
                          <p className="mt-2 text-xs text-red-500">
                            {dailyJewelSchedule.last_error}
                          </p>
                        ) : null}
                        {dailyJewelSchedule?.enabled ? (
                          <button
                            type="button"
                            onClick={stopCareer}
                            disabled={runnerStopping || busy === 'stop'}
                            className="mt-5 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {runnerStopping ? (
                              <RefreshCw size={16} className="animate-spin" />
                            ) : (
                              <CircleStop size={16} />
                            )}
                            {runnerStopping ? '正在停止…' : '停止每日计划'}
                          </button>
                        ) : null}
                      </div>
                    </section>
                  )
                ) : null}

                {dashboard && activeTab === 'history' ? (
                  selectedCareerReport ? (
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
                                (uma) =>
                                  uma.id === selectedCareerReport.card_id,
                              )?.name ||
                                `育成马娘 ${selectedCareerReport.card_id || '-'}`}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatReportTime(
                                selectedCareerReport.started_at,
                              )}{' '}
                              ·{' '}
                              {selectedCareerReport.preset_name || '未命名预设'}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${selectedCareerReport.status === 'error' ? 'bg-red-100 text-red-700' : selectedCareerReport.status === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {careerReportStatusLabel(
                              selectedCareerReport.status,
                            )}
                          </span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                          <span>
                            结束于{' '}
                            {turnDateLabel(selectedCareerReport.final_turn)}
                          </span>
                          <span>
                            比赛 {selectedCareerReport.race_count || 0} 场
                          </span>
                          <span>
                            宝石掉落{' '}
                            {selectedCareerReport.jewel_drop_count || 0} 次，共{' '}
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
                                !HIDDEN_RUNNER_LOG_ACTIONS.has(
                                  String(event.action || ''),
                                ),
                            );
                            const apiCalls = (turn.api_calls || []).filter(
                              (call) =>
                                !String(call.endpoint || '').includes(
                                  'race_end',
                                ),
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
                                        {describeLogAction(
                                          String(event.action || ''),
                                        )}
                                      </span>
                                      <span className="text-slate-500">
                                        {describeLogDetail(
                                          String(event.detail || ''),
                                        )}
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
                                          {call.result_code
                                            ? ` · ${call.result_code}`
                                            : ''}
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
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            服务器保留最近记录，并额外保留有限数量的异常流程。
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
                      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {careerHistory.map((report) => {
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
                            <button
                              key={report.id}
                              type="button"
                              onClick={() => openCareerReport(report.id)}
                              disabled={busy === `history-${report.id}`}
                              className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm disabled:opacity-50"
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
                                    <Trophy
                                      size={22}
                                      className="m-5 text-slate-300"
                                    />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-start justify-between gap-2">
                                    <strong className="truncate text-slate-900">
                                      {reportUma?.name ||
                                        `育成马娘 ${report.card_id || '-'}`}
                                    </strong>
                                    <span
                                      className={`flex-none text-xs ${report.status === 'error' ? 'text-red-600' : report.status === 'finished' ? 'text-emerald-600' : 'text-slate-500'}`}
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
                          );
                        })}
                      </div>
                      {!careerHistory.length && busy !== 'history' ? (
                        <p className="py-14 text-center text-sm text-slate-400">
                          暂无已保存的养马记录
                        </p>
                      ) : null}
                    </section>
                  )
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
