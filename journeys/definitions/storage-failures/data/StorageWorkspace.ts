import { createGame } from '../../../builders/GameFixtureBuilder';
import { createSettings } from '../../../builders/SettingsFixtureBuilder';
import { saveFile } from '../../../builders/SaveFixtureBuilder';
import { createWorkspace } from '../../../builders/WorkspaceFixtureBuilder';

export function createStorageWorkspace() {
  const opening = createGame('io-game', 'Storage game', ['e2e4', 'e7e5']);
  const current = createGame('io-game', 'Storage game', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  const other = createGame('io-other', 'Other storage game', ['d2d4', 'd7d5']);
  const settings = createSettings();
  settings.gameSession.autosaveAfterMoveCount = 3;
  return createWorkspace([current, other], { settings, files: [saveFile(opening, 'Opening'), saveFile(current, 'Current'), saveFile(other, 'Other')] });
}
