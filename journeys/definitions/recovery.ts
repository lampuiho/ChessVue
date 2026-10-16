import { createGame } from '../builders/GameFixtureBuilder';
import { createWorkspace } from '../builders/WorkspaceFixtureBuilder';
export function create() {
  return createWorkspace([createGame('recovery-valid', 'Recoverable valid game', ['e2e4'])], {
    openGameIds: ['recovery-missing', 'recovery-broken', 'recovery-valid'], route: '/game/recovery-missing',
    files: [
      { path: 'settings.json', raw: '{ corrupt settings' }, { path: 'layout-state.json', raw: '{ corrupt layout' },
      { path: 'saves/recovery-broken/auto.json', raw: '{"schemaVersion":99}' },
    ],
  });
}
