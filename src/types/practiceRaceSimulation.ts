export type SimulationProgress = {
  stage:
    | 'login'
    | 'prepare'
    | 'simulate'
    | 'save'
    | 'complete'
    | 'stopped'
    | 'error';
  detail: string;
  current?: number;
  total?: number;
  archiveId?: string;
  archiveName?: string;
};

export type SimulationResult = {
  ok: boolean;
  cancelled?: boolean;
  completed: number;
  total: number;
  archiveId?: string;
  archiveName?: string;
  error?: string;
};

export type SimulationStatus = {
  running: boolean;
  stopping: boolean;
  accountId?: string;
  progress?: SimulationProgress;
  result?: SimulationResult;
};
