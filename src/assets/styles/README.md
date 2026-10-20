# Global styles

`../main.css` loads every stylesheet once, for both application entry points. Vue files contain markup and behaviour without style blocks. Use ordinary global selectors; scope escapes are rejected by `npm run check:code`.

| Stylesheet | Owns |
| --- | --- |
| `../base.css` | Theme tokens, document sizing, reset and native focus rules |
| `shared.css` | Icons, buttons, tabs, page primitives, forms, toggles and their explicit variants |
| `app.css` | Loading, recovery notices and toasts |
| `navigation.css` | Content-sized rail/drawer, groups, brand, menu buttons and responsive navigation states |
| `dialogs.css` | Modal shell, dialog copy, choices and new-game controls |
| `board.css` | Board, pieces, coordinates, promotion chooser and editor palette |
| `panels.css` | Shared side panels, history, analysis, recorded analysis and shared error feedback |
| `player.css` | Player rows, clocks, captured material and the player error variant |
| `game-controls.css` | Gameplay actions and their mobile presentation |
| `workspace.css` | Game layout and board/sidebar sizing |
| `home.css` | Home layout and its action/recent-game cards |
| `library.css` | Library layout, snapshot list/details and save form placement |
| `settings.css` | Settings layout, theme previews and engine profile editor |

Each shared primitive has one owner. Add an explicit variant in that owner's stylesheet and select it in markup when a different presentation is required; route styles must not redefine shared controls or reach into component internals. Responsive rules stay with the element they describe. Keep element selectors anchored to their owning class so headings, paragraphs and error messages cannot affect other surfaces.

Layout classes position their direct children. Views retain their existing markup and action ownership. Dynamic style bindings supply only runtime CSS custom properties, such as `--history-depth` and theme-preview colours; fixed presentation values belong in these stylesheets.
