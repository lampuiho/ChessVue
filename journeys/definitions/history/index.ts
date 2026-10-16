import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createHistoryGames } from './data/HistoryWorkspace';
export function create() {
  return createWorkspace(createHistoryGames());
}
