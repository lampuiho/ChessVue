import { createLibraryOpening, createLibraryMiddlegame, createOtherGame } from './data/LibrarySnapshot';
import { createImportFiles } from './data/ImportFile';
import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { fixtureTimestamp } from '../../data/FixtureTimestamp';
import { saveFile } from '../../builders/SaveFixtureBuilder';
import { createWorkspaceSnapshots, workspaceKinds } from './data/WorkspaceSnapshot';
import { SerializationService } from '@/domain/SerializationService';
export function create() {
  const early = createLibraryOpening();
  const later = createLibraryMiddlegame();
  const other = createOtherGame();
  const baseTime = Date.parse(fixtureTimestamp);
  return createWorkspace([later, other], {
    route: '/saved-games/load/save-library', openGameIds: ['save-library'],
    files: [
      saveFile(early, 'Opening', baseTime - 2000), saveFile(later, 'Middlegame', baseTime + 2000), saveFile(other, 'Named save'),
      { path: 'saves/save-other/Mismatched.json', raw: SerializationService.serialiseGame(early), modifiedAt: baseTime - 3000 },
      ...createImportFiles(early),
      ...createWorkspaceSnapshots().map((game, index) => ({ path: `imports/${workspaceKinds[index]}.json`, raw: SerializationService.serialiseGame(game) })),
    ],
  });
}
