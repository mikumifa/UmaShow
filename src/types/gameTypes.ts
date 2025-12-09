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

// =============================
// Wrapper for Character Info
// =============================
export interface CharInfo {
  partnerStats: PartnerStats;
  gameEvents: GameEvents;
  gameStats: GameStats;
  stats: CharStats;
  commands: TrainingCommands;
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
  // 301: "休息",
  // 390: "外出",
  // 401: "保健室",
  // 701: "比赛报名",
};
