import { createSettings } from '../../../builders/SettingsFixtureBuilder';
import { createWorkspace } from '../../../builders/WorkspaceFixtureBuilder';
export function createSessionWorkspace() {
  return createWorkspace([], { settings: createSettings(), route: '/home' });
}
