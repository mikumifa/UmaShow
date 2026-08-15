import { AutoResearchSkill } from './SkillSelector';

export type CapturedCredential = {
  uid: string;
  accessKey: string;
  capturedAt: string;
  source: string;
};

export type RunnerStats = {
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

export type Runner = {
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
  live_activity?: {
    stage: string;
    endpoint: string;
    detail: string;
    delay: number;
    updated_at: number;
  };
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

export type SessionAccount = {
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

export type Account = {
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

export type FactorInfo = {
  id: number;
  name: string;
  stars: number;
  category: string;
  factor_type: number;
  factor_group_id: number;
};

export type FactorSummary = {
  stat: FactorInfo | null;
  distance: FactorInfo | null;
  unique: FactorInfo | null;
  white_count: number;
};

export type SupportInfo = {
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

export type Dashboard = {
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

export type AutoResearchTab =
  | 'accounts'
  | 'presets'
  | 'career'
  | 'progress'
  | 'history';

export type CareerReportSummary = {
  id: string;
  started_at?: string;
  ended_at?: string;
  preset_name: string;
  career_setting_id?: string;
  career_setting_name?: string;
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

export type CareerReport = CareerReportSummary & {
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

export type CareerSetting = {
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

export type RunMode =
  | 'single'
  | 'continuous'
  | 'daily_count'
  | 'jewel_drops'
  | 'daily_jewel_schedule';

export type PendingRun =
  | { type: 'current' }
  | { type: 'saved'; settingId: string };

export type SessionResponse = {
  success: boolean;
  dashboard?: Dashboard;
  runtime?: Partial<Account['runtime']>;
  runner?: Runner;
  relogged_in?: boolean;
};

export type AuthResponse = SessionResponse & {
  token: string;
  expires_at: number;
};

export type SkillLearningSetting = {
  min_hint_level: number;
  learn_when_affordable: boolean;
  purchase_turns: number[];
};

export type SkillSelectionEntry = {
  id: string;
  label: string;
  skill_names: string[];
};

export type Preset = {
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
  maximize_skill_score_at_end?: boolean;
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
  ura_ai?: {
    enabled?: boolean;
    decision_mode?: 'search' | 'model';
    model_path?: string;
    time_budget_s?: number;
    min_rollouts?: number;
    max_rollouts?: number;
    workers?: number;
    risk_factor?: number;
    target_attributes?: number[];
  };
};

export type UmaRlTrainingStatus = {
  state: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  job_id?: string;
  stage?: string;
  detail?: string;
  progress?: number;
  error?: string;
  metrics?: Record<string, number>;
  logs?: Array<{
    id: number;
    time: string;
    stage: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  state_count?: number;
  model_updated?: boolean;
  setting_id?: string;
  setting_name?: string;
  model_path?: string;
};

export type SkillOption = Partial<Omit<AutoResearchSkill, 'id'>> & {
  name?: string;
};

export type RaceOption = {
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

export type LoginProgress = {
  accountId: string;
  loginId: string;
  action: 'login' | 'refresh';
  stage: string;
  endpoint: string;
  detail: string;
  delay: number;
  elapsed: number;
  done?: boolean;
  error?: string;
};

export type LoginProgressResponse = {
  found: boolean;
  stage?: string;
  endpoint?: string;
  detail?: string;
  delay?: number;
  done?: boolean;
  error?: string;
};
