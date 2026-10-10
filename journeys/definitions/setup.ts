import { GameState, PieceKind, PlayerColour } from '@/contracts';
import { createSparseBoard } from '@/utility/chess';
import { createGame, createWorkspace } from '../FixtureFactory';
export function create() {
  const analysis = createGame('setup-analysis', 'Free opening analysis', ['d2d4', 'd7d5', 'c2c4'], { freeAnalysis: true });
  const board = createGame('setup-board', 'Editable endgame setup', [], {
    freeAnalysis: true, state: GameState.BoardEdit,
    rootPosition: createSparseBoard([
      { boardId: 4, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: 60, piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: 35, piece: { kind: PieceKind.Pawn, colour: PlayerColour.White } },
    ]),
  });
  return createWorkspace([analysis, board]);
}
