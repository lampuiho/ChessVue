# Saves scenario review

Reviewed on 17–18 October 2026 against source and documents based on `21eb39c`. Read the complete SCN-SAVE-01–03, SCN-LOAD-01, SCN-NAV-03, SCN-EXPORT-01, SCN-IMPORT-01–02 and SCN-LIFECYCLE-01–02 flows and branches in [scenarios](../../../docs/HighLevel/scenarios.md), the [persistence contract](../../../docs/HighLevel/persistence_contract.md), and the owning view, stores, serialiser, index, move-recording and workspace hydration code. The baseline follows ease of use, independent engine output and actual-move recording; temporary exploration is not an archive.

Each case below distinguishes source findings from expected acceptance. Named execution evidence comes from the generated Playwright report, joined through [owned metadata](cases/). [JourneyImplementation](../../../docs/JourneyImplementation.md#saves-verification) records the final run and limitations. Picker choices and changes to existing managed files belong only to the isolated journey runtime. They never mutate an in-memory game. Native dialogs, filesystem faults and application shutdown remain separate platform/storage lanes.

## JRN-SAVE-01

SCN-LOAD-01, BR-LOAD-01-CANCEL. Expected: selecting a group/snapshot changes only the browser selection and details; autosave appears above a named-save separator. Source: selection, latest-file choice and insertion are separate actions. Classification: aligned. Compare tab identities, selected state, two/four-ply details and cancel back to the existing workspace.

## JRN-SAVE-02

SCN-LOAD-01. Expected: explicit Opening is two plies; double-click latest loads four-ply Middlegame even though autosave is displayed first. Source: `SavedGameIndexService` chooses latest by file timestamp, independently of presentation order. Classification: aligned. Both variants assert board/history and canonical payload after saving the loaded workspace.

## JRN-SAVE-03

SCN-SAVE-02/03 and SCN-LOAD-01. Expected: one new named file preserves the played board/tree, players, result and clock through reload and explicit load. Source: all writes share canonical serialisation. Classification: aligned, with documentation drift corrected for app-owned route identity and the actual Save game label. Re-save the hydrated workspace to compare all persisted fields while allowing identity/update metadata.

## JRN-SAVE-04

SCN-SAVE-03, BR-SAVE-03-COLLISION-CANCEL. Expected: cancelled replacement preserves every file; confirmed replacement changes only the requested snapshot and updates selected details. Source: overwrite captures its target before the modal and uses a non-overwriting initial write. Classification: aligned. Independent resets exercise cancel and confirm. The write now selects the saved name so its refreshed details are visible.

## JRN-SAVE-05

SCN-SAVE-03, BR-SAVE-03-INVALID-NAME. Expected: invalid names stay editable with inline feedback, disabled Save and no store call/write/ghost entry, including Enter. Source finding: presentation omitted device names, trailing dots and control characters already rejected by the index. Classification: implementation defect; presentation now rejects them before storage. Eighteen independent browser variants cover required names and filename characters; component checks include a control character and assert no store call.

## JRN-SAVE-06

SCN-SAVE-01, BR-SAVE-01-MOVE-COUNT-DISABLED. Expected: interval three writes after three/six new committed plies, preserves named files and replaces one autosave; zero writes none. Source: the move counter belongs to each hydrated workspace and counts new commits, not the preloaded history. Classification: aligned. Assert bytes at intermediate boundaries and reload the six-move autosave. UI-07's exact interval regression is retained in the owned integration suite. Close/write-fault branches remain in their separate lanes.

## JRN-SAVE-07

SCN-EXPORT-01/SCN-IMPORT-01. Expected: canonical version-1 export excludes runtime fields, import allocates a fresh identity and retains actual-move records after continued play, temporary exploration/pruning and reload. Source: recorded seats are copied to played nodes and share canonical serialisation. Classification: aligned with the settled available-output baseline. The test now creates records through normal play using two engines, compares their copied seats against the evaluated parent and reads them from restored history. This completes the former partial recording acceptance. Broader capture/replacement prompts in Q-ANALYSIS-001/Q-ENGINE-001 are unchanged.

## JRN-SAVE-08

SCN-IMPORT-01. Expected: both non-colliding and duplicate external IDs become fresh independent workspaces; original bytes and tab identity remain intact. Source: import allocates identity before insertion. Classification: aligned. Both variants save and reload, comparing the entire canonical payload apart from deliberate metadata changes.

## JRN-SAVE-09

SCN-IMPORT-01/02, BR-IMPORT-01-SCHEMA-VERSION and BR-IMPORT-02-INCOMPLETE. Expected: corrupt, unsupported and incomplete files fail visibly before insertion; session, active route and existing files remain unchanged, then valid import succeeds. Source: validation precedes `insertGame`. Classification: aligned. Three independent variants use owned invalid documents. Unsupported/incomplete rejection is one invalid-document path; partial recovery is outside the contract.

## JRN-SAVE-10

SCN-IMPORT-01/SCN-EXPORT-01 cancellation branches. Expected: cancelling writes nothing, opens no workspace, shows no success and permits retry. Source finding: export cancellation entered the generic error path while import swallowed all picker errors. Classification: implementation defect in cancellation feedback/error distinction. Stores now treat only typed Cancelled as normal cancellation, propagate real picker errors and display success only after a write.

## JRN-SAVE-11

SCN-LIFECYCLE-01/02 and cancellation/fallback branches. Expected: cancellation preserves bytes and selection; deletion removes only the target, updates details to the latest remaining entry and returns to grouped Load when a group becomes empty. Source: refreshed groups drive selected-entry fallback and route replacement. Classification: aligned. Independent cancel/delete variants compare all files and check detail/route fallback.

## JRN-SAVE-12

SCN-LIFECYCLE-01/02, last-game branch. Expected: final deletion leaves a usable empty grouped library; switching Save/Load retains the existing in-memory workspace. Source: managed deletion does not dispose workspace games. Classification: aligned. Delete every entry through the UI, visit both contexts, return and make a legal move.

## JRN-SAVE-13

SCN-NAV-03, BR-NAV-03-MISSING-ENTRY/LOAD-FAIL. Expected: unopened recent uses latest data; already-open recent retains unsaved moves without duplicate insertion; missing/corrupt unopened targets stay Home with no partial workspace and refresh the list. Source finding: Home displayed an error but never refreshed failed entries. Classification: implementation defect; failures now refresh recent projection. Four independent variants assert files, board/history and session identity. Storage changes are explicit external-file simulations after the card renders.

## JRN-SAVE-14

SCN-LOAD-01, BR-LOAD-01-DUPLICATE-ID. Expected: duplicate open identities remap; mismatched internal metadata takes the enumerated group's ID; subsequent saves cannot target the unrelated group. Source: managed reads replace internal ID before workspace collision repair. Classification: aligned. Two browser variants assert canonical content, original bytes, IDs, next-save path and reload. All UI-08 integration permutations (selected/latest/recent/import/collision) are migrated intact.

## JRN-SAVE-15

SCN-SAVE-03/SCN-LOAD-01 and actual-move recording contract. Expected: free analysis, board edit, nested selection, promotion, paused timed and finished payloads restore completely and remain usable; runtime is reconstructed and excluded from saves. Source: hydration reconstructs positions, nodes, player activities and pause ownership. Classification: aligned. Six owned import examples are saved/reloaded/re-saved and exercised; a seventh variant creates actual-move records through live play, prunes exploration and reviews records after reopening. Records and saved workspace branches remain separate concepts.

## JRN-SAVE-16

SCN-SAVE-02/SCN-LOAD-01 missing-game/no-selection branches. Starts from the existing Fresh fixture with no files or open games. Expected: missing workspace cannot save/export; empty Load cannot select and Cancel returns Home. Source: disabled actions and a No active game state guard the invalid Save route. Classification: documentation drift; the guarded route is an intentional usable empty state, rather than a required redirect. No store write or partial workspace is accepted.
