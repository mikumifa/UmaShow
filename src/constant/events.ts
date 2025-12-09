import { EventOption } from "../types/gameTypes";
export type EventOptionGroup = Record<number, EventOption>;

export interface EventRule {
  name: string;
  options: EventOptionGroup[]; // ⭐ 注意：这里是数组
}
export const EXACT_EVENT_RULES: Record<string, EventRule>  = {
  "501006720": {
    name: "打针",
    options: [
      {
        1: { desp: "全属性+20", detail: "全属性+20", type: "correct" },
      },
      {
        3: { desp: "获得技能", detail: "弯道回复 直线回复", type: "correct" },
      },
      {
        5: { desp: "体力+40,体力上限+12", detail: "体力+40,体力上限+12", type: "correct" },
      },
      {
        7: { desp: "惹人喜爱，体力+20", detail: "惹人喜爱，体力+20", type: "correct" },
      },
    ]
  },
  "830078001": {
    name: "福来连续事件1",
    options: [
      {
        1: { desp: "全属性+7", detail: "全属性+7", type: "correct" },
        2: { desp: "智力+4", detail: "+4智力", type: "wrong" },
      },
    ]
  },
  "830078002": {
    name: "福来连续事件2",
    options: [
      {
        1: { desp: "全属性+7", detail: "全属性+7", type: "correct" },
        2: { desp: "智力+4", detail: "+4智力", type: "wrong" },
      },
    ]
  },
  "809006004": {
    name: "理事长事件1",
    options: [
      {
        2: { desp: "独行侠", detail: "独行侠，断事件", type: "correct" },
      },
    ]
  }
};

export const REGEX_EVENT_RULES: { pattern: RegExp; rule: EventRule }[] = [
  {
    pattern: /^50\d{4}708$/,
    rule: {
      name: "比赛胜利",
      options: [
        {
          1: { desp: "-20体力, 无道具", detail: "-20体力, 无道具", type: "wrong" }, //没给道具
          2: { desp: "-20体力, 有道具", detail: "-20体力, 有道具", type: "correct" }, //给道具
        },   {
          1: { desp: "-10体力, 有道具", detail: "-20体力, 有道具", type: "correct" }, //给道具
          2: { desp: "-10体力, 无道具", detail: "-10体力, 无道具", type: "wrong" }, //无道具
          3: { desp: "-25体力, 有道具", detail: "-25体力, 有道具", type: "correct" }, //给道具
          4: { desp: "-25体力, 无道具", detail: "-25体力, 无道具", type: "wrong" }, //没给道具
        },
      ],
    },
  },  {
    pattern: /^50\d{4}709$/,
    rule: {
      name: "比赛结束",
      options: [
        {
          1: { desp: "-25体力, 无道具", detail: "-25体力, 无道具", type: "wrong" }, //没给道具
          2: { desp: "-25体力, 有道具", detail: "-25体力, 有道具", type: "correct" }, //给道具
        },   {
          1: { desp: "-10体力, 有道具", detail: "-20体力, 有道具", type: "correct" }, //给道具
          2: { desp: "-10体力, 无道具", detail: "-10体力, 无道具", type: "wrong" }, //无道具
          3: { desp: "-25体力, 有道具", detail: "-25体力, 有道具", type: "correct" }, //给道具
          4: { desp: "-25体力, 无道具", detail: "-25体力, 无道具", type: "wrong" }, //没给道具
        },
      ],
    },
  },
];



export function resolveEventRule(storyId: number) {
  const idStr = storyId.toString();

  // 1. EXACT 匹配（原样）
  const exact = EXACT_EVENT_RULES[idStr];
  if (exact) return exact;

  // 3. REGEX 匹配（新增）
  for (const entry of REGEX_EVENT_RULES) {
    if (entry.pattern.test(idStr)) {
      return entry.rule;
    }
  }

  return null;
}


