# Persistence And Administration Flows

## Scope
This document covers `SCN-SAVE-01` to `SCN-LIFECYCLE-02`.

## Persistence And File I/O

### SCN-SAVE-01 - Autosave on State Mutation

#### Flow
| `Owning mutation committed` | `GamesStore.saveGame` | `RecentGameStore.recordAutosavedGame` | `SettingsStore.saveSettings` | `UiStateStore.saveGameSession` | `UiStateStore.saveLayoutState` |
| --- | --- | --- | --- | --- | --- |
| `GamesStore.saveGame` | `GamesStore._buildPersistedWorkspace` |  |  |  |  |
| `RecentGameStore.recordAutosavedGame` | `GamesStore._persistWorkspace` | `RecentGameStore._upsertRecentEntry` |  |  |  |
| `SettingsStore.saveSettings` |  | `RecentGameStore._sortMostRecentFirst` | `SettingsStore._persistSnapshot` |  |  |
| `UiStateStore.saveGameSession` |  |  | `SettingsStore._schedulePersistWrite` | `UiStateStore._saveGameSessionSnapshot` |  |
| `UiStateStore.saveLayoutState` |  |  |  | `UiStateStore._schedulePersistWrite` | `UiStateStore._saveLayoutState` |
| `Shared._schedulePersistWrite` |  |  |  |  | `UiStateStore._schedulePersistWrite` |

- Requirement verification: `Pass`. Game, recent-games, settings, game-session, and UI-layout artefacts stay separated while still achieving eventual consistency.

### SCN-SAVE-02 - Manual Save Game to File

#### Flow
| `Menu.saveRequested` | `GamesStore.pauseGame` | `GamesStore.exportGame` | `FileIoAdapter.saveGame` | `RecentGameStore.recordManuallySavedGame` | `GamesStore.resumeGame` |
| --- | --- | --- | --- | --- | --- |
| `GamesStore.pauseGame` | `GamesStore._maybeAutoPauseForMenu` |  |  |  |  |
| `GamesStore.exportGame` |  | `GamesStore._buildPersistedWorkspace` |  |  |  |
| `FileIoAdapter.saveGame` |  | `GamesStore._exportGame` | `FileIoAdapter._openSaveDialog` |  |  |
| `RecentGameStore.recordManuallySavedGame` |  |  | `FileIoAdapter._writeGame` | `RecentGameStore._upsertRecentEntry` |  |
| `GamesStore.resumeGame` |  |  |  | `RecentGameStore._sortMostRecentFirst` | `GamesStore._resumeIfMenuOwnedPause` |

- Settings coverage: `session.autoPauseOnMenu` decides whether timed live games are paused for export. The menu pause owner is preserved so export return cannot auto-resume a manually paused game.
- Requirement verification: `Pass`. Export writes the same canonical document shape used by autosave, returns the final file path for recent-history metadata, and honours menu auto-pause policy.

### SCN-LOAD-01 - Load Valid Game from File

#### Flow A - Import And Insert The Workspace
| `Menu.loadRequested` | `GamesStore.importGame` | `FileIoAdapter.loadGame` | `GamesStore.insertGame` | `RecentGameStore.recordManuallySavedGame` |
| --- | --- | --- | --- | --- |
| `GamesStore.importGame` |  |  |  |  |
| `FileIoAdapter.loadGame` |  | `FileIoAdapter._openLoadDialog` |  |  |
| `GamesStore.insertGame` |  | `FileIoAdapter._readGame` | `GamesStore._remapDuplicateIdIfNeeded` |  |
| `RecentGameStore.recordManuallySavedGame` |  |  | `GamesStore._hydrateWorkspace` | `RecentGameStore._upsertRecentEntry` |
|  |  |  |  | `RecentGameStore._sortMostRecentFirst` |

#### Flow B - Resume Analysis For The Imported Workspace
| `Imported workspace ready for analysis` | `EnginesStore.startAnalysis` |
| --- | --- |
| `EnginesStore.startAnalysis` | `EnginesStore._startAnalysisSessions` |
| `EngineClient.startSession` | `EnginesStore._bindAnalysisCallbacks` |
| `EngineClient.syncPosition` | `EnginesStore._forwardAnalysisUpdate` |
| `EngineClient.startAnalysis` |  |

#### Flow C - Request An Engine Turn For The Imported Workspace
| `Imported live current position ready for engine move` | `EnginesStore.startPlayerTurn` | `GamesStore.makeMove` |
| --- | --- | --- |
| `GamesStore._maybeRequestEngineTurn` | `EnginesStore._startPlayerTurnSearch` | `GamesStore._assertMoveAllowed` |
| `EnginesStore.startPlayerTurn` | `EnginesStore._bindPlayerTurnCallbacks` | `GamesStore._resolveMoveContext` |
| `EngineClient.startSession` |  | `GamesStore._applyMoveByContext` |
| `EngineClient.syncPosition` |  | `GamesStore._persistWorkspaceIfNeeded` |
| `EngineClient.startAnalysis` |  | `GamesStore._maybeRequestEngineTurn` |
| `GamesStore.makeMove` |  |  |

- State/settings coverage: the game workspace is restored first, including a restored `historyReview`, paused state, or finished result. `analysis.resumeLiveAnalysisAfterRestore` decides whether continuous analysis restarts after the persisted game state is shown.
- Requirement verification: `Pass`. Game-state restore happens before live analysis resumes, duplicate IDs are repaired before the recent-entry write, and engine-turn restart stays aligned with the restored live state.

### SCN-LOAD-02 - Load Invalid/Corrupt Game File

#### Flow
| `Menu.loadRequested` | `GamesStore.importGame` | `FileIoAdapter.loadGame` | `UiStateStore.showModal` |
| --- | --- | --- | --- |
| `GamesStore.importGame` |  |  |  |
| `FileIoAdapter.loadGame` |  | `FileIoAdapter._openLoadDialog` |  |
| `SerializationService._parseJson` |  | `FileIoAdapter._readGame` |  |
| `SerializationService._migrateBySchemaVersion` |  | `FileIoAdapter._mapFileIoError` |  |
| `UiStateStore.showModal` |  |  |  |

- UI surface coverage: import failure uses the shared dialog shell; partial-recovery cases may expose continue or cancel actions, while unrecoverable cases reduce to acknowledge-and-close behaviour.
- Requirement verification: `Pass`. Failed import does not mutate the current session state.

## Settings And Engine Inventory

### SCN-SETTINGS-01 - Update Visual/UI Preferences

#### Flow A - Apply Accepted Settings
| `SettingsView.applyRequested` | `SettingsStore.updateSettings` | `SettingsStore.applySettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.applySettings` |  | `SettingsStore._applyAcceptedSettings` |
| `SettingsStore._resolveThemeMode` |  | `SettingsStore._resolveThemeMode` |
| `SettingsStore._buildAppearanceProjection` |  | `SettingsStore._buildAppearanceProjection` |

#### Flow B - Save Accepted Settings
| `SettingsView.saveRequested` | `SettingsStore.updateSettings` | `SettingsStore.saveSettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.saveSettings` |  | `SettingsStore._persistSnapshot` |

- UI surface coverage: category tabs switch the active settings section, `Cancel`, `Save`, and `Apply` stay in the primary bottom-right row, and the secondary reset action area remains outside that primary commit row.
- Route coverage: settings categories are routed through `/settings/session`, `/settings/gameplay`, `/settings/appearance`, and `/settings/engines`, with `/settings` redirecting to `/settings/session`.
- Settings coverage: `appearance.themeMode` is handled alongside the existing appearance fields. `system` follows `SystemThemeAdapter`, while `light` and `dark` force built-in app themes.
- Requirement verification: `Pass`. Validation happens before apply or persistence, only committed settings fields are writable, engine inventory stays inside the same settings draft model as the other fields, and accepted appearance changes refresh the shared app-theme variables immediately.

### SCN-SETTINGS-02 - Reset Settings to Defaults

#### Flow
| `SettingsView.resetRequested` | `UiStateStore.showModal` | `SettingsStore.resetSettings` | `UiStateStore.hideModal` |
| --- | --- | --- | --- |
| `UiStateStore.showModal` |  |  |  |
| `SettingsStore.resetSettings` |  | `SettingsStore._defaultSettings` |  |
| `SettingsStore._resolveThemeMode` |  | `SettingsStore._resolveThemeMode` |  |
| `SettingsStore._buildAppearanceProjection` |  | `SettingsStore._buildAppearanceProjection` |  |
| `SettingsStore._persistSnapshot` |  | `SettingsStore._persistSnapshot` |  |
| `UiStateStore.hideModal` |  |  |  |

- UI surface coverage: reset is triggered from the secondary settings action area and always routes through the shared confirmation dialog before the default snapshot is applied.
- Requirement verification: `Pass`. Reset restores the authoritative default schema, reprojects the default appearance state, and persists it atomically.

### SCN-ENGINE-01 - Add Engine Configuration

#### Flow A - Add And Apply The New Profile
| `EngineInventoryEditor.addRequested` | `SettingsStore.updateSettings` | `SettingsStore.applySettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.applySettings` |  | `SettingsStore._applyAcceptedSettings` |

#### Flow B - Add And Save The New Profile
| `EngineInventoryEditor.addRequested` | `SettingsStore.updateSettings` | `SettingsStore.saveSettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.saveSettings` |  | `SettingsStore._persistSnapshot` |

- UI surface coverage: add opens the dedicated profile editor surface, where option rows may be added, edited, or removed before the draft is applied or saved.
- Requirement verification: `Pass`. Unique profile-name validation happens before the engine record becomes part of the accepted settings snapshot, while all other profile values are stored as entered.

### SCN-ENGINE-02 - Update or Remove Engine Configuration

#### Flow A - Update An Existing Profile
| `EngineInventoryEditor.editRequested` | `SettingsStore.updateSettings` | `SettingsStore.applySettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.applySettings` |  | `SettingsStore._applyAcceptedSettings` |

#### Flow B - Remove An Existing Profile
| `EngineInventoryEditor.deleteRequested` | `SettingsStore.updateSettings` | `SettingsStore.saveSettings` |
| --- | --- | --- |
| `SettingsStore.updateSettings` | `SettingsStore._validatePatch` |  |
| `SettingsStore._normaliseEngineInventory` | `SettingsStore._normaliseEngineInventory` |  |
| `SettingsStore._projectPendingSettings` | `SettingsStore._projectPendingSettings` |  |
| `SettingsStore.saveSettings` |  | `SettingsStore._persistSnapshot` |

- UI surface coverage: copy, edit, and delete originate from the engine-profile row actions, with edit reopening the same dedicated profile editor surface and delete affecting the settings draft only.
- Requirement verification: `Pass`. Edit and remove operations remain consistent with `Cancel`, `Apply`, and `Save`, and profile edits affect future assignments rather than mutating already seated engine participants.

## Lifecycle Cleanup

### SCN-LIFECYCLE-01 - Delete Inactive Game

#### Flow
| `GameTabs.deleteRequestedForInactiveGame` | `UiStateStore.showModal` | `GamesStore.deleteGame` | `UiStateStore.closeTab` | `UiStateStore.saveGameSession` |
| --- | --- | --- | --- | --- |
| `UiStateStore.showModal` |  |  |  |  |
| `GamesStore.deleteGame` |  | `GamesStore._assertGameExists` |  |  |
| `GamesStore._stopGameSessions` |  | `GamesStore._stopGameSessions` |  |  |
| `GamesStore._removePersistedDocument` |  | `GamesStore._removePersistedDocument` |  |  |
| `UiStateStore.closeTab` |  |  | `UiStateStore._coerceOpenTabs` |  |
| `UiStateStore.saveGameSession` |  |  |  | `UiStateStore._saveGameSessionSnapshot` |

- Requirement verification: `Pass`. Deletion removes runtime, persistence, and tab state together.

### SCN-LIFECYCLE-02 - Delete Active Game and Switch Context

#### Flow
| `GameTabs.deleteRequestedForActiveGame` | `UiStateStore.showModal` | `GamesStore.deleteGame` | `GamesStore.listGames` | `UiStateStore.setActiveGame` |
| --- | --- | --- | --- | --- |
| `UiStateStore.showModal` |  |  |  |  |
| `GamesStore.deleteGame` |  | `GamesStore._assertGameExists` |  |  |
| `GamesStore.listGames` |  | `GamesStore._selectFallbackGameId` |  |  |
| `UiStateStore.setActiveGame` |  |  |  | `UiStateStore._coerceActiveRoute` |
| `Router._selectFallbackRoute` |  |  |  |  |

- Requirement verification: `Pass`. Active-game deletion cannot leave a dangling route or session pointer.
