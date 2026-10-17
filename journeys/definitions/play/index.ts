import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createPlayGames } from './data/PlayWorkspace';
import { createSmotheredMate } from './data/SmotheredMate';
import { saveFile } from '../../builders/SaveFixtureBuilder';
export function create() {
  const puzzle = saveFile(createSmotheredMate());
  return createWorkspace(createPlayGames(), { files: [{ ...puzzle, path: 'imports/smothered-mate.json' }] });
}
