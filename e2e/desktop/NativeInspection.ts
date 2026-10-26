import type { Page } from '@playwright/test';
import type { IGame, IEnginePlayer } from '../../src/contracts';

export interface INativeHost {
  require: NodeJS.Require;
  process: NodeJS.Process;
  nw: { Window: { get(): { close(force?: boolean): void; show(): void; focus(): void; on(event: string, listener: () => void): void; removeListener(event: string, listener: () => void): void } } };
}
export async function currentGame(page: Page) {
  const id = new URL(page.url()).pathname.split('/').pop()!;
  return page.evaluate(async id => {
    const statePath = '/src/state/index.ts';
    const domainPath = '/src/domain/SerializationService.ts';
    const { useGamesStore } = await import(statePath) as typeof import('../../src/state');
    const { SerializationService } = await import(domainPath) as typeof import('../../src/domain/SerializationService');
    return JSON.parse(SerializationService.serialiseGame(useGamesStore().getGame(id) as IGame)) as IGame;
  }, id);
}
export async function nativeProcesses(page: Page) {
  return page.evaluate(async () => {
    const statePath = '/src/state/index.ts';
    const { useGamesStore } = await import(statePath) as typeof import('../../src/state');
    return useGamesStore().listGames().flatMap(game => {
      const engines = [
        ...game.analysis.seats.map(seat => ({ role: 'analysis', engine: seat.assignedEngine })),
        ...[game.whitePlayer, game.blackPlayer].filter(player => player?.type === 'engine').map(player => ({ role: 'player', engine: (player as IEnginePlayer).assignedEngine })),
      ];
      return engines.map(({ role, engine }) => ({ gameId: game.metadata.id, role, name: engine.displayName, pid: (engine.$?.process as { pid?: number } | undefined)?.pid, availability: engine.$?.availability }));
    });
  });
}
export function processExists(pid: number) {
  try { process.kill(pid, 0); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
}
export async function storageOperation(page: Page, operation: 'read' | 'write', path: string, raw = '', overwrite = false) {
  return page.evaluate(async ({ operation, path, raw, overwrite }) => {
    const modulePath = '/src/platform/index.ts';
    const { usePlatformService } = await import(modulePath) as typeof import('../../src/platform');
    const storage = usePlatformService().getStorageAdapter();
    try {
      const value = operation === 'read' ? await storage.readTextFile(path) : await storage.writeTextFile(path, raw, { overwrite });
      return { value, kind: undefined };
    } catch (error) { return { kind: (error as { kind: string }).kind, value: undefined }; }
  }, { operation, path, raw, overwrite });
}
