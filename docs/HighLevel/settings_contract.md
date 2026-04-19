# ChessVue Settings Contract

## Purpose
This document defines the authoritative user-editable settings for the rewrite baseline.

If a field is not described here, it must not appear as a committed low-level settings property unless it is first promoted into this contract.

## Contract Rule
Many behaviours in the high-level scenarios are capabilities, not user settings.

Examples of baseline capabilities that are not themselves settings:

- free analysis/setup exists
- in-game analysis exists
- saved-game restore exists

Only the user-editable choices listed below belong in the committed settings schema.

## Settings Table
| Setting | Purpose | Default | Validation | Persistence Owner |
| --- | --- | --- | --- | --- |
| `gameSession.restorePreviousSession` | Reopen prior session when valid | `true` | Boolean | Settings snapshot |
| `gameSession.saveRootPath` | Root folder used for ChessVue's internal save/load files | `saves` | Non-empty relative or absolute path string | Settings snapshot |
| `gameSession.autosaveAfterMoveCount` | Write/update the internal autosave entry after this many committed ply | `1` | Non-negative integer; `0` disables move-count autosave | Settings snapshot |
| `gameSession.autosaveOnClose` | Write/update the internal autosave entry when closing the app or game shell | `true` | Boolean | Settings snapshot |
| `gameSession.autoPauseOnMenu` | Pause timed live games during interrupting menu flows | `true` | Boolean | Settings snapshot |
| `gameDefaults.quickNewGameName` | Default display name seed for quick new game | `New Game` | Non-empty string | Settings snapshot |
| `gameDefaults.defaultTimeControl` | Default time control used by quick new game | `untimed` | Built-in preset or valid custom time control object | Settings snapshot |
| `gameDefaults.defaultWhitePlayerType` | Default player type for white in new game setup | `local` | `local` or `engine` | Settings snapshot |
| `gameDefaults.defaultBlackPlayerType` | Default player type for black in new game setup | `local` | `local` or `engine` | Settings snapshot |
| `gameplay.analysisBranchExitBehaviour` | Decide what happens after analysis-only branch creation from history | `returnToLiveNode` | `returnToLiveNode` or `stayOnBranch` | Settings snapshot |
| `gameplay.promotionPolicy` | Decide how promotion is resolved | `requireExplicitSelection` | `requireExplicitSelection` only in baseline | Settings snapshot |
| `analysis.resumeLiveAnalysisAfterRestore` | Restart live analysis after saved-game restore when engines are available | `true` | Boolean | Settings snapshot |
| `analysis.engineInventory` | User-managed engine profile registry | `[]` | Unique profile names only; remaining profile fields are user-managed values | Settings snapshot |
| `appearance.themeMode` | Decide whether app chrome follows the OS theme or uses an explicit built-in theme | `system` | `system`, `light`, or `dark` | Settings snapshot |
| `appearance.boardTheme` | Board colours or theme selection | `classic` | Non-empty theme key | Settings snapshot |
| `appearance.pieceTheme` | Piece style selection | `classic` | Non-empty theme key | Settings snapshot |
| `appearance.uiScalePercent` | Global UI scale for desktop layout | `100` | Integer from `75` to `200` | Settings snapshot |
| `appearance.boardOrientation` | Default board orientation | `white` | `white` or `black` | Settings snapshot |
| `appearance.showCoordinates` | Show board coordinates | `true` | Boolean | Settings snapshot |
| `appearance.highlightLastMove` | Highlight the most recent move on the board | `true` | Boolean | Settings snapshot |

## Built-In Defaults
The baseline built-in time presets are:

- `Bullet`: `1+0`
- `Blitz`: `5+0`
- `Rapid`: `10+0`
- `Classical`: `30+0`
- `Untimed`

Custom time controls are allowed where scenarios require them, but the quick new game default is `Untimed` unless the user changes it.

## Rules Derived From Settings
- Startup restore attempts the stored game-session snapshot only when `gameSession.restorePreviousSession = true`.
- When session restore is disabled, missing, corrupt, or no longer valid for routing, startup falls back to `/home`.
- `gameSession.saveRootPath` is the logical root for ChessVue's own save files. Internal saves are grouped into one folder per canonical game beneath that root. Browser-backed adapters may emulate this structure without changing the contract.
- `gameSession.autosaveAfterMoveCount` counts committed ply. `0` disables move-count autosave, while `1` means autosave after every committed move.
- `gameSession.autosaveOnClose` controls whether app or shell close writes the internal autosave entry separately from the move-count trigger.
- Accepted settings coerce `gameSession.autosaveOnClose = true` whenever `gameSession.restorePreviousSession = true`.
- `gameSession.autoPauseOnMenu` controls timed-game auto-pause for settings, internal save/load views, import/export flows, and other interrupting menu flows.
- When `gameSession.autoPauseOnMenu` pauses a timed live game, the game surface becomes interaction-locked until the paired auto-resume path or an explicit manual resume clears that pause.
- Auto-resume after menu interruption is paired behaviour of `gameSession.autoPauseOnMenu`; it is not a separate stored setting.
- `gameplay.analysisBranchExitBehaviour` defines the global default exit behaviour after analysis-only historical-node moves. Whether a game rewrites live mainline or stays analysis-only is persisted per game.
- `analysis.resumeLiveAnalysisAfterRestore` applies only after saved-game restore completes.
- `analysis.engineInventory` validates only that profile names are unique within the saved profile list. Executable path and option values are stored as entered and are consumed later when a profile is used to create an engine participant.
- `appearance.themeMode = system` follows the active OS theme, while `light` and `dark` force the corresponding built-in UI theme.
- `appearance.themeMode` applies to app chrome only; board and piece themes remain separate appearance settings.

## Explicit Non-Baseline Settings
The following are intentionally excluded from the baseline settings contract and are tracked in [ideas.md](ideas.md) if needed:

- user-created custom UI themes
- sound enablement
- panel visibility or fold preferences
- recent games preferences
- tab-switch auto-pause
- mobile panel preference
- variant preferences

## Ownership Notes
- Settings are stored in the user settings snapshot defined in [persistence_contract.md](persistence_contract.md).
- Per-game engine assignment belongs to the saved game payload, not to the global settings schema.
- The per-game `showLiveAnalysisMoves` preference also belongs to the saved game payload, not to the global settings schema.
- The per-game `takebackPolicy` preference also belongs to the saved game payload, not to the global settings schema.
- Session shell restoration belongs to session persistence, even when the behaviour is controlled by settings.
- Remembered panel visibility and foldable-section state belong to persisted UI/session state, not to the consciously saved settings schema.
