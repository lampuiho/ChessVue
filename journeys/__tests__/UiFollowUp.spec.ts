import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { AppModalKind, GameState, PauseReason, PlayerColour, PlayerType, ResultReason, ResultState, TimeControlPreset, type IGame } from '@/contracts';
import { boot, createTimedContext, legalMove, findButton, clickButton, setField, clickSquare, forgetRunning } from './support/UiHarness';
describe('UI-02 in-game analysis permissions', () => {
  it('keeps a manual pause read-only when it is layered over analysis', async () => {
    const context = await createTimedContext();
    const { games, game } = context;
    await games.enterInGameAnalysis(game);
    await games.pauseGame(game, PauseReason.Manual);
    await expect(games.makeMove(game, legalMove(context, game, 'e2e4'))).rejects.toThrow();
    expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow();
    await nextTick();
    expect(findButton('Resume game', '.control-button')).toBeDefined();
    await games.resumeGame(game, PauseReason.Manual);
    await nextTick();
    expect(findButton('Exit analysis', '.control-button')).toBeDefined();
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
  });
  it('exposes an exit that returns to live play after entering analysis', async () => {
    const { game } = await createTimedContext();
    await clickButton('Analyse', '.control-button');
    expect(game.clockSnapshot.white.isRunning).toBe(false);
    expect(findButton('Exit analysis', '.control-button')).toBeDefined();
    await clickButton('Exit analysis', '.control-button');
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.renderedPath).toBe(game.livePath);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
  });
  it('allows both colours to explore with the live node and clock unchanged', async () => {
    const context = await createTimedContext();
    const { game, games } = context;
    await games.enterInGameAnalysis(game);
    const livePath = [...game.livePath!];
    const clock = JSON.stringify(game.clockSnapshot);
    await expect(games.makeMove(game, legalMove(context, game, 'e2e4'))).resolves.toBeUndefined();
    await expect(games.makeMove(game, legalMove(context, game, 'e7e5'))).resolves.toBeUndefined();
    expect(game.livePath).toEqual(livePath);
    expect(game.renderedPath).toHaveLength(2);
    expect(JSON.stringify(game.clockSnapshot)).toBe(clock);
    expect(context.fixtures.getPosition(game, game.livePath!).sideToMove).toBe(PlayerColour.White);
    games.exitInGameAnalysis(game);
    expect(game.renderedPath).toBe(game.livePath);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
  });
  it('allows history navigation while only the analysis pause owns the clock', async () => {
    const context = await createTimedContext();
    const { game, games } = context;
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    await games.enterInGameAnalysis(game);
    const livePath = [...game.livePath!];
    const clock = JSON.stringify(game.clockSnapshot);
    expect(() => games.navigateToNode(game, game.moveTree.root)).not.toThrow();
    expect(game.renderedPath).toEqual([]);
    expect(game.livePath).toEqual(livePath);
    expect(JSON.stringify(game.clockSnapshot)).toBe(clock);
  });
  it.each([PauseReason.Manual, PauseReason.Menu])('keeps %s pauses read-only', async (reason) => {
    const context = await createTimedContext();
    const { game, games } = context;
    await games.pauseGame(game, reason);
    await expect(games.makeMove(game, legalMove(context, game, 'e2e4'))).rejects.toThrow();
    expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow();
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(false);
  });
});
describe('UI-05 required engine availability', () => {
  it('keeps custom creation open when its required engine cannot launch', async () => {
    const { games, stores } = await boot('settings');
    const count = games.listGames().length;
    stores.useUiStateStore().showModal({ kind: AppModalKind.NewGame });
    await nextTick();
    setField('#white-player', 'engine:journey-unavailable');
    await nextTick();
    document.querySelector<HTMLFormElement>('#new-game-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain('unavailable'));
    expect(games.listGames()).toHaveLength(count);
    expect(stores.useUiStateStore().modalState?.kind).toBe(AppModalKind.NewGame);
  });
});
describe('UI-09 suggested move-prefix playback', () => {
  it('commits one normal live suggestion even when a later prefix move is selected', async () => {
    const { games, router } = await boot('analysis');
    await router.push('/game/analysis-live-moves');
    const game = games.getGame('analysis-live-moves') as unknown as IGame;
    await vi.waitFor(() => expect(document.querySelectorAll('.analysis-line__moves button').length).toBeGreaterThanOrEqual(4));
    document.querySelectorAll<HTMLButtonElement>('.analysis-line__moves button')[2]!.click();
    await flushPromises();
    expect(game.livePath).toHaveLength(3);
    expect(game.renderedPath).toBe(game.livePath);
  });
  it('rejects an obsolete suggestion before applying any part of its prefix', async () => {
    const { games, router } = await boot('analysis');
    const source = games.getGame('analysis-free') as unknown as IGame;
    await vi.waitFor(() => expect(source.analysis.seats[0]?.lines[0]?.pv.length).toBeGreaterThanOrEqual(4));
    const oldMoves = [...source.analysis.seats[0]!.lines[0]!.pv];
    const view = document.querySelector<HTMLButtonElement>('.analysis-line__moves button');
    expect(view).not.toBeNull();
    // History selection changes the side to move, invalidating the previous line.
    games.navigateToNode(source, source.moveTree.root.children[0]!);
    await games.stopAnalysis(source);
    source.analysis.seats[0]!.lines = [{ depth: 12, pv: oldMoves }];
    games.workspaceRevision += 1;
    await nextTick();
    document.querySelectorAll<HTMLButtonElement>('.analysis-line__moves button')[2]!.click();
    await flushPromises();
    expect(source.renderedPath).toEqual([0]);
    expect(document.querySelector('.toast')?.textContent).toContain('stale');
    expect(router.currentRoute.value.path).toBe('/game/analysis-free');
  });
  it('plays only the selected prefix one move at a time', async () => {
    const { games } = await boot('analysis');
    const game = games.getGame('analysis-free') as unknown as IGame;
    await vi.waitFor(() => expect(document.querySelectorAll('.analysis-line__moves button').length).toBeGreaterThanOrEqual(4));
    await games.stopAnalysis(game);
    await nextTick();
    const buttons = document.querySelectorAll<HTMLButtonElement>('.analysis-line__moves button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    buttons[2]!.click();
    await flushPromises();
    expect(game.renderedPath).toHaveLength(3);
    await vi.waitFor(() => expect(game.renderedPath).toHaveLength(5), { timeout: 2000 });
    expect(game.livePath).toBeUndefined();
    expect(document.querySelectorAll('.history-row')).toHaveLength(5);
  });
});
describe('UI-17 analysis takeback policy', () => {
  it('keeps takeback disabled in analysis when game policy disallows it', async () => {
    const context = await createTimedContext();
    const { game, games } = context;
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    game.gameplayOptions.allowTakeback = false;
    await games.enterInGameAnalysis(game);
    await nextTick();
    expect(findButton('Takeback', '.control-button')?.disabled).toBe(true);
    await expect(games.takeBack(game)).rejects.toThrow('not allowed');
  });
});
describe('UI-11 historical continuation confirmation', () => {
  it('cancels or confirms a rewrite while preserving the old continuation', async () => {
    const { games } = await boot('history');
    const game = games.getGame('history-allowed') as unknown as IGame;
    const previous = [...game.livePath!];
    const parent = game.moveTree.root.children[0]!;
    const oldIndex = parent.mainlineChildIndex!;
    const oldContinuation = parent.children[oldIndex];
    games.navigateToNode(game, parent);
    await nextTick();
    await clickSquare('c7');
    await clickSquare('c5');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Continue from this position');
    expect(game.livePath).toEqual(previous);
    await clickButton('Cancel', '[role="dialog"] button');
    expect(game.livePath).toEqual(previous);
    await clickSquare('c7');
    await clickSquare('c5');
    await clickButton('Continue game', '[role="dialog"] button');
    expect(game.livePath).toHaveLength(2);
    expect(game.moveTree.root.children[0]!.children.length).toBeGreaterThan(1);
    expect(parent.children[oldIndex]).toBe(oldContinuation);
    expect(parent.mainlineChildIndex).not.toBe(oldIndex);
    expect(document.querySelectorAll('.history-row__tag').length).toBeGreaterThan(0);
  });
});
describe('UI-13 startup recovery', () => {
  it('chooses the first valid restored game and provides recovery actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { router } = await boot('recovery');
    expect(router.currentRoute.value.path).toBe('/game/recovery-valid');
    expect(document.querySelector('.recovery-notice')?.textContent).toContain('Settings could not be read');
    expect(findButton('Saved games', '.recovery-notice button')).toBeDefined();
    await clickButton('Dismiss', '.recovery-notice button');
    expect(document.querySelector('.recovery-notice')).toBeNull();
  });
  it('ignores the remembered route when restore-session is disabled', async () => {
    const { stores, app, router, stopReady } = await boot('settings');
    const settings = stores.useSettingsStore();
    settings.draftSettings!.gameSession.restorePreviousSession = false;
    await settings.applySettings();
    stores.useUiStateStore().setActiveRoute('/settings/appearance');
    await stores.useUiStateStore().saveGameSession();
    stopReady();
    app.unmount();
    router.options.history.destroy();
    forgetRunning();
    vi.resetModules();
    const restarted = await boot('settings');
    expect(restarted.router.currentRoute.value.path).toBe('/home');
    expect(restarted.games.listGames()).toHaveLength(0);
  });
});
