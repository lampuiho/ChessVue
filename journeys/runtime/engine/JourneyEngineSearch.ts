import { PieceKind, PlayerColour, type IBoardPosition, type IMove } from '@/contracts';
import { applyMove, createSparseBoard, genLegalMoves, toDetailedMove } from '@/utility/chess';
const pieceByFen: Record<string, PieceKind> = { k: PieceKind.King, q: PieceKind.Queen, r: PieceKind.Rook, b: PieceKind.Bishop, n: PieceKind.Knight, p: PieceKind.Pawn };
export function parseFen(tokens: string[]): IBoardPosition {
  const position = createSparseBoard([], tokens[1] === 'w' ? PlayerColour.White : PlayerColour.Black);
  tokens[0]!.split('/').forEach((row, rowIndex) => {
    let file = 0;
    for (const character of row) {
      const kind = pieceByFen[character.toLowerCase()];
      if (kind) position.board[(7 - rowIndex) * 8 + file++] = { kind, colour: character === character.toUpperCase() ? PlayerColour.White : PlayerColour.Black };
      else file += Number(character);
    }
  });
  const castling = tokens[2]!;
  position.castlingAvailability = { whiteKingSide: castling.includes('K'), whiteQueenSide: castling.includes('Q'), blackKingSide: castling.includes('k'), blackQueenSide: castling.includes('q') };
  const enPassant = tokens[3]!;
  if (enPassant !== '-') position.enPassantTarget = (Number(enPassant[1]) - 1) * 8 + enPassant.charCodeAt(0) - 97;
  position.halfMoveClock = Number(tokens[4]);
  position.fullMoveNumber = Number(tokens[5]);
  return position;
}
export function createVariations(position: IBoardPosition, count = 3): IMove[][] {
  return genLegalMoves(position).slice(0, count).map((raw) => {
    const next = structuredClone(position);
    const moves = [toDetailedMove(next, raw)];
    applyMove(next, moves[0]!);
    for (let ply = 1; ply < 4; ply += 1) {
      const reply = genLegalMoves(next)[0];
      if (!reply) break;
      const move = toDetailedMove(next, reply);
      moves.push(move);
      applyMove(next, move);
    }
    return moves;
  });
}
