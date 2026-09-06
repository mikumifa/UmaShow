export type MonteCarloOptions = {
  seed?: number;
  searchSingleMax?: number;
  searchTotalMax?: number;
  searchGroupSize?: number;
  threadNum?: number;
  radicalFactor?: number;
  searchCpuct?: number;
  maxDepth?: number;
  eventStrength?: number;
  scorePtRate?: number;
  scoringMode?: number;
};

export type MonteCarloActionResult = {
  id: number;
  label: string;
  type: number;
  train: number;
  overdrive: boolean;
  searches: number;
  scoreMean: number;
  scoreStdev: number;
  value: number;
  deltaFromBest: number;
  mechaHead?: number;
  mechaChest?: number;
  mechaFoot?: number;
  buy50p?: boolean;
  buyPt10?: boolean;
  buyFriend20?: boolean;
  buyVital20?: boolean;
};

export type MonteCarloResult = {
  ok: boolean;
  id?: string;
  error?: string;
  turn?: number;
  gameStage?: number;
  scenarioId?: number;
  bestActionId?: number;
  bestAction?: string;
  bestValue?: number;
  predictedScore?: number;
  actions?: MonteCarloActionResult[];
  options?: MonteCarloOptions;
};

export type MonteCarloCapturedState = {
  sequence: number;
  capturedAt: number;
  scenarioId: number;
  turn: number;
  gameStage: number;
  state: Record<string, unknown>;
};
