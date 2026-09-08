import type { GameEvent, StoryDetail } from 'types/gameTypes';

export type EventDetailOption = {
  option: string;
  gainList: string[];
  resultIndex?: number;
};

export type EventDetailData = {
  eventId: number;
  eventName: string;
  options: EventDetailOption[];
};

export type EventGainSegment = {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
};

export type EventGainEffect = {
  label: string;
  context?: string;
  values: EventGainSegment[];
  accent: 'buff' | 'default';
};

export type EventOptionEffectGroup = {
  commonEffects: EventGainEffect[];
  options: Array<
    EventDetailOption & {
      branches: EventGainEffect[][];
    }
  >;
};

const NUMERIC_GAIN_PATTERN = /\[([+-]?\d+(?:\.\d+)?)\]/g;
const NUMERIC_GAIN_LIST_PATTERN =
  /\[((?:[+-]?\d+(?:\.\d+)?)(?:\/[+-]?\d+(?:\.\d+)?)*)\]/g;
const GAIN_VALUE_PLACEHOLDER_PREFIX = '__UMA_SHOW_GAIN_VALUE_';
const NEGATIVE_EVENT_BUFF_NAMES = new Set([
  '熬夜倾向',
  '爱偷懒',
  '皮肤粗糙',
  '长胖倾向',
  '偏头痛',
  '拙于练习',
]);

const normalizeGain = (gain: string) =>
  gain
    .replace(/&#x20;|&#32;|&nbsp;/gi, ' ')
    .split(/\r?\n|[;；]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' / ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/[。.]+$/g, '');

const parseGainTemplate = (gain: string) => {
  const values: string[] = [];
  const template = normalizeGain(gain).replace(
    NUMERIC_GAIN_PATTERN,
    (_match, value: string) => {
      const placeholder = `${GAIN_VALUE_PLACEHOLDER_PREFIX}${values.length}__`;
      values.push(value);
      return `[${placeholder}]`;
    },
  );
  return { template, values };
};

const aggregateNumericValues = (values: string[]) => {
  const uniqueValues = new Map<number, string>();
  values.forEach((value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || uniqueValues.has(numericValue))
      return;
    uniqueValues.set(numericValue, value);
  });
  return [...uniqueValues.entries()]
    .sort(([left], [right]) => right - left)
    .map(([, value]) => value)
    .join('/');
};

export function aggregateEventGains(gains: string[]): string[] {
  const groups = new Map<
    string,
    { template: string; valuesByPosition: string[][] }
  >();

  gains.forEach((gain) => {
    const { template, values } = parseGainTemplate(gain);
    if (!template) return;
    const key = `${template}\u0000${values.length}`;
    const existing = groups.get(key);
    if (existing) {
      values.forEach((value, index) => {
        existing.valuesByPosition[index].push(value);
      });
      return;
    }
    groups.set(key, {
      template,
      valuesByPosition: values.map((value) => [value]),
    });
  });

  return [...groups.values()].map(({ template, valuesByPosition }) =>
    valuesByPosition.reduce(
      (result, values, index) =>
        result.replace(
          `${GAIN_VALUE_PLACEHOLDER_PREFIX}${index}__`,
          aggregateNumericValues(values),
        ),
      template,
    ),
  );
}

export function splitEventGainSegments(gain: string): EventGainSegment[] {
  const segments: EventGainSegment[] = [];
  let lastIndex = 0;

  Array.from(gain.matchAll(NUMERIC_GAIN_LIST_PATTERN)).forEach((match) => {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      segments.push({
        text: gain.slice(lastIndex, matchIndex),
        tone: 'neutral',
      });
    }
    segments.push({ text: '[', tone: 'neutral' });
    match[1].split(/(\/)/g).forEach((value) => {
      if (!value) return;
      if (value === '/') {
        segments.push({ text: value, tone: 'neutral' });
        return;
      }
      segments.push({
        text: value,
        tone: Number(value) < 0 ? 'negative' : 'positive',
      });
    });
    segments.push({ text: ']', tone: 'neutral' });
    lastIndex = matchIndex + match[0].length;
  });

  if (lastIndex < gain.length) {
    segments.push({ text: gain.slice(lastIndex), tone: 'neutral' });
  }
  return segments;
}

const splitGainEffects = (gain: string) => {
  const normalizedGain = gain.replace(
    /(获得\[[^\]]+\])\s+(?=\[[^\]]+\]的外出解锁)/g,
    '$1 / ',
  );
  const effects: string[] = [];
  let bracketDepth = 0;
  let startIndex = 0;
  for (let index = 0; index < normalizedGain.length; index += 1) {
    if (normalizedGain[index] === '[') bracketDepth += 1;
    if (normalizedGain[index] === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
    }
    if (normalizedGain[index] === '/' && bracketDepth === 0) {
      const effect = normalizedGain.slice(startIndex, index).trim();
      if (effect) effects.push(effect);
      startIndex = index + 1;
    }
  }
  const lastEffect = normalizedGain.slice(startIndex).trim();
  if (lastEffect) effects.push(lastEffect);
  return effects;
};

const buildValueSegments = (
  valueList: string,
  direction: 'increase' | 'decrease' | 'level',
): EventGainSegment[] =>
  valueList
    .split(/(\/)/g)
    .flatMap<EventGainSegment>((rawValue): EventGainSegment[] => {
      if (!rawValue) return [];
      if (rawValue === '/') {
        return [{ text: rawValue, tone: 'neutral' as const }];
      }
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        return [{ text: rawValue, tone: 'neutral' as const }];
      }
      if (direction === 'level') {
        return [
          {
            text: `Lv${Math.abs(numericValue)}`,
            tone:
              numericValue < 0 ? ('negative' as const) : ('positive' as const),
          },
        ];
      }
      const negative = numericValue < 0 || direction === 'decrease';
      return [
        {
          text:
            numericValue === 0
              ? '0'
              : `${negative ? '-' : '+'}${Math.abs(numericValue)}`,
          tone: negative ? ('negative' as const) : ('positive' as const),
        },
      ];
    });

export function parseEventGainEffects(gain: string): EventGainEffect[] {
  return splitGainEffects(gain).map((rawEffect) => {
    const effect = rawEffect.replace(/[。.]+$/g, '').trim();
    const supportMatch = effect.match(
      /^支援角色\[([^\]]+)\]友情槽提升\[([^\]]+)\]$/,
    );
    if (supportMatch) {
      return {
        label: '友情槽',
        context: supportMatch[1],
        values: buildValueSegments(supportMatch[2], 'increase'),
        accent: 'default',
      };
    }

    const skillHintMatch = effect.match(
      /^技能\[([^\]]+)\]灵感等级提升\[([^\]]+)\]$/,
    );
    if (skillHintMatch) {
      return {
        label: '灵感',
        context: skillHintMatch[1],
        values: buildValueSegments(skillHintMatch[2], 'level'),
        accent: 'buff',
      };
    }

    const skillMatch = effect.match(/^技能\[([^\]]+)\]$/);
    if (skillMatch) {
      return {
        label: skillMatch[1],
        context: '技能',
        values: [],
        accent: 'buff',
      };
    }

    const acquiredBuffMatch = effect.match(/^获得\[([^\]]+)\]$/);
    if (acquiredBuffMatch) {
      const buffName = acquiredBuffMatch[1];
      return {
        label: buffName,
        context: '获得',
        values: [],
        accent: NEGATIVE_EVENT_BUFF_NAMES.has(buffName) ? 'default' : 'buff',
      };
    }

    const outingUnlockMatch = effect.match(/^\[([^\]]+)\]的外出解锁$/);
    if (outingUnlockMatch) {
      return {
        label: '外出解锁',
        context: outingUnlockMatch[1],
        values: [],
        accent: 'default',
      };
    }

    const numericEffectMatch = effect.match(/^(.+?)(提升|降低)\[([^\]]+)\]$/);
    if (numericEffectMatch) {
      return {
        label: numericEffectMatch[1],
        values: buildValueSegments(
          numericEffectMatch[3],
          numericEffectMatch[2] === '降低' ? 'decrease' : 'increase',
        ),
        accent: 'default',
      };
    }

    return {
      label: effect,
      values: [],
      accent: 'default',
    };
  });
}

const eventGainEffectKey = (effect: EventGainEffect) =>
  JSON.stringify([
    effect.context ?? '',
    effect.label,
    effect.accent,
    effect.values.map((value) => [value.text, value.tone]),
  ]);

const uniqueEventGainEffects = (effects: EventGainEffect[]) => {
  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = eventGainEffectKey(effect);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const hasAlternativeValues = (effect: EventGainEffect) =>
  effect.values.some((value) => value.text === '/');

export function groupEventOptionEffects(
  options: EventDetailOption[],
): EventOptionEffectGroup {
  const optionBranches = options.map((option) =>
    option.gainList.map((gain) =>
      uniqueEventGainEffects(parseEventGainEffects(gain)),
    ),
  );
  const allBranches = optionBranches.flat();
  const canExtractCommonEffects =
    allBranches.length >= 2 &&
    optionBranches.every((branches) => branches.length);
  if (!canExtractCommonEffects) {
    return {
      commonEffects: [],
      options: options.map((option, index) => ({
        ...option,
        branches: optionBranches[index],
      })),
    };
  }

  const commonKeys = new Set(
    allBranches[0]
      .filter((effect) => !hasAlternativeValues(effect))
      .map(eventGainEffectKey),
  );
  allBranches.slice(1).forEach((effects) => {
    const keys = new Set(
      effects
        .filter((effect) => !hasAlternativeValues(effect))
        .map(eventGainEffectKey),
    );
    [...commonKeys].forEach((key) => {
      if (!keys.has(key)) commonKeys.delete(key);
    });
  });
  const commonEffects = allBranches[0].filter((effect) =>
    commonKeys.has(eventGainEffectKey(effect)),
  );

  return {
    commonEffects,
    options: options.map((option, index) => ({
      ...option,
      branches: optionBranches[index].map((branch) =>
        branch.filter((effect) => !commonKeys.has(eventGainEffectKey(effect))),
      ),
    })),
  };
}

export const shouldShowEventOptionLabel = (label: string) => {
  const normalizedLabel = label.trim().replace(/[（）()]/g, '');
  return Boolean(normalizedLabel && normalizedLabel !== '无选项');
};

export function buildEventDetailRows(
  gameEvents: GameEvent[] | undefined,
  eventDetails: Record<number, StoryDetail> | undefined,
): EventDetailData[] {
  return (gameEvents ?? []).flatMap((event) => {
    const localOptions = event.options ?? [];
    const networkOptions = eventDetails?.[event.eventId]?.optionList ?? [];
    const optionCount = Math.max(localOptions.length, networkOptions.length, 1);

    const options = Array.from({ length: optionCount }, (_, index) => {
      const localOption = localOptions[index];
      const networkOption = networkOptions[index];
      const networkGains = (networkOption?.gainList ?? [])
        .map((gain) => gain.trim())
        .filter(Boolean);
      const localDetail = localOption?.detail?.trim() ?? '';
      let rawGainList: string[] = [];
      if (networkGains.length > 0) rawGainList = networkGains;
      else if (localDetail) rawGainList = [localDetail];
      const gainList = aggregateEventGains(rawGainList);

      return {
        option: networkOption?.option?.trim() || localOption?.desp?.trim() || '',
        gainList,
        resultIndex: localOption?.selectIndex,
      };
    });

    if (!options.some((option) => shouldShowEventOptionLabel(option.option))) {
      return [];
    }

    return [
      {
        eventId: event.eventId,
        eventName: event.eventName,
        options,
      },
    ];
  });
}

type EventDetailRowProps = {
  eventName: string;
  options: EventDetailOption[];
};

const eventGainValueClass = (tone: EventGainSegment['tone']) => {
  if (tone === 'positive') return 'text-[#FF6D26]';
  if (tone === 'negative') return 'text-[#4E97E9]';
  return 'opacity-60';
};

function EventGainEffectChip({ effect }: { effect: EventGainEffect }) {
  return (
    <span className="inline-flex min-h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-[#794016]">
      {effect.context ? (
        <span className="font-bold">{effect.context}</span>
      ) : null}
      <span>{effect.label}</span>
      {effect.values.length > 0 ? (
        <span className="font-black">
          {effect.values.map((value, valueIndex) => (
            <span key={valueIndex} className={eventGainValueClass(value.tone)}>
              {value.text}
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

export default function EventDetailRow({
  eventName,
  options,
}: EventDetailRowProps) {
  const effectGroup = groupEventOptionEffects(options);
  const hasOptionDifferences = effectGroup.options.some(
    (option) =>
      option.branches.length > 1 ||
      option.branches.some((branch) => branch.length > 0),
  );
  const visibleOptions = hasOptionDifferences ? effectGroup.options : [];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[#7DCB0C] bg-white shadow-sm">
      <div className="border-b border-[#7DCB0C]/30 bg-[#7DCB0C]/10 px-4 py-2.5 text-sm font-black text-[#794016]">
        {eventName}
      </div>
      {effectGroup.commonEffects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-4 py-2.5">
          <span className="mr-1 text-[11px] font-bold text-[#794016]">
            共同效果
          </span>
          {effectGroup.commonEffects.map((effect, effectIndex) => (
            <EventGainEffectChip key={effectIndex} effect={effect} />
          ))}
        </div>
      ) : null}
      {visibleOptions.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {visibleOptions.map((option, optionIndex) => (
            <div
              key={optionIndex}
              className="flex min-w-0 flex-wrap items-center gap-1.5 bg-white px-4 py-3"
            >
              {shouldShowEventOptionLabel(option.option) ? (
                <span className="mr-1 shrink-0 text-sm font-bold text-[#794016]">
                  {option.option}
                </span>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1.5">
                {option.branches.map((branch, branchIndex) => (
                  <div
                    key={branchIndex}
                    className="flex min-w-0 flex-wrap items-center gap-1.5"
                  >
                    {option.branches.length > 1 ? (
                      <span className="mr-1 shrink-0 text-[11px] font-bold text-[#794016] opacity-60">
                        可能{branchIndex + 1}
                      </span>
                    ) : null}
                    {branch.map((effect, effectIndex) => (
                      <EventGainEffectChip
                        key={effectIndex}
                        effect={effect}
                      />
                    ))}
                    {branch.length === 0 ? (
                      <span className="text-[11px] text-[#794016] opacity-60">
                        无额外变化
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
