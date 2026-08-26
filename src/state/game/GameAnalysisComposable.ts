import {
  EngineAnalysisSearchMode,
  GameState,
  type IAnalysisSnapshot,
  type IAssignedEngine,
  type IEngineRecord,
  type IGame,
  type IVisibleAnalysisSnapshot,
} from '@/contracts';
import { EngineRuntimeService, PositionIdentityService } from '@/domain';
import { logHandledError } from '@/utility/errors';
import { AnalysisTimestamp } from '@/utility/date';
import type { GamePositionComposable } from './GamePositionComposable';

interface IGameAnalysisDependency {
  position: GamePositionComposable;
  touchGame: (game: IGame) => void;
}

export function useGameAnalysis(dependency: IGameAnalysisDependency) {
  const { position, touchGame } = dependency;
  const analysisDisposers = new WeakMap<IAssignedEngine, () => void>();
  function createAssignedEngine(engineProfile: IEngineRecord): IAssignedEngine {
    return {
      displayName: engineProfile.displayName,
      executablePath: engineProfile.executablePath,
      clientType: engineProfile.clientType,
      protocol: engineProfile.protocol,
      options: { ...engineProfile.options },
    };
  }
  function createAnalysisSnapshot(engineProfile: IEngineRecord, positionKey: string, updatedAt: Date): IAnalysisSnapshot {
    return {
      assignedEngine: createAssignedEngine(engineProfile),
      positionKey,
      updatedAt: new AnalysisTimestamp(updatedAt),
      lines: [],
      isComplete: false,
    };
  }
  async function stopAssignedEngine(engine?: IAssignedEngine): Promise<void> {
    if (!engine) return;
    try {
      await EngineRuntimeService.stopEngine(engine);
    } catch (error) {
      logHandledError('GamesStore', 'stopEngine', error);
    }
  }
  function disposeAnalysisSubscription(engine: IAssignedEngine): void {
    const dispose = analysisDisposers.get(engine);
    if (dispose) dispose();
    analysisDisposers.delete(engine);
  }
  function resolveAnalysisSnapshot(game: IGame, engine: IAssignedEngine): IAnalysisSnapshot | undefined {
    return game.analysis.snapshots.find((snapshot) => snapshot.assignedEngine === engine);
  }
  function subscribeToAnalysis(game: IGame, engine: IAssignedEngine): void {
    disposeAnalysisSubscription(engine);
    const dispose = EngineRuntimeService.subscribeToAnalysis(engine, (update) => {
      const snapshot = resolveAnalysisSnapshot(game, engine);
      if (!snapshot) return;
      snapshot.positionKey = update.positionKey;
      snapshot.updatedAt = new AnalysisTimestamp();
      snapshot.bestMove = update.bestMove;
      snapshot.lines = update.lines;
      snapshot.isComplete = update.isFinal;
      touchGame(game);
    });
    analysisDisposers.set(engine, dispose);
  }
  function resetAnalysisSnapshot(snapshot: IAnalysisSnapshot, isComplete: boolean = false): void {
    snapshot.bestMove = undefined;
    snapshot.lines = [];
    snapshot.isComplete = isComplete;
  }
  async function startAnalysisSnapshot(game: IGame, snapshot: IAnalysisSnapshot): Promise<void> {
    const renderedPosition = position.getRenderedPosition(game);
    subscribeToAnalysis(game, snapshot.assignedEngine);
    snapshot.positionKey = PositionIdentityService.buildPositionKey(renderedPosition);
    snapshot.updatedAt = new AnalysisTimestamp();
    resetAnalysisSnapshot(snapshot);
    if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = undefined;
    await EngineRuntimeService.ensureReady(snapshot.assignedEngine);
    await EngineRuntimeService.startAnalysis(snapshot.assignedEngine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
  }
  async function refreshAnalysisForGame(game: IGame, engineIndex?: number): Promise<void> {
    const targetSnapshots = engineIndex === undefined ? game.analysis.snapshots : [game.analysis.snapshots[engineIndex]!].filter((snapshot) => !!snapshot);
    for (const snapshot of targetSnapshots) {
      try {
        await startAnalysisSnapshot(game, snapshot);
      } catch (error) {
        resetAnalysisSnapshot(snapshot, true);
        if (snapshot.assignedEngine.$) snapshot.assignedEngine.$.lastError = error instanceof Error ? error.message : 'Analysis failed.';
        logHandledError('GamesStore', 'startAnalysis', error);
      }
    }
  }
  function getVisibleAnalysis(game: IGame): IVisibleAnalysisSnapshot | undefined {
    const positionKey = PositionIdentityService.buildPositionKey(position.getRenderedPosition(game));
    const engineSnapshots = game.analysis.snapshots.filter((snapshot) => snapshot.positionKey === positionKey);
    if (engineSnapshots.length === 0) return;
    return { engineSnapshots };
  }
  async function addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void> {
    if (game.analysis.snapshots.some((snapshot) => snapshot.assignedEngine.displayName === engineProfile.displayName)) throw new Error(`Analysis engine already assigned: ${engineProfile.displayName}.`);
    if (game.analysis.snapshots.length >= 4) throw new Error('A game cannot have more than four analysis engines.');
    const snapshot = createAnalysisSnapshot(engineProfile, PositionIdentityService.buildPositionKey(position.getRenderedPosition(game)), new Date());
    game.analysis.snapshots.push(snapshot);
    touchGame(game);
    await refreshAnalysisForGame(game, game.analysis.snapshots.length - 1);
  }
  async function removeAnalysisEngine(game: IGame, engineIndex: number): Promise<void> {
    const snapshot = game.analysis.snapshots[engineIndex];
    if (!snapshot) return;
    disposeAnalysisSubscription(snapshot.assignedEngine);
    await stopAssignedEngine(snapshot.assignedEngine);
    game.analysis.snapshots.splice(engineIndex, 1);
    touchGame(game);
  }
  async function refreshAnalysis(game: IGame): Promise<void> {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis refresh is not allowed during board edit.');
    await refreshAnalysisForGame(game);
  }
  async function retryAnalysis(game: IGame, engineIndex: number): Promise<void> {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis retry is not allowed during board edit.');
    await refreshAnalysisForGame(game, engineIndex);
  }
  async function stopAnalysis(game: IGame, engineIndex?: number): Promise<void> {
    const targetSnapshots = engineIndex === undefined ? game.analysis.snapshots : [game.analysis.snapshots[engineIndex]!].filter((snapshot) => !!snapshot);
    for (const snapshot of targetSnapshots) {
      disposeAnalysisSubscription(snapshot.assignedEngine);
      try {
        await EngineRuntimeService.stopAnalysis(snapshot.assignedEngine);
      } catch (error) {
        logHandledError('GamesStore', 'stopAnalysis', error);
      }
      resetAnalysisSnapshot(snapshot, true);
    }
  }
  return {
    createAnalysisSnapshot,
    refreshAnalysisForGame,
    getVisibleAnalysis,
    addAnalysisEngine,
    removeAnalysisEngine,
    refreshAnalysis,
    retryAnalysis,
    stopAnalysis,
  };
}
export type GameAnalysisComposable = ReturnType<typeof useGameAnalysis>;
