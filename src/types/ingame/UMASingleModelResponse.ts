export interface UMASingleModelResponse {
  response_code: number;
  data_headers: DataHeaders;
  data: Data;
}

export interface Data {
  chara_info: CharaInfo;
  not_up_parameter_info: NotUpParameterInfo;
  not_down_parameter_info: NotDownParameterInfo;
  home_info: HomeInfo;
  unchecked_event_array: any[];
  event_effected_factor_array: null;
  race_condition_array: RaceConditionArray[];
  race_start_info: null;
  free_data_set: FreeDataSet;
}
export interface UnchekedEventArray {
  event_id: number;
  chara_id: number;
  story_id: number;
  play_timing: number;
  event_contents_info: EventContentsInfo;
  succession_event_info: null;
  minigame_result: null;
}

export interface EventContentsInfo {
  support_card_id: number;
  show_clear: number;
  show_clear_sort_id: number;
  choice_array: ChoiceArray[];
}

export interface ChoiceArray {
  select_index: number;
  receive_item_id: number;
  target_race_id: number;
}

export interface CharaInfo {
  single_mode_chara_id: number;
  card_id: number;
  chara_grade: number;
  speed: number;
  stamina: number;
  power: number;
  wiz: number;
  guts: number;
  vital: number;
  max_speed: number;
  max_stamina: number;
  max_power: number;
  max_wiz: number;
  max_guts: number;
  default_max_speed: number;
  default_max_stamina: number;
  default_max_power: number;
  default_max_wiz: number;
  default_max_guts: number;
  max_vital: number;
  motivation: number;
  fans: number;
  rarity: number;
  race_program_id: number;
  reserve_race_program_id: number;
  race_running_style: number;
  is_short_race: number;
  proper_ground_turf: number;
  proper_ground_dirt: number;
  proper_running_style_nige: number;
  proper_running_style_senko: number;
  proper_running_style_sashi: number;
  proper_running_style_oikomi: number;
  proper_distance_short: number;
  proper_distance_mile: number;
  proper_distance_middle: number;
  proper_distance_long: number;
  talent_level: number;
  skill_array: SkillArray[];
  disable_skill_id_array: any[];
  skill_tips_array: SkillTipsArray[];
  support_card_array: SupportCardArray[];
  succession_trained_chara_id_1: number;
  succession_trained_chara_id_2: number;
  turn: number;
  skill_point: number;
  short_cut_state: number;
  state: number;
  playing_state: number;
  scenario_id: number;
  route_id: number;
  start_time: Date;
  evaluation_info_array: EvaluationInfoArray[];
  training_level_info_array: TrainingLevelInfoArray[];
  nickname_id_array: number[];
  chara_effect_id_array: any[];
  route_race_id_array: number[];
  guest_outing_info_array: any[];
}

export interface EvaluationInfoArray {
  target_id: number;
  training_partner_id: number;
  evaluation: number;
  is_outing: number;
  story_step: number;
  is_appear: number;
  group_outing_info_array: any[];
}

export interface SkillArray {
  skill_id: number;
  level: number;
}

export interface SkillTipsArray {
  group_id: number;
  rarity: number;
  level: number;
}

export interface SupportCardArray {
  position: number;
  support_card_id: number;
  limit_break_count: number;
  exp: number;
  owner_viewer_id: number;
}

export interface TrainingLevelInfoArray {
  command_id: number;
  level: number;
}

export interface FreeDataSet {
  shop_id: number;
  sale_value: number;
  win_points: number;
  prev_win_points: number;
  gained_coin_num: number;
  coin_num: number;
  twinkle_race_ranking: number;
  user_item_info_array: null;
  pick_up_item_info_array: PickUpItemInfoArray[];
  twinkle_race_npc_info_array: any[];
  item_effect_array: null;
  twinkle_race_npc_result_array: any[];
  command_info_array: FreeDataSetCommandInfoArray[];
  rival_race_info_array: RivalRaceInfoArray[];
  unchecked_event_achievement_id: null;
}

export interface FreeDataSetCommandInfoArray {
  command_type: number;
  command_id: number;
  params_inc_dec_info_array: any[];
}

export interface PickUpItemInfoArray {
  shop_item_id: number;
  item_id: number;
  coin_num: number;
  original_coin_num: number;
  item_buy_num: number;
  limit_buy_count: number;
  limit_turn: number;
}

export interface RivalRaceInfoArray {
  program_id: number;
  chara_id: number;
}

export interface HomeInfo {
  command_info_array: HomeInfoCommandInfoArray[];
  race_entry_restriction: number;
  disable_command_id_array: any[];
  available_continue_num: number;
  available_free_continue_num: number;
  free_continue_num: number;
  free_continue_time: number;
  shortened_race_state: number;
}

export interface HomeInfoCommandInfoArray {
  command_type: number;
  command_id: number;
  is_enable: number;
  training_partner_array: number[];
  tips_event_partner_array: any[];
  params_inc_dec_info_array: ParamsIncDECInfoArray[];
  failure_rate: number;
  level: number;
}

export interface ParamsIncDECInfoArray {
  target_type: number;
  value: number;
}

export interface NotDownParameterInfo {
  evaluation_chara_id_array: any[];
}

export interface NotUpParameterInfo {
  status_type_array: any[];
  chara_effect_id_array: any[];
  skill_id_array: any[];
  skill_tips_array: any[];
  skill_lv_id_array: any[];
  evaluation_chara_id_array: any[];
  command_lv_array: any[];
  has_chara_effect_id_array: any[];
  unsupported_evaluation_chara_id_array: any[];
  not_gain_chara_effect_array: any[];
}

export interface RaceConditionArray {
  program_id: number;
  weather: number;
  ground_condition: number;
}

export interface DataHeaders {
  viewer_id: number;
  sid: string;
  servertime: number;
  result_code: number;
  buma_session_token: string;
  notifications: Notifications;
}

export interface Notifications {
  unchecked_new_follower_count: number;
  trophy_badge_flag: number;
  new_honor_data_array: NewHonorDataArray[];
}

export interface NewHonorDataArray {
  honor_id: number;
  create_time: Date;
}

export function isUMASingleModelResponse(
  payload: unknown,
): payload is UMASingleModelResponse {
  if (!payload || typeof payload !== 'object') return false;
  const maybe = payload as Partial<UMASingleModelResponse>;
  const hasDataObject =
    maybe.data != null && typeof maybe.data === 'object' && 'chara_info' in maybe.data;
  return typeof maybe.response_code === 'number' && hasDataObject;
}
