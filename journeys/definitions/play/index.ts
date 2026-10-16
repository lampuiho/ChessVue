import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createPlayGames } from './data/PlayWorkspace';
export function create() {
  return createWorkspace(createPlayGames());
}
