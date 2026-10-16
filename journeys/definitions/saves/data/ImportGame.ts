import { createGame } from '../../../builders/GameFixtureBuilder';

export function createImportGame() {
  return createGame('import-external', 'External imported game', ['c2c4', 'e7e5']);
}
