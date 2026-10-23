import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { boot } from '../support/UiHarness';
describe('UI-04 reactive engine inventory', () => {
  it('refreshes assignment choices after applied profile edits', async () => {
    const { stores, modal } = await boot('settings');
    const { default: GameCreationModal } = await import('@/components/modals/GameCreationModal.vue');
    modal.open(GameCreationModal, {});
    await nextTick();
    expect(document.querySelector('#white-player')?.textContent).toContain('Journey A');
    const settings = stores.useSettingsStore();
    settings.draftSettings!.analysis.engineInventory[0]!.displayName = 'Updated engine choice';
    settings.draftSettings!.analysis.engineInventory.splice(1, 1);
    await settings.applySettings();
    await nextTick();
    const choices = document.querySelector('#white-player')?.textContent;
    expect(choices).toContain('Updated engine choice');
    expect(choices).not.toContain('Journey A');
    expect(choices).not.toContain('Journey B');
  });
});
