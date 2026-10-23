import { shallowReactive, toRaw } from 'vue';
import { EngineAnalysisSearchMode, GameState, analysisSeatSchema, type IAnalysisSeat, type IAssignedEngine, type IEngineRecord, type IGame, type IRecordedAnalysis, type IVisibleAnalysis } from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { EngineRuntimeService } from '@/domain';
import { logHandledError } from '@/utility/errors';
import { AnalysisTimestamp } from '@/utility/date';
import type { GamePositionComposable } from './GamePositionComposable';

interface IGameAnalysisDependency {
  position: GamePositionComposable;
  timestampGame: (game: IGame) => void;
}
export function useGameAnalysis(dependency: IGameAnalysisDependency) {
  const { position, timestampGame } = dependency;
  const analysisDisposers = new WeakMap<IAssignedEngine, () => void>();
  function _createAssignedEngine(engineProfile: IEngineRecord): IAssignedEngine {
    return {
      displayName: engineProfile.displayName,
      executablePath: engineProfile.executablePath,
      clientType: engineProfile.clientType,
      protocol: engineProfile.protocol,
      options: { ...engineProfile.options },
    };
  }
  function createAnalysisSeat(engineProfile: IEngineRecord, updatedAt: Date): IAnalysisSeat {
    return { assignedEngine: _createAssignedEngine(engineProfile), updatedAt: new AnalysisTimestamp(updatedAt), lines: [], isComplete: false };
  }
  async function _stopAssignedEngine(engine: IAssignedEngine) {
    try {
      await EngineRuntimeService.stopEngine(engine);
    } catch (error) {
      if (!(error instanceof Aborted)) logHandledError('GamesStore', 'stopEngine', error);
    }
  }
  function _disposeAnalysisSubscription(engine: IAssignedEngine) {
    analysisDisposers.get(engine)?.();
    analysisDisposers.delete(engine);
  }
  function _resolveAnalysisSeat(game: IGame, engine: IAssignedEngine): IAnalysisSeat | undefined {
    return game.analysis.seats.find((seat) => seat.assignedEngine === engine);
  }
  function _subscribeToAnalysis(game: IGame, seat: IAnalysisSeat): () => boolean {
    const engine = seat.assignedEngine;
    _disposeAnalysisSubscription(engine);
    let active = true;
    const _isCurrent = () => active && _resolveAnalysisSeat(game, engine) === seat;
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, (update) => {
      if (!_isCurrent() || game.gameState === GameState.BoardEdit) return;
      seat.updatedAt = new AnalysisTimestamp();
      seat.bestMove = update.bestMove;
      seat.lines = update.lines.slice(0, 3);
      seat.isComplete = update.isFinal;
      timestampGame(game);
    });
    analysisDisposers.set(engine, () => { active = false; unsubscribe(); });
    return _isCurrent;
  }
  function _clearAnalysisSeatLines(seat: IAnalysisSeat) {
    seat.bestMove = undefined;
    seat.lines = [];
    seat.isComplete = false;
  }
  async function _startAnalysisSeat(game: IGame, seat: IAnalysisSeat) {
    seat.assignedEngine.$ = shallowReactive(toRaw(EngineRuntimeService.ensureRuntime(seat.assignedEngine)));
    const isCurrent = _subscribeToAnalysis(game, seat);
    seat.updatedAt = new AnalysisTimestamp();
    try {
      await EngineRuntimeService.startAnalysis(seat.assignedEngine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
    } catch (error) {
      if (isCurrent() && !(error instanceof Aborted)) logHandledError('GamesStore', 'startAnalysis', error);
    } finally {
      if (isCurrent()) timestampGame(game);
    }
  }
  function _getTargetSeats(game: IGame, engineIndex?: number): IAnalysisSeat[] {
    if (engineIndex === undefined) return [...game.analysis.seats];
    const seat = game.analysis.seats[engineIndex];
    return seat ? [seat] : [];
  }
  function refreshAnalysisForGame(game: IGame, engineIndex?: number) {
    const seats = _getTargetSeats(game, engineIndex);
    for (const seat of seats) {
      _disposeAnalysisSubscription(seat.assignedEngine);
      _clearAnalysisSeatLines(seat);
    }
    position.getRenderedPosition(game);
    const work = game.gameState === GameState.BoardEdit ? stopAnalysis(game, engineIndex) : Promise.all(seats.map((seat) => _startAnalysisSeat(game, seat)));
    timestampGame(game);
    return work.then(() => undefined);
  }
  function getVisibleAnalysis(game: IGame): IVisibleAnalysis | undefined {
    if (game.analysis.seats.length === 0) return;
    return { engineSeats: [...game.analysis.seats] };
  }
  function captureMoveAnalysis(game: IGame): IRecordedAnalysis | undefined {
    if (!position.pathsEqual(game.renderedPath, game.livePath)) return;
    const seats = game.analysis.seats.filter((seat) => seat.lines.length > 0).map((seat) => analysisSeatSchema.parse(seat));
    return seats.length ? { recordedAt: new AnalysisTimestamp(), seats } : undefined;
  }
  async function addAnalysisEngine(game: IGame, engineProfile: IEngineRecord) {
    if (game.analysis.seats.some((seat) => seat.assignedEngine.displayName === engineProfile.displayName)) throw new Error(`Analysis engine already assigned: ${engineProfile.displayName}.`);
    if (game.analysis.seats.length >= 4) throw new Error('A game cannot have more than four analysis engines.');
    game.analysis.seats.push(createAnalysisSeat(engineProfile, new Date()));
    timestampGame(game);
  }
  async function removeAnalysisEngine(game: IGame, engineIndex: number) {
    const seat = game.analysis.seats[engineIndex];
    if (!seat) return;
    _disposeAnalysisSubscription(seat.assignedEngine);
    const cleanup = _stopAssignedEngine(seat.assignedEngine);
    game.analysis.seats.splice(game.analysis.seats.indexOf(seat), 1);
    timestampGame(game);
    await cleanup;
  }
  async function disposeAnalysisForGame(game: IGame) {
    await Promise.all(game.analysis.seats.map((seat) => {
      _disposeAnalysisSubscription(seat.assignedEngine);
      return _stopAssignedEngine(seat.assignedEngine);
    }));
  }
  async function refreshAnalysis(game: IGame) {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis refresh is not allowed during board edit.');
    await refreshAnalysisForGame(game);
  }
  async function retryAnalysis(game: IGame, engineIndex: number) {
    if (game.gameState === GameState.BoardEdit) throw new Error('Analysis retry is not allowed during board edit.');
    await refreshAnalysisForGame(game, engineIndex);
  }
  async function stopAnalysis(game: IGame, engineIndex?: number) {
    await Promise.all(_getTargetSeats(game, engineIndex).map(async (seat) => {
      _disposeAnalysisSubscription(seat.assignedEngine);
      try {
        await EngineRuntimeService.stopAnalysis(seat.assignedEngine);
      } catch (error) {
        if (!(error instanceof Aborted)) logHandledError('GamesStore', 'stopAnalysis', error);
      } finally {
        if (game.analysis.seats.includes(seat) && !analysisDisposers.has(seat.assignedEngine)) timestampGame(game);
      }
    }));
  }
  return { createAnalysisSeat, refreshAnalysisForGame, getVisibleAnalysis, captureMoveAnalysis, addAnalysisEngine, removeAnalysisEngine, disposeAnalysisForGame, refreshAnalysis, retryAnalysis, stopAnalysis };
}
export type GameAnalysisComposable = ReturnType<typeof useGameAnalysis>;
