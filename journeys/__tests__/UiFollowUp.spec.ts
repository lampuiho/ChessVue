import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModalKind, GameState, PauseReason, PlayerColour, PlayerType, ResultReason, ResultState, SaveGameTargetKind, TimeControlPreset, type IEnginePlayer, type IGame } from '@/contracts';
import type { startJourney } from '../StartJourney';
// These regressions assert the required application behaviour.
let running: Awaited<ReturnType<typeof startJourney>> | undefined;
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(async () => {
  if (running) {
    running.stopReady();
    for (const game of running.games.listGames()) {
      await running.games.stopAnalysis(game as unknown as IGame);
      game.$?.focusReturnUnsubscribe?.();
    }
    running.app.unmount();
    running.router.options.history.destroy();
  }
  running = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function boot(name: string) {
  window.history.replaceState({}, '', '/home');
  const { startJourney } = await import('../StartJourney');
  running = await startJourney({ name, id: 'ui-follow-up-test' });
  await vi.waitFor(() => expect(running?.api.ready).toBe(true));
  const [stores, domain, rules, fixtures] = await Promise.all([
    import('@/state'), import('@/domain'), import('@/utility/chess'), import('../FixtureFactory'),
  ]);
  return { ...running, stores, domain, rules, fixtures };
}
async function createTimedContext() {
  // Install Date before boot so timestamp subclasses inherit the controlled clock.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date('2026-10-10T12:00:00.000Z'));
  const context = await boot('fresh');
  const game = await context.games.createGame({
    name: 'UI follow-up timed game',
    whitePlayer: { colour: PlayerColour.White, type: PlayerType.Local, displayName: 'White' },
    blackPlayer: { colour: PlayerColour.Black, type: PlayerType.Local, displayName: 'Black' },
    analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: true,
    timeControl: { preset: TimeControlPreset.Blitz, initialMs: 3000, incrementMs: 0 },
  });
  context.stores.useUiStateStore().openTab(game.metadata.id);
  await context.router.push('/game/' + game.metadata.id);
  await flushPromises();
  return { ...context, game };
}
function legalMove(context: Awaited<ReturnType<typeof boot>>, game: IGame, uci: string) {
  const position = context.fixtures.getPosition(game, game.renderedPath);
  const raw = context.rules.genLegalMoves(position).find((move) => context.rules.getUci(move) === uci);
  if (!raw) throw new Error('Illegal regression move: ' + uci);
  return context.rules.toDetailedMove(position, raw);
}
function findButton(label: string, selector = 'button'): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)].find((button) => button.textContent?.includes(label));
}
async function clickButton(label: string, selector = 'button'): Promise<void> {
  const button = findButton(label, selector);
  if (!button) throw new Error('Missing regression control: ' + label);
  button.click();
  await flushPromises();
}
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
describe('UI-04 copied engine seat preservation', () => {
  it.each(['unchanged', 'edited', 'renamed', 'deleted'])('keeps the seated engine when confirming without a new selection after its profile is %s', async (change) => {
    const context = await boot('settings');
    const { games, stores, domain, router } = context;
    const game = games.getGame('settings-game') as unknown as IGame;
    const profile = context.fixtures.engineProfiles[0]!;
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
    const ui = stores.useUiStateStore();
    ui.showModal({ kind: AppModalKind.PlayerSelection, payload: { gameId: game.metadata.id, colour: PlayerColour.Black, currentPlayerType: PlayerType.Engine, currentAssignedEngine: seated.assignedEngine } });
    await nextTick();
    await clickButton('Assign player', '[role="dialog"] button');
    expect(ui.modalState).toBeUndefined();
    expect(game.blackPlayer?.type).toBe(PlayerType.Engine);
    expect((game.blackPlayer as IEnginePlayer).assignedEngine).toMatchObject(snapshot);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
    expect(game.livePath).toEqual([0, 0]);
    expect(game.$?.pendingPlayerTurnPromise).toBe(pendingTurn);
    expect(stopEngine).not.toHaveBeenCalled();
  });
});
describe('UI-06 timeout handling after takeback', () => {
  it('adjudicates another timeout after reopening the same game with takeback', async () => {
    const context = await createTimedContext();
    const { game, games, stores } = context;
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    await vi.advanceTimersByTimeAsync(3250);
    expect(game.resultState).toBe(ResultState.WhiteWon);
    expect(game.resultReason).toBe(ResultReason.Timeout);
    const ui = stores.useUiStateStore();
    expect(ui.modalState?.kind).toBe(AppModalKind.Timeout);
    await clickButton('Review game', '[role="dialog"] button');
    await games.takeBack(game);
    expect(game.resultState).toBe(ResultState.Ongoing);
    expect(game.livePath).toEqual([]);
    expect(game.clockSnapshot.white.isRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(3250);
    expect.soft(game.resultState).toBe(ResultState.BlackWon);
    expect.soft(game.resultReason).toBe(ResultReason.Timeout);
    expect.soft(ui.modalState?.kind).toBe(AppModalKind.Timeout);
  });
});
describe('UI-08 managed and imported game identity', () => {
  it.each(['selected', 'latest', 'recent'])('uses the enumerated group identity for a %s load and its next save', async (selection) => {
    const { api, games, stores, domain, fixtures } = await boot('saves');
    const source = fixtures.createGame('save-other', 'Mismatched document identity', ['c2c4']);
    const { $: _runtime, ...rootPosition } = source.rootPosition;
    await domain.SerializationService.writeGameDocument('saves/follow-up-managed/Chosen.json', source, true);
    const recent = await stores.useRecentGameStore().getRecentGames();
    expect(recent.some((entry) => entry.gameId === 'follow-up-managed')).toBe(true);
    const saved = stores.useSavedGamesStore();
    const game = selection === 'recent' ? await saved.loadRecentGame('follow-up-managed')
      : await saved.loadGame('follow-up-managed', selection === 'selected' ? 'Chosen' : undefined);
    const otherSave = api.readFile('saves/save-other/auto.json');
    const inserted = await games.insertGame(game);
    const target = await saved.saveGame(inserted, { targetKind: SaveGameTargetKind.Autosave, overwrite: true });
    expect.soft(inserted.metadata.id).toBe('follow-up-managed');
    expect.soft(target).toBe('saves/follow-up-managed/auto.json');
    expect.soft(api.readFile('saves/save-other/auto.json')).toBe(otherSave);
    expect(inserted.metadata.name).toBe(source.metadata.name);
    expect(inserted.rootPosition).toMatchObject(rootPosition);
  });
  it('allocates a fresh import identity before workspace insertion even without a collision', async () => {
    const { api, games, stores } = await boot('saves');
    api.chooseImport('imports/valid.json');
    const game = await stores.useSavedGamesStore().importGame();
    expect(game).toBeDefined();
    expect(games.getGame('import-external')).toBeUndefined();
    expect(game!.metadata.id).not.toBe('import-external');
    expect(game!.metadata.name).toBe('External imported game');
  });
  it('already repairs a colliding identity when inserting another workspace', async () => {
    const { games, stores } = await boot('saves');
    const existing = games.getGame('save-library');
    const loaded = await stores.useSavedGamesStore().loadGame('save-library', 'Opening');
    const inserted = await games.insertGame(loaded);
    expect(inserted.metadata.id).not.toBe('save-library');
    expect(games.getGame('save-library')).toBe(existing);
    expect(games.getGame(inserted.metadata.id)).toBe(inserted);
    const ids = games.listGames().map((game) => game.metadata.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
function setField(selector: string, value: string | boolean): void {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  if (!field) throw new Error('Missing regression field: ' + selector);
  if (typeof value === 'boolean') (field as HTMLInputElement).checked = value;
  else field.value = value;
  field.dispatchEvent(new Event(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
async function clickSquare(square: string): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(`.board-square[aria-label^="${square}"]`);
  if (!button) throw new Error('Missing square: ' + square);
  button.click();
  await flushPromises();
}
describe('UI-01 and UI-16 immediate board and history feedback', () => {
  it('cancels repeated source selection and updates moves, branches and takeback immediately', async () => {
    const { game, games } = await createTimedContext();
    await clickSquare('e2');
    expect(document.querySelectorAll('.board-square--target').length).toBeGreaterThan(0);
    await clickSquare('e2');
    expect(document.querySelector('.board-square--selected')).toBeNull();
    expect(document.querySelector('.board-square--target')).toBeNull();
    await clickSquare('e2');
    await clickSquare('e4');
    expect(document.querySelectorAll('.history-row')).toHaveLength(1);
    await games.enterInGameAnalysis(game);
    await clickSquare('e7');
    await clickSquare('e5');
    expect(document.querySelectorAll('.history-row')).toHaveLength(2);
    games.exitInGameAnalysis(game);
    await games.takeBack(game);
    await nextTick();
    expect(document.querySelectorAll('.history-row')).toHaveLength(0);
  });
});
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
describe('UI-04 reactive engine inventory', () => {
  it('refreshes assignment choices after applied profile edits', async () => {
    const { stores } = await boot('settings');
    const ui = stores.useUiStateStore();
    ui.showModal({ kind: AppModalKind.NewGame });
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
describe('UI-06 consecutive timed tabs', () => {
  it('shows another timeout after changing the selected game in the mounted view', async () => {
    const { game, games, stores, router } = await createTimedContext();
    await vi.advanceTimersByTimeAsync(3250);
    expect(game.resultReason).toBe(ResultReason.Timeout);
    await clickButton('Review game', '[role="dialog"] button');
    const second = await games.createGame({ name: 'Second timed tab', whitePlayer: game.whitePlayer, blackPlayer: game.blackPlayer, timeControl: { ...game.timeControl }, analysisEngineProfiles: [], allowTakeback: true, showLiveAnalysisMoves: false });
    stores.useUiStateStore().openTab(second.metadata.id);
    await router.push('/game/' + second.metadata.id);
    await vi.advanceTimersByTimeAsync(3250);
    expect(second.resultReason).toBe(ResultReason.Timeout);
    expect(stores.useUiStateStore().modalState).toMatchObject({ kind: AppModalKind.Timeout, payload: { gameId: second.metadata.id } });
  });
});
describe('UI-07 move-count autosave', () => {
  it('writes each configured interval and overwrites the previous autosave', async () => {
    const context = await createTimedContext();
    const { games, game, stores, api } = context;
    const settings = stores.useSettingsStore();
    settings.draftSettings!.gameSession.autosaveAfterMoveCount = 2;
    await settings.applySettings();
    const path = 'saves/' + game.metadata.id + '/auto.json';
    await games.makeMove(game, legalMove(context, game, 'e2e4'));
    expect(api.readFile(path)).toBeUndefined();
    await games.makeMove(game, legalMove(context, game, 'e7e5'));
    await vi.waitFor(() => expect(JSON.parse(api.readFile(path)!).renderedPath).toHaveLength(2));
    await games.makeMove(game, legalMove(context, game, 'g1f3'));
    await games.makeMove(game, legalMove(context, game, 'b8c6'));
    await vi.waitFor(() => expect(JSON.parse(api.readFile(path)!).renderedPath).toHaveLength(4));
    expect(games.autosaveError).toBe('');
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
describe('UI-10 and UI-17 setup controls', () => {
  it('locks player/history actions in board edit and starts with validated options from the edited board', async () => {
    const { games, router } = await boot('setup');
    await clickButton('Edit board', '.control-button');
    expect([...document.querySelectorAll<HTMLButtonElement>('.history-row')].every((button) => button.disabled)).toBe(true);
    const game = games.getGame('setup-board') as unknown as IGame;
    await router.push('/game/setup-board');
    await flushPromises();
    expect([...document.querySelectorAll<HTMLButtonElement>('.player-name')].every((button) => button.disabled)).toBe(true);
    expect(() => games.navigateToNode(game, game.moveTree.root)).toThrow('editing');
    await clickButton('Finish editing', '.control-button');
    const board = JSON.stringify(game.rootPosition.board);
    await clickButton('Start game', '.control-button');
    setField('#time-preset', 'custom');
    await nextTick();
    setField('input[type="number"]', '9');
    setField('.time-fields label:nth-child(2) input', '2');
    setField('.toggle-row input', false);
    setField('.toggle-row:nth-of-type(2) input', true);
    await nextTick();
    document.querySelector<HTMLFormElement>('#new-game-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(JSON.stringify(game.rootPosition.board)).toBe(board);
    expect(game.timeControl).toEqual({ initialMs: 540000, incrementMs: 2000 });
    expect(game.gameplayOptions).toEqual({ allowTakeback: false, showLiveAnalysisMoves: true });
    expect(game.livePath).toEqual([]);
    expect(game.gameState).toBe(GameState.LiveWhiteTurn);
  });
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
    expect(router.currentRoute.value.path).toMatch(/^\/game\//);
    const loaded = games.getGame(String(router.currentRoute.value.params.id));
    expect(loaded?.metadata.name).toBe('Library opening');
    expect(loaded?.renderedPath).toHaveLength(2);
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
    running = undefined;
    vi.resetModules();
    const restarted = await boot('settings');
    expect(restarted.router.currentRoute.value.path).toBe('/home');
    expect(restarted.games.listGames()).toHaveLength(0);
  });
});
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
    expect(router.currentRoute.value.path).toBe('/saved-games/load');
    expect(stores.useSettingsStore().hasPendingChanges).toBe(false);
  });
});
