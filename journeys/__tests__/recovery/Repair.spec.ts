import { describe, expect, it, vi } from 'vitest';
import { boot, forgetRunning } from '../support/UiHarness';
describe('JRN-RECOVERY-07 targeted repaired restore', () => {
  it('does not look up missing or unsupported IDs again after the session checkpoint', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { api, stores, stopReady, app, router } = await boot('recovery');
    const files = api.listFiles();
    const broken = api.readFile('saves/recovery-broken/auto.json');
    await stores.useUiStateStore().saveGameSession();
    stopReady();
    app.unmount();
    router.options.history.destroy();
    forgetRunning();
    vi.resetModules();
    const { SerializationService } = await import('@/domain');
    const reads = vi.spyOn(SerializationService, 'readGameDocument');
    const restored = await boot('recovery');
    expect(reads.mock.calls).toEqual([['saves/recovery-valid/auto.json']]);
    expect(restored.games.listGames().map((game) => game.metadata.id)).toEqual(['recovery-valid']);
    expect(restored.api.listFiles()).toEqual(files);
    expect(restored.api.readFile('saves/recovery-broken/auto.json')).toBe(broken);
    expect(restored.stores.useUiStateStore().recoveryWarnings).toEqual(['The saved layout could not be read. The default layout is in use.']);
  });
});
