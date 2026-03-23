# Presentation Architecture

This document defines general implementation rules the UI components must follow.

## Supporting Docs
- [InteractionMap.md](InteractionMap.md)
- [SharedDialogFlows.md](SharedDialogFlows.md)
- [Components/index.md](Components/index.md)
- [Views/index.md](Views/index.md)

## Layout Ownership Rules
This section defines the parent-child positioning contract that the later low-level design must preserve.

- Outer positioning belongs to the parent shell or parent layout component.
- Child components must not create left or right drift through self-managed outer margins, offsets, or compensating transforms.
- No component should introduce empty external spacing beyond its owned surface.
- Panel width, column placement, vertical stacking, and inter-panel gaps are controlled by the parent region, not by the child panel CSS.
- The square board sits inside the board column; the board component should not decide sidebar placement or player-strip placement.
- Sidebar children should fill the width offered by the sidebar parent instead of shifting themselves within it.
- Player strips should fill the width offered by the board-column parent.

These rules exist so the later low-level CSS design can scope spacing cleanly:

- parent components arrange regions
- child components style only their own surface and internal content

## Appearance Variable Rules
This section defines the low-level app-theme contract that presentation components must preserve.

- One root app surface owns the effective theme attribute and the reactive semantic CSS-variable map from `IAppearanceProjection`.
- Shared UI chrome must read semantic CSS variables rather than hardcoded palette values.
- Common components may define local aliases over the semantic variables, but they must not fork separate light/dark palettes internally.
- The CSS-variable map is configuration-reactive so accepted settings changes and system-theme changes can restyle app chrome without component remounts.
- `themeMode` styles app chrome only. `boardTheme` and `pieceTheme` remain separate appearance paths owned by their respective presentation surfaces.

## Spacing Variable Rules
This section defines the low-level spacing contract that presentation components must preserve.

- Spacing must also be expressed through CSS variables rather than hardcoded literal values.
- Spacing variables must use `rem` units so root-size changes can scale the whole app consistently.
- Spacing variables are named by usage or owning surface, not by abstract sequence numbers.
- Prefer names such as `--workspace-gap`, `--panel-padding`, `--dialog-padding`, `--toolbar-gap`, or `--field-row-gap`.
- Avoid abstract names such as `--space-1`, `--space-2`, or similar scale-only labels at the contract level.
- Components may create local aliases over shared spacing variables, but those aliases must still resolve to `rem`-based variables.

## Layout Scaling Rules
This section defines the baseline layout-scaling expectations for presentation components.

- Fixed sizes should be avoided when the layout can scale automatically through flexbox, grid, intrinsic sizing, percentage sizing, or similar responsive layout techniques.
- Parent shells and layout components should prefer flexible growth and shrink behaviour over hardcoded widths and heights.
- Fixed dimensions are reserved only for genuine invariants such as square board geometry, icon glyph boxes, or minimum hit targets.
- Even when an invariant requires a fixed dimension, prefer `rem` or other relative units over raw pixel values where practical.
