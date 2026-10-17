import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createClockGames } from './data/ClockWorkspace';
export function create(now: number) {
  return createWorkspace(createClockGames(now));
}
