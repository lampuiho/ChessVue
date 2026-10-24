import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { GameState, PlayerColour, PlayerType, type IEnginePlayer, type IGame } from '@/contracts';
import { boot, clickButton } from '../support/UiHarness';
describe('UI-04 copied engine seat preservation', () => {
  it.each(['unchanged', 'edited', 'renamed', 'deleted'])('keeps the seated engine when confirming without a new selection after its profile is %s', async (change) => {
    const context = await boot('settings');
    const { games, stores, domain, router, modal } = context;
    const game = games.getGame('settings-game') as unknown as IGame;
    const profile = (await import('../../data/EngineProfile')).createEngineProfiles()[0]!;
    await games.reassignPlayer(game, PlayerColour.Black, {
      colour: PlayerColour.Black, type: PlayerType.Engine, displayName: profile.displayName,
      assignedEngine: { ...profile, options: { ...profile.options } },
    } as IEnginePlayer);
    const seated = game.blackPlayer as IEnginePlayer;
    const snapshot = JSON.parse(JSON.stringify(seated.assignedEngine));
    const pendingTurn = game.$?.pendingPlayerTurnPromise;
    const settings = stores.useSettingsStore();
    if (change === 'deleted') settings.draftSettings!.analysis.engineInventory = settings.draftSettings!.analysis.engineInventory.filter((engine) => engine.id !== profile.id);
    if (change === 'renamed') settings.draftSettings!.analysis.engineInventory[0]!.displayName = 'Renamed engine';
    if (change === 'edited') settings.draftSettings!.analysis.engineInventory[0]!.options.Hash = 64;
    await settings.applySettings();
    await router.push('/game/' + game.metadata.id);
    const stopEngine = vi.spyOn(domain.EngineRuntimeService, 'stopEngine');
    const { default: PlayerSelectionModal } = await import('@/components/modals/PlayerSelectionModal.vue');
    modal.open(PlayerSelectionModal, { gameId: game.metadata.id, colour: PlayerColour.Black });
    await nextTick();
    await clickButton('Assign player', '[role="dialog"] button');
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(game.blackPlayer?.type).toBe(PlayerType.Engine);
    expect((game.blackPlayer as IEnginePlayer).assignedEngine).toMatchObject(snapshot);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.livePath).toEqual([0, 0]);
    expect(game.$?.pendingPlayerTurnPromise).toBe(pendingTurn);
    expect(stopEngine).not.toHaveBeenCalled();
  });
});
