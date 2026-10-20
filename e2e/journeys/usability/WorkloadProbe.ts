import type { Page } from '@playwright/test';
declare global {
  interface Window { chessVueUxProbe: { listeners(): Record<string, number> } }
}
export async function installWorkloadProbe(page: Page) {
  await page.addInitScript(() => {
    const registrations: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; capture: boolean }[] = [];
    const types = new Set(['focusin', 'focus', 'blur', 'visibilitychange', 'pagehide', 'beforeunload', 'keydown', 'storage']);
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
      if (listener && (this === window || this === document) && types.has(type)
        && !registrations.some((entry) => entry.target === this && entry.type === type && entry.listener === listener && entry.capture === capture)) {
        registrations.push({ target: this, type, listener, capture });
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
      const index = registrations.findIndex((entry) => entry.target === this && entry.type === type && entry.listener === listener && entry.capture === capture);
      if (index >= 0) registrations.splice(index, 1);
      return remove.call(this, type, listener, options);
    };
    window.chessVueUxProbe = { listeners: () => Object.fromEntries([...types].map((type) => [type, registrations.filter((entry) => entry.type === type).length])) };
  });
}
export async function readResources(page: Page) {
  return page.evaluate(() => ({
    listeners: window.chessVueUxProbe.listeners(),
    activeProcesses: window.chessVueJourney.engines.processes().filter((process) => !process.closed).length,
    processListeners: window.chessVueJourney.engines.processes().reduce((sum, process) => sum + process.listeners, 0),
    pendingSearches: window.chessVueJourney.engines.searches().filter((search) => search.pending).length,
    pendingTimers: window.chessVueJourney.engines.processes().filter((process) => process.pendingTimer).length,
    openGames: JSON.parse(window.chessVueJourney.readFile('game-session.json')!).openGameIds.length as number,
    tabs: document.querySelectorAll('.tab-button').length,
  }));
}
