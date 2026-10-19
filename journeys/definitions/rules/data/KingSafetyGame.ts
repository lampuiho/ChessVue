import { PieceKind, type PlayerColour } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { rulePosition } from './RuleScenario';
export const safetyScenarios = [
  { name: 'pin', from: 'e2', illegal: 'd2', targets: ['e3', 'e4', 'e5', 'e6', 'e7', 'e8'], legal: 'e3' },
  { name: 'defended-capture', from: 'e1', illegal: 'e2', targets: ['d1', 'f1'], legal: 'd1' },
  { name: 'double-check', from: 'a1', illegal: 'a2', targets: [], legal: 'f1' },
  { name: 'pinned-en-passant', from: 'e5', illegal: 'd6', targets: ['e6'], legal: 'e6' },
] as const;
export function createKingSafetyGame(colour: PlayerColour, name: string) {
  const own: Array<[string, PieceKind]> = [['e1', PieceKind.King]];
  const opponent: Array<[string, PieceKind]> = [['h8', PieceKind.King], ['e8', PieceKind.Rook]];
  if (name === 'pin') own.push(['e2', PieceKind.Rook]);
  if (name === 'defended-capture') opponent.push(['e2', PieceKind.Rook]);
  if (name === 'double-check') {
    own.push(['a1', PieceKind.Rook]);
    opponent.push(['b4', PieceKind.Bishop]);
  }
  return createGame(`rules-${name}-${colour}`, `${colour} ${name}`, [], { rootPosition: rulePosition(own, opponent, colour) });
}
