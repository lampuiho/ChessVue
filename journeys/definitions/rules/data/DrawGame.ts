import { PieceKind, TimeControlPreset, type PlayerColour } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { setPausedClock } from '../../../builders/ClockFixtureBuilder';
import { rulePosition } from './RuleScenario';
export const drawScenarios = [
  { name: 'stalemate', from: 'g4', to: 'g6', san: 'Qg6', own: [['f7', PieceKind.King], ['g4', PieceKind.Queen]], opponent: [['h8', PieceKind.King]] },
  { name: 'bishop-material', from: 'c1', to: 'd2', san: 'Bxd2', own: [['a1', PieceKind.King], ['c1', PieceKind.Bishop]], opponent: [['h8', PieceKind.King], ['d2', PieceKind.Rook]] },
  { name: 'knight-material', from: 'b1', to: 'c3', san: 'Nxc3', own: [['a1', PieceKind.King], ['b1', PieceKind.Knight]], opponent: [['h8', PieceKind.King], ['c3', PieceKind.Rook]] },
  { name: 'bare-kings', from: 'a1', to: 'b2', san: 'Kxb2', own: [['a1', PieceKind.King]], opponent: [['h8', PieceKind.King], ['b2', PieceKind.Rook]] },
] satisfies Array<{ name: string; from: string; to: string; san: string; own: Array<[string, PieceKind]>; opponent: Array<[string, PieceKind]> }>;
export function createDrawGame(colour: PlayerColour, name: string, now: number) {
  const scenario = drawScenarios.find((entry) => entry.name === name)!;
  const game = createGame(`rules-${name}-${colour}`, `${colour} ${name}`, [], {
    rootPosition: rulePosition(scenario.own, scenario.opponent, colour), timeControl: { preset: TimeControlPreset.Blitz, initialMs: 120000, incrementMs: 2000 },
  });
  setPausedClock(game, 120000, now);
  return game;
}
