import { SerializationService } from '@/domain/SerializationService';
import { createGame, createWorkspace, fixtureTimestamp, saveFile } from '../FixtureFactory';
export function create() {
  const early = createGame('save-library', 'Library opening', ['e2e4', 'e7e5']);
  const later = createGame('save-library', 'Library middlegame', ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  const other = createGame('save-other', 'Second saved game', ['d2d4', 'd7d5']);
  const external = createGame('import-external', 'External imported game', ['c2c4', 'e7e5']);
  const valid = SerializationService.serialiseGame(external);
  const version = JSON.parse(valid);
  version.schemaVersion = 99;
  const baseTime = Date.parse(fixtureTimestamp);
  return createWorkspace([later, other], {
    route: '/saved-games/load/save-library', openGameIds: ['save-library'],
    files: [saveFile(early, 'Opening', baseTime - 2000), saveFile(later, 'Middlegame', baseTime + 2000), saveFile(other, 'Named save'),
      { path: 'imports/valid.json', raw: valid }, { path: 'imports/duplicate-id.json', raw: SerializationService.serialiseGame(early) },
      { path: 'imports/corrupt.json', raw: '{ invalid JSON' }, { path: 'imports/unsupported-version.json', raw: JSON.stringify(version) }],
  });
}
