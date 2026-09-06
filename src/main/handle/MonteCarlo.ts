import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app, IpcMain } from 'electron';
import type { MonteCarloOptions, MonteCarloResult } from 'types/monteCarlo';
import { getLatestMonteCarloState } from './MonteCarloState';

const PROTOCOL_PREFIX = 'UMASHOW_JSON:';
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

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
    this.process = spawn(exe, [database], {
      cwd: path.dirname(exe),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', (chunk: string) => {
      this.stdoutBuffer += chunk;
      const lines = this.stdoutBuffer.split(/\r?\n/);
      this.stdoutBuffer = lines.pop() || '';
      lines.forEach((line) => this.consumeLine(line));
    });
    this.process.once('error', (error) => this.fail(error));
    this.process.once('exit', (code) => {
      if (this.process) {
        this.fail(new Error(`推荐计算已停止（${code ?? 'unknown'}）`));
      }
    });
    await this.readyPromise;
  }

  async analyze(
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

  stop() {
    const runningProcess = this.process;
    this.fail(new Error('推荐已停用'));
    runningProcess?.kill();
  }
}

const workers = new Map<number, MonteCarloWorker>([
  [6, new MonteCarloWorker(6)],
  [9, new MonteCarloWorker(9)],
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
  ipcMain.handle(
    'monte-carlo:analyze',
    (_event, state: Record<string, unknown>, options?: MonteCarloOptions) => {
      const scenarioId = scenarioIdFromState(state);
      return workers.get(scenarioId)!.analyze(state, options);
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
