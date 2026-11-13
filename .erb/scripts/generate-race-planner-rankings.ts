import fs from 'fs';
import path from 'path';
import {
  buildPlanningCalendar,
  PLANNER_CATALOG,
} from '../../src/renderer/utils/racePlannerCatalog';
import { recommendRaceInheritance } from '../../src/renderer/utils/raceInheritanceRecommendation';
import {
  REFERENCE_WIN_RATES,
  REFERENCE_WIN_RATE_MODEL_VERSION,
} from '../../src/renderer/utils/raceWinRateModel';
import {
  compareScheduleScores,
  FAN_MODEL,
  type ScheduleInput,
} from '../../src/renderer/utils/raceScheduleOptimizer';

const objectives: ScheduleInput['objective'][] = ['fans', 'wins', 'jewels'];
const rankings = Object.fromEntries(
  objectives.map((objective) => {
    const rows = PLANNER_CATALOG.characters.flatMap((character) => {
      const routes = PLANNER_CATALOG.routes.filter(
        (route) => route.scenarioId === 0 && route.charaId === character.id,
      );
      const plans = routes.flatMap((route) => {
        const calendar = buildPlanningCalendar(character.id, 5, route.id);
        if (calendar.errors.length) return [];
        const recommendation = recommendRaceInheritance({
          races: calendar.races,
          automaticRaces: calendar.automaticRaces,
          startTurn: calendar.startTurn,
          endTurn: calendar.scenario.endTurn,
          aptitudes: character.aptitudes,
          winRates: REFERENCE_WIN_RATES,
          objective,
          gradeThreshold: 100,
          fanBonusPercent: 0,
          fixedRaces: calendar.fixedRaces,
          blockedTurns: calendar.blockedTurns,
          restTurns: [],
        });
        if (recommendation.schedule.error) return [];
        return [
          {
            charaId: character.id,
            name: character.name,
            routeId: route.id,
            expectedFans: recommendation.schedule.expectedFans,
            expectedWins: recommendation.schedule.expectedWins,
            expectedGradeWins: recommendation.schedule.expectedGradeWins,
            expectedDrops: recommendation.schedule.expectedDrops,
            raceCount: recommendation.schedule.raceCount,
            demands: recommendation.demands,
          },
        ];
      });
      plans.sort(
        (a, b) =>
          compareScheduleScores(b, a, objective) || a.routeId - b.routeId,
      );
      return plans.slice(0, 1);
    });
    rows.sort(
      (a, b) => compareScheduleScores(b, a, objective) || a.charaId - b.charaId,
    );
    return [objective, rows];
  }),
);
objectives.forEach((objective) => {
  if (rankings[objective].length !== PLANNER_CATALOG.characters.length)
    throw new Error(
      `Incomplete ${objective} rankings: ${rankings[objective].length} / ${PLANNER_CATALOG.characters.length}`,
    );
});
const output = path.resolve(
  __dirname,
  '../../src/renderer/data/race_planner_rankings.json',
);
fs.writeFileSync(
  output,
  `${JSON.stringify({ masterSha256: PLANNER_CATALOG.masterSha256, winRateModelVersion: REFERENCE_WIN_RATE_MODEL_VERSION, fanModel: FAN_MODEL, scenarioId: 5, gradeThreshold: 100, fanBonus: 0, rankings })}\n`,
  'utf8',
);
console.log(
  `Wrote offline rankings for ${PLANNER_CATALOG.characters.length} characters to ${output}`,
);
