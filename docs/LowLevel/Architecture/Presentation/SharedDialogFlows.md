# Shared dialog flows

Dialogs mount through `useModal().open(Component, props, onClosed?)`. App initialises one provider. The [modal lifecycle design](../../../ArchivedPlans/ModalComponentDesign.md) records captured mounted-owner replacement and completion; the current feature boundaries are below.

Each opening receives its own signal and emits `dismissed` to that owner. The provider aborts, unmounts and settles its completion once. ModalDialog owns the accessible shell and permitted dismissal/focus behaviour. `useModalAction(signal)` shares busy/error/retry and duplicate-submit handling across feature forms and ConfirmationModal; it never closes whichever modal happens to be current. Confirmation callbacks are awaited, rather than emitted to an unawaited async listener.

| Flow | Owner and entry point | Inputs and actions |
| --- | --- | --- |
| Custom game | GameCreationModal, Home/Game custom action | Local form, engine-readiness validation, create/open-tab/navigation. GameView retains the captured Menu-pause completion. |
| Prepared setup | GameCreationModal, GameControlPanel setup action | Optional gameId targets the prepared game; the same local form validates and starts it. |
| Promotion | PromotionModal, Chessboard target action | Raw legal/premove candidates and colour; selected returns to the board's exact pending gesture and then GameView input. |
| Resignation | ConfirmationModal, GameControlPanel | Captured game and actual live colour; awaited public resignGame coordination. |
| Local draw offer | ConfirmationModal, GameControlPanel | Await offerDraw, check the opening signal, then open DrawResponseModal. |
| Draw response | DrawResponseModal | gameId; captures the actual offer and derives responding colour. Missing/replaced offers dismiss; submission checks identity before existing public acceptance/decline. No Escape/backdrop dismissal. |
| Timeout | MessageModal, GameView clock reconciliation | Recorded winner and Review game label; existing per-game notification ownership. |
| Invalid import | MessageModal, SavedGamesView | Import failure feedback without a partial-document continuation. |
| Reset/unsaved settings | ConfirmationModal, SettingsView | Awaited reset or captured discard-and-navigate action; failed writes do not apply appearance. |
| Blocked editing | MessageModal, GameControlPanel | Explanation before any prohibited board-edit action. |
| Player selection | PlayerSelectionModal, PlayerPanel | gameId and colour; derive the opening's initial seat locally and preserve copied engine assignments. |
| Analysis selection | AnalysisEngineSelectionModal, AnalysisPanel | gameId; filter canonical assignments, add the chosen engine and retry the captured seat when eligible. |
| Save overwrite/deletion/history continuation | ConfirmationModal, owning route view | Await the captured target action; overwrite retains its dismissal lock while writing. |
| Engine profile | EngineProfileModal, SettingsView | Editable seed and optional replacement index distinguish Copy from Edit. |
| Mobile navigation | NavigationMenuModal, NavigationFrame | Shared slot closures and the opening's lifetime; selection/dismissal closes only that owner. |

Player and analysis configuration stay available during genuine pauses; ordinary gameplay input remains locked. Non-local draw offer accept/withdraw stays in GameControlPanel. In-game analysis exit remains prompt-free.

DrawResponse's ownership check is at opening/submission time. GamesStore.acceptDrawOffer currently awaits turn cleanup without an offer-identity recheck; this component refactor makes no stronger guarantee for that existing store operation. Already-started domain mutations retain their completion semantics. Replacement/disposal suppresses late UI delivery and removes owned DOM/listeners.
