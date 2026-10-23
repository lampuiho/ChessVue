# Shared dialog flows

Shared dialogs mount through `useModal().open(Component, props, onClosed?)`. `App` initialises the app-scoped controller with `useModalProvider()`. The [modal design](../../../ModalComponentDesign.md) records exact function flows and scenarios.

The composable owns one mounted component, container, abort signal and close completion. Each mounted feature owns its form, busy/error feedback and actions. `ModalDialog` owns the shell, permitted dismissal events and focus containment. Simple confirmations use an awaited `confirm(signal)` prop; acknowledgements emit dismissal only.

| Flow | Component and entry point | Inputs and actions |
| --- | --- | --- |
| Custom game | `GameCreationModal`, Home/Game `_openCustomGame` | Existing `NewGameModal` form; `_createGame` validates required engines, creates, opens the tab and navigates. Game menu completion retains its captured pause owner |
| Prepared setup | `GameCreationModal`, Game `_requestSetupStart` | `gameId`; `_confirmSetupStart` validates and starts the prepared position |
| Promotion | `PromotionModal`, Chessboard `_commitTarget` | Legal raw candidates and colour; `selected(move)` returns through `moveAttempted` and GameView history confirmation before store submission |
| Resignation | `ConfirmationModal`, Game `_requestResignation` | Explicit callback to `resignGame`; Cancel/Resign |
| Local draw offer | `ConfirmationModal`, Game `_handleDraw` | `_offerDraw` awaits `offerDraw`, checks its signal and mounts `DrawResponseModal` |
| Draw response | `DrawResponseModal`, successful local offer | `gameId`, responding colour; `_acceptDraw`/`_declineDraw`. Requires an explicit response; no Escape/backdrop dismissal |
| Timeout | `MessageModal`, Game `_reconcileTimeout` | Recorded winner text; Review game. Existing per-game notification ownership prevents duplicates |
| Invalid import | `MessageModal`, SavedGames `_run` | Error message; Close. Invalid documents expose no partial-import continuation |
| Reset settings | `ConfirmationModal`, Settings `_requestResetSettings` | Callback to `resetSettings`; Cancel/Reset settings |
| Unsaved settings | `ConfirmationModal`, Settings `_requestDiscardChanges` | Captured target route; Keep editing/Discard changes. `_discardChangesAndNavigate` discards and navigates with the opening's signal |
| Blocked editing | `MessageModal`, Game `_toggleBoardEdit` | Explanation and Understood; no domain action |
| Player selection | `PlayerSelectionModal`, Game `_requestPlayerSelection` | `gameId`, colour, current player; keep/local/unassigned/profile choices, `_confirmPlayerSelection` |
| Analysis selection | `AnalysisEngineSelectionModal`, Game `_requestAnalysisEngine` | `gameId`, current copied engines; `_confirmAnalysisEngine` adds and retries the captured seat when eligible |

Player and analysis-engine configuration remain available while paused. Non-local draw opponents keep the existing pending-offer indicator and accept/withdraw control. In-game analysis exit remains prompt-free. Save overwrite/deletion and history continuation use `ConfirmationModal`; `EngineProfileModal` owns the settings editor and `NavigationMenuModal` owns the mobile drawer; the removed legacy DeleteGame kind had no production opener or rendered branch.

Replacement unmounts the previous owner before mounting the next, including the same component/props. A stale handle closes only its own opening. Closing or replacement aborts late UI delivery; already-started domain mutations retain their completion semantics. Root teardown suppresses unstarted close callbacks and removes detached DOM/listeners.
