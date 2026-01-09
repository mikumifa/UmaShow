export interface CharStat {
  value: number; // 当前值
  max: number; // 最大值
}
// =============================
// Character Stats Types
// =============================
export interface CharStats {
  speed: CharStat;
  stamina: CharStat;
  power: CharStat;
  wiz: CharStat;
  guts: CharStat;
  vital: CharStat;
  skillPoint: number;
}

export interface NoteStat {
  da: CharStat;
  pa: CharStat;
  vo: CharStat;
  vi: CharStat;
  me: CharStat;
}

export interface GameStats {
  turn: number;
}

// =============================
// Training Command Types
// =============================
export interface CommandParam {
  targetType: number;
  value: number;
}

export interface TrainingCommand {
  commandId: number;
  commandType: number;
  isEnable: number;
  failureRate: number;
  level: number;
  trainingPartners: number[];
  tipsPartners: number[];
  params: CommandParam[];
}

export interface PartnerStat {
  position: number;
  supportCardId: number;
  charaPath: string;
  evaluation: number; // 来自 evaluation_info_array
  limitBreak: number;
  exp: number;
}

export interface EventOption {
  desp: string;
  detail: string;
  type: 'correct' | 'wrong' | 'neutral' | 'unknown';
}

export interface GameEvent {
  eventId: number;
  eventName: string;
  options: EventOption[];
}

export interface PartnerStats extends Array<PartnerStat> {}
export interface GameEvents extends Array<GameEvent> {}
export interface TrainingCommands extends Array<TrainingCommand> {}
export interface SongStatAttribute {
  label: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'warning';
  icon?: string;
  color?: string;
}

export interface SongStat {
  id: number;
  title: string;
  tag: string;
  coverUrl?: string;
  attributes: SongStatAttribute[];
  notes: Record<'da' | 'pa' | 'vo' | 'vi' | 'me', number>;
}

export interface SongStats extends Array<SongStat> {}

// =============================
// Wrapper for Character Info
// =============================
export interface CharInfo {
  partnerStats: PartnerStats;
  gameEvents: GameEvents;
  gameStats: GameStats;
  stats: CharStats;
  commands: TrainingCommands;
  songStats?: SongStats;
  noteStat?: NoteStat;
}

export interface RaceHorseInfo {
  select_index?: number;
  receive_item_id?: number;
  target_race_id?: number;
  [key: string]: unknown;
}

export interface RaceMetaInfo {
  race_instance_id: number; // 比赛实例 ID
  season: number; // 赛季
  weather: number; // 天气
  ground_condition: number; // 地面状况
  random_seed: number; // 随机种子
  entry_num?: number | null; // 报名人数
  current_entry_num?: number | null; // 实际参赛人数
  [key: string]: unknown;
}
export interface RaceRecord {
  filename: string;
  fullPath: string;
  createdAt: number;
  raceMetaInfo: RaceMetaInfo;
  scenario: string;
  horses: RaceHorseInfo[];
}

export function isEmptyField(field: any): boolean {
  if (field == null) return true;
  if (typeof field !== 'object') return false;
  return Object.keys(field).length === 0;
}

export function mergeCharInfo(prev: CharInfo, incoming: CharInfo): CharInfo {
  return {
    ...incoming,
    stats: isEmptyField(incoming.stats) ? prev.stats : incoming.stats,
    partnerStats: isEmptyField(incoming.partnerStats)
      ? prev.partnerStats
      : incoming.partnerStats,
    commands: isEmptyField(incoming.commands)
      ? prev.commands
      : incoming.commands,
    songStats: isEmptyField(incoming.songStats)
      ? prev.songStats
      : incoming.songStats,
    noteStat: isEmptyField(incoming.noteStat)
      ? prev.noteStat
      : incoming.noteStat,
  };
}

export enum TARGET_TYPE {
  SPEED = 1,
  STAMINA = 2,
  POWER = 3,
  GUTS = 4,
  WIZ = 5,
  VITAL = 10,
  SKILL_PTS = 30,
  UNKNOWN = 0,
}

export const COMMAND_NAME_MAP: Record<number, string> = {
  101: '速度训练',
  105: '耐力训练',
  102: '力量训练',
  103: '毅力训练',
  106: '智力训练',
  601: '速度夏训',
  602: '耐力夏训',
  603: '力量夏训',
  604: '毅力夏训',
  605: '智力夏训',
  // 301: "休息",
  // 390: "外出",
  // 401: "保健室",
  // 701: "比赛报名",
};
export const COMMAND_TARGET_TYPE_MAP: Record<number, TARGET_TYPE> = {
  101: TARGET_TYPE.SPEED,
  105: TARGET_TYPE.STAMINA,
  102: TARGET_TYPE.POWER,
  103: TARGET_TYPE.GUTS,
  106: TARGET_TYPE.WIZ,
  601: TARGET_TYPE.SPEED,
  604: TARGET_TYPE.GUTS,
  602: TARGET_TYPE.STAMINA,
  603: TARGET_TYPE.POWER,
  605: TARGET_TYPE.WIZ,
  0: TARGET_TYPE.UNKNOWN,
  // 301: "休息",
  // 390: "外出",
  // 401: "保健室",
  // 701: "比赛报名",
};
