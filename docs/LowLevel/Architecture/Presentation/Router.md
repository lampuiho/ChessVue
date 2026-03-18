# Router Module (Presentation)

## Purpose
Define routes and navigation guards for game pages and settings.

## Interfaces
- `RouteConfig`

## Module Functions
- `createRouterInstance(): Router`
- `setupRoutes(): RouteRecordRaw[]`
- `beforeRouteEnterGuard(to, from, next): void`
- `beforeEachRouteGuard(to, from, next): void`

## Called By
- `main.ts` during app initialization

## Calls
- `GamesStore.getGameById`
- `UiStateStore.setCurrentGameId`
