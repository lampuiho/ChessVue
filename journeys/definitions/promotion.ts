import { PieceKind, PlayerColour } from '@/contracts';
import { createSparseBoard } from '@/utility/chess';
import { createGame, createWorkspace } from '../FixtureFactory';
export function create() {
  const games = [PlayerColour.White, PlayerColour.Black].map((colour) => createGame(`promotion-${colour}`, `${colour} to promote`, [], {
    rootPosition: createSparseBoard([
      { boardId: 4, piece: { kind: PieceKind.King, colour: PlayerColour.White } },
      { boardId: 60, piece: { kind: PieceKind.King, colour: PlayerColour.Black } },
      { boardId: colour === PlayerColour.White ? 48 : 15, piece: { kind: PieceKind.Pawn, colour } },
      { boardId: colour === PlayerColour.White ? 57 : 6, piece: { kind: PieceKind.Rook, colour: colour === PlayerColour.White ? PlayerColour.Black : PlayerColour.White } },
    ], colour),
  }));
  return createWorkspace(games);
}
