import { test, expect } from './SettingsTest';
import { openJourney, waitForJourney } from '../../support/JourneyBootstrap';
import { readFile, readGame } from '../../support/SaveInspection';
import { playMove } from '../../support/BoardInteraction';
import { openCustomGame, createWorkspace, setCustomClock } from '../../support/GameCreation';
import { acceptedSettings, applySettings, openSettings, returnToGame, setSettingToggle, settingToggle } from './SettingsAction';
for (const interval of [0, 2]) {
  test(`JRN-SETTINGS-11 uses the new save namespace with autosave interval ${interval}`, async ({ page }) => {
    await openJourney(page, 'settings');
    const oldPath = 'saves/settings-game/auto.json';
    const original = await readFile(page, oldPath);
    await page.getByRole('button', { name: 'Session', exact: true }).click();
    await page.getByLabel('Save folder').fill('new-saves');
    await page.getByLabel('Autosave interval').fill(String(interval));
    await applySettings(page);
    await returnToGame(page);
    const path = 'new-saves/settings-game/auto.json';
    await playMove(page, 'g1', 'f3');
    expect(await readFile(page, path)).toBeUndefined();
    await playMove(page, 'b8', 'c6');
    if (interval) await expect.poll(async () => (await readGame(page, path)).livePath?.length).toBe(4);
    else expect(await readFile(page, path)).toBeUndefined();
    expect(await readFile(page, oldPath)).toBe(original);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByLabel('Save name').fill('New namespace');
    await page.getByRole('button', { name: 'Save game', exact: true }).click();
    await expect(page.locator('.library-feedback')).toContainText('Saved');
    expect((await readGame(page, 'new-saves/settings-game/New namespace.json')).livePath).toHaveLength(4);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await waitForJourney(page);
    await expect(page.locator('.history-row')).toHaveCount(4);
    expect((await acceptedSettings(page)).gameSession).toMatchObject({ saveRootPath: 'new-saves', autosaveAfterMoveCount: interval });
    expect(await readFile(page, oldPath)).toBe(original);
  });
}
for (const close of [false, true]) {
  test(`JRN-SETTINGS-11 persists restore disabled and save on close ${close}`, async ({ page }) => {
    await openJourney(page, 'settings');
    await page.getByRole('button', { name: 'Session', exact: true }).click();
    await setSettingToggle(page, 'Previous session', false);
    await setSettingToggle(page, 'Save on close', close);
    await page.getByLabel('Autosave interval').fill('0');
    await applySettings(page);
    await returnToGame(page);
    const path = 'saves/settings-game/auto.json';
    const original = await readFile(page, path);
    await playMove(page, 'g1', 'f3');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    if (close) await expect.poll(async () => (await readGame(page, path)).livePath?.length).toBe(3);
    else expect(await readFile(page, path)).toBe(original);
    await page.reload();
    await waitForJourney(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('navigation', { name: 'Open games', exact: true })).toHaveCount(0);
    expect((await acceptedSettings(page)).gameSession).toMatchObject({ restorePreviousSession: false, autosaveOnClose: close, autosaveAfterMoveCount: 0 });
    await page.getByRole('button', { name: /Load game/ }).click();
    await expect(page.getByText('Return from settings', { exact: true }).first()).toBeVisible();
  });
}
test('JRN-SETTINGS-11 enabling restore requires close autosave and restores the workspace', async ({ page }) => {
  await openJourney(page, 'settings');
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await setSettingToggle(page, 'Previous session', false);
  await setSettingToggle(page, 'Save on close', false);
  await applySettings(page);
  await setSettingToggle(page, 'Previous session', true);
  await expect(settingToggle(page, 'Save on close')).toBeDisabled();
  await applySettings(page);
  await expect(settingToggle(page, 'Save on close')).toBeChecked();
  expect((await acceptedSettings(page)).gameSession).toMatchObject({ restorePreviousSession: true, autosaveOnClose: true });
  await returnToGame(page);
  await page.reload();
  await waitForJourney(page);
  await expect(page).toHaveURL(/\/game\/settings-game$/);
  await expect(page.locator('.history-row')).toHaveCount(2);
});
for (const pause of [false, true]) {
  test(`JRN-SETTINGS-11 applies auto-pause ${pause} to the next menu interruption`, async ({ page }) => {
    const time = new Date('2026-10-18T12:00:00Z');
    await page.clock.install({ time });
    await page.clock.setFixedTime(time);
    await openJourney(page, 'settings');
    await page.getByRole('button', { name: 'Session', exact: true }).click();
    await setSettingToggle(page, 'Auto-pause on menu', pause);
    if (!pause) await applySettings(page);
    await returnToGame(page);
    const custom = await openCustomGame(page);
    await setCustomClock(custom, '5', '0');
    await createWorkspace(page);
    const white = page.locator('.player-panel').filter({ has: page.locator('.player-avatar--white') }).locator('.player-clock');
    await expect(white).toHaveText('5:00');
    await openSettings(page, 'Session');
    await page.clock.setFixedTime(new Date(time.getTime() + 5000));
    await page.clock.runFor(250);
    await page.getByRole('button', { name: 'Back to game', exact: true }).click();
    await expect(page).toHaveURL(/\/game\//);
    await expect(white).toHaveText(pause ? '5:00' : '4:55');
    await expect(white).toHaveClass(/player-clock--running/);
  });
}
