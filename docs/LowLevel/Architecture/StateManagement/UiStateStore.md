# UiStateStore

## Purpose
Own shell/session state such as active route, open tabs, active game, remembered non-modal UI layout state, and transient prompts needed by scenario flows.

## Public Interface
```ts
loadGameSession(): Promise<IGameSessionSnapshot>
getGameSession(): IGameSessionSnapshot
saveGameSession(): Promise<void>
loadLayoutState(): Promise<IUiLayoutState>
getLayoutState(): IUiLayoutState
saveLayoutState(): Promise<void>
setActiveRoute(route: IGameSessionSnapshot["activeRoute"]): void
setActiveGame(gameId: string | null): void
openTab(gameId: string): void
closeTab(gameId: string): void
setLayoutState(layout: IUiLayoutState): void
togglePanel(panel: "history" | "analysis" | "gameControl", isVisible?: boolean): void
setSectionCollapsed(section: "history" | "analysis", isCollapsed?: boolean): void
showModal(modalId: string, payload?: unknown): void
hideModal(): void
```

## Responsibilities
- restore game-session shell state across launches when that behaviour is enabled by settings
- restore remembered UI layout state independently from game-session restore
- persist remembered panel visibility and fold state as one app-level layout snapshot, not as per-game state
- own transient modal and confirmation prompts without persisting them
- exclude recent-game history from UI/session ownership
- exclude conscious user settings from session ownership
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
- `loadLayoutState()` still runs when `session.restorePreviousSession` is `false`, so the app can remember panel visibility and fold state without reopening old games.
- `togglePanel(...)`, `setSectionCollapsed(...)`, and `setLayoutState(...)` apply to the shared app shell layout and never take a `gameId`.
