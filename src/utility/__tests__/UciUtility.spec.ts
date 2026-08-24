import { describe, expect, it } from 'vitest';

import { EngineOptionType, GameState, MoveKind, MoveNodeKind, PieceKind, PlayerColour, ResultState, TimeControlPreset, type IBoardPosition, type IGame, type IMove, type IMoveRaw } from '@/contracts';
import { createInitialBoardPosition } from '@/utility/chess';
import { RecordTimestamp } from '@/utility/date';
import { buildAnalysisCommands, buildDebugCommand, buildFindNextMoveCommands, buildIsReadyCommand, buildPonderMoveCommands, buildPositionCommand, buildQuitCommand, buildRegisterCommand, buildSetOptionCommand, buildStopCommand, buildUciCommand, buildUciMove, buildUciNewGameCommand, parseBestMoveLine, parseOptionLines } from '@/utility/UciUtility';

describe('UciUtility', () => {
  it('builds fixed and parameterised UCI commands', () => {
    expect(buildDebugCommand(true)).toBe('debug on');
    expect(buildDebugCommand(false)).toBe('debug off');
    expect(buildIsReadyCommand()).toBe('isready');
    expect(buildQuitCommand()).toBe('quit');
    expect(buildRegisterCommand()).toBe('register later');
    expect(buildSetOptionCommand('Threads', 4)).toBe('setoption name Threads value 4');
    expect(buildSetOptionCommand('Clear Hash')).toBe('setoption name Clear Hash');
    expect(buildStopCommand()).toBe('stop');
    expect(buildUciCommand()).toBe('uci');
    expect(buildUciNewGameCommand()).toBe('ucinewgame');
  });
  it('returns and populates cached UCI move notation', () => {
    const cachedMove: IMoveRaw = { from: 0, to: 1, $: { uci: 'cached' } };
    const uncachedMove: IMoveRaw = { from: 12, to: 28 };

    expect(buildUciMove(cachedMove)).toBe('cached');
    expect(buildUciMove(uncachedMove)).toBe('e2e4');
    expect(uncachedMove.$?.uci).toBe('e2e4');
  });
  it('builds a position command from the highlighted game path', () => {
    const rootPosition: IBoardPosition = {
      board: new Array<IBoardPosition['board'][number]>(64).fill(undefined),
      sideToMove: PlayerColour.White,
      castlingAvailability: { whiteKingSide: false, whiteQueenSide: false, blackKingSide: false, blackQueenSide: false },
      halfMoveClock: 0,
      fullMoveNumber: 1,
    };
    const move: IMove = { from: 12, to: 28, kind: MoveKind.Normal, movingColour: PlayerColour.White, movingPiece: PieceKind.Pawn };
    const child = { kind: MoveNodeKind.Live, move, plyIndex: 1, children: [] };
    const game: IGame = {
      schemaVersion: 1,
      metadata: { id: 'game-1', name: 'Test Game', createdAt: new RecordTimestamp('2026-01-01T00:00:00.000Z'), updatedAt: new RecordTimestamp('2026-01-01T00:00:00.000Z') },
      gameState: GameState.LiveBlackTurn,
      resultState: ResultState.Ongoing,
      rootPosition,
      moveTree: { root: { kind: MoveNodeKind.Live, plyIndex: 0, children: [child] } },
      renderedPath: [0],
      livePath: [0],
      timeControl: { preset: TimeControlPreset.Blitz, initialMs: 60000, incrementMs: 1000 },
      clockSnapshot: { white: { remainingMs: 60000, isRunning: false }, black: { remainingMs: 45000, isRunning: true }, activeColour: PlayerColour.Black },
      gameplayOptions: {},
      analysis: { snapshots: [] },
    };

    expect(buildPositionCommand(game)).toBe('position fen 8/8/8/8/8/8/8/8 w - - 0 1 moves e2e4');
    expect(buildAnalysisCommands(game)).toEqual(['position fen 8/8/8/8/8/8/8/8 w - - 0 1 moves e2e4', 'go infinite']);
    expect(buildFindNextMoveCommands(game)).toEqual(['position fen 8/8/8/8/8/8/8/8 w - - 0 1 moves e2e4', 'go wtime 60000 btime 45000 winc 1000 binc 1000']);
    expect(buildFindNextMoveCommands(game, { ...move })).toEqual(['ponderhit']);
    expect(buildFindNextMoveCommands(game, { ...move, to: 20 })).toEqual(['stop']);
    expect(buildPonderMoveCommands(game, { from: 52, to: 36, kind: MoveKind.Normal, movingColour: PlayerColour.Black, movingPiece: PieceKind.Pawn })).toEqual([
      'position fen 8/8/8/8/8/8/8/8 w - - 0 1 moves e2e4 e7e5',
      'go ponder wtime 60000 btime 45000 winc 1000 binc 1000',
    ]);
    expect(rootPosition.$?.isStandardInitialPosition).toBe(false);
    game.clockSnapshot.white.remainingMs = undefined;
    expect(() => buildFindNextMoveCommands(game)).toThrow('Timed engine search requires both clocks');
  });
  it('uses startpos and caches verification for a standard initial root', () => {
    const rootPosition = createInitialBoardPosition();
    rootPosition.$ = undefined;
    const game = {
      rootPosition,
      moveTree: { root: { kind: MoveNodeKind.Live, plyIndex: 0, children: [] } },
      renderedPath: [],
    } as unknown as IGame;

    expect(buildPositionCommand(game)).toBe('position startpos');
    expect((rootPosition as IBoardPosition).$?.isStandardInitialPosition).toBe(true);
  });
  it('parses the optional ponder move from a bestmove line', () => {
    const parsed = parseBestMoveLine('bestmove e2e4 ponder e7e5');

    expect(parsed?.move.$?.uci).toBe('e2e4');
    expect(parsed?.ponderMove?.$?.uci).toBe('e7e5');
  });
  it('parses UCI option lines into protocol-neutral option metadata', () => {
    expect(parseOptionLines([
      'id name Example Engine',
      'option name Clear Hash type button',
      'option name Ponder type check default false',
      'option name Style type combo default Normal Play var Normal Play var Risky',
      'option name Threads type spin default 1 min 1 max 1024',
      'option name Evaluation File type string default example network.nnue',
      'uciok',
    ])).toEqual([
      { name: 'Clear Hash', type: EngineOptionType.Action },
      { name: 'Ponder', type: EngineOptionType.Boolean, defaultValue: false },
      { name: 'Style', type: EngineOptionType.Choice, defaultValue: 'Normal Play', choices: ['Normal Play', 'Risky'] },
      { name: 'Threads', type: EngineOptionType.Integer, defaultValue: 1, minimum: 1, maximum: 1024 },
      { name: 'Evaluation File', type: EngineOptionType.Text, defaultValue: 'example network.nnue' },
    ]);
  });
  it('rejects malformed UCI option metadata', () => {
    expect(() => parseOptionLines(['option name Threads type spin default one min 1 max 8'])).toThrow('Invalid UCI integer option default');
    expect(() => parseOptionLines(['option name Ponder type unknown'])).toThrow('Unsupported UCI option type');
  });
});
