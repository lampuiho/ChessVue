import { beforeEach, describe, expect, it } from 'vitest';
import { JourneyFileSystem } from '../JourneyFileSystem';

describe('isolated journey persistence', () => {
  beforeEach(() => sessionStorage.clear());
  it('retains writes/deletes on reload and restores the seed after reset', async () => {
    const seed = [{ path: 'saves/game/auto.json', raw: 'initial', modifiedAt: 1000 }];
    const first = new JourneyFileSystem(sessionStorage, 'run:play', seed);
    await first.promises.writeFile('saves/game/auto.json', 'changed');
    await first.promises.mkdir('exports');
    await first.promises.writeFile('exports/game.json', 'exported');
    const reloaded = new JourneyFileSystem(sessionStorage, 'run:play', seed);
    expect(reloaded.readFile('saves\\game\\auto.json')).toBe('changed');
    expect(new TextDecoder().decode(await reloaded.promises.readFile('exports/game.json'))).toBe('exported');
    await reloaded.promises.unlink('saves/game/auto.json');
    expect(new JourneyFileSystem(sessionStorage, 'run:play', seed).listFiles()).toEqual(['exports/game.json']);
    reloaded.reset();
    const reset = new JourneyFileSystem(sessionStorage, 'run:play', seed);
    expect(reset.readFile('saves/game/auto.json')).toBe('initial');
    expect(reset.readFile('exports/game.json')).toBeUndefined();
  });
  it('isolates journeys and command runs', async () => {
    const first = new JourneyFileSystem(sessionStorage, 'run1:play', [{ path: 'settings.json', raw: 'one' }]);
    await first.promises.writeFile('settings.json', 'updated');
    const otherJourney = new JourneyFileSystem(sessionStorage, 'run1:history', [{ path: 'settings.json', raw: 'two' }]);
    const otherRun = new JourneyFileSystem(sessionStorage, 'run2:play', [{ path: 'settings.json', raw: 'three' }]);
    first.reset();
    expect(otherJourney.readFile('settings.json')).toBe('two');
    expect(otherRun.readFile('settings.json')).toBe('three');
  });
  it('supports save indexing, modification dates and missing-file errors', async () => {
    const fs = new JourneyFileSystem(sessionStorage, 'index', [{ path: 'saves/game/auto.json', raw: '{}', modifiedAt: 1000 }]);
    const root = await fs.promises.readdir('saves');
    expect(root.map((entry) => [entry.name, entry.isDirectory()])).toEqual([['game', true]]);
    const files = await fs.promises.readdir('saves/game');
    expect(files.map((entry) => [entry.name, entry.isDirectory()])).toEqual([['auto.json', false]]);
    expect((await fs.promises.stat('saves/game/auto.json')).mtime.getTime()).toBe(1000);
    await fs.promises.writeFile('saves/game/auto.json', 'new');
    expect((await fs.promises.stat('saves/game/auto.json')).mtime.getTime()).toBeGreaterThan(1000);
    await expect(fs.promises.readFile('missing')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.promises.writeFile('missing/child.json', '')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
