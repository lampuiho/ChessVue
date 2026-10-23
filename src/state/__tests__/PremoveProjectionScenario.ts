import { PieceKind, PlayerColour, type IMoveRaw } from '@/contracts';
import { blackChain, castlePosition, premove, promotionPosition, whiteChain, type IPositionFixture } from './PremoveFixture';

interface IPremoveProjectionScenario {
  name: string;
  root?: IPositionFixture;
  played?: readonly string[];
  colour?: PlayerColour;
  moves: readonly IMoveRaw[];
  cells: Record<string, string | undefined>;
  red: readonly string[];
}
const white = PlayerColour.White;
const black = PlayerColour.Black;
const kings = [['e1', white, PieceKind.King], ['e8', black, PieceKind.King]] as const;
export const attackedCastle: IPositionFixture = { side: white, rights: { whiteKingSide: true }, pieces: [
  ['e1', white, PieceKind.King], ['h1', white, PieceKind.Rook], ['a8', black, PieceKind.King], ['f8', black, PieceKind.Rook],
] };
export const pinned: IPositionFixture = { side: white, pieces: [
  ['e1', white, PieceKind.King], ['e2', white, PieceKind.Knight], ['a8', black, PieceKind.King], ['e8', black, PieceKind.Rook],
] };
export const premoveProjectionScenarios: IPremoveProjectionScenario[] = [
  { name: 'PRE-S01 displaces chained White pieces and includes the vacated intermediate square', played: ['e2e4'], moves: whiteChain,
    cells: { g1: undefined, f3: undefined, g5: 'white knight' }, red: ['g1', 'f3', 'g5'] },
  { name: 'PRE-S01 projects Black before its first move without changing the actual White turn', colour: black, moves: blackChain,
    cells: { g8: undefined, f6: undefined, g4: 'black knight' }, red: ['g8', 'f6', 'g4'] },
  { name: 'PRE-S02 projects only the remainder after actual Nf3 has been consumed', played: ['e2e4', 'e7e5', 'g1f3'], moves: [whiteChain[1]!],
    cells: { f3: undefined, g5: 'white knight' }, red: ['f3', 'g5'] },
  { name: 'PRE-S03 empty FIFO restores every canonical piece with no shade', played: ['e2e4'], moves: [], cells: {}, red: [] },
  { name: 'PRE-S03 repeated endpoints are a unique red union', played: ['e2e4'], moves: [...whiteChain, premove('g5f3')],
    cells: { g1: undefined, f3: 'white knight', g5: undefined }, red: ['g1', 'f3', 'g5'] },
  { name: 'PRE-S04 speculative capture hides a target only in the copy', root: { pieces: [...kings, ['a1', white, PieceKind.Rook], ['a5', black, PieceKind.Bishop]] },
    moves: [premove('a1a5')], cells: { a1: undefined, a5: 'white rook' }, red: ['a1', 'a5'] },
  { name: 'PRE-S04 king-side castling moves both pieces and shades four endpoints', root: castlePosition, moves: [premove('e1g1')],
    cells: { e1: undefined, h1: undefined, f1: 'white rook', g1: 'white king' }, red: ['e1', 'g1', 'h1', 'f1'] },
  { name: 'PRE-S04 queen-side castling moves both pieces', root: { pieces: [...kings, ['a1', white, PieceKind.Rook]], rights: { whiteQueenSide: true } },
    moves: [premove('e1c1')], cells: { e1: undefined, a1: undefined, c1: 'white king', d1: 'white rook' }, red: ['e1', 'c1', 'a1', 'd1'] },
  ...(['q', 'r', 'b', 'n'] as const).map((letter): IPremoveProjectionScenario => {
    const kind = premove(`a7a8${letter}`).promotionPiece!;
    const destination = letter === 'n' ? 'b6' : letter === 'b' ? 'c6' : 'a6';
    return { name: `PRE-S04 projects chosen ${kind} and its dependent move`, root: promotionPosition,
      moves: [premove(`a7a8${letter}`), premove(`a8${destination}`)],
      cells: { a7: undefined, a8: undefined, [destination]: `white ${kind}` }, red: ['a7', 'a8', destination] };
  }),
  { name: 'PRE-S04 empty pawn diagonal does not invent an en-passant victim', root: { pieces: [...kings, ['e5', white, PieceKind.Pawn], ['d5', black, PieceKind.Pawn]] },
    moves: [premove('e5d6')], cells: { e5: undefined, d6: 'white pawn', d5: 'black pawn' }, red: ['e5', 'd6'] },
  { name: 'PRE-S04 a current en-passant opportunity displaces its actual victim', played: ['e2e4', 'a7a6', 'e4e5', 'd7d5'],
    moves: [premove('e5d6')], cells: { e5: undefined, d5: undefined, d6: 'white pawn' }, red: ['e5', 'd6'] },
  { name: 'PRE-S09 speculative king movement ignores an attack resolved only when due', root: attackedCastle, moves: [premove('e1f1')],
    cells: { e1: undefined, f1: 'white king' }, red: ['e1', 'f1'] },
  { name: 'PRE-S09 pinned knight movement may be an intention before the reply', root: pinned, moves: [premove('e2f4')],
    cells: { e2: undefined, f4: 'white knight' }, red: ['e2', 'f4'] },
];
