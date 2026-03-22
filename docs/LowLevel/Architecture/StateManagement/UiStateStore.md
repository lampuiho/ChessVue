# UiStateStore

## Purpose
Own shell/session state such as active route, open tabs, active game, persisted non-modal layout preferences, and transient prompts needed by scenario flows.

## Public Interface
```ts
loadSession(): Promise<ISessionSnapshot>
getSession(): ISessionSnapshot
setActiveRoute(route: ISessionSnapshot["activeRoute"]): void
setActiveGame(gameId: string | null): void
openTab(gameId: string): void
closeTab(gameId: string): void
setGameLayout(gameId: string, layout: ISessionLayoutState): void
togglePanel(gameId: string, panel: "history" | "analysis" | "gameControl", isVisible?: boolean): void
showModal(modalId: string, payload?: unknown): void
hideModal(): void
saveSession(): Promise<void>
```

## Responsibilities
- restore route and tab shell state across launches
- keep layout visibility state that is part of exact-screen restore inputs
- own transient modal and confirmation prompts without persisting them
- exclude modal visibility and other transient UI prompts from persistence

## Dependencies
- `PlatformServices`
- `SerializationService`

## Scenario Coverage
- `SCN-SESSION-01`
- `SCN-SESSION-02`
- `SCN-NAV-01`
- `SCN-NAV-02`
- `SCN-GAME-03`
- `SCN-FREE-ANALYSIS-02`
- `SCN-FREE-ANALYSIS-03`
- `SCN-TIME-02`
- `SCN-TIME-04`
- `SCN-TIME-05`
- `SCN-CTRL-02` to `SCN-CTRL-05`
- `SCN-LOAD-02`

## Notes
- `UiStateStore` resolves `StorageAdapter` through `usePlatformServicesStore()`.
