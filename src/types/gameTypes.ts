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
  coinNum: number;
  startTime?: string | number | Date;
  liveMasterIds?: number[];
  nextLiveIds?: number[];
  effectedLiveIds?: number[];
  specialtyLiveEffectCount?: number;
  specialtyLiveEffectRate?: number;
  currentTrainingPartnerCount?: number;
  currentTrainingPartnerUniqueCount?: number;
}

export type ScenarioType = 'idolCup' | 'venusCup' | 'unknown';

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

export interface LivePerformanceDelta {
  performanceType: number;
  value: number;
}

export interface LiveCommandParam {
  targetType: number;
  value: number;
}

export interface LiveCommand {
  commandId: number;
  commandType: number;
  performance: LivePerformanceDelta[];
  params: LiveCommandParam[];
}

export interface VenusCommandInfo {
  commandId: number;
  commandType: number;
  params: CommandParam[];
}

export interface VenusEvaluationInfo {
  targetId: number;
  charaId: number;
  memberState: number;
}

export interface VenusSpiritInfo {
  spiritNum: number;
  spiritId: number;
  effectGroupId: number;
}

export interface VenusActiveSpiritEffect {
  charaId: number;
  effectGroupId: number;
  beginTurn: number;
  endTurn: number;
}

export interface VenusCharaInfo {
  charaId: number;
  venusLevel: number;
}

export interface VenusCharaCommandInfo {
  commandId: number;
  commandType: number;
  spiritId: number;
  isBoost: number;
}

export interface VenusData {
  commandInfo: VenusCommandInfo[];
  evaluationInfo: VenusEvaluationInfo[];
  spiritInfo: VenusSpiritInfo[];
  activeEffectInfo: VenusActiveSpiritEffect[];
  charaInfo: VenusCharaInfo[];
  charaCommandInfo: VenusCharaCommandInfo[];
  liveItemId: number;
}

export interface PartnerStat {
  position: number;
  supportCardId: number; // if id == 0, this is not a support card
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

export interface StoryDetailOption {
  option: string;
  gainList: string[];
}

export interface StoryDetail {
  storyId: number;
  optionList: StoryDetailOption[];
}

export interface PartnerStats extends Array<PartnerStat> {}
export interface GameEvents extends Array<GameEvent> {}
export interface TrainingCommands extends Array<TrainingCommand> {}
export interface LiveCommands extends Array<LiveCommand> {}
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
  scenarioType: ScenarioType;
  partnerStats: PartnerStats;
  gameEvents: GameEvents;
  gameStats: GameStats;
  stats: CharStats;
  commands: TrainingCommands;
  songStats?: SongStats;
  noteStat?: NoteStat;
  liveCommands?: LiveCommands;
  livePurchasedIds?: number[];
  eventDetails?: Record<number, StoryDetail>;
  venusData?: VenusData;
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
  const scenarioChanged =
    incoming.scenarioType != null &&
    incoming.scenarioType !== prev.scenarioType;
  const pickScenarioScopedValue = <T>(
    incomingValue: T | undefined,
    prevValue: T | undefined,
  ) => {
    if (!isEmptyField(incomingValue)) {
      return incomingValue;
    }
    if (scenarioChanged) {
      return incomingValue;
    }
    return prevValue;
  };
  let livePurchasedIds = prev.livePurchasedIds;
  if (incoming.livePurchasedIds != null) {
    livePurchasedIds = incoming.livePurchasedIds;
  } else if (scenarioChanged) {
    livePurchasedIds = incoming.livePurchasedIds;
  }

  return {
    ...incoming,
    scenarioType: incoming.scenarioType ?? prev.scenarioType,
    stats: isEmptyField(incoming.stats) ? prev.stats : incoming.stats,
    partnerStats: isEmptyField(incoming.partnerStats)
      ? prev.partnerStats
      : incoming.partnerStats,
    commands: isEmptyField(incoming.commands)
      ? prev.commands
      : incoming.commands,
    liveCommands: pickScenarioScopedValue(
      incoming.liveCommands,
      prev.liveCommands,
    ),
    venusData: pickScenarioScopedValue(incoming.venusData, prev.venusData),
    songStats: pickScenarioScopedValue(incoming.songStats, prev.songStats),
    noteStat: pickScenarioScopedValue(incoming.noteStat, prev.noteStat),
    livePurchasedIds,
    gameStats: isEmptyField(incoming.gameStats)
      ? prev.gameStats
      : {
          ...prev.gameStats,
          ...incoming.gameStats,
        },
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
};
