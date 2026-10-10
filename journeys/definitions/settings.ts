import { BoardOrientation, ThemeMode } from '@/contracts';
import { createGame, createSettings, createWorkspace } from '../FixtureFactory';
export function create() {
  const settings = createSettings();
  settings.appearance.themeMode = ThemeMode.Dark;
  settings.appearance.boardOrientation = BoardOrientation.Black;
  settings.gameSession.autosaveAfterMoveCount = 3;
  return createWorkspace([createGame('settings-game', 'Return from settings', ['e2e4', 'e7e5'])], { route: '/settings/engines', settings });
}
