# Presentation/Router.md
# Router Module (Presentation)

## Purpose
Define app routes and navigation guards for game pages and settings.

## Data Interfaces
- IUiState (from DataInterface/UiState.md)

## Module Functions
- createRouterInstance(): Router
- setupRoutes(): RouteRecordRaw[]
- eforeEachRouteGuard(to, from, next): void
- eforeRouteEnterGuard(to, from, next): void

## Calls
- GamesStore.getGameById
- UiStateStore.setCurrentGameId
