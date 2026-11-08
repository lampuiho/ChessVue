# ConfirmationModal

Source: [`src/components/modals/ConfirmationModal.vue`](../../../../../../src/components/modals/ConfirmationModal.vue)

## Purpose
Confirm one caller-supplied action, show its progress and failure, and close only after it succeeds.

## Interface
| Prop | Type | Default | Meaning |
| --- | --- | --- | --- |
| `title` | `string` | | Dialog title |
| `subtitle?` | `string` | | Context line |
| `message?` | `string` | | Body copy |
| `confirmLabel` | `string` | | Confirm button text |
| `cancelLabel?` | `string` | `'Cancel'` | Cancel button text (Settings uses *Keep editing*) |
| `danger?` | `boolean` | `false` | Destructive styling for the confirm button |
| `dismissibleWhileWorking?` | `boolean` | `true` | When false, cancel and every dismissal are disabled while the action runs |
| `signal` | `AbortSignal` | | Provider-supplied opening lifetime |
| `confirm` | `(signal: AbortSignal) => Promise<void>` | | The action to await |

- Emits: `dismissed()`. Slots: none.

## Dependencies
- Composables: `useModalAction`.
- Children: `ModalDialog`.
- Styles: `dialogs.css` (`.modal-copy`), `shared.css` buttons and messages.

## Notes
- Confirm runs `confirm(signal)` through `useModalAction`: duplicate activation starts one operation, failures stay visible for retry, and success dismisses the opening if it is still live.
- `confirm` is an awaited prop rather than an emitted event because Vue does not await asynchronous listeners; the modal needs the settled result to show busy and error feedback and to close only afterwards.
- Callers: historical continuation (`GameView`), resignation and local draw offer (`GameControlPanel`), settings reset and unsaved-changes discard (`SettingsView`), save overwrite, save deletion and game deletion (`SavedGamesView`) and engine file removal (`EnginePackageDetailsView`).
- Save overwrite and engine file removal set `dismissibleWhileWorking: false`, so dismissal and focus restoration wait until the operation releases its working state. Other confirmations allow cancellation; their callers check `signal` to suppress late UI delivery.
- The draw offer's `confirm` opens `DrawResponseModal`, which replaces this opening; the replaced confirmation's late result is ignored.
