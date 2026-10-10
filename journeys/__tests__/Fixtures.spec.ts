import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GameState, PieceKind, PlayerColour, type IBoardPosition, type IGame, type IMoveNode } from '@/contracts';
import { SerializationService } from '@/domain/SerializationService';
import { TimeControlService } from '@/domain/TimeControlService';
import { applyMove, genLegalMoves, isMoveLegal } from '@/utility/chess';
import { ClockTimestamp } from '@/utility/date';
import { createJourney, journeyCatalogue } from '../index';

function validateTree(node: IMoveNode, position: IBoardPosition): void {
  for (const child of node.children) {
    expect(child.plyIndex).toBe(node.plyIndex + 1);
    expect(child.move).toBeDefined();
    expect(isMoveLegal(position, child.move!)).toBe(true);
    const next = structuredClone(position);
    applyMove(next, child.move!);
    validateTree(child, next);
  }
}
function gamesIn(name: string): IGame[] {
  return createJourney(name, 1000).files.filter((file) => file.path.startsWith('saves/') && !file.path.includes('recovery-broken'))
    .map((file) => SerializationService.deserialiseGame(file.raw));
}
describe('journey fixture contracts', () => {
  it.each(Object.keys(journeyCatalogue))('%s has valid documents and legal continuations', (name) => {
    const seed = createJourney(name, 1000);
    expect(new Set(seed.files.map((file) => file.path)).size).toBe(seed.files.length);
    expect(new Set(seed.gameIds).size).toBe(seed.gameIds.length);
    for (const game of gamesIn(name)) {
      validateTree(game.moveTree.root, game.rootPosition);
      const raw = SerializationService.serialiseGame(game);
      expect(raw).not.toContain('"$"');
      expect(SerializationService.serialiseGame(SerializationService.deserialiseGame(raw))).toBe(raw);
    }
    if (name === 'fresh' || name === 'recovery') return;
    const file = (path: string) => seed.files.find((entry) => entry.path === path)!.raw;
    expect(SerializationService.deserialiseSettings(file('settings.json')).analysis.engineInventory).toHaveLength(3);
    expect(SerializationService.deserialiseUiLayoutState(file('layout-state.json')).showHistoryPanel).toBe(true);
    const session = SerializationService.deserialiseGameSession(file('game-session.json'));
    expect(session.activeRoute).toBe(seed.activeRoute);
    expect(session.openGameIds.every((id) => seed.gameIds.includes(id))).toBe(true);
  });
  it('covers every committed scenario and rejects unknown names', () => {
    const source = readFileSync('docs/HighLevel/scenarios.md', 'utf8');
    const ids = [...source.matchAll(/^### (SCN-(?!IDEA)[\w-]+)/gm)].map((match) => match[1]);
    const covered = new Set(Object.values(journeyCatalogue).flatMap((entry) => entry.scenarios));
    expect(ids.filter((id) => !covered.has(id!))).toEqual([]);
    expect(() => createJourney('unknown')).toThrow('Unknown journey');
    expect(() => createJourney('constructor')).toThrow('Unknown journey');
  });
  it('offers quiet and capture promotion choices for both colours', () => {
    for (const game of gamesIn('promotion')) {
      const promotions = genLegalMoves(game.rootPosition).filter((move) => move.promotionPiece);
      expect(promotions).toHaveLength(8);
      expect(new Set(promotions.map((move) => move.promotionPiece))).toEqual(new Set([PieceKind.Queen, PieceKind.Rook, PieceKind.Bishop, PieceKind.Knight]));
    }
  });
  it('starts timed games paused so tests choose when the deadline begins', () => {
    const games = gamesIn('clocks');
    expect(games).toHaveLength(3);
    for (const game of games) {
      expect(game.gameState).toBe(GameState.PausedWhiteTurn);
      expect(TimeControlService.hasExpired(game.clockSnapshot, new ClockTimestamp(60000))).toBe(false);
      const running = TimeControlService.resumeClock(game.clockSnapshot, new ClockTimestamp(60000));
      expect(running.white.isRunning).toBe(true);
      expect(running.activeColour).toBe(PlayerColour.White);
    }
  });
  it('includes nested alternatives with both takeback policies', () => {
    const games = gamesIn('history');
    expect(games.map((game) => game.gameplayOptions.allowTakeback)).toEqual([true, false]);
    for (const game of games) {
      const first = game.moveTree.root.children[0]!;
      expect(first.children).toHaveLength(2);
      expect(first.children[0]!.children).toHaveLength(2);
      expect(first.children[0]!.children[1]!.children[0]!.children).toHaveLength(2);
    }
  });
  it('includes invalid imports without invalidating the valid save library', () => {
    const files = createJourney('saves').files;
    const raw = (path: string) => files.find((file) => file.path === path)!.raw;
    expect(() => SerializationService.deserialiseGame(raw('imports/corrupt.json'))).toThrow();
    expect(() => SerializationService.deserialiseGame(raw('imports/unsupported-version.json'))).toThrow('unsupported');
    expect(SerializationService.deserialiseGame(raw('imports/duplicate-id.json')).metadata.id).toBe('save-library');
    const auto = files.find((file) => file.path === 'saves/save-library/auto.json')!;
    const named = files.find((file) => file.path === 'saves/save-library/Middlegame.json')!;
    expect(named.modifiedAt).toBeGreaterThan(auto.modifiedAt!);
  });
});
