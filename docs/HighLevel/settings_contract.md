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

Only the user-editable choices listed below and the explicitly reserved appearance fields belong in the committed settings schema.

## Settings Table
| Setting | Purpose | Default | Validation | Persistence Owner |
| --- | --- | --- | --- | --- |
| `gameSession.restorePreviousSession` | Reopen prior session when valid | `true` | Boolean | Settings snapshot |
| `gameSession.saveRootPath` | Root folder used for ChessVue's internal save/load files | `saves` | Non-empty relative or absolute path string | Settings snapshot |
| `gameSession.autosaveAfterMoveCount` | Write/update the internal autosave entry after this many committed ply | `1` | Non-negative integer; `0` disables move-count autosave | Settings snapshot |
| `gameSession.autosaveOnClose` | Write/update the internal autosave entry when closing the app or game shell | `true` | Boolean | Settings snapshot |
| `gameSession.autoPauseOnMenu` | Pause timed live games during interrupting menu flows | `true` | Boolean | Settings snapshot |
| `gameDefaults.name` | Name seed for Quick and Custom game | `New Game` | Non-empty trimmed string | Settings snapshot |
| `gameDefaults.timeControl` | Clock for Quick and Custom game | `untimed` | Named preset or valid custom clock; UI uses minutes/seconds | Settings snapshot |
| `gameDefaults.whitePlayer` | White player configuration snapshot | Local White | Optional player payload; omission means Unassigned | Settings snapshot |
| `gameDefaults.blackPlayer` | Black player configuration snapshot | Local Black | Optional player payload; omission means Unassigned | Settings snapshot |
| `gameDefaults.randomiseColours` | Randomly assign the two participants to White and Black at creation | `false` | Optional boolean; omitted means fixed colours | Settings snapshot |
| `gameDefaults.analysisEngineProfiles` | Analysis engine configuration snapshots | `[]` | Up to four complete profile snapshots with unique names | Settings snapshot |
| `gameDefaults.allowTakeback` | Takeback preference copied into new games | `true` | Boolean; omitted uses built-in default | Settings snapshot |
| `gameDefaults.showLiveAnalysisMoves` | Live-game analysis move preference copied into new games | `false` | Boolean; free analysis uses playable analysis moves | Settings snapshot |
| `gameplay.analysisBranchExitBehaviour` | Decide what happens after analysis-only branch creation from history | `returnToLiveNode` | `returnToLiveNode` or `stayOnBranch` | Settings snapshot |
| `gameplay.promotionPolicy` | Decide how promotion is resolved | `requireExplicitSelection` | `requireExplicitSelection` only in baseline | Settings snapshot |
| `analysis.resumeLiveAnalysisAfterRestore` | Restart live analysis after saved-game restore when engines are available | `true` | Boolean | Settings snapshot |
| `analysis.engineInventory` | User-managed engine profile registry | Bundled Stockfish | Unique profile names only; remaining profile fields are user-managed values | Settings snapshot |
| `appearance.themeMode` | Decide whether app chrome follows the OS colour scheme or forces light or dark | `system` | `system`, `light`, or `dark` | Settings snapshot |
| `appearance.uiScalePercent` | Global UI scale for desktop layout | `100` | Integer from `75` to `200` | Settings snapshot |
| `appearance.boardOrientation` | Default board orientation | `white` | `white` or `black` | Settings snapshot |
| `appearance.showCoordinates` | Show board coordinates | `true` | Boolean | Settings snapshot |
| `appearance.highlightLastMove` | Highlight the most recent move on the board | `true` | Boolean | Settings snapshot |

## Reserved Appearance Fields
`appearance.boardTheme` and `appearance.pieceTheme` remain in the schema as non-empty theme keys defaulting to `classic` to support future implementation. They are not user-editable baseline settings. The initial phase uses a fixed board and piece presentation; theme selection, additional styles, and customisation UI are deferred. Keep board and piece appearance separate from app chrome in the code structure.

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
- `appearance.themeMode = system` follows the active OS colour scheme, while `light` and `dark` force that colour scheme.
- Theme-profile selection and profile snapshots are not user settings in the baseline. The appearance projection is profile-shaped so that capability can be connected later without changing component CSS.
- `appearance.themeMode` applies to app chrome only; board and piece themes remain separate future appearance paths.

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
- Game defaults reuse `ICreateGameRequest` and `createGameRequestSchema`, omitting `rootPosition`. Player and analysis engine values are complete configuration snapshots; copied analysis profile IDs are never resolved against the inventory at creation.
- Selecting a profile copies it into defaults. Editing or deleting the source profile leaves defaults unchanged; each created game receives its own configuration.
- With `randomiseColours`, the white and black input slots represent Player 1 and Player 2. Creation or start-from-setup draws their colours once when both are assigned, copying each participant's engine configuration with them. Partial/free-analysis requests do not draw. Games save the resolved assignments; restoring a game never draws again.
- Package removal includes accepted and draft default engine paths in its existing usage check.
- `showLiveAnalysisMoves` is persisted in each game; its global creation default only seeds future games.
- `allowTakeback` is persisted in each game; its global creation default only seeds future games.
- Session shell restoration belongs to session persistence, even when the behaviour is controlled by settings.
- Remembered panel visibility and foldable-section state belong to persisted UI/session state, not to the consciously saved settings schema.

Quick game from Home and the game menu uses every accepted creation default. Custom game begins with an isolated copy of those accepted defaults. Unsaved settings drafts do not initialise either creation flow. Either unassigned player produces free analysis. Required player-engine readiness failure prevents insertion; optional analysis engine failures retain the existing per-engine error behaviour.
