import { PieceKind, type PlayerColour } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { rulePosition, ruleUci, type CastleObstacle, type CastleSide } from './RuleScenario';
export function createCastlingGame(colour: PlayerColour, side: CastleSide = 'king', obstacle?: CastleObstacle) {
  const own: Array<[string, PieceKind]> = [['e1', PieceKind.King], ['a1', PieceKind.Rook], ['h1', PieceKind.Rook]];
  const opponent: Array<[string, PieceKind]> = [['e8', PieceKind.King], ['a8', PieceKind.Rook], ['h8', PieceKind.Rook]];
  if (obstacle === 'in-check') opponent.push(['e4', PieceKind.Rook]);
  if (obstacle === 'through-attack') opponent.push([side === 'king' ? 'c4' : 'f4', PieceKind.Bishop]);
  if (obstacle === 'occupied-path') own.push([side === 'king' ? 'f1' : 'b1', PieceKind.Knight]);
  const position = rulePosition(own, opponent, colour);
  position.castlingAvailability = { whiteKingSide: true, whiteQueenSide: true, blackKingSide: true, blackQueenSide: true };
  const rookFile = side === 'king' ? 'h' : 'a';
  const moves = obstacle === 'king-moved' ? ['e1e2', 'e8e7', 'e2e1', 'e7e8']
    : obstacle === 'rook-moved' ? [`${rookFile}1${rookFile}2`, 'e8e7', `${rookFile}2${rookFile}1`, 'e7e8'] : [];
  const suffix = obstacle ? `-${side}-${obstacle}` : '';
  return createGame(`rules-castle-${colour}${suffix}`, `${colour} castling${suffix}`, moves.map((move) => ruleUci(move, colour)), { rootPosition: position });
}
