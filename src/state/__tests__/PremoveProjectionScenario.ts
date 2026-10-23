import { PieceKind, PlayerColour, type IMoveRaw } from '@/contracts';
import { blackChain, blockedTail, castlePosition, premove, promotionPosition, whiteChain, type IPositionFixture } from './PremoveFixture';

interface IPremoveProjectionScenario {
  name: string;
  root?: IPositionFixture;
  played?: readonly string[];
  colour?: PlayerColour;
  moves: readonly IMoveRaw[];
  cells?: Record<string, string | undefined>;
  red?: readonly string[];
  invalid?: boolean;
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
  { name: 'PRE-S20 later blocked dependency returns no valid prefix', root: blockedTail, played: ['d8d3'],
    moves: [whiteChain[0]!, premove('f1c4')], invalid: true },
  { name: 'PRE-S20 a king moving away and back cannot restore projected castle rights', root: castlePosition,
    moves: [premove('e1f1'), premove('f1e1'), premove('e1g1')], invalid: true },
  { name: 'PRE-S20 a rook moving away and back cannot restore projected castle rights', root: castlePosition,
    moves: [premove('h1h2'), premove('h2h1'), premove('e1g1')], invalid: true },
  ...([
    ['empty source', premove('g3f5')], ['wrong source geometry', premove('g1g3')],
    ['friendly destination', premove('g1e2')], ['opponent source', premove('g8f6')], ['null move', premove('g1g1')],
    ['out-of-range source', { from: -1, to: 21 }],
    ['out-of-range target', { from: 6, to: 64 }],
    ['non-integer source', { from: 6.5, to: 21 }],
    ['non-integer target', { from: 6, to: 21.5 }],
  ] as const).map(([name, intent]): IPremoveProjectionScenario => ({ name: `PRE-F03 rejects ${name}`, moves: [intent], invalid: true })),
  { name: 'PRE-F03 rejects opposing king capture', root: { pieces: [['a1', white, PieceKind.King], ['e8', black, PieceKind.King], ['e1', white, PieceKind.Rook]] },
    moves: [premove('e1e8')], invalid: true },
  { name: 'PRE-F03 pawn double push respects intermediate blocker', root: { pieces: [...kings, ['d2', white, PieceKind.Pawn], ['d3', black, PieceKind.Knight]] },
    moves: [premove('d2d4')], invalid: true },
  { name: 'PRE-F03 pawn double push requires its starting rank', root: { pieces: [...kings, ['d3', white, PieceKind.Pawn]] },
    moves: [premove('d3d5')], invalid: true },
  { name: 'PRE-F03 pawn cannot move backwards', root: { pieces: [...kings, ['d4', white, PieceKind.Pawn]] },
    moves: [premove('d4d3')], invalid: true },
  { name: 'PRE-F03 unfinished promotion is not a queued move', root: promotionPosition, moves: [premove('a7a8')], invalid: true },
  ...([PieceKind.King, PieceKind.Pawn] as const).map((promotionPiece): IPremoveProjectionScenario => ({
    name: `PRE-F03 rejects ${promotionPiece} promotion`, root: promotionPosition,
    moves: [{ ...premove('a7a8'), promotionPiece }], invalid: true,
  })),
  { name: 'PRE-F03 castle requires a rook', root: { pieces: kings, rights: { whiteKingSide: true } }, moves: [premove('e1g1')], invalid: true },
  { name: 'PRE-F03 castle requires retained rights', root: { ...castlePosition, rights: {} }, moves: [premove('e1g1')], invalid: true },
];
