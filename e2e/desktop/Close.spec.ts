import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from './DesktopTest';
import { createLocalGame, diskGame, playOpening, saveNamed, setClosePolicy } from './DesktopAction';
import { desktopClosePolicies } from '../../journeys/definitions/desktop/data/DesktopScenario';

for (const enabled of desktopClosePolicies) {
  test(`JRN-DESKTOP-05 awaits native close checkpoints with autosave ${enabled ? 'enabled' : 'disabled'}`, async ({ desktop }) => {
    const page = desktop.page;
    const id = await createLocalGame(page);
    await setClosePolicy(page, enabled);
    await saveNamed(page, 'Before move');
    const namedPath = resolve(desktop.directory, 'saves', id, 'Before move.json');
    const named = await readFile(namedPath, 'utf8');
    const before = await diskGame(desktop.directory, id);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await playOpening(page);
    expect(await diskGame(desktop.directory, id)).toEqual(before);
    await desktop.close();
    const persisted = await diskGame(desktop.directory, id);
    if (enabled) expect(persisted?.livePath).toEqual([0]);
    else expect(persisted).toEqual(before);
    expect(await readFile(namedPath, 'utf8')).toBe(named);
    await desktop.start();
    if (enabled) {
      await expect(desktop.page).toHaveURL(new RegExp('/game/' + id + '$'));
      await expect(desktop.page.locator('.history-row')).toHaveCount(1);
    } else {
      await expect(desktop.page).toHaveURL(/\/home$/);
      await desktop.page.getByRole('button', { name: /^Load game/ }).click();
      await desktop.page.getByRole('button', { name: 'Select game', exact: true }).click();
      await desktop.page.getByRole('button', { name: 'Load selected', exact: true }).click();
      await expect(desktop.page.locator('.history-row')).toHaveCount(0);
    }
  });
}
