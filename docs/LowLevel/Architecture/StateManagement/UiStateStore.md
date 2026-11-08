# UiStateStore

## Purpose
Own shell and session state such as the committed active route, open tabs, active game, remembered non-modal layout state, transient navigation expansion and startup recovery warnings.

## Public Interface
```ts
navigationExpanded: boolean
toggleNavigationExpanded(): void
gameSession: IGameSessionSnapshot | undefined
layoutState: IUiLayoutState | undefined
recoveryWarnings: string[]
addRecoveryWarning(message: string): void
loadGameSession(): Promise<void>
saveGameSession(): Promise<void>
loadLayoutState(): Promise<void>
saveLayoutState(): Promise<void>
setActiveRoute(route: IGameSessionSnapshot['activeRoute']): void
setActiveGame(gameId?: string): void
openTab(gameId: string): void
closeTab(gameId: string): void
setLayoutState(layout: IUiLayoutState): void
togglePanel(panel: 'history' | 'analysis', isVisible?: boolean): void
setSectionCollapsed(section: 'history' | 'analysis', isCollapsed?: boolean): void
setAnalysisEngineExpanded(index: number, isExpanded?: boolean): void
```

The members appear in the order the store (`useUiStateStore`, store id `uiStateStore`) returns them. `navigationExpanded`, `gameSession`, `layoutState` and `recoveryWarnings` are refs.

## Responsibilities
- lazily read and persist the game-session shell snapshot (`openGameIds`, `activeGameId`, `activeRoute`)
- lazily read and persist remembered UI layout state independently from game-session restore
- persist remembered panel visibility and fold state as one app-level layout snapshot, including analysis-engine fold state by rendered row index
- coerce a loaded session snapshot to unique open tabs, a valid active game and a valid committed route
- collect startup recovery warnings for unreadable session or layout documents and for games presentation could not restore
- hold the transient desktop navigation-expansion preference without persisting it
- exclude recent-game history, conscious user settings, modal visibility and other transient prompts from persistence

## Dependencies
- `SerializationService`
- `BuildConfig.persistence` paths and the shared `logHandledError` utility

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
- Dialog mounting belongs to `ModalComposable` (see [Composables](../Presentation/Composables.md) and the archived [modal component design](../../../ArchivedPlans/ModalComponentDesign.md)); its mounted components own their forms and submission feedback.
- `UiStateStore` consumes `SerializationService` as the layer-2 session and layout persistence path; it does not resolve `StorageAdapter` directly and does not call sibling stores. `BuildConfig.persistence.gameSessionPath` and `layoutStatePath` supply the concrete document paths.
- `loadGameSession()` and `loadLayoutState()` are lazy single-flight hydration boundaries; `App` awaits both, with `SettingsStore.loadSettings()`, before the shell renders. A missing document (`PlatformErrorKind.NotFound`) silently yields the default; any other read failure is logged, adds a recovery warning and also yields the default. Commands reject use before their state has loaded.
- The session is always loaded. Whether old tabs reopen is decided by `App`: when `gameSession.restorePreviousSession` is off it closes every remembered tab and routes home; otherwise it inserts restored games through `GamesStore` and closes tabs it could not restore. The layout snapshot loads regardless, so panel visibility and fold state are remembered without reopening old games.
- `App` owns session checkpoints. It saves after startup and after each successful committed route change in `router.afterEach`, calling `setActiveGame(...)` for `/game/:id` and `setActiveRoute(...)` otherwise. Panels call `saveLayoutState()` after their own toggles.
- Committed routes are `/home`, `/game/:id`, `/saved-games/load`, `/saved-games/load/:name`, `/saved-games/save/:name` and `/settings/{session,gameplay,appearance,engines}`. The nested engine-management routes under `/settings/engines/...` are not committed, so they are neither persisted nor restored. On load, an invalid route or a game route for a tab that is not open falls back to the active game's route or `/home`.
- `gameSession` and `layoutState` are writable deep-reactive state. Views bind their visible fields directly, while compound tab and active-game transitions use the store commands that update related fields together.
- `setActiveGame(...)` is selection-only. It sets `activeGameId` and the `/game/:id` route only when the supplied id is already open, and never appends unknown ids to `openGameIds`.
- `openTab(...)` appends and de-duplicates the id, then makes it active and routed. `closeTab(...)` removes it, falls back to the first remaining open game and re-coerces the route. Closing a tab changes UI state only; presentation's tab action separately clears that game's premoves, and the game remains in the `GamesStore` workspace.
- `togglePanel(...)`, `setSectionCollapsed(...)` and `setLayoutState(...)` apply to the shared app-shell layout and never take a `gameId`. Each toggle flips the flag when the explicit value is omitted.
- `setAnalysisEngineExpanded(index, isExpanded?)` writes `analysisEngineExpandedByIndex` by rendered row index, padding missing rows as expanded. Row mapping is presentation's concern: when a seat is removed, `AnalysisPanel` splices the matching index and replaces the layout through `setLayoutState(...)`.
- `navigationExpanded` and `recoveryWarnings` are transient and never persisted. `App` shows `recoveryWarnings` together with `SettingsStore.recoveryWarning` and its own session-save error.
- UI state is not a draft: every visible mutation is immediately current state, so the store does not clone reads or use immutable snapshot replacement. `setLayoutState(...)` accepts the supplied state directly.
- Persistence methods await their load boundary and then pass `toRaw(...)` of the reactive state to `SerializationService`. This removes the Vue proxy at the layer boundary without copying the state.
- Route and tab coercion stays in module-private helpers (`_coerceGameSessionSnapshot`, `_coerceOpenGameIds`, `_coerceActiveGameId`, `_coerceActiveRoute`, `_validateGameRoute`, `_selectFallbackRoute`). They are not shared utility-layer modules.
