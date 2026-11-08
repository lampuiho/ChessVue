# ChessVue High-Level UI Layout

## Purpose
This document defines the workspace layout for ChessVue.

It clarifies where the committed gameplay surfaces sit on screen and which level of the UI owns positioning decisions.

This is a high-level layout contract only. It defines the desktop and compact navigation structure and viewport fit; final spacing values and stylesheet details remain implementation details owned by the [global stylesheet modules](../../src/assets/styles/README.md).

## Styling ownership

The app uses global CSS consistently. [main.css](../../src/assets/main.css) imports the base rules and [purpose-specific stylesheet modules](../../src/assets/styles/README.md) once for both the ordinary and journey entry points. Vue components and views contain no style blocks, and there are no scope-escape selectors. Shared navigation, controls and panel classes have one owner; templates select explicit variants instead of route styles overriding shared primitives. Runtime style bindings supply only CSS custom-property values such as history depth and theme-preview colours. The required build audit (`npm run check:code`) enforces the global stylesheet boundary.

Theme and scale are applied through explicit events, not observers:

- `base.css` declares `color-scheme: light dark` and resolves each semantic colour token with `light-dark()` over the light and dark profile values. The browser therefore follows the OS theme for `system` mode without the app querying or subscribing to it.
- `App` applies the accepted appearance on startup, after settings load and when `SettingsView` emits `appearanceChanged` after a successful Apply, Save or Reset. It writes the light and dark profile values as root custom properties, sets `data-theme-mode` (forcing `color-scheme` for `light` and `dark`) and updates the `color-scheme` and `theme-color` meta elements. Draft edits and failed writes change nothing.
- `uiScalePercent` sets the root font size. In the browser it is a percentage of the browser font size. In NW.js (`data-app-mode="true"`) it scales with the window so the composition fits a fixed 50-rem viewport height, or width in portrait.

**Why CSS owns system-theme selection:** the earlier `watchEffect` in `App` and the system-theme queries made theme changes depend on an observer and on platform event delivery. CSS `color-scheme` and `light-dark()` react to the host theme natively, and the accepted settings policy is applied only at explicit settings events. A replacement must not query or subscribe to OS-theme changes for styling and must not apply unsaved drafts. See the archived [code cleanup plan](../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition).

## Baseline
- `desktop-first`, with a compact layout at widths up to 760 CSS pixels
- one game workspace layout for `GameView`
- one board column and one sidebar
- a collapsible left navigation rail on desktop and an icon-only top bar with a drawer on compact screens
- the application fits the viewport without document scrolling or visible scrollbars

The layout accommodates:

- `HomeView`
- `NavigationFrame` and `MenuBar`
- `GameTabs`
- `SavedGamesView`
- `PlayerPanel`
- `Chessboard`
- `HistoryPanel`
- `AnalysisPanel`
- `GameControlPanel`
- `SettingsView` and its engine profile and package views
- shared modal surfaces, including promotion

## Theme Support
The UI chrome supports built-in `light` and `dark` themes.

The `system` theme mode follows the active OS theme and is the default.

This theme support applies to app-shell and shared UI chrome such as:

- `HomeView`
- `NavigationFrame` and `MenuBar`
- `GameTabs`
- sidebar panels
- `SettingsView`
- shared dialog surfaces

Board appearance and piece appearance remain separate appearance concerns rather than being merged into app theme mode. The initial phase uses a fixed board and piece presentation; selection controls and customisation are deferred.

Support for user-created themes is a deferred idea, not part of the layout contract.

## Home View Layout
The neutral landing screen is the first-use and no-active-game fallback surface. It has no navigation rail.

Home layout sketch:

```text
+------------------------------------------------------------------------------+
| ChessVue brand                                   A modern responsive chess app|
|                                                                              |
|                         Your next move                                       |
|                         Home title and guidance                              |
|                                                                              |
|   [ Quick game ]  [ Custom game ]  [ Load game ]  [ Settings ]               |
|                                                                              |
|   Recent games (if any)                                      [View all ->]   |
|   [ recent game 1 ]     [ recent game 2 ]     [ recent game 3 ]              |
|                                                                              |
| footer                                                                       |
+------------------------------------------------------------------------------+
```

Home layout rules:

- `HomeView` remains a route-level screen, not a modal
- first-use and no-active-game fallback use the same centred layout
- the four primary action cards stay grouped in one row, wrapping into two columns on compact screens
- `Quick game` uses the accepted game defaults through `useQuickGame`; a failure shows inline feedback with an **Edit game defaults** link to `/settings/gameplay`
- `Custom game` opens `GameCreationModal` rather than navigating away from `HomeView`
- the recent games section sits below the action row, shows at most three entries and links to `/saved-games/load`
- the recent games section is hidden when there are no recent games; the hero then remains centred
- the hero scrolls internally if its content exceeds the available height

## Workspace Regions

The existing `div#app` is the application root; `App.vue` renders its active route and transient surfaces directly inside it.

Desktop uses a flex row: a left `NavigationFrame` rail and the remaining route content. The rail can shrink to icons or expand to labels. Both states size to their content, with no preset rail widths; longer labels or larger icons naturally resize the rail. Its width participates in flex layout, so no fixed positioning, JavaScript measurements or content offsets are needed. The compact drawer also sizes to its content, capped at 85% of the viewport width. The expanded preference is transient `UiStateStore.navigationExpanded` state and survives route changes during the current launch.

In `GameView`, `MenuBar` fills the rail with the brand (returns home), **Quick game**, **Custom**, **Load**, **Save**, **Close game** and **Settings**. The game content uses a tab row above the board/sidebar flex row. The board column contains borderless top and bottom player strips with avatars aligned to the board's left edge. A CSS size container fits the square board to both available width and height after reserving room for player strips and the board-edit palette. The sidebar keeps its title block (game name and turn or result badge), history above analysis, and gameplay controls at the bottom. Panels use flat surfaces without decorative frames or surrounding border padding.

```text
+------------+---------------------------------------------------------------+
| Navigation | GameTabs (only when more than one game is open)               |
|            |-------------------------------------+-------------------------|
| Collapse / | Top player                          | Game name / turn badge  |
| Expand     |                                     | History                 |
|            |            Chessboard               | Analysis                |
| Actions    |                                     |                         |
|            | Bottom player                       | Game controls           |
+------------+-------------------------------------+-------------------------+
```

At widths up to 760 CSS pixels, navigation becomes a narrow icon-only top bar. Its top-left menu action opens `NavigationMenuModal`, a side drawer with a dark overlay that renders the same brand, actions and footer content. The drawer owns focus until selection, Escape, its close action or backdrop dismissal; it restores a surviving launcher. Route actions retain their normal owners, including timed-game Menu interruption. The board and sidebar stack within the remaining viewport height, and captured-material icons are hidden.

There is no document scrolling. Long histories, engine output, libraries and settings fields scroll inside their allocated flex regions, with scrollbar chrome hidden. Panel headers and route/game action areas stay visible. This preserves access to all content while keeping the board and player strips within the viewport.

## Sidebar Panel Design
The sidebar is arranged in this order:

```text
+-------------------------------+
| Game name          turn/result|
+-------------------------------+
| ⌄ History        [Live pos.]  |
| *HistoryPanel*                |
+-------------------------------+
| ⌄ Analysis        [R] [+]     |
| *AnalysisPanel*               |
+-------------------------------+
| [Analyse / Exit] (paused only)|
| GameControlPanel              |
+-------------------------------+
```

The sidebar panel contents are:

- `HistoryPanel`: history tree, the start position row and a **Live position** chip when the selection has left the live node
- `AnalysisPanel`: left chevron for fold, header **Refresh analysis** and **Add engine** (`+`) actions, then one section per assigned engine. See [Analysis Panel Design](#analysis-panel-design)
- `GameControlPanel`: committed gameplay actions such as takeback, pause, resume, analyse, resign, draw, history stepping in analysis and review modes, and board-edit and start-from-setup actions. While paused, `GameView` adds an **Analyse** or **Exit analysis** control above it.

## Sidebar Behaviour
The sidebar behaviour is:

- `HistoryPanel` and `AnalysisPanel` are both visible by default; the remembered `showHistoryPanel` and `showAnalysisPanel` layout fields hide them, though no control currently changes those fields
- each panel is independently foldable
- fold state for all committed foldable sections belongs to remembered app-level layout persistence, including shared panels and analysis-engine groups by the active game's rendered analysis-row index
- the foldable behaviour should feel closer to a desktop explorer or debug sidebar than to full-screen tab switching
- collapsing one panel must not move the sidebar into a different column arrangement
- `GameControlPanel` remains the bottom region of the sidebar and is the main location for committed gameplay actions
- collapsing changes the left fold chevron from down-pointing to right-pointing

Example collapsed analysis state:

```text
+-----------------------------------+
| ⌄ History                         |
| *HistoryPanel*                    |
+-----------------------------------+
| > Analysis                        |
+-----------------------------------+
| *GameControlPanel*                |
+-----------------------------------+
```

## Analysis Panel Design

Move-enabled rendering, titled **Analysis**:

```text
+-------------------------------+
| ⌄ ● Engine A   +0.35 [S] [-]  |
| status summary      Depth 18  |
| +0.35  e4 e5 Nf3 ...      d18 |
| +0.20  d4 d5 c4 ...       d18 |
| +0.10  c4 e5 ...          d17 |
+-------------------------------+
| ⌄ ● Engine B   +0.30 [S] [-]  |
| ...                           |
+-------------------------------+
```

Score-only rendering, titled **Evaluations**:

```text
+-------------------------------+
| Evaluations       [R] [+]     |
| Engine A       [S] [-]  +0.35 |
| Engine B       [S] [-]  +0.30 |
+-------------------------------+
```

Legend: `[R]` refresh analysis, `[+]` add engine, `[S]` stop or retry the engine, `[-]` remove the engine.

- the header meta shows the engine count and that scores are from White's perspective
- each engine section shows its status and score; move-enabled sections also show a status summary, depth and up to `3` lines
- each rendered move target represents the continuation up to the clicked move position; long lines collapse through `ExpandableText`
- move-list rendering applies to free analysis, to any game with a recorded result, and to live games whose persisted `showLiveAnalysisMoves` is `true`; other live games use score-only rendering
- score-only rendering has no panel or engine folds and no status/depth summary; engines keep evaluating independently
- when `showLiveAnalysisMoves = true`, clicking a move target follows the state rules in [state_model.md](state_model.md#analysis-panel-rendering): it commits a live move, follows the history-move policy, or applies analysis moves
- per-engine actions sit on the right: **Retry engine** after a failure, **Stop engine** while starting or running, and **Remove engine**
- each move-enabled engine section folds by its left chevron; per-engine fold state is remembered in the single layout snapshot by rendered engine-row index for the active game, missing entries default to expanded, and removing an engine removes its index
- **Add engine** is disabled once four engines are assigned or no unassigned profile remains; **Refresh** and **Retry** are disabled during board edit

## Player Strip Design
```text
+------------------------------------------------+
| (♙) Name ⌄              captured pieces   Time |
|     White · engine status / Local player       |
+------------------------------------------------+
```

Player strips have no surrounding border or padding. Their pawn avatars align with the board edge and mark the side whose actual turn is running; clocks sit at the opposite end. Untimed games show a clock icon and a dash. Under ten seconds the clock shows tenths.

Pieces taken are rendered as icons, grouped by type, with repeated pieces overlapping to reduce space. They are hidden on compact screens.

The displayed player label is clickable and opens `PlayerSelectionModal` for explicitly changing that side for the current game, except during board edit or line playback. The choices are **Unassigned**, **Local player**, any configured engine profile, and **Keep** for an engine already assigned to that seat. Engine errors replace the status line.

## Piece Choice Surfaces
Promotion and board editing use separate surfaces:

- promotion opens `PromotionModal`, a shared dialog with one accessible button per candidate piece and **Cancel**; cancelling submits nothing
- board editing shows the position-editor palette below the board in `Chessboard` while the game is in `BoardEdit`: a colour toggle, the six piece kinds, **Clear** and **Reset**; clicking a square places the chosen piece and right-click removes one
- piece-choice actions stay local to the current promotion or board-edit flow and are not part of the sidebar

## Button Placement Rules
Button placement follows screen ownership rather than ad hoc local placement.

- Shell-level actions stay in the navigation rail.
  - in `GameView` (`MenuBar`): home brand, Quick game, Custom, Load, Save, Close game, Settings
  - in `SavedGamesView` and `SettingsView`: their mode or category switches plus Close, Back or Reset
- Game-switching actions stay in `GameTabs`, which is shown only when more than one game is open.
  - examples: select tab, close tab
- Panel-specific actions stay inside the panel they affect.
  - examples: history Live position, analysis refresh, analysis add `+`, engine retry, engine stop, engine remove
- Per-seat player reassignment stays on the player strip that owns that seat.
- Committed gameplay actions stay in `GameControlPanel` at the bottom of the sidebar.
  - examples: takeback, pause, resume, analyse, exit analysis, offer or resolve draw, resign, edit board, finish editing, start game, history stepping in analysis and review modes
- Saved-game deletion stays in `SavedGamesView`; there is no in-game delete action. Close game removes the tab only.
- Display-oriented player information stays in the player strips rather than duplicating action groups there, except for the explicit player-label click target.

Panel and button legend:

```text
[NavigationFrame]  route- and shell-wide actions only
[GameTabs]         open-game navigation only
[PlayerPanel]      player, clock, engine readout, player reassignment entry
[HistoryPanel]     history-specific actions only
[AnalysisPanel]    analysis-specific actions only
[GameControlPanel] committed gameplay actions only
```

## Settings View Layout
The settings surface places its category switcher in the shared navigation rail or compact top bar. The selected category occupies the remaining flex region, with an internally scrolling body and a persistent bottom action row.

The settings categories are:

- `Session`
- `Gameplay`
- `Appearance`
- `Engines`

Settings layout sketch:

```text
+------------------+---------------------------------------------------------+
| ChessVue         | category kicker                                         |
| < Back to game   | Selected category title           [Unsaved changes]     |
| Session          |                                                         |
| Gameplay         | Category fields (internal scrolling)                    |
| Appearance       |                                                         |
| Engines          |                                                         |
| Reset to defaults|  feedback       [Cancel] [Save] [Apply changes]         |
+------------------+---------------------------------------------------------+
```

Settings layout rules:

- category switching uses the shared responsive navigation frame
- the settings routes are `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`
- `/settings` redirects to `/settings/session`
- only one settings category is active in the main settings content area at a time; the draft is shared across categories
- **Back to game** or **Back to home** returns to the active game or home; with unsaved changes it opens the discard confirmation first
- **Cancel**, **Save**, and **Apply changes** stay in the bottom-right action area. Save writes the draft and returns; Apply changes writes and stays. Both are disabled without changes or while game defaults are invalid
- **Reset to defaults** stays in the navigation footer rather than in the primary bottom row and always requires confirmation through the shared dialog family before defaults are restored
- leaving the settings route with unsaved changes opens a **Discard unsaved changes?** confirmation
- the bottom action area participates in flex layout and remains visible below the scrolling fields
- category content owns its internal fields, but not the outer action-row placement
- `Appearance` contains theme mode with previews, board orientation, coordinate visibility, last-move highlighting and interface scale

### Engines Category And Engine Views
The `Engines` category shows:

- on the browser target only, **Installed browser engines**: the bundled and imported package folders with Refresh, **Install browser engine**, and per-folder **Create profile** and **Details**
- **Analysis behaviour**: resume analysis after restore
- **Engine profiles**: **Add profile**, then one row per profile with its name, entry path, interface (**Desktop executable** or **Browser UCI Worker**) and icon-only Copy, Edit and Delete actions

```text
+------------------------------------------------------------------------------+
| Engine profiles                                              [+ Add profile] |
+------------------------------------------------------------------------------+
| ♞ Stockfish   engines/stockfish/...   Browser UCI Worker   [Copy][Edit][Del] |
| ♞ Native SF   C:\Engines\sf.exe       Desktop executable   [Copy][Edit][Del] |
+------------------------------------------------------------------------------+
```

Engine view rules:

- Add, Edit and Copy navigate to the routed `EngineProfileView` inside the settings content area; package import and details navigate to `EnginePackageImportView` and `EnginePackageDetailsView`. While a child view is shown the settings action row is hidden, and each child view has **Back to engines**
- the profile editor contains the profile name, the engine interface, the entry script selector built from discovered packages (browser), the entry or executable path, **Browse** (desktop), **Use included Stockfish**, and an options table with one row per option name and value pair
- Add/Update profile changes only the settings draft; the profile is kept by Apply or Save on Settings. Open games retain their assigned configuration
- Copy opens the editor with a unique `copy` name and a new identity
- Delete removes the profile from the current settings draft only; seated engine participants in open games keep their copied in-game engine payloads unchanged
- package import collects a unique engine (folder) name and a ZIP archive, lists its files, and installs them; profiles are created separately
- package details list the package files and the profiles, game defaults and open games that reference it; imported packages can be removed after confirmation when unreferenced

See the archived [engine management UI design](../ArchivedPlans/EngineManagementUiDesign.md) and the [presentation views](../LowLevel/Architecture/Presentation/Views/index.md).

## Saved Games View Layout
`SavedGamesView` is a route-level surface rather than a modal dialog.

The committed saved-games routes are:

- `/saved-games/save/:name`
- `/saved-games/load`
- `/saved-games/load/:name`

Saved-games layout sketch:

```text
+-----------+------------------------------------------------------------------+
| ChessVue  | Local library                                                    |
| Load      | Saved games / Save your game / game name                         |
| Save      +---------------------------------------+--------------------------+
| Import    | Games or snapshots                    | Preview board and        |
| Export    |  Automatic save                 [Del] | details of the selected  |
|           |  ---- Named saves ----                | game or snapshot         |
|           |  named save               [Del][Load] |                          |
|           +---------------------------------------+--------------------------+
|           | Named save field (save mode only)                                |
| Close     | feedback / count   [Cancel] [Delete game] [Select / Load / Save] |
+-----------+------------------------------------------------------------------+
```

Saved-games view rules:

- the saved-games surface is route-owned and not part of the shared dialog family
- the navigation rail holds **Load** and **Save** modes, **Import file**, **Export** (save mode only) and **Close**; Save is disabled without an active game
- `/saved-games/load` is the grouped game-selection screen with a preview board of the selected game's latest save
- clicking a game on `/saved-games/load` selects it only; double-clicking loads its latest save immediately; its chevron opens that game's snapshots
- the bottom-right action row on `/saved-games/load` shows **Cancel**, **Delete game** and **Select game**; Select game routes to `/saved-games/load/:name`
- `/saved-games/load/:name` is the selected game's snapshot list with a details panel and uses **Load selected**; each row also has its own Load and Delete actions
- `/saved-games/save/:name` shows the current workspace, the existing snapshots for that game and a save-name field focused on open, with **Save game**
- snapshot lists show the automatic save first, then a **Named saves** separator, then the remaining saves
- the details panel shows a preview board and metadata for the selected snapshot
- deleting a save, deleting a game's saves, and replacing an existing named save each require a confirmation; deleting a game does not close an open workspace for it
- lists and details scroll internally; the name field and bottom actions remain visible without document scrolling
- route-level saved-games views replace the old save/load dialog concept; shared dialogs remain for transient confirmation and interruption flows only

## Shared Dialog Family
The UI uses one reusable dialog shell, `ModalDialog`, for confirmation, form, and interruption flows. `useModal` opens one modal component at a time through the `App`-level provider.

Shared dialog sketch:

```text
+------------------------------------------------------------------+
| Dialog Title                                                 [x] |
| Subtitle                                                         |
+------------------------------------------------------------------+
| Dialog body or form content                                      |
|                                                                  |
+------------------------------------------------------------------+
|                                [Secondary] [Primary] [Danger]    |
+------------------------------------------------------------------+
```

Dialog family rules:

- shared dialogs stay modal and transient; they do not replace route-level views
- the content area changes by flow, but the shell and action-row placement stay consistent
- confirmation and error flows may use fewer actions, but they still use the same shell
- forms inside dialogs use the same shallow section and field structure as other forms
- activation focuses the form's autofocus control or the first available action; Tab/Shift+Tab stays in the active surface through `vFocusScope`, and completion restores its surviving launcher or parent surface
- Escape, the close button and backdrop dismissal follow the flow's dismissal policy; non-dismissible flows hide the close button
- promotion choices have accessible piece names and support keyboard activation and cancellation; hidden checkbox/radio inputs show focus on their visible controls

Named uses:

- `GameCreationModal`: custom new game (**Play a game** or **Free analysis**) and start-from-setup (**Start from this position**) with Game, Players and Time & assistance sections
- `PromotionModal`: promotion selection
- `PlayerSelectionModal`: changing one seat to Unassigned, Local player, a configured engine profile, or keeping its current engine
- `AnalysisEngineSelectionModal`: choosing an engine profile not already assigned to the current game
- `ConfirmationModal`: resign, local draw offer, historical continuation (**Continue from this position?**), reset settings, settings discard, delete save, delete game, replace save and remove engine files
- `DrawResponseModal`: local accept or decline for the opposing side; not dismissible
- `GameResultModal`: **Game over** after any recorded result (checkmate, stalemate, insufficient material, timeout, resignation or agreement), with **Exit**, **Start analysis** and **Save for analysis**; not dismissible. It replaces a separate timeout acknowledgement
- `MessageModal`: blocked board-edit explanation during in-game analysis and invalid import errors
- `NavigationMenuModal`: the compact navigation drawer
- non-local draw offers do not use a dialog-hosted response step; the `GameControlPanel` draw control shows a small LED-like pending-offer indicator instead, and the lit state means the next **Resolve draw** press accepts incoming offers or withdraws outgoing offers

See the archived [modal component design](../ArchivedPlans/ModalComponentDesign.md) and the [shared dialog flows](../LowLevel/Architecture/Presentation/SharedDialogFlows.md).

Live-analysis preference UI rules:

- `GameCreationModal` uses a toggle labelled **Show live analysis moves** in its Time & assistance section.
- For a new game, the toggle starts from the accepted `gameDefaults.showLiveAnalysisMoves`. For start-from-setup, it starts from the prepared game's own preference.
- The toggle is shown only in **Play a game** mode and is disabled while either player is unassigned, because free analysis always uses playable analysis moves.

## Contract Alignment
This layout contract is consistent with the high-level baseline:

- desktop-first layout from [build_settings.md](build_settings.md)
- integrated `GameView` analysis workspace from [architecture.md](architecture.md)
- remembered app-level panel visibility and foldable-section state from [persistence_contract.md](persistence_contract.md)

Remembered UI state may hide, show, or collapse the shared history and analysis panels without redefining the parent layout regions described here. Per-engine analysis-group folding is also remembered through that same UI-layout state by rendered row index for the active game. That index follows the active game's ordered persisted analysis seat rows rather than a cross-game global list.

## Non-Goals
This document does not define:

- final padding or gap values
- exact colour tokens, palette values, or final visual polish
- internal markup structure for shared render components

Those details belong to the [stylesheet modules](../../src/assets/styles/README.md) and the [low-level presentation design](../LowLevel/Architecture/Presentation/index.md).
