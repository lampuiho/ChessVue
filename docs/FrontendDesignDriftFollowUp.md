# Frontend Design Drift Follow-Up

## Purpose
Track frontend implementation drift found while reviewing commit `e21973712a683f35e335d6165960d09f323de9bd` against the post-commit design documents.

Work through these follow-ups independently. Update each status as it is reviewed or resolved.

## Follow-Ups

### FRONTEND-DRIFT-01 — Menu flows do not auto-pause timed games

- **Priority:** P1
- **Status:** Resolved
- **Implementation:** `src/views/GameView.vue:233`, `src/views/GameView.vue:282`
- **Design:** `docs/HighLevel/settings_contract.md:61`, `docs/HighLevel/scenarios.md:247`
- **Problem:** Home, settings, save, load, and custom-new actions navigate or open a modal directly. Production code never pauses with `PauseReason.Menu` and has no paired menu-owned auto-resume path.
- **Impact:** A timed game can continue consuming clock time while an interrupting menu surface covers the game.
- **Acceptance criteria:** Eligible timed live games pause before an interrupting menu flow when `gameSession.autoPauseOnMenu` is enabled. Returning resumes only a pause owned by that menu flow and does not resume manual or analysis-owned pauses.
- **Resolution:** `GameView` now routes Home, Settings, Save, Load, and Custom New through paired menu-interruption handlers. Menu-owned pauses resume only when the interrupted game is shown again or Custom New is cancelled; creating another workspace leaves the previous game paused until its tab is revisited.

### FRONTEND-DRIFT-02 — Named saves overwrite without confirmation

- **Priority:** P1
- **Status:** Resolved
- **Implementation:** `src/views/SavedGamesView.vue:75`
- **Design:** `docs/HighLevel/scenarios.md:943`, `docs/LowLevel/ProcessFlows/PersistenceAndAdministration.md:100`
- **Problem:** Managed saves always pass `overwrite: true` without first checking for a matching save name or asking the user to confirm replacement.
- **Impact:** Reusing a save name can silently destroy an existing named snapshot.
- **Acceptance criteria:** A unique valid name saves immediately. A colliding name opens the shared overwrite-confirmation flow; cancelling performs no write, while confirming performs the replacement.
- **Resolution:** `SavedGamesView` uses the shared dialog shell to confirm replacement of an existing name. Unconfirmed writes disable overwrite and also prompt on storage-reported collisions. Dismissing the dialog preserves the existing save and keeps the form open; confirming replaces the captured target. View tests cover unique names, cancellation, confirmation, stale listings, validation, and write failures.

### FRONTEND-DRIFT-03 — Analysis panel can show snapshots for another position

- **Priority:** P1
- **Status:** Pending
- **Implementation:** `src/views/GameView.vue:258`
- **Design:** `docs/LowLevel/Architecture/Presentation/Views/Game.md:8`, `docs/LowLevel/Architecture/Presentation/Components/AnalysisPanel.md:4`
- **Problem:** `GameView` passes `game.analysis.snapshots` directly instead of consuming `GamesStore.getVisibleAnalysis(...)`, which filters snapshots by the rendered position key.
- **Impact:** After history navigation or another rendered-position change, the panel can display an evaluation belonging to the previous position.
- **Acceptance criteria:** The panel receives only snapshots matching the currently rendered position. Stale persisted results are not presented as current-position analysis.

### FRONTEND-DRIFT-04 — Analysis-line clicks apply the entire principal variation

- **Priority:** P1
- **Status:** Pending
- **Implementation:** `src/components/AnalysisPanel.vue:53`, `src/views/GameView.vue:174`
- **Design:** `docs/HighLevel/scenarios.md:612`, `docs/HighLevel/ui_layout.md:179`, `docs/LowLevel/Architecture/Presentation/Components/AnalysisPanel.md:28`
- **Problem:** Each principal variation is rendered as one button that emits the full `line.pv`; `GameView` then applies every emitted move. The design requires individual move targets within the line.
- **Impact:** A live-game click can attempt multiple consecutive moves instead of committing one selected suggestion. Analysis contexts cannot stop at a chosen move within a line.
- **Acceptance criteria:** Each eligible move is independently selectable. Live play commits only the selected first-move suggestion; analysis contexts apply only the continuation prefix ending at the clicked move.

### FRONTEND-DRIFT-05 — Board and piece customisation is deferred

- **Priority:** P2
- **Status:** Resolved
- **Implementation:** `src/views/SettingsView.vue`
- **Design:** `docs/HighLevel/settings_contract.md:36`, `docs/HighLevel/ui_layout.md:44`, `docs/LowLevel/Architecture/Presentation/index.md:37`
- **Problem:** The review incorrectly treated future board and piece customisation as an initial-phase implementation requirement. Settings exposed selectors for styles that were not implemented.
- **Impact:** The selectors implied supported customisation and the original acceptance criteria expanded the initial scope.
- **Acceptance criteria:** The initial phase uses a fixed board and piece presentation without customisation controls. Retain the separate appearance code structure and reserved `boardTheme` and `pieceTheme` schema fields for future implementation.
- **Resolution:** Removed the board and piece theme selectors and clarified the design documents. Customisation remains deferred; no additional themes or rendering integration are required for this follow-up.

### FRONTEND-DRIFT-06 — Interface-scale control does not expose the full contract range

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/SettingsView.vue:176`, `src/contracts/Settings.ts:98`
- **Design:** `docs/HighLevel/settings_contract.md:38`
- **Problem:** The settings contract and schema allow `uiScalePercent` from `75` to `200`, but the range input is capped at `150`.
- **Impact:** Users cannot select valid scale values from `155%` through `200%` in the settings UI.
- **Acceptance criteria:** The control exposes the complete schema-supported range and correctly represents an existing accepted value anywhere from `75` through `200`.

### FRONTEND-DRIFT-07 — Game-creation UI does not honour the creation contract

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/HomeView.vue:28`, `src/views/GameView.vue:139`, `src/components/NewGameModal.vue:19`, `src/components/ModalHost.vue:98`
- **Design:** `docs/HighLevel/settings_contract.md:27`, `docs/HighLevel/scenarios.md:181`, `docs/HighLevel/scenarios.md:199`, `docs/LowLevel/Architecture/Presentation/SharedDialogFlows.md:19`
- **Problem:** Quick game hardcodes both players as local and ignores the default player types. Custom game forces both sides unassigned in analysis mode and cannot represent a setup with only one unassigned side. Start-from-setup omits the required `Show Live Analysis Moves` choice and hardcodes it to `false`.
- **Impact:** Saved defaults and valid setup combinations cannot be reproduced through the frontend.
- **Acceptance criteria:** Quick game consumes all defined quick-game defaults. Custom game can submit either seat as unassigned and lets `GamesStore` determine live versus free-analysis state. Start-from-setup always exposes and persists the live-analysis-move preference.

### FRONTEND-DRIFT-08 — Startup and route guards do not enforce navigation design

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/router/index.ts:3`, `src/App.vue:68`, `src/views/SettingsView.vue:58`
- **Design:** `docs/LowLevel/Architecture/Presentation/Router.md:15`, `docs/LowLevel/ProcessFlows/StartupAndNavigation.md:296`
- **Problem:** The router defines routes but no guards for game identity, save context, saved-game selection, or dirty settings. Startup also restores a stored non-home route without gating that route restoration on `gameSession.restorePreviousSession`.
- **Impact:** Invalid targets can bind before fallback, browser-driven settings navigation bypasses the dirty-leave prompt, and a prior settings or library route can reopen even when session restoration is disabled.
- **Acceptance criteria:** Route entry is validated before affected views bind; invalid targets use the documented fallbacks; every settings-leave path honours the dirty draft; startup restores the stored route only when restoration is enabled and valid.

### FRONTEND-DRIFT-09 — Paused analysis disables permitted runtime actions

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/GameView.vue:258`, `src/components/AnalysisPanel.vue:39`
- **Design:** `docs/LowLevel/Architecture/Presentation/Components/AnalysisPanel.md:32`, `docs/LowLevel/Architecture/StateManagement/GamesStore.md:100`
- **Problem:** `GameView` disables the analysis panel while paused, and `AnalysisPanel` applies that flag to refresh, retry, and stop controls.
- **Impact:** Users cannot manage analysis runtime while the game is paused, despite these actions being explicit non-gameplay exceptions.
- **Acceptance criteria:** Suggested moves remain read-only while paused, but refresh, retry, stop, add-engine, remove-engine, and folding actions remain available.

### FRONTEND-DRIFT-10 — Theme previews bypass the appearance projection

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/SettingsView.vue:17`, `src/views/SettingsView.vue:41`
- **Design:** `docs/LowLevel/Architecture/Presentation/Views/Settings.md:29`, `docs/LowLevel/Architecture/DataInterface/Appearance.md:80`
- **Problem:** Theme previews import `defaultLightThemeProfile` and `defaultDarkThemeProfile` directly instead of consuming the configured readonly profiles exposed by `SettingsStore.appearanceProjection`.
- **Impact:** Once configured profiles differ from the defaults, the application chrome and its settings previews will disagree.
- **Acceptance criteria:** Theme previews retain and render the same light and dark profile snapshots exposed through the root appearance projection.

### FRONTEND-DRIFT-11 — Engine-profile editor omits store-owned metadata behaviour

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/SettingsView.vue:18`, `src/views/SettingsView.vue:77`
- **Design:** `docs/LowLevel/Architecture/Presentation/Views/Settings.md:10`, `docs/LowLevel/Architecture/Presentation/Views/Settings.md:22`, `docs/LowLevel/Architecture/StateManagement/EnginesStore.md:45`
- **Problem:** `SettingsView` does not consume `EnginesStore` or its cached option metadata. It directly edits the settings draft and provides no metadata load or refresh action.
- **Impact:** The designed engine discovery workflow is absent, and the options editor cannot be informed by supported UCI option metadata.
- **Acceptance criteria:** The editor consumes cached metadata through `EnginesStore`, supports explicit refresh through a temporary engine runtime, and leaves saved option values unchanged unless the user edits them.

### FRONTEND-DRIFT-12 — Presentation implementation bypasses the common render layer

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/HomeView.vue:66`, `src/views/GameView.vue:231`, `src/views/SavedGamesView.vue:129`, `src/views/SettingsView.vue:125`, `src/components`
- **Design:** `docs/LowLevel/Architecture/Presentation/InteractionMap.md`, `docs/LowLevel/Architecture/Presentation/index.md:39`, `docs/LowLevel/Architecture/Presentation/Views/Home.md:24`, `docs/LowLevel/Architecture/Presentation/Views/Game.md:32`, `docs/LowLevel/Architecture/Presentation/Views/Settings.md:37`
- **Problem:** Views and feature components own substantial HTML, layout, forms, buttons, lists, and repeated CSS. The design requires template-free views and feature adapters backed by common render components. Only `AppIcon` and `ModalDialog` currently exist under `src/components/common`, and spacing is generally expressed as repeated literals rather than named semantic variables.
- **Impact:** Shared behaviour and visual rules are duplicated, and the implemented component boundaries no longer match the documented architecture.
- **Acceptance criteria:** Introduce the documented common render primitives, move markup ownership to that layer, keep feature/view adapters template-free, and express shared spacing through usage-named `rem` variables.

### FRONTEND-DRIFT-13 — Settings and saved-games layouts differ from the baseline

- **Priority:** P2
- **Status:** Pending
- **Implementation:** `src/views/SettingsView.vue:131`, `src/views/SavedGamesView.vue:136`
- **Design:** `docs/HighLevel/ui_layout.md:263`, `docs/HighLevel/ui_layout.md:303`
- **Problem:** Settings uses a left navigation sidebar instead of the specified top tab-style category row. Saved Games uses a single list surface and omits the baseline games, saves, and selected-details regions, including the save-list/details presentation on the save route.
- **Impact:** Major route-level composition differs from the approved desktop layout and omits designed selection context.
- **Acceptance criteria:** Settings categories use the shared top tab pattern. Saved Games provides the documented game list, save list, selected details, route-specific field context, and bottom action row.

## Verification Baseline

At the time of review:

- production build and TypeScript checking passed
- all `200` unit tests passed
- no view or feature-component tests existed to cover these frontend contracts
- the worktree was clean
