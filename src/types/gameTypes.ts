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
  motivation?: number;
  startTime?: string | number | Date;
  liveMasterIds?: number[];
  nextLiveIds?: number[];
  effectedLiveIds?: number[];
  specialtyLiveEffectCount?: number;
  specialtyLiveEffectRate?: number;
  currentTrainingPartnerCount?: number;
  currentTrainingPartnerUniqueCount?: number;
}

export interface CharaEffect {
  id: number;
  text: string;
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

export interface VenusGroupOutingInfo {
  charaId: number;
  isOuting: number;
  storyStep: number;
}

export interface VenusEvaluationInfo {
  targetId: number;
  trainingPartnerId: number;
  evaluation: number;
  charaId: number;
  memberState: number;
  isOuting: number;
  storyStep: number;
  isAppear: number;
  groupOutingInfo: VenusGroupOutingInfo[];
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
  charaEffects?: CharaEffect[];
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
  archiveId?: string;
  raceMetaInfo: RaceMetaInfo;
  scenario: string;
  horses: RaceHorseInfo[];
}

export interface RaceArchive {
  id: string;
  name: string;
  createdAt: number;
}

export interface TrainingHistorySupportCard {
  position: number;
  supportCardId: number;
  limitBreak: number;
  exp: number;
}

export interface TrainingHistorySummary {
  viewerId: number;
  singleModeCharaId: number;
  cardId: number;
  rarity: number;
  startTime?: string | number | Date;
  updatedAt: number;
  packetCount: number;
  turnCount: number;
  supportCards: TrainingHistorySupportCard[];
}

export interface TrainingHistorySkill {
  skillId: number;
  level: number;
}

export interface TrainingHistorySkillTip {
  groupId: number;
  rarity: number;
  level: number;
}

export interface TrainingHistoryVenusSpirit {
  spiritNum: number;
  spiritId: number;
  effectGroupId: number;
}

export interface TrainingHistoryVenusGoddessLevel {
  charaId: number;
  venusLevel: number;
}

export interface TrainingHistoryTurnSnapshot {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wiz: number;
  skillPoint: number;
  motivation: number;
  vital: number;
  maxVital: number;
  effectIds: number[];
  skills: TrainingHistorySkill[];
  skillTips: TrainingHistorySkillTip[];
  venusSpirits: TrainingHistoryVenusSpirit[];
  venusGoddessLevels: TrainingHistoryVenusGoddessLevel[];
}

export interface TrainingHistoryTurnVenusSpiritDelta {
  spiritNum: number;
  spiritId: number;
  effectGroupId: number;
}

export interface TrainingHistoryTurnVenusLevelDelta {
  charaId: number;
  beforeLevel: number;
  afterLevel: number;
}

export interface TrainingHistoryTurnDelta {
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wiz: number;
  skillPoint: number;
  motivation: number;
  vital: number;
  addedEffectIds: number[];
  removedEffectIds: number[];
  addedVenusSpirits: TrainingHistoryTurnVenusSpiritDelta[];
  removedVenusSpirits: TrainingHistoryTurnVenusSpiritDelta[];
  venusLevelChanges: TrainingHistoryTurnVenusLevelDelta[];
}

export interface TrainingHistoryTrainingContribution {
  source: string;
  value: number;
  supportCardId?: number;
}

export interface TrainingHistoryTrainingTargetEstimate {
  targetType: number;
  observed: number;
  estimated: number;
  approxScenarioBase: number;
  supportBonus: number;
  supportBonusSources: TrainingHistoryTrainingContribution[];
  friendshipMultiplier: number;
  friendshipSources: TrainingHistoryTrainingContribution[];
  trainingEffectPercent: number;
  trainingEffectSources: TrainingHistoryTrainingContribution[];
  motivationMultiplier: number;
  motivationBase: number;
  motivationSupportPercent: number;
  motivationSources: TrainingHistoryTrainingContribution[];
  growthMultiplier: number;
  growthPercent: number;
  partnerMultiplier: number;
  partnerCount: number;
}

export interface TrainingHistoryTrainingEstimate {
  commandId: number;
  commandLevel: number;
  partnerCount: number;
  supportPartnerCount: number;
  targetType: number;
  presentSupportCardIds: number[];
  targets: TrainingHistoryTrainingTargetEstimate[];
  notes: string[];
}

export type TrainingHistoryTurnEntry =
  | {
      type: 'command';
      packetIndex: number;
      receivedAt: number;
      commandResult: unknown;
      delta?: TrainingHistoryTurnDelta | null;
      trainingEstimate?: TrainingHistoryTrainingEstimate;
    }
  | {
      type: 'event';
      packetIndex: number;
      receivedAt: number;
      event: unknown;
      storyId?: number;
      delta?: TrainingHistoryTurnDelta | null;
    }
  | {
      type: 'delta';
      packetIndex: number;
      receivedAt: number;
      title: string;
      delta?: TrainingHistoryTurnDelta | null;
    };

export interface TrainingHistoryTurn {
  turn: number;
  snapshot: TrainingHistoryTurnSnapshot;
  entries: TrainingHistoryTurnEntry[];
}

export interface TrainingHistoryPacket {
  sequence: number;
  receivedAt: number;
  payload: unknown;
  endpoint?: string;
  request?: Record<string, unknown>;
}

export interface TrainingHistoryAnalysis {
  version: number;
  summary: TrainingHistorySummary;
  turns: TrainingHistoryTurn[];
}

export interface TrainingHistoryRecord {
  id: string;
  filename: string;
  fullPath: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  summary: TrainingHistorySummary;
  analysis: TrainingHistoryAnalysis;
  packets: TrainingHistoryPacket[];
  status?: 'paused' | 'finished' | 'error' | string;
}

export interface TrainingHistoryConfig {
  maxCachedRuns: number;
  favoriteIds: string[];
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
  let { livePurchasedIds } = prev;
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
  701: '休息',
  302: '外出',
  390: '友人卡外出',
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
  701: TARGET_TYPE.VITAL,
  0: TARGET_TYPE.UNKNOWN,
};
