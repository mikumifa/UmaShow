import { ChevronDown } from 'lucide-react';
import {
  getSupportCardDetailData,
  supportCardName,
} from 'renderer/utils/trainingHistorySupportCard';
import AssetIcon from './AssetIcon';

export default function SupportCardDetail({
  supportCardId,
  limitBreak,
  exp,
}: {
  supportCardId: number;
  limitBreak: number;
  exp: number;
}) {
  const {
    supportCard,
    level,
    maxLevel,
    specialtySummary,
    effectEntries,
    formattedUniqueEntries,
  } = getSupportCardDetailData({
    supportCardId,
    limitBreak,
    exp,
  });

  return (
    <details className="group rounded-md border border-gray-200 bg-gray-50 p-2">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <AssetIcon
          path={`support_card_s/${supportCardId}.png`}
          alt={supportCardName(supportCardId)}
          className="h-8 w-8 rounded object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-gray-800">
            {supportCardName(supportCardId)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
            <span>
              Lv.{level}/{maxLevel}
            </span>
            <span>突破 {limitBreak}</span>
            <span>擅长 {specialtySummary.totalRate}%</span>
          </div>
        </div>
        <ChevronDown
          size={14}
          className="shrink-0 text-gray-400 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            稀有度 {supportCard?.rarity ?? '-'}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            等级 {level}/{maxLevel}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            EXP {exp}
          </span>
          <span className="rounded bg-white px-2 py-1 text-gray-700">
            擅长率 {specialtySummary.totalRate}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {effectEntries.length === 0 ? (
            <span className="rounded bg-white px-2 py-1 text-gray-400">
              无可见效果
            </span>
          ) : (
            effectEntries.map((item) => (
              <span
                key={`effect-${supportCardId}-${item.type}`}
                className="rounded bg-white px-2 py-1 text-gray-700"
              >
                {item.label} {item.value}
              </span>
            ))
          )}
        </div>
        {formattedUniqueEntries.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-amber-700">固有</div>
            <div className="space-y-1">
              {formattedUniqueEntries.map((item) => (
                <div
                  key={`unique-${supportCardId}-${item.key}`}
                  className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
                >
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
