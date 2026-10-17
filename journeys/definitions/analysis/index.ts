import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createAnalysisGames } from './data/AnalysisWorkspace';
export function create() {
  return createWorkspace(createAnalysisGames());
}
