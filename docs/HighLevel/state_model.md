# ChessVue State Model Contract

## Purpose
This document defines the authoritative state model for games and game-facing UI contexts.

The low-level rewrite must derive game context flags, mode transitions, and action permissions from this contract rather than inventing new state categories ad hoc.

## State Axes
ChessVue game behaviour is defined by four orthogonal state axes.

### 1. Workspace Kind
- `liveGame`: a real game with committed players and normal result handling
- `freeAnalysisSetup`: a non-live workspace created without players or entered through setup tooling

### 2. Interaction Context
- `currentPosition`: the user is on the current active node for the workspace
- `historyReview`: the user is inspecting an earlier node in the move tree
- `inGameAnalysis`: the user is exploring from a live game without progressing the live node
- `boardEdit`: direct piece placement/editing mode

### 3. Clock State
- `none`: no active time control applies
- `running`: a timed live game clock is active
- `paused`: a timed live game clock is intentionally suspended
- `expired`: timeout has produced a final result

### 4. Result State
- `ongoing`
- `drawn`
- `whiteWon`
- `blackWon`
- `resigned`
- `abandoned`

## Canonical Derived Contexts
The UI and stores may expose convenient derived contexts, but they must map back to the axes above.

| Derived Context | Required Axis Combination |
| --- | --- |
| Live play | `liveGame` + `currentPosition` + `ongoing` |
| Paused live play | `liveGame` + `currentPosition` + `paused` + `ongoing` |
| History review | `historyReview` in either workspace kind |
| In-game analysis mode | `liveGame` + `inGameAnalysis` + `ongoing` |
| Free analysis/setup | `freeAnalysisSetup` + `currentPosition` |
| Free analysis board edit | `freeAnalysisSetup` + `boardEdit` |
| Finished game | `liveGame` + final `resultState` |

## Entry Rules
### New Game Creation
- Quick new game creates a `liveGame`.
- Custom new game creates a `liveGame` if at least one side is assigned a player.
- Custom new game creates `freeAnalysisSetup` when neither side is assigned a player.

### Start Game From Setup
- Starting a real game from `freeAnalysisSetup` changes `workspaceKind` to `liveGame`.
- The prepared board becomes the starting position of the live game.
- The move tree created in setup remains available as the starting history of that game.
- Board editing is no longer available after the transition.

## Allowed Actions By Context
| Action | Live play | Paused live play | History review | In-game analysis | Free analysis/setup | Free analysis board edit | Finished game |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Make live move | Yes | No | Policy-driven from history | No | No | No | No |
| Make analysis move | No | No | Policy-driven from history | Yes | Yes | No | No |
| Navigate history | Yes | Yes | Yes | Yes | Yes | No | Yes |
| Enter board edit | No | No | No | No | Yes | Already active | No |
| Start/stop analysis engines | Yes | Yes | Yes | Yes | Yes | After edit confirm | Yes |
| Pause/resume clock | Timed only | Resume only | No | No | No | No | No |
| Resign or offer draw | Yes | Yes | No | No | No | No | No |
| Prune future moves | Policy-driven | Policy-driven | Yes | Yes | Yes | No | Review only |

## Transition Rules
### History Review
- Navigating to an earlier node enters `historyReview`.
- Returning to the latest committed node exits `historyReview` and restores `currentPosition`.
- From `historyReview`, making a move follows the takeback and branch rules defined in [settings_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings_contract.md).

### In-Game Analysis
- Entering in-game analysis is allowed only from a `liveGame`.
- If the live game clock is running, the app must pause it before entering `inGameAnalysis`.
- In-game analysis gives the user move control for both colours, but those moves do not advance the live node.
- Exiting in-game analysis returns the board to the live node by default.
- If there is a kept analysis branch, the branch remains in the move tree, but the visible game screen returns to the live node unless a future promoted rule says otherwise.
- Board editing is always blocked while `inGameAnalysis` is active.

### Free Analysis / Setup
- `freeAnalysisSetup` allows legal move exploration for both colours.
- Board editing is only available inside `freeAnalysisSetup`.
- Confirming a board edit replaces the current board root and clears prior move history for that workspace.
- Cancelling a board edit restores the previous free-analysis position unchanged.

### Pausing and Interruptions
- Menu-driven interruptions in timed games follow the auto-pause behaviour from [settings_contract.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/settings_contract.md).
- Auto-resume is allowed only when the same interruption flow caused the pause.
- Manual pause remains paused until the user explicitly resumes.

### Finished Games
- Timeout, resignation, or accepted draw change `resultState` to final.
- Final states block further live moves and all result-changing controls.
- History navigation and non-mutating review remain available after the game ends.
- In-game analysis may still be allowed after timeout if the scenario requires post-game exploration, but it must not change the stored result.

## Clock Rules
- Clocks apply only to `liveGame`.
- `freeAnalysisSetup`, `historyReview`, and `boardEdit` never consume live clock time.
- `inGameAnalysis` never consumes live clock time.
- Clock drift must be corrected from relative timing data rather than UI tick counts.
- Timeout sets `clockState` to `expired` and finalises the game once.

## Ownership Boundaries
- `workspaceKind`, interaction context, clock state, and result state are game-related and must be represented in the game model or state derived directly from it.
- Session shell state such as active route and open tabs belongs to the session/UI state model, not to the game model.
- Modal visibility is transient UI behaviour and is not part of the canonical game state contract.

## Non-Baseline Exclusions
The following are not part of this contract and are tracked in [ideas.md](/d:/CodeFiddle/ChessVue/docs/HighLevel/ideas.md):

- variant-specific state rules
- engine-vs-engine autonomous move loops
- network or remote player state
- analysis undo/redo stacks
