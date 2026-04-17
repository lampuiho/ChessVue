import type { IGameSessionSnapshot } from '@/contracts';

const settingsRoutePattern = /^\/settings\/(session|gameplay|appearance|engines)$/;
const gameRoutePattern = /^\/game\/(.+)$/;
const saveRoutePattern = /^\/saved-games\/save\/(.+)$/;
const loadSelectionRoutePattern = /^\/saved-games\/load\/(.+)$/;

function isGameRoute(route: string): route is `/game/${string}` {
  return gameRoutePattern.test(route);
}
function getGameRouteId(route: `/game/${string}`): string {
  return route.slice('/game/'.length);
}
function isValidCommittedRoute(route: string): route is IGameSessionSnapshot['activeRoute'] {
  return route === '/home'
    || route === '/saved-games/load'
    || settingsRoutePattern.test(route)
    || saveRoutePattern.test(route)
    || loadSelectionRoutePattern.test(route)
    || gameRoutePattern.test(route);
}

export function coerceOpenGameIds(openGameIds: readonly string[], availableGameIds?: ReadonlySet<string>): string[] {
  const uniqueIds = [...new Set(openGameIds.filter((gameId) => gameId.length > 0))];
  if (!availableGameIds) return uniqueIds;
  return uniqueIds.filter((gameId) => availableGameIds.has(gameId));
}
export function coerceActiveGameId(openGameIds: readonly string[], activeGameId?: string): string | undefined {
  if (activeGameId && openGameIds.includes(activeGameId)) return activeGameId;
  return openGameIds[0];
}
export function selectFallbackRoute(openGameIds: readonly string[], activeGameId?: string): IGameSessionSnapshot['activeRoute'] {
  if (activeGameId && openGameIds.includes(activeGameId)) return `/game/${activeGameId}`;
  return '/home';
}
export function validateGameRoute(route: IGameSessionSnapshot['activeRoute'], openGameIds: readonly string[]): IGameSessionSnapshot['activeRoute'] | undefined {
  if (!isGameRoute(route)) return route;
  const gameId = getGameRouteId(route);
  return openGameIds.includes(gameId) ? route : undefined;
}
export function restoreReturnRoute(route: IGameSessionSnapshot['activeRoute'], openGameIds: readonly string[], activeGameId?: string): IGameSessionSnapshot['activeRoute'] {
  if (route.startsWith('/settings/')) return selectFallbackRoute(openGameIds, activeGameId);
  return coerceActiveRoute(route, openGameIds, activeGameId);
}
export function coerceActiveRoute(route: string, openGameIds: readonly string[], activeGameId?: string): IGameSessionSnapshot['activeRoute'] {
  if (!isValidCommittedRoute(route)) return selectFallbackRoute(openGameIds, activeGameId);
  if (isGameRoute(route)) return validateGameRoute(route, openGameIds) ?? selectFallbackRoute(openGameIds, activeGameId);
  return route;
}
export function coerceGameSessionSnapshot(snapshot: IGameSessionSnapshot, availableGameIds?: ReadonlySet<string>): IGameSessionSnapshot {
  const openGameIds = coerceOpenGameIds(snapshot.openGameIds, availableGameIds);
  const activeGameId = coerceActiveGameId(openGameIds, snapshot.activeGameId);
  return {
    schemaVersion: snapshot.schemaVersion,
    openGameIds,
    activeGameId,
    activeRoute: coerceActiveRoute(snapshot.activeRoute, openGameIds, activeGameId),
  };
}
