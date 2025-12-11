import EChartsReactCore from 'echarts-for-react/lib/core';
import { LineChart, LineSeriesOption } from 'echarts/charts';
import {
  DataZoomComponentOption,
  DataZoomSliderComponent,
  GridComponent,
  GridComponentOption,
  LegendComponent,
  LegendComponentOption,
  MarkAreaComponent,
  MarkAreaComponentOption,
  MarkLineComponent,
  MarkLineComponentOption,
  TooltipComponent,
  TooltipComponentOption,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { ComposeOption } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { MarkArea2DDataItemOption } from 'echarts/types/src/component/marker/MarkAreaModel';
import type { MarkLine1DDataItemOption } from 'echarts/types/src/component/marker/MarkLineModel';
import _ from 'lodash';
import memoize from 'memoize-one';
import React from 'react';
import { Chara } from '../../umdb/data_pb';
import {
  RaceSimulateData,
  RaceSimulateEventData_SimulateEventType,
  RaceSimulateHorseFrameData_TemptationMode,
  RaceSimulateHorseResultData,
} from '../../umdb/race_data_pb';
import {
  filterCharaSkills,
  filterCharaTargetedSkills,
  filterRaceEvents,
  getCharaActivatedSkillIds,
} from '../../umdb/RaceDataUtils';
import {
  fromRaceHorseData,
  TrainedCharaData,
} from '../../umdb/TrainedCharaData';
import * as UMDatabaseUtils from '../../umdb/UMDatabaseUtils';
// import FoldCard from './FoldCard'; // Removed FoldCard
import { UMDB } from '../utils/umdb';

const unknownCharaTag = 'Unknown Chara / Mob';
const supportedRaceDataVersion = 100000002;

// 类型定义保持不变
type CompeteTableData = {
  time: number;
  type: string;
  charas: {
    displayName: string;
  }[];
};

type ECOption = ComposeOption<
  | LineSeriesOption
  | TooltipComponentOption
  | GridComponentOption
  | MarkLineComponentOption
  | MarkAreaComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>;

echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  MarkAreaComponent,
  LegendComponent,
  SVGRenderer,
  DataZoomSliderComponent,
]);

// Helper functions for table rendering
const runningStyleLabel = (
  horseResultData: RaceSimulateHorseResultData,
  activatedSkills: Set<number>,
) => {
  if (activatedSkills.has(202051)) {
    return '大逃げ';
  }
  return UMDatabaseUtils.runningStyleLabels[horseResultData.runningStyle!];
};

const otherRaceEventLabels = new Map([
  [RaceSimulateEventData_SimulateEventType.COMPETE_TOP, '位置争取'],
  [RaceSimulateEventData_SimulateEventType.COMPETE_FIGHT, '追比'],
  [RaceSimulateEventData_SimulateEventType.RELEASE_CONSERVE_POWER, '脚色十分'],
  [
    RaceSimulateEventData_SimulateEventType.STAMINA_LIMIT_BREAK_BUFF,
    '比拼耐力',
  ],
  [RaceSimulateEventData_SimulateEventType.COMPETE_BEFORE_SPURT, '取位调整'],
  [RaceSimulateEventData_SimulateEventType.STAMINA_KEEP, '耐力保存'],
  [RaceSimulateEventData_SimulateEventType.SECURE_LEAD, '确保领先'],
]);

// Data preparation interfaces
type CharaTableData = {
  trainedChara: TrainedCharaData;
  chara: Chara | undefined;
  frameOrder: number;
  finishOrder: number;
  horseResultData: RaceSimulateHorseResultData;
  popularity: number;
  popularityMarks: number[];
  motivation: number;
  activatedSkills: Set<number>;
};

type RaceDataPresenterProps = {
  raceHorseInfo: any[];
  raceData: RaceSimulateData;
  umdb: typeof UMDB;
};

// 定义 Tab 类型
type TabType =
  | 'summary'
  | 'diff'
  | 'speed'
  | 'hp'
  | 'events'
  | 'detail_analysis';

type RaceDataPresenterState = {
  activeTab: TabType; // 新增 activeTab 状态
  selectedCharaFrameOrder: number | undefined;
  showSkills: boolean;
  showTargetedSkills: boolean;
  showBlocks: boolean;
  showTemptationMode: boolean;
  showOtherRaceEvents: boolean;
  diffGraphUseDistanceAsXAxis: boolean;
};

class RaceDataPresenter extends React.PureComponent<
  RaceDataPresenterProps,
  RaceDataPresenterState
> {
  constructor(props: RaceDataPresenterProps) {
    super(props);
    this.state = {
      activeTab: 'summary', // 默认显示出赛表
      selectedCharaFrameOrder: undefined,
      showSkills: true,
      showTargetedSkills: true,
      showBlocks: true,
      showTemptationMode: true,
      showOtherRaceEvents: true,
      diffGraphUseDistanceAsXAxis: true,
    };
  }

  displayNames = memoize((raceHorseInfo: any[], raceData: RaceSimulateData) => {
    const nameFromRaceHorseInfo: Record<number, string> = {};
    if (raceHorseInfo && raceHorseInfo.length === raceData.horseResult.length) {
      raceHorseInfo.forEach((d: any) => {
        const trainedCharaData = fromRaceHorseData(d, UMDB.skills);
        const frameOrder = d['frame_order'] - 1; // 0-indexed
        const charaId = d['chara_id'];
        const charaDisplayName =
          charaId in this.props.umdb.charas
            ? this.props.umdb.charas[charaId].name
            : unknownCharaTag;

        const trainerNameSuffix = d['trainer_name']
          ? ` by ${d['trainer_name']}`
          : '';
        nameFromRaceHorseInfo[frameOrder] =
          ` ${charaDisplayName}-${trainedCharaData.rankScore}${trainerNameSuffix}`;
      });
    }

    const m: Record<number, string> = {};
    for (
      let frameOrder = 0;
      frameOrder < raceData.horseResult.length;
      frameOrder++
    ) {
      const finishOrder = raceData.horseResult[frameOrder].finishOrder! + 1;
      m[frameOrder] =
        `[${frameOrder + 1} 号 ${finishOrder} 名]${nameFromRaceHorseInfo[frameOrder] ?? ''}`;
    }
    return m;
  });

  // ... renderGraphs logic ...
  renderGraphs() {
    const raceHorseInfo = this.props.raceHorseInfo;
    const raceData = this.props.raceData;
    const frameOrder = this.state.selectedCharaFrameOrder!;
    const displayNames = this.displayNames(raceHorseInfo, raceData);

    const skillPlotLines = filterCharaSkills(raceData, frameOrder).map(
      (event) =>
        ({
          xAxis: event.frameTime,
          name: this.props.umdb.skillName(event.param[1]),
          label: { show: true, position: 'insideStartBottom' },
          lineStyle: { color: '#666' },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: [3, 5],
              borderRadius: 3,
            },
            lineStyle: { width: 3, color: '#000' },
          },
        }) as MarkLine1DDataItemOption,
    );
    const skillTargetedSkillPlotLines = filterCharaTargetedSkills(
      raceData,
      frameOrder,
    ).map(
      (event) =>
        ({
          xAxis: event.frameTime,
          name: `${this.props.umdb.skillName(event.param[1])} by ${displayNames[event.param[0]]}`,
          label: { show: true, position: 'insideStartBottom' },
          lineStyle: { color: 'rgba(255, 0, 0, 0.6)' },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: [3, 5],
              borderRadius: 3,
            },
            lineStyle: { width: 3, color: '#000' },
          },
        }) as MarkLine1DDataItemOption,
    );

    const otherEventsPlotLines = Array.from(otherRaceEventLabels).flatMap(
      ([eventType, name]) =>
        filterRaceEvents(raceData, frameOrder, eventType).map(
          (event) =>
            ({
              xAxis: event.frameTime,
              name: name,
              label: { show: true, position: 'insideStartBottom' },
              lineStyle: { color: 'rgba(0, 255, 0, 0.6)' },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 16,
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  padding: [3, 5],
                  borderRadius: 3,
                },
                lineStyle: { width: 3, color: '#000' },
              },
            }) as MarkLine1DDataItemOption,
        ),
    );

    const lastSpurtStartDistance =
      raceData.horseResult[frameOrder].lastSpurtStartDistance!;
    let lastSpurtStartTime = 0;

    function makeBlockedPlotArea(
      from: number,
      to: number,
      blockedByIndex: number,
    ): MarkArea2DDataItemOption {
      return [
        {
          name: `Blocked by ${displayNames[blockedByIndex]}`,
          xAxis: from,
          itemStyle: { color: 'rgba(255, 0, 0, 0.1)' },
        },
        { xAxis: to },
      ];
    }
    function makeTemptationModePlotArea(
      from: number,
      to: number,
      mode: RaceSimulateHorseFrameData_TemptationMode,
    ): MarkArea2DDataItemOption {
      return [
        {
          name: `Temptation ${RaceSimulateHorseFrameData_TemptationMode[mode] ?? mode}`,
          xAxis: from,
          itemStyle: { color: 'rgba(255, 255, 0, 0.1)' },
        },
        { xAxis: to },
      ];
    }

    const blockFrontPlotAreas: MarkArea2DDataItemOption[] = [];
    const temptationModePlotAreas: MarkArea2DDataItemOption[] = [];
    const deltaSpeed: [number, number][] = [];
    const deltaHp: [number, number][] = [];
    let lastBlockFrontHorseIndexChangedTime = 0;
    let lastBlockFrontHorseIndex = -1;
    let lastTemptationModeChangedTime = 0;
    let lastTemptationMode = 0;

    for (let i = 0; i < raceData.frame.length; i++) {
      const frame = raceData.frame[i];
      const time = frame.time!;
      const horseFrame = frame.horseFrame[frameOrder];
      const previousFrame = raceData.frame[i - 1];
      const previousTime = i === 0 ? 0 : previousFrame.time!;
      const previousHorseFrame = previousFrame?.horseFrame[frameOrder];

      if (horseFrame.blockFrontHorseIndex !== lastBlockFrontHorseIndex) {
        if (lastBlockFrontHorseIndex !== -1) {
          blockFrontPlotAreas.push(
            makeBlockedPlotArea(
              lastBlockFrontHorseIndexChangedTime,
              previousTime,
              lastBlockFrontHorseIndex,
            ),
          );
        }
        lastBlockFrontHorseIndexChangedTime = previousTime;
        lastBlockFrontHorseIndex = horseFrame.blockFrontHorseIndex!;
      }
      if (horseFrame.temptationMode !== lastTemptationMode) {
        if (lastTemptationMode !== 0) {
          temptationModePlotAreas.push(
            makeTemptationModePlotArea(
              lastTemptationModeChangedTime,
              previousTime,
              lastTemptationMode,
            ),
          );
        }
        lastTemptationModeChangedTime = previousTime;
        lastTemptationMode = horseFrame.temptationMode!;
      }
      const distance = horseFrame.distance!;
      if (
        lastSpurtStartDistance > 0 &&
        lastSpurtStartTime === 0 &&
        lastSpurtStartDistance <= distance
      ) {
        if (i > 0) {
          const previousFrameDistance = previousHorseFrame.distance!;
          lastSpurtStartTime =
            previousTime +
            ((lastSpurtStartDistance - previousFrameDistance) /
              (distance - previousFrameDistance)) *
              (time - previousTime);
        }
      }
      if (i === 0) {
        deltaSpeed.push([0, 0]);
        deltaHp.push([0, 0]);
      } else {
        deltaSpeed.push([time, horseFrame.speed! - previousHorseFrame.speed!]);
        deltaHp.push([time, horseFrame.hp! - previousHorseFrame.hp!]);
      }
    }
    const lastFrameTime = _.last(raceData.frame)!.time!;
    if (lastBlockFrontHorseIndex !== -1)
      blockFrontPlotAreas.push(
        makeBlockedPlotArea(
          lastBlockFrontHorseIndexChangedTime,
          lastFrameTime,
          lastBlockFrontHorseIndex,
        ),
      );
    if (lastTemptationMode !== 0)
      temptationModePlotAreas.push(
        makeTemptationModePlotArea(
          lastTemptationModeChangedTime,
          lastFrameTime,
          lastTemptationMode,
        ),
      );

    const plotLines: MarkLine1DDataItemOption[] = [
      {
        xAxis: raceData.horseResult[frameOrder!].finishTimeRaw,
        name: 'Goal in',
        lineStyle: { color: '#666', type: [8, 3, 1, 3] },
      },
    ];
    if (lastSpurtStartDistance > 0) {
      plotLines.push({
        xAxis: lastSpurtStartTime,
        name: 'Last Spurt',
        lineStyle: { color: '#666', type: [8, 3] },
      });
    }

    const options: ECOption = {
      grid: [{ height: '45%' }, { top: '60%', height: '30%' }],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [
        {
          name: 'Time',
          nameLocation: 'middle',
          type: 'value',
          min: 'dataMin',
          max: 'dataMax',
        },
        {
          gridIndex: 1,
          type: 'value',
          position: 'top',
          min: 'dataMin',
          max: 'dataMax',
        },
      ],
      yAxis: [{ type: 'value' }, { gridIndex: 1, type: 'value' }],
      legend: { show: true },
      series: [
        {
          name: 'Speed',
          data: raceData.frame.map((frame) => [
            frame.time,
            frame.horseFrame[frameOrder!].speed,
          ]),
          type: 'line',
          markLine: {
            symbol: 'none',
            label: { position: 'end', formatter: '{b}' },
            lineStyle: { type: 'solid' },
            data: [
              ...(this.state.showSkills ? skillPlotLines : []),
              ...(this.state.showTargetedSkills
                ? skillTargetedSkillPlotLines
                : []),
              ...(this.state.showOtherRaceEvents ? otherEventsPlotLines : []),
              ...plotLines,
            ],
          },
          markArea: {
            label: { position: 'inside', rotate: 90 },
            emphasis: { label: { position: 'inside', rotate: 90 } },
            data: [
              ...(this.state.showBlocks ? blockFrontPlotAreas : []),
              ...(this.state.showTemptationMode ? temptationModePlotAreas : []),
            ],
          },
        },
        {
          name: 'HP',
          data: raceData.frame.map((frame) => [
            frame.time,
            frame.horseFrame[frameOrder!].hp,
          ]),
          type: 'line',
          smooth: true,
        },
        {
          xAxisIndex: 1,
          yAxisIndex: 1,
          name: 'ΔSpeed',
          data: deltaSpeed,
          type: 'line',
          smooth: true,
        },
        {
          xAxisIndex: 1,
          yAxisIndex: 1,
          name: 'ΔHP',
          data: deltaHp,
          type: 'line',
          smooth: true,
        },
      ],
      tooltip: { trigger: 'axis' },
      dataZoom: { type: 'slider', xAxisIndex: [0, 1] },
    };

    return (
      <div className="mt-4 bg-white p-4 rounded shadow border border-gray-200">
        <EChartsReactCore
          echarts={echarts}
          option={options}
          style={{ height: '700px' }}
        />
      </div>
    );
  }

  renderOtherRaceEventsList() {
    const groupedEvents = _.groupBy(
      this.props.raceData.event
        .map((e) => e.event!)
        .filter((e) => otherRaceEventLabels.has(e.type!)),
      (e) => e.frameTime!,
    );

    const data: CompeteTableData[] = _.values(groupedEvents).map((events) => {
      const time = events[0].frameTime!;
      return {
        time: time,
        type: otherRaceEventLabels.get(events[0].type!)!,
        charas: events.map((e) => {
          const frameOrder = e.param[0];
          return {
            displayName: this.displayNames(
              this.props.raceHorseInfo,
              this.props.raceData,
            )[frameOrder],
          };
        }),
      };
    });

    if (data.length === 0)
      return <div className="p-4 text-gray-500">No events recorded.</div>;

    // Remove FoldCard, just return div
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 mt-4">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Time
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Charas
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.time} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {row.time}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {row.type}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {row.charas.map((c, idx) => (
                    <div key={idx}>{c.displayName}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  renderCharaList() {
    if (!this.props.raceHorseInfo || this.props.raceHorseInfo.length === 0) {
      return undefined;
    }

    const rows: CharaTableData[] = this.props.raceHorseInfo
      .map((data) => {
        const frameOrder = data['frame_order'] - 1;
        const horseResult = this.props.raceData.horseResult[frameOrder];
        const trainedCharaData = fromRaceHorseData(data, UMDB.skills);

        return {
          trainedChara: trainedCharaData,
          chara: this.props.umdb.charas[trainedCharaData.charaId],
          frameOrder: frameOrder + 1,
          finishOrder: horseResult.finishOrder! + 1,
          horseResultData: horseResult,
          popularity: data['popularity'],
          popularityMarks: data['popularity_mark_rank_array'],
          motivation: data['motivation'],
          activatedSkills: getCharaActivatedSkillIds(
            this.props.raceData,
            frameOrder,
          ),
        };
      })
      .sort((a, b) => a.finishOrder - b.finishOrder);

    // Remove FoldCard, just return the table wrapper
    return (
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm mt-4">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                名次
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                马号
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                角色
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                训练者
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                Time
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                状态
              </th>
              <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase">
                人气
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                评分
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                速
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                耐
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                力
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                毅
              </th>
              <th className="px-2 py-3 text-left font-medium text-gray-500 uppercase">
                智
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 font-medium text-gray-900">
                  {row.finishOrder}
                </td>
                <td className="px-3 py-2 text-gray-500">{row.frameOrder}</td>
                <td className="px-3 py-2 text-gray-900">
                  {row.chara ? (
                    <>
                      <div className="font-medium">{row.chara.name}</div>
                      <div className="text-xs text-gray-500">
                        {this.props.umdb.cards[row.trainedChara.cardId]?.name}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-400 italic">
                      {unknownCharaTag}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {row.trainedChara.viewerId
                    ? row.trainedChara.viewerName
                    : '-'}
                </td>
                <td className="px-3 py-2 text-gray-600">
                  <div className="font-mono">
                    {UMDatabaseUtils.formatTime(
                      row.horseResultData.finishTime!,
                    )}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    {UMDatabaseUtils.formatTime(
                      row.horseResultData.finishTimeRaw!,
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  <div>
                    {runningStyleLabel(
                      row.horseResultData,
                      row.activatedSkills,
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {UMDatabaseUtils.motivationLabels[row.motivation]}
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  <span className="font-medium mr-1">{row.popularity}</span>
                  <span className="text-xs text-gray-400">
                    {row.popularityMarks
                      .map(UMDatabaseUtils.getPopularityMark)
                      .join(', ')}
                  </span>
                </td>
                <td className="px-2 py-2 text-center text-gray-600">
                  {row.trainedChara.rankScore}
                </td>
                <td className="px-2 py-2 text-center text-gray-600 font-mono">
                  {row.trainedChara.speed}
                </td>
                <td className="px-2 py-2 text-center text-gray-600 font-mono">
                  {row.trainedChara.stamina}
                </td>
                <td className="px-2 py-2 text-center text-gray-600 font-mono">
                  {row.trainedChara.pow}
                </td>
                <td className="px-2 py-2 text-center text-gray-600 font-mono">
                  {row.trainedChara.guts}
                </td>
                <td className="px-2 py-2 text-center text-gray-600 font-mono">
                  {row.trainedChara.wiz}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // --- Graph Rendering Helpers ---
  renderGlobalRaceDistanceDiffGraph() {
    const series: Record<number, LineSeriesOption> = _.mapValues(
      this.displayNames(this.props.raceHorseInfo, this.props.raceData),
      (name) =>
        ({
          name: name,
          data: [],
          type: 'line',
          smooth: true,
        }) as LineSeriesOption,
    );

    this.props.raceData.frame.forEach((frame) => {
      const time = frame.time!;
      const minDistance = _.min(frame.horseFrame.map((hf) => hf.distance!))!;
      const maxDistance = _.max(frame.horseFrame.map((hf) => hf.distance!))!;
      const baseDistance = (minDistance + maxDistance) / 2;
      frame.horseFrame.forEach((horseFrame, frameOrder) => {
        series[frameOrder].data!.push([
          this.state.diffGraphUseDistanceAsXAxis ? baseDistance : time,
          horseFrame.distance! - baseDistance,
        ]);
      });
    });

    const options: ECOption = {
      xAxis: {
        name: this.state.diffGraphUseDistanceAsXAxis ? 'Base Distance' : 'Time',
        nameLocation: 'middle',
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: { type: 'value' },
      legend: { show: true, type: 'scroll' },
      series: _.values(series),
      tooltip: { trigger: 'axis' },
      dataZoom: { type: 'slider' },
    };

    // Remove FoldCard
    return (
      <div className="mt-4">
        <div className="flex items-center mb-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              checked={this.state.diffGraphUseDistanceAsXAxis}
              onChange={(e) =>
                this.setState({ diffGraphUseDistanceAsXAxis: e.target.checked })
              }
            />
            <span className="ml-2 text-sm text-gray-700">
              Use Base Distance as X Axis
            </span>
          </label>
        </div>
        <div className="w-full bg-white p-4 rounded shadow border border-gray-200">
          <EChartsReactCore
            echarts={echarts}
            option={options}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    );
  }

  renderGlobalRaceSpeedGraph() {
    const series: Record<number, LineSeriesOption> = _.mapValues(
      this.displayNames(this.props.raceHorseInfo, this.props.raceData),
      (name) =>
        ({
          name: name,
          data: [],
          type: 'line',
          smooth: true,
          symbol: 'none',
        }) as LineSeriesOption,
    );

    this.props.raceData.frame.forEach((frame) => {
      const time = frame.time!;
      const minDistance = _.min(frame.horseFrame.map((hf) => hf.distance!))!;
      const maxDistance = _.max(frame.horseFrame.map((hf) => hf.distance!))!;
      const baseDistance = (minDistance + maxDistance) / 2;
      frame.horseFrame.forEach((horseFrame, frameOrder) => {
        series[frameOrder].data!.push([
          this.state.diffGraphUseDistanceAsXAxis ? baseDistance : time,
          horseFrame.speed! / 100,
        ]);
      });
    });

    const options: ECOption = {
      xAxis: {
        name: this.state.diffGraphUseDistanceAsXAxis ? 'Base Distance' : 'Time',
        nameLocation: 'middle',
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: { type: 'value', name: 'Speed', scale: true },
      legend: { show: true, type: 'scroll' },
      series: _.values(series),
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => (value as number).toFixed(2),
      },
      dataZoom: { type: 'slider' },
    };

    return (
      <div className="mt-4">
        <div className="flex items-center mb-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              checked={this.state.diffGraphUseDistanceAsXAxis}
              onChange={(e) =>
                this.setState({ diffGraphUseDistanceAsXAxis: e.target.checked })
              }
            />
            <span className="ml-2 text-sm text-gray-700">
              Use Base Distance as X Axis
            </span>
          </label>
        </div>
        <div className="bg-white p-4 rounded shadow border border-gray-200">
          <EChartsReactCore
            echarts={echarts}
            option={options}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    );
  }

  renderGlobalRaceHpGraph() {
    const series: Record<number, LineSeriesOption> = _.mapValues(
      this.displayNames(this.props.raceHorseInfo, this.props.raceData),
      (name) =>
        ({
          name: name,
          data: [],
          type: 'line',
          smooth: true,
          symbol: 'none',
        }) as LineSeriesOption,
    );

    this.props.raceData.frame.forEach((frame) => {
      const time = frame.time!;
      const minDistance = _.min(frame.horseFrame.map((hf) => hf.distance!))!;
      const maxDistance = _.max(frame.horseFrame.map((hf) => hf.distance!))!;
      const baseDistance = (minDistance + maxDistance) / 2;
      frame.horseFrame.forEach((horseFrame, frameOrder) => {
        series[frameOrder].data!.push([
          this.state.diffGraphUseDistanceAsXAxis ? baseDistance : time,
          horseFrame.hp!,
        ]);
      });
    });

    const options: ECOption = {
      xAxis: {
        name: this.state.diffGraphUseDistanceAsXAxis ? 'Base Distance' : 'Time',
        nameLocation: 'middle',
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
      },
      yAxis: { type: 'value', name: 'HP' },
      legend: { show: true, type: 'scroll' },
      series: _.values(series),
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value) => (value as number).toFixed(0),
      },
      dataZoom: { type: 'slider' },
    };

    return (
      <div className="mt-4">
        <div className="flex items-center mb-2">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              checked={this.state.diffGraphUseDistanceAsXAxis}
              onChange={(e) =>
                this.setState({ diffGraphUseDistanceAsXAxis: e.target.checked })
              }
            />
            <span className="ml-2 text-sm text-gray-700">
              Use Base Distance as X Axis
            </span>
          </label>
        </div>
        <div className="bg-white p-4 rounded shadow border border-gray-200">
          <EChartsReactCore
            echarts={echarts}
            option={options}
            style={{ height: '400px' }}
          />
        </div>
      </div>
    );
  }

  renderDetailAnalysis() {
    return (
      <div className="mt-4 space-y-4">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Detailed Analysis Controls
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Chara to View Detail
              </label>
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
                onChange={(e) =>
                  this.setState({
                    selectedCharaFrameOrder: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
                value={this.state.selectedCharaFrameOrder ?? ''}
              >
                <option value="">-</option>
                {Object.entries(
                  this.displayNames(
                    this.props.raceHorseInfo,
                    this.props.raceData,
                  ),
                ).map(([frameOrder, displayName]) => (
                  <option key={frameOrder} value={frameOrder}>
                    {displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Show Skills', key: 'showSkills' },
                { label: 'Show Targeted Skills', key: 'showTargetedSkills' },
                { label: 'Show Blocks', key: 'showBlocks' },
                { label: 'Show Temptation Mode', key: 'showTemptationMode' },
                {
                  label: `Show Other Events (${Array.from(otherRaceEventLabels.values()).slice(0, 2).join(', ')}...)`,
                  key: 'showOtherRaceEvents',
                },
              ].map((item) => (
                <label key={item.key} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 h-4 w-4"
                    // @ts-ignore
                    checked={this.state[item.key]}
                    onChange={(e) =>
                      // @ts-ignore
                      this.setState({ [item.key]: e.target.checked })
                    }
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {this.state.selectedCharaFrameOrder !== undefined ? (
          this.renderGraphs()
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded border border-dashed border-gray-300">
            Please select a character above to view detailed graphs.
          </div>
        )}
      </div>
    );
  }

  renderTabs() {
    const tabs: { id: TabType; label: string }[] = [
      { id: 'summary', label: '出赛表' },
      { id: 'diff', label: 'Distance Diff' },
      { id: 'speed', label: 'Speed' },
      { id: 'hp', label: 'HP' },
      { id: 'events', label: 'Race Events' },
      { id: 'detail_analysis', label: 'Detailed Analysis' },
    ];

    return (
      <div className="border-b border-gray-200">
        <nav
          className="-mb-px flex space-x-8 overflow-x-auto"
          aria-label="Tabs"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => this.setState({ activeTab: tab.id })}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-150
                ${
                  this.state.activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  render() {
    return (
      <div className="space-y-6">
        {this.props.raceData.header!.version! > supportedRaceDataVersion && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  RaceData version {this.props.raceData.header!.version!} higher
                  than supported version {supportedRaceDataVersion}, use at your
                  own risk!
                </p>
              </div>
            </div>
          </div>
        )}

        {this.renderTabs()}

        <div className="min-h-[500px]">
          {this.state.activeTab === 'summary' && this.renderCharaList()}
          {this.state.activeTab === 'diff' &&
            this.renderGlobalRaceDistanceDiffGraph()}
          {this.state.activeTab === 'speed' &&
            this.renderGlobalRaceSpeedGraph()}
          {this.state.activeTab === 'hp' && this.renderGlobalRaceHpGraph()}
          {this.state.activeTab === 'events' &&
            this.renderOtherRaceEventsList()}
          {this.state.activeTab === 'detail_analysis' &&
            this.renderDetailAnalysis()}
        </div>
      </div>
    );
  }
}

export default RaceDataPresenter;
