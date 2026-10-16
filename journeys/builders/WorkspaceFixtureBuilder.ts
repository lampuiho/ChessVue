import type { IGame, IGameSessionSnapshot, ISettingsSnapshot, IUiLayoutState } from '@/contracts';
import { SerializationService } from '@/domain/SerializationService';
import type { IJourneyFile, IJourneySeed } from '../Journey';
import { createSettings } from './SettingsFixtureBuilder';
import { saveFile } from './SaveFixtureBuilder';

export interface IWorkspaceOptions {
  route?: IGameSessionSnapshot['activeRoute'];
  openGameIds?: string[];
  settings?: ISettingsSnapshot;
  layout?: Partial<IUiLayoutState>;
  files?: IJourneyFile[];
}
export function createWorkspace(games: IGame[], options: IWorkspaceOptions = {}): IJourneySeed {
  const gameIds = games.map((game) => game.metadata.id);
  const openGameIds = options.openGameIds ?? gameIds;
  const activeRoute = options.route ?? (openGameIds[0] ? `/game/${openGameIds[0]}` : '/home');
  const session: IGameSessionSnapshot = { schemaVersion: 1, openGameIds, activeGameId: openGameIds[0], activeRoute };
  const layout: IUiLayoutState = { schemaVersion: 1, showHistoryPanel: true, showAnalysisPanel: true, historyCollapsed: false, analysisCollapsed: false, analysisEngineExpandedByIndex: [true, true], ...options.layout };
  const files: IJourneyFile[] = [
    { path: 'settings.json', raw: SerializationService.serialiseSettings(options.settings ?? createSettings()) },
    { path: 'game-session.json', raw: SerializationService.serialiseGameSession(session) },
    { path: 'layout-state.json', raw: SerializationService.serialiseUiLayoutState(layout) },
    ...games.map((game) => saveFile(game)),
  ];
  for (const file of options.files ?? []) {
    const existingIndex = files.findIndex((existing) => existing.path === file.path);
    if (existingIndex >= 0) files.splice(existingIndex, 1);
    files.push(file);
  }
  return { files, gameIds, activeRoute };
}
