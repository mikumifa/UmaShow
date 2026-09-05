import {
  BadgeCheck,
  Globe2,
  LockKeyhole,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  ARC_POTENTIAL_BY_ID,
  ARC_POTENTIAL_CONDITIONS,
  ARC_POTENTIALS,
  ARC_SELECTION_EFFECT_LABELS,
  ARC_TAG_BOOST_LABELS,
  getArcPotentialIconPath,
  getArcTrainingEffect,
} from 'constant/arc';
import {
  COMMAND_NAME_MAP,
  TARGET_TYPE,
  type ArcData,
  type ArcRivalInfo,
  type CharInfo,
  type CommandParam,
} from 'types/gameTypes';
import { UMDB } from 'renderer/utils/umdb';
import {
  TrainingEventsSection,
  VitalPanel,
} from 'renderer/components/monitor/SharedSections';

const TRAINING_ORDER = [101, 105, 102, 103, 106];
const TRAINING_STYLES: Record<
  number,
  { border: string; bg: string; title: string; ring: string }
> = {
  101: {
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    title: 'text-blue-700',
    ring: 'ring-blue-200',
  },
  105: {
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    title: 'text-rose-700',
    ring: 'ring-rose-200',
  },
  102: {
    border: 'border-orange-200',
    bg: 'bg-orange-50',
    title: 'text-orange-700',
    ring: 'ring-orange-200',
  },
  103: {
    border: 'border-fuchsia-200',
    bg: 'bg-fuchsia-50',
    title: 'text-fuchsia-700',
    ring: 'ring-fuchsia-200',
  },
  106: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    title: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
};

const PARAM_LABELS: Record<number, string> = {
  [TARGET_TYPE.SPEED]: '速',
  [TARGET_TYPE.STAMINA]: '耐',
  [TARGET_TYPE.POWER]: '力',
  [TARGET_TYPE.GUTS]: '毅',
  [TARGET_TYPE.WIZ]: '智',
  [TARGET_TYPE.VITAL]: '体',
  [TARGET_TYPE.SKILL_PTS]: '技Pt',
};

const PARAM_STYLES: Record<number, string> = {
  [TARGET_TYPE.SPEED]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TARGET_TYPE.STAMINA]: 'border-rose-200 bg-rose-50 text-rose-700',
  [TARGET_TYPE.POWER]: 'border-orange-200 bg-orange-50 text-orange-700',
  [TARGET_TYPE.GUTS]: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  [TARGET_TYPE.WIZ]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TARGET_TYPE.VITAL]: 'border-lime-200 bg-lime-50 text-lime-700',
  [TARGET_TYPE.SKILL_PTS]: 'border-amber-200 bg-amber-50 text-amber-700',
};

const formatSigned = (value: number) => (value > 0 ? `+${value}` : `${value}`);

const mergeParams = (...groups: Array<CommandParam[] | undefined>) => {
  const values = new Map<number, number>();
  groups
    .flatMap((group) => group ?? [])
    .forEach((param) => {
      values.set(
        param.targetType,
        (values.get(param.targetType) ?? 0) + param.value,
      );
    });
  return Array.from(values.entries())
    .map(([targetType, value]) => ({ targetType, value }))
    .filter((item) => item.value !== 0)
    .sort((left, right) => left.targetType - right.targetType);
};

const getPotentialCardStyle = (canUpgrade: boolean, unlocked: boolean) => {
  if (canUpgrade) {
    return 'border-amber-300 bg-amber-50 shadow-[0_0_0_2px_rgba(251,191,36,.12)]';
  }
  if (unlocked) return 'border-cyan-200 bg-cyan-50/50';
  return 'border-gray-200 bg-gray-50';
};

const getPotentialEffectStyle = (
  effectLevel: number,
  currentLevel: number,
  nextLevel: number,
) => {
  if (effectLevel <= currentLevel) return 'font-bold text-slate-700';
  if (effectLevel === nextLevel) return 'font-medium text-amber-700';
  return 'text-gray-400';
};

function ParamChips({ params }: { params: CommandParam[] }) {
  if (params.length === 0) {
    return <span className="text-xs text-gray-400">无属性变化</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {params.map((param) => (
        <span
          key={param.targetType}
          className={`rounded-md border px-1.5 py-0.5 text-xs font-black ${
            PARAM_STYLES[param.targetType] ??
            'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {PARAM_LABELS[param.targetType] ?? `参数${param.targetType}`}{' '}
          {formatSigned(param.value)}
        </span>
      ))}
    </div>
  );
}

function RivalAvatar({
  rival,
  ring = 'ring-sky-200',
}: {
  rival: ArcRivalInfo;
  ring?: string;
}) {
  const iconUrl = UMDB.charas[rival.charaId]?.iconUrl ?? '';
  const name = UMDB.charaName(rival.charaId);
  return (
    <div
      className="group relative shrink-0"
      title={`${name} / 排名 ${rival.rank || '-'} / 协助者积分 ${rival.approvalPoint}`}
    >
      <div
        className={`h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-white shadow-sm ring-2 ${ring}`}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-gray-400">
            {rival.charaId || '?'}
          </div>
        )}
      </div>
      <div className="absolute -bottom-1 -right-1 rounded-full border border-white bg-violet-600 px-1 text-[8px] font-black leading-3 text-white shadow-sm">
        {rival.starLevel}
      </div>
    </div>
  );
}

function ArcStatusBar({ arcData }: { arcData: ArcData }) {
  const trainingEffect = getArcTrainingEffect(arcData.approvalRate);
  const upgradeable = ARC_POTENTIALS.filter((meta) => {
    const current = arcData.potentials.find(
      (potential) => potential.potentialId === meta.id,
    );
    const currentLevel = current?.level ?? 0;
    const nextCost = meta.levelCosts[currentLevel + 1];
    return nextCost != null && arcData.globalExp >= nextCost;
  }).length;
  const selection = arcData.selectionInfo;
  const totalWinPoint = selection?.rivals.reduce(
    (sum, rival) => sum + rival.winApprovalPoint,
    0,
  );
  const totalLosePoint = selection?.rivals.reduce(
    (sum, rival) => sum + rival.loseApprovalPoint,
    0,
  );
  const matchLabel = selection?.isSpecialMatch ? 'SSS' : 'SS';
  const matchParams = selection
    ? mergeParams(selection.params, selection.bonusParams)
    : [];

  return (
    <section className="rounded-xl border border-sky-200 bg-gradient-to-r from-cyan-50 to-indigo-50 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <div className="mr-1 flex items-center gap-1 font-black text-slate-800">
          <Globe2 className="text-cyan-600" size={16} />
          凯旋门
        </div>
        <span className="rounded-md border border-cyan-200 bg-white/80 px-2 py-1 font-bold text-cyan-700">
          期待 {arcData.approvalRate}% · 训练 +{trainingEffect}%
        </span>
        <span className="rounded-md border border-blue-200 bg-white/80 px-2 py-1 font-bold text-blue-700">
          适性Pt {arcData.globalExp}
          {upgradeable > 0 ? ` · ${upgradeable}项可升` : ''}
        </span>
        <span className="rounded-md border border-violet-200 bg-white/80 px-2 py-1 font-bold text-violet-700">
          SS {arcData.ssMatchWinCount}胜 · SSS {arcData.specialSsMatchWinCount}
          胜
        </span>
        <span
          className="rounded-md border border-amber-200 bg-white/80 px-2 py-1 font-bold text-amber-700"
          title={
            ARC_TAG_BOOST_LABELS[arcData.spTagBoostType] ??
            `类型 ${arcData.spTagBoostType}`
          }
        >
          <Zap className="mr-0.5 inline" size={12} />
          群星槽{arcData.spTagBoostType > 0 ? '加成中' : '普通'}
        </span>
        <span
          className={`rounded-md border px-2 py-1 font-black ${
            selection
              ? 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800'
              : 'border-slate-200 bg-white/70 text-slate-500'
          }`}
        >
          <Sparkles className="mr-0.5 inline" size={12} />
          {selection ? `${matchLabel}已就绪` : '群星赛未就绪'}
        </span>
        {selection ? (
          <>
            <span className="rounded-md bg-emerald-100 px-2 py-1 font-black text-emerald-700">
              全胜 +{selection.allWinApprovalPoint || totalWinPoint}
            </span>
            <span className="rounded-md bg-white/80 px-2 py-1 font-bold text-slate-600">
              全败 +{totalLosePoint}
            </span>
            <ParamChips params={matchParams} />
          </>
        ) : null}
        {arcData.allRivalBoostBlocked ? (
          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 font-black text-rose-700">
            群星槽锁定
          </span>
        ) : null}
      </div>
      {selection ? (
        <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
          {selection.rivals.map((selectionRival) => {
            const rival = arcData.rivals.find(
              (item) => item.charaId === selectionRival.charaId,
            );
            const name = UMDB.charaName(selectionRival.charaId);
            return (
              <div
                key={selectionRival.charaId}
                className="flex shrink-0 items-center gap-1 rounded-md border border-white bg-white/85 px-1.5 py-1"
                title={name}
              >
                {rival ? <RivalAvatar rival={rival} /> : null}
                <span className="max-w-20 truncate text-[10px] font-bold text-slate-700">
                  {name}
                </span>
                <span className="text-[10px] font-black text-emerald-600">
                  胜+{selectionRival.winApprovalPoint}
                </span>
                <span className="text-[10px] text-slate-400">
                  败+{selectionRival.loseApprovalPoint}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function ArcPotentialPanel({ arcData }: { arcData: ArcData }) {
  const currentById = new Map(
    arcData.potentials.map((potential) => [potential.potentialId, potential]),
  );
  const sorted = [...ARC_POTENTIALS].sort(
    (left, right) => left.row - right.row || left.queue - right.queue,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 font-black text-slate-800">
          <BadgeCheck size={19} className="text-cyan-600" /> 海外适应性
        </h2>
        <p className="text-xs text-slate-500">
          金色表示当前积分足够升级；灰色表示尚未解锁
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sorted.map((meta) => {
          const current = currentById.get(meta.id);
          const level = current?.level ?? 0;
          const nextLevel = level + 1;
          const nextCost = meta.levelCosts[nextLevel];
          const canUpgrade = nextCost != null && arcData.globalExp >= nextCost;
          const progress = current?.progress ?? [];
          const unlocked = level > 0;
          const cardStyle = getPotentialCardStyle(canUpgrade, unlocked);
          let upgradeStatus = null;
          if (level >= meta.maxLevel) {
            upgradeStatus = (
              <div className="mt-2 rounded-lg bg-emerald-100 py-1 text-center text-[10px] font-black text-emerald-700">
                已满级
              </div>
            );
          } else if (nextCost != null) {
            upgradeStatus = (
              <div
                className={`mt-2 rounded-lg py-1 text-center text-[10px] font-black ${
                  canUpgrade
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-white text-slate-500'
                }`}
              >
                升 Lv{nextLevel}：{nextCost} Pt
              </div>
            );
          }
          return (
            <article
              key={meta.id}
              className={`rounded-xl border p-3 transition-colors ${cardStyle}`}
            >
              <div className="flex items-center gap-2">
                <img
                  src={getArcPotentialIconPath(meta.id)}
                  alt={meta.name}
                  className={`h-11 w-11 shrink-0 object-contain ${unlocked ? '' : 'grayscale opacity-45'}`}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-sm font-black text-slate-800"
                    title={meta.name}
                  >
                    {meta.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {Array.from(
                      { length: meta.maxLevel },
                      (_, index) => index + 1,
                    ).map((itemLevel) => (
                      <span
                        key={itemLevel}
                        className={`h-2 flex-1 rounded-full ${
                          itemLevel <= level ? 'bg-cyan-500' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-[10px] font-black text-slate-600">
                      Lv{level}/{meta.maxLevel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                {Object.entries(meta.levelEffects).map(([rawLevel, effect]) => {
                  const effectLevel = Number(rawLevel);
                  return (
                    <div
                      key={rawLevel}
                      className={`text-[10px] leading-4 ${getPotentialEffectStyle(
                        effectLevel,
                        level,
                        nextLevel,
                      )}`}
                    >
                      Lv{effectLevel} · {effect}
                    </div>
                  );
                })}
              </div>

              {progress.length > 0 ? (
                <div className="mt-2 space-y-1 border-t border-black/5 pt-2">
                  {progress.map((item) => {
                    const total = item.totalCount || 1;
                    const rate = Math.min(
                      100,
                      (item.currentCount / total) * 100,
                    );
                    return (
                      <div key={item.conditionId}>
                        <div className="flex justify-between gap-2 text-[9px] font-bold text-slate-500">
                          <span className="truncate">
                            {ARC_POTENTIAL_CONDITIONS[item.conditionId] ??
                              `条件 ${item.conditionId}`}
                          </span>
                          <span>
                            {item.currentCount}/{item.totalCount}
                          </span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {upgradeStatus}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArcRivalPanel({ arcData }: { arcData: ArcData }) {
  const blocked = new Set(arcData.rivalBoostBlockedCharaIds);
  const sorted = [...arcData.rivals].sort((left, right) => {
    const leftOrder = TRAINING_ORDER.indexOf(left.commandId);
    const rightOrder = TRAINING_ORDER.indexOf(right.commandId);
    return (
      (leftOrder < 0 ? 99 : leftOrder) - (rightOrder < 0 ? 99 : rightOrder) ||
      right.starLevel - left.starLevel ||
      left.rank - right.rank
    );
  });
  if (sorted.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-black text-slate-800">
            <Users size={19} className="text-indigo-600" /> 凯旋门计划成员
          </h2>
          <p className="text-xs text-slate-500">
            成员位置、群星槽、排名、协助者积分与已持有适性
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
          {sorted.length} 人
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sorted.map((rival) => {
          const style = TRAINING_STYLES[rival.commandId] ?? {
            border: 'border-gray-200',
            bg: 'bg-gray-50',
            title: 'text-gray-700',
            ring: 'ring-gray-200',
          };
          const isBlocked =
            arcData.allRivalBoostBlocked || blocked.has(rival.charaId);
          const nextEffect = rival.selectionEffects
            .slice()
            .sort((left, right) => left.effectNum - right.effectNum)[0];
          return (
            <article
              key={rival.charaId}
              className={`rounded-xl border p-2.5 ${style.border} ${style.bg}`}
            >
              <div className="flex items-center gap-2">
                <RivalAvatar rival={rival} ring={style.ring} />
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-xs font-black text-slate-800"
                    title={UMDB.charaName(rival.charaId)}
                  >
                    {UMDB.charaName(rival.charaId)}
                  </div>
                  <div className={`text-[10px] font-bold ${style.title}`}>
                    {COMMAND_NAME_MAP[rival.commandId] ??
                      (rival.commandId ? `行动 ${rival.commandId}` : '未上场')}
                  </div>
                </div>
                {isBlocked ? (
                  <span title="本回合群星槽无法提升" className="text-slate-500">
                    <LockKeyhole size={15} />
                  </span>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                <div className="rounded-md bg-white px-1 py-1">
                  <div className="text-[8px] text-gray-400">群星槽</div>
                  <div className="text-xs font-black text-violet-700">
                    {rival.rivalBoost}
                  </div>
                </div>
                <div className="rounded-md bg-white px-1 py-1">
                  <div className="text-[8px] text-gray-400">排名</div>
                  <div className="text-xs font-black text-slate-700">
                    {rival.rank || '-'}
                  </div>
                </div>
                <div className="rounded-md bg-white px-1 py-1">
                  <div className="text-[8px] text-gray-400">协助Pt</div>
                  <div className="text-xs font-black text-cyan-700">
                    {rival.approvalPoint}
                  </div>
                </div>
              </div>
              {nextEffect ? (
                <div className="mt-1.5 truncate rounded-md bg-white px-2 py-1 text-[9px] font-bold text-indigo-700">
                  下次奖励：
                  {ARC_SELECTION_EFFECT_LABELS[nextEffect.effectGroupId] ??
                    `奖励组 ${nextEffect.effectGroupId}`}
                </div>
              ) : null}
              {rival.potentials.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {rival.potentials.map((potential) => (
                    <span
                      key={potential.potentialId}
                      title={ARC_POTENTIAL_BY_ID[potential.potentialId]?.name}
                      className="rounded border border-cyan-100 bg-white px-1.5 py-0.5 text-[8px] font-bold text-cyan-700"
                    >
                      {ARC_POTENTIAL_BY_ID[potential.potentialId]?.name ??
                        `适性${potential.potentialId}`}{' '}
                      Lv{potential.level}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ArcRaceHistoryPanel({ arcData }: { arcData: ArcData }) {
  if (arcData.raceHistory.length === 0 && arcData.rivalRaceInfo.length === 0) {
    return null;
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-black text-slate-800">
        <Trophy size={19} className="text-amber-500" /> 剧本比赛信息
      </h2>
      <div className="flex flex-wrap gap-2">
        {arcData.raceHistory.map((race) => (
          <div
            key={`${race.raceNum}-${race.turn}`}
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs"
          >
            <div className="font-black text-amber-800">
              第 {race.raceNum} 场
            </div>
            <div className="text-amber-700">
              回合 {race.turn} · 第 {race.resultRank} 名
            </div>
          </div>
        ))}
        {arcData.rivalRaceInfo.map((race, index) => (
          <div
            key={`${race.programId}-${race.charaId}-${index}`}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs"
          >
            <div className="font-black text-indigo-800">
              {UMDB.charaName(race.charaId)}
            </div>
            <div className="text-indigo-600">
              对手赛 program_id={race.programId}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ArcPanel({ charInfo }: { charInfo: CharInfo }) {
  const { arcData } = charInfo;
  if (!arcData) {
    return (
      <>
        <VitalPanel charInfo={charInfo} />
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center shadow-sm">
          <Globe2 className="mx-auto text-sky-500" size={30} />
          <h2 className="mt-2 font-black text-slate-800">已识别凯旋门剧本</h2>
          <p className="mt-1 text-xs text-slate-500">
            等待下一份包含 arc_data_set 的游戏数据包。
          </p>
        </section>
        <TrainingEventsSection charInfo={charInfo} />
      </>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <VitalPanel charInfo={charInfo} />
      <ArcStatusBar arcData={arcData} />
      <TrainingEventsSection charInfo={charInfo} compact />
      <ArcPotentialPanel arcData={arcData} />
      <ArcRivalPanel arcData={arcData} />
      <ArcRaceHistoryPanel arcData={arcData} />
    </div>
  );
}
