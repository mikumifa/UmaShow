import type { CharInfo } from 'types/gameTypes';
import {
  TrainingEventsSection,
  VitalPanel,
} from 'renderer/components/monitor/SharedSections';

export default function VenusCupPanel({ charInfo }: { charInfo: CharInfo }) {
  return (
    <>
      <VitalPanel charInfo={charInfo} />

      <section className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">
              Venus Cup
            </div>
            <h2 className="mt-1 text-lg font-black text-gray-800">女神杯</h2>
          </div>
          <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
            当前先保留基础监控
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          当前剧本已切到独立面板。现阶段只展示基础体力、训练和事件，后续女神杯专属信息可以继续往这个面板里补。
        </p>
      </section>

      <TrainingEventsSection charInfo={charInfo} />
    </>
  );
}
