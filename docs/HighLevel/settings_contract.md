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
| `session.restorePreviousSession` | Reopen prior session when valid | `true` | Boolean | Settings snapshot |
| `session.startupBehaviour` | Decide fallback when no valid session is restored | `restoreOrHome` | `restoreOrHome` or `home` | Settings snapshot |
| `session.autosaveEnabled` | Enable automatic persistence on meaningful changes | `true` | Boolean | Settings snapshot |
| `session.autosaveDebounceMs` | Reduce write frequency during rapid changes | `750` | Integer from `250` to `5000` | Settings snapshot |
| `session.autoPauseOnMenu` | Pause timed live games during interrupting menu flows | `true` | Boolean | Settings snapshot |
| `gameDefaults.quickNewGameName` | Default display name seed for quick new game | `New Game` | Non-empty string | Settings snapshot |
| `gameDefaults.defaultTimeControl` | Default time control used by quick new game | `untimed` | Built-in preset or valid custom time control object | Settings snapshot |
| `gameDefaults.defaultWhitePlayerType` | Default player type for white in new game setup | `human` | `human` or `engine` | Settings snapshot |
| `gameDefaults.defaultBlackPlayerType` | Default player type for black in new game setup | `human` | `human` or `engine` | Settings snapshot |
| `gameplay.takebackPolicy` | Decide whether moving from history rewrites live mainline or stays analysis-only | `rewriteMainline` | `rewriteMainline` or `analysisOnly` | Settings snapshot |
| `gameplay.confirmMainlineRewrite` | Require confirmation before changing the main continuation | `true` | Boolean | Settings snapshot |
| `gameplay.analysisBranchExitBehaviour` | Decide what happens after analysis-only branch creation from history | `returnToLiveNode` | `returnToLiveNode` or `stayOnBranch` | Settings snapshot |
| `gameplay.promotionPolicy` | Decide how promotion is resolved | `requireExplicitSelection` | `requireExplicitSelection` only in baseline | Settings snapshot |
| `gameplay.confirmPruneFutureMoves` | Confirm irreversible pruning | `true` | Boolean | Settings snapshot |
| `gameplay.allowRootPrune` | Allow prune action from the root node | `false` | Boolean | Settings snapshot |
| `analysis.resumeLiveAnalysisAfterRestore` | Restart live analysis after saved-game restore when engines are available | `true` | Boolean | Settings snapshot |
| `analysis.engineInventory` | User-managed engine registry | `[]` | Unique IDs, valid executable paths, UCI protocol, valid options map | Settings snapshot |
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
- `session.autoPauseOnMenu` controls timed-game auto-pause for settings, save flows, and other interrupting menu flows.
- Auto-resume after menu interruption is paired behaviour of `session.autoPauseOnMenu`; it is not a separate stored setting.
- `gameplay.takebackPolicy`, `gameplay.confirmMainlineRewrite`, and `gameplay.analysisBranchExitBehaviour` define the behaviour of historical-node move actions.
- `analysis.resumeLiveAnalysisAfterRestore` applies only after saved-game restore completes.

## Explicit Non-Baseline Settings
The following are intentionally excluded from the baseline settings contract and are tracked in [ideas.md](ideas.md) if needed:

- dark mode
- sound enablement
- panel visibility or fold preferences
- recent games preferences
- tab-switch auto-pause
- mobile panel preference
- variant preferences

## Ownership Notes
- Settings are stored in the user settings snapshot defined in [persistence_contract.md](persistence_contract.md).
- Per-game engine assignment belongs to the saved game payload, not to the global settings schema.
- Session shell restoration belongs to session persistence, even when the behaviour is controlled by settings.
- Remembered panel visibility and section folding belong to persisted UI/session state, not to the consciously saved settings schema.
