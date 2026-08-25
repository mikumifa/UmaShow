/* eslint-disable no-bitwise */
import {
  RaceSimulateData,
  RaceSimulateEventData,
  RaceSimulateEventData_SimulateEventType,
} from './race_data_pb';

// frameOrder should be 0-indexed.
export function filterRaceEvents(
  raceSimulateData: RaceSimulateData,
  frameOrder: number,
  eventType: RaceSimulateEventData_SimulateEventType,
): RaceSimulateEventData[] {
  return raceSimulateData.event
    .map((e) => e.event!)
    .filter(
      (event) => event.type === eventType && event.param[0] === frameOrder,
    );
}

// frameOrder should be 0-indexed.
export function filterCharaSkills(
  raceSimulateData: RaceSimulateData,
  frameOrder: number,
): RaceSimulateEventData[] {
  return filterRaceEvents(
    raceSimulateData,
    frameOrder,
    RaceSimulateEventData_SimulateEventType.SKILL,
  );
}

// frameOrder should be 0-indexed.
export function getCharaActivatedSkillIds(
  raceSimulateData: RaceSimulateData,
  frameOrder: number,
): Set<number> {
  return new Set(
    filterCharaSkills(raceSimulateData, frameOrder).map(
      (event) => event.param[1],
    ),
  );
}

// frameOrder should be 0-indexed. This excludes skills casted by self.
export function filterCharaTargetedSkills(
  raceSimulateData: RaceSimulateData,
  frameOrder: number,
): RaceSimulateEventData[] {
  const mask = 1 << frameOrder;
  return raceSimulateData.event
    .map((e) => e.event!)
    .filter(
      (event) =>
        event.type === RaceSimulateEventData_SimulateEventType.SKILL &&
        event.param[0] !== frameOrder &&
        event.paramCount! >= 5 &&
        event.param[4] & mask,
    );
}

export type SkillImpactSummary = {
  activationCount: number;
  affectedHorseCount: number;
};

export function getExternalSkillTargetFrameOrders(
  event: RaceSimulateEventData,
  horseCount: number,
): number[] {
  if (
    event.type !== RaceSimulateEventData_SimulateEventType.SKILL ||
    (event.paramCount ?? 0) < 5
  ) {
    return [];
  }

  const sourceFrameOrder = Number(event.param[0]);
  const targetMask = Number(event.param[4]) >>> 0;
  const targets: number[] = [];
  const safeHorseCount = Math.min(Math.max(horseCount, 0), 32);

  for (let frameOrder = 0; frameOrder < safeHorseCount; frameOrder += 1) {
    if (frameOrder !== sourceFrameOrder && targetMask & (1 << frameOrder)) {
      targets.push(frameOrder);
    }
  }

  return targets;
}

export function getCharaSkillImpactSummary(
  raceSimulateData: RaceSimulateData,
  frameOrder: number,
): Map<number, SkillImpactSummary> {
  const result = new Map<number, SkillImpactSummary>();
  const horseCount = raceSimulateData.horseResult.length;

  filterCharaSkills(raceSimulateData, frameOrder).forEach((event) => {
    const skillId = Number(event.param[1]);
    if (!Number.isFinite(skillId)) return;

    const current = result.get(skillId) ?? {
      activationCount: 0,
      affectedHorseCount: 0,
    };
    current.activationCount += 1;
    current.affectedHorseCount += getExternalSkillTargetFrameOrders(
      event,
      horseCount,
    ).length;
    result.set(skillId, current);
  });

  return result;
}
