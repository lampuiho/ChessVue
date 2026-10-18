import { test, expect } from './SaveTest';
import { workspaceKinds } from '../../../journeys/definitions/saves/data/WorkspaceSnapshot';
import { openJourney } from '../../support/JourneyBootstrap';
import { readGame } from '../../support/SaveInspection';
import { saveCurrentGame } from '../../support/GameSave';
import { expectCanonical, reloadSaved } from './SaveAction';
import { exerciseWorkspace } from './WorkspaceAction';
for (const kind of workspaceKinds) {
  test(`JRN-SAVE-15 restores ${kind} workspace and reconstructs usable runtime state`, async ({ page }) => {
    await openJourney(page, 'saves');
    const expected = await readGame(page, `imports/${kind}.json`);
    await page.evaluate((path) => window.chessVueJourney.chooseImport(path), `imports/${kind}.json`);
    await page.getByRole('button', { name: 'Import file', exact: true }).click();
    await expect(page).toHaveURL(/\/game\/(?!save-library$).+/);
    const saved = await saveCurrentGame(page, 'Workspace');
    expectCanonical(saved, expected);
    await reloadSaved(page, `saves/${saved.metadata.id}/Workspace.json`);
    const restored = await saveCurrentGame(page, 'Restored');
    expectCanonical(restored, saved);
    await exerciseWorkspace(page, kind, expected.renderedPath.length);
  });
}
