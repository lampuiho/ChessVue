import { type IGame } from '@/contracts';
import { createCastlingGame } from './CastlingGame';
import { createEnPassantGame } from './EnPassantGame';
import { createKingSafetyGame, safetyScenarios } from './KingSafetyGame';
import { createDrawGame, drawScenarios } from './DrawGame';
import { castleObstacles, castleSides, ruleColours } from './RuleScenario';
export function createRuleVariants(now: number): IGame[] {
  return ruleColours.flatMap((colour) => [
    createCastlingGame(colour), createEnPassantGame(colour), createEnPassantGame(colour, true),
    ...safetyScenarios.filter((entry) => entry.name !== 'pinned-en-passant').map((entry) => createKingSafetyGame(colour, entry.name)),
    ...drawScenarios.map((entry) => createDrawGame(colour, entry.name, now)),
    ...castleSides.flatMap((side) => castleObstacles.map((obstacle) => createCastlingGame(colour, side, obstacle))),
  ]);
}
export function createRuleGames(now: number, variant?: string): IGame[] {
  const games = createRuleVariants(now);
  if (variant) {
    const game = games.find((entry) => entry.metadata.id === `rules-${variant}`);
    if (!game) throw new Error(`Unknown rules variant: ${variant}.`);
    return [game];
  }
  return games.filter((game) => /^rules-(castle|en-passant)-(white|black)$/.test(game.metadata.id));
}
