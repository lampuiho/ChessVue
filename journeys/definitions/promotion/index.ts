import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createPromotionGames } from './data/PromotionWorkspace';
export function create() {
  return createWorkspace(createPromotionGames());
}
