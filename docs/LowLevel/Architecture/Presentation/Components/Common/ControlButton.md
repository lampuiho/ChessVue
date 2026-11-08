# ControlButton

Source: [`src/components/common/ControlButton.vue`](../../../../../../src/components/common/ControlButton.vue)

## Purpose
Render a consistent icon-only gameplay control with an accessible name and hover or focus tooltip.

## Interface
- Props: `icon: IconName`; `label: string`; `disabled?: boolean` [`false`]; `variant?: 'primary' | 'danger'`.
- Emits: none declared; native listeners such as `@click` fall through to the root `<button>`.
- Slots: default, rendered after the icon (used for the draw-offer indicator).

## Dependencies
- Children: `AppIcon`.
- Callers: `GameControlPanel` and the paused Analyse / Exit analysis action in `GameView`.
- Styles: `game-controls.css` (`.control-button`, `.control-button--primary`, `.control-button--danger`, `.control-button__indicator`).

## Notes
- `label` supplies both `aria-label` and `data-tooltip`; the stylesheet shows the tooltip on hover and keyboard focus.
- Buttons size flexibly inside `.control-grid`, so the control row adapts to the sidebar width.
