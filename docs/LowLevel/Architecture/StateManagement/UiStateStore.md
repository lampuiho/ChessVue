# UiStateStore

## Purpose
Own shell/session state such as active route, open tabs, active game, and persisted non-modal layout preferences.

## Public Interface
```ts
loadSession(): Promise<ISessionSnapshot>
getSession(): ISessionSnapshot
setActiveRoute(route: ISessionSnapshot["activeRoute"]): void
setActiveGame(gameId: string | null): void
openTab(gameId: string): void
closeTab(gameId: string): void
setGameLayout(gameId: string, layout: ISessionLayoutState): void
saveSession(): Promise<void>
```

## Responsibilities
- restore route and tab shell state across launches
- keep layout visibility state that is part of exact-screen restore inputs
- exclude modal visibility and other transient UI prompts from persistence

## Dependencies
- `StorageAdapter`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-02`
- `SCN-NAV-01`
- `SCN-NAV-02`
- `SCN-GAME-03`
