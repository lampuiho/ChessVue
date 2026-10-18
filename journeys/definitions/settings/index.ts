import { createWorkspace } from '../../builders/WorkspaceFixtureBuilder';
import { createSettingsWorkspace } from './data/SettingsWorkspace';
export function create() {
  const { game, settings } = createSettingsWorkspace();
  return createWorkspace([game], { route: '/settings/engines', settings });
}
