import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Battery,
  BedDouble,
  Bot,
  ChevronDown,
  CircleEllipsis,
  Flag,
  Footprints,
  Lightbulb,
  Loader2,
  Users,
  Utensils,
} from 'lucide-react';
import TrainingCard from 'renderer/components/TrainingCard';
import EventDetailRow, {
  buildEventDetailRows,
} from 'renderer/components/EventDetailRow';
import AssetIcon from 'renderer/components/trainingHistory/AssetIcon';
import {
  COMMAND_TARGET_TYPE_MAP,
  TARGET_TYPE,
  type CharInfo,
} from 'types/gameTypes';
import type { NoteType } from 'renderer/components/scenarios/idolCup/NoteStyles';
import { useMonteCarloRecommendation } from 'renderer/components/MonteCarloProvider';
import {
  type RankedRecommendation,
  rankRecommendationActions,
  recommendationDeltaLabel,
  recommendationRankTone,
} from 'renderer/components/RecommendationRank';
import autoResearchCatalog from '../../../../assets/data/auto_research_catalog.json';

const MOTIVATION_BADGES: Record<number, { label: string; iconPath: string }> = {
  1: { label: '极差', iconPath: './icons/motivation/motivation_1.png' },
  2: { label: '不佳', iconPath: './icons/motivation/motivation_2.png' },
  3: { label: '普通', iconPath: './icons/motivation/motivation_3.png' },
  4: { label: '上佳', iconPath: './icons/motivation/motivation_4.png' },
  5: { label: '极佳', iconPath: './icons/motivation/motivation_5.png' },
};

type HintSkillCatalogEntry = {
  id: number;
  name: string;
  rarity: number;
  groupId: number;
  gradeValue: number;
  dispOrder: number;
  needSkillPoint: number;
  disableSinglemode: number;
  iconId: number;
};

const HINT_DISCOUNT_PERCENT = [0, 10, 20, 30, 35, 40];

const recommendationActivityIcon = (label: string) => {
  if (label.includes('SS')) return Users;
  if (label.includes('法棍')) return Utensils;
  if (label.includes('休息')) return BedDouble;
  if (label.includes('外出')) return Footprints;
  if (label.includes('比赛')) return Flag;
  return CircleEllipsis;
};

function RecommendationActivitiesCard({
  recommendations,
}: {
  recommendations: RankedRecommendation[];
}) {
  return (
    <article className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border-4 border-slate-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
        <span className="text-sm font-black text-slate-800">其他活动</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        {recommendations.map((recommendation) => {
          const { action, rank } = recommendation;
          const [label, ...modifiers] = action.label.split(' + ');
          const Icon = recommendationActivityIcon(label);
          const tone = recommendationRankTone(rank);
          const deltaLabel = recommendationDeltaLabel(action);
          return (
            <div
              key={action.id}
              title={`第 ${rank} 名 · ${action.label} · 预测最终分 ${Math.round(
                action.scoreMean,
              )} · 相对第一名 ${deltaLabel}`}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1.5 ${tone.footer}`}
            >
              <span
                className={`shrink-0 rounded px-1.5 py-1 text-xs font-black tabular-nums ${tone.badge}`}
              >
                #{rank}
              </span>
              <Icon size={16} className="shrink-0 opacity-75" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black">
                  {label}
                </span>
                {modifiers.length > 0 ? (
                  <span className="block truncate text-[9px] font-semibold opacity-65">
                    {modifiers.join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block whitespace-nowrap text-sm font-black leading-none">
                  {Math.round(action.scoreMean)}
                  <span className="ml-0.5 text-[9px] opacity-60">分</span>
                </span>
                <span
                  className={`mt-1 inline-block min-w-10 rounded px-1 py-0.5 text-center text-[10px] font-black ${tone.delta}`}
                >
                  {deltaLabel}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function UmaAiCommonHint() {
  const { settings, capturedState, result, busy, error } =
    useMonteCarloRecommendation();
  if (!settings.enabled) return null;

  const alternatives = (result?.actions ?? [])
    .filter((action) => action.id !== result?.bestActionId)
    .slice(0, 3)
    .map((action) => `${action.label} -${Math.round(action.deltaFromBest)}`)
    .join(' / ');
  let label = capturedState ? '等待计算' : '等待育成数据';
  let title = '推荐已开启，等待可计算的行动选择回合。';
  let tone = 'border-indigo-200 bg-indigo-50 text-indigo-700';
  let icon = <Bot size={12} strokeWidth={2.5} />;
  if (busy) {
    label = '正在计算';
    title = '正在更新当前回合推荐。';
    icon = <Loader2 size={12} className="animate-spin" />;
  } else if (error) {
    label = '计算失败';
    title = error;
    tone = 'border-rose-200 bg-rose-50 text-rose-700';
    icon = <AlertCircle size={12} />;
  } else if (result?.ok && result.bestAction) {
    label = result.bestAction;
    title = `推荐：${result.bestAction}。预测养成分 ${Math.round(
      result.predictedScore ?? 0,
    )}${alternatives ? `。备选：${alternatives}` : ''}`;
  }

  return (
    <div
      title={title}
      className={`flex h-6 min-w-0 max-w-[360px] shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-bold ${tone}`}
    >
      {icon}
      <span className="shrink-0">推荐</span>
      <span className="truncate font-black">{label}</span>
    </div>
  );
}

const hintSkillKey = (groupId: number, rarity: number) =>
  `${groupId}:${rarity}`;

const { skillById, skillsByGroupAndRarity, availableSkillsByCard } = (() => {
  const byId = new Map<number, HintSkillCatalogEntry>();
  const byGroupAndRarity = new Map<string, HintSkillCatalogEntry[]>();
  const catalog = autoResearchCatalog as unknown as {
    skills: Record<
      string,
      {
        name?: string;
        rarity?: number;
        group_id?: number;
        grade_value?: number;
        disp_order?: number;
        need_skill_point?: number;
        disable_singlemode?: number;
        icon_id?: number;
      }
    >;
    available_skills_by_card?: Record<
      string,
      Array<{ skill_id?: number; need_rank?: number }>
    >;
  };
  const skills = catalog.skills as Record<
    string,
    {
      name?: string;
      rarity?: number;
      group_id?: number;
      grade_value?: number;
      disp_order?: number;
      need_skill_point?: number;
      disable_singlemode?: number;
      icon_id?: number;
    }
  >;

  Object.entries(skills).forEach(([rawId, rawSkill]) => {
    const candidate: HintSkillCatalogEntry = {
      id: Number(rawId),
      name: String(rawSkill.name ?? '').trim(),
      rarity: Number(rawSkill.rarity ?? 0),
      groupId: Number(rawSkill.group_id ?? 0),
      gradeValue: Number(rawSkill.grade_value ?? 0),
      dispOrder: Number(rawSkill.disp_order ?? Number.MAX_SAFE_INTEGER),
      needSkillPoint: Number(rawSkill.need_skill_point ?? 0),
      disableSinglemode: Number(rawSkill.disable_singlemode ?? 0),
      iconId: Number(rawSkill.icon_id ?? 0),
    };
    if (
      !candidate.name ||
      candidate.groupId <= 0 ||
      candidate.rarity <= 0 ||
      candidate.gradeValue <= 0 ||
      candidate.needSkillPoint <= 0 ||
      candidate.name.endsWith('×')
    ) {
      return;
    }

    byId.set(candidate.id, candidate);
    const key = hintSkillKey(candidate.groupId, candidate.rarity);
    const group = byGroupAndRarity.get(key) ?? [];
    group.push(candidate);
    byGroupAndRarity.set(key, group);
  });

  byGroupAndRarity.forEach((skillsInGroup) => {
    skillsInGroup.sort(
      (left, right) =>
        left.gradeValue - right.gradeValue ||
        left.disableSinglemode - right.disableSinglemode ||
        right.dispOrder - left.dispOrder ||
        right.id - left.id,
    );
  });

  return {
    skillById: byId,
    skillsByGroupAndRarity: byGroupAndRarity,
    availableSkillsByCard: catalog.available_skills_by_card ?? {},
  };
})();

function hintDiscountPercent(level: number) {
  const normalizedLevel = Math.max(0, Math.min(5, Math.trunc(level)));
  return HINT_DISCOUNT_PERCENT[normalizedLevel];
}

export function VitalPanel({
  charInfo,
  showEffects = true,
}: {
  charInfo: CharInfo;
  showEffects?: boolean;
}) {
  const [skillHintsOpen, setSkillHintsOpen] = useState(false);
  const vitalPercent =
    charInfo.stats.vital.max > 0
      ? (charInfo.stats.vital.value / charInfo.stats.vital.max) * 100
      : 0;
  let vitalBarClass = 'bg-gradient-to-r from-red-500 to-red-400';
  if (vitalPercent > 50) {
    vitalBarClass = 'bg-gradient-to-r from-green-500 to-green-400';
  } else if (vitalPercent > 30) {
    vitalBarClass = 'bg-gradient-to-r from-yellow-500 to-yellow-400';
  }
  const motivationBadge =
    MOTIVATION_BADGES[Number(charInfo.gameStats.motivation ?? 0)];
  const learnableSkills = useMemo(() => {
    const highestLevelBySkill = new Map<string, number>();
    (charInfo.skillTips ?? []).forEach((tip) => {
      const key = hintSkillKey(tip.groupId, tip.rarity);
      highestLevelBySkill.set(
        key,
        Math.max(highestLevelBySkill.get(key) ?? 0, tip.level),
      );
    });
    const learnedSkillIds = new Set(
      (charInfo.skills ?? []).map((skill) => skill.skillId),
    );
    const disabledSkillIds = new Set(charInfo.disabledSkillIds ?? []);
    const learnableById = new Map<
      number,
      HintSkillCatalogEntry & {
        hintLevel: number;
        discountPercent: number;
        discountedPoint: number;
      }
    >();

    const nextSkillInGroup = (skill: HintSkillCatalogEntry) => {
      const candidates =
        skillsByGroupAndRarity.get(hintSkillKey(skill.groupId, skill.rarity)) ??
        [];
      const learnedGrades = candidates
        .filter((candidate) => learnedSkillIds.has(candidate.id))
        .map((candidate) => candidate.gradeValue);
      if (learnedGrades.length === 0) return skill;
      const highestLearnedGrade = Math.max(...learnedGrades);
      return candidates.find(
        (candidate) => candidate.gradeValue > highestLearnedGrade,
      );
    };

    const addSkillEntry = (skill: HintSkillCatalogEntry | undefined) => {
      if (
        !skill ||
        learnedSkillIds.has(skill.id) ||
        disabledSkillIds.has(skill.id)
      ) {
        return;
      }
      const hintLevel =
        highestLevelBySkill.get(hintSkillKey(skill.groupId, skill.rarity)) ?? 0;
      const discountPercent = hintDiscountPercent(hintLevel);
      learnableById.set(skill.id, {
        ...skill,
        hintLevel,
        discountPercent,
        discountedPoint: Math.floor(
          (skill.needSkillPoint * (100 - discountPercent)) / 100,
        ),
      });
    };

    const addSkill = (skill: HintSkillCatalogEntry | undefined) => {
      addSkillEntry(skill);
      if (!skill || skill.rarity !== 2) return;

      const lowerCandidates =
        skillsByGroupAndRarity.get(hintSkillKey(skill.groupId, 1)) ?? [];
      const lowerSkill = lowerCandidates[0];
      addSkillEntry(lowerSkill ? nextSkillInGroup(lowerSkill) : undefined);
    };

    const talentLevel = Math.max(0, Number(charInfo.talentLevel ?? 0));
    (availableSkillsByCard[String(Number(charInfo.cardId ?? 0))] ?? []).forEach(
      (rule) => {
        if (Number(rule.need_rank ?? 0) > talentLevel) return;
        const skill = skillById.get(Number(rule.skill_id ?? 0));
        addSkill(skill ? nextSkillInGroup(skill) : undefined);
      },
    );

    highestLevelBySkill.forEach((_level, key) => {
      const candidates = skillsByGroupAndRarity.get(key) ?? [];
      const baseSkill = candidates[0];
      addSkill(baseSkill ? nextSkillInGroup(baseSkill) : undefined);
    });

    learnedSkillIds.forEach((skillId) => {
      const learnedSkill = skillById.get(skillId);
      if (learnedSkill) addSkill(nextSkillInGroup(learnedSkill));
    });

    return Array.from(learnableById.values()).sort(
      (left, right) =>
        left.dispOrder - right.dispOrder ||
        right.rarity - left.rarity ||
        left.id - right.id,
    );
  }, [
    charInfo.cardId,
    charInfo.disabledSkillIds,
    charInfo.skillTips,
    charInfo.skills,
    charInfo.talentLevel,
  ]);
  const skillHintCount = useMemo(
    () =>
      new Set(
        (charInfo.skillTips ?? []).map((tip) =>
          hintSkillKey(tip.groupId, tip.rarity),
        ),
      ).size,
    [charInfo.skillTips],
  );

  return (
    <div className="flex items-center gap-3 w-full">
      <section className="flex-1 bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-green-600 font-bold shrink-0">
            <Battery size={22} />
            <span>体力</span>
          </div>

          <div className="flex-1 relative h-5 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
            <div
              className={`absolute top-0 left-0 h-full transition-all duration-300 ${vitalBarClass}`}
              style={{
                width: `${vitalPercent}%`,
              }}
            />
          </div>

          <div className="text-base font-black text-gray-700 shrink-0 min-w-[70px] text-right">
            {charInfo.stats.vital.value}
            <span className="text-[10px] text-gray-400 font-normal">
              /{charInfo.stats.vital.max}
            </span>
          </div>

          {motivationBadge ? (
            <img
              src={motivationBadge.iconPath}
              alt={`干劲：${motivationBadge.label}`}
              title={`干劲：${motivationBadge.label}`}
              className="h-8 w-auto shrink-0 object-contain"
            />
          ) : null}
        </div>

        <div className="flex min-h-5 items-center gap-2 pl-8">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {showEffects
              ? (charInfo.charaEffects ?? []).map((effect) => (
                  <span
                    key={effect.id}
                    title={`effect_id: ${effect.id}`}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                  >
                    {effect.text}
                  </span>
                ))
              : null}
          </div>
          <UmaAiCommonHint />
          <button
            type="button"
            title="展开可学习技能"
            aria-expanded={skillHintsOpen}
            onClick={() => setSkillHintsOpen((open) => !open)}
            className={`flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition-colors ${
              skillHintsOpen
                ? 'bg-amber-100 text-amber-800'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Lightbulb size={12} strokeWidth={2.5} />
            <span>技能 {learnableSkills.length}</span>
            {skillHintCount > 0 ? (
              <span className="text-[9px] text-amber-600">
                Hint {skillHintCount}
              </span>
            ) : null}
            <ChevronDown
              size={11}
              className={`transition-transform ${
                skillHintsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {skillHintsOpen ? (
          <div className="border-t border-gray-100 pt-2">
            <div className="mb-1.5 flex items-center justify-between gap-3 px-0.5">
              <span className="text-xs font-bold text-amber-700">
                可学习技能 · {learnableSkills.length}
                <span className="ml-2 font-medium text-gray-400">
                  Hint {skillHintCount}
                </span>
              </span>
              <span className="text-xs font-medium text-gray-500">
                当前总 PT
                <strong className="ml-1 text-base font-black text-indigo-600">
                  {charInfo.stats.skillPoint}
                </strong>
              </span>
            </div>

            {learnableSkills.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-1">
                {learnableSkills.map((skill) => (
                  <div
                    key={`${skill.groupId}-${skill.rarity}`}
                    className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 py-1"
                  >
                    <span
                      className={`h-8 w-8 flex-none overflow-hidden rounded border ${
                        skill.rarity === 2
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <AssetIcon
                        path={`skill_icons/${skill.iconId}.png`}
                        alt={skill.name}
                        className="h-full w-full object-cover"
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold text-slate-800">
                        {skill.name}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-700">
                        <span>Hint Lv.{skill.hintLevel}</span>
                        {skill.discountPercent > 0 ? (
                          <span>−{skill.discountPercent}%</span>
                        ) : null}
                      </span>
                    </span>

                    <span className="flex-none text-right leading-none">
                      {skill.discountPercent > 0 ? (
                        <span className="block text-[8px] text-gray-400 line-through">
                          {skill.needSkillPoint}
                        </span>
                      ) : null}
                      <span className="block whitespace-nowrap text-xs font-black text-indigo-600">
                        {skill.discountedPoint}
                        <span className="ml-0.5 text-[8px] font-bold">PT</span>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-1 text-center text-xs text-gray-400">
                当前没有可学习技能
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function TrainingEventsSection({
  charInfo,
  currentNoteStat,
  warningNoteTypes,
  liveSpecialtyRateBonus,
  onTrainingHoverChange,
  compact = false,
}: {
  charInfo: CharInfo;
  currentNoteStat?: CharInfo['noteStat'];
  warningNoteTypes?: NoteType[];
  liveSpecialtyRateBonus?: number;
  onTrainingHoverChange?: (commandId: number | null) => void;
  compact?: boolean;
}) {
  const { settings, capturedState, result } = useMonteCarloRecommendation();
  const activityRecommendations = useMemo(() => {
    if (!settings.enabled || !capturedState) return [];
    return rankRecommendationActions(result).filter(
      ({ action }) => action.train >= 5,
    );
  }, [capturedState, result, settings.enabled]);
  const eventDetailRows = buildEventDetailRows(
    charInfo.gameEvents,
    charInfo.eventDetails,
  );

  return (
    <>
      <section className={compact ? 'mt-0' : 'mt-4'}>
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 ${
            compact ? 'gap-2' : 'gap-4'
          }`}
        >
          {charInfo.commands
            .filter((cmd) => {
              const targetType = COMMAND_TARGET_TYPE_MAP[cmd.commandId];
              return (
                targetType >= TARGET_TYPE.SPEED && targetType <= TARGET_TYPE.WIZ
              );
            })
            .map((cmd) => (
              <TrainingCard
                key={cmd.commandId}
                command={cmd}
                partnerStats={charInfo.partnerStats}
                arcData={charInfo.arcData}
                liveCommands={charInfo.liveCommands}
                currentStats={charInfo.stats}
                currentNoteStat={currentNoteStat}
                warningNoteTypes={warningNoteTypes}
                liveSpecialtyRateBonus={liveSpecialtyRateBonus}
                onHoverChange={(command, isHovering) =>
                  onTrainingHoverChange?.(isHovering ? command.commandId : null)
                }
              />
            ))}
          {activityRecommendations.length > 0 ? (
            <RecommendationActivitiesCard
              recommendations={activityRecommendations}
            />
          ) : null}
        </div>
      </section>

      {eventDetailRows.length > 0 && (
        <section className="mt-2 space-y-3">
          {eventDetailRows.map((row) => (
            <EventDetailRow
              key={row.eventId}
              eventName={row.eventName}
              options={row.options}
            />
          ))}
        </section>
      )}
    </>
  );
}
