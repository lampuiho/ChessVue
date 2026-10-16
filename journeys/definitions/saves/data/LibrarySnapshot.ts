import { createGame } from '../../../builders/GameFixtureBuilder';

export function createLibraryOpening() {
  return createGame('save-library', 'Library opening', ['e2e4', 'e7e5']);
}
export function createLibraryMiddlegame() {
  return createGame('save-library', 'Library middlegame', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
}
export function createOtherGame() {
  return createGame('save-other', 'Second saved game', ['d2d4', 'd7d5']);
}
