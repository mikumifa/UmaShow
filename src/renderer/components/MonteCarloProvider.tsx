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
    | 'seed'
    | 'searchSingleMax'
    | 'searchTotalMax'
    | 'searchGroupSize'
    | 'threadNum'
    | 'radicalFactor'
    | 'searchCpuct'
    | 'maxDepth'
    | 'eventStrength'
    | 'scorePtRate'
    | 'scoringMode'
  >
>;

export type UmaAiSettings = {
  enabled: boolean;
  options: UmaAiOptions;
};

type MonteCarloContextValue = {
  status: MonteCarloBridgeStatus | null;
  settings: UmaAiSettings;
  saveSettings: (settings: UmaAiSettings) => void;
  capturedState: MonteCarloCapturedState | null;
  result: MonteCarloResult | null;
  busy: boolean;
  error: string;
};

const SETTINGS_KEY = 'recommendation.settings.v2';

export const DEFAULT_UMA_AI_SETTINGS: UmaAiSettings = {
  enabled: false,
  options: {
    seed: 0,
    searchSingleMax: 4096,
    searchTotalMax: 0,
    searchGroupSize: 128,
    threadNum: 8,
    radicalFactor: 3,
    searchCpuct: 4,
    maxDepth: 156,
    eventStrength: 20,
    scorePtRate: 2,
    scoringMode: 0,
  },
};

const MonteCarloContext = createContext<MonteCarloContextValue | null>(null);

const errorText = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

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
  value: Partial<UmaAiSettings> | null | undefined,
): UmaAiSettings => {
  const raw = value?.options ?? {};
  const defaults = DEFAULT_UMA_AI_SETTINGS.options;
  const threadNum = Math.round(
    boundedNumber(raw.threadNum, defaults.threadNum, 1, 32),
  );
  const scoringMode = [0, 1, 6].includes(Number(raw.scoringMode))
    ? Number(raw.scoringMode)
    : defaults.scoringMode;
  return {
    enabled: Boolean(value?.enabled),
    options: {
      seed: Math.round(boundedNumber(raw.seed, defaults.seed, 0, 2147483647)),
      searchSingleMax: Math.round(
        boundedNumber(raw.searchSingleMax, defaults.searchSingleMax, 16, 65536),
      ),
      searchTotalMax: Math.round(
        boundedNumber(raw.searchTotalMax, defaults.searchTotalMax, 0, 10000000),
      ),
      searchGroupSize: Math.round(
        boundedNumber(
          raw.searchGroupSize,
          defaults.searchGroupSize,
          Math.min(4096, threadNum * 16),
          4096,
        ),
      ),
      threadNum,
      radicalFactor: boundedNumber(
        raw.radicalFactor,
        defaults.radicalFactor,
        0,
        20,
      ),
      searchCpuct: boundedNumber(raw.searchCpuct, defaults.searchCpuct, 0, 50),
      maxDepth: Math.round(
        boundedNumber(raw.maxDepth, defaults.maxDepth, 1, 156),
      ),
      eventStrength: Math.round(
        boundedNumber(raw.eventStrength, defaults.eventStrength, 0, 1000),
      ),
      scorePtRate: boundedNumber(raw.scorePtRate, defaults.scorePtRate, 0, 20),
      scoringMode,
    },
  };
};

const loadSettings = () => {
  try {
    return normalizeUmaAiSettings(
      JSON.parse(
        localStorage.getItem(SETTINGS_KEY) || 'null',
      ) as Partial<UmaAiSettings>,
    );
  } catch {
    return DEFAULT_UMA_AI_SETTINGS;
  }
};

export function MonteCarloProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MonteCarloBridgeStatus | null>(null);
  const [settings, setSettings] = useState<UmaAiSettings>(loadSettings);
  const [capturedState, setCapturedState] =
    useState<MonteCarloCapturedState | null>(null);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);
  const settingsRef = useRef(settings);
  const busyRef = useRef(false);
  const pendingStateRef = useRef<MonteCarloCapturedState | null>(null);
  const capturedStateRef = useRef<MonteCarloCapturedState | null>(null);
  const lastSequenceRef = useRef(0);

  const analyzeCapturedState = useCallback(
    async (nextState: MonteCarloCapturedState) => {
      if (!settingsRef.current.enabled) return;
      pendingStateRef.current = nextState;
      if (busyRef.current) return;

      busyRef.current = true;
      if (mountedRef.current) setBusy(true);
      const runNext = async (): Promise<void> => {
        if (!settingsRef.current.enabled) {
          pendingStateRef.current = null;
          return;
        }
        const { current } = pendingStateRef;
        if (!current) return;
        pendingStateRef.current = null;
        if (mountedRef.current) setError('');
        try {
          const response = (await window.electron.monteCarlo.analyze(
            current.state,
            settingsRef.current.options,
          )) as MonteCarloResult;
          if (!response.ok) throw new Error(response.error || '计算失败');
          if (mountedRef.current && settingsRef.current.enabled) {
            setResult(response);
          }
        } catch (reason) {
          if (mountedRef.current && settingsRef.current.enabled) {
            setError(errorText(reason));
          }
        }
        await runNext();
      };
      await runNext();
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    },
    [],
  );

  const startAnalysis = useCallback(
    (nextState: MonteCarloCapturedState) => {
      setResult(null);
      analyzeCapturedState(nextState).catch((reason) => {
        if (mountedRef.current && settingsRef.current.enabled) {
          setError(errorText(reason));
        }
        return undefined;
      });
    },
    [analyzeCapturedState],
  );

  const acceptCapturedState = useCallback(
    (nextState: MonteCarloCapturedState | null) => {
      if (!nextState || nextState.sequence <= lastSequenceRef.current) return;
      lastSequenceRef.current = nextState.sequence;
      capturedStateRef.current = nextState;
      setCapturedState(nextState);
      if (settingsRef.current.enabled) startAnalysis(nextState);
    },
    [startAnalysis],
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
        pendingStateRef.current = null;
        setResult(null);
        setBusy(false);
        window.electron.monteCarlo.stop().catch(() => undefined);
        return;
      }
      if (capturedStateRef.current) startAnalysis(capturedStateRef.current);
    },
    [startAnalysis],
  );

  useEffect(() => {
    mountedRef.current = true;
    let disposed = false;
    const unsubscribe = window.electron.monteCarlo.onStateCaptured((value) => {
      if (!disposed) {
        acceptCapturedState(value as MonteCarloCapturedState);
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
        if (!disposed) {
          acceptCapturedState(value as MonteCarloCapturedState | null);
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
      error,
    }),
    [status, settings, saveSettings, capturedState, result, busy, error],
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
