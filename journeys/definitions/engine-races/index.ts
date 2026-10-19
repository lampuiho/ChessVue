import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createRaceGames } from './data/RaceWorkspace';
export function create(now: number, variant?: string) { return createWorkspace(createRaceGames(now, variant)); }
