import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareJourney } from '../PrepareJourney';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';
import { setNwjsOverride } from '@/utility/nwjs/NwjsUtility';

beforeEach(() => sessionStorage.clear());
afterEach(() => {
  setNodeModuleOverrides();
  setNwjsOverride(null);
  window.history.replaceState({}, '', '/home');
});
describe('journey selection', () => {
  it('keeps the query-selected journey and saved edits after routing and reload', async () => {
    const run = { name: 'play', id: 'selection-test' };
    window.history.replaceState({}, '', '/?journey=history&reset=1');
    const first = await prepareJourney(run);
    expect(first.api.name).toBe('history');
    expect(window.location.pathname).toBe('/home');
    await first.fs.promises.writeFile('settings.json', 'edited');
    window.history.replaceState({}, '', '/game/history-allowed');
    const reloaded = await prepareJourney(run);
    expect(reloaded.api.name).toBe('history');
    expect(reloaded.api.readFile('settings.json')).toBe('edited');
    window.history.replaceState({}, '', '/?journey=history&reset=1');
    const reset = await prepareJourney(run);
    expect(JSON.parse(reset.api.readFile('settings.json')!).schemaVersion).toBe(1);
  });
  it('rejects an unknown journey before seeding files', async () => {
    window.history.replaceState({}, '', '/?journey=unknown');
    await expect(prepareJourney({ name: 'play', id: 'bad-selection' })).rejects.toThrow('Unknown journey');
    expect(sessionStorage.length).toBe(0);
  });
});
