import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  MonteCarloActionResult,
  MonteCarloCapturedState,
  MonteCarloOptions,
  MonteCarloResult,
} from 'types/monteCarlo';

export type MonteCarloBridgeStatus = {
  available: boolean;
  executablePath: string;
  larcExecutablePath?: string;
  dataPath: string;
  engines?: Record<number, boolean>;
};

export type UmaAiOptions = Required<
  Pick<
    MonteCarloOptions,
    | 'modelPath'
    | 'searchSingleMax'
    | 'threadNum'
    | 'radicalFactor'
    | 'eventStrength'
    | 'targetSpeed'
    | 'targetStamina'
    | 'targetPower'
    | 'targetGuts'
    | 'targetWisdom'
    | 'graphSearchNodes'
    | 'graphSearchDepth'
    | 'graphSearchTimeMs'
    | 'graphInferenceBatchSize'
    | 'graphSearchTopK'
    | 'graphSearchChanceOutcomes'
    | 'graphSearchCpuct'
    | 'graphRootSelection'
    | 'graphRootGumbelMaxActions'
    | 'graphRootGumbelScale'
  >
>;

export type UmaAiSettings = {
  enabled: boolean;
  refinementIntervalMs: number;
  refinementParallelism: number;
  options: UmaAiOptions;
};

export type RecommendationRefinementStatus = {
  passes: number;
  totalSearches: number;
  stablePasses: number;
  stopReason?: 'manual';
};

type UmaAiSettingsInput = {
  enabled?: boolean;
  refinementIntervalMs?: number;
  refinementParallelism?: number;
  options?: Partial<MonteCarloOptions>;
};

type MonteCarloContextValue = {
  status: MonteCarloBridgeStatus | null;
  settings: UmaAiSettings;
  saveSettings: (settings: UmaAiSettings) => void;
  capturedState: MonteCarloCapturedState | null;
  result: MonteCarloResult | null;
  busy: boolean;
  refining: boolean;
  suspended: boolean;
  autoRefine: boolean;
  refinementStatus: RecommendationRefinementStatus | null;
  setAutoRefine: (enabled: boolean) => void;
  retryCurrentAnalysis: () => void;
  error: string;
};

const SETTINGS_KEY = 'recommendation.settings.v2';
const AUTO_REFINE_KEY = 'recommendation.auto-refine.v1';
const ANALYSIS_MAX_ATTEMPTS = 3;
const ANALYSIS_RETRY_DELAY_MS = 250;

export const DEFAULT_UMA_AI_SETTINGS: UmaAiSettings = {
  enabled: false,
  refinementIntervalMs: 500,
  refinementParallelism: 1,
  options: {
    modelPath: '',
    searchSingleMax: 4096,
    threadNum: 8,
    radicalFactor: 3,
    eventStrength: 20,
    targetSpeed: 0,
    targetStamina: 0,
    targetPower: 0,
    targetGuts: 0,
    targetWisdom: 0,
    graphSearchNodes: 384,
    graphSearchDepth: 5,
    graphSearchTimeMs: 900,
    graphInferenceBatchSize: 32,
    graphSearchTopK: 4,
    graphSearchChanceOutcomes: 8,
    graphSearchCpuct: 1.5,
    graphRootSelection: 'puct',
    graphRootGumbelMaxActions: 16,
    graphRootGumbelScale: 1,
  },
};

const MonteCarloContext = createContext<MonteCarloContextValue | null>(null);

const errorText = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

export const isRetryableRecommendationError = (reason: unknown) => {
  const message = errorText(reason);
  return (
    message === '推荐已停用' ||
    message === '推荐计算未启动' ||
    message.startsWith('推荐计算已停止')
  );
};

export const analyzeRecommendationWithRetry = async ({
  analyze,
  isCurrent,
  waitForStops,
  maxAttempts = ANALYSIS_MAX_ATTEMPTS,
  retryDelayMs = ANALYSIS_RETRY_DELAY_MS,
}: {
  analyze: () => Promise<MonteCarloResult>;
  isCurrent: () => boolean;
  waitForStops: () => Promise<void>;
  maxAttempts?: number;
  retryDelayMs?: number;
}): Promise<MonteCarloResult | null> => {
  let attempt = 0;
  while (isCurrent() && attempt < maxAttempts) {
    // eslint-disable-next-line no-await-in-loop
    await waitForStops();
    if (!isCurrent()) return null;
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await analyze();
      if (response.ok) return response;
      throw new Error(response.error || '计算失败');
    } catch (reason) {
      if (!isRetryableRecommendationError(reason) || attempt >= maxAttempts) {
        throw reason;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, retryDelayMs);
      });
    }
  }
  return null;
};

const actionWeight = (action: MonteCarloActionResult) =>
  Math.max(1, action.searches);

const mergeActionResults = (
  current: MonteCarloActionResult,
  next: MonteCarloActionResult,
): MonteCarloActionResult => {
  const currentWeight = actionWeight(current);
  const nextWeight = actionWeight(next);
  const totalWeight = currentWeight + nextWeight;
  const scoreMean =
    (current.scoreMean * currentWeight + next.scoreMean * nextWeight) /
    totalWeight;
  const currentVariance = current.scoreStdev ** 2;
  const nextVariance = next.scoreStdev ** 2;
  const scoreVariance =
    (currentWeight * (currentVariance + (current.scoreMean - scoreMean) ** 2) +
      nextWeight * (nextVariance + (next.scoreMean - scoreMean) ** 2)) /
    totalWeight;

  return {
    ...next,
    searches: current.searches + next.searches,
    scoreMean,
    scoreStdev: Math.sqrt(Math.max(0, scoreVariance)),
    value:
      (current.value * currentWeight + next.value * nextWeight) / totalWeight,
  };
};

export const mergeRecommendationResults = (
  current: MonteCarloResult,
  next: MonteCarloResult,
): MonteCarloResult => {
  if (
    !current.ok ||
    !next.ok ||
    current.backend !== next.backend ||
    !current.actions?.length ||
    !next.actions?.length
  ) {
    return next;
  }

  const currentActions = new Map(
    current.actions.map((action) => [action.id, action]),
  );
  const mergedActions = next.actions.map((action) => {
    const previous = currentActions.get(action.id);
    currentActions.delete(action.id);
    return previous ? mergeActionResults(previous, action) : action;
  });
  currentActions.forEach((action) => mergedActions.push(action));
  mergedActions.sort((left, right) => {
    if (next.backend === 'graph') {
      if (left.searches !== right.searches) {
        return right.searches - left.searches;
      }
      if (left.id === next.bestActionId) return -1;
      if (right.id === next.bestActionId) return 1;
    }
    return right.value - left.value;
  });
  const bestAction = mergedActions[0];
  const actions = mergedActions.map((action) => ({
    ...action,
    deltaFromBest: Math.max(0, bestAction.value - action.value),
  }));

  return {
    ...next,
    bestActionId: bestAction.id,
    bestAction: bestAction.label,
    bestValue: bestAction.value,
    predictedScore: bestAction.scoreMean,
    actions,
    searchStats: {
      simulations:
        (current.searchStats?.simulations ?? 0) +
        (next.searchStats?.simulations ?? 0),
      nodes: (current.searchStats?.nodes ?? 0) + (next.searchStats?.nodes ?? 0),
      elapsedMs:
        (current.searchStats?.elapsedMs ?? 0) +
        (next.searchStats?.elapsedMs ?? 0),
    },
  };
};

export const recommendationStabilitySignature = (result: MonteCarloResult) => {
  const actions = [...(result.actions ?? [])].sort(
    (left, right) => left.id - right.id,
  );
  return [
    result.bestActionId ?? '',
    ...actions.map(
      (action) =>
        `${action.id}:${Math.round(action.scoreMean)}:${Math.round(
          action.deltaFromBest,
        )}`,
    ),
  ].join('|');
};

const totalResultSearches = (result: MonteCarloResult) =>
  (result.actions ?? []).reduce(
    (total, action) => total + Math.max(0, action.searches),
    0,
  );

const boundedNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const parsed = Number(value);
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback),
  );
};

export const normalizeUmaAiSettings = (
  value: UmaAiSettingsInput | null | undefined,
): UmaAiSettings => {
  const raw = value?.options ?? {};
  const defaults = DEFAULT_UMA_AI_SETTINGS.options;
  const threadNum = Math.round(
    boundedNumber(raw.threadNum, defaults.threadNum, 1, 32),
  );
  return {
    enabled: Boolean(value?.enabled),
    refinementIntervalMs: Math.round(
      boundedNumber(
        value?.refinementIntervalMs,
        DEFAULT_UMA_AI_SETTINGS.refinementIntervalMs,
        0,
        10000,
      ),
    ),
    refinementParallelism: Math.round(
      boundedNumber(
        value?.refinementParallelism,
        DEFAULT_UMA_AI_SETTINGS.refinementParallelism,
        1,
        4,
      ),
    ),
    options: {
      modelPath: typeof raw.modelPath === 'string' ? raw.modelPath.trim() : '',
      searchSingleMax: Math.round(
        boundedNumber(raw.searchSingleMax, defaults.searchSingleMax, 16, 65536),
      ),
      threadNum,
      radicalFactor: boundedNumber(
        raw.radicalFactor,
        defaults.radicalFactor,
        0,
        20,
      ),
      eventStrength: Math.round(
        boundedNumber(raw.eventStrength, defaults.eventStrength, 0, 1000),
      ),
      targetSpeed: Math.round(
        boundedNumber(raw.targetSpeed, defaults.targetSpeed, 0, 3000),
      ),
      targetStamina: Math.round(
        boundedNumber(raw.targetStamina, defaults.targetStamina, 0, 3000),
      ),
      targetPower: Math.round(
        boundedNumber(raw.targetPower, defaults.targetPower, 0, 3000),
      ),
      targetGuts: Math.round(
        boundedNumber(raw.targetGuts, defaults.targetGuts, 0, 3000),
      ),
      targetWisdom: Math.round(
        boundedNumber(raw.targetWisdom, defaults.targetWisdom, 0, 3000),
      ),
      graphSearchNodes: Math.round(
        boundedNumber(
          raw.graphSearchNodes,
          defaults.graphSearchNodes,
          16,
          8192,
        ),
      ),
      graphSearchDepth: Math.round(
        boundedNumber(raw.graphSearchDepth, defaults.graphSearchDepth, 1, 16),
      ),
      graphSearchTimeMs: Math.round(
        boundedNumber(
          raw.graphSearchTimeMs,
          defaults.graphSearchTimeMs,
          50,
          30000,
        ),
      ),
      graphInferenceBatchSize: Math.round(
        boundedNumber(
          raw.graphInferenceBatchSize,
          defaults.graphInferenceBatchSize,
          1,
          64,
        ),
      ),
      graphSearchTopK: Math.round(
        boundedNumber(raw.graphSearchTopK, defaults.graphSearchTopK, 1, 12),
      ),
      graphSearchChanceOutcomes: Math.round(
        boundedNumber(
          raw.graphSearchChanceOutcomes,
          defaults.graphSearchChanceOutcomes,
          1,
          32,
        ),
      ),
      graphSearchCpuct: boundedNumber(
        raw.graphSearchCpuct,
        defaults.graphSearchCpuct,
        0,
        20,
      ),
      graphRootSelection:
        raw.graphRootSelection === 'gumbel' || raw.graphRootSelection === 'puct'
          ? raw.graphRootSelection
          : defaults.graphRootSelection,
      graphRootGumbelMaxActions: Math.round(
        boundedNumber(
          raw.graphRootGumbelMaxActions,
          defaults.graphRootGumbelMaxActions,
          1,
          48,
        ),
      ),
      graphRootGumbelScale: boundedNumber(
        raw.graphRootGumbelScale,
        defaults.graphRootGumbelScale,
        0,
        10,
      ),
    },
  };
};

const loadSettings = () => {
  try {
    return normalizeUmaAiSettings(
      JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || 'null',
      ) as UmaAiSettingsInput,
    );
  } catch {
    return DEFAULT_UMA_AI_SETTINGS;
  }
};

const loadAutoRefine = () => {
  try {
    return localStorage.getItem(AUTO_REFINE_KEY) === 'true';
  } catch {
    return false;
  }
};

export function MonteCarloProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MonteCarloBridgeStatus | null>(null);
  const [settings, setSettings] = useState<UmaAiSettings>(loadSettings);
  const [capturedState, setCapturedState] =
    useState<MonteCarloCapturedState | null>(null);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [refining, setRefining] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [autoRefine, setAutoRefineState] = useState(loadAutoRefine);
  const [refinementStatus, setRefinementStatus] =
    useState<RecommendationRefinementStatus | null>(null);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const settingsRef = useRef(settings);
  const busyRef = useRef(false);
  const refiningRef = useRef(false);
  const suspendedRef = useRef(false);
  const autoRefinedSequenceRef = useRef(0);
  const refinementRunRef = useRef(0);
  const pendingStateQueueRef = useRef<MonteCarloCapturedState[]>([]);
  const capturedStateRef = useRef<MonteCarloCapturedState | null>(null);
  const lastRetryableStateRef = useRef<MonteCarloCapturedState | null>(null);
  const resultRef = useRef<MonteCarloResult | null>(null);
  const resultStateSignatureRef = useRef('');
  const lastSequenceRef = useRef(0);
  const stopInFlightRef = useRef<Promise<unknown> | null>(null);

  const stopWorkers = useCallback(() => {
    const stopping = window.electron.monteCarlo.stop().catch(() => undefined);
    stopInFlightRef.current = stopping;
    stopping
      .then(() => {
        if (stopInFlightRef.current === stopping) {
          stopInFlightRef.current = null;
        }
        return undefined;
      })
      .catch(() => undefined);
    return stopping;
  }, []);

  const waitForWorkerStops = useCallback(async () => {
    while (stopInFlightRef.current) {
      const stopping = stopInFlightRef.current;
      // A newer stop may be queued while this one is resolving. Analysis
      // must cross every stop barrier before it can reach a worker.
      // eslint-disable-next-line no-await-in-loop
      await stopping;
    }
  }, []);

  const analyzeCapturedState = useCallback(
    async (nextState?: MonteCarloCapturedState) => {
      if (!settingsRef.current.enabled || suspendedRef.current) return;
      if (nextState) pendingStateQueueRef.current.push(nextState);
      await waitForWorkerStops();
      if (!settingsRef.current.enabled || suspendedRef.current) return;
      if (busyRef.current) return;

      busyRef.current = true;
      if (mountedRef.current) setBusy(true);
      const runNext = async (): Promise<void> => {
        if (!settingsRef.current.enabled || suspendedRef.current) {
          pendingStateQueueRef.current = [];
          return;
        }
        const current = pendingStateQueueRef.current.shift();
        if (!current) return;
        if (mountedRef.current) setError('');
        try {
          const isRelevantTurn = () => {
            const latest = capturedStateRef.current;
            return (
              mountedRef.current &&
              settingsRef.current.enabled &&
              !suspendedRef.current &&
              latest?.scenarioId === current.scenarioId &&
              latest.turn === current.turn &&
              latest.gameStage === current.gameStage
            );
          };
          const currentStateSignature = JSON.stringify(current.state);
          const response = await analyzeRecommendationWithRetry({
            analyze: async () =>
              (await window.electron.monteCarlo.analyze(
                current.state,
                settingsRef.current.options,
              )) as MonteCarloResult,
            isCurrent: isRelevantTurn,
            waitForStops: waitForWorkerStops,
          });
          if (!response) {
            await runNext();
            return;
          }
          const latest = capturedStateRef.current;
          const isLatestState =
            mountedRef.current &&
            settingsRef.current.enabled &&
            !suspendedRef.current &&
            latest?.scenarioId === current.scenarioId &&
            latest.turn === current.turn &&
            latest.gameStage === current.gameStage &&
            JSON.stringify(latest.state) === currentStateSignature;
          if (isLatestState) {
            const nextResult =
              resultRef.current &&
              resultStateSignatureRef.current === currentStateSignature
                ? mergeRecommendationResults(resultRef.current, response)
                : response;
            resultStateSignatureRef.current = currentStateSignature;
            resultRef.current = nextResult;
            setResult(nextResult);
          }
        } catch (reason) {
          if (
            mountedRef.current &&
            settingsRef.current.enabled &&
            !suspendedRef.current &&
            capturedStateRef.current?.sequence === current.sequence
          ) {
            setError(errorText(reason));
          }
        }
        await runNext();
      };
      await runNext();
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    },
    [waitForWorkerStops],
  );

  const startAnalysis = useCallback(
    (
      nextState: MonteCarloCapturedState,
      clearResult = true,
      forceRestart = false,
    ) => {
      if (suspendedRef.current) return;
      if (refiningRef.current || (forceRestart && busyRef.current)) {
        refiningRef.current = false;
        setRefining(false);
        stopWorkers();
      }
      refinementRunRef.current += 1;
      setRefinementStatus(null);
      if (clearResult) {
        resultRef.current = null;
        resultStateSignatureRef.current = '';
        setResult(null);
      }
      if (busyRef.current) setBusy(true);
      analyzeCapturedState(nextState).catch((reason) => {
        if (mountedRef.current && settingsRef.current.enabled) {
          setError(errorText(reason));
        }
        return undefined;
      });
    },
    [analyzeCapturedState, stopWorkers],
  );

  const retryCurrentAnalysis = useCallback(() => {
    if (!settingsRef.current.enabled) {
      return;
    }
    const current = capturedStateRef.current ?? lastRetryableStateRef.current;
    if (!current) {
      setError('暂无可重算的训练数据');
      return;
    }
    suspendedRef.current = false;
    setSuspended(false);
    autoRefinedSequenceRef.current = 0;
    setAutoRefineState(true);
    try {
      localStorage.setItem(AUTO_REFINE_KEY, 'true');
    } catch {
      // The current session can still continue refining without persistence.
    }
    capturedStateRef.current = current;
    setCapturedState(current);
    pendingStateQueueRef.current = [];
    startAnalysis(current, true, true);
  }, [startAnalysis]);

  const suspendAnalysis = useCallback(() => {
    suspendedRef.current = true;
    setSuspended(true);
    refinementRunRef.current += 1;
    refiningRef.current = false;
    pendingStateQueueRef.current = [];
    capturedStateRef.current = null;
    resultRef.current = null;
    resultStateSignatureRef.current = '';
    setCapturedState(null);
    setResult(null);
    setRefinementStatus(null);
    setBusy(false);
    setRefining(false);
    stopWorkers();
  }, [stopWorkers]);

  const acceptCapturedState = useCallback(
    (nextState: MonteCarloCapturedState | null) => {
      if (!nextState) {
        suspendAnalysis();
        return;
      }
      if (nextState.sequence <= lastSequenceRef.current) return;
      const previous = capturedStateRef.current;
      const turnChanged =
        previous == null ||
        previous.scenarioId !== nextState.scenarioId ||
        previous.turn !== nextState.turn ||
        previous.gameStage !== nextState.gameStage;
      suspendedRef.current = false;
      setSuspended(false);
      lastSequenceRef.current = nextState.sequence;
      if (turnChanged) {
        resultRef.current = null;
        resultStateSignatureRef.current = '';
        setResult(null);
        setRefinementStatus(null);
      }
      capturedStateRef.current = nextState;
      lastRetryableStateRef.current = nextState;
      setCapturedState(nextState);
      if (settingsRef.current.enabled) startAnalysis(nextState, turnChanged);
    },
    [startAnalysis, suspendAnalysis],
  );

  const saveSettings = useCallback(
    (nextValue: UmaAiSettings) => {
      const normalized = normalizeUmaAiSettings(nextValue);
      settingsRef.current = normalized;
      setSettings(normalized);
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
      } catch {
        // Settings still apply for the current session if storage is unavailable.
      }

      setError('');
      if (!normalized.enabled) {
        refinementRunRef.current += 1;
        refiningRef.current = false;
        pendingStateQueueRef.current = [];
        resultRef.current = null;
        resultStateSignatureRef.current = '';
        setResult(null);
        setBusy(false);
        setRefining(false);
        setRefinementStatus(null);
        stopWorkers();
        return;
      }
      if (capturedStateRef.current) startAnalysis(capturedStateRef.current);
    },
    [startAnalysis, stopWorkers],
  );

  const stopRefinement = useCallback(() => {
    if (!refiningRef.current) return;
    refiningRef.current = false;
    if (mountedRef.current) {
      setRefining(false);
      setRefinementStatus((current) =>
        current ? { ...current, stopReason: 'manual' } : current,
      );
    }
    stopWorkers();
  }, [stopWorkers]);

  const setAutoRefine = useCallback(
    (enabled: boolean) => {
      autoRefinedSequenceRef.current = 0;
      setAutoRefineState(enabled);
      try {
        localStorage.setItem(AUTO_REFINE_KEY, String(enabled));
      } catch {
        // Keep the preference for the current session if storage is unavailable.
      }
      if (!enabled) stopRefinement();
    },
    [stopRefinement],
  );

  const startRefinement = useCallback(async () => {
    const state = capturedStateRef.current;
    const initialResult = resultRef.current;
    if (
      busyRef.current ||
      suspendedRef.current ||
      !settingsRef.current.enabled ||
      state?.scenarioId !== 6 ||
      !initialResult?.ok ||
      !initialResult.actions?.length
    ) {
      return;
    }

    const runId = refinementRunRef.current + 1;
    refinementRunRef.current = runId;
    refiningRef.current = true;
    busyRef.current = true;
    let aggregate = initialResult;
    let lastSignature = recommendationStabilitySignature(initialResult);
    let stablePasses = 0;
    let passes = 0;
    if (mountedRef.current) {
      setError('');
      setBusy(true);
      setRefining(true);
      setRefinementStatus({
        passes: 0,
        totalSearches: totalResultSearches(initialResult),
        stablePasses: 0,
      });
    }

    try {
      while (refiningRef.current) {
        const intervalMs = settingsRef.current.refinementIntervalMs;
        if (intervalMs > 0) {
          // Keep the first recommendation immediate; only automatic
          // refinement passes are paced by the configured interval.
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, intervalMs);
          });
        }
        if (
          !refiningRef.current ||
          runId !== refinementRunRef.current ||
          capturedStateRef.current?.sequence !== state.sequence
        ) {
          break;
        }
        const parallelism = settingsRef.current.refinementParallelism;
        const { options } = settingsRef.current;
        // Each request is routed to a separate native worker. Results are
        // merged only after the whole wave completes so stability remains
        // deterministic.
        // eslint-disable-next-line no-await-in-loop
        const responses = (await Promise.all(
          Array.from({ length: parallelism }, () =>
            window.electron.monteCarlo.analyze(state.state, options),
          ),
        )) as MonteCarloResult[];
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(failedResponse.error || '追加计算失败');
        }
        if (
          !refiningRef.current ||
          runId !== refinementRunRef.current ||
          capturedStateRef.current?.sequence !== state.sequence
        ) {
          break;
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const response of responses) {
          aggregate = mergeRecommendationResults(aggregate, response);
          const signature = recommendationStabilitySignature(aggregate);
          stablePasses = signature === lastSignature ? stablePasses + 1 : 0;
          lastSignature = signature;
          passes += 1;
        }
        resultRef.current = aggregate;
        if (mountedRef.current) {
          setResult(aggregate);
          setRefinementStatus({
            passes,
            totalSearches: totalResultSearches(aggregate),
            stablePasses,
          });
        }
      }
    } catch (reason) {
      if (
        refiningRef.current &&
        runId === refinementRunRef.current &&
        mountedRef.current
      ) {
        setError(errorText(reason));
      }
    } finally {
      refiningRef.current = false;
      busyRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
        setRefining(false);
      }
    }
  }, []);

  useEffect(() => {
    if (
      busy ||
      suspendedRef.current ||
      !settings.enabled ||
      pendingStateQueueRef.current.length === 0
    ) {
      return;
    }
    analyzeCapturedState().catch((reason) => {
      if (mountedRef.current) setError(errorText(reason));
      return undefined;
    });
  }, [analyzeCapturedState, busy, settings.enabled]);

  useEffect(() => {
    if (
      !autoRefine ||
      busy ||
      refining ||
      !settings.enabled ||
      capturedState?.scenarioId !== 6 ||
      !result?.ok ||
      autoRefinedSequenceRef.current === capturedState.sequence
    ) {
      return;
    }
    autoRefinedSequenceRef.current = capturedState.sequence;
    startRefinement().catch((reason) => {
      if (mountedRef.current) setError(errorText(reason));
      return undefined;
    });
  }, [
    autoRefine,
    busy,
    capturedState?.scenarioId,
    capturedState?.sequence,
    refining,
    result?.ok,
    settings.enabled,
    startRefinement,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    const unsubscribe = window.electron.monteCarlo.onStateCaptured((value) => {
      if (!disposed) {
        acceptCapturedState(value as MonteCarloCapturedState | null);
      }
    });

    window.electron.monteCarlo
      .status()
      .then((value) => {
        if (!disposed) setStatus(value as MonteCarloBridgeStatus);
        return undefined;
      })
      .catch((reason) => {
        if (!disposed) setError(errorText(reason));
        return undefined;
      });
    window.electron.monteCarlo
      .loadLatestState()
      .then((value) => {
        const latest = value as MonteCarloCapturedState | null;
        if (!disposed && latest) {
          acceptCapturedState(latest);
        }
        return undefined;
      })
      .catch((reason) => {
        if (!disposed) setError(errorText(reason));
        return undefined;
      });

    return () => {
      disposed = true;
      mountedRef.current = false;
      suspendedRef.current = true;
      refiningRef.current = false;
      refinementRunRef.current += 1;
      unsubscribe();
    };
  }, [acceptCapturedState]);

  const value = useMemo<MonteCarloContextValue>(
    () => ({
      status,
      settings,
      saveSettings,
      capturedState,
      result,
      busy,
      refining,
      suspended,
      autoRefine,
      refinementStatus,
      setAutoRefine,
      retryCurrentAnalysis,
      error,
    }),
    [
      status,
      settings,
      saveSettings,
      capturedState,
      result,
      busy,
      refining,
      suspended,
      autoRefine,
      refinementStatus,
      setAutoRefine,
      retryCurrentAnalysis,
      error,
    ],
  );

  return (
    <MonteCarloContext.Provider value={value}>
      {children}
    </MonteCarloContext.Provider>
  );
}

export const useMonteCarloRecommendation = () => {
  const value = useContext(MonteCarloContext);
  if (!value) {
    throw new Error(
      'useMonteCarloRecommendation must be used inside MonteCarloProvider',
    );
  }
  return value;
};
