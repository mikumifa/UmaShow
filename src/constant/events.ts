import { EventOption } from '../types/gameTypes';

export type EventOptionGroup = Record<number, EventOption>;

export interface EventRule {
  name: string;
  options: EventOptionGroup[];
}
export const EXACT_EVENT_RULES: Record<string, EventRule> = {
  '830078001': {
    name: '福来连续事件1',
    options: [
      {
        1: { desp: '全属性+7', detail: '全属性+7', type: 'correct' },
        2: { desp: '智力+4', detail: '+4智力', type: 'wrong' },
      },
    ],
  },

  '830078002': {
    name: '福来连续事件2',
    options: [
      {
        1: { desp: '全属性+7', detail: '全属性+7', type: 'correct' },
        2: { desp: '智力+4', detail: '+4智力', type: 'wrong' },
      },
    ],
  },
  '809006004': {
    name: '理事长事件1',
    options: [
      {
        1: { desp: '成功', detail: '成功', type: 'correct' },
        2: { desp: '独行侠', detail: '独行侠，断事件', type: 'wrong' },
      },
    ],
  },

  '809008011': {
    name: 'b95事件',
    options: [
      {
        1: {
          desp: '干劲[2]速度[10]',
          detail:
            '成支援角色[明亮光晕]友情槽提升[5];干劲提升[2];速度提升[10];技能[领跑诀窍○]灵感等级提升[1];技能[跟前诀窍○]灵感等级提升[1]功',
          type: 'correct',
        },
        2: {
          desp: '干劲[1]速度[5]',
          detail:
            '支援角色[明亮光晕]友情槽提升[5];干劲提升[1];速度提升[5];技能[领跑诀窍○]灵感等级提升[1];技能[跟前诀窍○]灵感等级提升[1]',
          type: 'wrong',
        },
      },
      {
        1: {
          desp: '体力[10]毅力[5]',
          detail: '支援角色[明亮光晕]友情槽提升[5];体力提升[10];毅力提升[5]',
          type: 'correct',
        },
        2: {
          desp: '体力[15]毅力[10]',
          detail: '支援角色[明亮光晕]友情槽提升[5];体力提升[15];毅力提升[10]',
          type: 'wrong',
        },
      },
    ],
  },
  '830101001': {
    name: '速子事件',
    options: [
      {},
      {
        2: {
          desp: '无低语',
          detail:
            '支援角色[爱丽速子]友情槽提升[5];速度提升[5];智力提升[5];技能[跟前直线○]灵感等级提升[1]',
          type: 'wrong',
        },
        1: {
          desp: '有低语',
          detail:
            '支援角色[爱丽速子]友情槽提升[5];速度提升[5];耐力提升[5];智力提升[5];技能[跟前直线○]灵感等级提升[3];技能[低语]灵感等级提升[1]',
          type: 'correct',
        },
      },
    ],
  },
  '501006801': {
    name: '小栗帽惹人喜爱事件',
    options: [
      {
        1: { desp: '营养补给', detail: '营养补给', type: 'wrong' },
        2: {
          desp: '惹人喜爱',
          detail: '惹人喜爱，营养补给',
          type: 'correct',
        },
      },
      {
        1: {
          desp: '毅力+10，力量+5',
          detail: '毅力+10，力量+5',
          type: 'wrong',
        },
        2: {
          desp: '惹人喜爱',
          detail: '惹人喜爱，毅力+10，力量+5',
          type: 'correct',
        },
      },
    ],
  },
  '501006524': {
    name: '小栗帽干饭事件',
    options: [
      {
        1: {
          desp: '体力[30];力量[10];pt[10]',
          detail: '体力提升[30];力量提升[10];技能点数提升[10]',
          type: 'correct',
        },
        2: {
          desp: '长胖了',
          detail:
            '体力提升[30];技能点数提升[10];获得[长胖倾向];速度降低[5];力量提升[5]',
          type: 'wrong',
        },
      },
      {
        1: {
          desp: '体力[10];力量[5];技能点数[5]',
          detail: '体力提升[10];力量提升[5];技能点数提升[5]',
          type: 'correct',
        },
      },
      {
        1: {
          desp: '长胖倾向',
          detail:
            '体力提升[200];速度降低[20];力量提升[20];技能点数提升[20];获得[长胖倾向]',
          type: 'wrong',
        },
        2: {
          desp: '体力[200];力量[20];PT[20]',
          detail: '体力提升[200];力量提升[20];技能点数提升[20]',
          type: 'correct',
        },
      },
    ],
  },
  '501018802': {
    name: '气槽惹人喜爱事件',
    options: [
      {
        1: { desp: '无', detail: '无', type: 'wrong' },
        2: {
          desp: '惹人喜爱',
          detail: '惹人喜爱',
          type: 'correct',
        },
      },
      {
        1: { desp: '无', detail: '无', type: 'wrong' },
        2: {
          desp: '惹人喜爱',
          detail: '惹人喜爱',
          type: 'correct',
        },
      },
    ],
  },
};

export const REGEX_EVENT_RULES: { pattern: RegExp; rule: EventRule }[] = [
  {
    pattern: /^50\d{4}708$/,
    rule: {
      name: '比赛胜利',
      options: [
        {
          1: {
            desp: '-20体力, 无道具',
            detail: '-20体力, 无道具',
            type: 'wrong',
          }, // 没给道具
          2: {
            desp: '-20体力, 有道具',
            detail: '-20体力, 有道具',
            type: 'correct',
          }, // 给道具
        },
        {
          1: {
            desp: '-10体力, 有道具',
            detail: '-10体力, 有道具',
            type: 'correct',
          }, // 给道具
          2: {
            desp: '-10体力, 无道具',
            detail: '-10体力, 无道具',
            type: 'wrong',
          }, // 无道具
          3: {
            desp: '-25体力, 有道具',
            detail: '-25体力, 有道具',
            type: 'correct',
          }, // 给道具
          4: {
            desp: '-25体力, 无道具',
            detail: '-25体力, 无道具',
            type: 'wrong',
          }, // 没给道具
        },
      ],
    },
  },

  {
    pattern: /^50\d{4}709$/,
    rule: {
      name: '比赛结束',
      options: [
        {
          1: {
            desp: '-25体力, 无道具',
            detail: '-25体力, 无道具',
            type: 'wrong',
          }, // 没给道具
          2: {
            desp: '-25体力, 有道具',
            detail: '-25体力, 有道具',
            type: 'correct',
          }, // 给道具
        },
        {
          1: {
            desp: '-15体力, 有道具',
            detail: '-15体力, 有道具',
            type: 'correct',
          }, // 给道具
          2: {
            desp: '-15体力, 无道具',
            detail: '-15体力, 无道具',
            type: 'wrong',
          }, // 无道具
          3: {
            desp: '-25体力, 有道具',
            detail: '-25体力, 有道具',
            type: 'correct',
          }, // 给道具
          4: {
            desp: '-25体力, 无道具',
            detail: '-25体力, 无道具',
            type: 'wrong',
          }, // 没给道具
        },
      ],
    },
  },
  {
    pattern: /^50\d{4}516$/,
    rule: {
      name: '大胃王',
      options: [
        {},
        {
          1: {
            desp: '体力+30，pt+10',
            detail: '体力+30，pt+10',
            type: 'correct',
          },
          2: {
            desp: '肥胖，体力+30，pt+10',
            detail: '生病',
            type: 'wrong',
          },
        },
      ],
    },
  },
  {
    pattern: /^50\d{4}720$/,
    rule: {
      name: '打针',
      options: [
        {
          1: { desp: '全属性+20', detail: '全属性+20', type: 'correct' },
          2: { desp: '失败', detail: '失败', type: 'wrong' },
        },
        {
          3: { desp: '获得技能', detail: '弯道回复 直线回复', type: 'correct' },
          4: { desp: '失败', detail: '失败', type: 'wrong' },
        },
        {
          5: {
            desp: '体力+40,体力上限+12',
            detail: '体力+40,体力上限+12',
            type: 'correct',
          },
          6: { desp: '失败', detail: '失败', type: 'wrong' },
        },
        {
          7: {
            desp: '惹人喜爱，体力+20',
            detail: '惹人喜爱，体力+20',
            type: 'correct',
          },
          8: { desp: '失败', detail: '失败', type: 'wrong' },
        },
      ],
    },
  },
];

export function resolveEventRule(storyId: number) {
  const idStr = storyId.toString();

  const exact = EXACT_EVENT_RULES[idStr];
  if (exact) return exact;
  const matched = REGEX_EVENT_RULES.find((entry) => entry.pattern.test(idStr));
  if (matched) return matched.rule;

  return null;
}
