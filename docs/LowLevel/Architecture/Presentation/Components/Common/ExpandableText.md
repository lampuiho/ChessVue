# ExpandableText

Source: [`src/components/common/ExpandableText.vue`](../../../../../../src/components/common/ExpandableText.vue)

## Purpose
Show a single line of text truncated to its container and reveal the full content in a popover that covers the original line in place.

## Interface
- Props: `text: string`; `label?: string`, the accessible name for the trigger and popover.
- Emits: none.
- Slots: default, with slot prop `close`, rendered inside the popover; falls back to `text`.
- Attributes: `inheritAttrs` is off; attributes such as `class` apply to the trigger button.

## Dependencies
- Callers: `AnalysisPanel`, which puts the individual PV move buttons in the slot.
- Styles: `shared.css` (`.expandable-text`, `.expandable-text--open`, `.expandable-text__overlay`).

## Notes
- Clicking the trigger measures it and opens a popover teleported to `body`, positioned over the trigger with the same font, padding, radius and an opaque background. Those measurements reach the stylesheet only as `--expandable-*` custom-property values; the layout itself is declared in `shared.css`.
- The popover closes on a click inside it (after a slotted button has handled its own click), a pointer press outside it, Escape, window resize or any scroll, and focus returns to the trigger.
- Document and window listeners are bound only while the popover is open and are removed on close and on scope disposal.
