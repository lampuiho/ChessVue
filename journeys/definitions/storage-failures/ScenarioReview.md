# Storage failure review

Reviewed on 19 October 2026 against source revision `77acaa4`, the complete owning flows in `docs/HighLevel/scenarios.md`, the persistence and settings contracts, `PersistenceAndAdministration.md`, BrowserFileSystem, SerializationService, SavedGamesStore, UserSettingService, App, SavedGamesView and GameView. This tranche preserves canonical game/actual-move records and temporary exploration policy. Failures must preserve usable in-memory work, accepted settings and independent saved documents; only completed writes may claim success. No new retry scheduler, automatic export or native atomic-file guarantee is introduced.

The owned seed has two local untimed games, a four-ply current position, a two-ply Opening, Current and neighbouring Other snapshots. Move-count autosave is three; normal browser close checkpoints remain enabled. The adapter controller scopes faults by exact normalised path and operation, consumes only the requested count, holds individual operations and exposes execution outcomes. Held reads capture their result before delivery; writes/deletes commit on release. Reset cancels pending work and clears unused rules. Direct file inspection bypasses faults; the controller cannot change application stores. `startup-session` arms the first session write before mounting and rearms on each bootstrap of that variant.

## JRN-IO-01

SCN-SAVE-02/03, BR-SAVE-03-IO-ERROR. Classification: implementation defect repaired. New-file and overwrite rejection preserve all prior managed bytes and the recoverable form/target. Overwrite errors previously appeared behind the modal; they now also appear within it. Retry saves the five-ply current payload, changes only the requested snapshot and survives reload. Ordinary browser close autosave is a separate permitted write.

## JRN-IO-02

SCN-SAVE-01, BR-SAVE-01-WRITE-FAIL. Classification: aligned. The third committed ply's write fails, leaving the previous auto and named snapshots intact and showing the existing recoverable toast. Three more plies remain playable; the next checkpoint persists all ten plies and restores them after reload. This does not promise immediate automatic retry outside the configured interval.

## JRN-IO-03

SCN-SETTINGS-01, BR-SETTINGS-01-WRITE-FAIL. Classification: aligned with transactional settings acceptance; documentation omission corrected. Failure at the storage boundary retains accepted/cached settings, current chrome and original persisted bytes; the edited theme remains in the draft across category navigation. Retry applies and reloads it. A separate ordinary-browser variant rejects an actual Storage.setItem with QuotaExceededError and exercises BrowserFileSystem's permission error translation. The existing APPLY-FAIL branch describes a later partial application failure, not the pre-acceptance write rejection tested here; no known-good-subset policy is inferred or implemented.

## JRN-IO-04

SCN-LOAD-01, BR-LOAD-01-IO-ERROR. Classification: aligned; missing failure branch documented. Root and child enumeration, selected-details reads, explicit Load reads and externally removed selections are isolated independently. Errors settle the loading/working state, keep the original unsaved five-ply workspace and two tabs, preserve source files and allow valid reselection/load. Only fully parsed documents enter GamesStore; failed reads never create a partial/duplicate tab. Retrying enumeration uses Close then Load, an existing usable path.

## JRN-IO-05

SCN-LIFECYCLE-01/02, NOT-FOUND, IO-ERROR, HAS-FALLBACK and LAST-GAME. Classification: implementation defect repaired. Failed deletion previously retained its confirmation and stale list. The confirmation now closes and enumeration refreshes even on failure; denied writes retain the target and allow a new confirmation/retry. External disappearance performs no delete, reports the stale target and selects a surviving snapshot. If its entire group vanished, the route returns to the grouped library. Neighbouring files and the live workspace remain available. No successful-deletion notice is emitted on failure.

## JRN-IO-06

SCN-EXPORT-01, BR-EXPORT-01-IO-ERROR. Classification: aligned. Picker selection succeeds but the exact export write fails: no destination file or success notice, no managed-file changes. Retrying the same explicit Export writes the canonical current game and shows success. This seeded case does not establish native filesystem behaviour or an operating system download-write guarantee.

## JRN-IO-07

SCN-SAVE-02/03 and SCN-LOAD-01. Classification: aligned with stale-result isolation. Selection/refresh actions explicitly own details delivery through `OperationOwner`; selection replacement and unmount cancel delivery without a watcher or shared counter. A captured Opening details read completes after selecting Current, changing to the other group, entering Save with a Current overwrite confirmation, or unmounting to the board. Its old two-ply payload cannot replace the current selection, another group's name/details or the confirmed overwrite target. Component regressions also reselect the same snapshot before its original read succeeds or fails, preserving its fresh details in both cases. All source bytes remain intact before explicit confirmation; the intended Current target alone can then be replaced.

## JRN-IO-08

SCN-SESSION-02, BR-SESSION-02-CHECKPOINT-FAIL. Classification: implementation defect repaired. App's startup and navigation checkpoint promises previously escaped without handling. The same in-memory games/routes now remain usable with a recoverable session notice; another committed navigation persists the current route and clears that error. History/analysis layout-write rejection already keeps the in-memory fold and shows a toast; a later explicit fold persists and reloads it. Reload assertions account for the independent enabled close autosave. No durable-write claim is made during failure, and there is no automatic rollback of usable layout or game state.

Execution evidence and limitations are recorded in [JourneyImplementation.md](../../../docs/JourneyImplementation.md#storage-failure-verification). No dependent product decision is pending for these storage-rejection paths.
