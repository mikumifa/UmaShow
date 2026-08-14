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
  Upload,
  Users,
} from 'lucide-react';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import { loadUMDB, UMDB } from 'renderer/utils/umdb';

type CapturedCredential = {
  uid: string;
  accessKey: string;
  capturedAt: string;
  source: string;
};

type Runner = {
  running?: boolean;
  turn?: number;
  steps?: number;
  last_action?: string;
  last_error?: string;
  finished?: boolean;
  log?: Array<{
    id: number;
    action: string;
    turn: number;
    detail: string;
    time: string;
  }>;
  action_history?: Array<{
    turn: number;
    action: string;
    facility: string;
    detail: string;
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
    name: string;
    turn: number;
    scenario_id: number;
    vital: number;
    max_vital: number;
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

type AutoResearchTab = 'accounts' | 'presets' | 'career';

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
  scenario_id: number;
  max_steps: number;
  burn_clocks: boolean;
  recover_tp_with_item: boolean;
  recover_tp_with_jewels: boolean;
  updated_at: string;
};

type SessionResponse = {
  success: boolean;
  dashboard?: Dashboard;
  runtime?: { runner?: Runner };
  relogged_in?: boolean;
};

type AuthResponse = SessionResponse & {
  token: string;
  expires_at: number;
};

type Preset = {
  name: string;
  scenario_id?: number;
  running_style?: number;
  recover_tp_with_item?: boolean;
  recover_tp_with_jewels?: boolean;
  learn_skill_list?: string[][];
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

type SkillOption = {
  name?: string;
  rarity?: number;
  need_skill_point?: number;
  disable_singlemode?: number;
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
const LOCAL_PRESETS_KEY = 'autoResearch.presets';
const DELETED_PRESETS_KEY = 'autoResearch.deletedPresets';
const CAREER_SETTINGS_KEY = 'autoResearch.careerSettings';
const STAT_LABELS = ['速度', '耐力', '力量', '毅力', '智力'];
const PERIOD_LABELS = [
  '初级年',
  '经典年前半',
  '经典年后半',
  '高级年前半',
  '高级年后半',
];
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

function horseIconPath(cardId: number, rarity: number, raceClothId = 0) {
  if (!cardId) return undefined;
  const charaId = Number(String(cardId).slice(0, 4));
  const dressId =
    raceClothId || UMDB.cardRarityData[cardId]?.[rarity] || cardId;
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
      className={`relative aspect-square w-full overflow-hidden rounded-md border bg-gray-100 transition-all ${
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
      className={`relative aspect-square w-full overflow-hidden rounded-md border bg-gray-100 transition-all disabled:cursor-not-allowed disabled:opacity-25 ${
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
      className={`rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
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
      <span className="grid grid-cols-5 gap-1">
        {deck.cards.map((support) => (
          <span
            key={support.id}
            className="aspect-square overflow-hidden rounded bg-gray-100"
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

function splitSkillNames(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
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
  if (action.startsWith('skills ')) {
    return `刚刚学习了 ${action.slice('skills '.length)} 个技能`;
  }
  if (action.startsWith('blocked state')) return '游戏状态异常，正在尝试恢复';
  if (action.startsWith('items')) return '正在整理和使用道具';
  return action;
}

function describeLogAction(value: string) {
  const labels: Record<string, string> = {
    started: '开始养马',
    command: '选择行动',
    command_exec: '执行行动',
    event: '育成事件',
    event_choice: '事件选择',
    race: '参加比赛',
    race_entry: '报名比赛',
    race_start: '比赛开始',
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
    return rank ? `比赛获得第 ${rank} 名` : '比赛结果已确认';
  }
  if (/^\d+ -> \d+$/.test(detail)) {
    return `已选择第 ${detail.split(' -> ')[1]} 个事件选项`;
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
  const [presets, setPresets] = useState<Preset[]>([]);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [manualUid, setManualUid] = useState('');
  const [manualAccessKey, setManualAccessKey] = useState('');
  const [dragging, setDragging] = useState(false);
  const [loginProgress, setLoginProgress] = useState<LoginProgress | null>(
    null,
  );
  const sessionTokens = useRef(new Map<string, string>());

  const [cardId, setCardId] = useState(0);
  const [deckId, setDeckId] = useState(0);
  const [supportCardIds, setSupportCardIds] = useState<number[]>([]);
  const [friendCardId, setFriendCardId] = useState(0);
  const [parent1, setParent1] = useState('');
  const [parent2, setParent2] = useState('');
  const [scenarioId, setScenarioId] = useState(1);
  const [presetName, setPresetName] = useState('URA 默认');
  const [maxSteps, setMaxSteps] = useState(2500);
  const [burnClocks, setBurnClocks] = useState(false);
  const [runningStyle, setRunningStyle] = useState(0);
  const [recoverTpWithItem, setRecoverTpWithItem] = useState(false);
  const [recoverTpWithJewels, setRecoverTpWithJewels] = useState(false);
  const [skillPriorityText, setSkillPriorityText] = useState('');
  const [skillBlacklistText, setSkillBlacklistText] = useState('');
  const [blacklistDraft, setBlacklistDraft] = useState('');
  const [skillThreshold, setSkillThreshold] = useState(888);
  const [learnOnlyConfigured, setLearnOnlyConfigured] = useState(false);
  const [skipDoubleCircle, setSkipDoubleCircle] = useState(false);
  const [skillPurchaseTurnsText, setSkillPurchaseTurnsText] = useState('');
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
  const [friendSupportView, setFriendSupportView] = useState<
    'all' | 'available'
  >('all');
  const [parentSelectionSlot, setParentSelectionSlot] = useState<1 | 2>(1);
  const [careerSettings, setCareerSettings] = useState<CareerSetting[]>([]);
  const [selectedCareerSettingId, setSelectedCareerSettingId] = useState('');
  const [careerSettingName, setCareerSettingName] = useState('');

  const dashboard = session?.dashboard;
  const selectedAccount = accounts.find(
    (account) => account.id === selectedAccountId,
  );
  const runner = session?.runtime?.runner || selectedAccount?.runtime.runner;
  const activeCareer = dashboard?.account.career;
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
      friendSupportView === 'available'
        ? filteredSupports.filter((support) =>
            availableFriendSupportIds.has(support.id),
          )
        : filteredSupports,
    [availableFriendSupportIds, filteredSupports, friendSupportView],
  );
  const selectionConflict = useMemo(() => {
    if (!selectedUma || !selectedDeck || !selectedFriendSupport) return '';
    if (selectedDeck.cards.length !== 5) return '支援卡组必须正好包含 5 张卡';
    const ownCharaIds = selectedDeck.cards.map((support) => support.chara_id);
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
    if (
      parentCharaIds.some(
        (charaId) =>
          charaId === selectedUma.chara_id ||
          charaId === selectedFriendSupport.chara_id ||
          ownCharaIds.includes(charaId),
      )
    ) {
      return '支援卡、育成马娘和继承马娘中不能出现相同马娘';
    }
    return '';
  }, [
    selectedDeck,
    selectedFriendSupport,
    selectedParent1,
    selectedParent2,
    selectedUma,
  ]);
  const blacklistedSkills = useMemo(
    () => splitSkillNames(skillBlacklistText),
    [skillBlacklistText],
  );
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
  }, []);

  const updateRuntime = useCallback(
    (accountId: string, response: SessionResponse | null) => {
      setAccounts((current) =>
        current.map((account) =>
          account.id === accountId
            ? {
                ...account,
                runtime: response?.runtime
                  ? {
                      ...account.runtime,
                      ...response.runtime,
                      logged_in: !!response.success,
                      account: response.dashboard?.account || null,
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

  const connect = async () => {
    const nextServer = normalizeServer(serverAddress);
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
      setServer(nextServer);
      setHealth(body);
      setMessage(`已连接 ${body.service}`);
    } catch (caught) {
      setError(`无法连接后端：${(caught as Error).message}`);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    loadUMDB().catch(() => undefined);
    try {
      const stored = JSON.parse(
        localStorage.getItem(CAREER_SETTINGS_KEY) || '[]',
      );
      if (Array.isArray(stored)) setCareerSettings(stored);
    } catch {
      setCareerSettings([]);
    }
  }, []);

  useEffect(() => {
    window.electron.autoResearch.credentials().then(setCaptured);
    loadAccounts().catch((caught) => setError((caught as Error).message));
    return window.electron.autoResearch.onCredentialCaptured((credential) => {
      setCaptured((current) => [
        credential,
        ...current.filter((item) => item.uid !== credential.uid),
      ]);
      loadAccounts().catch((caught) => setError((caught as Error).message));
      setMessage('已按 UID 自动更新本机 UmaShow 中的 access_key。');
    });
  }, [loadAccounts]);

  useEffect(() => {
    setFriendSupportView('all');
  }, [selectedAccountId]);

  useEffect(() => {
    if (!server) return;
    request<{ presets: Preset[] }>('/api/presets')
      .then((result) => {
        let localPresets: Preset[] = [];
        let deletedPresetNames: string[] = [];
        try {
          const stored = JSON.parse(
            localStorage.getItem(LOCAL_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(stored)) localPresets = stored;
          const deleted = JSON.parse(
            localStorage.getItem(DELETED_PRESETS_KEY) || '[]',
          );
          if (Array.isArray(deleted)) deletedPresetNames = deleted;
        } catch {
          localPresets = [];
          deletedPresetNames = [];
        }
        const merged = new Map<string, Preset>();
        [...(result.presets || []), ...localPresets].forEach((preset) => {
          if (preset?.name && !deletedPresetNames.includes(preset.name)) {
            merged.set(preset.name, preset);
          }
        });
        const nextPresets = [...merged.values()];
        setPresets(nextPresets);
        setPresetName((current) =>
          nextPresets.length &&
          !nextPresets.some((preset) => preset.name === current)
            ? nextPresets[0].name
            : current,
        );
      })
      .catch((caught) => setError((caught as Error).message));
    request<{ races: RaceOption[] }>('/api/races')
      .then((result) => setRaces(result.races || []))
      .catch((caught) => setError((caught as Error).message));
    request<{ skills: Record<string, SkillOption> }>('/api/skills')
      .then((result) => {
        const names = Object.values(result.skills || {})
          .filter(
            (skill) =>
              skill.name &&
              Number(skill.need_skill_point || 0) > 0 &&
              !String(skill.name).endsWith('×'),
          )
          .map((skill) => String(skill.name))
          .filter((name, index, rows) => rows.indexOf(name) === index)
          .sort((left, right) => left.localeCompare(right, 'zh-CN'));
        setSkillNames(names);
      })
      .catch((caught) => setError((caught as Error).message));
  }, [request, server]);

  useEffect(() => {
    const preset = presets.find((item) => item.name === presetName);
    if (!preset) return;
    setRunningStyle(Number(preset.running_style ?? 0));
    setSkillPriorityText(
      (preset.learn_skill_list || []).map((row) => row.join(', ')).join('\n'),
    );
    setSkillBlacklistText((preset.learn_skill_blacklist || []).join('\n'));
    setSkillThreshold(Number(preset.learn_skill_threshold || 888));
    setLearnOnlyConfigured(Boolean(preset.learn_skill_only_user_provided));
    setSkipDoubleCircle(Boolean(preset.skip_double_circle_unless_high_hint));
    setSkillPurchaseTurnsText(
      normalizeTurnList(preset.skill_purchase_turns).join(', '),
    );
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
    }
  }, [careerSettings, selectedAccount?.uid, selectedCareerSettingId]);

  useEffect(() => {
    if (!selectedAccountId || !runner?.running) return undefined;
    const timer = window.setInterval(() => {
      loadSession(selectedAccountId).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadSession, runner?.running, selectedAccountId]);

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
      setMessage(`已在本机 UmaShow 保存 ${credentials.length} 个账号`);
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
      const result = (await window.electron.autoResearch.importUsersDb(
        content,
      )) as Account[];
      await loadAccounts();
      setMessage(`从 users.db 导入 ${result.length} 个账号到本机 UmaShow`);
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
    setBusy(`${action}-${accountId}`);
    setError('');
    try {
      let result: SessionResponse | null = null;
      const authenticate = async (forceLogin = false) => {
        const loginId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const startedAt = Date.now();
        let polling = true;
        setSelectedAccountId(accountId);
        setLoginProgress({
          accountId,
          loginId,
          stage: 'queued',
          endpoint: '',
          detail: forceLogin ? '登录已过期，正在重新登录' : '正在连接登录服务',
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
        const restoreLogin = async () => {
          try {
            await authenticate(false);
          } catch (caught) {
            if (
              !(caught instanceof AutoResearchRequestError) ||
              caught.status !== 401
            ) {
              throw caught;
            }
            await authenticate(true);
          }
          relogged = true;
        };
        const refreshStatus = () =>
          accountRunning
            ? accountRequest<SessionResponse>(accountId, '/api/account/session')
            : accountRequest<SessionResponse>(
                accountId,
                '/api/account/refresh',
                { method: 'POST', body: '{}' },
              );
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
            await restoreLogin();
          } else {
            await authenticate(true);
            relogged = true;
          }
          result = await refreshStatus();
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
      setMessage(
        action === 'login'
          ? '账号登录成功'
          : action === 'refresh'
            ? result?.relogged_in
              ? '登录已恢复，账号状态已刷新'
              : '账号状态已刷新'
            : '账号已退出',
      );
    } catch (caught) {
      setError((caught as Error).message);
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
      await loadAccounts();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const addBlacklistSkill = () => {
    const name = blacklistDraft.trim();
    if (!name) return;
    setSkillBlacklistText(
      Array.from(new Set([...blacklistedSkills, name])).join('\n'),
    );
    setBlacklistDraft('');
  };

  const removeBlacklistSkill = (name: string) => {
    setSkillBlacklistText(
      blacklistedSkills.filter((item) => item !== name).join('\n'),
    );
  };

  const draftPreset = () => ({
    name: presetName.trim(),
    scenario_id: scenarioId,
    running_style: runningStyle,
    learn_skill_list: skillPriorityText
      .split(/\r?\n/)
      .map((line) =>
        line
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .filter((row) => row.length),
    learn_skill_blacklist: blacklistedSkills,
    learn_skill_threshold: skillThreshold,
    learn_skill_only_user_provided: learnOnlyConfigured,
    skip_double_circle_unless_high_hint: skipDoubleCircle,
    skill_purchase_turns: normalizeTurnList(skillPurchaseTurnsText),
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

  const runCareer = async () => {
    if (!selectedAccountId || !dashboard) return;
    if (unsupportedCareer) {
      setError(
        `当前进行中的育成剧本（scenario_id=${dashboard.account.career?.scenario_id}）暂不支持。请在游戏中手动退出本次养马，再刷新账号状态。`,
      );
      return;
    }
    const active = dashboard.account.career?.active;
    if (
      !active &&
      (!cardId || !deckId || !parent1 || !parent2 || !friendCardId)
    ) {
      setError('开始新育成前，请完整选择角色、卡组、好友支援和两位继承马娘');
      return;
    }
    if (!active && selectionConflict) {
      setError(selectionConflict);
      return;
    }
    setBusy('run');
    setError('');
    setMessage(
      active ? '正在继续自动育成…' : '正在寻找满破满级好友支援并准备开始育成…',
    );
    try {
      const result = await accountRequest<SessionResponse>(
        selectedAccountId,
        '/api/account/career/run',
        {
          method: 'POST',
          body: JSON.stringify({
            card_id: cardId || 0,
            support_card_ids: supportCardIds,
            friend_viewer_id: 0,
            friend_card_id: friendCardId || 0,
            parent_id_1: selectedParent1?.instance_id || 0,
            parent_id_2: selectedParent2?.instance_id || 0,
            parent_1_viewer_id: selectedParent1?.viewer_id || 0,
            parent_2_viewer_id: selectedParent2?.viewer_id || 0,
            scenario_id: scenarioId,
            deck_id: deckId || 1,
            use_tp: 30,
            recover_tp_with_item: recoverTpWithItem,
            recover_tp_with_jewels: recoverTpWithJewels,
            preset_name: presetName,
            preset: draftPreset(),
            max_steps: maxSteps,
            burn_clocks: burnClocks,
          }),
        },
      );
      setSession(result);
      updateRuntime(selectedAccountId, result);
      setMessage('自动育成任务已启动');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const stopCareer = async () => {
    if (!selectedAccountId) return;
    setBusy('stop');
    try {
      await accountRequest(
        selectedAccountId,
        '/api/account/career/runner/stop',
        {
          method: 'POST',
          body: '{}',
        },
      );
      await loadSession(selectedAccountId);
      setMessage('已请求停止任务');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const scanFriendSupports = async () => {
    if (!selectedAccountId) return;
    setBusy('friends');
    setError('');
    setMessage('正在查找可借用的满破满级好友支援…');
    try {
      await accountRequest(selectedAccountId, '/api/account/friends', {
        method: 'POST',
        body: JSON.stringify({
          exclude_viewer_ids: [],
          scan_all: true,
          max_rounds: 8,
        }),
      });
      await loadSession(selectedAccountId);
      setFriendSupportView('available');
      setMessage('好友支援查找完成');
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
      if (runner?.running) {
        await accountRequest(
          selectedAccountId,
          '/api/account/career/runner/stop',
          { method: 'POST', body: '{}' },
        );
      }
      await accountRequest(selectedAccountId, '/api/account/career/delete', {
        method: 'POST',
        body: JSON.stringify({
          current_turn: dashboard.account.career.turn || 1,
        }),
      });
      await loadSession(selectedAccountId);
      setMessage('已放弃当前育成');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const savePreset = async () => {
    if (!presetName.trim()) {
      setError('请填写预设名称');
      return;
    }
    setBusy('preset');
    try {
      const preset = draftPreset();
      const nextPresets = [
        preset,
        ...presets.filter((item) => item.name !== preset.name),
      ];
      setPresets(nextPresets);
      localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
      const deletedPresetNames = JSON.parse(
        localStorage.getItem(DELETED_PRESETS_KEY) || '[]',
      ) as string[];
      localStorage.setItem(
        DELETED_PRESETS_KEY,
        JSON.stringify(
          deletedPresetNames.filter((name) => name !== preset.name),
        ),
      );
      setMessage('预设已保存到本机 UmaShow');
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy('');
    }
  };

  const deletePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const referencedSettings = careerSettings.filter(
      (setting) => setting.preset_name === name,
    );
    if (referencedSettings.length) {
      setError(
        `“${name}”仍被 ${referencedSettings.length} 个养马设置使用。请先到“自动育成”中删除这些养马设置。`,
      );
      return;
    }
    if (!window.confirm(`确定删除预设“${name}”吗？`)) return;
    const nextPresets = presets.filter((preset) => preset.name !== name);
    setPresets(nextPresets);
    localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(nextPresets));
    let deletedPresetNames: string[] = [];
    try {
      const stored = JSON.parse(
        localStorage.getItem(DELETED_PRESETS_KEY) || '[]',
      );
      if (Array.isArray(stored)) deletedPresetNames = stored;
    } catch {
      deletedPresetNames = [];
    }
    localStorage.setItem(
      DELETED_PRESETS_KEY,
      JSON.stringify(Array.from(new Set([...deletedPresetNames, name]))),
    );
    setPresetName(nextPresets[0]?.name || '');
    setMessage(`预设“${name}”已删除`);
    setError('');
  };

  const persistCareerSettings = (nextSettings: CareerSetting[]) => {
    setCareerSettings(nextSettings);
    localStorage.setItem(CAREER_SETTINGS_KEY, JSON.stringify(nextSettings));
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
    setScenarioId(setting.scenario_id || 1);
    setMaxSteps(setting.max_steps || 2500);
    setBurnClocks(Boolean(setting.burn_clocks));
    setRecoverTpWithItem(Boolean(setting.recover_tp_with_item));
    setRecoverTpWithJewels(Boolean(setting.recover_tp_with_jewels));
    setMessage(`已载入养马设置“${setting.name}”`);
  };

  const saveCareerSetting = () => {
    if (!selectedAccount || !dashboard) return;
    const name = careerSettingName.trim();
    if (!name) {
      setError('请填写养马设置名称');
      return;
    }
    if (!presetName || !presets.some((preset) => preset.name === presetName)) {
      setError('请选择一个已保存的预设');
      return;
    }
    if (!cardId || !deckId || !friendCardId || !parent1 || !parent2) {
      setError('请先完整选择育成马娘、卡组、好友支援和两位继承马娘');
      return;
    }
    if (selectionConflict) {
      setError(selectionConflict);
      return;
    }
    const existing = careerSettings.find(
      (setting) => setting.id === selectedCareerSettingId,
    );
    const setting: CareerSetting = {
      id: existing?.id || `${selectedAccount.uid}-${Date.now()}`,
      name,
      account_uid: selectedAccount.uid,
      preset_name: presetName,
      card_id: cardId,
      deck_id: deckId,
      support_card_ids: [...supportCardIds],
      friend_card_id: friendCardId,
      parent_id_1: selectedParent1?.instance_id || 0,
      parent_id_2: selectedParent2?.instance_id || 0,
      parent_key_1: parent1,
      parent_key_2: parent2,
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
    setMessage(`养马设置“${name}”已保存`);
    setError('');
  };

  const deleteCareerSetting = () => {
    const setting = careerSettings.find(
      (item) => item.id === selectedCareerSettingId,
    );
    if (!setting) return;
    if (!window.confirm(`确定删除养马设置“${setting.name}”吗？`)) return;
    persistCareerSettings(
      careerSettings.filter((item) => item.id !== setting.id),
    );
    setSelectedCareerSettingId('');
    setCareerSettingName('');
    setMessage(`养马设置“${setting.name}”已删除`);
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
              onKeyDown={(event) => event.key === 'Enter' && connect()}
              className="min-w-0 flex-1 rounded-md border border-gray-200 px-4 py-3 outline-none focus:border-indigo-400"
              placeholder={DEFAULT_SERVER}
            />
            <button
              type="button"
              onClick={connect}
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
      <div className="mx-auto max-w-none space-y-4">
        <header className="flex min-h-[60px] flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600">
              <Activity size={24} />
              <h1 className="text-xl font-semibold text-gray-800">自动育成</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {server} · 版本 {health?.app_ver} · 并发上限{' '}
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
                : runner?.running
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

        <div className={panelClass('px-3')}>
          <nav
            className="-mb-px flex space-x-8 overflow-x-auto"
            aria-label="自动育成设置"
          >
            {[
              { id: 'accounts' as const, label: '账号', icon: Users },
              { id: 'presets' as const, label: '预设', icon: Settings2 },
              { id: 'career' as const, label: '自动育成', icon: ListChecks },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
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

        {message ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {loginProgress ? (
          <div className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <div className="flex items-center gap-2 font-semibold">
              <RefreshCw className="animate-spin" size={15} />
              登录中 · {loginProgress.elapsed}s
            </div>
            <p className="mt-1">
              {loginProgress.detail}
              {loginProgress.endpoint
                ? ` · Endpoint: ${loginProgress.endpoint}`
                : ''}
              {loginProgress.delay > 0
                ? ` · 本阶段等待约 ${loginProgress.delay.toFixed(3)}s`
                : ''}
            </p>
            <p className="mt-1 text-xs text-cyan-700">
              接口包含模拟操作间隔，请勿重复点击登录。
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
              <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                {captured.length
                  ? `UmaShow 已捕获并持久化 ${captured.length} 个登录凭据。`
                  : '尚未捕获凭据。请保持 UmaShow 开启并重新登录游戏。'}
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`mt-3 rounded-xl border-2 border-dashed p-4 text-center text-sm ${
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

              <div className="mt-3 grid gap-2">
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
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${account.runtime.logged_in ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {loginProgress?.accountId === account.id
                          ? '登录中'
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
                            disabled={busy === `refresh-${account.id}`}
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
                          disabled={loginProgress?.accountId === account.id}
                          className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          <LogIn className="mr-1 inline" size={12} />
                          {loginProgress?.accountId === account.id
                            ? `登录中 ${loginProgress.elapsed}s`
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
                {activeTab !== 'accounts' ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('accounts')}
                    className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    前往账号
                  </button>
                ) : null}
              </section>
            ) : activeTab !== 'presets' &&
              (!selectedAccount?.runtime.logged_in || !dashboard) ? (
              <section className={panelClass('p-12 text-center')}>
                <LogIn className="mx-auto text-slate-300" size={42} />
                <p className="mt-3 text-slate-500">
                  登录后可读取角色、卡组和育成状态。
                </p>
                <button
                  type="button"
                  onClick={() =>
                    selectedAccount &&
                    accountAction(selectedAccount.id, 'login')
                  }
                  disabled={loginProgress?.accountId === selectedAccount?.id}
                  className="mt-4 rounded-md bg-indigo-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {loginProgress?.accountId === selectedAccount?.id
                    ? `登录中 ${loginProgress.elapsed}s · ${loginProgress.detail}`
                    : '登录账号'}
                </button>
              </section>
            ) : (
              <>
                {dashboard && activeTab === 'accounts' ? (
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
                ) : null}

                {activeTab === 'career' && unsupportedCareer ? (
                  <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
                    <h2 className="font-bold">当前养马暂时无法接管</h2>
                    <p className="mt-1 text-sm">
                      检测到进行中的剧本为 scenario_id=
                      {dashboard.account.career?.scenario_id}，目前只支持 URA。
                      请进入游戏手动退出这次养马，然后点击左侧“刷新”。
                    </p>
                  </section>
                ) : null}

                {activeTab === 'presets' ? (
                  <section className={panelClass('p-5')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">预设编辑</h2>
                        <p className="text-sm text-slate-400">
                          技能、赛事和名称均来自当前 master.mdb。
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={deletePreset}
                          disabled={!presetName}
                          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                          删除
                        </button>
                        <button
                          type="button"
                          onClick={savePreset}
                          disabled={busy === 'preset'}
                          className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <Save size={15} />
                          保存预设
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      预设被养马设置使用时不能删除；请先删除引用它的养马设置。
                    </p>

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <label className="text-sm">
                        选择已有预设
                        <select
                          value={
                            presets.some((preset) => preset.name === presetName)
                              ? presetName
                              : ''
                          }
                          onChange={(event) =>
                            setPresetName(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        >
                          <option value="">新建预设</option>
                          {presets.map((preset) => (
                            <option key={preset.name} value={preset.name}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        预设名称
                        <input
                          value={presetName}
                          onChange={(event) =>
                            setPresetName(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
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
                          <option value={0}>默认（使用游戏当前跑法）</option>
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

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <label className="block text-sm">
                        <span className="font-semibold">技能优先级</span>
                        <span className="mt-1 block text-xs text-slate-400">
                          第一行优先级最高；同一行中的技能优先级相同。
                        </span>
                        <textarea
                          value={skillPriorityText}
                          onChange={(event) =>
                            setSkillPriorityText(event.target.value)
                          }
                          rows={6}
                          placeholder={'弧线大师, 曲线行家\n圆弧艺术家, 深呼吸'}
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                        />
                      </label>

                      <div className="rounded-xl border border-red-100 bg-red-50/40 p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-red-800">
                              禁止学习的技能
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              自动购买技能时会完全跳过这里的技能。请使用完整技能名。
                            </p>
                          </div>
                          {blacklistedSkills.length ? (
                            <button
                              type="button"
                              onClick={() => setSkillBlacklistText('')}
                              className="text-xs text-red-600 hover:underline"
                            >
                              清空
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input
                            value={blacklistDraft}
                            onChange={(event) =>
                              setBlacklistDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addBlacklistSkill();
                              }
                            }}
                            list="auto-research-skill-names"
                            placeholder="搜索或填写技能名"
                            className="min-w-0 flex-1 rounded-lg border border-red-100 bg-white px-3 py-2"
                          />
                          <button
                            type="button"
                            onClick={addBlacklistSkill}
                            className="rounded-lg bg-red-600 px-3 py-2 font-semibold text-white"
                          >
                            禁止
                          </button>
                        </div>
                        <datalist id="auto-research-skill-names">
                          {skillNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </datalist>
                        <div className="mt-3 flex min-h-8 flex-wrap gap-2">
                          {blacklistedSkills.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => removeBlacklistSkill(name)}
                              title="点击移除"
                              className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-red-700"
                            >
                              {name} ×
                            </button>
                          ))}
                          {!blacklistedSkills.length ? (
                            <span className="text-xs text-slate-400">
                              尚未禁止任何技能
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={learnOnlyConfigured}
                          onChange={(event) =>
                            setLearnOnlyConfigured(event.target.checked)
                          }
                        />
                        只学习优先级中填写的技能
                      </label>
                      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={skipDoubleCircle}
                          onChange={(event) =>
                            setSkipDoubleCircle(event.target.checked)
                          }
                        />
                        技能Hint等级不足 4 时跳过 ◎ 技能
                      </label>
                      <label className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="font-medium">购买技能回合</span>
                        <input
                          value={skillPurchaseTurnsText}
                          onChange={(event) =>
                            setSkillPurchaseTurnsText(event.target.value)
                          }
                          placeholder="例如：24, 48, 72"
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5"
                        />
                        <span className="mt-1 block text-xs text-slate-400">
                          留空则只在养马结束前购买；填写后会在这些回合额外检查一次
                        </span>
                      </label>
                      <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={compensateFailure}
                          onChange={(event) =>
                            setCompensateFailure(event.target.checked)
                          }
                        />
                        训练评分考虑失败率
                      </label>
                    </div>

                    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <summary className="cursor-pointer font-semibold">
                        高级训练决策设置
                      </summary>
                      <p className="mt-2 text-xs text-slate-500">
                        这些数值会直接影响训练、休息、外出和属性目标的选择。不了解评分逻辑时建议保留默认值。
                      </p>

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
                                          (item) => item !== condition.value,
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
                            达到目标后会降低对应属性训练的优先度，默认采用 URA
                            的通用推荐值
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
                          <p className="text-sm font-semibold">训练基础分</p>
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
                          分期评分参数（低羁绊、高羁绊、体力、技能Hint）
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
                                                    ? Number(event.target.value)
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
                          0 表示该阶段不额外调整；正数提高优先度，负数降低优先度
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
                                    '经典年前半',
                                    '普通阶段',
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
                                                          event.target.value,
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
                                {row.slice(0, 2).map((value, columnIndex) => (
                                  <label
                                    key={`${rowIndex}-${columnIndex}`}
                                    className="text-xs text-slate-500"
                                  >
                                    {columnIndex === 0 ? '低羁绊' : '高羁绊'}
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={value}
                                      onChange={(event) =>
                                        setNpcScoreValue((current) =>
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
                                      const value = Number(event.target.value);
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

                    <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
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
                  </section>
                ) : null}

                {dashboard && activeTab === 'career' ? (
                  <>
                    <section className={panelClass('p-5')}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-bold">育成任务配置</h2>
                          <p className="text-sm text-gray-500">
                            依次选择育成马娘、继承马娘、支援卡组和好友支援。当前仅支持
                            URA。
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {runner?.running ? (
                            <button
                              type="button"
                              onClick={stopCareer}
                              disabled={busy === 'stop'}
                              className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                            >
                              <CircleStop size={17} />
                              停止自动操作
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={runCareer}
                              disabled={busy === 'run' || unsupportedCareer}
                              className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              <Play size={17} />
                              {busy === 'run'
                                ? dashboard.account.career?.active
                                  ? '正在继续育成…'
                                  : '正在寻找好友支援…'
                                : unsupportedCareer
                                  ? '请先放弃当前育成'
                                  : dashboard.account.career?.active
                                    ? '继续自动育成'
                                    : '开始自动育成'}
                            </button>
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

                      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1fr)_auto]">
                          <label className="text-sm text-gray-600">
                            已保存的养马设置
                            <select
                              value={selectedCareerSettingId}
                              onChange={(event) => {
                                const id = event.target.value;
                                if (id) applyCareerSetting(id);
                                else {
                                  setSelectedCareerSettingId('');
                                  setCareerSettingName('');
                                }
                              }}
                              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2"
                            >
                              <option value="">新建养马设置</option>
                              {accountCareerSettings.map((setting) => (
                                <option key={setting.id} value={setting.id}>
                                  {setting.name} · {setting.preset_name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-gray-600">
                            设置名称
                            <input
                              value={careerSettingName}
                              onChange={(event) =>
                                setCareerSettingName(event.target.value)
                              }
                              placeholder={
                                selectedUma
                                  ? `${selectedUma.name} URA`
                                  : '例如：小栗帽 URA'
                              }
                              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2"
                            />
                          </label>
                          <div className="flex items-end gap-2">
                            <button
                              type="button"
                              onClick={saveCareerSetting}
                              className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                            >
                              <Save size={15} />
                              保存设置
                            </button>
                            <button
                              type="button"
                              onClick={deleteCareerSetting}
                              disabled={!selectedCareerSettingId}
                              className="flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                              删除
                            </button>
                          </div>
                        </div>
                      </div>

                      {!dashboard.account.career?.active ? (
                        <div className="mt-5 space-y-5">
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
                            <div className="mt-3 grid max-h-[420px] grid-cols-5 gap-2 overflow-auto pr-1 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
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
                                    const otherParent = dashboard.parents.find(
                                      (item) =>
                                        item.selection_id === otherValue,
                                    );
                                    const blockedCharaIds = new Set([
                                      selectedUma.chara_id,
                                      ...selectedDeckCharaIds,
                                      selectedFriendSupport?.chara_id || 0,
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
                                          otherValue === parent.selection_id ||
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
                            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {dashboard.decks.map((deck) => {
                                const deckCharaIds = deck.cards.map(
                                  (support) => support.chara_id,
                                );
                                const reservedCharaIds = new Set([
                                  selectedUma?.chara_id || 0,
                                  selectedFriendSupport?.chara_id || 0,
                                  selectedParent1?.chara_id || 0,
                                  selectedParent2?.chara_id || 0,
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
                                onClick={() => setFriendSupportView('all')}
                                className={`rounded-md border px-3 py-1.5 text-xs ${
                                  friendSupportView === 'all'
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 bg-white text-gray-600'
                                }`}
                              >
                                全部支援卡
                              </button>
                              <button
                                type="button"
                                onClick={scanFriendSupports}
                                disabled={busy === 'friends'}
                                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50 ${
                                  friendSupportView === 'available'
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 bg-white text-gray-600'
                                }`}
                              >
                                <RefreshCw
                                  size={13}
                                  className={
                                    busy === 'friends' ? 'animate-spin' : ''
                                  }
                                />
                                {busy === 'friends'
                                  ? '正在查找好友支援…'
                                  : `查找可借用支援${availableFriendSupportIds.size ? `（${availableFriendSupportIds.size}）` : ''}`}
                              </button>
                              <span className="text-xs text-gray-400">
                                会检查好友列表中的支援卡，并只保留满破满级卡。
                              </span>
                            </div>
                            <div className="mt-3 grid max-h-[460px] grid-cols-7 gap-1.5 overflow-auto pr-1 sm:grid-cols-9 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 2xl:grid-cols-16">
                              {visibleFriendSupports.map((support) => {
                                const reservedCharaIds = new Set([
                                  selectedUma?.chara_id || 0,
                                  ...selectedDeckCharaIds,
                                  selectedParent1?.chara_id || 0,
                                  selectedParent2?.chara_id || 0,
                                ]);
                                return (
                                  <SupportChoiceCard
                                    key={support.id}
                                    support={support}
                                    selected={friendCardId === support.id}
                                    disabled={reservedCharaIds.has(
                                      support.chara_id,
                                    )}
                                    onSelect={() => setFriendCardId(support.id)}
                                  />
                                );
                              })}
                            </div>
                            {friendSupportView === 'available' &&
                            !visibleFriendSupports.length ? (
                              <div className="py-8 text-center text-sm text-gray-500">
                                当前没有找到符合条件的满破满级好友支援。
                              </div>
                            ) : null}
                          </section>

                          {selectionConflict ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              {selectionConflict}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="text-sm">
                          剧本
                          <select
                            value={scenarioId}
                            onChange={(event) =>
                              setScenarioId(Number(event.target.value))
                            }
                            disabled={dashboard.account.career?.active}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                          >
                            <option value={1}>URA</option>
                          </select>
                        </label>
                        <label className="text-sm">
                          预设
                          <select
                            value={presetName}
                            onChange={(event) =>
                              setPresetName(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                          >
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
                        <label className="mt-6 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          <input
                            type="checkbox"
                            checked={burnClocks}
                            onChange={(event) =>
                              setBurnClocks(event.target.checked)
                            }
                          />
                          比赛失败时使用闹钟
                        </label>
                      </div>

                      {!dashboard.account.career?.active ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                            <input
                              type="checkbox"
                              checked={recoverTpWithItem}
                              onChange={(event) =>
                                setRecoverTpWithItem(event.target.checked)
                              }
                              className="mt-1"
                            />
                            <span>
                              <strong className="block">
                                TP不足时使用体力药
                              </strong>
                              <span className="mt-0.5 block text-xs text-sky-700">
                                优先使用能量饮料30；当前有{' '}
                                {dashboard.account.energy_drinks || 0} 个
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-900">
                            <input
                              type="checkbox"
                              checked={recoverTpWithJewels}
                              onChange={(event) =>
                                setRecoverTpWithJewels(event.target.checked)
                              }
                              className="mt-1"
                            />
                            <span>
                              <strong className="block">
                                仍不足时允许使用宝石
                              </strong>
                              <span className="mt-0.5 block text-xs text-rose-700">
                                会实际消耗宝石恢复TP，默认关闭
                              </span>
                            </span>
                          </label>
                        </div>
                      ) : null}
                    </section>

                    <section className={panelClass('p-5')}>
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">养马进度</h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs ${runner?.running ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {runner?.running
                            ? `养马中 · 第 ${runner.turn || 0} 回合`
                            : runner?.finished
                              ? '本次养马已完成'
                              : '等待开始'}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">已完成行动</p>
                          <p className="font-bold">{runner?.steps || 0} 次</p>
                          <p className="mt-1 text-xs text-slate-400">
                            包括训练、事件和比赛
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">现在正在做</p>
                          <p className="font-bold">
                            {describeRunnerAction(runner?.last_action)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-400">需要你处理</p>
                          <p
                            className={`font-bold ${runner?.last_error ? 'text-red-600' : 'text-emerald-600'}`}
                          >
                            {runner?.last_error || '目前没有需要处理的问题'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-100">
                        {(runner?.log || [])
                          .slice()
                          .reverse()
                          .map((row) => (
                            <div
                              key={row.id}
                              className="grid grid-cols-[58px_72px_110px_minmax(0,1fr)] gap-2 border-b border-slate-50 px-3 py-2 text-xs last:border-0"
                            >
                              <span className="text-slate-400">{row.time}</span>
                              <span>第 {row.turn} 回合</span>
                              <span className="font-semibold">
                                {describeLogAction(row.action)}
                              </span>
                              <span className="text-slate-500">
                                {describeLogDetail(row.detail)}
                              </span>
                            </div>
                          ))}
                        {!runner?.log?.length ? (
                          <p className="p-6 text-center text-sm text-slate-400">
                            暂无运行日志
                          </p>
                        ) : null}
                      </div>
                    </section>
                  </>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
