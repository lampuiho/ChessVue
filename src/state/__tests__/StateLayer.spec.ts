import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalysisBranchExitBehaviour,
  AppModalKind,
  BoardOrientation,
  DrawOfferDirection,
  EngineAvailability,
  EngineClientType,
  EngineProtocol,
  GameState,
  PauseReason,
  PlatformErrorKind,
  PlayerColour,
  PlayerType,
  ResultReason,
  ResultState,
  SaveGameTargetKind,
  PromotionPolicy,
  TakebackPolicy,
  ThemeMode,
  TimeControlPreset,
  type IAssignedEngine,
  type IEngineRecord,
  type IGame,
  type ISettingsSnapshot,
} from '@/contracts';
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
  close(_force?: boolean): void {}
  hide(): void {}
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
    this._directories.add('.');
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
  private async readdir(targetPath: string): Promise<FakeDirent[]> {
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
  queueDialogCancel(): void {
    this._dialogResults.push({ kind: 'cancelled' });
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

function createEngineRecord(id: string, displayName: string): IEngineRecord {
  return {
    id,
    displayName,
    executablePath: `${displayName.toLowerCase()}.exe`,
    clientType: EngineClientType.Uci,
    protocol: EngineProtocol.Uci,
    options: { Threads: 1 },
  };
}
function createSettingsSnapshot(rootPath: string): ISettingsSnapshot {
  return {
    schemaVersion: 1,
    gameSession: {
      restorePreviousSession: true,
      saveRootPath: rootPath,
      autosaveAfterMoveCount: 1,
      autosaveOnClose: true,
      autoPauseOnMenu: true,
    },
    gameDefaults: {
      quickNewGameName: 'New Game',
      defaultTimeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
      defaultWhitePlayerType: PlayerType.Local,
      defaultBlackPlayerType: PlayerType.Local,
    },
    gameplay: {
      takebackPolicy: TakebackPolicy.RewriteMainline,
      confirmMainlineRewrite: true,
      analysisBranchExitBehaviour: AnalysisBranchExitBehaviour.ReturnToLiveNode,
      promotionPolicy: PromotionPolicy.RequireExplicitSelection,
    },
    analysis: {
      resumeLiveAnalysisAfterRestore: true,
      engineInventory: [
        createEngineRecord('engine-a', 'Stockfish'),
        createEngineRecord('engine-b', 'Lc0'),
      ],
    },
    appearance: {
      themeMode: ThemeMode.System,
      boardTheme: 'classic',
      pieceTheme: 'classic',
      uiScalePercent: 100,
      boardOrientation: BoardOrientation.White,
      showCoordinates: true,
      highlightLastMove: true,
    },
  };
}
function normaliseTestPath(targetPath: string): string {
  return targetPath.replace(/\\/g, '/');
}

let environment: FakeNwjsEnvironment;
let _originalMatchMedia: typeof window.matchMedia;
let _originalCreateElement: typeof document.createElement;
let _originalRequire: unknown;
let useEnginesStore: typeof import('..')['useEnginesStore'];
let useGamesStore: typeof import('..')['useGamesStore'];
let useRecentGameStore: typeof import('..')['useRecentGameStore'];
let useSavedGamesStore: typeof import('..')['useSavedGamesStore'];
let useSettingsStore: typeof import('..')['useSettingsStore'];
let useUiStateStore: typeof import('..')['useUiStateStore'];
let SerializationService: typeof import('@/domain')['SerializationService'];
let EngineRuntimeService: typeof import('@/domain')['EngineRuntimeService'];
let MoveNotationService: typeof import('@/domain')['MoveNotationService'];
let GameRuleService: typeof import('@/domain')['GameRuleService'];
let MoveUpdateService: typeof import('@/domain')['MoveUpdateService'];
let TimeControlService: typeof import('@/domain')['TimeControlService'];
let PositionIdentityService: typeof import('@/domain')['PositionIdentityService'];
let UserSettingService: typeof import('@/domain')['UserSettingService'];
let createInitialBoardPosition: typeof import('@/utility/chess')['createInitialBoardPosition'];

async function seedSettings(): Promise<void> {
  await UserSettingService.saveSettings(createSettingsSnapshot(normaliseTestPath(path.join(environment.rootPath, 'saves'))));
}
async function createPersistedGameFile(gameId: string, saveName: string, gameName: string, updatedAt: string): Promise<string> {
  const gamesStore = useGamesStore();
  const game = await gamesStore.createGame({
    name: gameName,
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
    analysisEngineProfiles: [],
    showLiveAnalysisMoves: false,
    timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
  });
  game.metadata.id = gameId;
  game.metadata.updatedAt = updatedAt;
  game.metadata.createdAt = updatedAt;
  const targetPath = saveName === 'auto'
    ? path.join(environment.rootPath, 'saves', gameId, 'auto.json')
    : path.join(environment.rootPath, 'saves', gameId, `${saveName}.json`);
  await SerializationService.writeGameDocument(targetPath, game, true);
  return normaliseTestPath(targetPath);
}

describe('State Layer', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    environment = new FakeNwjsEnvironment();
    _originalMatchMedia = window.matchMedia;
    _originalCreateElement = document.createElement.bind(document);
    _originalRequire = (globalThis as any).require;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T12:00:00.000Z'));
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
    ({ useEnginesStore, useGamesStore, useRecentGameStore, useSavedGamesStore, useSettingsStore, useUiStateStore } = await import('..'));
    ({ SerializationService, EngineRuntimeService, MoveNotationService, GameRuleService, MoveUpdateService, TimeControlService, PositionIdentityService, UserSettingService } = await import('@/domain'));
    ({ createInitialBoardPosition } = await import('@/utility/chess'));
    await seedSettings();
  });
  afterEach(async () => {
    const nwjsUtility = await import('@/utility/nwjs/NwjsUtility');
    nwjsUtility.setNwjsOverride(null);
    document.createElement = _originalCreateElement;
    (globalThis as any).require = _originalRequire;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: _originalMatchMedia });
    vi.useRealTimers();
  });

  it('exposes configured engine inventory and validates selections', () => {
    const store = useEnginesStore();
    const engines = store.listConfiguredEngines();

    expect(engines.map((engine) => engine.id)).toEqual(['engine-a', 'engine-b']);
    expect(store.getEngine('engine-a')?.displayName).toBe('Stockfish');
    expect(() => store.validateAnalysisSelection(['engine-a', 'engine-a'])).toThrow('duplicates');
    expect(() => store.validateAnalysisSelection(['missing'])).toThrow('Configured engine not found');
    expect(() => store.validateAnalysisSelection(['engine-a', 'engine-b'])).not.toThrow();
  });

  it('manages draft settings and reacts to system theme changes', async () => {
    const store = useSettingsStore();
    const accepted = await store.getSettings();

    expect(accepted.analysis.engineInventory).toHaveLength(2);
    expect((await store.getAppearanceProjection()).resolvedThemeMode).toBe('light');
    store.updateSettings({ appearance: { themeMode: ThemeMode.Dark } as ISettingsSnapshot['appearance'] });
    expect(store.hasPendingChanges()).toBe(true);
    store.applySettings();
    expect((await store.getAppearanceProjection()).resolvedThemeMode).toBe('dark');
    environment.mediaQuery.setMatches(true);
    store.updateSettings({ appearance: { themeMode: ThemeMode.System } as ISettingsSnapshot['appearance'] });
    await store.saveSettings();
    expect((await store.getAppearanceProjection()).resolvedThemeMode).toBe('dark');
    await UserSettingService.saveSettings({
      ...await UserSettingService.getSettingsOrDefault(),
      gameSession: {
        ...(await UserSettingService.getSettingsOrDefault()).gameSession,
        restorePreviousSession: true,
        autosaveOnClose: false,
      },
    });
    expect((await UserSettingService.getSettingsOrDefault()).gameSession.autosaveOnClose).toBe(true);
    await store.resetSettings();
    expect((await store.getSettings()).appearance.themeMode).toBe(ThemeMode.System);
  });

  it('persists ui session and layout state with modal support', async () => {
    const store = useUiStateStore();

    expect(await store.getGameSessionOrDefault()).toEqual({
      schemaVersion: 1,
      openGameIds: [],
      activeRoute: '/home',
    });
    store.openTab('game-1');
    store.openTab('game-2');
    store.closeTab('game-1');
    store.setActiveRoute('/settings/appearance');
    await store.saveGameSession();
    expect(await SerializationService.readGameSessionDocument('game-session.json')).toEqual({
      schemaVersion: 1,
      openGameIds: ['game-2'],
      activeGameId: 'game-2',
      activeRoute: '/settings/appearance',
    });

    store.togglePanel('analysis', false);
    store.setSectionCollapsed('history', true);
    store.setAnalysisEngineExpanded(1, false);
    store.showModal({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-2' } });
    expect(store.getModalState()).toEqual({ kind: AppModalKind.DeleteGame, payload: { gameId: 'game-2' } });
    store.hideModal();
    await store.saveLayoutState();
    expect(await SerializationService.readUiLayoutDocument('layout-state.json')).toEqual({
      schemaVersion: 1,
      showHistoryPanel: true,
      showAnalysisPanel: false,
      historyCollapsed: true,
      analysisCollapsed: false,
      analysisEngineExpandedByIndex: [true, false],
    });
  });

  it('lists saved games, resolves paths, and projects recent games', async () => {
    const autosavePath = await createPersistedGameFile('game-a', 'auto', 'Alpha', '2026-04-17T10:00:00.000Z');
    const namedSavePath = await createPersistedGameFile('game-a', 'manual', 'Alpha', '2026-04-17T11:00:00.000Z');
    await createPersistedGameFile('game-b', 'auto', 'Beta', '2026-04-17T09:00:00.000Z');
    const savedGamesStore = useSavedGamesStore();
    const recentGameStore = useRecentGameStore();

    const groups = await savedGamesStore.listSavedGames();
    expect(groups).toHaveLength(2);
    expect(await savedGamesStore.getLoadFilePath('game-a', 'manual')).toBe(namedSavePath);
    expect(await savedGamesStore.getRecentGamePath('game-a')).toBe(namedSavePath);
    environment.queueDialogSelection(path.join(environment.rootPath, 'exports', 'game-a.json'));
    expect(await savedGamesStore.exportGame('game-a')).toContain('game-a.json');
    environment.queueDialogSelection(autosavePath);
    expect(await savedGamesStore.importGame()).toBe(autosavePath);

    const recentGames = await recentGameStore.getRecentGames();
    expect(recentGames).toHaveLength(2);
    expect(recentGames[0]).toMatchObject({
      gameId: 'game-b',
      displayName: 'Beta',
      sourceKind: 'autosave',
      filePath: undefined,
    });
    expect(recentGames[1]).toMatchObject({
      gameId: 'game-a',
      displayName: 'Alpha',
      sourceKind: 'saveFile',
      filePath: namedSavePath,
    });
  });

  it('creates, saves, loads, and mutates games through the games store', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Workspace Game',
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
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 1000 },
    });
    const move = GameRuleService.generateLegalMoves(game.boardRoot).find((candidate) => candidate.from === boardId(4, 1) && candidate.to === boardId(4, 3))!;

    await store.makeMove(game, move);
    expect(game.livePath).toEqual([0]);
    expect(game.highlightPath).toEqual([0]);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);

    await store.pauseGame(game, PauseReason.Manual);
    expect(game.gameState).toBe(GameState.PausedBlackTurn);
    await store.resumeGame(game, PauseReason.Manual);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);

    await store.enterInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.LiveAnalysisFromBlackTurnBlackMove);
    store.exitInGameAnalysis(game);
    expect(game.gameState).toBe(GameState.LiveBlackTurn);

    await store.offerDraw(game);
    expect(game.drawOfferState).toEqual({
      offeringColour: PlayerColour.Black,
      respondingColour: PlayerColour.White,
      direction: DrawOfferDirection.Outgoing,
    });
    await store.withdrawDrawOffer(game);
    expect(game.drawOfferState).toBeUndefined();

    const savedPath = await store.saveGame(game, { targetKind: SaveGameTargetKind.ManagedSave, saveName: 'manual' });
    expect(savedPath).toContain('/manual.json');
    const loaded = await store.loadGame(savedPath);
    expect(loaded.metadata.id).not.toBe(game.metadata.id);
    expect(store.listGames()).toHaveLength(2);

    await store.takeBack(game, 1);
    expect(game.livePath).toEqual([]);
    expect(game.resultState).toBe(ResultState.Ongoing);
  });

  it('supports board editing, analysis engine management, and engine player turns', async () => {
    const store = useGamesStore();
    const analysisEngine = createEngineRecord('engine-c', 'Komodo');
    const game = await store.createGame({
      name: 'Analysis Game',
      whitePlayer: undefined,
      blackPlayer: undefined,
      analysisEngineProfiles: [analysisEngine],
      showLiveAnalysisMoves: true,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });

    await store.refreshAnalysis(game);
    const visibleAnalysis = store.getVisibleAnalysis(game);
    expect(visibleAnalysis?.engineSnapshots).toHaveLength(1);

    await store.addAnalysisEngine(game, createEngineRecord('engine-d', 'Berserk'));
    environment.latestProcess().queueResponse('go infinite', ['bestmove d2d4']);
    await store.retryAnalysis(game, 1);
    expect(game.analysis.snapshots).toHaveLength(2);
    await store.stopAnalysis(game, 1);
    expect(game.analysis.snapshots[1]!.isComplete).toBe(true);
    await store.removeAnalysisEngine(game, 1);
    expect(game.analysis.snapshots).toHaveLength(1);

    store.enterBoardEdit(game);
    expect(game.gameState).toBe(GameState.BoardEdit);
    const sparseBoard = createInitialBoardPosition();
    sparseBoard.board[boardId(4, 1)] = undefined;
    await store.confirmBoardEdit(game, sparseBoard);
    expect(game.gameState).toBe(GameState.AnalysisWhiteMove);

    const enginePlayerGame = await store.createGame({
      name: 'Engine Turn',
      whitePlayer: {
        colour: PlayerColour.White,
        type: PlayerType.Engine,
        displayName: 'Engine White',
        assignedEngine: {
          displayName: 'Stockfish',
          executablePath: 'stockfish.exe',
          clientType: EngineClientType.Uci,
          protocol: EngineProtocol.Uci,
          options: { Threads: 1 },
          $: {
            availability: EngineAvailability.Unavailable,
            analysisLines: new Map(),
          },
        } as IAssignedEngine,
      } as any,
      blackPlayer: {
        colour: PlayerColour.Black,
        type: PlayerType.Local,
        displayName: 'Black',
      },
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    await EngineRuntimeService.ensureReady((enginePlayerGame.whitePlayer as { assignedEngine: IAssignedEngine }).assignedEngine);
    environment.latestProcess().queueResponse('go', ['bestmove e2e4']);
    const requestedMove = await store.requestPlayerMove(enginePlayerGame);

    expect(requestedMove?.from).toBe(boardId(4, 1));
    expect(requestedMove?.to).toBe(boardId(4, 3));
    expect(enginePlayerGame.gameState).toBe(GameState.LiveBlackTurn);
  });

  it('supports resigning, draw acceptance, player reassignment, and autosaved game restore', async () => {
    const store = useGamesStore();
    const game = await store.createGame({
      name: 'Restore Candidate',
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
      analysisEngineProfiles: [],
      showLiveAnalysisMoves: false,
      timeControl: { preset: TimeControlPreset.Untimed, incrementMs: 0 },
    });
    game.metadata.id = 'restore-id';
    await store.saveGame(game, { targetKind: SaveGameTargetKind.Autosave });

    await store.offerDraw(game);
    await store.acceptDrawOffer(game);
    expect(game.resultState).toBe(ResultState.Drawn);
    expect(game.resultReason).toBe(ResultReason.DrawAgreement);

    await store.reassignPlayer(game, PlayerColour.Black, undefined);
    expect(game.gameState).toBe(GameState.AnalysisWhiteMove);

    await store.resignGame(game, PlayerColour.White);
    expect(game.resultState).toBe(ResultState.BlackWon);
    expect(game.resultReason).toBe(ResultReason.Resignation);

    await store.deleteGame(game.metadata.id);
    expect(await store.restoreAutosavedGames([])).toEqual([]);
    const restoredGames = await store.restoreAutosavedGames(['restore-id']);
    expect(restoredGames).toHaveLength(1);
    expect(restoredGames[0]!.metadata.id).toBe('restore-id');
  });
});
