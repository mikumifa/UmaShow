export type MonteCarloOptions = {
  modelPath?: string;
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
  targetSpeed?: number;
  targetStamina?: number;
  targetPower?: number;
  targetGuts?: number;
  targetWisdom?: number;
  graphSearchNodes?: number;
  graphSearchDepth?: number;
  graphSearchTimeMs?: number;
  graphInferenceBatchSize?: number;
  graphSearchTopK?: number;
  graphSearchChanceOutcomes?: number;
  graphSearchCpuct?: number;
  graphRootSelection?: 'puct' | 'gumbel';
  graphRootGumbelMaxActions?: number;
  graphRootGumbelScale?: number;
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
  backend?: 'builtin' | 'graph';
  modelLoaded?: boolean;
  modelPath?: string;
  resolvedModelPath?: string;
  inferenceProvider?: 'cpu' | 'directml';
  fallbackReason?: string;
  searchStats?: {
    simulations: number;
    nodes: number;
    elapsedMs: number;
  };
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
