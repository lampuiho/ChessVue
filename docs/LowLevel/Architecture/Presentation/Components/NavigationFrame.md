# NavigationFrame

Source: [`src/components/NavigationFrame.vue`](../../../../../src/components/NavigationFrame.vue)

## Purpose
Provide the shared navigation rail, its desktop expansion and the mobile navigation drawer for the game, library and settings pages.

## Interface
- Props: none. Emits: none.
- Slots: `brand`, default (actions) and `footer`.

## Dependencies
- Stores: `UiStateStore` (`navigationExpanded`, `toggleNavigationExpanded`).
- Composables: `useModal`.
- Children: `AppIcon`; mounted `NavigationMenuModal`.
- Styles: `navigation.css` (`.navigation-frame`, `.navigation-toggle`, `.navigation-brand`, `.navigation-actions`, `.navigation-footer`).

## Callers
| Caller | Brand | Actions | Footer |
| --- | --- | --- | --- |
| `MenuBar` (in `GameView`) | Home | Quick game, Custom, Load, Save, Close game, Settings | Action errors |
| `SavedGamesView` | Return to game or Home | Load and Save modes, Import file, Export | Close |
| `SettingsView` | Return (with dirty check) | Back, settings categories | Reset to defaults |

## Notes
- On wide layouts the frame is a content-sized vertical rail. The desktop toggle flips the shared `UiStateStore.navigationExpanded` preference between icon-only and labelled buttons.
- At the 760px breakpoint the frame becomes a horizontal top bar of icon buttons, hides the brand and shows the mobile toggle. The mobile toggle opens `NavigationMenuModal` with the frame's slots, so the drawer renders the same brand, action and footer closures with their existing state and handlers.
- The frame keeps the drawer's handle. Its `onClosed` callback clears the handle only if it still names that opening, and `onBeforeUnmount` closes it, so a drawer never outlives its page. Any other modal replaces the drawer.
- Passing the caller's slot functions rather than rebuilding them as props keeps one owner for each action, including library file operations and the settings dirty-exit check ([component simplification plan, retained props](../../../../ArchivedPlans/ComponentSimplificationPlan.md#retained-props-and-slots-concrete-justifications)).
- CSS flex and container sizing own placement; there are no observers, DOM measurements or offset synchronisation ([code cleanup plan](../../../../ArchivedPlans/CodeCleanupPlan.md#async-ownership-decisions)).
