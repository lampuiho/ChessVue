# Pre-UI Implementation Follow-Up

This document tracks the implementation work required before starting the UI layer. It converts the current implementation review into stable finding IDs, a remediation plan, and a status board that can be updated as each fix and its verification land.

The following existing TODOs remain intentionally deferred until UI implementation makes their boundaries clearer:

- Redesigning deferred player-move and pause-turn behaviour for premoves in [NewToDoList.md](NewToDoList.md).
- Defining the board interaction boundary for `IMoveRaw`, promotion selection, and conversion to `IMove` in [CodexFollowUp.md](CodexFollowUp.md).

## Findings

### PREUI-01 — Shell and settings state do not expose reactive UI read models

- **Severity:** Blocker
- **Finding status:** Confirmed
- **Affected implementation:** [UiStateStore.ts](../src/state/UiStateStore.ts), [SettingsStore.ts](../src/state/SettingsStore.ts)
- **Problem:** UI state is held in shallow refs, while nested state is mutated in place and several reads return asynchronous cloned snapshots. A Vue consumer cannot reliably react to tab, panel, section, engine-fold, route, modal, or appearance changes. System-theme changes also have no observable projection for the UI.
- **Required outcome:** The UI must be able to consume stable reactive read models without polling or re-fetching cloned snapshots after every command.

### PREUI-02 — Engine-profile commands required by the UI are missing

- **Severity:** Blocker
- **Finding status:** Confirmed
- **Affected implementation:** [EnginesStore.ts](../src/state/EnginesStore.ts), [scenarios.md](HighLevel/scenarios.md)
- **Problem:** The engine store exposes listing, lookup, metadata, and validation, but has no committed add, copy, update, delete, persistence, or player-creation workflow. The engine-management scenarios therefore have no application boundary for the UI to call.
- **Required outcome:** Expose complete, validated engine-inventory commands and a reactive inventory read model, including persistence and uniqueness behaviour.

### PREUI-03 — Player reassignment can discard history and leave an engine running

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GamePlayerTurnComposable.ts](../src/state/game/GamePlayerTurnComposable.ts), [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts)
- **Problem:** Removing a player replaces the game with an analysis root, which loses the existing move tree. The previous engine runtime is not explicitly stopped, and reassignment is not rejected while the game is in BoardEdit mode.
- **Required outcome:** Reassignment must preserve the tree and current position, stop or replace the old runtime deterministically, and enforce the BoardEdit guard.

### PREUI-04 — Restored engine-controlled games can stall

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GameWorkspaceComposable.ts](../src/state/game/GameWorkspaceComposable.ts)
- **Problem:** Restoring a game hydrates it and may restart analysis, but it does not re-arm the player engine when the restored position is waiting for an engine-controlled side.
- **Required outcome:** Restoration must request exactly one eligible engine turn after all state and runtime prerequisites are ready.

### PREUI-05 — History navigation, rewrite, takeback, and clock state can diverge

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts), [GamesStore.spec.ts](../src/state/__tests__/GamesStore.spec.ts)
- **Problem:** Rewriting from history prunes the old continuation instead of retaining it as a variation. Takeback ignores `allowTakeback`, does not restore the target node's clock snapshot, and can place the live path on an analysis branch. Navigating away from the live node does not pause a running timed clock. One current test encodes the incorrect continuation-pruning behaviour.
- **Required outcome:** Preserve prior continuations as variations, keep live and analysis paths valid, enforce takeback permissions, and restore or pause clocks according to the selected node and mode.

### PREUI-06 — A move can resurrect an already expired clock

- **Severity:** High
- **Finding status:** Confirmed
- **Affected implementation:** [GameMoveComposable.ts](../src/state/game/GameMoveComposable.ts), [GameClockComposable.ts](../src/state/game/GameClockComposable.ts)
- **Problem:** Live move commitment applies the move and increment without first reconciling elapsed time. A move received after expiry but before the next UI clock update can be accepted and make the clock positive again.
- **Required outcome:** Reconcile the clock at the move boundary; an expired side must lose on time and receive neither the move nor increment.

### PREUI-07 — Analysis and status actions can overwrite terminal results

- **Severity:** High
- **Finding status:** Confirmed
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

## Plan for Fixing the Findings

### Phase 1 — Establish UI-facing application contracts

1. **PREUI-01: reactive shell/settings state**
   - Replace cloned asynchronous UI reads with readonly reactive projections or stable computed values.
   - Ensure nested mutations publish changes, either through deep reactive state or immutable replacement.
   - Add an observable effective-theme value that updates when the system theme changes.
   - Cover tabs, active route, panels, folds, modals, and appearance with mounted-consumer reactivity tests.
2. **PREUI-02: engine inventory**
   - Define store commands for add, copy, update, delete, and engine-player creation.
   - Apply engine validation and name/identifier uniqueness rules at the store boundary.
   - Persist successful mutations and expose a reactive ordered engine list.
   - Test successful mutations, rejected duplicates, persistence failures, and consumer updates.

**Phase exit:** The UI can render current shell, appearance, and engine-inventory state and invoke every committed engine-management action without reaching into lower layers.

### Phase 2 — Protect game, history, result, and clock invariants

1. **PREUI-03: safe player reassignment**
   - Centralise reassignment eligibility and reject it in BoardEdit.
   - Stop the old engine before replacing the seat assignment.
   - Preserve the move tree, current node, position, clocks, and result when assigning `none` or a replacement player.
2. **PREUI-05: history and clock consistency**
   - Retain an old live continuation as a variation when play resumes from history.
   - Enforce `allowTakeback` and constrain the new live path to a valid live ancestor.
   - Restore the selected node's clock snapshot with a fresh running timestamp where appropriate.
   - Pause timed play while browsing or analysing away from the live node.
3. **PREUI-06: timeout race**
   - Reconcile elapsed time inside the guarded live-move transaction before applying a move.
   - Finalise timeout immediately and reject the late move and increment.
4. **PREUI-07: terminal-result protection**
   - Separate position-derived analysis state from the recorded game result.
   - Prevent analysis navigation or moves from mutating a terminal result.
   - Apply ongoing-game, live-path, and mode guards consistently to resign and draw commands.

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
2. Engine profiles can be added, copied, edited, deleted, persisted, listed reactively, and rejected on uniqueness violations. Covers **PREUI-02**.
3. Reassigning engine to none preserves tree and position, stops the old runtime, and is rejected in BoardEdit. Covers **PREUI-03**.
4. A restore request containing valid, missing, and corrupt games retains the valid games and arms exactly one eligible restored engine turn. Covers **PREUI-04** and **PREUI-11**.
5. Rewriting from a historical node retains the old continuation as a variation and restarts the historical clock snapshot from the current timestamp. Covers **PREUI-05**.
6. A move arriving after clock expiry but before a UI update produces a timeout with no move or increment. Covers **PREUI-06**.
7. Navigating and analysing after resignation, agreed draw, and checkmate leaves all terminal result fields unchanged. Covers **PREUI-07**.
8. Malformed and illegal UCI analysis lines are ignored while the session and last valid result remain available. Covers **PREUI-08**.
9. Unexpected player-engine exit pauses or marks the seat unavailable, exposes a failure, and never automatically retries. Covers **PREUI-09**.
10. Traversal IDs and save names are rejected before any filesystem operation. Covers **PREUI-10**.
11. An analysis-engine assignment made during BoardEdit is retained without starting a runtime, then starts once after a valid mode exit. Covers **PREUI-12**.

After the focused tests pass, run the complete unit suite, the application build, and the platform TypeScript check. Review the final diff for accidental changes to the intentionally deferred UI-dependent TODOs.

## Status Board

Last updated: 2026-09-01

Status values:

- **Finding:** `Confirmed`, `Re-evaluate`, `Closed`
- **Fix:** `Not started`, `In progress`, `Implemented`, `Blocked`, `Deferred`
- **Test:** `Missing`, `In progress`, `Passing`, `Not applicable`

| ID | Summary | Severity | Finding | Fix | Test | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PREUI-01 | Reactive shell/settings read models | Blocker | Confirmed | Not started | Missing | First UI-readiness dependency |
| PREUI-02 | Engine-profile command surface | Blocker | Confirmed | Not started | Missing | First UI-readiness dependency |
| PREUI-03 | Safe player reassignment | High | Confirmed | Not started | Missing | Preserve tree and stop old runtime |
| PREUI-04 | Resume restored engine turn | High | Confirmed | Not started | Missing | Coordinate with PREUI-09 and PREUI-11 |
| PREUI-05 | History and clock consistency | High | Confirmed | Not started | Missing | Replace conflicting continuation-pruning test |
| PREUI-06 | Timeout reconciliation at move boundary | High | Confirmed | Not started | Missing | Atomic live-move guard |
| PREUI-07 | Terminal-result protection | High | Confirmed | Not started | Missing | Cover all terminal result types |
| PREUI-08 | Malformed UCI analysis isolation | High | Confirmed | Not started | Missing | Preserve last valid result and session |
| PREUI-09 | Guarded player-engine failure recovery | High | Confirmed | Not started | Missing | No timer-based retry |
| PREUI-10 | Managed-save path containment | High | Confirmed | Not started | Missing | Validate before filesystem access |
| PREUI-11 | Partial restore isolation | Medium | Confirmed | Not started | Missing | Return per-target outcomes |
| PREUI-12 | BoardEdit analysis start guard | Medium | Confirmed | Not started | Missing | Share eligibility predicate across entry points |

Pre-UI completion requires every row to have `Finding: Closed`, `Fix: Implemented`, and `Test: Passing`, with the full validation suite passing.
