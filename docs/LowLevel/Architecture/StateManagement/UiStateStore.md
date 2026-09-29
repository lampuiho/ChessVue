# UiStateStore

## Purpose
Own shell/session state such as active route, open tabs, active game, remembered non-modal UI layout state, and transient prompts needed by scenario flows.

## Public Interface
```ts
gameSession: IGameSessionSnapshot | undefined
layoutState: IUiLayoutState | undefined
modalState: IAppModalState | undefined
loadGameSession(): Promise<void>
saveGameSession(): Promise<void>
loadLayoutState(): Promise<void>
saveLayoutState(): Promise<void>
setActiveRoute(route: IGameSessionSnapshot["activeRoute"]): void
setActiveGame(gameId?: string): void
openTab(gameId: string): void
closeTab(gameId: string): void
setLayoutState(layout: IUiLayoutState): void
togglePanel(panel: "history" | "analysis", isVisible?: boolean): void
setSectionCollapsed(section: "history" | "analysis", isCollapsed?: boolean): void
showModal(modal: IAppModalState): void
hideModal(): void
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
- `SCN-IMPORT-02`

## Notes
- `UiStateStore` consumes `SerializationService` as the layer-2 session and layout persistence path; it does not resolve `StorageAdapter` directly.
- Build config supplies the concrete `game-session.json` and `layout-state.json` paths used by this store.
- `gameSession` and `layoutState` are writable deep reactive state. Views may bind their visible editable fields directly, while compound tab and active-game transitions continue to use the store commands that update their related fields together.
- `loadLayoutState()` still loads the remembered layout when `gameSession.restorePreviousSession` is `false`, so the app can remember panel visibility and fold state without reopening old games.
- `loadGameSession()` and `loadLayoutState()` are lazy single-flight hydration boundaries intended for route or view setup paths rather than an eager startup phase. Commands reject use before their corresponding state has loaded.
- `setActiveGame(...)` is selection-only. It updates `activeGameId` and the routed game target only when the supplied id is already open, and it never appends unknown ids into `openGameIds`.
- `togglePanel(...)`, `setSectionCollapsed(...)`, and `setLayoutState(...)` apply to the shared app shell layout and never take a `gameId`.
- `setAnalysisEngineExpanded(...)` writes analysis-engine fold state into `IUiLayoutState` by rendered row index for the active game, using that game's ordered persisted analysis seat rows to derive the current mapping.
- UI state is not a draft: every visible mutation is immediately current state, so the store does not clone reads or use immutable snapshot replacement. `setLayoutState(...)` accepts the supplied state directly.
- Persistence methods use `toRaw(...)` when handing the reactive state to `SerializationService`. This removes the Vue proxy at the layer boundary without copying the state.
- Modal state is transient shared state rather than a persistence snapshot. It remains a shallow ref because modal payloads may contain engine callbacks, maps, or host values whose identity must be retained; replacement and removal remain owned by `showModal(...)` and `hideModal()`.
- Flow docs continue to show `UiStateStore._coerceOpenTabs` and `UiStateStore._coerceActiveRoute` as the visible owner-private boundaries. Those functions remain store-private and are not shared utility-layer modules.
