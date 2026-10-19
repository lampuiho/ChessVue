import { PieceKind, type PlayerColour } from '@/contracts';
import { getOpponentColour } from '@/utility/chess';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { rulePosition, ruleUci } from './RuleScenario';
export function createEnPassantGame(colour: PlayerColour, pinned = false) {
  const position = rulePosition([[pinned ? 'e1' : 'a1', PieceKind.King], ['e5', PieceKind.Pawn]],
    [['h8', PieceKind.King], ['d7', PieceKind.Pawn], ...(pinned ? [['e8', PieceKind.Rook] as [string, PieceKind]] : [])], colour, getOpponentColour(colour));
  return createGame(`rules-${pinned ? 'pinned-' : ''}en-passant-${colour}`, `${colour} ${pinned ? 'pinned ' : ''}en passant`,
    [ruleUci('d7d5', colour)], { rootPosition: position });
}
