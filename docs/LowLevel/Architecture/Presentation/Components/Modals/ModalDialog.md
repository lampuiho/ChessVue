# ModalDialog

Source: [`src/components/modals/ModalDialog.vue`](../../../../../../src/components/modals/ModalDialog.vue)

## Purpose
Provide the accessible dialog shell shared by every confirmation, form, message and chooser modal.

## Interface
- Props: `title: string`; `subtitle?: string`; `wide?: boolean`; `dismissible?: boolean` [`true`].
- Emits: `dismissed()`.
- Slots: default (body) and `actions` (footer, rendered only when supplied).

## Dependencies
- Directive: `vFocusScope`.
- Children: `AppIcon`.
- Styles: `dialogs.css` (`.modal-backdrop`, `.modal-card`, `.modal-card--wide`, `.modal-card__header`, `.modal-card__body`, `.modal-card__actions`).

## Notes
- The card has `role="dialog"`, `aria-modal="true"` and `aria-label` from `title`, and owns a focus scope that contains Tab focus and restores the opener on close.
- When `dismissible`, a backdrop press, Escape and the close button emit `dismissed`; otherwise all three are inert and the close button is hidden. The shell never decides what dismissal means: the feature component handles `dismissed`, applies its own policy (for example, no dismissal while working) and then emits its own `dismissed` to the provider.
- `wide` widens the card for the creation form.
- Feature modals put their actions in the `actions` slot using shared `.text-button` variants.
- Modal visibility is not state in this component or in any store; an opening exists exactly while the provider has it mounted.
