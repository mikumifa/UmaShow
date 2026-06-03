import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RaceMetaInfo } from 'types/gameTypes';
import courseDataJson from '../../../assets/data/course_data.json';
import {
  RaceSimulateEventData_SimulateEventType,
  type RaceSimulateData,
} from 'umdb/race_data_pb';
import { filterCharaSkills } from 'umdb/RaceDataUtils';
import * as UMDatabaseUtils from 'umdb/UMDatabaseUtils';
import { UMDB } from 'renderer/utils/umdb';
import { resolveRaceSkillDurationParam } from 'renderer/utils/skillConditionEvaluator';
import AssetIcon from './trainingHistory/AssetIcon';

type MetricKey = 'speed' | 'acceleration' | 'hp' | 'lane';

type TelemetryHorseSnapshot = {
  frameOrder: number;
  distance: number;
  lanePosition: number;
  speed: number;
  acceleration: number;
  hp: number;
  blockFrontHorseIndex: number;
  temptationMode: number;
};

type TelemetrySnapshot = {
  time: number;
  horses: TelemetryHorseSnapshot[];
};

type RaceTelemetryOverviewProps = {
  displayNames: Record<number, string>;
  raceData: RaceSimulateData;
  raceMetaInfo?: RaceMetaInfo;
  umdb: typeof UMDB;
  courseDistance?: number;
  iconPathByFrameOrder: Record<number, string | undefined>;
};

type CourseDataEntry = {
  distance?: number;
  turn?: number;
  courseSetStatus?: number[];
  surface?: number;
  raceTrackId?: number;
  corners?: Array<{
    start: number;
    length: number;
  }>;
  straights?: Array<{
    start: number;
    end: number;
  }>;
  slopes?: Array<{
    start: number;
    length: number;
    slope: number;
  }>;
};

type BackgroundBandSegment = {
  key: string;
  startDistance: number;
  endDistance: number;
  label: string;
  fill: string;
  stroke: string;
  text: string;
};

const chartWidth = 1120;
const chartHeight = 390;
const chartPadding = { top: 28, right: 72, bottom: 52, left: 72 };
const skillTimelineWidth = chartWidth - chartPadding.left - chartPadding.right;
const minimumSkillBarWidthPx = 44;
const minimumSkillGapPx = 4;
const chartLeftRatio = (chartPadding.left / chartWidth) * 100;
const chartRightRatio = (chartPadding.right / chartWidth) * 100;
const raceTrackLeftPercent = 8;
const raceTrackUsableWidthPercent = 84;
const raceTrackOverflowLeftWidthPercent = 10;
const raceTrackPixelsPerMeter = 32;
const finishAreaLeftPercent = 92;
const finishAreaWidthPercent = 8;
const raceTrackOverflowRightPercent = finishAreaLeftPercent;
const raceTrackZeroPercent =
  raceTrackLeftPercent + raceTrackOverflowLeftWidthPercent;
const raceTrackMainUsableWidthPercent =
  raceTrackOverflowRightPercent - raceTrackZeroPercent;
const playbackSpeedStorageKey = 'raceTelemetryOverview.playSpeed';
const courseData = courseDataJson as Record<string, CourseDataEntry>;

const metricMeta: Record<
  MetricKey,
  {
    label: string;
    unit: string;
    description: string;
    color: string;
    getValue: (horse: TelemetryHorseSnapshot) => number;
    formatter: (value: number) => string;
  }
> = {
  speed: {
    label: '速度',
    unit: 'm/s',
    description: '比赛中的速度，单位为米每秒，数值越高表示速度越快',
    color: '#0f766e',
    getValue: (horse) => horse.speed,
    formatter: (value) => value.toFixed(1),
  },
  acceleration: {
    label: '加速度',
    unit: 'm/s²',
    description: '相邻遥测帧速度变化率，正值表示加速，负值表示减速',
    color: '#7c3aed',
    getValue: (horse) => horse.acceleration,
    formatter: (value) => value.toFixed(2),
  },
  hp: {
    label: '体力',
    unit: 'HP',
    description: '体力消耗，数值越低表示体力越少',
    color: '#be123c',
    getValue: (horse) => horse.hp,
    formatter: (value) => value.toFixed(0),
  },
  lane: {
    label: '横移',
    unit: '',
    description: '横向位置，数值越大表示越靠近外侧',
    color: '#1d4ed8',
    getValue: (horse) => horse.lanePosition,
    formatter: (value) => value.toFixed(0),
  },
};

const palette = [
  '#e11d48',
  '#2563eb',
  '#059669',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#0f766e',
  '#4f46e5',
  '#dc2626',
  '#16a34a',
];

const raceNumberAccent = 'rgba(100, 116, 139, 0.62)';
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildHorseName(fullName: string, frameOrder: number) {
  const compact = fullName
    .replace(/^\[[^\]]+\]/, '')
    .trim()
    .replace(/^-/, '')
    .trim();
  return compact || `${frameOrder + 1} 号`;
}

function formatSkillDuration(durationParam: number | undefined) {
  if (durationParam == null) return '-';
  if (durationParam === -1) return '永久';

  const seconds = durationParam / 10000;
  const rounded = Math.round(seconds * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}秒` : `${rounded.toFixed(1)}秒`;
}

function resolveCourseData(
  umdb: typeof UMDB,
  raceInstanceId: number | undefined,
) {
  if (raceInstanceId == null) return undefined;
  const courseSet = umdb.raceInstances[raceInstanceId]?.courseSet;
  if (courseSet == null) return undefined;
  return courseData[String(courseSet)];
}

function trimLeadingUniformFrames(frameValues: number[][], tolerance: number) {
  const firstDivergedIndex = frameValues.findIndex((values) => {
    if (values.length <= 1) {
      return false;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    return max - min > tolerance;
  });

  if (firstDivergedIndex <= 0) {
    return frameValues;
  }

  return frameValues.slice(firstDivergedIndex);
}

function buildSpeedAxisTicks(min: number, max: number) {
  if (max <= min) {
    return [min];
  }

  const splitValue = max / 2;
  const ticks = new Set<number>();
  const upperStep = Math.max(1, Math.round((max - splitValue) / 6));

  for (let tick = splitValue; tick <= max; tick += upperStep) {
    ticks.add(Number(tick.toFixed(1)));
  }

  ticks.add(Number(max.toFixed(1)));

  return [...ticks]
    .filter((tick) => tick >= min && tick <= max)
    .sort((left, right) => left - right);
}

function buildAccelerationAxisTicks(min: number, max: number) {
  if (max <= min) {
    return [min];
  }

  const splitValue = min + ((max - min) * 2) / 3;
  const ticks = new Set<number>();
  const lowerStep = Math.max(
    0.05,
    Number(((splitValue - min || 0.3) / 6).toFixed(2)),
  );
  const upperStep = Math.max(
    0.15,
    Number(((max - splitValue || 0.9) / 3).toFixed(2)),
  );

  for (let tick = min; tick <= splitValue; tick += lowerStep) {
    ticks.add(Number(tick.toFixed(2)));
  }

  ticks.add(Number(splitValue.toFixed(2)));

  for (let tick = splitValue + upperStep; tick <= max; tick += upperStep) {
    ticks.add(Number(tick.toFixed(2)));
  }

  ticks.add(Number(max.toFixed(2)));

  return [...ticks]
    .filter((tick) => tick >= min && tick <= max)
    .sort((left, right) => left - right);
}

function readCachedPlaybackSpeed() {
  if (typeof window === 'undefined') {
    return 1;
  }

  const raw = window.localStorage.getItem(playbackSpeedStorageKey);
  const parsed = raw == null ? Number.NaN : Number(raw);
  return [1, 2, 4, 8].includes(parsed) ? parsed : 1;
}

export default function RaceTelemetryOverview({
  displayNames,
  raceData,
  raceMetaInfo,
  umdb,
  courseDistance,
  iconPathByFrameOrder,
}: RaceTelemetryOverviewProps) {
  const frames = raceData.frame ?? [];
  const horseCount = raceData.horseResult.length;
  const maxTime = frames.length > 0 ? (frames[frames.length - 1].time ?? 0) : 0;
  const inferredDistance =
    courseDistance ??
    frames.reduce(
      (maxDistance, frame) =>
        Math.max(
          maxDistance,
          ...frame.horseFrame.map((horseFrame) => horseFrame.distance ?? 0),
        ),
      0,
    );

  const defaultSelectedHorse = useMemo(() => {
    const winnerIndex = raceData.horseResult.findIndex(
      (result) => (result.finishOrder ?? Number.MAX_SAFE_INTEGER) === 0,
    );
    return winnerIndex >= 0 ? winnerIndex : 0;
  }, [raceData.horseResult]);

  const [selectedHorse, setSelectedHorse] = useState(defaultSelectedHorse);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('speed');
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(() => readCachedPlaybackSpeed());
  const [showPermanentSkills, setShowPermanentSkills] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverLeft, setHoverLeft] = useState<number | null>(null);
  const [raceTrackViewportWidthPx, setRaceTrackViewportWidthPx] = useState(960);
  const [playbackFinishedNotice, setPlaybackFinishedNotice] = useState(false);

  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const raceTrackContainerRef = useRef<HTMLDivElement | null>(null);
  const playbackFinishedNoticeTimeoutRef = useRef<number | null>(null);
  const selectedHorseFinishTime =
    raceData.horseResult[selectedHorse]?.finishTimeRaw ?? maxTime;
  const course = useMemo(
    () => resolveCourseData(umdb, raceMetaInfo?.race_instance_id),
    [raceMetaInfo?.race_instance_id, umdb],
  );

  useEffect(() => {
    setSelectedHorse(defaultSelectedHorse);
  }, [defaultSelectedHorse]);

  useEffect(() => {
    return () => {
      if (playbackFinishedNoticeTimeoutRef.current != null) {
        window.clearTimeout(playbackFinishedNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(playbackSpeedStorageKey, String(playSpeed));
  }, [playSpeed]);

  useEffect(() => {
    setCurrentTime((time) => clamp(time, 0, maxTime));
  }, [maxTime]);

  useEffect(() => {
    const element = raceTrackContainerRef.current;
    if (!element) {
      return undefined;
    }

    const updateWidth = () => {
      setRaceTrackViewportWidthPx(element.clientWidth || 960);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const frameAccelerations = useMemo(() => {
    return frames.map((frame, frameIndex) =>
      frame.horseFrame.map((horseFrame, frameOrder) => {
        if (frames.length <= 1) {
          return 0;
        }

        const previousIndex = Math.max(frameIndex - 1, 0);
        const nextIndex = Math.min(frameIndex + 1, frames.length - 1);
        const previousFrame = frames[previousIndex];
        const nextFrame = frames[nextIndex];
        const previousTime = previousFrame.time ?? 0;
        const nextTime = nextFrame.time ?? previousTime;
        const deltaTime = nextTime - previousTime;

        if (deltaTime <= 0) {
          return 0;
        }

        const previousSpeed =
          (previousFrame.horseFrame[frameOrder]?.speed ??
            horseFrame.speed ??
            0) / 100;
        const nextSpeed =
          (nextFrame.horseFrame[frameOrder]?.speed ?? horseFrame.speed ?? 0) /
          100;

        return (nextSpeed - previousSpeed) / deltaTime;
      }),
    );
  }, [frames]);

  useEffect(() => {
    if (!isPlaying || maxTime <= 0) {
      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
      return undefined;
    }

    const step = (timestamp: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      setCurrentTime((time) => {
        const next = time + (elapsed / 1000) * playSpeed;
        const stopTime = Math.min(selectedHorseFinishTime, maxTime);
        if (next >= stopTime) {
          setIsPlaying(false);
          return stopTime;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current != null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [isPlaying, maxTime, playSpeed, selectedHorseFinishTime]);

  const getInterpolatedSnapshot = useMemo(() => {
    if (frames.length === 0) {
      return (_time: number): TelemetrySnapshot => ({
        time: 0,
        horses: [],
      });
    }

    return (time: number): TelemetrySnapshot => {
      const clampedTime = clamp(time, 0, maxTime);

      let previousIndex = 0;
      while (
        previousIndex < frames.length - 1 &&
        (frames[previousIndex + 1].time ?? 0) < clampedTime
      ) {
        previousIndex += 1;
      }

      const nextIndex = Math.min(previousIndex + 1, frames.length - 1);
      const previousFrame = frames[previousIndex];
      const nextFrame = frames[nextIndex];
      const previousTime = previousFrame.time ?? 0;
      const nextTime = nextFrame.time ?? previousTime;
      const ratio =
        nextTime === previousTime
          ? 0
          : (clampedTime - previousTime) / (nextTime - previousTime);
      const discreteFrame =
        clampedTime - previousTime <= nextTime - clampedTime
          ? previousFrame
          : nextFrame;

      return {
        time: clampedTime,
        horses: previousFrame.horseFrame.map((horseFrame, frameOrder) => {
          const nextHorseFrame = nextFrame.horseFrame[frameOrder];
          const discreteHorseFrame = discreteFrame.horseFrame[frameOrder];
          const interpolate = (
            from: number | undefined,
            to: number | undefined,
          ) => (from ?? 0) + ((to ?? from ?? 0) - (from ?? 0)) * ratio;

          return {
            frameOrder,
            distance: interpolate(
              horseFrame.distance,
              nextHorseFrame?.distance,
            ),
            lanePosition: interpolate(
              horseFrame.lanePosition,
              nextHorseFrame?.lanePosition,
            ),
            speed: interpolate(horseFrame.speed, nextHorseFrame?.speed) / 100,
            acceleration: interpolate(
              frameAccelerations[previousIndex]?.[frameOrder],
              frameAccelerations[nextIndex]?.[frameOrder],
            ),
            hp: interpolate(horseFrame.hp, nextHorseFrame?.hp),
            blockFrontHorseIndex:
              discreteHorseFrame?.blockFrontHorseIndex ?? -1,
            temptationMode: discreteHorseFrame?.temptationMode ?? 0,
          };
        }),
      };
    };
  }, [frameAccelerations, frames, maxTime]);

  const currentSnapshot = useMemo(
    () => getInterpolatedSnapshot(currentTime),
    [currentTime, getInterpolatedSnapshot],
  );
  const hoveredSnapshot = useMemo(
    () => (hoverTime == null ? null : getInterpolatedSnapshot(hoverTime)),
    [getInterpolatedSnapshot, hoverTime],
  );

  const activeSkills = useMemo(
    () =>
      filterCharaSkills(raceData, selectedHorse).sort(
        (left, right) => (left.frameTime ?? 0) - (right.frameTime ?? 0),
      ),
    [raceData, selectedHorse],
  );

  const activeOtherRaceEvents = useMemo(
    () =>
      raceData.event
        .map((wrapper) => wrapper.event)
        .filter(
          (event) =>
            event != null &&
            otherRaceEventLabels.has(event.type!) &&
            event.param[0] === selectedHorse,
        )
        .sort(
          (left, right) => (left?.frameTime ?? 0) - (right?.frameTime ?? 0),
        ),
    [raceData.event, selectedHorse],
  );

  const rankingRows = useMemo(
    () =>
      raceData.horseResult
        .map((horseResult, frameOrder) => ({
          frameOrder,
          name: buildHorseName(displayNames[frameOrder] ?? '', frameOrder),
          color: palette[frameOrder % palette.length],
        }))
        .sort((left, right) => left.frameOrder - right.frameOrder),
    [displayNames, raceData.horseResult.length],
  );

  const metricRange = useMemo(() => {
    const speedFrameValues = frames.map((frame) =>
      frame.horseFrame.map((horseFrame) => (horseFrame.speed ?? 0) / 100),
    );
    const trimmedSpeedFrameValues =
      selectedMetric === 'speed'
        ? trimLeadingUniformFrames(speedFrameValues, 0.0001)
        : speedFrameValues;
    const trimmedAccelerationFrameValues =
      selectedMetric === 'acceleration'
        ? trimLeadingUniformFrames(frameAccelerations, 0.0001)
        : frameAccelerations;
    const targetValues =
      selectedMetric === 'speed'
        ? trimmedSpeedFrameValues.flatMap((values) => values)
        : selectedMetric === 'acceleration'
          ? trimmedAccelerationFrameValues.flatMap((values) => values)
          : frames.flatMap((frame) =>
              frame.horseFrame.map((horseFrame) => {
                if (selectedMetric === 'hp') return horseFrame.hp ?? 0;
                return horseFrame.lanePosition ?? 0;
              }),
            );
    const min = targetValues.length > 0 ? Math.min(...targetValues) : 0;
    const max = targetValues.length > 0 ? Math.max(...targetValues) : 1;
    const padding = Math.max(
      (max - min) * 0.03,
      selectedMetric === 'hp'
        ? 24
        : selectedMetric === 'lane'
          ? 18
          : selectedMetric === 'acceleration'
            ? 0.12
            : 0.6,
    );
    return {
      min:
        selectedMetric === 'speed' ? Math.max(0, min - padding) : min - padding,
      max: max + padding,
    };
  }, [frameAccelerations, frames, selectedMetric]);

  const getX = (time: number) => {
    const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
    return chartPadding.left + (time / Math.max(maxTime, 1)) * usableWidth;
  };

  const getY = (value: number) => {
    const usableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    let ratio =
      (value - metricRange.min) /
      Math.max(metricRange.max - metricRange.min, 1);

    if (selectedMetric === 'speed' && metricRange.max > metricRange.min) {
      const splitValue = metricRange.max / 2;
      const lowerSpan = Math.max(splitValue - metricRange.min, 0.0001);
      const upperSpan = Math.max(metricRange.max - splitValue, 0.0001);
      const lowerHeightRatio = 0.18;

      if (value <= splitValue) {
        ratio = ((value - metricRange.min) / lowerSpan) * lowerHeightRatio;
      } else {
        ratio =
          lowerHeightRatio +
          ((value - splitValue) / upperSpan) * (1 - lowerHeightRatio);
      }
    }

    if (
      selectedMetric === 'acceleration' &&
      metricRange.max > metricRange.min
    ) {
      const splitValue =
        metricRange.min + ((metricRange.max - metricRange.min) * 2) / 3;
      const lowerSpan = Math.max(splitValue - metricRange.min, 0.0001);
      const upperSpan = Math.max(metricRange.max - splitValue, 0.0001);
      const lowerHeightRatio = 0.82;

      if (value <= splitValue) {
        ratio = ((value - metricRange.min) / lowerSpan) * lowerHeightRatio;
      } else {
        ratio =
          lowerHeightRatio +
          ((value - splitValue) / upperSpan) * (1 - lowerHeightRatio);
      }
    }

    ratio = clamp(ratio, 0, 1);
    return chartHeight - chartPadding.bottom - ratio * usableHeight;
  };

  const yAxisTicks = useMemo(() => {
    if (selectedMetric === 'speed') {
      const ticks = buildSpeedAxisTicks(metricRange.min, metricRange.max);
      return ticks.length > 0 ? ticks : [0, 5, 10];
    }

    if (selectedMetric === 'acceleration') {
      const ticks = buildAccelerationAxisTicks(
        metricRange.min,
        metricRange.max,
      );
      return ticks.length > 0 ? ticks : [metricRange.min, metricRange.max];
    }

    return [0, 0.25, 0.5, 0.75, 1].map(
      (ratio) => metricRange.min + (metricRange.max - metricRange.min) * ratio,
    );
  }, [metricRange.max, metricRange.min, selectedMetric]);

  const linePaths = useMemo(() => {
    const metric = metricMeta[selectedMetric];
    return Array.from({ length: horseCount }, (_, frameOrder) => {
      const path = frames
        .map((frame, index) => {
          const horseFrame = frame.horseFrame[frameOrder];
          const x = getX(frame.time ?? 0);
          const value = metric.getValue({
            frameOrder,
            distance: horseFrame?.distance ?? 0,
            lanePosition: horseFrame?.lanePosition ?? 0,
            speed: (horseFrame?.speed ?? 0) / 100,
            acceleration: frameAccelerations[index]?.[frameOrder] ?? 0,
            hp: horseFrame?.hp ?? 0,
            blockFrontHorseIndex: horseFrame?.blockFrontHorseIndex ?? -1,
            temptationMode: horseFrame?.temptationMode ?? 0,
          });
          const y = getY(value);
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

      return {
        frameOrder,
        color: palette[frameOrder % palette.length],
        name: buildHorseName(displayNames[frameOrder] ?? '', frameOrder),
        path,
      };
    });
  }, [
    displayNames,
    frames,
    frameAccelerations,
    getX,
    horseCount,
    metricRange.max,
    metricRange.min,
    selectedMetric,
  ]);

  const selectedHorseDistanceTimeline = useMemo(
    () =>
      frames.map((frame) => ({
        time: frame.time ?? 0,
        distance: frame.horseFrame[selectedHorse]?.distance ?? 0,
      })),
    [frames, selectedHorse],
  );

  const distanceToTime = useMemo(() => {
    return (targetDistance: number) => {
      if (selectedHorseDistanceTimeline.length === 0) {
        return 0;
      }

      const clampedDistance = clamp(targetDistance, 0, inferredDistance);
      const firstPoint = selectedHorseDistanceTimeline[0];
      if (clampedDistance <= firstPoint.distance) {
        return firstPoint.time;
      }

      for (
        let index = 0;
        index < selectedHorseDistanceTimeline.length - 1;
        index += 1
      ) {
        const currentPoint = selectedHorseDistanceTimeline[index];
        const nextPoint = selectedHorseDistanceTimeline[index + 1];
        if (clampedDistance > nextPoint.distance) {
          continue;
        }

        const distanceSpan = nextPoint.distance - currentPoint.distance;
        if (distanceSpan <= 0) {
          return nextPoint.time;
        }

        const ratio =
          (clampedDistance - currentPoint.distance) /
          Math.max(distanceSpan, 0.0001);
        return currentPoint.time + (nextPoint.time - currentPoint.time) * ratio;
      }

      return selectedHorseDistanceTimeline[
        selectedHorseDistanceTimeline.length - 1
      ].time;
    };
  }, [inferredDistance, selectedHorseDistanceTimeline]);

  const stageSegments = useMemo<BackgroundBandSegment[]>(() => {
    const distance = course?.distance ?? inferredDistance;
    return [
      {
        key: 'phase-opening',
        startDistance: 0,
        endDistance: distance / 6,
        label: '序盘',
        fill: 'rgba(125, 211, 252, 0.18)',
        stroke: 'rgba(14, 165, 233, 0.32)',
        text: '#0f172a',
      },
      {
        key: 'phase-mid',
        startDistance: distance / 6,
        endDistance: (distance * 2) / 3,
        label: '中盘',
        fill: 'rgba(196, 181, 253, 0.18)',
        stroke: 'rgba(139, 92, 246, 0.32)',
        text: '#1e1b4b',
      },
      {
        key: 'phase-late-1',
        startDistance: (distance * 2) / 3,
        endDistance: (distance * 5) / 6,
        label: '末盘前半',
        fill: 'rgba(253, 230, 138, 0.2)',
        stroke: 'rgba(245, 158, 11, 0.32)',
        text: '#78350f',
      },
      {
        key: 'phase-late-2',
        startDistance: (distance * 5) / 6,
        endDistance: distance,
        label: '末盘后半',
        fill: 'rgba(252, 165, 165, 0.2)',
        stroke: 'rgba(239, 68, 68, 0.32)',
        text: '#7f1d1d',
      },
    ].filter((segment) => segment.endDistance > segment.startDistance);
  }, [course?.distance, inferredDistance]);

  const trackTypeSegments = useMemo<BackgroundBandSegment[]>(() => {
    const straights = (course?.straights ?? []).map((straight, index) => ({
      key: `straight-${index}`,
      startDistance: straight.start,
      endDistance: straight.end,
      label: `直线 ${index + 1}`,
      fill: 'rgba(186, 230, 253, 0.16)',
      stroke: 'rgba(2, 132, 199, 0.3)',
      text: '#0c4a6e',
    }));
    const corners = (course?.corners ?? []).map((corner, index) => ({
      key: `corner-${index}`,
      startDistance: corner.start,
      endDistance: corner.start + corner.length,
      label: `弯道 ${index + 1}`,
      fill: 'rgba(254, 215, 170, 0.18)',
      stroke: 'rgba(234, 88, 12, 0.3)',
      text: '#7c2d12',
    }));
    return [...straights, ...corners].filter(
      (segment) => segment.endDistance > segment.startDistance,
    );
  }, [course]);

  const slopeSegments = useMemo<BackgroundBandSegment[]>(() => {
    return (course?.slopes ?? [])
      .filter((slope) => slope.length > 0 && slope.slope !== 0)
      .map((slope, index) => ({
        key: `slope-${index}`,
        startDistance: slope.start,
        endDistance: slope.start + slope.length,
        label: slope.slope > 0 ? `上坡 ${index + 1}` : `下坡 ${index + 1}`,
        fill:
          slope.slope > 0
            ? 'rgba(251, 191, 36, 0.18)'
            : 'rgba(74, 222, 128, 0.18)',
        stroke:
          slope.slope > 0
            ? 'rgba(217, 119, 6, 0.34)'
            : 'rgba(22, 163, 74, 0.34)',
        text: slope.slope > 0 ? '#78350f' : '#14532d',
      }));
  }, [course]);

  useEffect(() => {
    const raceInstanceId = raceMetaInfo?.race_instance_id;
    const raceInstance =
      raceInstanceId != null ? umdb.raceInstances[raceInstanceId] : undefined;
    const courseSet = raceInstance?.courseSet;

    console.log('[RaceTelemetryOverview] resolved course info', {
      raceInstanceId,
      raceId: raceInstance?.raceId,
      courseSet,
      courseDistance: course?.distance,
      raceTrackId: course?.raceTrackId,
      turn: course?.turn,
      surface: course?.surface,
      courseSetStatus: course?.courseSetStatus ?? [],
      straights: (course?.straights ?? []).map((straight, index) => ({
        index: index + 1,
        start: straight.start,
        end: straight.end,
        length: Math.max(0, straight.end - straight.start),
      })),
      corners: (course?.corners ?? []).map((corner, index) => ({
        index: index + 1,
        start: corner.start,
        end: corner.start + corner.length,
        length: corner.length,
      })),
      slopes: (course?.slopes ?? []).map((slope, index) => ({
        index: index + 1,
        start: slope.start,
        end: slope.start + slope.length,
        length: slope.length,
        slope: slope.slope,
        direction:
          slope.slope > 0 ? 'uphill' : slope.slope < 0 ? 'downhill' : 'flat',
      })),
    });
  }, [course, raceMetaInfo?.race_instance_id, umdb]);

  const hoverDisplaySnapshot = hoveredSnapshot ?? currentSnapshot;
  const selectedHorseTelemetry =
    currentSnapshot.horses.find(
      (horse) => horse.frameOrder === selectedHorse,
    ) ?? null;
  const selectedHorseName = buildHorseName(
    displayNames[selectedHorse] ?? '',
    selectedHorse,
  );

  const handleChartMouseMove = (
    event: React.MouseEvent<SVGSVGElement, MouseEvent>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = clamp(event.clientX - rect.left, 0, rect.width);
    const svgX = (relativeX / rect.width) * chartWidth;
    const usableWidth = chartWidth - chartPadding.left - chartPadding.right;
    const time =
      ((svgX - chartPadding.left) / Math.max(usableWidth, 1)) *
      Math.max(maxTime, 1);
    setHoverTime(clamp(time, 0, maxTime));
    setHoverLeft(relativeX);
  };

  const handleChartMouseLeave = () => {
    setHoverTime(null);
    setHoverLeft(null);
  };

  const handleChartClick = () => {
    if (hoverTime != null) {
      setCurrentTime(hoverTime);
    }
  };

  const jumpToNextFrame = () => {
    const nextFrame =
      frames.find((frame) => (frame.time ?? 0) > currentTime + 0.0001) ??
      frames[frames.length - 1];

    if (!nextFrame) {
      return;
    }

    setIsPlaying(false);
    setCurrentTime(nextFrame.time ?? maxTime);
  };

  const jumpToPreviousFrame = () => {
    const previousFrame =
      [...frames]
        .reverse()
        .find((frame) => (frame.time ?? 0) < currentTime - 0.0001) ?? frames[0];

    if (!previousFrame) {
      return;
    }

    setIsPlaying(false);
    setCurrentTime(previousFrame.time ?? 0);
  };

  const showPlaybackFinishedHint = () => {
    setPlaybackFinishedNotice(true);
    if (playbackFinishedNoticeTimeoutRef.current != null) {
      window.clearTimeout(playbackFinishedNoticeTimeoutRef.current);
    }
    playbackFinishedNoticeTimeoutRef.current = window.setTimeout(() => {
      setPlaybackFinishedNotice(false);
      playbackFinishedNoticeTimeoutRef.current = null;
    }, 1800);
  };

  const togglePlayback = () => {
    const stopTime = Math.min(selectedHorseFinishTime, maxTime);
    if (!isPlaying && currentTime >= stopTime - 0.0001) {
      showPlaybackFinishedHint();
      return;
    }

    setPlaybackFinishedNotice(false);
    setIsPlaying((value) => !value);
  };

  const currentRanks = useMemo(() => {
    return [...currentSnapshot.horses]
      .sort((left, right) => right.distance - left.distance)
      .map((horse, index) => ({
        ...horse,
        liveRank: index + 1,
      }));
  }, [currentSnapshot.horses]);

  const raceTrackTrailingDistance = useMemo(
    () =>
      currentSnapshot.horses.length > 0
        ? Math.min(...currentSnapshot.horses.map((horse) => horse.distance))
        : 0,
    [currentSnapshot.horses],
  );

  const raceTrackVisibleMeters = useMemo(() => {
    const usableWidthPx =
      raceTrackViewportWidthPx * (raceTrackMainUsableWidthPercent / 100);
    return Math.max(1, Math.floor(usableWidthPx / raceTrackPixelsPerMeter));
  }, [raceTrackViewportWidthPx]);

  const raceTrackLeadingDistance = useMemo(
    () =>
      currentSnapshot.horses.length > 0
        ? Math.max(...currentSnapshot.horses.map((horse) => horse.distance))
        : 0,
    [currentSnapshot.horses],
  );

  const raceTrackZeroDistance = useMemo(() => {
    const minZeroDistance = raceTrackLeadingDistance - raceTrackVisibleMeters;
    return Math.max(raceTrackTrailingDistance, minZeroDistance);
  }, [
    raceTrackLeadingDistance,
    raceTrackTrailingDistance,
    raceTrackVisibleMeters,
  ]);

  const raceTrackOverflowOrder = useMemo(() => {
    return currentSnapshot.horses
      .filter((horse) => horse.distance < raceTrackZeroDistance)
      .sort((left, right) => left.distance - right.distance)
      .map((horse) => horse.frameOrder);
  }, [currentSnapshot.horses, raceTrackZeroDistance]);

  const raceTrackOverflowIndexByFrameOrder = useMemo(
    () =>
      new Map(
        raceTrackOverflowOrder.map((frameOrder, index) => [frameOrder, index]),
      ),
    [raceTrackOverflowOrder],
  );

  const distanceToRaceTrackXPercent = (
    distance: number,
    frameOrder?: number,
  ) => {
    if (
      frameOrder != null &&
      distance < raceTrackZeroDistance &&
      raceTrackOverflowOrder.length > 0
    ) {
      const overflowIndex =
        raceTrackOverflowIndexByFrameOrder.get(frameOrder) ??
        raceTrackOverflowOrder.length - 1;
      const overflowRatio =
        (overflowIndex + 1) / (raceTrackOverflowOrder.length + 1);
      return (
        raceTrackLeftPercent + overflowRatio * raceTrackOverflowLeftWidthPercent
      );
    }

    const relativeDistance = Math.max(distance - raceTrackZeroDistance, 0);
    const usableWidthPx =
      raceTrackViewportWidthPx * (raceTrackMainUsableWidthPercent / 100);
    const ratio = clamp(
      (relativeDistance * raceTrackPixelsPerMeter) / Math.max(usableWidthPx, 1),
      0,
      1,
    );
    return clamp(
      raceTrackZeroPercent + ratio * raceTrackMainUsableWidthPercent,
      raceTrackZeroPercent,
      raceTrackOverflowRightPercent,
    );
  };

  const skillRows = useMemo(
    () =>
      activeSkills.map((skillEvent) => {
        const resolvedDuration = resolveRaceSkillDurationParam(
          skillEvent.param[1],
          skillEvent.frameTime,
          skillEvent.param[2],
          inferredDistance,
        );
        const effectiveDurationParam = resolvedDuration.durationParam;
        const durationSeconds =
          resolvedDuration.isPermanent || effectiveDurationParam === -1
            ? Math.max(maxTime - (skillEvent.frameTime ?? 0), 0.6)
            : Math.max((effectiveDurationParam ?? 0) / 10000, 0.6);
        const minimumDisplaySeconds =
          (minimumSkillBarWidthPx / skillTimelineWidth) * Math.max(maxTime, 1);

        return {
          key: `${skillEvent.frameTime ?? 0}-${skillEvent.param[1]}-${skillEvent.param[2]}`,
          skillId: skillEvent.param[1],
          time: skillEvent.frameTime ?? 0,
          name:
            umdb.skillName(skillEvent.param[1]) ||
            `Skill ${skillEvent.param[1]}`,
          durationLabel: formatSkillDuration(effectiveDurationParam),
          isPermanent: resolvedDuration.isPermanent,
          inferredFromSkillData: resolvedDuration.inferredFromSkillData,
          baseDurations: resolvedDuration.baseDurations,
          durationSeconds,
          displayDurationSeconds: Math.max(
            durationSeconds,
            minimumDisplaySeconds,
          ),
        };
      }),
    [activeSkills, inferredDistance, maxTime, umdb],
  );

  const timedSkillRows = useMemo(
    () => skillRows.filter((skill) => !skill.isPermanent),
    [skillRows],
  );

  const permanentSkillRows = useMemo(
    () => skillRows.filter((skill) => skill.isPermanent),
    [skillRows],
  );

  const blockedSegments = useMemo(() => {
    const segments: Array<{
      startTime: number;
      endTime: number;
      blockedByFrameOrder: number;
    }> = [];

    if (frames.length === 0) {
      return segments;
    }

    let lastBlockedBy = -1;
    let segmentStartTime = 0;

    frames.forEach((frame, index) => {
      const time = frame.time ?? 0;
      const previousTime = index === 0 ? 0 : (frames[index - 1].time ?? 0);
      const blockedBy =
        frame.horseFrame[selectedHorse]?.blockFrontHorseIndex ?? -1;

      if (blockedBy !== lastBlockedBy) {
        if (lastBlockedBy >= 0) {
          segments.push({
            startTime: segmentStartTime,
            endTime: previousTime,
            blockedByFrameOrder: lastBlockedBy,
          });
        }
        segmentStartTime = previousTime;
        lastBlockedBy = blockedBy;
      }
    });

    if (lastBlockedBy >= 0) {
      segments.push({
        startTime: segmentStartTime,
        endTime: frames[frames.length - 1].time ?? maxTime,
        blockedByFrameOrder: lastBlockedBy,
      });
    }

    return segments.filter((segment) => segment.endTime > segment.startTime);
  }, [frames, maxTime, selectedHorse]);

  useEffect(() => {
    skillRows.forEach((skill) => {
      if (!skill.inferredFromSkillData) {
        return;
      }

      const mixedBaseDurations =
        skill.baseDurations.includes(-1) &&
        skill.baseDurations.some((duration) => duration !== -1);

      if (mixedBaseDurations) {
        console.warn(
          `[RaceTelemetryOverview] frameTime=0 skill duration inferred from mixed alternatives`,
          {
            horse: selectedHorse,
            skillName: skill.name,
            skillId: skill.skillId,
            baseDurations: skill.baseDurations,
            inferredDistance,
            durationLabel: skill.durationLabel,
          },
        );
      }
    });
  }, [activeSkills, inferredDistance, selectedHorse, skillRows]);

  const skillTracks = useMemo(() => {
    const tracks: (typeof timedSkillRows)[] = [];
    const minimumGapSeconds =
      (minimumSkillGapPx / skillTimelineWidth) * Math.max(maxTime, 1);

    timedSkillRows.forEach((skill) => {
      const skillEnd = skill.time + skill.displayDurationSeconds;
      let placed = false;

      for (const track of tracks) {
        const lastSkill = track[track.length - 1];
        const lastSkillEnd =
          lastSkill.time + lastSkill.displayDurationSeconds + minimumGapSeconds;
        if (skill.time >= lastSkillEnd) {
          track.push(skill);
          placed = true;
          break;
        }
      }

      if (!placed) {
        tracks.push([skill]);
      }
    });

    return tracks;
  }, [maxTime, timedSkillRows]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? '';
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (isEditable) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setIsPlaying((value) => !value);
        return;
      }

      if (event.code === 'ArrowLeft') {
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        jumpToPreviousFrame();
        return;
      }

      if (event.code === 'ArrowRight') {
        if (event.repeat) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        jumpToNextFrame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, frames, jumpToNextFrame, jumpToPreviousFrame]);

  if (frames.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
        当前比赛没有可用帧数据，无法生成总览图。
      </div>
    );
  }

  return (
    <div className="w-full px-1 xl:px-2">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.10),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)]">
        <div className="grid items-start gap-6 px-5 py-5 2xl:grid-cols-[340px_minmax(0,1fr)] 2xl:px-6 2xl:py-6">
          <aside className="sticky top-4 flex max-h-[calc(100vh-3rem)] min-h-0 flex-col gap-5 self-start">
            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    时间控制
                  </h4>
                  <p className="text-xs text-slate-500">
                    空格暂停/开始，左右键切帧。
                  </p>
                </div>
                <div className="rounded-full bg-slate-900 px-3 py-1 font-mono text-sm text-white">
                  {currentTime.toFixed(2)}s
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    isPlaying
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isPlaying ? '暂停' : '回放'}
                </button>
                <button
                  type="button"
                  onClick={jumpToPreviousFrame}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  上一帧
                </button>
                <button
                  type="button"
                  onClick={jumpToNextFrame}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  下一帧
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  复位
                </button>
              </div>
              {playbackFinishedNotice ? (
                <div className="mt-2 text-xs font-medium text-amber-600">
                  已播放完，先复位或拖动时间。
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  回放倍率
                </span>
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {[1, 2, 4, 8].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setPlaySpeed(speed)}
                      className={`rounded-xl px-3 py-1 text-xs font-semibold transition ${
                        playSpeed === speed
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={maxTime}
                step={0.01}
                value={currentTime}
                onChange={(event) => setCurrentTime(Number(event.target.value))}
                className="mt-4 w-full accent-slate-900"
              />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              {selectedHorseTelemetry != null ? (
                <>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="truncate text-[13px] font-semibold text-slate-900">
                      {selectedHorseName}
                    </h4>
                    <div className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-white">
                      {currentTime.toFixed(2)}s
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500">
                        当前速度
                      </div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold leading-none text-slate-900">
                        {selectedHorseTelemetry.speed.toFixed(1)} m/s
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500">
                        剩余体力
                      </div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold leading-none text-slate-900">
                        {selectedHorseTelemetry.hp.toFixed(0)} HP
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500">
                        当前距离
                      </div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold leading-none text-slate-900">
                        {selectedHorseTelemetry.distance.toFixed(1)} m
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <div className="text-[9px] uppercase tracking-wide text-slate-500">
                        车道坐标
                      </div>
                      <div className="mt-0.5 font-mono text-[15px] font-semibold leading-none text-slate-900">
                        {selectedHorseTelemetry.lanePosition.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">赛道</h4>
                  <p className="text-xs text-slate-500">
                    点击名称切换聚焦对象。
                  </p>
                </div>
                <div className="text-xs text-slate-500">{horseCount} 人</div>
              </div>
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {rankingRows.map((row) => (
                  <button
                    key={row.frameOrder}
                    type="button"
                    onClick={() => setSelectedHorse(row.frameOrder)}
                    className={`w-full rounded-2xl border px-3 py-2.5 text-left transition shadow-sm ${
                      selectedHorse === row.frameOrder
                        ? 'text-white'
                        : 'text-slate-800'
                    }`}
                    style={{
                      backgroundColor:
                        selectedHorse === row.frameOrder
                          ? `${row.color}E6`
                          : `${row.color}1A`,
                      borderColor:
                        selectedHorse === row.frameOrder
                          ? row.color
                          : `${row.color}55`,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-9 w-9 flex-none overflow-hidden rounded-full">
                        {iconPathByFrameOrder[row.frameOrder] ? (
                          <AssetIcon
                            path={iconPathByFrameOrder[row.frameOrder]!}
                            alt={row.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                        )}
                        <span
                          className="absolute left-1/2 top-1/2 inline-flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-xs font-black leading-none text-white"
                          style={{
                            backgroundColor:
                              selectedHorse === row.frameOrder
                                ? '#dc2626'
                                : raceNumberAccent,
                          }}
                        >
                          {row.frameOrder + 1}
                        </span>
                      </div>
                      <div className="truncate text-sm font-semibold">
                        {row.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="rounded-3xl border border-slate-200 bg-white/92 p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    {selectedHorseName} 的全程轨迹
                  </h4>
                  <p className="text-sm text-slate-500">
                    {metricMeta[selectedMetric].description}
                  </p>
                </div>
                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {(Object.keys(metricMeta) as MetricKey[]).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setSelectedMetric(metric)}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        selectedMetric === metric
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {metricMeta[metric].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={handleChartMouseLeave}
                  onClick={handleChartClick}
                >
                  {yAxisTicks.map((value) => {
                    const y = getY(value);
                    return (
                      <g key={value}>
                        <line
                          x1={chartPadding.left}
                          y1={y}
                          x2={chartWidth - chartPadding.right}
                          y2={y}
                          stroke="rgba(148,163,184,0.18)"
                          strokeWidth="1"
                        />
                        <text
                          x={chartWidth - chartPadding.right + 8}
                          y={y + 4}
                          fontSize="10"
                          fill="#94a3b8"
                        >
                          {metricMeta[selectedMetric].formatter(value)}
                          {metricMeta[selectedMetric].unit}
                        </text>
                      </g>
                    );
                  })}

                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
                    const time = maxTime * ratio;
                    const x = getX(time);
                    return (
                      <g key={ratio}>
                        <line
                          x1={x}
                          y1={chartPadding.top}
                          x2={x}
                          y2={chartHeight - chartPadding.bottom}
                          stroke="rgba(148,163,184,0.14)"
                          strokeWidth="1"
                        />
                        <text
                          x={x}
                          y={chartHeight - 12}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#94a3b8"
                        >
                          {time.toFixed(1)}s
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={chartPadding.left}
                    y1={chartPadding.top}
                    x2={chartPadding.left}
                    y2={chartHeight - chartPadding.bottom}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />

                  {linePaths.map((line) => {
                    const selected = line.frameOrder === selectedHorse;
                    return (
                      <path
                        key={line.frameOrder}
                        d={line.path}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={selected ? 4 : 1.6}
                        strokeOpacity={selected ? 1 : 0.22}
                        style={{
                          filter: selected
                            ? `drop-shadow(0 0 6px ${line.color}66)`
                            : 'none',
                        }}
                      />
                    );
                  })}

                  {raceData.horseResult.map((horseResult, frameOrder) => {
                    const finishTime = horseResult.finishTimeRaw;
                    if (
                      frameOrder !== selectedHorse ||
                      finishTime == null ||
                      !Number.isFinite(finishTime)
                    ) {
                      return null;
                    }
                    return (
                      <g key={`finish-${frameOrder}`}>
                        <line
                          x1={getX(finishTime)}
                          y1={chartPadding.top}
                          x2={getX(finishTime)}
                          y2={chartHeight - chartPadding.bottom}
                          stroke="#dc2626"
                          strokeDasharray="4 4"
                          strokeWidth="1.6"
                        />
                        <title>
                          {`${buildHorseName(
                            displayNames[frameOrder] ?? '',
                            frameOrder,
                          )} 完赛 ${finishTime.toFixed(2)}s`}
                        </title>
                      </g>
                    );
                  })}

                  {activeOtherRaceEvents.map((event, index) => {
                    const time = event?.frameTime ?? 0;
                    const label =
                      otherRaceEventLabels.get(event?.type!) ?? '事件';
                    const x = getX(time);
                    return (
                      <g key={`other-event-${time}-${index}`}>
                        <line
                          x1={x}
                          y1={chartPadding.top}
                          x2={x}
                          y2={chartHeight - chartPadding.bottom}
                          stroke="#f97316"
                          strokeDasharray="3 4"
                          strokeWidth="1.4"
                        />
                        <text
                          x={x}
                          y={chartPadding.top + 10}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="600"
                          fill="#c2410c"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={getX(currentTime)}
                    y1={chartPadding.top}
                    x2={getX(currentTime)}
                    y2={chartHeight - chartPadding.bottom}
                    stroke={metricMeta[selectedMetric].color}
                    strokeWidth="2"
                  />

                  {hoverTime != null ? (
                    <line
                      x1={getX(hoverTime)}
                      y1={chartPadding.top}
                      x2={getX(hoverTime)}
                      y2={chartHeight - chartPadding.bottom}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth="1.2"
                    />
                  ) : null}

                  {[
                    {
                      key: 'phase-text',
                      y: chartHeight - 100,
                      title: '阶段',
                      segments: stageSegments,
                    },
                    {
                      key: 'track-text',
                      y: chartHeight - 82,
                      title: '弯直',
                      segments: trackTypeSegments,
                    },
                    {
                      key: 'slope-text',
                      y: chartHeight - 64,
                      title: '坡道',
                      segments: slopeSegments,
                    },
                  ].map((row) => (
                    <g key={row.key}>
                      <text
                        x={chartPadding.left - 12}
                        y={row.y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="600"
                        fill="#64748b"
                      >
                        {row.title}
                      </text>
                      {row.segments.map((segment) => {
                        const xStart = getX(
                          distanceToTime(segment.startDistance),
                        );
                        const xEnd = getX(distanceToTime(segment.endDistance));
                        const width = Math.max(xEnd - xStart, 0);
                        if (width <= 6) {
                          return null;
                        }

                        return (
                          <g key={segment.key}>
                            <rect
                              x={xStart}
                              y={row.y - 8}
                              width={width}
                              height={16}
                              rx="3"
                              fill={segment.fill}
                              stroke={segment.stroke}
                              strokeWidth="0.8"
                            />
                            {width >= 22 ? (
                              <text
                                x={xStart + width / 2}
                                y={row.y + 4}
                                textAnchor="middle"
                                fontSize="9"
                                fontWeight="600"
                                fill={segment.text}
                              >
                                {segment.label}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>
                  ))}
                </svg>

                {hoverDisplaySnapshot != null && hoverLeft != null ? (
                  <div
                    className="pointer-events-none absolute top-3 z-10 w-64 rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-xl"
                    style={{ left: `${Math.min(hoverLeft + 12, 560)}px` }}
                  >
                    <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {hoverDisplaySnapshot.time.toFixed(2)}s
                      </div>
                      <div className="text-[11px] text-slate-500">
                        点击可跳到这里
                      </div>
                    </div>
                    <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                      {[...hoverDisplaySnapshot.horses]
                        .sort(
                          (left, right) =>
                            metricMeta[selectedMetric].getValue(right) -
                            metricMeta[selectedMetric].getValue(left),
                        )
                        .map((horse) => (
                          <div
                            key={horse.frameOrder}
                            className={`flex items-center justify-between rounded-xl px-2 py-1 ${
                              horse.frameOrder === selectedHorse
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate text-xs font-medium">
                              {buildHorseName(
                                displayNames[horse.frameOrder] ?? '',
                                horse.frameOrder,
                              )}
                            </div>
                            <div className="ml-2 font-mono text-xs">
                              {metricMeta[selectedMetric].formatter(
                                metricMeta[selectedMetric].getValue(horse),
                              )}
                              {metricMeta[selectedMetric].unit}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-2 pt-2.5">
                <div className="relative">
                  {blockedSegments.length > 0 ? (
                    <div className="mb-2">
                      <div className="relative h-5">
                        <div
                          className="absolute inset-y-0 rounded-md border border-red-100 bg-red-50/80"
                          style={{
                            left: `${chartLeftRatio}%`,
                            right: `${chartRightRatio}%`,
                          }}
                        />
                        {blockedSegments.map((segment, index) => {
                          const left =
                            chartLeftRatio +
                            ((100 - chartLeftRatio - chartRightRatio) *
                              segment.startTime) /
                              Math.max(maxTime, 1);
                          const width =
                            ((100 - chartLeftRatio - chartRightRatio) *
                              (segment.endTime - segment.startTime)) /
                            Math.max(maxTime, 1);
                          const blockedByName = buildHorseName(
                            displayNames[segment.blockedByFrameOrder] ?? '',
                            segment.blockedByFrameOrder,
                          );

                          return (
                            <div
                              key={`${segment.startTime}-${segment.endTime}-${index}`}
                              className="absolute top-0.5 h-4 overflow-hidden rounded bg-red-500/85 px-1 text-[10px] font-semibold leading-4 text-white"
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(width, 1.2)}%`,
                                minWidth: '28px',
                              }}
                              title={`阻挡 ${segment.startTime.toFixed(2)}s - ${segment.endTime.toFixed(2)}s | ${blockedByName}`}
                            >
                              阻挡
                            </div>
                          );
                        })}
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400/80"
                          style={{
                            left: `${
                              chartLeftRatio +
                              ((100 - chartLeftRatio - chartRightRatio) *
                                currentTime) /
                                Math.max(maxTime, 1)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {skillTracks.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 pr-36 text-xs text-slate-500">
                      无技能事件
                    </div>
                  ) : (
                    <div className="relative max-h-[240px] overflow-y-auto pr-1">
                      <div
                        className="mb-1 flex justify-between pr-36 text-[10px] text-slate-400"
                        style={{
                          marginLeft: `${chartLeftRatio}%`,
                          marginRight: `${chartRightRatio}%`,
                        }}
                      >
                        <span>0s</span>
                        <span>{maxTime.toFixed(1)}s</span>
                      </div>
                      <div className="relative space-y-0.5">
                        {skillTracks.map((track, trackIndex) => (
                          <div key={trackIndex} className="relative h-5">
                            <div
                              className="absolute text-center text-[10px] font-semibold text-slate-400"
                              style={{
                                left: 0,
                                width: `${Math.max(chartLeftRatio - 1, 3.5)}%`,
                              }}
                            >
                              {trackIndex + 1}
                            </div>
                            <div
                              className="absolute h-5 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                              style={{
                                left: `${chartLeftRatio}%`,
                                right: `${chartRightRatio}%`,
                              }}
                            >
                              {track.map((skill) => {
                                const left =
                                  (skill.time / Math.max(maxTime, 1)) * 100;
                                const width =
                                  (skill.displayDurationSeconds /
                                    Math.max(maxTime, 1)) *
                                  100;
                                const activeNow =
                                  currentTime >= skill.time &&
                                  currentTime <=
                                    skill.time + skill.durationSeconds;

                                return (
                                  <div
                                    key={skill.key}
                                    className={`absolute top-0.5 h-4 overflow-hidden rounded px-1 text-[10px] font-medium leading-4 text-white ${
                                      activeNow
                                        ? 'bg-violet-600 shadow-[0_0_0_1px_rgba(139,92,246,0.35)]'
                                        : 'bg-slate-600/85'
                                    }`}
                                    style={{
                                      left: `${left}%`,
                                      width: `${Math.min(
                                        Math.max(width, 0),
                                        100 - left,
                                      )}%`,
                                    }}
                                    title={`${skill.name} | ${skill.time.toFixed(2)}s | ${skill.durationLabel}`}
                                  >
                                    <div className="truncate">{skill.name}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 w-px bg-red-400/80"
                          style={{
                            left: `${
                              chartLeftRatio +
                              ((100 - chartLeftRatio - chartRightRatio) *
                                currentTime) /
                                Math.max(maxTime, 1)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="absolute right-0 top-0 z-10">
                    <button
                      type="button"
                      onClick={() => setShowPermanentSkills((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-left shadow-sm transition hover:bg-white"
                    >
                      <span className="text-[11px] font-semibold text-slate-600">
                        永久
                      </span>
                      {permanentSkillRows.length > 0 ? (
                        <span className="text-[11px] text-slate-400">
                          ({permanentSkillRows.length})
                        </span>
                      ) : null}
                    </button>
                    {showPermanentSkills ? (
                      permanentSkillRows.length === 0 ? (
                        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[180px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-400 shadow-xl backdrop-blur">
                          无
                        </div>
                      ) : (
                        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[240px] space-y-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur">
                          {permanentSkillRows.map((skill) => (
                            <div
                              key={skill.key}
                              className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-700 shadow-sm"
                              title={`${skill.name} | ${skill.time.toFixed(2)}s | 永久`}
                            >
                              <div className="truncate font-medium">
                                {skill.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 border-t border-slate-200 pt-2.5">
                  <div
                    ref={raceTrackContainerRef}
                    className="relative h-64 overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#eff6ff_0%,_#f8fafc_44%,_#f1f5f9_100%)]"
                  >
                    {raceTrackOverflowOrder.length > 0 ? (
                      <div
                        className="pointer-events-none absolute inset-y-0 border-r border-amber-300/70 bg-amber-100/30"
                        style={{
                          left: '0%',
                          width: `${raceTrackZeroPercent}%`,
                        }}
                      >
                        <div className="absolute left-1 top-1 text-[9px] font-medium text-amber-700">
                          落后区
                        </div>
                      </div>
                    ) : null}

                    {Array.from(
                      { length: raceTrackVisibleMeters + 1 },
                      (_, meter) => {
                        const xPercent = distanceToRaceTrackXPercent(
                          raceTrackZeroDistance + meter,
                        );
                        const showLabel = meter % 2 === 0;
                        return (
                          <div
                            key={`meter-${meter}`}
                            className="pointer-events-none absolute inset-y-0"
                            style={{ left: `${xPercent}%` }}
                          >
                            <div className="absolute inset-y-0 border-l border-slate-300/45" />
                            {showLabel ? (
                              <div className="absolute left-1 top-1 text-[9px] font-medium text-slate-500">
                                {meter}m
                              </div>
                            ) : null}
                          </div>
                        );
                      },
                    )}

                    {Array.from({ length: 9 }, (_, index) => (
                      <div
                        key={index}
                        className="absolute left-0 right-0 border-t border-dashed border-slate-300/70"
                        style={{ top: `${(index / 8) * 100}%` }}
                      />
                    ))}

                    {currentSnapshot.horses.map((horse) => {
                      const finishOrder =
                        raceData.horseResult[horse.frameOrder]?.finishOrder ??
                        0;
                      const finishTime =
                        raceData.horseResult[horse.frameOrder]?.finishTimeRaw ??
                        Number.POSITIVE_INFINITY;
                      const finished = currentTime >= finishTime;
                      const xPercent = distanceToRaceTrackXPercent(
                        horse.distance,
                        horse.frameOrder,
                      );
                      const yPercent = finished
                        ? horseCount <= 1
                          ? 50
                          : 12 +
                            (finishOrder / Math.max(horseCount - 1, 1)) * 76
                        : clamp((horse.lanePosition / 5500) * 100, 4, 96);
                      const liveRank =
                        currentRanks.find(
                          (rankedHorse) =>
                            rankedHorse.frameOrder === horse.frameOrder,
                        )?.liveRank ?? '-';
                      const selected = horse.frameOrder === selectedHorse;

                      return (
                        <div
                          key={horse.frameOrder}
                          className="absolute"
                          style={{
                            left: `${
                              finished
                                ? finishAreaLeftPercent +
                                  finishAreaWidthPercent * 0.42
                                : xPercent
                            }%`,
                            top: `${yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedHorse(horse.frameOrder)}
                            className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-lg ${
                              selected
                                ? 'z-10 scale-110 bg-red-500 ring-4 ring-red-200/80'
                                : 'cursor-pointer'
                            }`}
                            title={`${buildHorseName(
                              displayNames[horse.frameOrder] ?? '',
                              horse.frameOrder,
                            )} | lane ${horse.lanePosition.toFixed(0)} | ${horse.distance.toFixed(1)}m`}
                          >
                            {iconPathByFrameOrder[horse.frameOrder] ? (
                              <div
                                className={`h-full w-full overflow-hidden rounded-full ${
                                  selected ? 'border-2 border-red-500' : ''
                                }`}
                              >
                                <AssetIcon
                                  path={iconPathByFrameOrder[horse.frameOrder]!}
                                  alt={buildHorseName(
                                    displayNames[horse.frameOrder] ?? '',
                                    horse.frameOrder,
                                  )}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className={`flex h-full w-full items-center justify-center rounded-full text-xs font-bold text-white ${
                                  selected ? 'border-2 border-red-500' : ''
                                }`}
                                style={{
                                  backgroundColor:
                                    palette[horse.frameOrder % palette.length],
                                }}
                              >
                                {liveRank}
                              </div>
                            )}
                            <div
                              className="absolute left-1/2 top-1/2 flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full px-1.5 text-xs font-black leading-none text-white shadow-sm"
                              style={{
                                backgroundColor: selected
                                  ? '#dc2626'
                                  : raceNumberAccent,
                              }}
                            >
                              {horse.frameOrder + 1}
                            </div>
                          </button>
                        </div>
                      );
                    })}

                    <div
                      className="absolute inset-y-0 right-0 border-l border-slate-300 bg-slate-100/70"
                      style={{ width: `${finishAreaWidthPercent}%` }}
                    >
                      <div className="absolute inset-x-0 top-2 text-center text-[10px] font-semibold text-slate-500">
                        完赛区
                      </div>
                    </div>

                    {selectedHorseTelemetry != null &&
                    selectedHorseTelemetry.blockFrontHorseIndex >= 0
                      ? (() => {
                          const targetHorse = currentSnapshot.horses.find(
                            (horse) =>
                              horse.frameOrder ===
                              selectedHorseTelemetry.blockFrontHorseIndex,
                          );
                          if (!targetHorse) return null;

                          const toYPercent = (lanePosition: number) =>
                            clamp((lanePosition / 5500) * 100, 4, 96);

                          return (
                            <svg className="absolute inset-0 h-full w-full">
                              <line
                                x1={`${distanceToRaceTrackXPercent(
                                  selectedHorseTelemetry.distance,
                                  selectedHorseTelemetry.frameOrder,
                                )}%`}
                                y1={`${toYPercent(selectedHorseTelemetry.lanePosition)}%`}
                                x2={`${distanceToRaceTrackXPercent(
                                  targetHorse.distance,
                                  targetHorse.frameOrder,
                                )}%`}
                                y2={`${toYPercent(targetHorse.lanePosition)}%`}
                                stroke="#dc2626"
                                strokeWidth="2"
                                strokeDasharray="6 5"
                              />
                            </svg>
                          );
                        })()
                      : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
