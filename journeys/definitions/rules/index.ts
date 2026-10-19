import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createRuleGames } from './data/RuleWorkspace';
export function create(now: number, variant?: string) {
  return createWorkspace(createRuleGames(now, variant));
}
