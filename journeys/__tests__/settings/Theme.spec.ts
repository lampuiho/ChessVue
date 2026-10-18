import { describe, expect, it } from 'vitest';
import { boot } from '../support/UiHarness';
describe('JRN-SETTINGS-02 theme subscription ownership', () => {
  it('retains one theme subscription across routes and removes it on disposal', async () => {
    const { router, domain, stores } = await boot('settings');
    const registrations = () => domain.PlatformEventService.getEventRegistrationSnapshot().filter((entry) => entry.owner === 'SettingsStore');
    const initial = registrations();
    expect(initial).toHaveLength(1);
    for (let visit = 0; visit < 3; visit++) {
      await router.push('/game/settings-game');
      await router.push('/settings/appearance');
      expect(registrations()).toEqual(initial);
    }
    stores.useSettingsStore().$dispose();
    expect(registrations()).toEqual([]);
  });
});
