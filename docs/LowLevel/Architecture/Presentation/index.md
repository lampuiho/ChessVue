
This document defines general implementation rules the UI components must follow



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
