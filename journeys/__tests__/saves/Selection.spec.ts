import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { boot, clickButton } from '../support/UiHarness';
describe('UI-12 saved snapshot selection', () => {
  it('shows autosave first, selected-save details and loads the selected snapshot', async () => {
    const { games, router } = await boot('saves');
    await flushPromises();
    const rows = document.querySelectorAll<HTMLElement>('.save-row');
    expect(rows[0]?.textContent).toContain('Automatic save');
    expect(document.querySelector('[role="separator"]')).not.toBeNull();
    const opening = [...rows].find((row) => row.textContent?.includes('Opening'))!;
    opening.querySelector<HTMLButtonElement>('.save-row__content')!.click();
    await flushPromises();
    expect(document.querySelector('.snapshot-details')?.textContent).toContain('Library opening');
    await clickButton('Load selected', '.library-actions button');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toMatch(/^\/game\//));
    const loaded = games.getGame(String(router.currentRoute.value.params.id));
    expect(loaded?.metadata.name).toBe('Library opening');
    expect(loaded?.renderedPath).toHaveLength(2);
  });
});
