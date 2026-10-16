# Save transfer scenario review

Reviewed on 15 October 2026 against working-tree documents based on `2d693f7`. Sources: full SCN-EXPORT-01/SCN-IMPORT-01 flows and branches in [scenarios](../../../docs/HighLevel/scenarios.md), the [persistence contract](../../../docs/HighLevel/persistence_contract.md), `SavedGamesStore.ts`, `SavedGamesView.vue` and `SerializationService.ts`. Execution is separate: the named tests under `e2e/journeys/saves/ImportExport.spec.ts` are aggregated from `test-results/JourneyResults.json` by `npm run journey -- report`.

## JRN-SAVE-07

Expected: export uses version 1 without runtime fields; importing it preserves the canonical workspace and allocates a new ID; explicit saving and reload retain the imported position. Source inspection: import replaces external identity before insertion and export shares managed-save serialisation. Classification: aligned for this fixture's board/tree/players/options/result/clock payload. The former seeded round-trip assertion is preserved and strengthened with full payload comparisons and reload.

Acceptance scope is partial: this seed contains no actual-move analysis records, so the test supplies no evidence for the recording extension in the journey plan. That work remains explicitly tracked rather than counted as passed. This migration has not investigated or resolved Q-ANALYSIS-001/Q-ENGINE-001; their review-prompt status is unchanged. Export cancellation/write faults, timed menu ownership and invalid import branches remain separate backlog cases. Native picker behaviour is unverified.

## JRN-SAVE-08

Expected: importing either a non-colliding ID or an already-open ID creates a fresh independent workspace, leaves original bytes untouched and restores after saving/reload. Source inspection: `SavedGamesStore.importGame` allocates the ID regardless of collision before presentation receives the game. Classification: aligned with SCN-IMPORT-01 and the managed/external identity contract. Each import variant resets the seed; assertions compare the complete canonical payload apart from deliberate identity/timestamp metadata and verify session tab identities separately.
