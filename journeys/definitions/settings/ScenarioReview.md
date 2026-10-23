# Settings scenario review

Reviewed on 18 October 2026 against source/document revision `cf38d92` and this tranche's working-tree changes. The owned seed preserves `settings-game`, its e4/e5 opening, dark chrome, Black orientation, three profiles and autosave interval 3. Reviewed complete SCN-SETTINGS-01/02, SCN-ENGINE-01/02/03 and SCN-NAV-01, the settings/persistence contracts, SettingsView, SettingsStore, EnginesStore, ModalHost, App and browser/UCI platform paths. The product priorities are [ease of use, interactive analysis and multiple engines](../../../docs/JourneyTestPlan.md#product-intent-and-usability-baseline). Actual-move recording and exploratory pruning are unchanged.

Execution evidence and limitations are recorded in [Settings verification](../../../docs/JourneyImplementation.md#settings-verification). Case metadata names every browser variant; discovery alone is not a pass. UI-04/UI-14 retain their original assertions in focused integration suites, alongside subscription ownership and configured UCI command checks.

## JRN-SETTINGS-01

SCN-SETTINGS-01. Classification: aligned. Both orientations apply light chrome, hide coordinates/highlights, return and play Nf3 on the correct squares, save and reload. Board piece, history and canonical live-path assertions accompany appearance persistence. Re-enabling coordinates/highlights renders all sixteen labels and both last-move squares. Draft theme edits do not affect accepted chrome before Apply.

## JRN-SETTINGS-02

SCN-SETTINGS-01 step 4. Classification: aligned. System, light and dark are independent variants, each alternating emulated host themes after three settings/game round trips. System follows the host, explicit modes hold, and settings bytes remain unchanged. Integration checks verify that App and SettingsStore neither query nor subscribe to system-theme changes across navigation and disposal. SettingsView emits `appearanceChanged` after successful Apply, Save or Reset. App installs the accepted policy and both palette banks; CSS follows the host in system mode. Browser checks assert rendered colours while `matchMedia` throws, proving that host changes do not depend on a JavaScript theme handler.

## JRN-SETTINGS-03

SCN-SETTINGS-01. Classification: aligned with the plan's visible bounds. The range exposes 75 and 150; the schema's 200 limit is not a UI option. Each endpoint checks the computed root font, both board corners, legal input/history, creation dialog fields/actions and library navigation against the viewport after normal scrolling. These are functional reachability assertions at the default desktop viewport, not a claim that manual readability/usability review or all window sizes are complete.

## JRN-SETTINGS-04

SCN-NAV-01 / BR-NAV-01-DIRTY-LEAVE. Classification: documentation drift and fixture defect corrected. The guard offers Keep editing and Discard changes; Apply/Save are explicit commits on Settings. Return, Cancel and browser Back each preserve the draft/route when kept, then discard and return to the game with accepted preferences intact. Journey bootstrap previously installed an empty history-state object; Vue Router trusted it, generated NaN positions and rolled a cancelled Back to the wrong category. Bootstrap now clears state to null so the router initialises valid positions. Settings has no exposed game tabs, so integration retains arbitrary Home/library navigation guards rather than inventing a browser tab control. Browser Back starts from Session to leave the component; Back between settings categories deliberately retains the shared draft.

## JRN-SETTINGS-05

SCN-SETTINGS-01 and SCN-NAV-01 dirty leave. Classification: aligned. Apply saves light theme and stays; a subsequent orientation edit is discarded while the theme remains. Save then commits orientation, leaves, and survives reload. No implicit Save choice is added to the discard dialog.

## JRN-SETTINGS-06

SCN-SETTINGS-02 / BR-SETTINGS-02-CANCEL. Classification: aligned. Cancel preserves the entire snapshot and all three profiles. Confirm persists default session, appearance and empty inventory, updates running System chrome and survives reload. Reset failure and partial-apply failure branches are not claimed by this successful-reset case; storage faults remain in JRN-IO.

## JRN-SETTINGS-07

SCN-ENGINE-01 and assignment entry points in SCN-ENGINE-03. Classification: documentation drift corrected. Save profile stages the record in SettingsStore's draft; Apply/Save persists it. The scenario and low-level flow previously labelled the editor planned, assigned staging to EnginesStore and implied immediate persistence. Browser assertions compare the saved snapshot before Apply, reload the accepted profile and check both Custom selectors, player selection and analysis selection. A running new analysis seat retains its configured Hash value, visible score/depth and three saved PVs. The existing score-only preference remains in force even in in-game analysis. UI-04 additionally checks inventory reactivity while a selector is already mounted.

## JRN-SETTINGS-08

SCN-ENGINE-01/02 / BR-ENGINE-01-DUPLICATE and BR-ENGINE-02-DUPLICATE-COPY. Classification: aligned. Empty/whitespace names and duplicate names are rejected in the editor. Two copies receive distinct suggested names and persisted IDs; manually colliding a copied name is rejected. Cancelling a name/option edit leaves the original profile unchanged. The editor supports literal user-entered paths/options; it does not validate engine availability at profile-save time.

## JRN-SETTINGS-09

SCN-ENGINE-02/03 / BR-ENGINE-02-DELETE-IN-USE and BR-ENGINE-03-SAME-SELECTION. Classification: implementation defect corrected. Rename/change-path/change-options and deletion are independent variants after seating Journey A as Black. Keep Journey A preserves the complete copied assignment, future player/Custom choices reflect the new inventory, and the original engine still replies legally after Nf3. This exposed an existing untimed-engine failure: player searches required both clocks even though untimed engine assignment was allowed. Untimed player/ponder commands now use a bounded 1000 ms search, owned by build/runtime configuration rather than a new preference; malformed timed clocks still fail explicitly. Canonical saves compare assignments before/after continuation; reload preserves Keep existing. An ordinary-browser variant removes the bundled Stockfish profile and verifies a legal untimed reply through the real worker. This proves inventory edits do not replace in-game payloads.

## JRN-SETTINGS-10

SCN-ENGINE-01 option workflow. Classification: aligned; ownership documentation corrected. UI tests remove Hash, save booleans, a negative decimal, whitespace-preserving text and an empty string, reload and initialise analysis with visible depth, copied configured options and three saved PVs. The analysis request explicitly selects three PVs independently of the configured MultiPV 2 startup value; it does not rewrite the profile or seat options. Integration observes the actual transport's setoption commands and checks metadata defaults (MultiPV 3, Hash 16) do not rewrite configured MultiPV 2 or add Hash. Option discovery is a store capability; the present editor uses a name/value table, without a discovery button.

## JRN-SETTINGS-11

SCN-SETTINGS-01, SCN-NAV-01 / BR-NAV-01-AUTO-PAUSE-DISABLED and the settings/persistence contracts. Classification: aligned; stale settings overview corrected. Seven independent variants exercise interval 0/2 at a new logical save root, restore disabled with close autosave off/on, enabling restore coercing close autosave on, and both menu-pause policies under a controlled clock. New-root autosaves/named saves restore correctly; original-root bytes remain unchanged. Restore disabled opens Home without tabs while files remain loadable. A browser pagehide checkpoint tests close policy; it does not prove an OS can await asynchronous tab-shutdown persistence or native NW.js close behaviour.
