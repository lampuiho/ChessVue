import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, vi } from 'vitest';

import { EngineClientType, EngineProtocol, GameState, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IAssignedEngine, type IGame } from '@/contracts';
import { MoveApplicationService, MoveHistoryService, TimeControlService } from '@/domain';
import { createInitialBoardPosition, toDetailedMove } from '@/utility/chess';
import type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';
import { ClockTimestamp, RecordTimestamp } from '@/utility/date';

const boardId = (file: number, rank: number) => file + (rank * 8);

class FakeMediaQueryList {
  matches = false;
  private readonly _listeners = new Set<(event: { matches: boolean }) => void>();

  addEventListener(_eventName: string, listener: (event: { matches: boolean }) => void): void {
    this._listeners.add(listener);
  }
  removeEventListener(_eventName: string, listener: (event: { matches: boolean }) => void): void {
    this._listeners.delete(listener);
  }
  setMatches(matches: boolean): void {
    this.matches = matches;
    for (const listener of this._listeners) listener({ matches });
  }
}
class FakeNwWindow extends EventEmitter implements INwjsWindow {
  closeCalls: Array<boolean | undefined> = [];
  hideCalls = 0;

  hide(): void {
    this.hideCalls += 1;
  }
  close(force?: boolean): void {
    this.closeCalls.push(force);
  }
}
class FakeChildProcess extends EventEmitter implements ISpawnedProcess {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin: Writable;
  readonly stdio: any[];
  readonly pid = 1;
  readonly killed = false;
  readonly spawnfile = 'fake';
  readonly spawnargs: string[] = [];
  connected = true;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  channel: any = null;
  private readonly _commandLog: string[] = [];
  private readonly _responseByCommand = new Map<string, string[]>();

  constructor() {
    super();
    this.stdio = [null, this.stdout, this.stderr];
    this.stdin = new Writable({
      write: (chunk, _encoding, callback) => {
        const command = chunk.toString().trim();
        this._commandLog.push(command);
        const response = this._responseByCommand.get(command) ?? (command === 'uci' ? ['uciok'] : command === 'isready' ? ['readyok'] : []);
        queueMicrotask(() => {
          for (const line of response) this.stdout.write(`${line}\n`);
        });
        callback();
      },
    });
    queueMicrotask(() => {
      this.emit('spawn');
    });
  }

  queueResponse(command: string, lines: string[]): void {
    this._responseByCommand.set(command, lines);
  }
  getCommandLog(): string[] {
    return [...this._commandLog];
  }
  kill(_signal?: NodeJS.Signals | number): boolean {
    queueMicrotask(() => {
      this.emit('exit', 0, null);
    });
    return true;
  }
  send(): boolean { return false; }
  disconnect(): void {}
  unref(): void {}
  ref(): void {}
}
class FakeDirent {
  constructor(readonly name: string, private readonly _isDirectory: boolean) {}

  isDirectory(): boolean {
    return this._isDirectory;
  }
}
class FakeFileSystemModule {
  private readonly _directories = new Set<string>();
  private readonly _files = new Map<string, { raw: string; mtime: Date }>();
  private _tick = 1;

  constructor(readonly rootPath: string) {
    this._directories.add(this.normalise(rootPath));
  }

  get module(): typeof import('node:fs') {
    return {
      promises: {
        access: this.access.bind(this),
        mkdir: this.mkdir.bind(this),
        readdir: this.readdir.bind(this),
        readFile: this.readFile.bind(this),
        stat: this.stat.bind(this),
        unlink: this.unlink.bind(this),
        writeFile: this.writeFile.bind(this),
      },
    } as unknown as typeof import('node:fs');
  }
  private normalise(targetPath: string): string {
    return targetPath.replace(/\\/g, '/');
  }
  private createNodeError(code: string): NodeJS.ErrnoException {
    const error = new Error(code) as NodeJS.ErrnoException;
    error.code = code;
    return error;
  }
  private ensureDirectoryTree(targetPath: string): void {
    const segments = this.normalise(targetPath).split('/');
    for (let index = 1; index <= segments.length; index += 1) {
      const segmentPath = segments.slice(0, index).join('/');
      if (segmentPath.length > 0) this._directories.add(segmentPath);
    }
  }
  private hasEntry(targetPath: string): boolean {
    const normalisedPath = this.normalise(targetPath);
    return this._directories.has(normalisedPath) || this._files.has(normalisedPath);
  }
  private async access(targetPath: string): Promise<void> {
    if (!this.hasEntry(targetPath)) throw this.createNodeError('ENOENT');
  }
  private async mkdir(targetPath: string, options?: { recursive?: boolean }): Promise<void> {
    const normalisedPath = this.normalise(targetPath);
    const parentPath = this.normalise(path.dirname(targetPath));
    if (!options?.recursive && !this._directories.has(parentPath)) throw this.createNodeError('ENOENT');
    this.ensureDirectoryTree(normalisedPath);
  }
  private async readdir(targetPath: string, _options?: { withFileTypes?: boolean }): Promise<FakeDirent[]> {
    const normalisedPath = this.normalise(targetPath);
    if (!this._directories.has(normalisedPath)) throw this.createNodeError('ENOENT');
    const childEntries = new Map<string, boolean>();
    for (const directoryPath of this._directories) {
      if (directoryPath === normalisedPath) continue;
      if (this.normalise(path.dirname(directoryPath)) === normalisedPath) childEntries.set(path.basename(directoryPath), true);
    }
    for (const filePath of this._files.keys()) {
      if (this.normalise(path.dirname(filePath)) === normalisedPath) childEntries.set(path.basename(filePath), false);
    }
    return [...childEntries.entries()].sort((left, right) => left[0].localeCompare(right[0])).map(([name, isDirectory]) => new FakeDirent(name, isDirectory));
  }
  private async writeFile(targetPath: string, raw: string): Promise<void> {
    const normalisedPath = this.normalise(targetPath);
    const parentPath = this.normalise(path.dirname(targetPath));
    if (!this._directories.has(parentPath)) throw this.createNodeError('ENOENT');
    this._files.set(normalisedPath, { raw, mtime: new Date(this._tick++ * 1000) });
  }
  private async readFile(targetPath: string): Promise<Buffer> {
    const file = this._files.get(this.normalise(targetPath));
    if (file === undefined) throw this.createNodeError('ENOENT');
    return Buffer.from(file.raw, 'utf8');
  }
  private async stat(targetPath: string): Promise<{ mtime: Date }> {
    const file = this._files.get(this.normalise(targetPath));
    if (file === undefined) throw this.createNodeError('ENOENT');
    return { mtime: file.mtime };
  }
  private async unlink(targetPath: string): Promise<void> {
    if (!this._files.delete(this.normalise(targetPath))) throw this.createNodeError('ENOENT');
  }
}
export class FakeNwjsEnvironment {
  readonly rootPath = 'C:\\mock-root';
  readonly nwWindow = new FakeNwWindow();
  readonly mediaQuery = new FakeMediaQueryList();
  readonly nw: INwjsGlobal = { Window: { get: () => this.nwWindow } };
  readonly fileSystem = new FakeFileSystemModule(this.rootPath);
  private readonly _dialogResults: Array<{ kind: 'selected'; path: string } | { kind: 'cancelled' }> = [];
  private readonly _processes: FakeChildProcess[] = [];

  queueDialogSelection(targetPath: string): void {
    this._dialogResults.push({ kind: 'selected', path: targetPath });
  }
  createInput(document: Document): HTMLInputElement & { oncancel: ((event: Event) => void) | null } {
    const input = Document.prototype.createElement.call(document, 'input') as HTMLInputElement & { oncancel: ((event: Event) => void) | null };
    input.oncancel = null;
    input.click = () => {
      const result = this._dialogResults.shift();
      if (result === undefined || result.kind === 'cancelled') return input.oncancel?.(new Event('cancel'));
      Object.defineProperty(input, 'files', { configurable: true, value: [{ path: result.path }] });
      Object.defineProperty(input, 'value', { configurable: true, value: result.path });
      input.onchange?.(new Event('change'));
    };
    return input;
  }
  spawn(): ISpawnedProcess {
    const process = new FakeChildProcess();
    this._processes.push(process);
    return process;
  }
  latestProcess(): FakeChildProcess {
    return this._processes[this._processes.length - 1]!;
  }
}

export function createAssignedEngine(): IAssignedEngine {
  return {
    displayName: 'Stockfish',
    executablePath: 'stockfish.exe',
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 1 },
  };
}
export function createEngineGame(): IGame {
  const game = createPersistedGame();
  game.timeControl = { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 1000 };
  game.clockSnapshot = TimeControlService.startClock(TimeControlService.initialiseClockSnapshot(game.timeControl), PlayerColour.Black, new ClockTimestamp('2026-01-01T12:00:01.000Z'));
  const move = toDetailedMove(game.rootPosition, { from: boardId(4, 1), to: boardId(4, 3) });
  const liveNode = MoveHistoryService.addMainlineMove(game.moveTree.root, move, game.clockSnapshot);
  game.gameState = GameState.LiveBlackTurn;
  game.livePath = [0];
  game.highlightPath = [0];
  // the engine client reads the searched position off the runtime rather than deriving it
  const livePosition = MoveApplicationService.genPosition(game.rootPosition, [move]);
  game.$ = { renderedNode: liveNode, liveNode, renderedPosition: livePosition, livePosition };
  return game;
}
export function createPersistedGame(): IGame {
  const rootPosition = createInitialBoardPosition();
  const timeControl = { preset: TimeControlPreset.Untimed, incrementMs: 0 };
  const clockSnapshot = TimeControlService.initialiseClockSnapshot(timeControl);
  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: new RecordTimestamp('2026-01-01T12:00:00.000Z'),
      updatedAt: new RecordTimestamp('2026-01-01T12:00:00.000Z'),
    },
    gameState: GameState.AnalysisWhiteMove,
    resultState: ResultState.Ongoing,
    whitePlayer: {
      colour: PlayerColour.White,
      type: PlayerType.Local,
      displayName: 'White',
    },
    blackPlayer: {
      colour: PlayerColour.Black,
      type: PlayerType.Local,
      displayName: 'Black',
    },
    rootPosition,
    moveTree: MoveHistoryService.createMoveTree(clockSnapshot),
    livePath: undefined,
    highlightPath: [],
    timeControl,
    clockSnapshot,
    gameplayOptions: { showLiveAnalysisMoves: false, allowTakeback: false },
    analysis: { snapshots: [] },
  };
}
export function normaliseTestPath(targetPath: string): string {
  return targetPath.replace(/\\/g, '/');
}
export function getBoardId(file: number, rank: number): number {
  return boardId(file, rank);
}
export function registerNwjsPlatformTestEnvironment() {
  let environment: FakeNwjsEnvironment;
  let originalMatchMedia: typeof window.matchMedia;
  let originalCreateElement: typeof document.createElement;
  let originalRequire: unknown;
  let usePlatformService: typeof import('@/platform')['usePlatformService'];

  beforeEach(async () => {
    setActivePinia(createPinia());
    environment = new FakeNwjsEnvironment();
    originalMatchMedia = window.matchMedia;
    originalCreateElement = document.createElement.bind(document);
    originalRequire = (globalThis as any).require;
    vi.resetModules();
    const nwjsUtility = await import('@/utility/nwjs/NwjsUtility');
    nwjsUtility.setNwjsOverride(environment.nw);
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'input') return environment.createInput(document);
      return originalCreateElement(tagName as keyof HTMLElementTagNameMap, options);
    }) as typeof document.createElement;
    (globalThis as any).require = ((moduleName: string) => {
      if (moduleName === 'fs') return environment.fileSystem.module;
      if (moduleName === 'path') return path;
      if (moduleName === 'child_process') return { spawn: () => environment.spawn() as any };
      throw new Error(`Unsupported test module: ${moduleName}.`);
    }) as any;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => environment.mediaQuery });
    ({ usePlatformService } = await import('@/platform'));
  });
  afterEach(async () => {
    const nwjsUtility = await import('@/utility/nwjs/NwjsUtility');
    nwjsUtility.setNwjsOverride(null);
    document.createElement = originalCreateElement;
    (globalThis as any).require = originalRequire;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  return {
    getEnvironment(): FakeNwjsEnvironment {
      return environment;
    },
    getPlatformService(): ReturnType<typeof usePlatformService> {
      return usePlatformService();
    },
  };
}
