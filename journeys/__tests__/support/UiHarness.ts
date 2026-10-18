import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { PlayerColour, PlayerType, TimeControlPreset, type IGame } from '@/contracts';
import type { startJourney } from '../../StartJourney';
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
export async function boot(name: string, variant?: string) {
  window.history.replaceState(null, '', variant ? '/home?variant=' + encodeURIComponent(variant) : '/home');
  const { startJourney } = await import('../../StartJourney');
  running = await startJourney({ name, id: 'ui-follow-up-test' });
  await vi.waitFor(() => expect(running?.api.ready).toBe(true), { timeout: 5000 });
  const [stores, domain, rules, fixtures] = await Promise.all([
    import('@/state'), import('@/domain'), import('@/utility/chess'), import('../../builders/HistoryFixtureBuilder'),
  ]);
  return { ...running, stores, domain, rules, fixtures };
}
export async function createTimedContext() {
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
export function legalMove(context: Awaited<ReturnType<typeof boot>>, game: IGame, uci: string) {
  const position = context.fixtures.getPosition(game, game.renderedPath);
  const raw = context.rules.genLegalMoves(position).find((move) => context.rules.getUci(move) === uci);
  if (!raw) throw new Error('Illegal regression move: ' + uci);
  return context.rules.toDetailedMove(position, raw);
}
export function findButton(label: string, selector = 'button'): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>(selector)].find((button) => button.textContent?.includes(label));
}
export async function clickButton(label: string, selector = 'button'): Promise<void> {
  const button = findButton(label, selector);
  if (!button) throw new Error('Missing regression control: ' + label);
  button.click();
  await flushPromises();
}
export function setField(selector: string, value: string | boolean): void {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  if (!field) throw new Error('Missing regression field: ' + selector);
  if (typeof value === 'boolean') (field as HTMLInputElement).checked = value;
  else field.value = value;
  field.dispatchEvent(new Event(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
export async function clickSquare(square: string): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>(`.board-square[aria-label^="${square}"]`);
  if (!button) throw new Error('Missing square: ' + square);
  button.click();
  await flushPromises();
}
export function forgetRunning(): void { running = undefined; }
