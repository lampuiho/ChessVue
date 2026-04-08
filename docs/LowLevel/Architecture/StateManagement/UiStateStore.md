# UiStateStore

## Purpose
Own shell/session state such as active route, open tabs, active game, remembered non-modal UI layout state, and transient prompts needed by scenario flows.

## Public Interface
```ts
getGameSessionOrDefault(): Promise<IGameSessionSnapshot>
saveGameSession(): Promise<void>
getLayoutStateOrDefault(): Promise<IUiLayoutState>
saveLayoutState(): Promise<void>
setActiveRoute(route: IGameSessionSnapshot["activeRoute"]): void
setActiveGame(gameId: string | null): void
openTab(gameId: string): void
closeTab(gameId: string): void
setLayoutState(layout: IUiLayoutState): void
togglePanel(panel: "history" | "analysis", isVisible?: boolean): void
setSectionCollapsed(section: "history" | "analysis", isCollapsed?: boolean): void
getModalState(): IAppModalState | null
showModal(modal: IAppModalState): void
hideModal(): void
getAnalysisEngineExpandedByIndex(): boolean[]
setAnalysisEngineExpanded(index: number, isExpanded?: boolean): void
```

## Responsibilities
- lazily read game-session shell state across launches when that behaviour is enabled by settings
- lazily read remembered UI layout state independently from game-session restore
- persist remembered panel visibility and fold state as one app-level layout snapshot, including analysis-engine fold state by rendered row index for the active game
- own typed transient modal and confirmation prompts without persisting them
- own remembered analysis-engine fold state inside the shared layout snapshot without introducing extra game-linked layout keys
- exclude recent-game history from UI/session ownership
- exclude conscious user settings from session ownership
- exclude modal visibility and other transient UI prompts from persistence

## Dependencies
- `SessionStateService`

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
- `SCN-IMPORT-02`

## Notes
- `UiStateStore` consumes `SessionStateService` as the layer-2 session and layout persistence path; it does not resolve `StorageAdapter` directly.
- `getLayoutStateOrDefault()` still returns the remembered layout when `session.restorePreviousSession` is `false`, so the app can remember panel visibility and fold state without reopening old games.
- `getGameSessionOrDefault()` and `getLayoutStateOrDefault()` are lazy first-read boundaries intended for route or view setup paths rather than an eager startup phase.
- `togglePanel(...)`, `setSectionCollapsed(...)`, and `setLayoutState(...)` apply to the shared app shell layout and never take a `gameId`.
- `setAnalysisEngineExpanded(...)` writes analysis-engine fold state into `IUiLayoutState` by rendered row index for the active game, using that game's persisted analysis roster order to derive the current mapping.
- Flow docs continue to show `UiStateStore._coerceOpenTabs` and `UiStateStore._coerceActiveRoute` as the visible owner-private boundaries. If they share implementation with routing logic, that implementation is documented under `SessionNavigationUtility` in [UtilityIndex.md](../UtilityIndex.md).
