import { BoardOrientation, ThemeMode } from '@/contracts';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { createSettings } from '../../../builders/SettingsFixtureBuilder';
export function createSettingsWorkspace() {
  const settings = createSettings();
  settings.appearance.themeMode = ThemeMode.Dark;
  settings.appearance.boardOrientation = BoardOrientation.Black;
  settings.gameSession.autosaveAfterMoveCount = 3;
  return { game: createGame('settings-game', 'Return from settings', ['e2e4', 'e7e5']), settings };
}
