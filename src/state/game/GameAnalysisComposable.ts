import { EngineAnalysisSearchMode, GameState, type IAnalysisSeat, type IAssignedEngine, type IEngineRecord, type IGame, type IVisibleAnalysis } from '@/contracts';
import Aborted from '@/contracts/errors/Aborted';
import { EngineRuntimeService } from '@/domain';
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
  function createAnalysisSeat(engineProfile: IEngineRecord, updatedAt: Date): IAnalysisSeat {
    return { assignedEngine: createAssignedEngine(engineProfile), updatedAt: new AnalysisTimestamp(updatedAt), lines: [], isComplete: false };
  }
  async function stopAssignedEngine(engine: IAssignedEngine): Promise<void> {
    try {
      await EngineRuntimeService.stopEngine(engine);
    } catch (error) {
      if (!(error instanceof Aborted)) logHandledError('GamesStore', 'stopEngine', error);
    }
  }
  function disposeAnalysisSubscription(engine: IAssignedEngine): void {
    analysisDisposers.get(engine)?.();
    analysisDisposers.delete(engine);
  }
  function resolveAnalysisSeat(game: IGame, engine: IAssignedEngine): IAnalysisSeat | undefined {
    return game.analysis.seats.find((seat) => seat.assignedEngine === engine);
  }
  function subscribeToAnalysis(game: IGame, seat: IAnalysisSeat): () => boolean {
    const engine = seat.assignedEngine;
    disposeAnalysisSubscription(engine);
    let active = true;
    const isCurrent = () => active && resolveAnalysisSeat(game, engine) === seat;
    const unsubscribe = EngineRuntimeService.subscribeToAnalysis(engine, (update) => {
      if (!isCurrent() || game.gameState === GameState.BoardEdit) return;
      seat.updatedAt = new AnalysisTimestamp();
      seat.bestMove = update.bestMove;
      seat.lines = update.lines.slice(0, 3);
      seat.isComplete = update.isFinal;
      touchGame(game);
    });
    analysisDisposers.set(engine, () => { active = false; unsubscribe(); });
    return isCurrent;
  }
  function clearAnalysisSeatLines(seat: IAnalysisSeat): void {
    seat.bestMove = undefined;
    seat.lines = [];
    seat.isComplete = false;
  }
  async function startAnalysisSeat(game: IGame, seat: IAnalysisSeat): Promise<void> {
    const isCurrent = subscribeToAnalysis(game, seat);
    seat.updatedAt = new AnalysisTimestamp();
    try {
      await EngineRuntimeService.startAnalysis(seat.assignedEngine, game, { multiPv: 3, searchMode: EngineAnalysisSearchMode.Infinite });
    } catch (error) {
      if (isCurrent() && !(error instanceof Aborted)) logHandledError('GamesStore', 'startAnalysis', error);
    } finally {
      if (isCurrent()) touchGame(game);
    }
  }
  function getTargetSeats(game: IGame, engineIndex?: number): IAnalysisSeat[] {
    if (engineIndex === undefined) return [...game.analysis.seats];
    const seat = game.analysis.seats[engineIndex];
    return seat ? [seat] : [];
  }
  function refreshAnalysisForGame(game: IGame, engineIndex?: number): Promise<void> {
    const seats = getTargetSeats(game, engineIndex);
    for (const seat of seats) {
      disposeAnalysisSubscription(seat.assignedEngine);
      clearAnalysisSeatLines(seat);
    }
    position.getRenderedPosition(game);
    const work = game.gameState === GameState.BoardEdit ? stopAnalysis(game, engineIndex) : Promise.all(seats.map((seat) => startAnalysisSeat(game, seat)));
    touchGame(game);
    return work.then(() => undefined);
  }
  function getVisibleAnalysis(game: IGame): IVisibleAnalysis | undefined {
    if (game.analysis.seats.length === 0) return;
    return { engineSeats: [...game.analysis.seats] };
  }
  async function addAnalysisEngine(game: IGame, engineProfile: IEngineRecord): Promise<void> {
    if (game.analysis.seats.some((seat) => seat.assignedEngine.displayName === engineProfile.displayName)) throw new Error(`Analysis engine already assigned: ${engineProfile.displayName}.`);
    if (game.analysis.seats.length >= 4) throw new Error('A game cannot have more than four analysis engines.');
    game.analysis.seats.push(createAnalysisSeat(engineProfile, new Date()));
    touchGame(game);
  }
  async function removeAnalysisEngine(game: IGame, engineIndex: number): Promise<void> {
    const seat = game.analysis.seats[engineIndex];
    if (!seat) return;
    disposeAnalysisSubscription(seat.assignedEngine);
    const cleanup = stopAssignedEngine(seat.assignedEngine);
    game.analysis.seats.splice(game.analysis.seats.indexOf(seat), 1);
    touchGame(game);
    await cleanup;
  }
  async function disposeAnalysisForGame(game: IGame): Promise<void> {
    await Promise.all(game.analysis.seats.map((seat) => {
      disposeAnalysisSubscription(seat.assignedEngine);
      return stopAssignedEngine(seat.assignedEngine);
    }));
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
    await Promise.all(getTargetSeats(game, engineIndex).map(async (seat) => {
      disposeAnalysisSubscription(seat.assignedEngine);
      try {
        await EngineRuntimeService.stopAnalysis(seat.assignedEngine);
      } catch (error) {
        if (!(error instanceof Aborted)) logHandledError('GamesStore', 'stopAnalysis', error);
      } finally {
        if (game.analysis.seats.includes(seat) && !analysisDisposers.has(seat.assignedEngine)) touchGame(game);
      }
    }));
  }
  return { createAnalysisSeat, refreshAnalysisForGame, getVisibleAnalysis, addAnalysisEngine, removeAnalysisEngine, disposeAnalysisForGame, refreshAnalysis, retryAnalysis, stopAnalysis };
}
export type GameAnalysisComposable = ReturnType<typeof useGameAnalysis>;
