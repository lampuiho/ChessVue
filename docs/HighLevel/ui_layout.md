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

- `MenuBar`
- `GameTabs`
- `PlayerPanel`
- `Chessboard`
- `HistoryPanel`
- `AnalysisPanel`
- `GameControlPanel`

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
+ ------------------------------------------------------------ +                                   |
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
+ ------------------------------------------------------------ +                                   |
| Bottom Player Strip                                          |                                   |
+--------------------------------------------------------------+-----------------------------------+
```

## Sidebar Panel Design
The sidebar is arranged in this order:

```text
+-------------------------------+
| ⌵ HistoryPanel                |
+-------------------------------+
| ⌵ AnalysisPanel               |
+-------------------------------+
| GameControlPanel              |
+-------------------------------+
```

The sidebar panel contents are:

- `HistoryPanel`: history tree and history-specific actions
- `AnalysisPanel`: analysis engines, visible lines, and analysis-specific actions, show top 3 per engine, foldable per engine
- `GameControlPanel`: committed gameplay actions such as takeback, pause, resign, draw, analysis mode actions, and setup actions

## Sidebar Behaviour
The baseline desktop sidebar behaviour is:

- `HistoryPanel` and `AnalysisPanel` are both visible by default
- each panel is independently foldable or collapsible
- the foldable behaviour should feel closer to a desktop explorer or debug sidebar than to full-screen tab switching
- collapsing one panel must not move the sidebar into a different column arrangement
- `GameControlPanel` remains the bottom region of the sidebar and is the main location for committed gameplay actions

Example collapsed analysis state:

```text
+-----------------------------------+
| ⌵ History                        |
| *HistoryPanel*                    |
+-----------------------------------+
| > Analysis                        |
+-----------------------------------+
| *GameControlPanel*                |
+-----------------------------------+
```

## Player Strip Design
``` text
+---------------------------------+
|  Name / engine status      Time |
|  pieces taken              panel|
+---------------------------------+
```

Pieces taken are rendered as icons. Grouped together by type to reduce space taken. Grouping is done by reduce spacing of the pieces so they overlap 70% of the icon.

## Button Placement Rules
Button placement follows screen ownership rather than ad hoc local placement.

- Shell-level actions stay in `MenuBar`.
  - examples: new game, load, save, settings, delete game
- Game-switching actions stay in `GameTabs`.
  - examples: select tab, close tab
- Panel-specific actions stay inside the panel they affect.
  - examples: history prune, history return-to-live, analysis refresh, engine retry, engine stop
- Committed gameplay actions stay in `GameControlPanel` at the bottom-right of the workspace.
  - examples: takeback, pause, resume, resign, draw, enter in-game analysis, exit in-game analysis, board-edit flow actions
- Display-oriented player information stays in the player strips rather than duplicating action groups there.

Panel and button legend:

```text
[MenuBar]          shell-wide actions only
[GameTabs]         open-game navigation only
[PlayerPanel]      player, clock, engine readout only
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
- `Layout`
- `Engines`

Settings layout sketch:

```text
+------------------------------------------------------------------------------+
| Settings Title                                                               |
+------------------------------------------------------------------------------+
| [Session] [Gameplay] [Appearance] [Layout] [Engines]                         |
+------------------------------------------------------------------------------+
|                                                                              |
| Selected settings category content                                           |
|                                                                              |
|                                                                              |
+------------------------------------------------------------------------------+
|                                                     [Cancel] [Save] [Apply]  |
+------------------------------------------------------------------------------+
```

Settings layout rules:

- category switching uses a shared tab-like control rather than a long single scrolling page
- only one settings category is active in the main settings content area at a time
- `Cancel`, `Save`, and `Apply` stay in the bottom-right action area
- the bottom action area remains in a fixed bottom corner position relative to the settings surface
- category content owns its internal fields, but not the outer action-row placement

## Layout Ownership Rules
This document defines the parent-child positioning contract that the later low-level design must preserve.

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

## Contract Alignment
This layout contract is consistent with the existing high-level baseline:

- desktop-first layout from [build_settings.md](build_settings.md)
- integrated `GameView` analysis workspace from [architecture.md](architecture.md)
- persisted panel visibility and exact-screen restore from [persistence_contract.md](persistence_contract.md)
- default panel visibility settings from [settings_contract.md](settings_contract.md)

The baseline settings that affect visibility, but not placement, are:

- `layout.showHistoryPanel`
- `layout.showAnalysisPanel`
- `layout.showGameControlPanel`

These settings may hide or show the relevant panels by default, but they do not redefine the baseline parent layout regions described here.

## Non-Goals
This document does not define:

- final padding or gap values
- typography, colour, or visual polish
- compact or mobile layout behaviour
- detailed CSS scoping per component
- internal markup structure for shared render components

Those details belong to the later low-level design and implementation work.
