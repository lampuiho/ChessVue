import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createTimedContext } from '../support/UiHarness';
describe('UI-03 and UI-15 game route reuse', () => {
  it('validates every changed game id and hides a single tab', async () => {
    const { game, router, stores } = await createTimedContext();
    expect(document.querySelector('.tab-strip')).toBeNull();
    await router.push('/game/unknown-game');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/game/' + game.metadata.id);
    stores.useUiStateStore().closeTab(game.metadata.id);
    await router.push('/game/another-unknown-game');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/home');
  });
});
