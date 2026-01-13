import { getGameTimeByTurn } from 'constant/gameStat';

export const LIVE_SQUARE_BY_YEAR = {
  /** 第一年的Live（出道战） */
  year1: [
    40001, // 青春在等待
    40002, // 全速！前进！优俊偶像Power☆
    40003, // RUN×RUN！
    40020, // 站位零号！排名第一！
    40006, // Go This Way
    40007, // 相信奇迹吧！
    40009, // 领跑到底！Fallin' Love
    40010, // Ring Ring 日记
  ],

  /** 第二年 · 上半年 */
  year2_h1: [
    40000, // 追逐梦想！
    40013, // A·NO·NE
    40011, // 我们的Blue Bird Days
  ],

  /** 第二年 · 下半年 */
  year2_h2: [
    40005, // 光影下的鼓舞
    40004, // Grow up Shine！
    40017, // 欢乐蹦跳♪晴空万里！
    40008, // 七彩的景色
  ],

  /** 第三年 */
  year3: [
    40018, // Fanfare for Future！
    40019, // 最喜欢的宝箱
    40015, // 梦想的天空
    40016, // PRESENT MARCH♪
    40012, // 世界由我们说了算
    40014, // 春之空BLUE
  ],
} as const;

export type PerfType =
  | 1 // Speed
  | 2 // Stamina
  | 3 // Power
  | 4 // Guts
  | 5; // Wisdom

export interface LiveSquare {
  id: number;
  name: string;
  description: string;
  squareType: number;
  perfType: PerfType[];
  perfValue: number[];
  liveBonus: string;
  weight: number;
}

export const getLivePoolIdsByTurn = (turn: number) => {
  const { year, month } = getGameTimeByTurn(turn);
  const ids: number[] = [];
  const seen = new Set<number>();
  const pushUnique = (list: readonly number[]) => {
    list.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });
  };

  if (year <= 1) {
    pushUnique(LIVE_SQUARE_BY_YEAR.year1);
  } else if (year === 2 && month <= 6) {
    pushUnique(LIVE_SQUARE_BY_YEAR.year1);
    pushUnique(LIVE_SQUARE_BY_YEAR.year2_h1);
  } else if (year === 2 && month >= 7) {
    pushUnique(LIVE_SQUARE_BY_YEAR.year1);
    pushUnique(LIVE_SQUARE_BY_YEAR.year2_h1);
    pushUnique(LIVE_SQUARE_BY_YEAR.year2_h2);
  } else {
    pushUnique(LIVE_SQUARE_BY_YEAR.year1);
    pushUnique(LIVE_SQUARE_BY_YEAR.year2_h1);
    pushUnique(LIVE_SQUARE_BY_YEAR.year2_h2);
    pushUnique(LIVE_SQUARE_BY_YEAR.year3);
  }

  return ids;
};

export const LIVE_SQUARE_MAP: Record<number, LiveSquare> = {
  40000: {
    id: 40000,
    name: '追逐梦想！',
    description: 'pt增量  +2',
    squareType: 4,
    perfType: [2, 4],
    perfValue: [21, 21],
    liveBonus: '擅长率 +5',
    weight: 4,
  },
  40001: {
    id: 40001,
    name: '青春在等待',
    description: '力量 +22',
    squareType: 4,
    perfType: [3, 5],
    perfValue: [32, 12],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40002: {
    id: 40002,
    name: '全速！前进！优俊偶像Power☆',
    description: '速度 +22',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [32, 12],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40003: {
    id: 40003,
    name: 'RUN×RUN！',
    description: '技能点数 +22',
    squareType: 4,
    perfType: [1, 4, 5],
    perfValue: [14, 16, 14],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40004: {
    id: 40004,
    name: 'Grow up Shine！',
    description: 'pt增量  +3',
    squareType: 4,
    perfType: [1, 3, 5],
    perfValue: [21, 21, 21],
    liveBonus: '支援卡 +1',
    weight: 4,
  },
  40005: {
    id: 40005,
    name: '光影下的鼓舞',
    description: '智力增量  +2',
    squareType: 4,
    perfType: [2, 5],
    perfValue: [42, 21],
    liveBonus: '支援卡 +1',
    weight: 3,
  },
  40006: {
    id: 40006,
    name: 'Go This Way',
    description: '力量增量  +1',
    squareType: 4,
    perfType: [3, 5],
    perfValue: [21, 21],
    liveBonus: '支援卡 +1',
    weight: 1,
  },
  40007: {
    id: 40007,
    name: '相信奇迹吧！',
    description: '智力增量  +1',
    squareType: 4,
    perfType: [2, 5],
    perfValue: [21, 21],
    liveBonus: '擅长率 +5',
    weight: 1,
  },
  40008: {
    id: 40008,
    name: '七彩的景色',
    description: '力量增量  +2',
    squareType: 4,
    perfType: [3, 5],
    perfValue: [21, 42],
    liveBonus: '擅长率 +5',
    weight: 3,
  },
  40009: {
    id: 40009,
    name: "领跑到底！Fallin' Love",
    description: '毅力增量  +1',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [21, 21],
    liveBonus: '支援卡 +1',
    weight: 1,
  },
  40010: {
    id: 40010,
    name: 'Ring Ring 日记',
    description: '耐力增量  +1',
    squareType: 4,
    perfType: [2, 4],
    perfValue: [21, 21],
    liveBonus: '支援卡 +1',
    weight: 1,
  },
  40011: {
    id: 40011,
    name: '我们的Blue Bird Days',
    description: '速度增量  +2',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [21, 42],
    liveBonus: '擅长率 +5',
    weight: 3,
  },
  40012: {
    id: 40012,
    name: '世界由我们说了算',
    description: '耐力 +22',
    squareType: 4,
    perfType: [2, 3],
    perfValue: [32, 12],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40013: {
    id: 40013,
    name: 'A·NO·NE',
    description: '毅力增量  +2',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [42, 21],
    liveBonus: '擅长率 +5',
    weight: 3,
  },
  40014: {
    id: 40014,
    name: '春之空BLUE',
    description: '毅力 +22',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [12, 32],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40015: {
    id: 40015,
    name: '梦想的天空',
    description: '智力 +22',
    squareType: 4,
    perfType: [2, 5],
    perfValue: [22, 22],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40016: {
    id: 40016,
    name: 'PRESENT MARCH♪',
    description: '力量 +22',
    squareType: 4,
    perfType: [3, 5],
    perfValue: [22, 22],
    liveBonus: '友情 +5%',
    weight: 4,
  },
  40017: {
    id: 40017,
    name: '欢乐蹦跳♪晴空万里！',
    description: '耐力增量  +2',
    squareType: 4,
    perfType: [2, 3],
    perfValue: [42, 21],
    liveBonus: '擅长率 +5',
    weight: 3,
  },
  40018: {
    id: 40018,
    name: 'Fanfare for Future！',
    description: '毅力 +26',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [26, 42],
    liveBonus: '友情 +10%',
    weight: 4,
  },
  40019: {
    id: 40019,
    name: '最喜欢的宝箱',
    description: '速度 +26',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [42, 26],
    liveBonus: '友情 +10%',
    weight: 4,
  },
  40020: {
    id: 40020,
    name: '站位零号！排名第一！',
    description: '速度增量  +1',
    squareType: 4,
    perfType: [1, 4],
    perfValue: [21, 21],
    liveBonus: '支援卡 +1',
    weight: 1,
  },
};

export const COMMAND_TO_MASTER_BONUS: Record<number, number> = {
  // 1006: 40091, excluded
  1032: 40000,
  1040: 40001,
  1044: 40002,
  1003: 40003,
  1012: 40004,
  1043: 40005,
  1042: 40006,
  1038: 40007,
  1045: 40008,
  1046: 40009,
  1047: 40010,
  1023: 40011,
  1021: 40012,
  1011: 40013,
  1014: 40014,
  1041: 40015,
  1039: 40016,
  1034: 40017,
  1020: 40018,
  1024: 40019,
  1036: 40092,
  1057: 40020,
  // 1029: 40092, excluded
};
