import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EngineAnalysisSearchMode, EngineAvailability, EngineClientType, EngineProtocol, GameState, PlatformErrorKind, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IAssignedEngine, type IEnginePositionState, type IGame } from '@/contracts';
import { EngineRuntimeService, GameRuleService, MoveUpdateService, PositionIdentityService, SerializationService, TimeControlService } from '@/domain';
import { createInitialBoardPosition } from '@/utility/chess';
import type { IEngineAnalysisUpdate } from '@/platform';
import type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';

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
class FakeNwjsEnvironment {
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

function createAssignedEngine(): IAssignedEngine {
  return {
    displayName: 'Stockfish',
    executablePath: 'stockfish.exe',
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 1 },
  };
}
function createEnginePositionState(): IEnginePositionState {
  const rootPosition = createInitialBoardPosition();
  const move = GameRuleService.generateLegalMoves(rootPosition).find((candidate) => candidate.from === boardId(4, 1) && candidate.to === boardId(4, 3))!;
  const resolvedMove = { ...move };
  return {
    rootPosition,
    movesFromRoot: [resolvedMove],
    currentPosition: GameRuleService.applyMove(rootPosition, resolvedMove),
    requiresNewGameBoundary: true,
  };
}
function createPersistedGame(): IGame {
  const rootPosition = createInitialBoardPosition();
  const timeControl = { preset: TimeControlPreset.Untimed, incrementMs: 0 };
  const clockSnapshot = TimeControlService.initialiseClockSnapshot(timeControl);
  return {
    schemaVersion: 1,
    metadata: {
      id: 'game-1',
      name: 'Example Game',
      createdAt: '2026-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
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
    boardRoot: rootPosition,
    moveTree: MoveUpdateService.createMoveTree(rootPosition, clockSnapshot),
    highlightPath: [],
    timeControl,
    clockSnapshot,
    liveAnalysisOptions: { showLiveAnalysisMoves: false },
    analysis: { snapshots: [] },
  };
}
function normaliseTestPath(targetPath: string): string {
  return targetPath.replace(/\\/g, '/');
}

let environment: FakeNwjsEnvironment;
let _originalMatchMedia: typeof window.matchMedia;
let _originalCreateElement: typeof document.createElement;
let _originalRequire: unknown;
let usePlatformService: typeof import('@/platform')['usePlatformService'];

describe('usePlatformService', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    environment = new FakeNwjsEnvironment();
    _originalMatchMedia = window.matchMedia;
    _originalCreateElement = document.createElement.bind(document);
    _originalRequire = (globalThis as any).require;
    vi.resetModules();
    const nwjsUtility = await import('@/utility/nwjs/NwjsUtility');
    nwjsUtility.setNwjsOverride(environment.nw);
    document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'input') return environment.createInput(document);
      return _originalCreateElement(tagName as keyof HTMLElementTagNameMap, options);
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
    document.createElement = _originalCreateElement;
    (globalThis as any).require = _originalRequire;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: _originalMatchMedia });
  });

  it('exposes IPlatformService through a platform store', () => {
    const platform = usePlatformService();
    expect(typeof platform.getStorageAdapter).toBe('function');
    expect(typeof platform.getProcessManager).toBe('function');
    expect(typeof platform.getEngineClient).toBe('function');
    expect(platform.getEventRegistrationSnapshot()).toEqual([]);
  });

  it('handles storage operations with documented failure semantics', async () => {
    const platform = usePlatformService();
    const storage = platform.getStorageAdapter();
    const gameDirectory = path.join(environment.rootPath, 'saves', 'game-1');
    const savePath = path.join(gameDirectory, 'auto.json');

    await storage.ensureDirectory(gameDirectory);
    await storage.writeTextFile(savePath, '{"ok":true}');
    await expect(storage.writeTextFile(savePath, '{}')).rejects.toMatchObject({ kind: PlatformErrorKind.AlreadyExists });
    expect(await storage.readTextFile(savePath)).toBe('{"ok":true}');
    const entries = await storage.listDirectory(gameDirectory);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('auto.json');

    environment.queueDialogSelection(path.join(environment.rootPath, 'exports', 'game-1.json'));
    expect(await storage.showSaveDialog(savePath)).toContain('game-1.json');
  });

  it('routes persisted file operations through SerializationService', async () => {
    const platform = usePlatformService();
    const storage = platform.getStorageAdapter();
    const saveRoot = path.join(environment.rootPath, 'saves');
    const gameDirectory = path.join(saveRoot, 'game-1');
    const autosavePath = path.join(gameDirectory, 'auto.json');
    const sessionPath = path.join(environment.rootPath, 'game-session.json');
    const layoutPath = path.join(environment.rootPath, 'layout-state.json');
    const sessionSnapshot = {
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1' as const,
    };
    const layoutState = {
      schemaVersion: 1,
      showHistoryPanel: true,
      showAnalysisPanel: true,
      historyCollapsed: false,
      analysisCollapsed: false,
      analysisEngineExpandedByIndex: [true, false],
    };

    await storage.ensureDirectory(gameDirectory);
    await SerializationService.writeGameSessionDocument(sessionPath, sessionSnapshot);
    await SerializationService.writeUiLayoutDocument(layoutPath, layoutState);
    await storage.writeTextFile(autosavePath, '{"schemaVersion":1}', { overwrite: true });

    expect(await SerializationService.readGameSessionDocument(sessionPath)).toEqual(sessionSnapshot);
    expect(await SerializationService.readUiLayoutDocument(layoutPath)).toEqual(layoutState);
    const entriesByDirectory = await SerializationService.listManagedSaveEntries(saveRoot);
    const normalisedGameDirectory = normaliseTestPath(gameDirectory);
    expect(entriesByDirectory.get(saveRoot)?.[0]).toMatchObject({ path: normalisedGameDirectory, name: 'game-1', isDirectory: true });
    expect(entriesByDirectory.get(normalisedGameDirectory)?.[0]).toMatchObject({ path: normaliseTestPath(autosavePath), name: 'auto.json', isDirectory: false });

    environment.queueDialogSelection(path.join(environment.rootPath, 'exports', 'game-1.json'));
    expect(await SerializationService.selectExportFile(autosavePath)).toContain('game-1.json');
    environment.queueDialogSelection(autosavePath);
    expect(await SerializationService.selectImportFile(saveRoot)).toContain('auto.json');
  });
  it('creates managed-save parent folders through SerializationService when writing a game document', async () => {
    const savePath = path.join(environment.rootPath, 'saves', 'game-1', 'auto.json');

    await SerializationService.writeGameDocument(savePath, createPersistedGame(), true);

    expect(await usePlatformService().getStorageAdapter().readTextFile(savePath)).toContain('"schemaVersion": 1');
  });

  it('isolates unexpected process exits per session', async () => {
    const platform = usePlatformService();
    const manager = platform.getProcessManager();
    const firstHandle = await manager.spawnProcess('stockfish.exe');
    const firstProcess = environment.latestProcess();
    const secondHandle = await manager.spawnProcess('stockfish.exe');
    const secondProcess = environment.latestProcess();

    firstProcess.emit('exit', 1, null);

    expect(() => manager.assertProcessHandleOpen(firstHandle)).toThrowError(/Process handle is no longer valid/);
    expect(() => manager.assertProcessHandleOpen(secondHandle)).not.toThrow();
    secondProcess.emit('exit', 0, null);
  });

  it('tracks app event registrations from the injected nw window and theme listener', async () => {
    const platform = usePlatformService();
    const callbackOrder: string[] = [];
    const unsubscribeTheme = platform.subscribeToSystemThemeChanged('settings', (theme) => {
      callbackOrder.push(`theme:${theme}`);
    }, 'appearance');

    platform.subscribeToAppCloseRequested('games', () => {
      callbackOrder.push('close:first');
    }, 'autosave');
    platform.subscribeToAppCloseRequested('games', () => {
      callbackOrder.push('close:second');
      throw new Error('close failed');
    }, 'telemetry');
    platform.subscribeToAppFocusReturned('games', () => {
      callbackOrder.push('focus');
    }, 'resume');

    expect(platform.getEventRegistrationSnapshot()).toHaveLength(4);
    environment.nwWindow.emit('focus');
    environment.mediaQuery.setMatches(true);
    environment.nwWindow.emit('close');
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribeTheme();

    expect(callbackOrder).toContain('focus');
    expect(callbackOrder).toContain('theme:dark');
    expect(callbackOrder).toContain('close:first');
    expect(environment.nwWindow.closeCalls).toContain(true);
    expect(platform.getEventRegistrationSnapshot()).toHaveLength(3);
  });

  it('maps engine state to UCI commands and parses analysis plus player moves through one process', async () => {
    const platform = usePlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const positionState = createEnginePositionState();
    const updates: IEngineAnalysisUpdate[] = [];
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Unavailable, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    const syncPromise = client.syncPosition(engine, positionState);
    const process = environment.latestProcess();
    process.queueResponse('go infinite', [
      'info depth 14 multipv 1 score cp 34 pv e7e5 g1f3',
      'info depth 14 multipv 2 score cp 18 pv c7c5',
      'bestmove e7e5',
    ]);
    process.queueResponse('go', ['bestmove e7e5']);
    await syncPromise;
    await client.startAnalysis(engine, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, (update) => {
      updates.push(update);
    });
    await client.startPlayerTurn(engine);
    const bestMove = await client.awaitPlayerTurnMove(engine);
    const commandLog = process.getCommandLog();

    expect(commandLog).toContain('uci');
    expect(commandLog).toContain('setoption name Threads value 1');
    expect(commandLog).toContain('ucinewgame');
    expect(commandLog).toContain('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 moves e2e4');
    expect(updates).toHaveLength(3);
    expect(updates[2]!.positionKey).toBe(PositionIdentityService.buildPositionKey(positionState.currentPosition));
    expect(bestMove.from).toBe(boardId(4, 6));
    expect(bestMove.to).toBe(boardId(4, 4));
  });

  it('reinitialises through EngineRuntimeService when a stored process handle becomes stale', async () => {
    const platform = usePlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    const positionState = createEnginePositionState();
    const staleHandle = await manager.spawnProcess(engine.executablePath);
    engine.$ = { processHandle: staleHandle, availability: EngineAvailability.Ready, analysisLines: new Map() };

    await client.initialiseEngine(engine);
    await manager.stopProcess(staleHandle);
    await EngineRuntimeService.syncPosition(engine, positionState);

    expect(engine.$?.processHandle).toBeDefined();
    expect(engine.$?.processHandle).not.toBe(staleHandle);
    expect(engine.$?.availability).toBe(EngineAvailability.Ready);
    expect(environment.latestProcess().getCommandLog()).toContain('uci');
  });
  it('throws when a session-dependent action runs before initialiseEngine creates a session', async () => {
    const platform = usePlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };

    const positionState = createEnginePositionState();
    await expect(client.syncPosition(engine, positionState)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startAnalysis(engine, { multiPv: 2, searchMode: EngineAnalysisSearchMode.Infinite }, () => undefined)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.startPlayerTurn(engine)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    await expect(client.awaitPlayerTurnMove(engine)).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
  });
  it('does not implicitly initialise when registerEngine is called directly', async () => {
    const platform = usePlatformService();
    const manager = platform.getProcessManager();
    const client = platform.getEngineClient(EngineClientType.Uci);
    const engine = createAssignedEngine();
    engine.$ = { processHandle: await manager.spawnProcess(engine.executablePath), availability: EngineAvailability.Ready, analysisLines: new Map() };

    await expect(client.registerEngine(engine, { name: 'tester', code: '1234', registerLater: false })).rejects.toMatchObject({
      kind: PlatformErrorKind.ProcessStartFailed,
      message: 'Engine session is not initialised for Stockfish.',
    });
    expect(environment.latestProcess().getCommandLog()).toEqual([]);
  });
});
