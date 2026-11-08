# AppIcon

Source: [`src/components/common/AppIcon.vue`](../../../../../../src/components/common/AppIcon.vue) · Geometry: [`src/config/IconConfig.ts`](../../../../../../src/config/IconConfig.ts)

## Purpose
Draw one named interface icon as an inline stroke SVG.

## Interface
- Props: `name: IconName`.
- Emits: none. Slots: none.

## Dependencies
- Config: `resolveIconShapes` and `IconName` from `IconConfig`.
- Styles: `shared.css` (`.app-icon`); contexts size it, for example `.menu-button .app-icon` in `navigation.css` and `.control-button > .app-icon` in `game-controls.css`.

## Notes
- The SVG uses a 24×24 view box, `currentColor` stroke with a fixed 1.8 stroke width, round caps and joins, and `aria-hidden="true"`. The surrounding button supplies the accessible name.
- `IconConfig.iconShapes` maps each name to path, circle or rect shapes; `IconName` is derived from its keys, so callers can only name a defined icon. An unknown name at runtime resolves to a plain circle.
- Current names: `plus`, `menu`, `sparkles`, `sliders`, `folder`, `save`, `settings`, `trash`, `x`, `chevron-down`, `chevron-right`, `chevron-left`, `skip-back`, `skip-forward`, `rotate`, `undo`, `pause`, `play`, `flag`, `handshake`, `activity`, `edit`, `check`, `copy`, `download`, `upload`, `clock`, `history`, `arrow-right`, `home`, `more`, `info`.
- Icon geometry is data rather than a component because production files under `src/components` must be `.vue`; keeping it in `src/config` lets one typed table serve every icon. The unused `strokeWidth` prop was removed in the [component simplification](../../../../../ArchivedPlans/ComponentSimplificationPlan.md#1-remove-duplicated-modal-inputs-and-the-form-relay).
