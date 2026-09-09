/* eslint-disable max-classes-per-file */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app, dialog, IpcMain } from 'electron';
import type { MonteCarloOptions, MonteCarloResult } from 'types/monteCarlo';
import { getLatestMonteCarloState } from './MonteCarloState';

const PROTOCOL_PREFIX = 'UMASHOW_JSON:';
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const ANALYZE_MAX_ATTEMPTS = 3;
const ANALYZE_RETRY_DELAY_MS = 250;

const retryableWorkerError = (error: Error) =>
  error.message.startsWith('推荐计算已停止') ||
  error.message === '推荐计算未启动';

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });

const assetsRoot = () =>
  app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

const executablePath = (scenarioId: number) =>
  path.join(
    assetsRoot(),
    'native',
    scenarioId === 6 ? 'UmaShowMonteCarloLArc.exe' : 'UmaShowMonteCarlo.exe',
  );

const dataPath = () => path.join(assetsRoot(), 'data', 'monte_carlo.json');

type PendingRequest = {
  resolve: (value: MonteCarloResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class MonteCarloWorker {
  private readonly scenarioId: number;

  constructor(scenarioId: number) {
    this.scenarioId = scenarioId;
  }

  private process: ChildProcessWithoutNullStreams | null = null;

  private readyPromise: Promise<void> | null = null;

  private resolveReady: (() => void) | null = null;

  private rejectReady: ((error: Error) => void) | null = null;

  private stdoutBuffer = '';

  private readonly pending = new Map<string, PendingRequest>();

  private stopVersion = 0;

  private fail(error: Error) {
    this.rejectReady?.(error);
    this.resolveReady = null;
    this.rejectReady = null;
    this.pending.forEach((request) => {
      clearTimeout(request.timer);
      request.reject(error);
    });
    this.pending.clear();
    this.process = null;
    this.readyPromise = null;
  }

  private consumeLine(line: string) {
    const marker = line.indexOf(PROTOCOL_PREFIX);
    if (marker < 0) return;
    let message: MonteCarloResult & { type?: string };
    try {
      message = JSON.parse(line.slice(marker + PROTOCOL_PREFIX.length));
    } catch {
      return;
    }
    if (message.type === 'ready') {
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }
    if (message.type === 'fatal') {
      this.fail(new Error(message.error || '推荐计算初始化失败'));
      return;
    }
    if (!message.id) return;
    const request = this.pending.get(message.id);
    if (!request) return;
    this.pending.delete(message.id);
    clearTimeout(request.timer);
    request.resolve(message);
  }

  private async ensureReady() {
    if (this.process && this.readyPromise) {
      await this.readyPromise;
      return;
    }
    const exe = executablePath(this.scenarioId);
    const database = dataPath();
    if (!fs.existsSync(exe)) throw new Error('缺少推荐计算组件');
    if (!fs.existsSync(database)) throw new Error('缺少推荐计算数据');

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.stdoutBuffer = '';
    const workerProcess = spawn(exe, [database], {
      cwd: path.dirname(exe),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process = workerProcess;
    workerProcess.stdout.setEncoding('utf8');
    workerProcess.stdout.on('data', (chunk: string) => {
      if (this.process !== workerProcess) return;
      this.stdoutBuffer += chunk;
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() || '';
      lines.forEach((line) => this.consumeLine(line));
    });
    workerProcess.once('error', (error) => {
      if (this.process === workerProcess) this.fail(error);
    });
    workerProcess.once('exit', (code) => {
      if (this.process === workerProcess) {
        this.fail(new Error(`推荐计算已停止（${code ?? 'unknown'}）`));
      }
    });
    await this.readyPromise;
  }

  private async analyzeOnce(
    state: Record<string, unknown>,
    options: MonteCarloOptions = {},
  ): Promise<MonteCarloResult> {
    await this.ensureReady();
    if (!this.process) throw new Error('推荐计算未启动');
    const id = randomUUID();
    const result = new Promise<MonteCarloResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('推荐计算超时'));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
    });
    const request: Record<string, unknown> = { id, state, options };
    if (options.seed != null && options.seed !== 0) request.seed = options.seed;
    this.process.stdin.write(`${JSON.stringify(request)}\n`);
    return result;
  }

  async analyze(
    state: Record<string, unknown>,
    options: MonteCarloOptions = {},
  ): Promise<MonteCarloResult> {
    const analyzeStopVersion = this.stopVersion;
    let lastError = new Error('推荐计算失败');

    for (let attempt = 1; attempt <= ANALYZE_MAX_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.analyzeOnce(state, options);
      } catch (reason) {
        lastError =
          reason instanceof Error ? reason : new Error(String(reason));
        const shouldRetry =
          attempt < ANALYZE_MAX_ATTEMPTS &&
          analyzeStopVersion === this.stopVersion &&
          retryableWorkerError(lastError);
        if (!shouldRetry) throw lastError;
        // Give Windows a moment to release the crashed worker before restart.
        // eslint-disable-next-line no-await-in-loop
        await wait(ANALYZE_RETRY_DELAY_MS);
      }
    }

    throw lastError;
  }

  stop() {
    this.stopVersion += 1;
    const runningProcess = this.process;
    this.fail(new Error('推荐已停用'));
    runningProcess?.kill();
  }
}

class MonteCarloWorkerPool {
  private readonly workers: MonteCarloWorker[];

  private readonly activeRequests: number[];

  constructor(scenarioId: number, size: number) {
    this.workers = Array.from(
      { length: size },
      () => new MonteCarloWorker(scenarioId),
    );
    this.activeRequests = Array.from({ length: size }, () => 0);
  }

  async analyze(
    state: Record<string, unknown>,
    options: MonteCarloOptions = {},
  ) {
    let workerIndex = 0;
    for (let index = 1; index < this.workers.length; index += 1) {
      if (this.activeRequests[index] < this.activeRequests[workerIndex]) {
        workerIndex = index;
      }
    }
    this.activeRequests[workerIndex] += 1;
    try {
      return await this.workers[workerIndex].analyze(state, options);
    } finally {
      this.activeRequests[workerIndex] = Math.max(
        0,
        this.activeRequests[workerIndex] - 1,
      );
    }
  }

  stop() {
    this.workers.forEach((worker) => worker.stop());
  }
}

const workers = new Map<number, MonteCarloWorkerPool>([
  [6, new MonteCarloWorkerPool(6, 4)],
  [9, new MonteCarloWorkerPool(9, 1)],
]);

const scenarioIdFromState = (state: Record<string, unknown>) => {
  const scenarioId = Number(state.scenarioId);
  if (scenarioId === 6 || scenarioId === 9) return scenarioId;
  throw new Error(`当前剧本暂不支持推荐：scenario_id=${scenarioId || 0}`);
};

export default function handleMonteCarlo(ipcMain: IpcMain) {
  ipcMain.handle('monte-carlo:status', () => {
    const mechaExecutablePath = executablePath(9);
    const larcExecutablePath = executablePath(6);
    const databaseAvailable = fs.existsSync(dataPath());
    const mechaAvailable = fs.existsSync(mechaExecutablePath);
    const larcAvailable = fs.existsSync(larcExecutablePath);
    return {
      available: databaseAvailable && (mechaAvailable || larcAvailable),
      executablePath: mechaExecutablePath,
      larcExecutablePath,
      dataPath: dataPath(),
      engines: {
        6: larcAvailable && databaseAvailable,
        9: mechaAvailable && databaseAvailable,
      },
    };
  });
  ipcMain.handle('monte-carlo:select-model', async () => {
    const selection = await dialog.showOpenDialog({
      title: '选择凯旋门推荐模型',
      properties: ['openFile'],
      filters: [
        { name: '推荐模型', extensions: ['onnx'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    return selection.canceled ? null : selection.filePaths[0] || null;
  });
  ipcMain.handle(
    'monte-carlo:analyze',
    async (
      _event,
      state: Record<string, unknown>,
      options?: MonteCarloOptions,
    ) => {
      const scenarioId = scenarioIdFromState(state);
      try {
        return await workers.get(scenarioId)!.analyze(state, options);
      } catch (reason) {
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        if (error.message === '推荐已停用') {
          return { ok: false, error: error.message };
        }
        throw error;
      }
    },
  );
  ipcMain.handle('monte-carlo:load-latest-state', () =>
    getLatestMonteCarloState(),
  );
  ipcMain.handle('monte-carlo:stop', () => {
    workers.forEach((worker) => worker.stop());
    return true;
  });
  app.once('before-quit', () => workers.forEach((worker) => worker.stop()));
}
