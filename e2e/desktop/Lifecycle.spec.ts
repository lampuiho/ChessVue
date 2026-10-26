import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { resolve } from 'node:path';
import { test, expect } from './DesktopTest';
import { createNativeAnalysis, engineSection, expectAnalysis } from './EngineAction';
import { nativeProcesses, processExists } from './NativeInspection';
import { createLocalGame, operator, setToggle } from './DesktopAction';
import { expectTheme } from '../support/Appearance';

test('JRN-DESKTOP-07 stops searches removes owned processes and drains remaining processes on exit', async ({ desktop }, testInfo) => {
  test.skip(!process.env.CHESSVUE_UCI_EXECUTABLE, 'Set CHESSVUE_UCI_EXECUTABLE to a real native UCI engine.');
  const page = desktop.page;
  await createNativeAnalysis(page, testInfo);
  const initial = await nativeProcesses(page);
  const first = initial.find(engine => engine.name === 'Native A')!;
  const other = initial.find(engine => engine.name === 'Native B')!;
  await engineSection(page, 'Native A').getByRole('button', { name: 'Stop engine', exact: true }).click();
  await expect(engineSection(page, 'Native A').locator('.engine-section__status--running')).toHaveCount(0);
  expect(processExists(first.pid!)).toBe(true);
  expect(processExists(other.pid!)).toBe(true);
  await expectAnalysis(page, ['Native B']);
  await engineSection(page, 'Native A').getByRole('button', { name: 'Remove engine', exact: true }).click();
  await expect(page.locator('.engine-section')).toHaveCount(1);
  await expect.poll(() => processExists(first.pid!)).toBe(false);
  expect(processExists(other.pid!)).toBe(true);
  await desktop.close();
  await expect.poll(() => processExists(other.pid!)).toBe(false);
});

const _physicalTest = process.env.CHESSVUE_DESKTOP_INTERACTIVE === '1' ? test : test.skip;
_physicalTest('JRN-DESKTOP-07 reconciles native focus and physical OS theme without persisting host changes', async ({ desktop }) => {
  const page = desktop.page;
  await createLocalGame(page, true);
  const settingsPath = resolve(desktop.directory, 'settings.json');
  const accepted = await _prepareSystemTheme(page, settingsPath);
  const before = await page.locator('.player-clock--running').innerText();
  await page.evaluate(() => {
    const host = globalThis as unknown as import('./NativeInspection').INativeHost;
    const events: string[] = [];
    const record = () => { events.push('focus'); };
    Object.assign(window, { nativeFocusEvidence: { events, record } });
    host.nw.Window.get().on('focus', record);
  });
  try {
    operator('Switch to another application for at least three seconds, then return to ChessVue.');
    await expect.poll(() => page.evaluate(() => (window as unknown as { nativeFocusEvidence: { events: string[] } }).nativeFocusEvidence.events.length), { timeout: 180000 }).toBeGreaterThan(0);
    await expect(page.locator('.player-clock--running')).not.toHaveText(before);
    await _expectPhysicalTheme(page, settingsPath, accepted);
  } finally {
    if (!page.isClosed()) await page.evaluate(() => {
      const host = globalThis as unknown as import('./NativeInspection').INativeHost;
      const evidence = (window as unknown as { nativeFocusEvidence: { record: () => void } }).nativeFocusEvidence;
      host.nw.Window.get().removeListener('focus', evidence.record);
      Reflect.deleteProperty(window, 'nativeFocusEvidence');
    });
  }
});
async function _prepareSystemTheme(page: Page, settingsPath: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await _applyTheme(page, 'light');
  await _applyTheme(page, 'system');
  const accepted = await readFile(settingsPath, 'utf8');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  return accepted;
}
async function _expectPhysicalTheme(page: Page, settingsPath: string, accepted: string) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  for (const theme of ['light', 'dark'] as const) {
    operator(`Set your operating system appearance to ${theme}. Return to ChessVue.`);
    await expect.poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), { timeout: 180000 }).toBe(theme === 'dark');
    await expectTheme(page, theme);
  }
  expect(await readFile(settingsPath, 'utf8')).toBe(accepted);
  await _applyTheme(page, 'light');
  await expectTheme(page, 'light');
  await setToggle(page.getByRole('radio', { name: 'system', exact: true }), true);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/game\/.+/);
  operator('Restore your original OS appearance before finishing this interactive run.');
}
async function _applyTheme(page: Page, theme: 'light' | 'system') {
  await setToggle(page.getByRole('radio', { name: theme, exact: true }), true);
  const apply = page.getByRole('button', { name: 'Apply changes', exact: true });
  await apply.click({ timeout: 15000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme-mode', theme);
  await expect(apply).toBeDisabled();
}
