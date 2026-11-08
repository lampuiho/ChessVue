# NavigationMenuModal

Source: [`src/components/modals/NavigationMenuModal.vue`](../../../../../../src/components/modals/NavigationMenuModal.vue)

## Purpose
Render the mobile navigation drawer with the opening frame's own brand, actions and footer.

## Interface
- Props: `content: Slots`, the opening `NavigationFrame`'s slots; `signal: AbortSignal`.
- Emits: `dismissed()`. Slots: none.

## Dependencies
- Directive: `vFocusScope`.
- Children: `AppIcon`.
- Styles: `navigation.css` (`.navigation-overlay`, `.navigation-drawer`).

## Notes
- The drawer renders `content.brand`, `content.default` and `content.footer` through small render functions, so actions run with their original closures and state.
- A click anywhere in the brand, actions or footer regions dismisses the drawer after the action handles it. The close button, Escape and a backdrop press also dismiss it.
- The drawer is its own focus surface (`role="dialog"`, `aria-modal`) rather than a `ModalDialog`, because its layout is a side drawer, not a centred card.
- Dismissal closes only this opening; `NavigationFrame` clears its handle in `onClosed` and closes the drawer when it unmounts. Opening any other modal replaces the drawer.
- The component declares `signal` to consume the provider's uniform mount contract.
