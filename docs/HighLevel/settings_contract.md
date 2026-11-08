# ChessVue Settings Contract

## Purpose
This document defines the authoritative user-editable settings.

If a field is not described here, it must not appear as a committed low-level settings property unless it is first promoted into this contract. The schema is `settingsSnapshotSchema` in `src/contracts/Settings.ts`; built-in defaults and coercions live in `UserSettingService`.

## Contract Rule
Many behaviours in the high-level scenarios are capabilities, not user settings.

Examples of baseline capabilities that are not themselves settings:

- free analysis/setup exists
- in-game analysis exists
- saved-game restore exists
- browser engine package import exists on the browser target

Only the user-editable choices listed below and the explicitly reserved fields belong in the committed settings schema.

## Settings Table
| Setting | Purpose | Default | Validation | Persistence Owner |
| --- | --- | --- | --- | --- |
| `gameSession.restorePreviousSession` | Reopen prior session when valid | `true` | Boolean | Settings snapshot |
| `gameSession.saveRootPath` | Root folder used for ChessVue's internal save/load files | `saves` | Non-empty relative or absolute path string | Settings snapshot |
| `gameSession.autosaveAfterMoveCount` | Write/update the internal autosave entry after this many committed ply | `1` | Non-negative integer; `0` disables move-count autosave | Settings snapshot |
| `gameSession.autosaveOnClose` | Write/update the internal autosave entry when closing the app or game shell | `true` | Boolean; forced `true` while `restorePreviousSession` is `true` | Settings snapshot |
| `gameSession.autoPauseOnMenu` | Pause timed live games during interrupting menu flows | `true` | Boolean | Settings snapshot |
| `gameDefaults.name` | Name seed for Quick and Custom game | `New Game` | Non-empty after trimming; stored trimmed | Settings snapshot |
| `gameDefaults.timeControl` | Clock for Quick and Custom game | Untimed (`{ preset: untimed, incrementMs: 0 }`) | Named preset with its exact values, or a custom clock of 1 to 600 minutes plus an increment of 0 to 300 whole seconds | Settings snapshot |
| `gameDefaults.whitePlayer` | White (or Player 1) configuration snapshot | Local player named `White` | Optional player payload whose colour matches the seat; engine players need a non-empty entry path; omission means Unassigned | Settings snapshot |
| `gameDefaults.blackPlayer` | Black (or Player 2) configuration snapshot | Engine player copied from the bundled Stockfish profile | As above | Settings snapshot |
| `gameDefaults.randomiseColours` | Randomly assign the two participants to White and Black at creation | `true` | Optional boolean; omitted means fixed colours | Settings snapshot |
| `gameDefaults.analysisEngineProfiles` | Analysis engine configuration snapshots | `[]` | Up to four complete profile snapshots with unique names and non-empty entry paths | Settings snapshot |
| `gameDefaults.allowTakeback` | Takeback preference copied into new games | `true` | Optional boolean; omitted is coerced to `true` | Settings snapshot |
| `gameDefaults.showLiveAnalysisMoves` | Live-game analysis move preference copied into new games | `true` | Optional boolean; omitted is coerced to `false`; free analysis always uses playable analysis moves | Settings snapshot |
| `gameplay.analysisBranchExitBehaviour` | Decide what happens after analysis-only branch creation from history | `returnToLiveNode` | `returnToLiveNode` or `stayOnBranch` | Settings snapshot |
| `gameplay.promotionPolicy` | Decide how promotion is resolved | `requireExplicitSelection` | `requireExplicitSelection` only; not shown in Settings | Settings snapshot |
| `analysis.resumeLiveAnalysisAfterRestore` | Restart live analysis after saved-game restore when engines are available | `true` | Boolean | Settings snapshot |
| `analysis.engineInventory` | User-managed engine profile registry | The bundled Stockfish profile | Unique display names only; remaining profile fields are user-managed values | Settings snapshot |
| `appearance.themeMode` | Decide whether app chrome follows the OS colour scheme or forces light or dark | `system` | `system`, `light`, or `dark` | Settings snapshot |
| `appearance.uiScalePercent` | Global UI scale | `100` | Integer from `75` to `200`; the Settings slider offers `75` to `150` in steps of `5` | Settings snapshot |
| `appearance.boardOrientation` | Default board orientation | `white` | `white` or `black` | Settings snapshot |
| `appearance.showCoordinates` | Show board coordinates | `true` | Boolean | Settings snapshot |
| `appearance.highlightLastMove` | Highlight the most recent move on the board | `true` | Boolean | Settings snapshot |

The bundled Stockfish profile is `{ id: 'stockfish', displayName: 'Stockfish', clientType: 'uciWorker', entryPath: 'engines/stockfish/stockfish-19-lite-single.js', options: {} }`.

## Reserved Appearance Fields
`appearance.boardTheme` and `appearance.pieceTheme` remain in the schema as non-empty theme keys defaulting to `classic` to support future implementation. They are not user-editable baseline settings. The initial phase uses a fixed board and piece presentation; theme selection, additional styles, and customisation UI are deferred. Keep board and piece appearance separate from app chrome in the code structure.

## Built-In Defaults
The built-in time presets are:

- `Bullet`: `1+0`
- `Blitz`: `5+0`
- `Rapid`: `10+0`
- `Classical`: `30+0`
- `Untimed`

Custom time controls are entered in minutes and seconds. The quick game default is `Untimed` unless the user changes it.

## Rules Derived From Settings
- Startup restore attempts the stored game-session snapshot only when `gameSession.restorePreviousSession = true`.
- When session restore is disabled, missing, corrupt, or no longer valid for routing, startup falls back to `/home`.
- `gameSession.saveRootPath` is the logical root for ChessVue's own save files. Internal saves are grouped into one folder per canonical game beneath that root. The browser emulates this structure in its virtual storage without changing the contract.
- `gameSession.autosaveAfterMoveCount` counts committed ply. `0` disables move-count autosave, while `1` means autosave after every committed move.
- `gameSession.autosaveOnClose` controls whether app or shell close writes the internal autosave entry separately from the move-count trigger.
- Accepted settings coerce `gameSession.autosaveOnClose = true` whenever `gameSession.restorePreviousSession = true`; Settings disables the Save on close toggle in that case.
- `gameSession.autoPauseOnMenu` controls timed-game auto-pause when leaving a game for Home, Custom game, the saved-games views (including import and export) and Settings.
- When `gameSession.autoPauseOnMenu` pauses a timed live game, the game surface becomes interaction-locked until the paired auto-resume path or an explicit manual resume clears that pause.
- Auto-resume after menu interruption is paired behaviour of `gameSession.autoPauseOnMenu`; it is not a separate stored setting.
- `gameplay.analysisBranchExitBehaviour` defines the global default exit behaviour after analysis-only historical-node moves. It is stored and editable, but no gameplay flow reads it yet; exiting analysis currently always returns to the live node. Whether historical input may rewrite actual play is governed separately by each game's `allowTakeback` option.
- `analysis.resumeLiveAnalysisAfterRestore` applies only after saved-game restore completes.
- `analysis.engineInventory` validates only that profile names are unique within the saved profile list. Entry path, interface and option values are stored as entered and are consumed later when a profile is used to create an engine participant.
- `appearance.themeMode = system` follows the active OS colour scheme through CSS, while `light` and `dark` force that colour scheme.
- Theme-profile selection and profile snapshots are not user settings. The appearance projection is profile-shaped so that capability can be connected later without changing component CSS.
- `appearance.themeMode` applies to app chrome only; board and piece themes remain separate future appearance paths.
- Accepted appearance applies on Apply, Save or Reset only; unsaved drafts do not change the app.

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
- Settings are stored in the user settings snapshot defined in [persistence_contract.md](persistence_contract.md). Browser engine package files are not settings.
- The settings draft is owned by `SettingsStore` and shared across settings categories and the routed engine profile views. Apply and Save validate and write the whole draft; a failed write keeps both the accepted settings and the draft.
- Game defaults reuse `ICreateGameRequest` and `createGameRequestSchema`, omitting `rootPosition`. Player and analysis engine values are complete configuration snapshots; copied analysis profile IDs are never resolved against the inventory at creation. Settings Apply and Save reject invalid defaults with the same creation validation used by Custom game, without starting engines.
- Selecting a profile copies it into defaults. Editing or deleting the source profile leaves defaults unchanged; each created game receives its own configuration.
- With `randomiseColours`, the white and black input slots represent Player 1 and Player 2. Creation or start-from-setup draws their colours once when both are assigned, copying each participant's engine configuration with them. Partial/free-analysis requests do not draw. Games save the resolved assignments; restoring a game never draws again. The toggle is disabled while either default player is unassigned.
- Package removal includes accepted and draft default engine paths in its usage check.
- `showLiveAnalysisMoves` is persisted in each game; its global creation default only seeds future games.
- `allowTakeback` is persisted in each game; its global creation default only seeds future games.
- Session shell restoration belongs to session persistence, even when the behaviour is controlled by settings.
- Remembered panel visibility and foldable-section state belong to persisted UI/session state, not to the consciously saved settings schema.

Quick game from Home and the game menu uses every accepted creation default. Custom game begins with an isolated copy of those accepted defaults. Unsaved settings drafts do not initialise either creation flow. Either unassigned player produces free analysis. Required player-engine readiness failure prevents insertion and offers **Edit game defaults**; optional analysis engine failures retain the existing per-engine error behaviour. See the archived [quick game defaults design](../ArchivedPlans/QuickGameDefaultsDesign.md).
