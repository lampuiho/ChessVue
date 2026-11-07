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
  it('drills into a group from its library row without disturbing the two-step selection', async () => {
    const { router } = await boot('saves');
    await clickButton('Load');
    await flushPromises();
    const rows = [...document.querySelectorAll<HTMLElement>('.game-row')];
    const other = rows.find((row) => row.textContent?.includes('Second saved game'))!;
    // Selecting a row stays on the list so the footer can confirm the choice.
    other.querySelector<HTMLButtonElement>('.game-row__content')!.click();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/saved-games/load');
    expect(other.querySelector('.game-row__content')!.getAttribute('aria-pressed')).toBe('true');
    // The row chevron is the direct drill-in to that group's snapshots.
    other.querySelector<HTMLButtonElement>('.game-row__open')!.click();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/saved-games/load/save-other');
    expect(document.querySelector('.snapshot-browser')).not.toBeNull();
  });
  it('deletes every snapshot of the selected group from the library footer', async () => {
    const { api, router } = await boot('saves');
    await clickButton('Load');
    await flushPromises();
    const other = [...document.querySelectorAll<HTMLElement>('.game-row')].find((row) => row.textContent?.includes('Second saved game'))!;
    other.querySelector<HTMLButtonElement>('.game-row__content')!.click();
    await flushPromises();
    await clickButton('Delete game', '.library-actions button');
    await clickButton('Delete game', '[role="dialog"] button');
    await vi.waitFor(() => expect(document.querySelectorAll('.game-row')).toHaveLength(1));
    // The group's files are gone while the other group and the open workspace are untouched.
    for (const path of ['saves/save-other/auto.json', 'saves/save-other/Named save.json', 'saves/save-other/Mismatched.json']) {
      expect(api.readFile(path)).toBeUndefined();
    }
    expect(api.readFile('saves/save-library/Middlegame.json')).toBeDefined();
    expect(router.currentRoute.value.path).toBe('/saved-games/load');
    expect(document.querySelector('.game-row')?.textContent).toContain('Library middlegame');
  });
});
