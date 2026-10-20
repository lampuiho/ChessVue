import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import catalogue from '../Catalogue.json';
import type { IGame } from '@/contracts';
import type { startJourney } from '../StartJourney';

let running: Awaited<ReturnType<typeof startJourney>> | undefined;
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => {
  if (running) {
    running.stopReady();
    for (const game of running.games.listGames()) await running.games.stopAnalysis(game as unknown as IGame);
    running.app.unmount();
    running.router.options.history.destroy();
  }
  running = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function boot(name: string) {
  window.history.replaceState({}, '', '/home');
  const { startJourney } = await import('../StartJourney');
  running = await startJourney({ name, id: 'bootstrap-test' });
  await vi.waitFor(() => expect(running?.api.ready).toBe(true), { timeout: 5000 });
  return running;
}
describe('journey application bootstrap', () => {
  it.each(Object.keys(catalogue))('restores %s through the real application stores', async (name) => {
    if (name === 'recovery') vi.spyOn(console, 'error').mockImplementation(() => {});
    const { api, games, router } = await boot(name);
    const expected = name === 'saves' ? ['save-library'] : api.gameIds;
    expect(games.listGames().map((game) => game.metadata.id)).toEqual(expected);
    expect(document.querySelector('#app > main')).not.toBeNull();
    expect(document.querySelector('.app-loading')).toBeNull();
    if (!expected.length) expect(router.currentRoute.value.path).toBe('/home');
    else if (name !== 'recovery') expect(router.currentRoute.value.path).not.toBe('/home');
    if (name === 'analysis') {
      await vi.waitFor(() => {
        const game = games.getGame('analysis-free')!;
        expect(game.analysis.seats[0]?.lines).toHaveLength(3);
        expect(game.analysis.seats[0]?.assignedEngine.$?.availability).toBe('running');
      });
    }
  });
  it('controls import/export/cancel through the actual storage adapter', async () => {
    const { api } = await boot('saves');
    const { usePlatformService } = await import('@/platform');
    const storage = usePlatformService().getStorageAdapter();
    expect(await storage.showOpenDialog()).toBe('imports/valid.json');
    api.chooseImport('imports/corrupt.json');
    expect(await storage.showOpenDialog()).toBe('imports/corrupt.json');
    api.chooseImport(null);
    await expect(storage.showOpenDialog()).rejects.toMatchObject({ kind: 'cancelled' });
    expect(await storage.showSaveDialog('Game.json')).toBe('exports/Game.json');
    api.chooseExport('exports/round-trip.json');
    await storage.writeTextFile(await storage.showSaveDialog(), 'exported', { ensureParentDirectory: true });
    expect(api.readFile('exports/round-trip.json')).toBe('exported');
    api.chooseExport(null);
    await expect(storage.showSaveDialog()).rejects.toMatchObject({ kind: 'cancelled' });
  });
});
