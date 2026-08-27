import type { IAssignedEngine, IEngineAnalysisRequest, IEngineAnalysisUpdate, IEngineOptionMeta } from '../Engine';
import type { IGame } from '../Game';
import type { IMove } from '../Move';

export interface IEngineClient {
  /** Returns option metadata discovered during the explicit engine initialisation handshake. */
  getOptions(engine: IAssignedEngine): readonly IEngineOptionMeta[];
  /** Mutates engine.$ by attaching or updating the platform runtime session and marking it initialised. */
  initialiseEngine(engine: IAssignedEngine): Promise<void>;
  /** Requires engine.$ to already hold an initialised session, then replaces the active analysis callback and clears cached analysis lines. */
  startAnalysis(engine: IAssignedEngine, game: IGame, request: IEngineAnalysisRequest, onUpdate: (update: IEngineAnalysisUpdate) => void): Promise<void>;
  stopAnalysis(engine: IAssignedEngine): Promise<void>;
  /** Requires engine.$ to already hold an initialised session, then creates a new pending player-move state. */
  startPlayerTurn(engine: IAssignedEngine, game: IGame): Promise<void>;
  /** Requires engine.$ to already hold an initialised idle session, then starts pondering the supplied expected reply. */
  startPondering(engine: IAssignedEngine, game: IGame, engineMove: IMove, ponderMove: IMove): Promise<void>;
  /** Awaits the player-move state owned and completed by the concrete client session. */
  awaitPlayerTurnMove(engine: IAssignedEngine): Promise<IMove>;
  /** Mutates engine.$ by stopping the session and rejecting pending state-transition or player-move work. */
  stopEngine(engine: IAssignedEngine): Promise<void>;
  /** Mutates engine.$ by clearing prior session state and then reinitialising it. */
  restartEngine(engine: IAssignedEngine): Promise<void>;
}
