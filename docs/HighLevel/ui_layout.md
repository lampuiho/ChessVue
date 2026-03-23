# ChessVue High-Level UI Layout

## Purpose
This document defines the baseline desktop workspace layout for ChessVue.

It clarifies where the committed gameplay surfaces sit on screen and which level of the UI owns positioning decisions.

This is a high-level layout contract only. It does not define final styling, spacing tokens, responsive compact behaviour, or component-local CSS structure.

## Baseline
- `desktop-first`
- one game workspace layout for `GameView`
- one left board column and one right sidebar
- no compact or mobile panel-switching behaviour in the baseline

The baseline layout must accommodate:

- `HomeView`
- `MenuBar`
- `GameTabs`
- `PlayerPanel`
- `Chessboard`
- `HistoryPanel`
- `AnalysisPanel`
- `GameControlPanel`
- `SettingsView`
- shared modal and piece-choice surfaces

## Theme Support
The baseline desktop UI chrome supports built-in `light` and `dark` themes.

The baseline also supports a `system` theme mode so the app can follow the active OS theme by default.

This theme support applies to app-shell and shared UI chrome such as:

- `HomeView`
- `MenuBar`
- `GameTabs`
- sidebar panels
- `SettingsView`
- shared dialog surfaces

Board appearance and piece appearance remain separate appearance concerns rather than being merged into app theme mode.

Potential support for user-created themes is a deferred idea, not part of the baseline layout contract.

## Home View Layout
The neutral landing screen is the first-use and no-active-game fallback surface.

Home layout sketch:

```text
+------------------------------------------------------------------------------+
|                                                                              |
|                         Home Title / Empty State                             |
|                         Short guidance text                                  |
|                                                                              |
|      [ New ]   [ Custom ]   [ Load ]   [ Settings ]                          |
|                                                                              |
|                        Recent Games (if any)                                 |
|                  recent game 1                                               |
|                  recent game 2                                               |
|                  recent game 3                                               |
|                                                                              |
+------------------------------------------------------------------------------+
```

Home layout rules:

- `HomeView` remains a route-level screen, not a modal
- first-use and no-active-game fallback use the same centred layout
- primary landing actions stay grouped together instead of being scattered across the page
- the primary action group is horizontally centred
- the primary action group uses one single row of large square buttons with prominent icons
- button targets should be easy to click so the same design direction remains workable when responsive behaviour is added later
- the recent games list sits below the primary action row
- the recent games list is hidden when there are no recent games to show
- when the recent games list is hidden, the primary action row shifts so the overall home composition remains as centred as possible
- `Custom New Game` opens the shared dialog family rather than navigating away from `HomeView`

## Workspace Regions
The baseline game workspace is arranged in four vertical layers:

1. top menu row for `MenuBar`
2. tab row directly below for `GameTabs`
3. main content row split into a left board column and right sidebar
4. sidebar-bottom action region for `GameControlPanel`

Within the main content row:

- the left board column contains the top player strip, square board, and bottom player strip
- the right sidebar contains history above analysis by default
- the right sidebar keeps the control panel at the bottom as the primary action area

## Baseline ASCII Sketch
```text
+--------------------------------------------------------------------------------------------------+
| MenuBar                                                                                          |
+--------------------------------------------------------------------------------------------------+
| GameTabs                                                     |                                   |
+--------------------------------------------------------------+                                   |
| Top Player Strip                                             |                                   |
+--------------------------------------------------------------+                                   |
|                                                              |                                   |
|                                                              |                                   |
|                                                              |                                   |
|                                                              |                                   |
|                                                              |          Right Sidebar            |
|                          Chessboard                          |                                   |
|                                                              |                                   |
|                                                              |                                   |
|                                                              |                                   |
|                                                              |                                   |
+--------------------------------------------------------------+                                   |
| Bottom Player Strip                                          |                                   |
+--------------------------------------------------------------+-----------------------------------+
```

## Sidebar Panel Design
The sidebar is arranged in this order:

```text
+-------------------------------+
| ⌄ History                     |
| *HistoryPanel*                |
+-------------------------------+
| ⌄ Analysis                 [+]|
| *AnalysisPanel*               |
+-------------------------------+
| GameControlPanel              |
+-------------------------------+
```

The sidebar panel contents are:

- `HistoryPanel`: history tree and history-specific actions
- `AnalysisPanel`: left chevron for fold, panel-title `+` action on the right for adding an analysis engine to the current game. See analysis panel section
- `GameControlPanel`: committed gameplay actions such as takeback, pause, resign, draw, analysis mode actions, and setup actions

## Sidebar Behaviour
The baseline desktop sidebar behaviour is:

- `HistoryPanel` and `AnalysisPanel` are both visible by default
- each panel is independently foldable or collapsible
- only the shared history-panel and analysis-panel collapse state belongs to remembered app-level layout persistence
- the foldable behaviour should feel closer to a desktop explorer or debug sidebar than to full-screen tab switching
- collapsing one panel must not move the sidebar into a different column arrangement
- `GameControlPanel` remains the bottom region of the sidebar and is the main location for committed gameplay actions
- Collapsing will change the left fold chevron from down-pointing to right-pointing
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

```text
+-------------------------------+
| ⌄ Engine A                 [-]|
| best line / score  moves...   |
| 2nd line / score  moves...    |
| 3rd line / score  moves...    |
+-------------------------------+
| ⌄ Engine B                 [-]|
| best line / score  moves...   |
| 2nd line / score  moves...    |
| 3rd line / score  moves...    |
+-------------------------------+
```

- show up to `3` visible lines per engine, foldable per engine
- per-engine-title `-` action on the right for removing that engine from the current game
- Each engine can be folded by clicking the chevron to the left of the engine name
- Per-engine fold state is transient per-game runtime UI state and is not part of the shared persisted app-shell layout snapshot


## Player Strip Design
```text
+---------------------------------+
|  Name / engine status      Time |
|  pieces taken              panel|
+---------------------------------+
```

Pieces taken are rendered as icons. Grouped together by type to reduce space taken. Grouping is done by reduced spacing of the pieces so they overlap 70% of the icon.

The displayed player label is clickable and opens the player-selection dialog for explicitly changing that side for the current game. The baseline choices are `none`, `local`, or one configured engine profile.

## Piece Choice Surface
`PiecePalette` is the shared small-format piece-choice surface for promotion and free-analysis board editing.

Piece-choice sketch:

```text
+----------------------------------+
| Piece Choice                     |
+----------------------------------+
| [Q] [R] [B] [N]                  |
+----------------------------------+
|                         [Cancel] |
+----------------------------------+
```

Piece-choice rules:

- promotion selection may host `PiecePalette` as a board-local overlay or inside the shared dialog shell
- free-analysis board editing may host `PiecePalette` close to the board-edit controls
- piece-choice actions stay local to the current promotion or board-edit flow
- `PiecePalette` is not part of the persistent right sidebar layout

## Button Placement Rules
Button placement follows screen ownership rather than ad hoc local placement.

- Shell-level actions stay in `MenuBar`.
  - examples: new game, load, save, settings, delete game
- Game-switching actions stay in `GameTabs`.
  - examples: select tab, close tab
- Panel-specific actions stay inside the panel they affect.
  - examples: history prune, history return-to-live, analysis refresh, analysis add `+`, analysis remove `-`, engine retry, engine stop
- Per-seat player reassignment stays on the player strip that owns that seat.
  - example: clicking the displayed player label in `PlayerPanel` to open the player-selection dialog for that side
- Committed gameplay actions stay in `GameControlPanel` at the bottom-right of the workspace.
  - examples: takeback, pause, resume, resign, draw, enter in-game analysis, exit in-game analysis, board-edit flow actions
- Display-oriented player information stays in the player strips rather than duplicating action groups there, except for the explicit player-label click target.

Panel and button legend:

```text
[MenuBar]          shell-wide actions only
[GameTabs]         open-game navigation only
[PlayerPanel]      player, clock, engine readout, player reassignment entry
[HistoryPanel]     history-specific actions only
[AnalysisPanel]    analysis-specific actions only
[GameControlPanel] committed gameplay actions only
```

## Settings View Layout
The settings surface uses a tab-style category switcher similar in spirit to `GameTabs`, but for settings categories rather than open games.

The baseline settings categories are:

- `Session`
- `Gameplay`
- `Appearance`
- `Engines`

Settings layout sketch:

```text
+------------------------------------------------------------------------------+
| Settings Title                                                               |
+------------------------------------------------------------------------------+
| [Session] [Gameplay] [Appearance] [Engines]                                  |
+------------------------------------------------------------------------------+
|                                                                              |
| Selected settings category content                                           |
|                                                                              |
|                                                                              |
+------------------------------------------------------------------------------+
| [Reset To Defaults]                                 [Cancel] [Save] [Apply]  |
+------------------------------------------------------------------------------+
```

Settings layout rules:

- category switching uses a shared tab-like control rather than a long single scrolling page
- the settings routes are `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`
- `/settings` redirects to `/settings/session`
- only one settings category is active in the main settings content area at a time
- `Cancel`, `Save`, and `Apply` stay in the bottom-right action area
- `Reset` stays in a separate secondary settings action area rather than in the primary bottom-right row
- `Reset` always requires confirmation through the shared dialog family before defaults are restored
- the bottom action area remains in a fixed bottom corner position relative to the settings surface
- category content owns its internal fields, but not the outer action-row placement
- `Appearance` contains both visual theme settings and layout-related presentation preferences such as UI scale, board orientation, coordinate visibility, and last-move highlighting

Engine profile list direction inside the `Engines` category:

```text
+------------------------------------------------------------------------------+
| Engine Profiles                                                              |
+------------------------------------------------------------------------------+
| [Engine Profile Name]                          [Copy] [Edit] [Delete]        |
| [Engine Profile Name]                          [Copy] [Edit] [Delete]        |
| [Add Profile]                                                               |
+------------------------------------------------------------------------------+
```

Engine profile editing rules:

- each profile row keeps the profile name on the left and icon-only `copy`, `edit`, and `delete` actions on the right
- `Edit` opens the engine-profile editor surface rather than expanding the whole settings page inline
- the profile editor includes a simple options table for supported engine options, with one row per option name and value pair
- `Copy` duplicates the selected profile into the current settings draft and requires the copied profile name to be made unique before save
- `Delete` removes the profile from the current settings draft only; existing seated engine participants in open games are unchanged

## Shared Dialog Family
The baseline uses one reusable dialog shell for confirmation, form, and interruption flows.

Shared dialog sketch:

```text
+------------------------------------------------------------------+
| Dialog Title                                                     |
+------------------------------------------------------------------+
| Dialog body or form content                                      |
|                                                                  |
|                                                                  |
+------------------------------------------------------------------+
|                                [Secondary] [Primary] [Danger]    |
+------------------------------------------------------------------+
```

Dialog family rules:

- shared dialogs stay modal and transient; they do not replace route-level views
- the content area changes by flow, but the shell and action-row placement stay consistent
- confirmation and error flows may use fewer actions, but they still use the same shell
- forms inside dialogs use the same shallow section and field structure as other baseline forms

Named baseline uses:

- `NewGameModal`: custom new game form with named sections and create or cancel actions
- promotion selection: shared dialog shell or board-local overlay hosting `PiecePalette`
- start game from setup: shared dialog shell for choosing the live-game start details from a prepared setup workspace
- player selection: shared dialog shell for changing one seat to `none`, `local`, or a configured engine profile
- analysis-engine selection: shared dialog shell for choosing an unassigned engine profile for the current game
- prune confirmation: danger-focused confirmation dialog
- resign confirmation: danger-focused confirmation dialog
- draw offer: shared confirmation dialog before the offer is recorded
- draw resolve: shared accept or decline dialog when the opponent is local
- timeout notification: acknowledge dialog after timeout finalisation
- reset-settings confirmation: confirm or cancel reset from the settings secondary action area
- invalid-load error or recover prompt: error dialog with continue or cancel when partial recovery is allowed
- settings dirty leave: shared confirm or discard dialog before leaving with unsaved settings edits
- analysis dirty exit: shared keep or discard dialog before leaving in-game analysis with retained exploratory work
- delete-game confirmation: shared danger-focused confirmation dialog before removal
- blocked board-edit explanation: explanatory dialog shown when board editing is attempted during in-game analysis

## Contract Alignment## Contract Alignment
This layout contract is consistent with the existing high-level baseline:

- desktop-first layout from [build_settings.md](build_settings.md)
- integrated `GameView` analysis workspace from [architecture.md](architecture.md)
- remembered app-level panel visibility and shared panel collapse state from [persistence_contract.md](persistence_contract.md)
Remembered UI state may hide, show, or collapse the shared history and analysis panels without redefining the baseline parent layout regions described here. Per-engine analysis-group folding remains transient runtime state.

## Non-Goals## Non-Goals
This document does not define:

- final padding or gap values
- exact colour tokens, palette values, or final visual polish
- compact or mobile layout behaviour
- detailed CSS scoping per component
- internal markup structure for shared render components

Those details belong to the later low-level design and implementation work.