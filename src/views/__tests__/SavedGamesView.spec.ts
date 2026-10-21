import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformErrorKind, SaveGameTargetKind, type IGame } from '@/contracts';
import { createGame, createSavedGameEntry, createSavedGameGroup } from '@/state/__tests__/StateStoreTestUtility';
import SavedGamesView from '../SavedGamesView.vue';

const dependency = vi.hoisted(() => ({
  route: { name: 'save-game', params: { name: 'game-a' }, fullPath: '/saved-games/save/game-a' },
  router: { push: vi.fn(), replace: vi.fn(), afterEach: vi.fn(() => () => {}) },
  gamesStore: { getGame: vi.fn() },
  savedGamesStore: { listSavedGames: vi.fn(), loadGame: vi.fn(), saveGame: vi.fn() },
  uiStateStore: { gameSession: { activeGameId: 'game-a' } },
}));
vi.mock('vue-router', () => ({ useRoute: () => dependency.route, useRouter: () => dependency.router }));
vi.mock('@/state', () => ({
  useGamesStore: () => dependency.gamesStore,
  useSavedGamesStore: () => dependency.savedGamesStore,
  useUiStateStore: () => dependency.uiStateStore,
}));
let wrapper: VueWrapper;
let game: IGame;
async function _mountView() {
  wrapper = mount(SavedGamesView);
  await flushPromises();
}
async function _requestSave(name: string) {
  await wrapper.get('#save-name').setValue(name);
  await wrapper.get('.library-actions .text-button--primary').trigger('click');
  await flushPromises();
}
async function _selectSnapshot(name: string) {
  await wrapper.findAll('.save-row__content').find((row) => row.get('strong').text() === name)!.trigger('click');
  await flushPromises();
}
describe('SavedGamesView named saves', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    game = createGame();
    game.metadata.id = 'game-a';
    dependency.gamesStore.getGame.mockReturnValue(game);
    dependency.savedGamesStore.loadGame.mockResolvedValue(game);
    dependency.savedGamesStore.listSavedGames.mockResolvedValue([
      createSavedGameGroup('game-a', [createSavedGameEntry('game-a', 'Opening', '2026-04-17T11:00:00.000Z', false, 'saves/game-a/Opening.json')]),
    ]);
    dependency.savedGamesStore.saveGame.mockResolvedValue('saves/game-a/New.json');
  });
  afterEach(() => wrapper?.unmount());
  it.each(['success', 'failure'])('ignores obsolete read %s after reselecting the same snapshot', async (outcome) => {
    dependency.savedGamesStore.listSavedGames.mockResolvedValue([createSavedGameGroup('game-a', [
      createSavedGameEntry('game-a', 'Opening', '2026-04-17T11:00:00.000Z', false, 'saves/game-a/Opening.json'),
      createSavedGameEntry('game-a', 'Current', '2026-04-17T12:00:00.000Z', false, 'saves/game-a/Current.json'),
    ])]);
    await _mountView();
    let resolveRead!: (game: IGame) => void;
    let rejectRead!: (error: Error) => void;
    const pending = new Promise<IGame>((resolve, reject) => { resolveRead = resolve; rejectRead = reject; });
    dependency.savedGamesStore.loadGame.mockReturnValueOnce(pending);
    await _selectSnapshot('Opening');
    await _selectSnapshot('Current');
    const fresh = createGame();
    fresh.metadata.name = 'Fresh details';
    dependency.savedGamesStore.loadGame.mockResolvedValueOnce(fresh);
    await _selectSnapshot('Opening');
    expect(wrapper.get('.snapshot-details > strong').text()).toBe('Fresh details');
    const obsolete = createGame();
    obsolete.metadata.name = 'Obsolete details';
    if (outcome === 'success') resolveRead(obsolete);
    else rejectRead(new Error('Obsolete read failed.'));
    await flushPromises();
    expect(wrapper.get('.snapshot-details > strong').text()).toBe('Fresh details');
    expect(wrapper.find('.snapshot-details .library-feedback--error').exists()).toBe(false);
  });
  it('saves a unique trimmed name immediately without enabling overwrite', async () => {
    await _mountView();
    await _requestSave('  New  ');
    expect(dependency.savedGamesStore.saveGame).toHaveBeenCalledExactlyOnceWith(game, {
      targetKind: SaveGameTargetKind.ManagedSave, saveName: 'New', overwrite: false,
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Saved “New”.');
  });
  it.each(['cancel', 'close', 'escape', 'backdrop'])('leaves the save view open without writing on %s', async (action) => {
    await _mountView();
    await _requestSave('  Opening  ');
    expect(wrapper.get('[role="dialog"]').text()).toContain('“Opening” already exists');
    expect(dependency.savedGamesStore.saveGame).not.toHaveBeenCalled();
    if (action === 'cancel') await wrapper.get('.modal-card__actions .text-button--ghost').trigger('click');
    if (action === 'close') await wrapper.get('[aria-label="Close dialog"]').trigger('click');
    if (action === 'escape') await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    if (action === 'backdrop') await wrapper.get('.modal-backdrop').trigger('mousedown');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(dependency.savedGamesStore.saveGame).not.toHaveBeenCalled();
    expect(dependency.router.push).not.toHaveBeenCalled();
    expect((wrapper.get('#save-name').element as HTMLInputElement).value).toBe('  Opening  ');
  });
  it('replaces only the confirmed name and ignores repeated Enter submissions', async () => {
    await _mountView();
    await _requestSave('Opening');
    await wrapper.get('#save-name').setValue('Different');
    await wrapper.get('#save-name').trigger('keydown', { key: 'Enter' });
    expect(dependency.savedGamesStore.saveGame).not.toHaveBeenCalled();
    await wrapper.get('.modal-card__actions .text-button--danger').trigger('click');
    await flushPromises();
    expect(dependency.savedGamesStore.saveGame).toHaveBeenCalledExactlyOnceWith(game, {
      targetKind: SaveGameTargetKind.ManagedSave, saveName: 'Opening', overwrite: true,
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Saved “Opening”.');
  });
  it('asks for confirmation when storage reports a collision absent from the displayed list', async () => {
    dependency.savedGamesStore.saveGame.mockRejectedValueOnce({ kind: PlatformErrorKind.AlreadyExists });
    await _mountView();
    await _requestSave('opening');
    expect(dependency.savedGamesStore.saveGame).toHaveBeenCalledWith(game, {
      targetKind: SaveGameTargetKind.ManagedSave, saveName: 'opening', overwrite: false,
    });
    expect(wrapper.get('[role="dialog"]').text()).toContain('“opening” already exists');
    await wrapper.get('.modal-card__actions .text-button--ghost').trigger('click');
    expect(dependency.savedGamesStore.saveGame).toHaveBeenCalledTimes(1);
  });
  it.each(['', ' ', 'auto', 'AUTO', '.', '..', '../Opening', '..\\Opening', 'CON', 'LPT1.json', 'Ending.', 'Bad\u0001'])('does not write or prompt for invalid name %s', async (name) => {
    await _mountView();
    await wrapper.get('#save-name').setValue(name);
    await wrapper.get('#save-name').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(dependency.savedGamesStore.saveGame).not.toHaveBeenCalled();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });
  it('reports write failures without claiming success', async () => {
    dependency.savedGamesStore.saveGame.mockRejectedValueOnce(new Error('Save failed.'));
    await _mountView();
    await _requestSave('New');
    expect(wrapper.get('.library-feedback--error').text()).toBe('Save failed.');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Saved “New”.');
  });
});
