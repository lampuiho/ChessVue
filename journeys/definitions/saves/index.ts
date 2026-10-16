import { createLibraryOpening, createLibraryMiddlegame, createOtherGame } from './data/LibrarySnapshot';
import { createImportFiles } from './data/ImportFile';
import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { fixtureTimestamp } from '../../data/FixtureTimestamp';
import { saveFile } from '../../builders/SaveFixtureBuilder';
export function create() {
  const early = createLibraryOpening();
  const later = createLibraryMiddlegame();
  const other = createOtherGame();
  const baseTime = Date.parse(fixtureTimestamp);
  return createWorkspace([later, other], {
    route: '/saved-games/load/save-library', openGameIds: ['save-library'],
    files: [saveFile(early, 'Opening', baseTime - 2000), saveFile(later, 'Middlegame', baseTime + 2000), saveFile(other, 'Named save'), ...createImportFiles(early)],
  });
}
