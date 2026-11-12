import { Users } from 'lucide-react';
import type { PartnerStats } from 'types/gameTypes';
import { UMDB } from 'renderer/utils/umdb';
import assetUrl from 'renderer/utils/assetUrl';
import storyProgressData from '../../../../assets/data/story_progress.json';

const storyProgressTotals = storyProgressData as {
  supportCardTotals: Record<string, number>;
  charaTotals: Record<string, number>;
};

const NPC_NAMES: Record<number, string> = {
  102: '秋川理事长',
  103: '乙名史记者',
};

function bondBarColor(value: number) {
  if (value >= 80) return 'bg-[#FFAD1E]';
  if (value >= 60) return 'bg-[#A2E61E]';
  return 'bg-[#2AC0FF]';
}

export default function PartnerBondCard({
  partnerStats,
}: {
  partnerStats: PartnerStats;
}) {
  const visiblePartners = partnerStats.filter(
    (partner) =>
      (partner.isAppear === true ||
        (partner.isAppear == null && partner.supportCardId > 0)) &&
      !(partner.supportCardId === 0 && partner.position >= 1000),
  );
  return (
    <section
      aria-label="人物羁绊与故事进度"
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
    >
      <h2 className="mb-2 flex items-center gap-1.5 text-label font-bold text-slate-800">
        <Users size={16} className="text-[#3CA2FF]" />
        人物羁绊
      </h2>
      {visiblePartners.length === 0 ? (
        <p className="text-caption text-slate-500">
          {partnerStats.length === 0
            ? '等待人物羁绊数据'
            : '暂无可显示的羁绊人物'}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
          {visiblePartners.map((partner) => {
            const supportCard = UMDB.supportCards[partner.supportCardId];
            const charaId = partner.charaId ?? supportCard?.charaId;
            const name =
              (charaId ? UMDB.charas[charaId]?.name : undefined) ||
              NPC_NAMES[partner.position] ||
              supportCard?.name ||
              `伙伴 ${partner.position}`;
            const iconPath =
              partner.charaPath || (charaId ? UMDB.charaIconPath(charaId) : '');
            const value = Number.isFinite(partner.evaluation)
              ? Math.max(0, Math.min(100, partner.evaluation))
              : 0;
            const hasStoryStep =
              partner.storyStep != null && Number.isFinite(partner.storyStep);
            const storyStep = hasStoryStep
              ? Math.max(0, Math.trunc(partner.storyStep!))
              : undefined;
            const storyTotal =
              storyProgressTotals.supportCardTotals[partner.supportCardId] ??
              storyProgressTotals.charaTotals[charaId ?? partner.position];
            const storyLabel =
              storyStep != null && storyTotal > 0
                ? `${name}故事进度：${Math.min(storyStep, storyTotal)}/${storyTotal}`
                : `${name}故事进度：暂无数据`;

            return (
              <li
                key={partner.position}
                className="flex w-full min-w-0 items-center gap-1.5 sm:w-[196px]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {iconPath ? (
                    <img
                      src={assetUrl(iconPath)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <Users
                      size={24}
                      className="text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex min-w-0 items-center gap-1">
                    <span
                      title={name}
                      className="min-w-0 truncate text-label font-semibold text-slate-700"
                    >
                      {name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      role="progressbar"
                      aria-label={`${name}羁绊`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={value}
                      className="relative h-2 w-24 max-w-[60%] shrink-0 overflow-hidden rounded-full border border-gray-300 bg-gray-200"
                    >
                      <div
                        className={`uma-progress-fill h-full ${bondBarColor(value)}`}
                        style={{ transform: `scaleX(${value / 100})` }}
                      />
                    </div>
                    <span className="shrink-0 text-label font-bold tabular-nums text-slate-700">
                      {value}
                      <span className="text-caption font-normal text-slate-500">
                        {' '}
                        / 100
                      </span>
                    </span>
                  </div>
                  <div className="mt-0.5 flex h-4 items-center">
                    {storyStep != null && storyTotal > 0 ? (
                      <span
                        role="img"
                        aria-label={storyLabel}
                        title={storyLabel}
                        className="inline-flex shrink-0 flex-nowrap items-center gap-0.5"
                      >
                        {Array.from({ length: storyTotal }, (_, index) => (
                          <img
                            key={index}
                            src={assetUrl(
                              `./icons/story/utx_ico_storyprogress_${index < storyStep ? '01' : '00'}.png`,
                            )}
                            alt=""
                            className="h-4 w-3.5 object-contain"
                          />
                        ))}
                      </span>
                    ) : (
                      <span
                        title={storyLabel}
                        className="shrink-0 text-caption text-slate-500"
                      >
                        {storyTotal === 0 ? '—' : '暂无数据'}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
