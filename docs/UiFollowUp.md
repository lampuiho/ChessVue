# UI scenario follow-up

Implemented on 10 October 2026: **UI-01–UI-17 are complete**. The findings below retain the original review context. All expected-failure modifiers have been removed, and the named journey data remains unchanged.

Implementation covers reactive history and engine choices; analysis pause ownership and exploration; route validation, timeout re-arming and tab visibility; validated new-game/setup options and required-engine launch checks; move-count autosave; imported/managed identity and path confinement; move-prefix playback and stale-line rejection; historical rewrite confirmation; selected-save details; startup recovery; dirty-settings navigation; and board-edit permissions.

Verification: `npm run test:unit -- --run --maxWorkers=1` passed **36 files / 341 tests**, including **32 application regressions** in [UiFollowUp.spec.ts](../journeys/__tests__/UiFollowUp.spec.ts). `npm run build` passed both type checking and the production build. Additional component and save-path tests cover custom-form validation, prefix selection and unsafe managed path segments.

## Original findings (resolved)

Initially reviewed on 9 October 2026 against [the committed scenarios](HighLevel/scenarios.md), with a further review on 10 October 2026. These are follow-up fixes and behaviour gaps, kept separate from the testing journeys. `Idea` scenarios were excluded. Source/component probes reproduced items 1–6 initially; the remaining items came from tracing the implementation against the specified branches. The further review extends UI-02, UI-04, UI-06 and UI-08 and corrects the duplicate-identity diagnosis. Before adding the regression cases below, the type check and all 292 tests passed with one Vitest worker; the default parallel run hit a bootstrap timeout and a subsequent failure.

Use the named [journeys](../journeys/README.md) to reach each starting state. A journey supplies data; it does not imply that every referenced scenario passes.

| ID | Finding and expected follow-up | Scenarios | Journey |
| --- | --- | --- | --- |
| UI-01 | `HistoryPanel` caches rows from the raw move-tree object. Playing a move leaves its history rows stale until another dependency changes. Make history observe workspace revisions and verify moves, branches and takeback update immediately. | MOVE-01, HIST-01–04 | `play`, `history` |
| UI-02 | Entering in-game analysis produces a paused-analysis state, but `GameView` classifies it as ordinary paused play. Resume clears the manual pause only, leaving no working analysis exit. Store guards also reject moves and history navigation in that state, so changing visible controls alone cannot restore exploration. Resolve analysis state, control precedence and pause ownership together: allow both colours and history review without advancing the live node or clock, expose a working exit that returns to live play, and keep manual/menu pauses read-only. Reconcile the blanket paused-interaction rule with the analysis-specific permission before implementing the state change. | CTRL-04–05, HIST-01, HIST-04, TIME-02 | `history`, `clocks` |
| UI-03 | Changing `/game/:id` while reusing `GameView` does not validate an unknown ID; validation is only on mount. Add navigation validation and use first valid game/home as specified. | GAME-03, NAV-02 | `play` |
| UI-04 | `ModalHost` caches the configured engine list through a computed value with no reactive inventory dependency. After applying engine settings, new-game/player selectors can retain old entries. It also resolves the current player engine by profile display name: a renamed/deleted profile can turn confirmation without a new selection into an unassigned seat and end live play; an edited profile can replace the copied seat configuration. Refresh future assignment choices while retaining the current copied engine as an explicit unchanged choice. Confirming that choice must preserve its configuration, live context and in-flight turn without stopping/restarting an engine. Verify unchanged, edited, renamed and deleted source profiles. | ENGINE-01–03, GAME-02; BR-ENGINE-02-DELETE-IN-USE, BR-ENGINE-03-SAME-SELECTION | `settings` |
| UI-05 | Empty custom minutes becomes zero and is accepted. The custom flow also lacks independent `none` choices per side and required-engine validation; engine defaults can be mapped to `none`. Validate before submit and preserve the specified player choices. | GAME-02 | `fresh`, `settings` |
| UI-06 | `timeoutShown` survives a game-ID change. After one timeout is handled, a second timed game in the reused view can remain unadjudicated. Takeback can also reopen the same timed-out game without changing its ID, leaving the next timeout ignored. Reset/re-arm timeout handling when the selected game changes and when that game's result returns to ongoing. Verify a first timeout, takeback, then a second timeout in the same mounted view, as well as consecutive timeouts across tabs. | GAME-03, TIME-04, CTRL-01 | `clocks` |
| UI-07 | The move-count autosave setting is not connected to move commits. Rewriting an existing `auto.json` also defaults to `overwrite: false`. Connect the trigger and permit repeat autosave writes. | SAVE-01 | `saves` |
| UI-08 | Imports retain their source ID until insertion; workspace insertion already repairs collisions with open games, but a non-colliding imported ID can still reuse an existing managed save folder. Allocate a fresh app-owned ID in the import boundary before returning the game. Managed selected/latest/recent loads also trust the document's ID instead of the enumerated save-group ID: even a syntactically safe mismatch can direct the next autosave into another game's folder. Assign managed-load identity from the selected group before insertion, retaining the existing collision repair. Keep managed folder identity app-owned and confined beneath the save root; sanitisation alone does not establish the correct identity. Preserve document content and other groups' saves. Internal session restore remains a separate identity policy. | IMPORT-01, SAVE-03, LOAD-01, NAV-03 | `saves` |
| UI-09 | Suggested PVs are whole-row buttons committing the entire line. Individual move-prefix selection and the documented move-by-move playback are absent. | ANALYSIS-04 | `analysis` |
| UI-10 | Start-from-setup exposes only players; clocks and analysis preferences are hard-coded. Expose and validate the specified start options while retaining the edited position. | FREE-ANALYSIS-03 | `setup` |
| UI-11 | Continuing from a historical node with takeback allowed rewrites the line without the specified confirmation. | HIST-02 | `history` |
| UI-12 | Saved-games view omits selected-save details and the autosave-first grouping/separator. Its load footer describes the latest entry rather than the selected save. | SAVE-02–03, LOAD-01 | `saves` |
| UI-13 | Startup can restore the old active route even when restore-session is disabled. Corrupt-data fallback is logged but has no recoverable warning in the UI; missing active-game fallback does not consistently choose the first valid game. | SESSION-02–03 | `settings`, `recovery` |
| UI-14 | Unsaved-settings confirmation covers the view's own return actions but has no general route guard for tabs/browser navigation. | NAV-01 | `settings` |
| UI-15 | The tab strip remains visible with one game, despite the single-tab hiding branch. | GAME-03 | `play` |
| UI-16 | Clicking the selected source square again does not cancel selection. | MOVE-02 | `fresh`, `play` |
| UI-17 | Player reassignment/history actions remain exposed during board edit, and in-game-analysis takeback availability can disagree with `allowTakeback`. Align visible/disabled controls with mode permissions. | FREE-ANALYSIS-02, CTRL-01, CTRL-05 | `setup`, `history` |

Scenario prefixes in the table are abbreviated: `MOVE-01` means `SCN-MOVE-01`, for example. Runtime touchpoints are primarily `GameView.vue`, `HistoryPanel.vue`, `ModalHost.vue`, `NewGameModal.vue`, `SavedGamesView.vue`, `SettingsView.vue`, `App.vue`, `SavedGamesStore.ts` and `GameMoveComposable.ts`. Turn each item into an assertion of the expected behaviour when its fix is implemented; keep current failures visible instead of making the fixtures compensate for them.

## Regression coverage from the further review

[UiFollowUp.spec.ts](../journeys/__tests__/UiFollowUp.spec.ts) exercises the real application views, stores, chess rules and journey-backed storage. Timed cases use a controlled clock; engine-seat cases retain a local side to move so engine output cannot race the assertions. The named journeys remain unchanged.

| Item | Expected assertions |
| --- | --- |
| UI-02 | Entering analysis exposes a working exit; both colours can explore and history can be selected while the live path and paused clock remain unchanged. Manual and menu pauses still block gameplay. |
| UI-04 | Confirming without a new player selection preserves the copied engine, live path and pending turn after its profile is unchanged, edited, renamed or deleted, without stopping the engine. |
| UI-06 | After timeout, takeback restores live play and a second expiry in that same game is adjudicated and displayed. |
| UI-08 | Selected/latest/recent managed loads use the enumerated group ID; their next autosave stays in that group and leaves the other group's save intact. Imports receive a fresh ID before insertion even without an open collision. A passing control confirms workspace insertion already repairs colliding IDs. |

The review originally used Vitest's `it.fails` modifier to assert the required behaviour. Those 12 defect cases now pass normally. The suite also covers every remaining follow-up item, layered manual/analysis pause ownership, consecutive timed tabs, recent-game identity, unavailable required engines, stale suggestions and live suggestion policy. Run with one worker to avoid the previously observed parallel-bootstrap timing issue:

```sh
npm run test:unit -- --run journeys/__tests__/UiFollowUp.spec.ts --maxWorkers=1
npm run type-check
```

On 10 October 2026, an initial run without the expected-failure modifiers reproduced all 12 defect cases at their intended assertions. The three controls passed: manual pause, menu pause and workspace duplicate-ID repair. The managed-load cases also reproduced an autosave overwriting the other group's document in journey storage.

Review baseline: type checking passed, and the one-worker suite passed 35 files / 307 cases, including 12 expected failures. Implementation verification now passes 36 files / 341 ordinary tests with no expected failures, plus type checking and the production build.
