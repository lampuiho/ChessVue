import { afterEach, describe, expect, it } from 'vitest';
import { setNodeModuleOverrides } from '@/utility/nwjs/NodeUtility';
import { prepareJourney } from '../../PrepareJourney';
afterEach(() => {
  setNodeModuleOverrides();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/home');
});
describe('Recovery variant namespaces', () => {
  it('retains the selected variant on reload and isolates reset from other variants', async () => {
    sessionStorage.clear();
    const run = { name: 'recovery', id: 'recovery-variant-test' };
    window.history.replaceState(null, '', '/?journey=recovery&variant=settings&reset=1');
    const settings = await prepareJourney(run);
    await settings.fs.promises.writeFile('settings.json', 'external settings change');
    const reloaded = await prepareJourney(run);
    expect(reloaded.api.readFile('settings.json')).toBe('external settings change');
    window.history.replaceState(null, '', '/?journey=recovery&variant=layout');
    const layout = await prepareJourney(run);
    expect(layout.api.readFile('settings.json')).not.toBe('external settings change');
    expect(layout.api.readFile('layout-state.json')).toBe('{ corrupt layout');
    layout.fs.reset();
    const reset = await prepareJourney(run);
    expect(reset.api.readFile('layout-state.json')).toBe('{ corrupt layout');
    window.history.replaceState(null, '', '/?journey=recovery&variant=settings');
    expect((await prepareJourney(run)).api.readFile('settings.json')).toBe('external settings change');
    window.history.replaceState(null, '', '/?journey=recovery');
    expect((await prepareJourney(run)).api.readFile('settings.json')).toBe('{ corrupt settings');
  });
});
