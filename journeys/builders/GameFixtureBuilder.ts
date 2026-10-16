import { GameState, PlayerColour, PlayerType, ResultState, TimeControlPreset, type IBoardPosition, type IGame, type ITimeControl } from '@/contracts';
import { MoveHistoryService } from '@/domain/MoveHistoryService';
import { TimeControlService } from '@/domain/TimeControlService';
import { createInitialBoardPosition } from '@/utility/chess';
import { RecordTimestamp } from '@/utility/date';
import { fixtureTimestamp } from '../data/FixtureTimestamp';
import { appendMoves, getPosition } from './HistoryFixtureBuilder';

export interface IGameOptions {
  rootPosition?: IBoardPosition;
  state?: GameState;
  freeAnalysis?: boolean;
  timeControl?: ITimeControl;
  allowTakeback?: boolean;
}
export function createGame(id: string, name: string, moves: string[] = [], options: IGameOptions = {}): IGame {
  const rootPosition = options.rootPosition ? structuredClone(options.rootPosition) : createInitialBoardPosition();
  const timeControl = options.timeControl ? { ...options.timeControl } : { preset: TimeControlPreset.Untimed, incrementMs: 0 };
  const clockSnapshot = TimeControlService.initialiseClockSnapshot(timeControl);
  const game: IGame = {
    schemaVersion: 1, metadata: { id, name, createdAt: new RecordTimestamp(fixtureTimestamp), updatedAt: new RecordTimestamp(fixtureTimestamp) },
    gameState: GameState.LiveWhiteTurn, resultState: ResultState.Ongoing,
    whitePlayer: options.freeAnalysis ? undefined : { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
    blackPlayer: options.freeAnalysis ? undefined : { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
    rootPosition, moveTree: MoveHistoryService.createMoveTree(clockSnapshot), livePath: options.freeAnalysis ? undefined : [], renderedPath: [],
    timeControl, clockSnapshot, gameplayOptions: { allowTakeback: options.allowTakeback ?? true, showLiveAnalysisMoves: false }, analysis: { seats: [] },
  };
  appendMoves(game, [], moves, !options.freeAnalysis);
  const side = getPosition(game, game.renderedPath).sideToMove;
  game.gameState = options.state ?? (options.freeAnalysis
    ? side === PlayerColour.White ? GameState.AnalysisWhiteMove : GameState.AnalysisBlackMove
    : side === PlayerColour.White ? GameState.LiveWhiteTurn : GameState.LiveBlackTurn);
  return game;
}
