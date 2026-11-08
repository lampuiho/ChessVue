# MessageModal

Source: [`src/components/modals/MessageModal.vue`](../../../../../../src/components/modals/MessageModal.vue)

## Purpose
Show an acknowledgement or error message with a single close action.

## Interface
- Props: `title: string`; `subtitle?: string`; `message: string`; `closeLabel?: string` [`'Close'`]; `error?: boolean` [`false`]; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Children: `ModalDialog`.
- Styles: `dialogs.css` (`.modal-copy`), `shared.css` (`.inline-message--error`).

## Notes
- `error` renders the message as an error block instead of body copy.
- Callers: `SavedGamesView` for invalid imports (`error`), and `GameControlPanel` for the defensive blocked board-edit explanation (*Understood*).
- The component declares `signal` only to consume the provider's uniform mount contract; it has no asynchronous work.
- Game-over notices, including timeouts, use `GameResultModal` instead.
