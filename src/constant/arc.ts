export interface ArcPotentialMeta {
  id: number;
  name: string;
  row: number;
  queue: number;
  maxLevel: number;
  levelCosts: Partial<Record<number, number>>;
  levelEffects: Record<number, string>;
}

export const ARC_POTENTIALS: ArcPotentialMeta[] = [
  {
    id: 1,
    name: '海外草地适应性',
    row: 2,
    queue: 1,
    maxLevel: 3,
    levelCosts: { 2: 100, 3: 200 },
    levelEffects: {
      1: '训练时力量 +3',
      2: '克服海外赛力量 -200 难关',
      3: '远征时力量训练效果 +50%',
    },
  },
  {
    id: 2,
    name: '隆尚适应性',
    row: 1,
    queue: 1,
    maxLevel: 3,
    levelCosts: { 2: 50, 3: 200 },
    levelEffects: {
      1: '训练时毅力 +3',
      2: '克服海外赛草地适性下降',
      3: '远征时毅力训练效果 +50%',
    },
  },
  {
    id: 3,
    name: '生活节奏',
    row: 3,
    queue: 1,
    maxLevel: 3,
    levelCosts: { 2: 100, 3: 200 },
    levelEffects: {
      1: '训练时技能点 +10',
      2: '克服海外赛耐力 -200 难关',
      3: '训练时技能点再 +10',
    },
  },
  {
    id: 4,
    name: '营养管理',
    row: 2,
    queue: 2,
    maxLevel: 3,
    levelCosts: { 2: 100, 3: 200 },
    levelEffects: {
      1: '训练时速度 +3',
      2: '克服海外赛速度 -200 难关',
      3: '远征时速度训练效果 +50%',
    },
  },
  {
    id: 5,
    name: '法语能力',
    row: 1,
    queue: 2,
    maxLevel: 3,
    levelCosts: { 2: 50, 3: 200 },
    levelEffects: {
      1: '训练时耐力 +3',
      2: '克服海外赛中距离适性下降',
      3: '远征时耐力训练效果 +50%',
    },
  },
  {
    id: 6,
    name: '海外远征',
    row: 2,
    queue: 3,
    maxLevel: 3,
    levelCosts: { 2: 100, 3: 200 },
    levelEffects: {
      1: '训练时智力 +3',
      2: '克服海外赛智力 -200 难关',
      3: '远征时智力训练效果 +50%',
    },
  },
  {
    id: 7,
    name: '大心脏',
    row: 3,
    queue: 2,
    maxLevel: 3,
    levelCosts: { 2: 200, 3: 300 },
    levelEffects: {
      1: '训练时耐力 +3',
      2: '克服海外赛速度/耐力/毅力 -100 难关',
      3: '远征训练体力消耗 -20%',
    },
  },
  {
    id: 8,
    name: '意志力',
    row: 3,
    queue: 3,
    maxLevel: 3,
    levelCosts: { 2: 200, 3: 300 },
    levelEffects: {
      1: '训练时毅力 +3',
      2: '克服海外赛速度/力量/智力 -100 难关',
      3: '友情训练效果 +20%',
    },
  },
  {
    id: 9,
    name: 'L’Arc的希望',
    row: 4,
    queue: 1,
    maxLevel: 2,
    levelCosts: { 2: 200 },
    levelEffects: {
      1: '所有训练效果 +5%',
      2: '克服海外赛全属性 -250 难关',
    },
  },
  {
    id: 10,
    name: '凯旋门奖连霸之梦',
    row: 4,
    queue: 2,
    maxLevel: 2,
    levelCosts: { 2: 150 },
    levelEffects: {
      1: '凯旋门奖中获得 3 个特定技能启发',
      2: '凯旋门奖赛事中获得的属性提升',
    },
  },
];

export const ARC_POTENTIAL_BY_ID = Object.fromEntries(
  ARC_POTENTIALS.map((item) => [item.id, item]),
) as Record<number, ArcPotentialMeta>;

export const ARC_POTENTIAL_CONDITIONS: Record<number, string> = {
  1: '群星赛获胜 10 次',
  2: '群星赛获胜 2 次',
  4: '群星赛获胜 10 次',
  5: '群星赛获胜 2 次',
  6: '参加海外远征',
  7: '一级赛事获胜 1 次',
  8: '一级赛事获胜 1 次',
  9: '群星赛获胜 40 次',
  10: '赢下凯旋门奖',
  11: '参加海外远征',
  12: '参加尼尔锦标',
  13: '参加尼尔锦标',
  14: '继承队员托付的信念',
};

export const ARC_TAG_BOOST_LABELS: Record<number, string> = {
  0: '无群星槽特殊加成',
  1: '标签成员的群星槽提升量翻倍',
  2: '所有训练伙伴的群星槽提升量翻倍',
  3: '按标签人数提高所有伙伴的群星槽',
};

export const ARC_SELECTION_EFFECT_LABELS: Record<number, string> = {
  1: '擅长率 +5',
  2: '擅长率 +5',
  3: '友情训练效果 +5%',
  4: '友情训练效果 +10%',
  5: '友情训练效果 +10%',
  6: '协助连续事件率 +1级',
  7: '协助连续事件率 +1级',
  8: '协助连续事件率 +1级',
  9: '擅长率 +5',
  10: '擅长率 +5',
  11: '协助连续事件率 +1级',
  12: '协助连续事件率 +1级',
};

const ARC_TRAINING_EFFECT_RANGES = [
  [0, 4, 0],
  [5, 9, 5],
  [10, 14, 8],
  [15, 19, 10],
  [20, 24, 13],
  [25, 29, 15],
  [30, 34, 16],
  [35, 39, 17],
  [40, 44, 18],
  [45, 49, 19],
  [50, 54, 20],
  [55, 59, 21],
  [60, 64, 22],
  [65, 69, 23],
  [70, 74, 24],
  [75, 79, 25],
  [80, 84, 26],
  [85, 89, 27],
  [90, 94, 28],
  [95, 99, 29],
  [100, 109, 30],
  [110, 119, 31],
  [120, 129, 32],
  [130, 139, 33],
  [140, 149, 34],
  [150, 159, 35],
  [160, 169, 36],
  [170, 179, 37],
  [180, 189, 38],
  [190, 199, 39],
  [200, 999, 40],
] as const;

export const getArcTrainingEffect = (approvalRate: number) =>
  ARC_TRAINING_EFFECT_RANGES.find(
    ([min, max]) => approvalRate >= min && approvalRate <= max,
  )?.[2] ?? 0;

export const getArcPotentialIconPath = (potentialId: number) =>
  `./icons/arc/potential_${String(potentialId).padStart(2, '0')}.png`;
