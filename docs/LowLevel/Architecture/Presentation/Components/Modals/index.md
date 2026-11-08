# Modal Components

## Purpose
Document the dialog shell and the components mounted through `useModal().open` from `src/components/modals`.

## Components
- [ModalDialog](ModalDialog.md): shared accessible dialog shell.
- [ConfirmationModal](ConfirmationModal.md): awaited confirmation of one caller-supplied action.
- [MessageModal](MessageModal.md): acknowledgement or error message.
- [GameCreationModal](GameCreationModal.md): custom game and start-from-setup form.
- [PlayerSelectionModal](PlayerSelectionModal.md): reassign one colour's seat.
- [AnalysisEngineSelectionModal](AnalysisEngineSelectionModal.md): add an analysis engine to a game.
- [DrawResponseModal](DrawResponseModal.md): accept or decline a local draw offer.
- [GameResultModal](GameResultModal.md): game-over announcement and next steps.
- [PromotionModal](PromotionModal.md): promotion piece chooser.
- [NavigationMenuModal](NavigationMenuModal.md): mobile navigation drawer.

See [Shared Dialog Flows](../../SharedDialogFlows.md) for every opener and [ModalComposable](../../Composables.md#modalcomposable) for the provider.

## Mount contract
- Callers open a component with `useModal().open(Component, props, onClosed?)`. `props` are the component's own props; the provider adds `signal: AbortSignal` and an `onDismissed` listener bound to that opening.
- Every mounted modal declares the `signal` prop and emits `dismissed()`. Emitting `dismissed` closes only its own opening: the provider aborts the signal, unmounts the component and runs the opener's `onClosed` once.
- Asynchronous modals check `signal` before any late navigation, follow-up modal or error display, and use `useModalAction(signal)` for busy, error and duplicate-submit handling.
- Each opening mounts a fresh instance, so form state is always local to one opening.
- Every modal except `NavigationMenuModal` renders inside `ModalDialog`, whose `dismissible` prop decides whether Escape, the backdrop and the close button may dismiss it.

## Rules
- Use a shared typed component (`ConfirmationModal`, `MessageModal`) for simple confirmations and acknowledgements, with the operation supplied by the caller. Use a dedicated component only for a form or distinct behaviour.
- Modals are reserved for confirmations, acknowledgements and single-choice pickers. Page-sized forms such as engine profiles and package import are routed views.
- A modal never closes whichever modal is current; it only emits `dismissed` for its own opening.
- Styles come from `dialogs.css`, plus shared buttons and fields from `shared.css`.
