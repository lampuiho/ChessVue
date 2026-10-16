import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createSetupGames } from './data/SetupWorkspace';
export function create() {
  return createWorkspace(createSetupGames());
}
