# ChessVue State Model Contract

## Purpose
This document defines the authoritative state model for games and game-facing UI contexts.

The low-level rewrite must derive action permissions and transitions from this contract rather than recreating the older multi-axis model.

## Game State
Premoves are optional runtime input for a Local seat against an Engine. `game.$.premoveQueue` contains the actual local player reference and a FIFO of existing `IMoveRaw` references. They create no history nodes or game states. Each existing local-turn request resolves one actual legal head through `attemptPlayerMove`; an invalid dependency clears the whole FIFO. Explicit analysis and history remain independent while actual clocks/turns continue. Canonical positions exclude premoves; only artwork/red endpoints are projected. See the [implemented flow](../LowLevel/ProcessFlows/GameplayAndControl.md#scn-move-04---premoves-through-the-existing-turn-request).

ChessVue game behaviour is defined by one authoritative `GameState` enum plus separate result fields.

### Live States
- `LiveWhiteTurn`
- `LiveBlackTurn`
- `PausedWhiteTurn`
- `PausedBlackTurn`

### Live Analysis States
- `LiveAnalysisFromWhiteTurnWhiteMove`
- `LiveAnalysisFromWhiteTurnBlackMove`
- `LiveAnalysisFromBlackTurnWhiteMove`
- `LiveAnalysisFromBlackTurnBlackMove`
- `PausedLiveAnalysisFromWhiteTurnWhiteMove`
- `PausedLiveAnalysisFromWhiteTurnBlackMove`
- `PausedLiveAnalysisFromBlackTurnWhiteMove`
- `PausedLiveAnalysisFromBlackTurnBlackMove`

### Non-Live Analysis States
- `AnalysisWhiteMove`
- `AnalysisBlackMove`
- `BoardEdit`

### Position Check State
- `CheckState.Check` and `CheckState.Checkmate` are derived chess facts, not `GameState` values.
- The currently materialised position may cache its derived value in `IBoardPosition.$.checkState`; `isCheckStateCached` distinguishes a cached no-check result from a value that has not been calculated.
- A completed `IMove` persists its resulting `checkState` so notation and history can describe check or checkmate without reconstructing the destination position.

## Result Fields
- `resultState` records outcome only.
- `resultReason` records why that outcome happened.
- An omitted `resultReason` is valid only while the result is ongoing.
- Checkmate, draw, resignation, timeout, and abandonment do not create an extra terminal `GameState`. They record the result, end live play, and leave the game in `AnalysisWhiteMove` or `AnalysisBlackMove`.
- A non-ongoing `resultState`, together with the resulting analysis state, blocks further live moves.

## State Meaning
- `Live*Turn` means ordinary play or history review; the named side is currently due in actual play. Only shared path references make the selected board follow actual play.
- `Paused*Turn` means actual play is suspended. Actual moves, Takeback and result actions stay locked; explicit Analyse entry, player reassignment and analysis-engine actions remain available.
- `LiveAnalysisFrom*` means the game still has a committed live turn anchor, but the visible board is exploring analysis moves instead of progressing the live node.
- `PausedLiveAnalysisFrom*` means the same live-analysis context exists while live clock progression remains paused.
- In `LiveAnalysisFromWhiteTurnBlackMove`, for example, White is currently due in actual play, but the current analysis board has Black to move.
- `AnalysisWhiteMove` and `AnalysisBlackMove` cover free analysis/setup and post-result non-live analysis.
- `BoardEdit` is direct free edit from the current visible board, applies board changes immediately, and is never a live state.

## Game And Player Ownership
- `IGame` owns the seated `IPlayer` values for white and black.
- `IPlayer` state is intentionally minimal: `active` or `nonActive`.
- `nonActive` covers disconnected participants, unavailable engines, or any other seat that has left normal participation.
- Turn ownership and move permissions are derived from `gameState`, not stored on the player.
- Runtime-only seat availability belongs under `IPlayer.$`, while engine-specific runtime such as process handle, availability, and last error belongs under the copied engine payload stored on an engine-backed player.

## Per-Game Analysis Display Preference
- A live game owns a persisted per-game preference `showLiveAnalysisMoves`.
- This preference belongs to the saved game workspace, not to global settings or remembered UI layout state.
- `showLiveAnalysisMoves` defaults to `false` whenever a live game is created or started from setup.
- The preference is chosen only when a live game is created or when non-live analysis transitions into a live game through start-from-setup.

## Entry Rules
### New Game Creation
- Quick new game creates `LiveWhiteTurn`.
- Custom new game creates a live state only when both sides are assigned.
- Custom new game creates `AnalysisWhiteMove` or `AnalysisBlackMove` when either side is assigned `none`, based on the prepared board side to move.
- When custom new game creates a live state, it also records the per-game `showLiveAnalysisMoves` choice for that game.

### Start Game From Setup
- Starting a real game from non-live analysis changes the game into `LiveWhiteTurn` or `LiveBlackTurn` based on the prepared board side to move.
- The prepared board becomes the starting position of the live game.
- The move tree created in setup remains available as the starting history of that game.
- Board editing is no longer available after the transition.
- Both sides must be assigned before the transition can start.
- Starting from setup applies a newly chosen time control and resets live clock state from that fresh start point.
- Starting from setup also records the per-game `showLiveAnalysisMoves` choice for the resulting live game.

### Player Reassignment
- Reassigning a player seat from the player strip may choose `none`, `local`, or a configured engine profile.
- If either side becomes `none`, the current live game leaves live play and becomes `AnalysisWhiteMove` or `AnalysisBlackMove` based on the visible board side to move.
- That transition keeps the prepared board and move-tree history, but clears live-only progression.
- If both sides are assigned again from non-live analysis, the next committed start uses a newly chosen time control and fresh live state.

## Allowed Actions By State Family
| Action | Live | Paused Live | Live Analysis | Paused Live Analysis | Analysis | Board Edit |
| --- | --- | --- | --- | --- | --- | --- |
| Make live move | Yes | No | Background actual turn | No | No | No |
| Make analysis move | No | No | Yes | Yes | Yes | No |
| Navigate history | Yes | No | Yes | Yes | Yes | No |
| Enter board edit | No | No | No | No | Yes | Already active |
| Start or stop analysis engines | Yes | Yes | Yes | Yes | Yes | After board edit ends |
| Reassign players | Yes | Yes | Yes | Yes | Yes | No |
| Background engine evaluation | N/A | Current in-flight search may finish only | N/A | Current in-flight search may finish only | N/A | N/A |
| Pause or resume clock | Timed only | Resume only | Pause or resume only when clocked live analysis is active | Resume only | No | No |
| Resign or offer draw | Yes | No | No | No | No | No |
| Prune future moves | Policy-driven | No | Yes | No | Yes | No |

The UI must enforce this matrix through control visibility and enablement so players cannot request actions that chess rules or the current mode disallow. Store assertions are temporary invariant diagnostics during pre-UI implementation, not expected user errors. Reaching one through a supported UI interaction is a UI/state-coordination bug and must not be presented as an error prompt.

## Analysis Panel Rendering
| State Family | Analysis score or status | Analysis move list | Move-target click result |
| --- | --- | --- | --- |
| Live | Yes | Only when `showLiveAnalysisMoves = true` | Commit a normal live move |
| Paused Live | Yes | Read-only only when already supported by the current UI | No move commit |
| Live Analysis | Yes | Only when `showLiveAnalysisMoves = true` | Apply analysis moves without advancing the live node |
| Paused Live Analysis | Yes | Only when `showLiveAnalysisMoves = true` | Apply analysis moves; actual play stays paused |
| Analysis | Yes | Yes | Apply analysis moves |

Score-only rendering is titled Evaluations, with engine names on the left and scores on the right. It has no panel or engine folds and no status/depth summary. Engines keep evaluating independently. Move-enabled Analysis retains folding and three lines per engine.

## Transition Rules
### History Navigation
- Navigating to an earlier node gives `renderedPath` an independent selector from `livePath`.
- Returning to the live node restores `renderedPath` to the exact `livePath` reference so live appends advance both selections.
- Ordinary history review keeps the ordinary live state and actual turn. Historical input requires Takeback permission and existing confirmation to rewrite actual play; otherwise press Analyse before exploratory input.

### Live Analysis
- Explicit Analyse starts at the selected canonical move from ordinary live or paused live play. Existing terminal review preserves the final result.
- Entering live analysis detaches the rendered-path reference even when the rendered and live selectors initially identify the same node.
- Entry and Exit never pause/resume actual clocks or cancel/restart actual turns. Actual progression continues behind independent selection; genuinely paused entry uses `PausedLiveAnalysisFrom*` without releasing any pause owner.
- Live analysis gives the user move control for both colours, but those moves do not advance the live node.
- Exiting live analysis returns the board highlight to the live node and restores the shared live-path reference by default.
- If there is a kept analysis branch, the branch remains in the move tree, but the default visible state returns to the live node.
- Board editing is always blocked while a `LiveAnalysisFrom*` state is active.

### Non-Live Analysis And Setup
- `AnalysisWhiteMove` and `AnalysisBlackMove` allow legal move exploration for both colours.
- Board editing is available only from non-live analysis.
- The first direct board edit in a `BoardEdit` session replaces the current board root and clears prior move history for that game.
- Later board edits in the same `BoardEdit` session continue mutating that new root without a separate confirm step.
- Reaching non-live analysis from player reassignment keeps the visible board context and prior move tree available for review and later restart.

### Pausing And Interruptions
- Menu-driven interruptions in timed games follow the auto-pause behaviour from [settings_contract.md](settings_contract.md).
- Manual/Menu pauses block actual moves, Takeback and result actions. Explicit Analyse entry, analysis moves/history and Exit remain available; ordinary paused history remains locked. Resume stays reachable alongside paused Analyse/Exit.
- Actual engine output arriving during a genuine pause is held by its existing owner. Entry/Exit and removing a non-final owner never flush it. Final Resume releases it once, including while analysis remains selected. Analysis-engine management remains available outside board edit.
- A player-engine move produced while paused has already been validated at the engine-result boundary and is deferred until resume. It commits only if the live turn is still ready; otherwise it is discarded. **Why:** pause cannot change the live position and ownership-changing actions clear the turn runtime, so repeating legality or pondering would duplicate work and could start the same engine side effect twice.
- Paused live-analysis states preserve the same live anchor and visible analysis side-to-move information as their unpaused `LiveAnalysisFrom*` counterparts.
- Auto-resume is allowed only when the same interruption flow caused the pause.
- Manual pause remains paused until the user explicitly resumes.
- Restored paused live games reconstruct Manual ownership because runtime owners are not persisted. Restored paused live-analysis games also reconstruct Manual only. Explicit Resume restarts actual play while analysis remains selected; Menu return and Exit cannot clear Manual.

### Terminal Results
- Timeout, resignation, accepted draw, or abandonment set `resultState` and `resultReason`, then leave live play for analysis.
- Checkmate sets the winning `resultState`, keeps `resultReason = ruleResolved`, records `CheckState.Checkmate` on the detailed move and derived position cache, and moves the game into the analysis state for the resulting side to move.
- Result fields remain persisted during later analysis and review.

### Draw Offer State
- A live game may carry unresolved `drawOfferState`.
- An omitted `drawOfferState` means no unresolved draw offer exists for the current game.
- Local-local draw negotiation still uses explicit `drawOffer` and `drawResolve` dialogs, but the unresolved offer remains game-owned state until it is accepted or declined.
- For non-local opponents, any unresolved incoming or outgoing draw offer keeps the `Draw` control in its lit pending-offer state without introducing a dialog-hosted response step.
- While that non-local pending-offer indicator is lit, pressing `Draw` accepts an incoming offer or withdraws an outgoing offer only when the game is in a playable live state. In paused live play the indicator is read-only until resume.

## Clock Rules
- Ongoing live games consume time during play, ordinary history review and game-tab switches. Explicit Analyse also keeps actual time and turns running unless a genuine Manual/Menu pause is active.
- Non-live analysis, board edit and terminal result states never consume live clock time.
- Paused live states suspend clock consumption but do not require an already running engine search to stop before it yields its current best line.
- UI timer loops are render cadence only; authoritative remaining-time reads come from relative timing data through the time-control service.
- Clock drift must be corrected from relative timing data rather than UI tick counts.
- Timeout finalises the result once, then leaves live play for analysis.
- Concurrent timer/focus checks share one pending timeout settlement, cancelling the old turn before finalisation. Each timeout occurrence has one transient game-owned notification; route remounts and tab switches do not repeat a dismissed notification, and takeback permits a new occurrence.

## Ownership Boundaries
- `gameState`, `resultState`, `resultReason`, unresolved `drawOfferState`, persisted analysis, and the per-game `showLiveAnalysisMoves` preference are game-related and must be represented in the game model or state derived directly from it.
- Session shell state such as active route and open tabs belongs to the session/UI state model, not to the game model.
- Modal visibility is transient UI behaviour and is not part of the canonical game state contract.

## Non-Baseline Exclusions
The following are not part of this contract and are tracked in [ideas.md](ideas.md):

- variant-specific state rules
- network or remote player state
- analysis undo/redo stacks
