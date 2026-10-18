import { describe, expect, it, vi } from 'vitest';
import { boot, clickButton } from '../support/UiHarness';
describe('UI-14 settings route guard', () => {
  it('guards arbitrary navigation until changes are kept or discarded', async () => {
    const { stores, router } = await boot('settings');
    await router.push('/settings/appearance');
    stores.useSettingsStore().draftSettings!.appearance.uiScalePercent = 125;
    await router.push('/home');
    expect(router.currentRoute.value.path).toBe('/settings/appearance');
    await clickButton('Keep editing', '[role="dialog"] button');
    expect(stores.useSettingsStore().hasPendingChanges).toBe(true);
    await router.push('/saved-games/load');
    await clickButton('Discard changes', '[role="dialog"] button');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/saved-games/load'));
    expect(stores.useSettingsStore().hasPendingChanges).toBe(false);
  });
});
