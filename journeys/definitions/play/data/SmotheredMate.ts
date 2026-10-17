import { PieceKind, PlayerColour, type IBoardPosition } from '@/contracts';
import { applyMove, createSparseBoard, genLegalMoves, getUci, toDetailedMove } from '@/utility/chess';
import { createGame } from '../../../builders/GameFixtureBuilder';

export const smotheredMateLine = ['f7h6', 'g8h8', 'e6g8', 'f8g8', 'h6f7'];
export function createSmotheredMate() {
  return createGame('play-smothered-mate', 'Smothered mate in three', [], {
    timeControl: { initialMs: 300000, incrementMs: 2000 },
    rootPosition: createSparseBoard([
      { boardId: 0, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: 44, piece: { kind: PieceKind.Queen, colour: PlayerColour.White } },
      { boardId: 53, piece: { kind: PieceKind.Knight, colour: PlayerColour.White } },
      { boardId: 62, piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: 61, piece: { kind: PieceKind.Rook, colour: PlayerColour.Black } },
      { boardId: 54, piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
      { boardId: 55, piece: { kind: PieceKind.Pawn, colour: PlayerColour.Black } },
    ]),
  });
}
export function smotheredMateReply(position: IBoardPosition): string | undefined {
  const expected = createSmotheredMate().rootPosition;
  for (const uci of smotheredMateLine) {
    if (position.sideToMove === expected.sideToMove && JSON.stringify(position.board) === JSON.stringify(expected.board)) return uci;
    const move = genLegalMoves(expected).find((candidate) => getUci(candidate) === uci);
    if (!move) throw new Error(`Illegal smothered mate fixture move: ${uci}.`);
    applyMove(expected, toDetailedMove(expected, move));
  }
}
