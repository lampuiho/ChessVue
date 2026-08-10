import type { IAssignedEngine, IEngineAnalysisRequest, IEngineAnalysisUpdate, IEnginePositionState } from '../Engine';
import type { IMove } from '../Move';

export interface IEngineClient {
  /** Mutates engine.$ by attaching or updating the platform runtime session and marking it initialised. */
  initialiseEngine(engine: IAssignedEngine): Promise<void>;
  /** Requires engine.$ to already hold an initialised session, then mutates the cached session position state. */
  syncPosition(engine: IAssignedEngine, positionState: IEnginePositionState): Promise<void>;
  /** Requires engine.$ to already hold an initialised session, then replaces the active analysis callback and clears cached analysis lines. */
  startAnalysis(engine: IAssignedEngine, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>;
  stopAnalysis(engine: IAssignedEngine): Promise<void>;
  /** Requires engine.$ to already hold an initialised session, then creates a new pending player-move state. */
  startPlayerTurn(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by consuming and clearing the pending player-move state. */
  awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
  /** Mutates engine.$ by clearing session initialisation, position, analysis, waiter, and player-move state. */
  stopEngine(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by clearing prior session state and then reinitialising it. */
  restartEngine(engine: IAssignedEngine): Promise<void>;
  requiresNewGameBoundary(positionState: IEnginePositionState): boolean;
}
