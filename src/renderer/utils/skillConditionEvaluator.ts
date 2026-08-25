import courseDataJson from '../../../assets/data/course_data.json';
import skillDataJson from '../../../assets/data/skill_data.json';

type CompareOp = '==' | '!=' | '>' | '>=' | '<' | '<=';
type LogicOp = '&' | '@';

type CourseDataEntry = {
  distance: number;
  distanceType: number;
  surface: number;
  turn: number;
  courseSetStatus?: number[];
  corners: Array<{ start: number; length: number }>;
  straights: Array<{ start: number; end: number; frontType?: number }>;
  slopes: Array<{ start: number; length: number; slope: number }>;
};

type SkillAlternative = {
  precondition?: string;
  condition?: string;
  baseDuration: number;
  effects: Array<{ type: number; modifier: number; target: number }>;
};

type SkillActivationData = Record<
  string,
  { rarity: number; alternatives: SkillAlternative[] }
>;

type ExprNode =
  | { type: 'cmp'; condition: string; operator: CompareOp; argument: number }
  | { type: 'logic'; operator: LogicOp; left: ExprNode; right: ExprNode };

type EvaluationResult = {
  state: 'pass' | 'fail' | 'unknown';
  reasons: string[];
};

export type SkillStaticContext = {
  courseId: number;
  season?: number;
  weather?: number;
  groundCondition?: number;
  horse: {
    speed: number;
    stamina: number;
    power: number;
    guts: number;
    wiz: number;
    baseSpeed: number;
    baseStamina: number;
    basePower: number;
    baseGuts: number;
    baseWiz: number;
    runningStyle: number;
    motivation?: number;
    popularity?: number;
    postNumber?: number;
  };
};

export type SkillStaticEvaluation = {
  skillId: string;
  alternativeIndex: number;
  rarity: number;
  precondition: string;
  condition: string;
  state: 'pass' | 'fail' | 'unknown' | 'missing';
  reasons: string[];
};

const courseData = courseDataJson as Record<string, CourseDataEntry>;
const skillData = skillDataJson as SkillActivationData;

export function getSkillAlternatives(skillId: number | string) {
  return skillData[String(skillId)]?.alternatives ?? [];
}

export function getSkillBaseDurations(skillId: number | string) {
  return getSkillAlternatives(skillId).map((alternative) => alternative.baseDuration);
}

const selfOrAllySkillTargets = new Set([1, 7, 11, 22]);

export function isInterferenceSkill(skillId: number | string) {
  return getSkillAlternatives(skillId).some((alternative) =>
    alternative.effects.some(
      (effect) => !selfOrAllySkillTargets.has(effect.target),
    ),
  );
}

export function resolveRaceSkillDurationParam(
  skillId: number | string,
  frameTime: number | undefined,
  durationParam: number | undefined,
  courseDistance: number,
) {
  if (durationParam == null) {
    return {
      durationParam: undefined,
      isPermanent: false,
      inferredFromSkillData: false,
      baseDurations: [] as number[],
    };
  }

  if (durationParam !== -1) {
    return {
      durationParam,
      isPermanent: false,
      inferredFromSkillData: false,
      baseDurations: [] as number[],
    };
  }

  const baseDurations = getSkillBaseDurations(skillId);
  if (frameTime !== 0) {
    return {
      durationParam: -1,
      isPermanent: true,
      inferredFromSkillData: false,
      baseDurations,
    };
  }

  const nonPermanentDurations = Array.from(
    new Set(baseDurations.filter((baseDuration) => baseDuration !== -1)),
  );

  if (nonPermanentDurations.length === 0) {
    return {
      durationParam: -1,
      isPermanent: true,
      inferredFromSkillData: false,
      baseDurations,
    };
  }

  return {
    durationParam: Math.round((nonPermanentDurations[0] * courseDistance) / 1000),
    isPermanent: false,
    inferredFromSkillData: true,
    baseDurations,
  };
}

function compareNumber(left: number, operator: CompareOp, right: number) {
  switch (operator) {
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
  }
}

function rangeCanSatisfy(
  min: number,
  max: number,
  operator: CompareOp,
  argument: number,
) {
  switch (operator) {
    case '==':
      return min <= argument && argument <= max;
    case '!=':
      return min !== max || min !== argument;
    case '>':
      return max > argument;
    case '>=':
      return max >= argument;
    case '<':
      return min < argument;
    case '<=':
      return min <= argument;
  }
}

function setCanSatisfy(values: number[], operator: CompareOp, argument: number) {
  return values.some((value) => compareNumber(value, operator, argument));
}

function tokenize(input: string) {
  const tokens: Array<string> = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '@' || char === '&') {
      tokens.push(char);
      index += 1;
      continue;
    }
    const op = input.slice(index, index + 2);
    if (['==', '!=', '>=', '<='].includes(op)) {
      tokens.push(op);
      index += 2;
      continue;
    }
    if (char === '>' || char === '<') {
      tokens.push(char);
      index += 1;
      continue;
    }
    const numberMatch = input.slice(index).match(/^\d+/);
    if (numberMatch) {
      tokens.push(numberMatch[0]);
      index += numberMatch[0].length;
      continue;
    }
    const identMatch = input.slice(index).match(/^[a-z0-9_]+/);
    if (identMatch) {
      tokens.push(identMatch[0]);
      index += identMatch[0].length;
      continue;
    }
    throw new Error(`invalid token at ${input.slice(index)}`);
  }

  return tokens;
}

function parseExpression(input: string): ExprNode | null {
  if (!input.trim()) return null;
  const tokens = tokenize(input);
  let index = 0;

  function parseComparison(): ExprNode {
    const condition = tokens[index++];
    const operator = tokens[index++] as CompareOp;
    const rawArgument = tokens[index++];
    if (!condition || !operator || rawArgument == null) {
      throw new Error(`invalid expression: ${input}`);
    }
    return {
      type: 'cmp',
      condition,
      operator,
      argument: Number(rawArgument),
    };
  }

  function parseAnd(): ExprNode {
    let node = parseComparison();
    while (tokens[index] === '&') {
      index += 1;
      node = {
        type: 'logic',
        operator: '&',
        left: node,
        right: parseComparison(),
      };
    }
    return node;
  }

  let node = parseAnd();
  while (tokens[index] === '@') {
    index += 1;
    node = {
      type: 'logic',
      operator: '@',
      left: node,
      right: parseAnd(),
    };
  }
  return node;
}

function mergeAnd(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.state === 'fail') return left;
  if (right.state === 'fail') return right;
  if (left.state === 'pass' && right.state === 'pass') {
    return { state: 'pass', reasons: [] };
  }
  return {
    state: 'unknown',
    reasons: [...left.reasons, ...right.reasons],
  };
}

function mergeOr(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.state === 'pass' || right.state === 'pass') {
    return { state: 'pass', reasons: [] };
  }
  if (left.state === 'fail' && right.state === 'fail') {
    return {
      state: 'fail',
      reasons: [...left.reasons, ...right.reasons],
    };
  }
  return {
    state: 'unknown',
    reasons: [...left.reasons, ...right.reasons],
  };
}

function evalComparator(
  course: CourseDataEntry,
  ctx: SkillStaticContext,
  condition: string,
  operator: CompareOp,
  argument: number,
): EvaluationResult {
  const { horse } = ctx;
  const directValueMap: Record<string, number | undefined> = {
    distance_type: course.distanceType,
    track_id: ctx.courseId,
    ground_type: course.surface,
    ground_condition: ctx.groundCondition,
    weather: ctx.weather,
    season: ctx.season,
    rotation: course.turn,
    running_style: horse.runningStyle,
    motivation: horse.motivation,
    popularity: horse.popularity,
    post_number: horse.postNumber,
    course_distance: course.distance,
    base_speed: horse.baseSpeed,
    base_stamina: horse.baseStamina,
    base_power: horse.basePower,
    base_guts: horse.baseGuts,
    base_wiz: horse.baseWiz,
  };
  const directValue = directValueMap[condition];
  if (directValue != null) {
    return compareNumber(directValue, operator, argument)
      ? { state: 'pass', reasons: [] }
      : {
          state: 'fail',
          reasons: [`${condition}${operator}${argument}`],
        };
  }

  const ranges: Record<string, [number, number]> = {
    distance_rate: [0, 100],
    distance_rate_after_random: [0, 100],
    remain_distance: [0, course.distance],
  };
  const range = ranges[condition];
  if (range) {
    return rangeCanSatisfy(range[0], range[1], operator, argument)
      ? { state: 'pass', reasons: [] }
      : {
          state: 'fail',
          reasons: [`${condition}${operator}${argument}`],
        };
  }

  if (condition === 'phase' || condition === 'phase_random') {
    return setCanSatisfy([0, 1, 2, 3], operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`${condition}${operator}${argument}`] };
  }

  if (
    condition === 'phase_firsthalf' ||
    condition === 'phase_firsthalf_random' ||
    condition === 'phase_firstquarter' ||
    condition === 'phase_firstquarter_random' ||
    condition === 'phase_laterhalf_random'
  ) {
    return setCanSatisfy([0, 1, 2, 3], operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`${condition}${operator}${argument}`] };
  }

  if (condition === 'corner_count') {
    const count = course.corners.length;
    return compareNumber(count, operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`corner_count=${count}`] };
  }

  const boolLikeMap: Record<string, boolean> = {
    corner: course.corners.length > 0,
    corner_random: course.corners.length > 0,
    all_corner_random: course.corners.length > 0,
    is_finalcorner: course.corners.length > 0,
    is_finalcorner_random: course.corners.length > 0,
    is_finalcorner_laterhalf: course.corners.length > 0,
    is_last_straight: course.straights.length > 0,
    is_last_straight_onetime: course.straights.length > 0,
    straight_random: course.straights.length > 0,
    last_straight_random: course.straights.length > 0,
    phase_corner_random: course.corners.length > 0,
    phase_straight_random: course.straights.length > 0,
    down_slope_random: course.slopes.some((s) => s.slope < 0),
    up_slope_random: course.slopes.some((s) => s.slope > 0),
    is_dirtgrade: course.surface === 2,
  };
  if (condition in boolLikeMap) {
    const value = boolLikeMap[condition] ? 1 : 0;
    return compareNumber(value, operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`${condition}=${value}`] };
  }

  if (condition === 'slope') {
    const values = [
      0,
      ...(course.slopes.some((s) => s.slope > 0) ? [1] : []),
      ...(course.slopes.some((s) => s.slope < 0) ? [2] : []),
    ];
    return setCanSatisfy(values, operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`slope${operator}${argument}`] };
  }

  if (condition === 'straight_front_type') {
    const values = course.straights
      .map((straight) => straight.frontType)
      .filter((value): value is number => value != null);
    if (values.length === 0) {
      return {
        state: 'unknown',
        reasons: ['straight_front_type requires frontType data'],
      };
    }
    return setCanSatisfy(values, operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`straight_front_type${operator}${argument}`] };
  }

  if (condition === 'always') {
    return compareNumber(1, operator, argument)
      ? { state: 'pass', reasons: [] }
      : { state: 'fail', reasons: [`always${operator}${argument}`] };
  }

  return {
    state: 'unknown',
    reasons: [`${condition} depends on race process`],
  };
}

function evaluateNode(
  course: CourseDataEntry,
  ctx: SkillStaticContext,
  node: ExprNode | null,
): EvaluationResult {
  if (!node) return { state: 'pass', reasons: [] };
  if (node.type === 'cmp') {
    return evalComparator(
      course,
      ctx,
      node.condition,
      node.operator,
      node.argument,
    );
  }
  const left = evaluateNode(course, ctx, node.left);
  const right = evaluateNode(course, ctx, node.right);
  return node.operator === '&' ? mergeAnd(left, right) : mergeOr(left, right);
}

export function evaluateSkillStaticConditions(
  skillId: number | string,
  ctx: SkillStaticContext,
): SkillStaticEvaluation[] {
  const course = courseData[String(ctx.courseId)];
  if (!course) {
    return [
      {
        skillId: String(skillId),
        alternativeIndex: 0,
        rarity: 0,
        precondition: '',
        condition: '',
        state: 'missing',
        reasons: [`missing course ${ctx.courseId}`],
      },
    ];
  }

  const data = skillData[String(skillId)];
  if (!data) {
    return [
      {
        skillId: String(skillId),
        alternativeIndex: 0,
        rarity: 0,
        precondition: '',
        condition: '',
        state: 'missing',
        reasons: [`missing skill_data ${skillId}`],
      },
    ];
  }

  return data.alternatives.map((alternative, alternativeIndex) => {
    const preResult = evaluateNode(
      course,
      ctx,
      parseExpression(alternative.precondition ?? ''),
    );
    const mainResult = evaluateNode(
      course,
      ctx,
      parseExpression(alternative.condition ?? ''),
    );

    let state: SkillStaticEvaluation['state'];
    let reasons: string[] = [];
    if (preResult.state === 'fail' || mainResult.state === 'fail') {
      state = 'fail';
      reasons = [...preResult.reasons, ...mainResult.reasons];
    } else if (preResult.state === 'unknown' || mainResult.state === 'unknown') {
      state = 'unknown';
      reasons = [...preResult.reasons, ...mainResult.reasons];
    } else {
      state = 'pass';
    }

    return {
      skillId: String(skillId),
      alternativeIndex,
      rarity: data.rarity,
      precondition: alternative.precondition ?? '',
      condition: alternative.condition ?? '',
      state,
      reasons: Array.from(new Set(reasons)),
    };
  });
}
