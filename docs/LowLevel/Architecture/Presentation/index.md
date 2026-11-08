# Presentation Architecture

This document defines the general implementation rules the Vue presentation layer follows and the app shell that hosts every route. Individual routes, views, components, composables and dialog flows are documented in the supporting docs.

## Supporting Docs
- [Router](Router.md)
- [Interaction Map](InteractionMap.md)
- [Shared Dialog Flows](SharedDialogFlows.md)
- [Composables and Directives](Composables.md)
- [Views](Views/index.md)
- [Components](Components/index.md)
- [High-level UI layout](../../../HighLevel/ui_layout.md)

## Source Layout
Presentation docs mirror the source tree, one doc per production file.

| Source | Contents | Doc |
| --- | --- | --- |
| `src/main.ts` | Production entry: imports `src/assets/main.css`, installs Pinia and the router and mounts `App` | This page |
| `src/App.vue` | App shell: startup, session checkpoints, appearance and the modal provider | [App Shell](#app-shell) |
| `src/router/index.ts` | Route map | [Router](Router.md) |
| `src/views/*.vue` | Route views, including the routed engine-management children of Settings | [Views](Views/index.md) |
| `src/components/*.vue` | Feature components | [Components](Components/index.md) |
| `src/components/common/*.vue` | Drawing and control primitives | [Common Components](Components/Common/index.md) |
| `src/components/modals/*.vue` | Dialog shell and mounted modal components | [Modals](Components/Modals/index.md) |
| `src/composables/*.ts`, `src/directives/FocusScope.ts` | Presentation composables and the focus directive | [Composables and Directives](Composables.md) |
| `src/config/IconConfig.ts` | Icon geometry used by `AppIcon` | [AppIcon](Components/Common/AppIcon.md) |
| `src/config/AppearanceConfig.ts` | Default light and dark theme profiles | [Appearance Variable Rules](#appearance-variable-rules) |
| `src/assets/main.css`, `src/assets/base.css`, `src/assets/styles/*.css` | Global stylesheets | [Global Styling Rules](#global-styling-rules) |

## Markup And Ownership Rules
- Every Vue file renders its own template. Route views own their page markup, feature components own their surface, modal components own their dialog content inside `ModalDialog`, and common components own small reusable drawing or control surfaces.
- A separate component exists only where there is actual shared use or a distinct owner: a mounted modal opening, a focus scope, a popover, or a surface reused across views (for example `Chessboard` in `GameView` and as the read-only preview in `SavedGamesView`). Shared visual language otherwise comes from global CSS classes with explicit variants, such as `.text-button`, `.icon-button`, `.menu-button`, `.action-card`, `.field-row`, `.form-section`, `.toggle-row`, `.side-panel` and `.inline-message`.
- Feature components take a `gameId` where they present one workspace, read their own state from the stores and call public store actions when they own the complete interaction. Component events remain only where the receiver owns a resource the emitter cannot reach: the captured rendered-board input owner, playback, historical continuation, Menu interruption or a modal opening. The [Interaction Map](InteractionMap.md) lists those boundaries.
- Presentation does not own game rules, move-tree mutation, persistence or engine-process control. It may call pure domain and chess-utility reads to render state, such as `MoveApplicationService.genPosition`, `MoveHistoryService.getMoveSequence`, `TimeControlService.getRemainingTime`, `SavedGameIndexService.getLatestSaveEntry`, `genLegalMovesForPiece`, `genCandidateMovesForPiece` and `getSan`. The one side-effecting domain call is the required-player readiness check `EngineRuntimeService.getOptions` in `useQuickGame` and `GameCreationModal`; its temporary session owns its own cleanup, as recorded in the [quick game defaults design](../../../ArchivedPlans/QuickGameDefaultsDesign.md#ownership-and-creation-flows).
- Production files under `src/components` are `.vue` files only. TypeScript composables live in `src/composables`, directives in `src/directives` and static data such as icon geometry in `src/config`. Component tests stay in their colocated `__tests__` folders.

The earlier baseline design described a generic render layer (`TabbedView`, `FieldRow`, `PanelSurface`, `WorkspaceShell`, `TreeView` and similar) with template-free views and feature adapters. That layer was never implemented. The [component simplification plan](../../../ArchivedPlans/ComponentSimplificationPlan.md) found that those descriptions were not evidence of reuse and that parent relays duplicated owners: a parent prepared props for state the child could read itself and forwarded events to handlers that only called a store. Moving each complete interaction to its owning component removed 22 props and 23 events without moving rules, engine ownership or persistence into components. A wrapper layer is rejected because each wrapper adds a prop/event relay without owning any state or lifecycle. The invariant is that a component boundary corresponds to a real owner or real reuse, and each shared presentation primitive has one style owner. Extract a new component when the same markup and behaviour genuinely recur, and give it its own doc.

## App Shell
`src/App.vue` is the root component. It owns application-wide effects that no route can own.

- **Modal provider.** Setup calls `useModalProvider()` once, so every view, component and mounted modal shares one modal owner through `useModal()`. See [Composables](Composables.md#modalcomposable).
- **Startup.** Until settings, game session and layout state are loaded and startup has finished, App renders the `.app-loading` mark instead of `RouterView`. `onMounted` loads `SettingsStore.loadSettings`, `UiStateStore.loadGameSession` and `UiStateStore.loadLayoutState` in parallel, reapplies appearance, then runs `_restoreWorkspace`:
  - when `gameSession.restorePreviousSession` is off, it closes every stored tab and records `/home`;
  - otherwise it calls `SavedGamesStore.restoreGames(openGameIds)` and `GamesStore.insertGame` for each restored document, closes tabs whose game could not be restored and adds a recovery warning for each.
- After restoring, App registers `SavedGamesStore.registerAutosaveOnClose` with the open games, replaces a home entry URL with the stored committed route when one exists, replaces an unknown `/game/:id` with the first restorable open game or `/home`, records the starting route and saves the session.
- **Session checkpoint.** A `router.afterEach` hook records each successful, changed, committed route through `UiStateStore.setActiveGame` or `setActiveRoute`, then saves the session with `saveGameSession`. Failed, duplicate and non-committed navigations are ignored. The hook is removed by `onScopeDispose`. Recording only after a successful navigation means a rejected navigation, such as a cancelled dirty-settings leave, never publishes a selection that did not happen. See [Router](Router.md).
- **Appearance.** `_applyAppearance` runs during setup (with the defaults from `AppearanceConfig`), after settings load, and when a routed view emits `appearanceChanged`. It is the only writer of document-level appearance; see [Appearance Variable Rules](#appearance-variable-rules).
- **Recovery notice.** Settings recovery warnings, session-restore warnings and session-save failures appear in one dismissible `.recovery-notice` (`role="alert"`) with Saved games, Settings and Dismiss actions. A later session-save failure reopens it.
- Styles: `app.css`.

## Layout Ownership Rules
This section defines the parent-child positioning contract that presentation styles preserve.

- Outer positioning belongs to the parent layout class. A layout class positions its direct children.
- Child components must not create left or right drift through self-managed outer margins, offsets or compensating transforms, and must not add empty external spacing beyond their owned surface.
- Panel width, column placement, vertical stacking and inter-panel gaps are controlled by the parent region, not by the child panel's styles.
- In the game workspace (`workspace.css`), `.game-stage` arranges the board column and sidebar. `.board-column` computes `--board-size` from its container size and sizes its direct children, the two player strips and the board, to that width. The board does not decide sidebar or player-strip placement.
- `.game-sidebar` stacks the sidebar title, history, analysis and controls; its children fill the sidebar width. `GameView` applies `.game-sidebar__controls` to `GameControlPanel` so the parent pins the controls to the bottom of the sidebar rather than treating them as a page footer.
- The game, library and settings pages use `.app-page`: `NavigationFrame` sits beside the content on wide layouts and becomes a top bar at the 760px breakpoint, where the game stage also stacks the board above the sidebar. Home uses its own `.home-page` layout without a navigation frame.

These rules let each stylesheet scope its own spacing: parent layouts arrange regions, child components style only their own surface and internal content.

## Appearance Variable Rules
This section defines the app-theme contract that presentation styles preserve.

- The document element is the single appearance host. `base.css` declares `color-scheme: light dark` and every semantic variable, such as `--surface-app`, `--text-primary` and `--accent`, as `light-dark(var(--theme-light-…), var(--theme-dark-…))`.
- `App._applyAppearance` writes both banks from the accepted `IAppearanceProjection` (or the `AppearanceConfig` defaults before settings load) as `--theme-light-*` and `--theme-dark-*` custom properties, sets `data-theme-mode` on the root element and updates `<meta name="color-scheme">` and the media-qualified `<meta name="theme-color">` entries. `data-theme-mode="light"` or `"dark"` constrains `color-scheme`; system mode keeps `light dark`.
- CSS `color-scheme` and `light-dark()` own system-theme selection. Neither App nor any store queries or subscribes to OS theme changes. The [code cleanup record](../../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition) replaced an appearance `watchEffect` with this boundary: draft edits and rejected writes must not restyle the app, and a host theme change must not rewrite settings. A subscription-based implementation would reintroduce an observer and a second owner of the active scheme. Revisit only if a theme needs values CSS cannot select from the two banks.
- Appearance is applied only after a successful Apply, Save or Reset, through the routed `SettingsView.appearanceChanged` event. Draft edits, discard and failed writes emit nothing.
- Shared app chrome reads semantic variables rather than hardcoded palette values. Stylesheets may define local aliases over semantic variables but must not fork separate light/dark palettes.
- The document declares the same supported scheme policy through `<meta name="color-scheme">` and the matching surface colour through `<meta name="theme-color">`, so browser controls and auto-detecting dark-mode extensions receive standard signals. Do not opt out of extension processing with extension-specific lock markers.
- `themeMode` styles app chrome only. Board squares and piece artwork use the fixed colours in `board.css`. **Planned:** `boardTheme` and `pieceTheme` remain separate, reserved appearance paths owned by `Chessboard` and `ChessPiece`; the initial phase exposes no board or piece theme selection.

## Spacing Rules
- Spacing and sizing use `rem` so the root font size scales the whole interface. Pixel values appear only in the shared 760px breakpoint media queries.
- Each value is declared once, beside the selector it spaces, in the stylesheet that owns that surface. There is no abstract spacing scale such as `--space-1`.
- A custom property is introduced only when a caller needs an explicit variant or a runtime-derived value: `--button-height`, `--button-padding`, `--button-font-size`, `--icon-button-size` and `--form-section-gap` are variant hooks on shared primitives; `--board-room` and `--board-size` derive the board size; `--history-depth` carries the history row indent.
- Shared radii, shadows and fonts are root tokens in `base.css` (`--radius-sm`, `--radius-md`, `--radius-lg`, `--shadow-*`, `--font-ui`, `--font-display`).

## Layout Scaling Rules
- Prefer flexbox, grid, intrinsic sizing and container units over fixed widths and heights. Parent layouts use flexible growth and shrink behaviour.
- Fixed dimensions are reserved for genuine invariants such as square board geometry (`aspect-ratio: 1` and an eight-by-eight grid), icon glyph boxes and minimum hit targets, and still use relative units.
- The browser target sets the root font size to `uiScalePercent` percent (`--root-font-size-browser`). The NW.js target (`data-app-mode="true"`) derives it from the viewport's short edge: `uiScalePercent / 50` `vh` in landscape and `vw` in portrait, so the `rem`-based interface spans 50rem of the short edge at 100% scale.

## Global Styling Rules
- `src/assets/main.css` is the only stylesheet entry. It imports `base.css` and the purpose-specific modules in `src/assets/styles`, and is imported by both application entry points, `src/main.ts` and the journey harness `journeys/main.ts`. The [styles README](../../../../src/assets/styles/README.md) lists what each module owns.
- Vue files contain no `<style>` blocks, and stylesheets use no `:deep`, `::v-deep`, `:global`, `>>>` or `/deep/` selectors. `npm run check:code` enforces both.
- Each shared primitive has one owning stylesheet. Select an explicit class variant in markup; route stylesheets do not restyle shared buttons, fields or panel internals. Keep element selectors anchored to their owning class.
- Runtime style bindings supply CSS custom-property values only: `--history-depth` in `HistoryPanel`, the `--preview-*` theme-preview colours in `SettingsView` and the `--expandable-*` geometry in `ExpandableText`. Layout and presentation declarations live in the stylesheets.

## Reactive Effects
- No watchers: `watch`, `watchEffect`, `watchPostEffect`, `watchSyncEffect`, `$watch` and Pinia `$subscribe` are rejected by `npm run check:code` with no exceptions.
- Derived state is `computed`. Effects run in explicit actions, component events, lifecycle hooks (`onMounted`, `onBeforeUpdate`, `onBeforeUnmount`, `onScopeDispose`) and router hooks (`onBeforeRouteLeave`, `onBeforeRouteUpdate`, `router.afterEach`).
- Async work has an explicit owner and a duplicate-start guard: an `OperationOwner`, a modal opening's `AbortSignal`, or a shared pending promise. No generation, epoch or sequence counter invalidates async work.
- The [code cleanup plan](../../../ArchivedPlans/CodeCleanupPlan.md) records the ownership decision for each removed observer and the audit that enforces these rules.

## Error Surfaces
- A failed local action shows its message inline in the initiating surface with `.inline-message--error` and `role="alert"`: the panels, control panel, menu footer, tab strip, settings and library footers and every asynchronous modal through `useModalAction`.
- `GameView` shows workspace action and autosave failures as a short-lived `.toast`.
- `App` shows startup recovery and session-save warnings in the recovery notice.
- An invalid import opens `MessageModal` with its error variant.
- There is no separate runtime-error dialog. Every dialog mounts through `useModal().open`; the former `RuntimeErrorDialogMountUtility` does not exist.
