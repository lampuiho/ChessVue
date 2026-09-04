# Pre-UI Implementation Follow-Up

This document tracks the implementation work required before starting the UI layer. It converts the current implementation review into stable finding IDs, a remediation plan, and a status board that can be updated as each fix and its verification land.

This document checks implementation drift against the committed design; it must not introduce or silently change behaviour defined there, especially in [scenarios.md](HighLevel/scenarios.md). Any intended design change must be agreed and recorded in the design and scenarios before being treated as a follow-up requirement.

The following existing TODOs remain intentionally deferred until UI implementation makes their boundaries clearer:

- Redesigning deferred player-move and pause-turn behaviour for premoves in [NewToDoList.md](NewToDoList.md).
- Defining the board interaction boundary for `IMoveRaw`, promotion selection, and conversion to `IMove` in [CodexFollowUp.md](CodexFollowUp.md).

## Findings

### PREUI-01 — Shell and settings state do not expose reactive UI read models

- **Severity:** Blocker
- **Finding status:** Closed
- **Affected implementation:** [UiStateStore.ts](../src/state/UiStateStore.ts), [SettingsStore.ts](../src/state/SettingsStore.ts)
- **Problem:** UI state is held in shallow refs, while nested state is mutated in place and several reads return asynchronous cloned snapshots. A Vue consumer cannot reliably react to tab, panel, section, engine-fold, route, modal, or appearance changes. System-theme changes also have no observable projection for the UI.
- **Required outcome:** The UI must be able to consume stable reactive read models without polling or re-fetching cloned snapshots after every command.

### PREUI-02 — Engine-profile commands required by the UI are missing

- **Severity:** Not applicable
- **Finding status:** Closed
- **Affected implementation:** [EnginesStore.ts](../src/state/EnginesStore.ts), [scenarios.md](HighLevel/scenarios.md)
- **Closure reasoning:** Engine-inventory changes are settings-editor draft operations, so add, copy, edit, and delete belong to the UI workflow over the existing reactive settings draft. `SettingsStore` and `UserSettingService` already provide validated persistence, including unique profile names. Outside settings editing, configured profiles are static choices read on demand when selecting an opponent or analysis engine; they do not require a reactive inventory projection. Presentation constructs an engine-backed player from the selected profile, while `GamesStore` copies selected profiles into game-owned state. The missing `EnginesStore` commands and reactive inventory therefore do not block UI implementation.

### PREUI-03 — Player reassignment can discard history and leave an engine running

- **Severity:** High
- **Finding status:** Closed
- **Affected implementation:** [GamePlayerTurnComposable.ts](../src/state/game/GamePlayerTurnComposable.ts), [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts)
- **Problem:** Removing a player replaces the game with an analysis root, which loses the existing move tree. The previous engine runtime is not explicitly stopped, cancellation does not join the existing player-move handler, and the engine's awaited move has no abort signal.
- **Required outcome:** Reassignment must preserve the tree and current position, stop or replace the old runtime deterministically, and cancel the active player turn through an `AbortController`. Cancellation rejects the shared pending-turn promise with the signal's abort reason and awaits its existing handler; engine turn generation observes the same signal and returns early while awaiting a move. Local submission and accepted engine output must continue to use the same `attemptPlayerMove(...)` function. BoardEdit does not expose the player-reassignment UI and requires no store-level reassignment guard.

### PREUI-04 — Restored engine-controlled games can stall

- **Severity:** High
- **Finding status:** Closed
- **Affected implementation:** [GameWorkspaceComposable.ts](../src/state/game/GameWorkspaceComposable.ts)
- **Problem:** Restoring a game hydrates it and may restart analysis, but it does not re-arm the player engine when the restored position is waiting for an engine-controlled side.
- **Required outcome:** Restoration must request exactly one eligible engine turn after all state and runtime prerequisites are ready.

### PREUI-05 — History navigation, rewrite, takeback, and clock state can diverge

- **Severity:** High
- **Finding status:** Closed
- **Affected implementation:** [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts), [GamesStore.spec.ts](../src/state/__tests__/GamesStore.spec.ts)
- **Problem:** Rewriting from a historical node prunes the old played continuation instead of retaining it as a variation. Takeback ignores `allowTakeback`, does not restore the target node's clock snapshot, and can place the live path on an analysis branch. One current history-rewrite test encodes the incorrect continuation-pruning behaviour.
- **Required outcome:** Preserve prior played continuations as variations only when play moves from a historical node, keep live and analysis paths valid, enforce takeback permissions, and restore clocks from the selected live node where required. This does not change `SCN-HIST-04`: an ordinary move from the latest live node still prunes the app user's exploratory analysis descendants.

### PREUI-06 — A move can resurrect an already expired clock

- **Severity:** High
- **Finding status:** Closed
- **Affected implementation:** [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts), [GameClockComposable.ts](../src/state/game/GameClockComposable.ts)
- **Problem:** Live move commitment applies the move and increment without first reconciling elapsed time. A move received after expiry but before the next UI clock update can be accepted and make the clock positive again.
- **Required outcome:** Reconcile the clock at the move boundary; an expired side must lose on time and receive neither the move nor increment.

### PREUI-07 — Analysis and status actions can overwrite terminal results

- **Severity:** High
- **Finding status:** Closed
- **Affected implementation:** [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts), [GameStatusComposable.ts](../src/state/game/GameStatusComposable.ts)
- **Problem:** Standalone analysis moves recalculate the position result, so analysis after resignation, an agreed draw, or checkmate can erase the recorded result. Resign and draw actions also lack consistent ongoing-game and live-position guards.
- **Required outcome:** Terminal result fields must be immutable during later analysis, and status commands must reject invalid mode, path, or completed-game transitions.

### PREUI-08 — Malformed UCI analysis can corrupt move input or terminate the session

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [NwjsUciEngineClient.ts](../src/platform/nwjs/NwjsUciEngineClient.ts), [GameRuleUtility.ts](../src/utility/chess/GameRuleUtility.ts)
- **Problem:** Principal-variation moves are expanded without validating every move against the evolving position. A malformed or illegal UCI analysis line can reach the analysis panel, be trusted by move handling, or throw through the engine session and terminate it.
- **Required outcome:** Treat engine output as untrusted: discard an invalid message, retain the last valid analysis result, and keep the session alive.

### PREUI-09 — Player-engine failures retry outside the state transition gate

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GamePlayerTurnComposable.ts](../src/state/game/GamePlayerTurnComposable.ts)
- **Problem:** An unexpected player-engine failure schedules an automatic timer retry. That timer can outlive the state that authorised it and request a stale turn. It also conflicts with the designed paused/unavailable state and explicit retry interaction.
- **Required outcome:** Route failures through a guarded state transition, stop automatic timer retries, expose the failure to the UI, and allow an explicit retry only when the turn is still eligible.

### PREUI-10 — Managed save identifiers can escape the save root

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [SavedGameIndexService.ts](../src/domain/SavedGameIndexService.ts), [SavedGamesStore.ts](../src/state/SavedGamesStore.ts)
- **Problem:** Raw game IDs and save names are concatenated into managed paths. Imported metadata and caller-provided names can contain traversal segments, while store writes do not consistently apply the save-options schema. A crafted import followed by autosave could write outside the managed save root.
- **Required outcome:** Validate every managed path segment and save option before filesystem access, resolve the final path, and reject any target outside the configured root.

### PREUI-11 — Restoring multiple games is all-or-nothing

- **Severity:** Medium
- **Finding status:** Confirmed
- **Affected implementation:** [SavedGamesStore.ts](../src/state/SavedGamesStore.ts)
- **Problem:** A missing or corrupt requested save rejects the whole restoration call, preventing valid games in the same request from being restored.
- **Required outcome:** Isolate each restoration target, return per-game outcomes, and retain every valid restored game.

### PREUI-12 — Assigning an analysis engine starts it during BoardEdit

- **Severity:** Medium
- **Finding status:** Confirmed
- **Affected implementation:** [GameAnalysisComposable.ts](../src/state/game/GameAnalysisComposable.ts)
- **Problem:** Adding an analysis engine starts analysis immediately even when the game is in BoardEdit. Refresh and retry paths contain a guard, but initial assignment does not.
- **Required outcome:** The assignment may be retained, but its runtime must not start until BoardEdit ends and the game is eligible for analysis.

### PREUI-13 — A resolving player turn can cross a terminal transition

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GameStatusComposable.ts](../src/state/game/GameStatusComposable.ts), [GamePlayerTurnComposable.ts](../src/state/game/GamePlayerTurnComposable.ts), [GameClockComposable.ts](../src/state/game/GameClockComposable.ts)
- **Problem:** Resignation, accepted draw, and timeout signal player-turn cancellation without joining it. If a local or engine move has already resolved, the shared handler can still commit it after the terminal state is recorded and overwrite that result.
- **Required outcome:** Await terminal-command cancellation where the caller does not own the active handler, and recheck live-turn eligibility immediately before every resolved player move commits. A terminal transition must leave no path for an accepted move to mutate live state.

## Plan for Fixing the Findings

### Temporary invariant assertion policy

Store assertions used by this pre-UI work are temporary diagnostics for exposing invalid state transitions; they are not intended as normal user-facing control flow. The UI must derive action availability from the same eligibility rules and prevent invalid chess actions through its controls. If a supported UI interaction reaches one of these assertions, including through a stale confirmation or asynchronous race, that is a UI/state-coordination bug to fix rather than an error prompt to show to the player. An assertion may be removed once the UI makes that invalid call unreachable and regression coverage protects the boundary, provided no non-UI caller still requires it.

### Phase 1 — Establish UI-facing application contracts

1. **PREUI-01: reactive shell/settings state**
   - Expose game-session and layout state as writable deep reactive values after their lazy loaders complete; UI state is current state and does not use a draft or clone-on-read boundary.
   - Keep modal state replaceable without cloning callback- or host-bearing payloads.
   - Expose accepted settings through a readonly reactive projection and maintain a separate deeply reactive mutable draft for validation and persistence flows.
   - Derive dirty state and the accepted appearance projection reactively, including an observable effective theme that updates when the system theme changes.
   - Cover tabs, active route, panels, folds, modals, and appearance with mounted-consumer reactivity tests.

**Phase exit:** The UI can render current shell and appearance state through reactive application contracts.

### Phase 2 — Protect game, history, result, and clock invariants

1. **PREUI-03: safe player reassignment**
   - Stop the old engine before replacing the seat assignment.
   - Cancel through an `AbortController`, reject the shared pending-turn promise with its abort reason, await the already-owned player-move handler, and let engine turn generation return early from its awaited move when signalled.
   - Preserve `attemptPlayerMove(...)` as the single settlement path for both local submission and accepted engine output.
   - Preserve the move tree, current node, position, clocks, and result when assigning `none` or a replacement player.
2. **PREUI-05: history and clock consistency**
   - Retain an old live continuation as a variation when play resumes from history.
   - Preserve automatic pruning of app-user analysis continuations when ordinary play resumes from the latest live node.
   - Enforce `allowTakeback` and constrain the new live path to a valid live ancestor.
   - Restore the selected node's clock snapshot with a fresh running timestamp where appropriate.
3. **PREUI-06: timeout race**
   - Reconcile elapsed time inside the guarded live-move transaction before applying a move.
   - Finalise timeout immediately and reject the late move and increment.
4. **PREUI-07: terminal-result protection**
   - Separate position-derived analysis state from the recorded game result.
   - Prevent analysis navigation or moves from mutating a terminal result.
   - Apply ongoing-game, live-path, and mode guards consistently to resign and draw commands.
5. **PREUI-13: terminal player-turn race**
   - Await cancellation from resignation and accepted-draw commands.
   - Recheck live-turn eligibility at the resolved player-move commit boundary so late local or engine output is discarded after any terminal transition.

**Phase exit:** Tree, path, clock, player, and result state remain mutually consistent across live play, history browsing, takeback, analysis, reassignment, and terminal games.

### Phase 3 — Make engine lifecycle transitions deterministic

1. **PREUI-04: restored player turn**
   - Complete hydration before evaluating the restored turn.
   - Reuse the normal guarded player-turn request path.
   - Make restoration idempotent so only one request can be armed.
2. **PREUI-08: untrusted UCI output**
   - Validate each principal-variation move against the evolving legal position.
   - Contain parse and legality failures at the individual message boundary.
   - Preserve the last valid result and continue the engine session after a discarded message.
3. **PREUI-09: explicit engine-failure recovery**
   - Remove timer-based automatic retries.
   - Stop the failed runtime and transition the seat/game to the designed unavailable or paused state.
   - Store a UI-readable failure and expose a guarded manual retry command.
4. **PREUI-12: BoardEdit analysis gate**
   - Use one eligibility predicate for add, refresh, retry, restore, and mode-change paths.
   - Retain configuration during BoardEdit without starting a process.
   - Start once, if still eligible, after leaving BoardEdit.

**Phase exit:** Engine processes start, stop, fail, recover, and restore only through current guarded state transitions, and malformed output cannot destabilise a session.

### Phase 4 — Harden persistence and partial recovery

1. **PREUI-10: managed-path containment**
   - Apply the save-options schema at every public store entry point.
   - Reject separators, traversal segments, rooted paths, and invalid managed identifiers.
   - Resolve and verify the final path remains under the managed save root before reading or writing.
   - Preserve the existing explicit external-file import boundary separately from managed saves.
2. **PREUI-11: isolated restoration**
   - Restore each requested game independently.
   - Return structured success and failure outcomes to support UI reporting.
   - Insert valid games even when another target is absent or corrupt.

**Phase exit:** Managed persistence is path-safe, and one damaged save cannot prevent other games from returning to the workspace.

### Verification and completion gate

The following design-derived scenarios are the minimum regression set. A finding is not complete until its relevant scenario is automated and passing:

1. A mounted UI consumer rerenders after tab, route, panel, fold, modal, explicit theme, and system-theme changes. Covers **PREUI-01**.
2. Reassigning engine to none preserves tree and position, stops the old runtime, and lets the owned player-turn work return on abort without an unhandled rejection. Covers **PREUI-03**.
3. A restore request containing valid, missing, and corrupt games retains the valid games and arms exactly one eligible restored engine turn. Covers **PREUI-04** and **PREUI-11**.
4. Rewriting from a historical node retains the old continuation as a variation and restarts the historical clock snapshot from the current timestamp. Covers **PREUI-05**.
5. A move arriving after clock expiry but before a UI update produces a timeout with no move or increment. Covers **PREUI-06**.
6. Navigating and analysing after resignation, agreed draw, and checkmate leaves all terminal result fields unchanged. Covers **PREUI-07**.
7. Malformed and illegal UCI analysis lines are ignored while the session and last valid result remain available. Covers **PREUI-08**.
8. Unexpected player-engine exit pauses or marks the seat unavailable, exposes a failure, and never automatically retries. Covers **PREUI-09**.
9. Traversal IDs and save names are rejected before any filesystem operation. Covers **PREUI-10**.
10. An analysis-engine assignment made during BoardEdit is retained without starting a runtime, then starts once after a valid mode exit. Covers **PREUI-12**.
11. A local or engine move resolving concurrently with resignation, accepted draw, or timeout never commits after the terminal result and its player-turn work settles without an unhandled rejection. Covers **PREUI-13**.

After the focused tests pass, run the complete unit suite, the application build, and the platform TypeScript check. Review the final diff for accidental changes to the intentionally deferred UI-dependent TODOs.

## Status Board

Last updated: 2026-09-04

Status values:

- **Finding:** `Confirmed`, `Re-evaluate`, `Closed`
- **Fix:** `Not started`, `In progress`, `Implemented`, `Blocked`, `Deferred`, `Not applicable`
- **Test:** `Missing`, `In progress`, `Passing`, `Not applicable`

| ID | Summary | Severity | Finding | Fix | Test | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PREUI-01 | Reactive shell/settings read models | Blocker | Closed | Implemented | Passing | Writable reactive shell state; readonly accepted settings and mutable validated draft |
| PREUI-02 | Engine-profile command surface | Not applicable | Closed | Not applicable | Not applicable | UI draft operations; configured profiles are read on demand |
| PREUI-03 | Safe player reassignment | High | Closed | Implemented | Passing | Preserves the tree, joins cancellation, and stops the old runtime |
| PREUI-04 | Resume restored engine turn | High | Closed | Implemented | Passing | Hydration and runtime registration precede one guarded turn request |
| PREUI-05 | History and clock consistency | High | Closed | Implemented | Passing | Retains previously played variations on history rewrite without disabling latest-node analysis pruning; guards takeback and restores historical clocks |
| PREUI-06 | Timeout reconciliation at move boundary | High | Closed | Implemented | Passing | Atomic live-move guard settles timeout before move or increment |
| PREUI-07 | Terminal-result protection | High | Closed | Implemented | Passing | Analysis cannot record results; result commands require the rendered live position of an ongoing game |
| PREUI-08 | Malformed UCI analysis isolation | High | Confirmed | Not started | Missing | Preserve last valid result and session |
| PREUI-09 | Guarded player-engine failure recovery | High | Confirmed | Not started | Missing | No timer-based retry |
| PREUI-10 | Managed-save path containment | High | Confirmed | Not started | Missing | Validate before filesystem access |
| PREUI-11 | Partial restore isolation | Medium | Confirmed | Not started | Missing | Return per-target outcomes |
| PREUI-12 | BoardEdit analysis start guard | Medium | Confirmed | Not started | Missing | Share eligibility predicate across entry points |
| PREUI-13 | Terminal player-turn cancellation | High | Confirmed | Not started | Missing | Join terminal-command cancellation and gate the final player-move commit |

Pre-UI completion requires every row to have `Finding: Closed`; confirmed findings must also have `Fix: Implemented` and `Test: Passing`, while findings closed without a required fix may use `Not applicable`.
