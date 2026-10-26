import { test as base, expect, chromium, type Browser, type Page, type TestInfo } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { availablePort, launchDesktop, terminateDesktop } from '../../desktop/DesktopHost.mjs';
import type { INativeHost } from './NativeInspection';

export class NativeDesktop {
  page!: Page;
  readonly directory: string;
  private _browser?: Browser;
  private _child?: ChildProcess;
  private _exited = false;
  private _launchError = '';
  private readonly _errors: string[] = [];
  private readonly _logs: string[] = [];
  constructor(private readonly _testInfo: TestInfo) { this.directory = _testInfo.outputPath('native workspace Café'); }
  async start() {
    const port = await availablePort();
    const url = process.env.CHESSVUE_DESKTOP_URL!;
    this._exited = false;
    this._child = await launchDesktop({ executable: process.env.CHESSVUE_NWJS_EXECUTABLE!, directory: this.directory, url, port, visible: process.env.CHESSVUE_DESKTOP_INTERACTIVE === '1', deferNavigation: true });
    console.log(`Native desktop browser PID ${this._child.pid}; debugging port ${port}.`);
    this._child.once('exit', () => { this._exited = true; });
    this._child.once('error', error => { this._launchError = error.message; });
    this._child.stdout?.on('data', data => this._logs.push(String(data)));
    this._child.stderr?.on('data', data => this._logs.push(String(data)));
    await this._connectDebugging(port);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await expect(this.page.locator('html')).toHaveAttribute('data-app-mode', 'true');
    await expect(this.page.locator('.app-loading')).toHaveCount(0);
    if (process.env.CHESSVUE_DESKTOP_INTERACTIVE === '1') await this.page.evaluate(() => {
      const nativeWindow = (globalThis as unknown as INativeHost).nw.Window.get();
      nativeWindow.show(); nativeWindow.focus();
    });
    await this._recordEnvironment();
  }
  async close() {
    const closed = this.page.waitForEvent('close');
    await this.page.evaluate(() => { (globalThis as unknown as INativeHost).nw.Window.get().close(); });
    await closed;
    await expect.poll(() => this._exited).toBe(true);
    expect(this._child?.exitCode, 'Normal NW.js exit').toBe(0);
    await this._browser?.close();
    this._browser = undefined;
  }
  async dispose() {
    try {
      if (this._browser && this.page && !this.page.isClosed()) {
        await this.page.screenshot({ path: this._testInfo.outputPath('desktop.png') });
        await this._browser.contexts()[0]!.tracing.stop({ path: this._testInfo.outputPath('desktop-trace.zip') });
        await this.close();
      }
    } finally {
      if (this._child) await terminateDesktop(this._child);
      await this._browser?.close();
      await this._testInfo.attach('native-log', { body: this._logs.join(''), contentType: 'text/plain' });
      expect(this._errors, 'Uncaught NW.js page errors').toEqual([]);
      expect(this._logs.join(''), 'Windows location integration stays disabled').not.toContain('system_geolocation_source_win.cc');
    }
  }
  private async _connectDebugging(port: number) {
    await expect.poll(async () => {
      if (this._launchError || this._exited) throw new Error(this._launchError || 'NW.js exited before debugging was ready.');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`);
        return response.ok;
      } catch { return false; }
    }).toBe(true);
    this._browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = this._browser.contexts()[0]!;
    await expect.poll(() => context.pages().some(page => page.url() === 'about:blank')).toBe(true);
    this.page = context.pages().find(page => page.url() === 'about:blank')!;
    await this.page.emulateMedia({ colorScheme: null });
    this.page.on('pageerror', error => this._errors.push(error.message));
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  private async _recordEnvironment() {
    const environment = await this.page.evaluate(() => {
      const host = globalThis as unknown as INativeHost;
      if (!host.process.versions.nw || typeof host.require !== 'function') throw new Error('A real NW.js host with Node access is required.');
      return { versions: host.process.versions, os: host.require('os').type(), release: host.require('os').release(), arch: host.process.arch, cwd: host.process.cwd(), journey: 'chessVueJourney' in window };
    });
    expect(environment.journey).toBe(false);
    expect(resolve(environment.cwd)).toBe(resolve(this.directory));
    await this._testInfo.attach('native-environment', { body: JSON.stringify(environment, null, 2), contentType: 'application/json' });
  }
}
export const test = base.extend<{ desktop: NativeDesktop }>({
  desktop: async ({}, use, testInfo) => {
    const desktop = new NativeDesktop(testInfo);
    try { await desktop.start(); await use(desktop); } finally { await desktop.dispose(); }
  },
});
export { expect };
