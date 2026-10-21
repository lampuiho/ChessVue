import { BoardOrientation, GameState, PlayerColour, PlayerType, ThemeMode, TimeControlPreset, type IEnginePlayer, type IGame, type IGameSessionSnapshot } from '@/contracts';
import { setPausedClock } from '../../../builders/ClockFixtureBuilder';
import { createGame } from '../../../builders/GameFixtureBuilder';
import { createSettings } from '../../../builders/SettingsFixtureBuilder';
import { createWorkspace, type IWorkspaceOptions } from '../../../builders/WorkspaceFixtureBuilder';
import { createEngineProfiles } from '../../../data/EngineProfile';
import { AnalysisTimestamp } from '@/utility/date';
import { fixtureTimestamp } from '../../../data/FixtureTimestamp';
import { faultVariants, fallbackScenarios, restoredRoutes, runtimeVariants } from './RecoveryScenario';
const brokenGame = { path: 'saves/recovery-broken/auto.json', raw: '{"schemaVersion":99}' };
const corruptSettings = { path: 'settings.json', raw: '{ corrupt settings' };
const corruptLayout = { path: 'layout-state.json', raw: '{ corrupt layout' };
function _validGame(): IGame {
  return createGame('recovery-valid', 'Recoverable valid game', ['e2e4']);
}
function _sessionFile(openGameIds: string[], activeGameId: string | undefined, activeRoute: string) {
  return { path: 'game-session.json', raw: JSON.stringify({ schemaVersion: 1, openGameIds, activeGameId, activeRoute }) };
}
function _validOptions(): IWorkspaceOptions {
  const settings = createSettings();
  settings.appearance.themeMode = ThemeMode.Dark;
  settings.appearance.boardOrientation = BoardOrientation.Black;
  settings.gameSession.autosaveAfterMoveCount = 3;
  return { settings, layout: { historyCollapsed: true, analysisEngineExpandedByIndex: [false, true] } };
}
function _validWorkspace(route: IGameSessionSnapshot['activeRoute'], resume = true) {
  const options = _validOptions();
  options.settings!.analysis.resumeLiveAnalysisAfterRestore = resume;
  const first = _validGame();
  first.analysis.seats = createEngineProfiles().slice(0, 2).map((engine) => ({
    assignedEngine: engine, updatedAt: new AnalysisTimestamp(fixtureTimestamp), lines: [], isComplete: false,
  }));
  return createWorkspace([
    first, createGame('recovery-second', 'Second recovery game', ['d2d4', 'd7d5']),
    createGame('recovery-unopened', 'Saved but unopened game', ['c2c4']),
  ], { ...options, route, files: [_sessionFile(['recovery-second', 'recovery-valid'], 'recovery-valid', route)] });
}
function _faultWorkspace(variant: string) {
  const files = variant === 'settings' ? [{ ...corruptSettings }] : variant === 'layout' ? [{ ...corruptLayout }] : variant === 'unsupported-game' ? [{ ...brokenGame }] : [];
  const failedId = variant === 'missing-game' ? 'recovery-missing' : variant === 'unsupported-game' ? 'recovery-broken' : undefined;
  return createWorkspace([_validGame()], {
    ..._validOptions(), openGameIds: failedId ? [failedId, 'recovery-valid'] : ['recovery-valid'], files,
  });
}
function _fallbackWorkspace(variant: string) {
  const seed = _validWorkspace('/game/recovery-valid', false);
  const ids = ['recovery-second', 'recovery-valid'];
  let session = _sessionFile(ids, 'recovery-valid', '/game/recovery-valid');
  if (variant === 'no-valid-games') {
    session = _sessionFile(['recovery-missing', 'recovery-broken'], 'recovery-missing', '/game/recovery-missing');
    seed.files.push({ ...brokenGame });
  } else if (variant === 'stale-active') session = _sessionFile(['recovery-missing', 'recovery-valid'], 'recovery-missing', '/game/recovery-missing');
  else if (variant === 'unknown-game-route') session = _sessionFile(ids, 'recovery-second', '/game/unknown');
  else if (variant === 'invalid-route') session = _sessionFile(ids, 'recovery-valid', '/settings/unknown');
  else if (variant === 'nonmember-active') session = _sessionFile(ids, 'recovery-missing', '/game/recovery-valid');
  else if (variant === 'ui-only') session = _sessionFile([], undefined, '/home');
  else if (variant === 'duplicate-tabs') session = _sessionFile([...ids, ...ids], 'recovery-valid', '/game/recovery-valid');
  seed.files = seed.files.filter((file) => file.path !== session.path);
  seed.files.push(session);
  if (variant === 'ui-only') seed.files = seed.files.filter((file) => !file.path.startsWith('saves/'));
  return seed;
}
function _runtimeWorkspace(variant: string, now: number) {
  const game = variant === 'board-edit' ? createGame('recovery-valid', 'Recoverable valid game', [], { freeAnalysis: true, state: GameState.BoardEdit }) : _validGame();
  const profiles = createEngineProfiles();
  if (variant === 'unavailable-analysis' || variant === 'board-edit') game.analysis.seats = [profiles[0]!, profiles[2]!].map((engine) => ({
    assignedEngine: engine, updatedAt: new AnalysisTimestamp(fixtureTimestamp), lines: [], isComplete: false,
  }));
  else {
    const player: IEnginePlayer = {
      colour: PlayerColour.Black, type: PlayerType.Engine, displayName: variant === 'unavailable-player' ? 'Journey unavailable' : 'Journey A',
      assignedEngine: profiles[variant === 'unavailable-player' ? 2 : 0]!,
    };
    game.blackPlayer = player;
  }
  if (variant === 'paused') {
    game.timeControl = { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 0 };
    setPausedClock(game, 300000, now);
  }
  return createWorkspace([game], { ..._validOptions(), layout: { historyCollapsed: false, analysisEngineExpandedByIndex: [true, true] } });
}
export function createRecoveryWorkspace(variant: string, now: number) {
  if (variant === 'combined') return createWorkspace([_validGame()], {
    openGameIds: ['recovery-missing', 'recovery-broken', 'recovery-valid'], route: '/game/recovery-missing', files: [corruptSettings, corruptLayout, brokenGame].map((file) => ({ ...file })),
  });
  if (faultVariants.some((name) => name === variant)) return _faultWorkspace(variant);
  if (fallbackScenarios.some(({ name }) => name === variant)) return _fallbackWorkspace(variant);
  if (runtimeVariants.some((name) => name === variant)) return _runtimeWorkspace(variant, now);
  for (const { name, route } of restoredRoutes) {
    if (variant === `restore-${name}-on` || variant === `restore-${name}-off`) return _validWorkspace(route, variant.endsWith('-on'));
  }
  throw new Error(`Unknown recovery variant: ${variant}.`);
}
