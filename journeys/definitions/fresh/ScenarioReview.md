# Fresh journey scenario review

Reviewed on 15 October 2026 against working-tree design documents based on `2d693f7`. Source inspection and execution evidence are recorded separately. This review covers the case branches below; it does not establish every branch of their owning scenarios.

Sources: [creation/session scenarios](../../../docs/HighLevel/scenarios.md), [state model](../../../docs/HighLevel/state_model.md), [settings contract](../../../docs/HighLevel/settings_contract.md), [persistence contract](../../../docs/HighLevel/persistence_contract.md), [engine runtime](../../../docs/HighLevel/engine_runtime.md), `HomeView.vue`, `GameCreationModal.vue`, `ModalHost.vue`, `GameWorkspaceComposable.ts`, `SettingsView.vue` and the normal autosave/serialisation paths.

Execution: named Playwright cases in `e2e/journeys/fresh/`; `npm run journey -- report` aggregates the latest `test-results/JourneyResults.json`. A missing or partial run is unverified. Baseline and implementation checks are documented in [JourneyImplementation.md](../../../docs/ArchivedPlans/JourneyImplementation.md).

## JRN-FRESH-01

Expected: empty Home, Load and Settings remain usable without creating a workspace or managed save. Source inspection: startup writes the session shell, while Home hides recents when the library is empty. Classification: aligned functional flow; SCN-SESSION-01's single-row button presentation describes an older layout. The current cards preserve the same entry actions. Read-error/fallback branches remain outside this case.

## JRN-FRESH-02

Expected: Quick game creates one local/local workspace; e2-e4 updates board, history and turn, persists through autosave and reloads through normal startup. Source inspection: both Home and menu quick actions use name/time defaults and explicit local players. Classification: aligned. SCN-GAME-01's conditional confirmation-cancel branch is not applicable because Quick game has no confirmation; custom cancellation is covered separately. Illegal-move and source-cancellation assertions remain in the Play backlog.

## JRN-FRESH-03

Expected: changing custom options then cancelling by button, close, Escape or backdrop creates no workspace/save; reopening uses committed defaults. Source inspection: `ModalDialog` supports all four dismissals and `ModalHost` creates only after submission. Classification: aligned.

## JRN-FRESH-04

Expected: a named 5+2 local game retains disabled takebacks and one workspace after repeated submit attempts. Source inspection: the modal busy flag guards creation; policy and time control are game-owned. The test clicks the visible toggle label, because its styled native input ignores pointer events. Classification: aligned; persisted options are checked after an actual move and reload.

## JRN-FRESH-05

Expected: blank names and invalid minute/increment values block submission; 1/600 minutes and 0/300 seconds are accepted independently. Source inspection: inline validation and disabled submission enforce these limits; names are trimmed. Classification: aligned. Each invalid value and valid boundary has its own isolated context, with persisted time controls checked for accepted values.

## JRN-FRESH-06

Expected: a configured engine replies once in a timed game; an unavailable required player engine leaves the form open and the workspace empty, then permits correction. Source inspection: `validateRequiredEngines` performs the handshake before insertion. Classification: aligned with BR-GAME-02-ENGINE-MISSING. Profiles are created through Settings, preserving Fresh's empty seed. Legal reply handling is shared with the independently tested UCI client; no native executable is launched.

## JRN-FRESH-07

Expected: explicit Free analysis or either unassigned side permits both colours to explore without live clock progression. Source inspection: either missing player produces a non-live state, with no live path; clocks are initialised without starting. Classification: aligned with BR-GAME-02-FREE-ANALYSIS-START and SCN-FREE-ANALYSIS-01. No exploratory recording requirement is introduced; Q-ANALYSIS-002 remains settled.

## JRN-FRESH-08

Expected: two configured analysis engines each show three current-position lines after a free-analysis move; no live turn starts. Source inspection: creation assigns copied seats and analysis refresh follows rendered-position changes. Classification: aligned for initial multi-engine exploration. This proves current-position output, not historical actual-move recording. The existing Q-ANALYSIS-001/Q-ENGINE-001 prompts remain outside this creation case; no new policy question is needed here.

## JRN-FRESH-09

Expected: saved name/time defaults apply to new Quick and Custom games; the custom form uses configured player defaults; Quick remains local/local; existing saved game options remain intact. Source inspection: new requests copy defaults and existing games own their own options. Classification: aligned. The Quick-local/Custom-player distinction follows the plan and settings contract rather than assuming the player defaults alter Quick creation.
