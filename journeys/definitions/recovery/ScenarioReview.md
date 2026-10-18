# Recovery scenario review

Reviewed on 18 October 2026 against source/document revision `e6231ac` and the existing Settings changes in the working tree. The default seed retains `recovery-valid`, its e4 opening, corrupt settings/layout, missing game and version-99 save. Reviewed SCN-SESSION-01/02/03, SCN-NAV-02 and SCN-IMPORT-02, the persistence/settings/state contracts, App startup, UiStateStore, SettingsStore, SavedGamesStore, game hydration and engine runtime ownership. The priorities are usable recovery, preserved games/preferences and independent multi-engine work; recorded analysis and exploratory pruning retain their established contracts.

Execution evidence belongs in [Recovery verification](../../../docs/JourneyImplementation.md#recovery-verification). Owned metadata lists the executable browser variants. The integration suite preserves UI-13 and observes document reads, engine search counts and pending-turn identity. Native storage faults, NW.js execution and production worker failures remain in their respective lanes.

## JRN-RECOVERY-01

SCN-SESSION-02/03; BR-SESSION-03-SETTINGS-CORRUPT and BR-SESSION-03-GAME-VERSION. Classification: aligned, with scenario documentation drift corrected. Combined startup uses default System appearance, White orientation and expanded panels, repairs the session to the valid game, names each recoverable fault and accepts a normal black reply. Source settings/layout/version-99 bytes remain available. Startup fallback uses in-memory settings defaults; it does not call the explicit user Reset operation or overwrite the corrupt settings file.

## JRN-RECOVERY-02

SCN-SESSION-02/03; missing game, corrupt settings and unsupported version branches. Classification: aligned. Four independent seeds corrupt only settings, only layout, reference a missing game, or reference a version-99 game. Each has exactly one warning, a valid restored board and the correct effective appearance/autosave policy. Valid settings/layout are preserved independently; the default layout applies only to the layout fault. Invalid games never enter the workspace, and their source files remain present.

## JRN-RECOVERY-03

SCN-SESSION-02. Classification: aligned; stale Planned status and `currentGameId` wording corrected. Ten variants cross five remembered routes with both analysis-resume preferences: game, Settings, library, selected library game and Save. The session restores two games in its specified order, selects the remembered second tab and leaves an unrelated saved game closed. All route surfaces are usable after startup. Returning to the game exposes two copied analysis assignments, the expected running status and retained layout; normal play continues without inserting another tab. Integration also checks restoration through the ordinary application stores.

## JRN-RECOVERY-04

SCN-SESSION-02 and the restore-policy contract. Classification: aligned. The test disables Restore previous session using Settings, applies, reloads the remembered Settings route and reaches Home with no workspace or tabs. The unchanged game document remains accessible through Load and opens with the saved position and history. UI layout remains independent of the restore-session setting. The existing UI-13 disabled-restore regression is retained in the focused integration module.

## JRN-RECOVERY-05

SCN-SESSION-01/02 and SCN-NAV-02; Home fallback, partial state and missing-game branches. Classification: aligned with the persistence contract. Seven variants cover no restorable requested games, a stale active requested ID, a syntactically valid unknown game route, an invalid route category, an active ID outside the open list, UI-only state and duplicate IDs. Valid sessions are coerced and failed IDs removed; structurally invalid session documents fall back to Home as a whole, preserving independent settings/layout and loadable saves. This distinction follows the corrupt-session contract rather than weakening canonical deserialisation. A second launch preserves the repaired session without warnings, phantom tabs or an implicit new game.

## JRN-RECOVERY-06

SCN-SESSION-03. Classification: aligned. Dismiss, Saved games and Settings use separate resets. Navigation reaches a usable library or settings form, returns to the restored game, preserves source files and allows a normal move. Dismissal is local to the running app; it does not erase the cause or acknowledge it permanently.

## JRN-RECOVERY-07

SCN-SESSION-02/03; missing-game and unsupported-version branches. Classification: aligned. Two reloads read the repaired one-game session without repeating removed-ID warnings or inserting duplicates. Persistent settings/layout corruption still warns, and corrupt source bytes are not silently overwritten. Integration spies on the actual document-read boundary after restart and requires the valid game's save to be the sole game-document read; warning text alone would not prove targeted lookup.

## JRN-RECOVERY-08

SCN-SESSION-02 and the state/engine contracts. Classification: aligned. Five browser variants restore an unavailable player, a failed analysis seat alongside a working seat, a paused engine game, board edit with assigned analysis, and one live engine turn. Player reassignment and board play remain usable; analysis errors stay scoped to the failing seat. Paused player work waits for explicit resume; board edit starts neither analysis nor player work until editing finishes. A live restore produces one reply across navigation/save/reload. Three integration checks count actual player/analysis calls and subscriptions and preserve the pending next-turn promise across routes, covering runtime ownership beyond visible history counts.
