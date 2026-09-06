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

export type CareerRunQueueGoal =
  | 'single'
  | 'continuous'
  | 'count'
  | 'jewel_drops';

export type CareerRunQueueItem = {
  id: string;
  career_setting_id: string;
  goal: CareerRunQueueGoal;
  target: number;
};

export type CareerRunQueueState = {
  active: boolean;
  status?: 'idle' | 'running' | 'completed' | 'paused' | 'stopped';
  repeat_daily?: boolean;
  session_id: string;
  started_at: string;
  current_index: number;
  stop_reason: string;
  items: Array<
    CareerRunQueueItem & {
      career_setting_name: string;
      career_mode: 'online' | 'offline';
      status:
        | 'pending'
        | 'queued'
        | 'running'
        | 'completed'
        | 'skipped'
        | 'paused'
        | 'failed'
        | 'stopped';
      completed_runs: number;
      stop_reason: string;
      started_at?: string;
      ended_at?: string;
    }
  >;
};

export type Runner = {
  run_id?: string;
  state_epoch?: string;
  state_revision?: number;
  running?: boolean;
  stopping?: boolean;
  started_at?: string;
  ended_at?: string;
  preset?: string;
  scenario_id?: number;
  current_turn?: number;
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
  chara_score?: number;
  large_margin_count?: number;
  large_margin_race_counts?: Record<string, number>;
  daily_jewel_drop_count?: number;
  daily_jewels_earned?: number;
  daily_jewel_drop_limit?: number;
  daily_jewel_reset_time?: string;
  run_plan?: {
    active: boolean;
    paused?: boolean;
    session_id?: string;
    started_at?: string;
    mode:
      | 'single'
      | 'continuous'
      | 'count'
      | 'daily_count'
      | 'jewel_drops'
      | 'daily_jewel_drops';
    repeat_daily?: boolean;
    target: number;
    completed_runs: number;
    completed_jewel_drops: number;
    daily_completed_runs: number;
    stop_reason: string;
    queue?: CareerRunQueueState | null;
  };
  daily_jewel_schedule?: {
    enabled: boolean;
    mode?: 'single' | 'continuous' | 'count' | 'jewel_drops' | 'queue';
    target: number;
    start_time: string;
    end_time: string;
    status: string;
    last_error: string;
    daily_jewel_drop_count?: number;
    completed_runs?: number;
    completed_day?: string;
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
  rental_succession?: {
    known: boolean;
    used: number;
    max: number;
    remaining: number;
  };
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
  idle_single_mode?: {
    detected: boolean;
    active: boolean;
    state: 'none' | 'playing' | 'finished' | 'log_checked' | 'unknown';
    state_code: number;
    card_id?: number | string;
    name?: string;
    scenario_id?: number;
    current_turn?: number;
    started_at?: string;
    ends_at?: string;
    source?: string;
    observed_at?: string;
  };
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
    session_owner?: 'local' | 'server' | 'none';
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

export type OfflineSingleModeScenario = {
  id: number;
  name: string;
  sort_id: number;
};

export type Dashboard = {
  account: SessionAccount;
  offline_scenarios: OfflineSingleModeScenario[];
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
    friend_state?: number;
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
    win_saddle_ids?: number[];
    factors: FactorInfo[];
    factor_summary: FactorSummary;
    ancestors: Array<{
      position_id: number;
      card_id: number;
      chara_id: number;
      race_cloth_id: number;
      rarity: number;
      name: string;
      win_saddle_ids?: number[];
      factors: FactorInfo[];
      factor_summary: FactorSummary;
    }>;
  }>;
  friends: Array<{
    viewer_id: number;
    friend_state?: number;
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
  | 'daily'
  | 'history';

export type DailyTaskResult = {
  status: string;
  detail: string;
  finished_at?: string;
  count?: number;
};

export type DailyTasksConfig = {
  schema_version?: number;
  run_with_career: boolean;
  daily_race: {
    enabled: boolean;
    daily_race_id: number;
    trained_chara_id: number;
    running_style: number;
  };
  daily_legend_race: {
    enabled: boolean;
    daily_legend_race_id: number;
    trained_chara_id: number;
    running_style: number;
  };
  team_stadium: {
    enabled: boolean;
    opponent_strength: number;
  };
  limited_shop: {
    enabled: boolean;
    buy_all: true;
  };
  status?: string;
  schedule_day?: string;
  daily_race_done?: boolean;
  daily_legend_race_done?: boolean;
  limited_shop_open_count?: number;
  pending_shop_sources?: string[];
  last_trigger?: string;
  last_run_date?: string;
  last_started_at?: string;
  last_finished_at?: string;
  last_error?: string;
  task_results?: Record<string, DailyTaskResult>;
  updated_at?: string;
};

export type DailyTasksOptions = {
  availability: {
    daily_race: {
      available: boolean;
      can_run_now: boolean;
      ticket_count: number;
      reason: string;
    };
    daily_legend_race: {
      available: boolean;
      can_run_now: boolean;
      ticket_count: number;
      reason: string;
    };
    team_stadium: {
      available: boolean;
      can_run_now: boolean;
      current_rp: number;
      term_open: boolean;
      reason: string;
    };
  };
  daily_races: Array<{
    id: number;
    group_id: number;
    difficulty: number;
    name: string;
    distance: number;
    distance_type: 'short' | 'mile' | 'middle' | 'long';
    ground: number;
    ground_name: string;
    race_track_id: number;
  }>;
  daily_legend_races: Array<{
    id: number;
    card_id: number;
    piece_id: number;
    owned_piece_count: number;
    difficulty: number;
    name: string;
    distance: number;
    distance_type: 'short' | 'mile' | 'middle' | 'long';
    ground: number;
    ground_name: string;
    race_track_id: number;
  }>;
  trained_charas: Array<{
    trained_chara_id: number;
    card_id: number;
    name: string;
    rank_score: number;
    running_style: number;
    rarity: number;
    race_cloth_id: number;
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wit: number;
    proper_distance_short: number;
    proper_distance_mile: number;
    proper_distance_middle: number;
    proper_distance_long: number;
    proper_running_style_nige: number;
    proper_running_style_senko: number;
    proper_running_style_sashi: number;
    proper_running_style_oikomi: number;
    proper_ground_turf: number;
    proper_ground_dirt: number;
  }>;
};

export type DailyTasksResponse = {
  success: boolean;
  daily_tasks: DailyTasksConfig;
  options: Partial<DailyTasksOptions>;
};

export type CareerSessionAttributes = {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wit: number;
};

export type G123RaceRecord = {
  race_id: number;
  program_id: number;
  turn: number;
  race_name?: string;
  recorded_at: string;
  large_margin: boolean;
};

export type CareerSessionRun = {
  run_id?: string;
  training_history_id?: string;
  started_at?: string;
  ended_at?: string;
  completed: boolean;
  discarded: boolean;
  card_id: number;
  attributes: CareerSessionAttributes;
  large_margin_count: number;
  large_margin_race_counts: Record<string, number>;
  g123_race_counts?: Record<string, number>;
  g123_race_records?: G123RaceRecord[];
  jewel_drop_count: number;
  jewels_earned: number;
  last_error: string;
};

export type CareerSessionRecord = {
  id: string;
  schema_version: number;
  session_id: string;
  uid: string;
  started_at: string;
  ended_at: string;
  preset_name: string;
  career_setting_id: string;
  career_setting_name: string;
  card_id: number;
  mode: string;
  target: number;
  stop_reason: string;
  error: string;
  count: number;
  attributes_total: CareerSessionAttributes;
  attributes_average: CareerSessionAttributes;
  large_margin_count: number;
  large_margin_race_counts: Record<string, number>;
  g123_race_counts?: Record<string, number>;
  g123_race_records?: G123RaceRecord[];
  jewel_drop_count: number;
  jewels_earned: number;
  runs: CareerSessionRun[];
  current?: CareerSessionRun | null;
};

export type OfflineFactorTarget = {
  factor_group_id: number;
  name: string;
  kind: 'aptitude' | 'skill';
  weight: number;
};

export type OfflineSkillSettings = {
  enabled: boolean;
  learn_skill_list: string[][];
  learn_skill_group_labels: string[];
  learn_skill_settings: Record<
    string,
    {
      min_hint_level: number;
      learn_when_affordable: boolean;
      purchase_turns: number[];
    }
  >;
  learn_skill_only_user_provided: boolean;
  skip_double_circle_unless_high_hint: boolean;
  maximize_skill_score_at_end: boolean;
};

export type OfflineFactorSelection = {
  enabled: boolean;
  evaluation_mode: 'parent' | 'ancestor';
  use_skill_priority: boolean;
  blue_factor_minimums: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wit: number;
  };
  targets: OfflineFactorTarget[];
  lineage: {
    mode: 'none' | 'specific' | 'rules';
    selection_id: string;
    tree: {
      parent: {
        chara_id: number;
        red_factor_group_id: number;
        red_factor_stars: number;
        route_id: string;
        min_factor_stars?: number;
      };
      ancestor_1: {
        chara_id: number;
        red_factor_group_id: number;
        red_factor_stars: number;
        route_id: string;
        min_factor_stars?: number;
      };
      ancestor_2: {
        chara_id: number;
        red_factor_group_id: number;
        red_factor_stars: number;
        route_id: string;
        min_factor_stars?: number;
      };
    };
    chara_ids: number[];
    ancestor_chara_ids: number[];
    min_parent_factor_stars: number;
    min_ancestor_factor_stars: number;
  };
};

export type CareerSetting = {
  id: string;
  name: string;
  account_uid: string;
  mode?: 'online' | 'offline';
  preset_name: string;
  card_id: number;
  deck_id: number;
  deck_name?: string;
  support_card_ids: number[];
  friend_card_id: number;
  friend_key?: string;
  friend_support_name?: string;
  parent_id_1: number;
  parent_id_2: number;
  parent_key_1?: string;
  parent_key_2?: string;
  parent_1_snapshot?: {
    card_id: number;
    name: string;
    rarity: number;
    race_cloth_id: number;
  };
  parent_2_snapshot?: {
    card_id: number;
    name: string;
    rarity: number;
    race_cloth_id: number;
  };
  scenario_id?: number;
  offline_scenario_id?: number;
  max_steps: number;
  burn_clocks: boolean;
  recover_tp_with_item: boolean;
  recover_tp_with_jewels: boolean;
  offline_race_deck_num?: number;
  offline_priority_skill_ids?: number[];
  offline_skill_settings?: OfflineSkillSettings;
  factor_selection?: OfflineFactorSelection;
  /** Legacy saved field; read for compatibility with existing settings. */
  offline_factor_selection?: OfflineFactorSelection;
  run_queue?: CareerRunQueueItem[];
  updated_at: string;
};

export type RunMode =
  | 'single'
  | 'continuous'
  | 'count'
  | 'daily_count'
  | 'jewel_drops'
  | 'daily_jewel_drops'
  | 'daily_jewel_schedule'
  | 'queue';

export type PendingRun =
  | { type: 'current' }
  | { type: 'saved'; settingId: string }
  | { type: 'append'; settingId: string };

export type OfflineSingleModeRace = {
  year: number;
  program_id: number;
};

export type OfflineSingleModeRaceDeck = {
  deck_num: number;
  deck_name: string;
  race_array: OfflineSingleModeRace[];
};

export type OfflineSingleModeSetup = {
  scenario_id: number;
  scenario_name: string;
  scenarios: OfflineSingleModeScenario[];
  required_race_array: OfflineSingleModeRace[];
  default_deck_num: number;
  needs_default_confirm: boolean;
  race_decks: OfflineSingleModeRaceDeck[];
};

export type SessionResponse = {
  success: boolean;
  dashboard?: Dashboard;
  runtime?: Partial<Account['runtime']>;
  runner?: Runner;
  logged_in?: boolean;
  session_owner?: Account['runtime']['session_owner'];
  last_error?: string;
  last_refreshed_at?: string;
  account?: SessionAccount | null;
  relogged_in?: boolean;
  offline_setup?: OfflineSingleModeSetup;
};

export type AccountOptionsResponse = {
  success: boolean;
  options: Pick<
    Dashboard,
    | 'umas'
    | 'supports'
    | 'decks'
    | 'parents'
    | 'friends'
    | 'friend_exclude_ids'
    | 'offline_scenarios'
  >;
};

export type HostedControlResponse = SessionResponse & {
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

export type TargetAttributeStage = {
  turn: number;
  target_attributes: number[];
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
  learn_skill_only_user_provided?: boolean;
  skip_double_circle_unless_high_hint?: boolean;
  maximize_skill_score_at_end?: boolean;
  skill_purchase_turns?: number[];
  fixed_event_choices?: Record<string, number>;
  extra_race_list?: number[];
  expect_attribute?: number[];
  target_attribute_stages?: TargetAttributeStage[];
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
