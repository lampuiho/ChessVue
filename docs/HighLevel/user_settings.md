# ChessVue User Settings

## Purpose
This document summarizes end-user configurable settings implied by:

- `docs/HighLevel/scenarios.md`
- `docs/HighLevel/plan.md`

These are the settings that belong in the app's settings UI, new-game flows, or persisted user preference/state models.

## Reading Guide
- `Current`: explicitly supported by current scenarios.
- `Planned`: intended behavior in scenarios or plan.
- `Idea`: appears only in idea-stage scenarios.
- `Inferred`: not named as a concrete field, but strongly implied by the UX.

## 1. Session and App Behavior
These settings control how the app behaves for the user across launches and menu/navigation flows.

| Setting | Status | Notes |
| --- | --- | --- |
| Restore previous session on launch | Planned | Restore `currentGameId`, game list, and UI preferences when valid. |
| Preferred startup/home behavior | Planned / Inferred | Choose what the app shows when no valid prior context is available. |
| Autosave enabled | Current | Persist games/settings after meaningful state changes. |
| Autosave batching/debounce policy | Current / Inferred | Reduce excessive writes during rapid changes. |
| Auto-pause when opening settings/save flows | Current | Explicitly referenced in settings/save navigation scenarios. |
| Auto-resume after returning from menu flow | Current | Resume if the pause originated from app navigation. |
| Auto-pause on tab switch | Idea | Future extension for timed games. |
| Recent games / recent files list | Idea | Reopen recently accessed files from menu. |

## 2. Game Defaults and New Game Setup
These settings define how new games are created.

| Setting | Status | Notes |
| --- | --- | --- |
| Quick new game defaults | Current | Default `NewGameOptions` for fast creation. |
| Time control preset | Planned | Bullet, Blitz, Rapid, Classical, and other presets. |
| Custom time control | Planned | User-defined time settings with validation. |
| Player assignment per side | Planned | Human, engine, or no player assigned. |
| Side selection / color assignment | Planned | Choose which side a player or engine controls. |
| Engine assignment at game creation | Planned | Select engine(s) during setup. |
| Start in free analysis/setup instead of live game | Planned | Happens when neither side has a player assigned. |
| Quick-start preset from home | Idea | One-click named presets from the home screen. |
| Variant selection | Idea | Example: Chess960 or other non-standard rule sets. |
| Engine-vs-engine mode | Idea | Advanced new-game mode with two engines. |

## 3. Gameplay Rules and Interaction Policies
These settings shape how game progression works once the user is inside a game.

| Setting | Status | Notes |
| --- | --- | --- |
| Takeback policy | Planned | Decide whether moves from history rewrite the live mainline or remain analysis-only. |
| Confirm before mainline rewrite | Planned | Optional confirmation before changing the main continuation. |
| Branch behavior when takeback is disabled | Planned | Auto-return to live node vs remain on analysis branch. |
| Promotion resolution policy | Planned | Explicit selection UI, with optional timeout/default behavior. |
| Prune confirmation policy | Planned | Confirm irreversible deletion of future moves. |
| Root prune guard | Planned | Optionally forbid deleting the full game line from root. |

## 4. Analysis and Engine Preferences
These settings define user-facing engine inventory and analysis behavior.

| Setting | Status | Notes |
| --- | --- | --- |
| Engine list / engine inventory | Planned | Add, edit, remove configured engines. |
| Engine executable path | Planned | Advanced user-provided engine binary location. |
| Engine metadata and options | Planned | User-supplied engine name/options/profile data. |
| Default engine options | Planned / Inferred | Plan calls out engine options in settings. |
| Per-game engine assignment | Planned | Attach engines to a specific game at creation/start. |
| Multiple engines per game | Planned | Separate evaluations per engine. |
| Engine availability validation | Planned | Block setup/start if required engine is missing. |
| Resume analysis after load/restore | Current / Planned | Restore saved screen, then resume live analysis if possible. |
| Show saved analysis lines when engine unavailable | Current | Show cached lines even without a live engine. |
| Auto-reconnect engine after crash | Idea | Retry engine startup with backoff. |

## 5. Free Analysis and Study Preferences
These settings relate to non-live exploration and study workflows.

| Setting | Status | Notes |
| --- | --- | --- |
| Enable free analysis/setup mode | Planned | Dedicated workspace for non-live play and setup. |
| Allow move control for both colors in setup | Planned | Core behavior of free analysis/setup. |
| Allow board editing in free analysis/setup | Planned | Add/remove/move pieces directly. |
| Board editing disabled in in-game analysis mode | Planned | Board editing stays isolated from live-game analysis. |
| Clear-history confirmation after board edit | Planned | Ask before replacing history with edited position root. |
| Refresh engine analysis after setup move/edit | Planned | Re-request analysis after changing the position. |
| Start real game from prepared setup position | Planned | Transition setup into a live game using the prepared board. |
| Analysis bookmark/snapshot support | Idea | Save study points for later. |
| Undo/redo stack in analysis mode | Idea | Faster traversal of exploratory lines. |

## 6. Appearance and Layout
These settings control appearance, readability, and panel layout.

| Setting | Status | Notes |
| --- | --- | --- |
| Piece style / piece theme | Current | Explicit in settings scenario and plan. |
| Board colors / board theme | Current | Explicit in settings scenario and plan. |
| UI scaling / rem size | Current | Explicit in settings scenario and plan. |
| Theme/customization support | Planned / Inferred | Plan calls out theme support via CSS variables/rem units. |
| Board orientation | Inferred | Strongly implied by a chess UI, though not named in high-level scenarios. |
| Show coordinates | Inferred | Common board-display preference and likely setting. |
| Highlight last move | Inferred | Common board-display preference and likely setting. |
| Panel visibility/layout preferences | Planned / Inferred | History, analysis, and control panel visibility/state. |
| Mobile panel switching preference | Idea | Persist a preferred panel on compact screens. |

## 7. Persisted Screen-State Preferences
These are not always explicit "settings page" fields, but they are user-facing persisted preferences/state.

| Setting | Status | Notes |
| --- | --- | --- |
| Persist active game ID | Planned | Needed for session restore and routing. |
| Persist current board position/history node | Current | Save/load aims to restore the exact visible game screen. |
| Persist visible panel state | Current | Saved game snapshots include panel state. |
| Persist latest displayed analysis lines | Current | Saved screen state includes displayed analysis/top lines. |
| Dirty form leave protection | Current | Prompt when settings edits would be lost on navigation. |

## Recommended User Settings Groups
If ChessVue later defines a formal user settings schema, these are the strongest top-level groups:

1. `session`
2. `gameDefaults`
3. `gameplay`
4. `analysis`
5. `setup`
6. `appearance`
7. `layout`

## Summary
The clearest user-editable settings areas are:

- session behavior
- new-game defaults
- gameplay policies
- engine and analysis preferences
- free analysis/setup options
- appearance and layout
