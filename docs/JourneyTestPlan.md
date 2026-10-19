# User journey test development plan

Prepared on 15 October 2026 from the current application source, journey fixtures and test configuration. This document defines the planned coverage and tracks verified implementation progress in the completion table below; uncompleted cases remain requirements rather than passing results.

## Outcome and scope

Build a repeatable suite that proves a user can create, play, analyse, save and resume a game, and can recover from invalid input, interrupted engine work and persistence failures. Each journey must specify its starting data, actions, observable results, cancellation paths and reset procedure. Prioritise loss of game data, incorrect results and unintended moves.

The backlog contains 147 named case groups across the ten existing journeys, three proposed fixtures, real platform checks, complete user sessions and usability checks. Parameterised branches expand into individual tests during implementation. Deliver it in the four phases below, beginning with existing fixtures and core data-preservation paths.

Journey code, test specifications and fixture data must be organised into focused modules. Each journey owns its description, case metadata and scenario data; shared builders and runtime adapters have separate responsibilities. The [required module structure](#required-module-structure) below is part of implementation acceptance.

Inspect the current app to establish observed behaviour, then compare it with [high-level scenarios](HighLevel/scenarios.md), the owning contracts and the product intent below. The scenario document is a working design input whose wording, completeness and `Current`/`Planned` labels need review. Neither the code nor the scenario prose automatically settles ambiguous product behaviour. Record implementation availability, scenario drift and test coverage separately; do not change an agreed expected result simply to match the implementation.

Include these surfaces:

- Home, quick/custom creation, multiple games, routes and recent games.
- Board clicks and dragging, captures, special moves, promotion, results and game controls.
- History review, variations, takeback policy, in-game analysis and free board setup.
- Engine inventory, player assignment, analysis seats, suggestions and engine failures.
- Clocks, increments, pause ownership, navigation interruptions and late engine replies.
- Managed saves, autosave, selected snapshots, import/export, identity and startup recovery.
- Appearance, session/gameplay preferences, dirty settings, browser and NW.js boundaries.

Exclude ideas without a current user flow: premoves, bookmarks, evaluation explanations, automatic engine reconnect, variant selection, batch transfers and mobile panel switching. Do not invent tests for a promotion-policy selector, board/piece-theme selector or engine-option discovery screen: their contracts/services do not establish an existing UI. Threefold repetition and the fifty-move rule are outside this baseline; current rule adjudication implements checkmate, stalemate and insufficient material. Treat small-screen checks as usability assessment of existing screens, not a commitment to implement the mobile ideas.

## Completion tracking

Updated 19 October 2026 from the [implementation record and verified runs](JourneyImplementation.md#ordinary-browser-verification). Counts refer to the 147 named case groups, not individual parameterised tests. **Complete** means the group's required assertions, review and owned metadata have passing evidence; **Partial** retains outstanding acceptance work; **Backlog** has no completed group acceptance yet, even where existing fixtures, unit tests or smoke checks cover some behaviour.

| Area / case range | Total | Complete | Partial | Backlog | Evidence or next work |
| --- | ---: | ---: | ---: | ---: | --- |
| Fresh — `JRN-FRESH-01–09` | 9 | 9 | 0 | 0 | [28 browser tests](../e2e/journeys/fresh/), [case metadata](../journeys/definitions/fresh/cases/) and [scenario review](../journeys/definitions/fresh/ScenarioReview.md) |
| Play — `JRN-PLAY-01–12` | 12 | 12 | 0 | 0 | [26 journey variants](../e2e/journeys/play/) and [two real Stockfish variants](../e2e/Browser.spec.ts), [case metadata](../journeys/definitions/play/cases/) and [scenario review](../journeys/definitions/play/ScenarioReview.md) |
| History — `JRN-HIST-01–09` | 9 | 9 | 0 | 0 | [16 browser variants](../e2e/journeys/history/), [nine integration checks](../journeys/__tests__/history/), [owned metadata](../journeys/definitions/history/cases/) and [scenario review](../journeys/definitions/history/ScenarioReview.md) |
| Setup — `JRN-SETUP-01–09` | 9 | 9 | 0 | 0 | [24 browser variants](../e2e/journeys/setup/), [eight integration checks](../journeys/__tests__/setup/), [owned metadata](../journeys/definitions/setup/cases/) and [scenario review](../journeys/definitions/setup/ScenarioReview.md) |
| Promotion — `JRN-PROMO-01–05` | 5 | 5 | 0 | 0 | [36 browser variants](../e2e/journeys/promotion/), [owned metadata](../journeys/definitions/promotion/cases/) and [scenario review](../journeys/definitions/promotion/ScenarioReview.md) |
| Analysis — `JRN-ANALYSIS-01–12` | 12 | 12 | 0 | 0 | [22 browser variants](../e2e/journeys/analysis/), [three integration checks](../journeys/__tests__/analysis/), [owned metadata](../journeys/definitions/analysis/cases/) and [scenario review](../journeys/definitions/analysis/ScenarioReview.md) |
| Clocks — `JRN-CLOCK-01–12` | 12 | 12 | 0 | 0 | [40 browser variants](../e2e/journeys/clocks/), [eleven integration checks](../journeys/__tests__/clocks/), [owned metadata](../journeys/definitions/clocks/cases/) and [scenario review](../journeys/definitions/clocks/ScenarioReview.md) |
| Saves — `JRN-SAVE-01–16` | 16 | 16 | 0 | 0 | [51 browser variants](../e2e/journeys/saves/), [seven migrated application regressions and a storage-control check](../journeys/__tests__/saves/), [owned metadata](../journeys/definitions/saves/cases/) and [scenario review](../journeys/definitions/saves/ScenarioReview.md), including actual-move recorded-analysis round trips |
| Settings — `JRN-SETTINGS-01–11` | 11 | 11 | 0 | 0 | [24 seeded variants](../e2e/journeys/settings/), [one real Stockfish variant](../e2e/Browser.spec.ts), [four integration checks](../journeys/__tests__/settings/), [owned metadata and review](../journeys/definitions/settings/ScenarioReview.md) |
| Recovery — `JRN-RECOVERY-01–08` | 8 | 8 | 0 | 0 | [32 browser variants](../e2e/journeys/recovery/), [eight integration/fixture checks](../journeys/__tests__/recovery/), [owned metadata and scenario review](../journeys/definitions/recovery/ScenarioReview.md) |
| Rules — `JRN-RULE-01–06` | 6 | 6 | 0 | 0 | [50 browser variants](../e2e/journeys/rules/), [41 fixture checks](../journeys/__tests__/rules/), [owned metadata and scenario review](../journeys/definitions/rules/ScenarioReview.md) |
| Engine races — `JRN-RACE-01–08` | 8 | 8 | 0 | 0 | [15 browser variants](../e2e/journeys/engine-races/), [three control/disposal checks](../journeys/__tests__/engine-races/), [owned metadata and scenario review](../journeys/definitions/engine-races/ScenarioReview.md) |
| Storage failures — `JRN-IO-01–08` | 8 | 8 | 0 | 0 | [21 seeded variants](../e2e/journeys/storage-failures/), [one real browser storage rejection](../e2e/browser/Storage.spec.ts), [nine adapter/fixture checks](../journeys/__tests__/storage-failures/), [owned metadata and review](../journeys/definitions/storage-failures/ScenarioReview.md) |
| Ordinary browser — `JRN-BROWSER-01–07` | 7 | 7 | 0 | 0 | [18 ordinary-browser variants](../e2e/browser/), [owned case metadata and scenario review](../journeys/definitions/browser/ScenarioReview.md), real Stockfish/file transfer and lifecycle/storage acceptance |
| NW.js desktop — `JRN-DESKTOP-01–07` | 7 | 0 | 0 | 7 | Native runtime verification remains outstanding |
| Complete sessions — `JRN-SESSION-01–04` | 4 | 0 | 0 | 4 | Compose the four sessions after their dependent cases pass |
| Usability — `JRN-UX-01–04` | 4 | 0 | 0 | 4 | Perform keyboard/focus, layout and workload checks |
| **Total** | **147** | **132** | **0** | **15** | **15 groups still need acceptance work** |

Foundation work has started in Phases 1 and 2: baseline evidence, the description registry, focused builders, browser helpers and distributed metadata/reporting are in place for all thirteen journeys, including Rules, Engine races and Storage failures. The full scenario/branch register and remaining runtime/support migrations are outstanding; no phase is complete yet. The latest [Storage-failure verification](JourneyImplementation.md#storage-failure-verification) records clean acceptance for all eight IO groups and the separate broader run's teardown failures. Earlier tranches retain their dated evidence; filtered reports do not mark unexecuted cases passed. These totals do not imply completion of additional case groups.

Update this table with each accepted work package, using owned case metadata and `npm run journey -- report` for execution evidence. Keep detailed results in the [implementation record](JourneyImplementation.md) and scenario reviews; a passing bootstrap or a filtered run must not mark unexecuted cases complete.

## Product intent and usability baseline

The user identifies chess.com as the benchmark for ease of use. Treat that as a usability direction: familiar board interactions, understandable controls and feedback, and a straightforward path between playing, exploring and returning to the game. This records the user's reference; it makes no claim about chess.com's current features or a requirement to copy its complete interface.

The main additional capabilities the user wants in ChessVue are:

| Product goal | Journey emphasis | Review prompts during implementation/testing |
| --- | --- | --- |
| Record analysis for actual game moves | Attach recorded analysis only to moves actually played in a game; revisit it after continued play, save/load and export/import | Recorded content and capture timing: [Q-ANALYSIS-001](questions/analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md) |
| Analyse interactively during a game | Explore both sides and variations without an accidental live move; maintain a clear route back to the live position | Live clock/opponent progression and engine-line click semantics: [Q-PLAY-001](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md), [Q-ANALYSIS-003](questions/analysis/Q-ANALYSIS-003-SuggestionInteraction.md) |
| View multiple engine analyses | Identify each engine, compare its current results, inspect continuations and isolate seat failures | What comparison output is recorded for actual game moves: [Q-ENGINE-001](questions/engine/Q-ENGINE-001-ComparisonAndPersistence.md) |

These capabilities are confirmed direction; the questions concern their detailed behaviour. The list is not exhaustive. Record additional usability or design gaps discovered while writing journeys, including gaps absent from the scenario document. Do not silently promote every possible improvement into implementation scope, and do not dismiss the recording goal merely because bookmarks or other related mechanisms were previously labelled ideas.

The linked speculative topics are review prompts, not an upfront questionnaire or prerequisites. Start implementing/testing journeys against the established intent and contracts. Ask and record concrete design questions when that work exposes a real uncertainty; include the affected case, reproduction or source finding and proposed direction. Useful early questions are allowed, but no prompt must be answered merely to begin.

The user settled the recording/pruning boundary on 15 October 2026: recording analysis applies only to actual moves in games, not exploratory moves. [Q-ANALYSIS-002](questions/analysis/Q-ANALYSIS-002-VariationRetention.md) is resolved. Interactive exploration remains temporary and the existing latest-node pruning policy is accepted. Do not introduce a Keep/Record requirement for exploratory branches or infer that every saved workspace branch is a recorded-analysis entry. Preserve the existing separate rules for historical rewrites and unrelated variations.

Prioritise the complete play actual moves → record their analysis → explore → return to live → continue → review the actual-move records → reopen session alongside the core safety cases. A passing launch, a rendered analysis panel or an engine score alone does not establish this experience. Use [Q-UX-001](questions/usability/Q-UX-001-UsabilityReference.md) to clarify concrete benchmark flows; do not make up reference-site behaviour or introduce arbitrary usability thresholds.

## Scenario drift review while writing journeys

Perform this review for each journey and relevant branch before writing its expectations, while the implementation reveals new evidence, and before marking the journey complete.

1. Read the complete owning `SCN-*` flow and its `BR-*` branches, plus the relevant state, persistence, engine and settings contracts. Compare the user-facing outcome with the product goals above; scenario membership alone is not a review.
2. Inspect and exercise the corresponding UI and implementation. Record the reviewed source/document revision, precise trigger, observed behaviour and expected outcome separately. Source inspection must be labelled as such until a run confirms it.
3. Classify the comparison using the table below. A case may have more than one finding; link the finding to the affected case/branch rather than declaring the whole journey in drift.
4. Record material unanswered design questions as focused files in [docs/questions](questions/README.md), using its template. Link scenario/contract/code evidence, affected journey IDs, alternatives, risks and a proposed direction explicitly labelled as provisional. Check for an existing question before creating another.
5. Write regression assertions for settled behaviour. Existing behaviour may be characterised for diagnosis, but must not be reported as acceptance of a conflicting or undecided product policy. Keep only the dependent new assertion pending when a decision is needed; continue independent journey work and preserve existing regression coverage.
6. When a decision is recorded, update the question, owning high-level scenarios/contracts, relevant low-level design, fixture data and test expectations together. Keep stable IDs or document their replacements. Do not quietly rewrite the scenario to justify a test or weaken a test to match a defect.

| Classification | Treatment |
| --- | --- |
| Aligned | Implement the journey and link the reviewed scenario/branch and verification evidence |
| Documentation drift | Record the precise stale/incomplete statement and evidence; correct straightforward wording/status drift and retain traceability |
| Implementation defect | Where intent is settled, record the defect and assert the intended behaviour; code behaviour alone does not redefine the requirement |
| Product gap | Record an agreed capability missing from the current UI/design; distinguish missing coverage from missing implementation |
| Open design question | Create/update a question when the scenario is ambiguous, internally inconsistent or conflicts with the clarified intent; identify exactly which acceptance assertion depends on it |

Latest explicit user instructions establish product intent; already agreed contracts provide constraints unless those instructions change them. Treat unclear scenario prose and current code as evidence to examine, not automatic authority. Routine documentation corrections and independent tests should continue without waiting for every open question to be answered.

Add a compact `scenarioReview` entry to the journey's owned case metadata: reviewed scenario/branch references, source/document revision, intent references, classification, question/decision references and review outcome. Keep detailed reasoning in the focused question file. Aggregate unresolved questions in coverage reports, showing which cases are characterised, accepted or awaiting a decision; a green test must not hide unresolved design drift.

## Current coverage and gaps

| Existing asset | What it establishes | Gap to address |
| --- | --- | --- |
| [Thirteen journey definitions](../journeys/definitions/) and [catalogue](../journeys/Catalogue.json) | Repeatable starting data with references to all 48 non-idea scenarios | A scenario reference and manual instruction do not prove its actions or branches pass |
| [Journey Playwright suite](../e2e/journeys/) | Thirteen bootstrap checks and focused feature suites; both browser projects discover 407 tests, with completion tracked above | Remaining feature interactions, cancellations and negative paths need their own assertions |
| [Ordinary browser suite](../e2e/Browser.spec.ts) | Eight tests covering save/reload, real upload/download, theme persistence, concurrent Stockfish, timed/untimed replies, profile-removal isolation and both smothered-mate continuations | Broader persistence, worker failure and navigation coverage |
| [Application regressions](../journeys/__tests__/UiFollowUp.spec.ts) and [Play suites](../journeys/__tests__/play/) | Mounted-app and store regressions for UI-01 through UI-17, including pause, history, identity and route reuse | Many paths call stores directly and do not establish a complete browser journey |
| Domain, store, component and platform tests under `src/**/__tests__` | Detailed rules, serialisation, runtime and adapter behaviour | Retain this coverage and add representative UI journeys instead of duplicating every unit permutation |

The initial source inspection was followed by the [recorded baseline and implementation checks](JourneyImplementation.md). Use those dated runs and the generated case report as execution evidence; catalogue membership and historical counts alone do not establish acceptance of an uncompleted group.

## Test lanes and priorities

| Lane | Purpose | Data and dependencies |
| --- | --- | --- |
| Seeded browser journeys | Main functional regression suite and repeatable manual exploration | Journey sessionStorage, canonical fixtures, scripted UCI and virtual picker choices |
| Ordinary browser | Prove actual persistence, uploads, downloads and bundled engine integration | App localStorage, browser file chooser/download events, real Stockfish worker/WASM |
| Controlled application/platform integration | Precise clock boundaries, protocol ordering, faults and cleanup | Existing Vitest harness plus explicit storage/transport fault controls |
| Real NW.js integration | Prove native behaviour that browser fixtures cannot exercise | Real desktop runtime, a dedicated test save folder and a real UCI executable |
| Manual usability | Keyboard access, focus, readable layouts and long-running exploration | Representative desktop/window sizes, themes and display scales |

`P0` covers core completion, data preservation, results and dangerous races. `P1` covers remaining supported options and recovery branches. `P2` covers deeper combinations, long-running stress and presentation. Run P0 on every relevant change, the full deterministic suite in continuous integration, and real browser/desktop integration before a release. Run narrow clock and protocol permutations in the integration lane when browser timing would obscure their purpose.

## Common journey contract

Every case below becomes an independent test or a named parameterised test. Reset before each destructive branch; do not make a later case depend on an earlier case succeeding.

1. Identify the case ID, priority, `SCN-*`/`BR-*` references, lane and fixture/game ID; complete the scenario drift review and link any dependent design question.
2. State the exact precondition, including route, player types, time control, pause state, takeback policy and engine assignments when relevant.
3. Perform normal UI actions. Journey hooks may select virtual files, reset fixtures and inspect saved files; they must not make moves or change game state to bypass the interaction being tested.
4. Assert the visible result and the relevant invariant. For a move, inspect board, turn and history together. For a save, await the file and reload/load it. For cancellation, compare before/after state and files.
5. Capture failures with test ID, fixture, platform, action, expected/actual result, trace and relevant saved JSON. Do not attach unrelated user data.
6. Reset or close the isolated context. Distinguish closing a game tab from deleting a save, disposing a game or closing the application.

Seeded journeys currently start with:

```powershell
npm run journey -- list
npm run journey -- history --open
```

In automation, navigate to `/?journey=<name>&reset=1` and wait for `window.chessVueJourney.ready`. Wait separately for the relevant rendered analysis lines or operation result. For a persistence assertion, reload the current URL without `reset=1`; resetting at that point would erase the evidence. Use `window.chessVueJourney.reset()` to repeat a manual case.

Journey files are per-run/per-journey sessionStorage data. A reload in the same tab preserves them; a separate browser context starts clean. Normal browser persistence uses localStorage for its origin, so use a fresh context for isolation and the same context when verifying persistence across a new page. Journeys force the browser platform and virtual engines even if opened inside a desktop host.

## Required module structure

The following is the target structure for implementation. Migrate existing files as the relevant journey is developed; keep launch names, stable case/game IDs, fixture behaviour and the browser journey API compatible. Create a module when it has a responsibility and content, without scaffolding empty folders for every possible case.

```text
journeys/
  Catalogue.json                     # Small name-to-description-path registry only
  Journey.ts                         # Public journey contracts
  index.ts                           # Thin definition registration/composition
  RunJourney.mjs                     # CLI arguments and server launch
  StartJourney.ts                    # Application bootstrap orchestration
  builders/
    GameFixtureBuilder.ts            # Construct one canonical game
    HistoryFixtureBuilder.ts         # Legal move sequences and variations
    ClockFixtureBuilder.ts           # Controlled paused/running snapshots
    SettingsFixtureBuilder.ts        # Settings construction and overrides
    WorkspaceFixtureBuilder.ts       # Compose settings/session/layout/game files
    SaveFixtureBuilder.ts            # Serialise managed/import/export documents
  data/
    EngineProfile.ts                 # Shared profile templates, returned as fresh values
    FixtureTimestamp.ts              # Stable reference timestamps
  runtime/
    JourneyPlatform.ts               # Install the journey-only platform dependencies
    JourneyDialog.ts                 # Virtual import/export choices
    storage/
      JourneyFileSystem.ts
      JourneyStorageFault.ts         # Scoped read/list/write/delete fault controls
    engine/
      ScriptedEngine.ts              # Compose UCI transport behaviour
      JourneyEngineSearch.ts         # Legal PV/reply generation
      JourneyEngineBarrier.ts        # Hold/release work deterministically
      JourneyEngineFault.ts          # Crash, malformed and stale output controls
  definitions/
    fresh/
      index.ts                       # Compose this journey's seed
      Description.json               # Title, scenario references and manual outline
      cases/
        Creation.json                # Case IDs, priority, trace and spec references
        Validation.json
      data/
        EmptyWorkspace.ts
    play/
      index.ts
      Description.json
      cases/
        Move.json
        Result.json
        Tab.json
        PlayerAssignment.json
      data/
        OpeningGame.ts
        MateGame.ts
        FinishedGame.ts
    saves/
      index.ts
      Description.json
      cases/
        ManagedSave.json
        ImportExport.json
        Deletion.json
      data/
        LibraryGame.ts
        LibrarySnapshot.ts
        ImportGame.ts
        invalid/
          Corrupt.json
          UnsupportedVersion.json
    # Other journeys follow the same ownership rules.
  __tests__/
    builders/                        # Shared builder invariants
    fixtures/                        # Per-journey legality/serialisation/isolation
    runtime/                         # Dialog/storage/engine lifecycle checks
    application/                     # Feature-scoped mounted-app regressions
e2e/
  journeys/
    Bootstrap.spec.ts                # Small catalogue-driven boot sweep only
    fresh/
      Creation.spec.ts
      Validation.spec.ts
    play/
      Move.spec.ts
      Result.spec.ts
      Tab.spec.ts
      PlayerAssignment.spec.ts
    saves/
      ManagedSave.spec.ts
      Load.spec.ts
      ImportExport.spec.ts
      Deletion.spec.ts
    clocks/
      Tick.spec.ts
      Pause.spec.ts
      Timeout.spec.ts
    # History, setup, promotion, analysis, settings, recovery and new fixtures follow.
  browser/
    Persistence.spec.ts
    FileTransfer.spec.ts
    Stockfish.spec.ts
  sessions/
    FirstGame.spec.ts
    Study.spec.ts
    InterruptedGame.spec.ts
    Library.spec.ts
  support/
    JourneyBootstrap.ts               # Open/reset/readiness only
    BoardInteraction.ts              # Square selection and move gestures
    GameNavigation.ts                # Tab/route actions
    SaveInspection.ts                # Read/compare persisted documents
    TestEvidence.ts                  # Failure attachments
```

### Journey and test boundaries

- Each definition entry point composes feature data with builders and returns an `IJourneySeed`. Keep game positions, long move lists, invalid documents and case descriptions in their owned data/metadata modules.
- Split specs by behaviour inside a journey folder as needed. `play/Move.spec.ts` owns move interaction; `play/Result.spec.ts` owns result flows. A feature-wide file must not accumulate every test merely because it shares a seed. Put each composed user session in its own spec.
- Keep bootstrap, CLI and registration focused on orchestration. They must not contain per-journey switch statements with game construction, assertions or fault behaviour. Keep storage, picker and engine fault implementations separate from the bootstrap.
- Give shared helpers one purpose. Extract the existing `FixtureFactory.ts` responsibilities into the named builders before extending fixture construction; avoid replacing it with another catch-all factory or `JourneyHelper.ts`. A temporary re-export facade may preserve imports during migration and should be removed after consumers move.
- Split `UiFollowUp.spec.ts` into the relevant application feature suites as touched cases migrate. Preserve the UI-01–UI-17 identifiers and assertions; keep only a small shared mounted-app harness for setup/teardown. Ordinary browser tests receive the same feature split.
- Follow the repository's preference for functions under 35 lines. Treat approximately 200 hand-authored lines in any journey/spec/helper/data module, or multiple independent behaviour families, as a required structure review and split by responsibility. Do not compress large arrays or whole tests onto single lines to bypass that review.

### Fixture data and metadata boundaries

- Own unique positions, moves, snapshots and invalid payloads under `definitions/<name>/data/`. Promote only genuinely reused templates into `journeys/data/`; definitions must not import another journey's private data.
- Shared builders know how to construct games, clocks, settings and documents; they do not select a particular journey's games. Build valid canonical JSON from typed data and the existing serialiser. Keep deliberate corrupt/external byte fixtures as individual raw files whose names describe the failure.
- Keep large move sequences and branch trees in named position/game modules. A workspace composes those modules and a few explicit overrides; it must not become a repository of embedded documents. Data construction must be deterministic, and each invocation must return fresh mutable objects so tests cannot alter another seed through a shared template.
- Store coverage metadata in `definitions/<name>/cases/<behaviour>.json`, with the existing stable case IDs, test references and `scenarioReview` links. Keep complete session, ordinary-browser and desktop metadata in separate files under `journeys/coverage/sessions/`, `journeys/coverage/browser/` and `journeys/coverage/desktop/`. Keep usability metadata under `journeys/coverage/usability/`. Keep design questions in their owned `docs/questions/<area>/` files. Do not introduce a single hand-maintained `Coverage.json` containing every case or embed the full plan into the launch catalogue.
- Make `Catalogue.json` a small explicit registry of journey names and description paths. Compose its descriptions into the existing public `journeyCatalogue`/browser API shape through a loader shared by the CLI and app. Update the current CLI and catalogue consumers together: they currently expect inline descriptions. A generated aggregate may support compatibility/reporting during migration, but it must not become a second hand-edited source of truth.
- Validate distributed case metadata and build the coverage report by aggregation. Store execution evidence as per-run output artefacts referenced by case ID, with platform-specific run results; do not repeatedly rewrite all source metadata after a test run.
- Prefer small parameter tables for genuine variants such as colour/promotion choice. Keep different scenarios in separate named data modules instead of one JSON blob with many flags controlling unrelated behaviour.

### Structure acceptance checks

Review module ownership alongside each work package. Automated discovery checks should verify that registry entries resolve, description/case IDs are unique, every referenced data/spec path exists, no journey is omitted by Playwright matching, and every migrated case remains accounted for. Validate fresh seed ownership and reset isolation through builder/fixture tests. Use lightweight file-size reporting to flag structure reviews; functional checks still verify the behaviour.

The structural migration is complete when launchers and registries contain composition only, specs and fixture data are owned by journey/behaviour, shared code has focused modules, and there is no central hand-authored store of all game data or case metadata. A generated report may aggregate results for readers without changing that source structure.

## Journeys to write

The table rows describe actions and expected outcomes to review while writing the tests. Apply the drift workflow above before treating an outcome as settled acceptance; linked open questions explicitly qualify provisional policies. Where a row lists alternatives, write separate reset cases or parameterised examples. Values such as game IDs and import paths below already exist unless explicitly marked as proposed. The 147 groups are the initial backlog, and can be refined as gaps or decisions emerge without losing their traceability.

### 1. First launch and creation — `fresh`

Starting state: no files, games or recent entries; Home route. Reuse `fresh` for creation rather than adding another empty fixture.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-FRESH-01 | P0 | Open fresh Home; enter Load and Settings, then return | No game is created implicitly; empty states render; return works without an active game |
| JRN-FRESH-02 | P0 | Choose Quick game; click e2 then e4 | One workspace opens with two local players; e4 appears in board/history and Black becomes active |
| JRN-FRESH-03 | P1 | Open Custom; change name/options; Cancel; repeat and dismiss using supported dialog dismissal | No workspace, tab or managed save is added by cancellation |
| JRN-FRESH-04 | P0 | Create a named local/local custom game with 5 minutes + 2 seconds and takebacks disabled | Name, players, clock and policy match the request; only one game is created even after repeated submit attempts |
| JRN-FRESH-05 | P0 | Try blank/whitespace name; empty, zero, negative and over-600 minutes; empty, negative, fractional and over-300 increment | Invalid submissions stay open with validation and create no game; minutes 1/600 and increments 0/300 are accepted in separate valid examples |
| JRN-FRESH-06 | P0 | Create a timed game with Journey A as a player; separately select Journey unavailable | Working engine makes one legal reply; unavailable required engine leaves creation open with feedback and no partially opened game |
| JRN-FRESH-07 | P1 | Choose Free analysis; separately create with White, then Black unassigned | Analysis controls appear; live clocks and turn requests do not start; exploration works without an engine |
| JRN-FRESH-08 | P1 | Create free analysis with configured analysis engines; make a move | Evaluation starts and refreshes for the new position; no live player turn is armed |
| JRN-FRESH-09 | P1 | Change default game name/time and custom player defaults in Settings; create quick and custom games | New forms/actions use their supported defaults; quick creation remains local/local as implemented; existing games retain their options |

Trace: `SCN-SESSION-01`, `SCN-GAME-01`, `SCN-GAME-02`, `SCN-MOVE-02`.

### 2. Playing, results, tabs and player assignments — `play`

Starting state: `play-opening`, `play-mate`, `play-drawn` and `play-resigned`. The opening has e4/d5/exd5/Qxd5; the mate fixture is one move from d8-h4 checkmate.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-PLAY-01 | P0 | In `play-opening`, play g1-f3; inspect board, history, captures and active player | One ply is committed; both captured pawns remain represented; selection/last-move display updates immediately |
| JRN-PLAY-02 | P0 | Select a source twice; select another own piece; click an illegal target; try the wrong colour; repeat a valid move by dragging | Invalid attempts add no history or clock increment; selection clears/replaces correctly; valid drag commits exactly one move |
| JRN-PLAY-03 | P0 | In `play-mate`, play d8-h4; attempt another live action; review history and save/reload | Black win and mate notation/check state persist; clocks/player work stop; later analysis preserves the recorded result |
| JRN-PLAY-04 | P0 | Resign from an ongoing game: Cancel, then confirm on a reset | Cancellation preserves the game; confirmation records the correct winner and blocks repeat result actions; review remains usable |
| JRN-PLAY-05 | P0 | Offer draw: Cancel; offer/decline; offer/accept, resetting between outcomes | No offer after Cancel; declined game continues; accepted game records one agreed draw and stops live timing |
| JRN-PLAY-06 | P1 | Use an engine opponent; offer/withdraw a draw and inspect pending indication | The non-local no-response path remains ongoing; available resolution/withdrawal controls reflect the offer; no fabricated engine acceptance |
| JRN-PLAY-07 | P0 | Take back a played move; repeat at the root and with takebacks disabled | Allowed takeback updates board/history/clock consistently; root and policy-blocked actions cannot mutate the game |
| JRN-PLAY-08 | P0 | Switch among four tabs; close active/inactive tabs; reduce to one; close the last | Each game retains its board; active route falls back correctly; a single tab strip hides; last close reaches Home without deleting managed saves |
| JRN-PLAY-09 | P0 | Visit `/game/missing-game` with games present, then in an empty fixture; use Back/Forward | Redirect to the first eligible open game or Home; no stale board remains under an invalid URL |
| JRN-PLAY-10 | P0 | Change a local seat to Journey A, make the local move, then change it back | Exactly one reply belongs to the assigned turn; live position, history, time control and other game tabs remain intact |
| JRN-PLAY-11 | P0 | Change a seat to Unassigned while reviewing a branch | Workspace becomes free analysis from the visible context; history remains; live timing/result/offer state no longer drives play |
| JRN-PLAY-12 | P1 | Open player selection and Cancel or keep the existing engine; separately assign unavailable engine for a due turn | Cancel/keep preserve the seat; failed reassignment reports unavailable without losing history and allows recovery by reassignment |

Trace: `SCN-GAME-03`, `SCN-MOVE-01`, `SCN-MOVE-02`, `SCN-NAV-02`, `SCN-CTRL-01`, `SCN-CTRL-02`, `SCN-CTRL-03`, `SCN-ENGINE-03`.

### 3. History and in-game analysis — `history`

Starting state: `history-allowed` and `history-blocked` contain six live plies, an alternative after e4, and nested alternatives after e4/e5.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-HIST-01 | P0 | Expand alternatives; select root, mainline, sibling and nested nodes; return live | Board, selected row, last move and capture display follow the rendered node; live continuation remains intact during review |
| JRN-HIST-02 | P0 | In allowed game select e4/e5; play f1-c4; Cancel rewrite confirmation | Live path and old continuation remain unchanged; no partial replacement or extra move is committed |
| JRN-HIST-03 | P0 | Repeat and confirm continuation | Selected continuation becomes live/mainline; old continuation remains accessible as a variation; board/history update immediately |
| JRN-HIST-04 | P0 | Repeat in blocked game under Return to live position, then Stay on analysis branch | Move is an analysis branch only; live path/result/clock remain unchanged; rendered selection follows the chosen preference |
| JRN-HIST-05 | P0 | Enter Analyse at the latest live node; explore both colours and a suggested continuation; Exit analysis | Exploration changes rendered history only; exit returns to the live node; a timed variant resumes only when its pause ownership permits |
| JRN-HIST-06 | P0 | After latest-node analysis, exit and make a real live move; repeat when analysis started at an earlier node, then save/reload | Prune temporary latest-node exploratory descendants under the documented rule; preserve unrelated/historical variations and recorded analysis for actual game moves. [Q-ANALYSIS-002](questions/analysis/Q-ANALYSIS-002-VariationRetention.md) settles this policy; no exploratory recording assertion is required |
| JRN-HIST-07 | P0 | Compare analysis-only pause with manual/menu pause layered over analysis | Analysis-only permits exploration; manual/menu pause blocks board/history/suggestion mutation until its own resume; removing one pause does not remove another |
| JRN-HIST-08 | P1 | Inspect in-game analysis and finished-game controls; attempt board editing through any exposed entry | Free-board editing is unavailable inside the live-game analysis context; blocked action leaves position/history unchanged |
| JRN-HIST-09 | P1 | Save/reload nested branches; separately navigate a stale detached node in integration tests | Branches, mainline and selected path survive the round trip; stale node is rejected without corrupting the tree |

Trace: `SCN-HIST-01`, `SCN-HIST-02`, `SCN-HIST-03`, `SCN-HIST-04`, `SCN-CTRL-04`, `SCN-CTRL-05`.

JRN-HIST-05/07 must distinguish explicit paused analysis from history review and check [Q-PLAY-001](questions/play/Q-PLAY-001-LiveProgressDuringAnalysis.md). Returning to the live game must preserve the settled clock/turn policy. Recording acceptance checks actual game moves and must show that exploration/pruning does not erase or replace those moves' recorded analysis; it must not require exploratory continuations to become records.

### 4. Free analysis and board setup — `setup`

Starting state: `setup-analysis` has d4/d5/c4 history; `setup-board` starts in board edit with two kings and a white pawn on d5.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-SETUP-01 | P0 | Explore moves in `setup-analysis` without adding engines | Both colours can move and branch; no live clocks/opponent request is introduced |
| JRN-SETUP-02 | P0 | Enter and exit board edit without changing a square; repeat with an actual edit | Merely entering preserves history; first effective edit promotes the visible position to a new root and clears old history |
| JRN-SETUP-03 | P1 | Choose each palette kind/colour; add, toggle/remove, replace, right-click delete and drag a piece | Each edit changes the intended square(s); later edits keep a single edited root and do not restore discarded history |
| JRN-SETUP-04 | P0 | Clear, then Reset the board; Finish editing | Clear produces an empty editable board; Reset restores the standard initial board; no stale castling/en-passant/engine position survives reset |
| JRN-SETUP-05 | P0 | While editing, try history/player controls and analysis refresh/start | Gameplay/navigation controls are blocked; analysis cannot start on a board being edited |
| JRN-SETUP-06 | P1 | Add an analysis assignment while editing; finish editing | Assignment is retained without starting during edit, then starts once for the completed position |
| JRN-SETUP-07 | P0 | Finish a playable setup; choose Start game; Cancel, then create with custom players, 9 minutes + 2 seconds and policy toggles | Cancel preserves setup; confirm preserves the prepared position and applies players/time/policies as one transition |
| JRN-SETUP-08 | P0 | Try Start game with unavailable required engine, then correct the choice | Failed start preserves setup/history and keeps the flow recoverable; successful retry starts only one game/turn |
| JRN-SETUP-09 | P1 | Save/reload a free analysis branch and an edited workspace; continue editing/exploration | Setup mode, root and remaining history restore consistently; no live session appears unexpectedly |

Trace: `SCN-FREE-ANALYSIS-01`, `SCN-FREE-ANALYSIS-02`, `SCN-FREE-ANALYSIS-03`, `SCN-CTRL-05`.

Do not silently impose full legal-position validation on the editor. Test its implemented editing semantics; record a separate product decision if starting arbitrary invalid positions needs stricter validation.

### 5. Promotion — `promotion`

Starting state: `promotion-white` has a7-a8/a7-b8; `promotion-black` has h2-h1/h2-g1. Reset before every promotion.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-PROMO-01 | P0 | Attempt a quiet promotion for each colour; Cancel chooser | Pawn stays on source square; board/history/captures/turn are unchanged; another move can be selected |
| JRN-PROMO-02 | P0 | Promote quietly to queen, rook, bishop and knight for both colours | Correct piece/colour appears and one move records the selected promotion; resulting check/result is consistent |
| JRN-PROMO-03 | P0 | Repeat all choices with capture promotion | Target rook is removed; capture display and promotion notation agree; underpromotion is not replaced by a queen |
| JRN-PROMO-04 | P1 | Repeat representative quiet/capture cases by dragging and with black orientation | Same board coordinates and choices apply regardless of gesture or orientation |
| JRN-PROMO-05 | P0 | Save/reload a promoted game; take back where allowed | Promotion survives persistence; takeback restores pawn and captured piece correctly |

Trace: `SCN-MOVE-03`, `SCN-MOVE-01`, `SCN-MOVE-02`. The board currently uses an inline promotion popover; scope selectors to the rendered chooser instead of assuming the general modal is used.

### 6. Analysis and suggestions — `analysis`

Starting state: `analysis-free`, `analysis-score-only` and `analysis-live-moves`; each has Journey A/B seats with three principal variations (PVs) per engine.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-ANALYSIS-01 | P0 | Open free analysis; wait for output; make a move | Two engines show their own three PVs and current position; old-position results do not replace the new search |
| JRN-ANALYSIS-02 | P1 | Fold one engine, then the panel; reopen after refresh/new output | Other engine remains visible/running; latest results reappear; folding is presentation only |
| JRN-ANALYSIS-03 | P0 | Compare score-only and move-enabled live games | Score-only still shows evaluation but no playable PV targets; move-enabled renders suggestions |
| JRN-ANALYSIS-04 | P0 | Select a later PV move in free/in-game analysis | Only the selected prefix plays, one move at a time; branch/live policy is respected; no moves after the selected prefix |
| JRN-ANALYSIS-05 | P0 | Select a later PV move in normal live play | Only the first move is submitted as the current live turn, not the whole continuation |
| JRN-ANALYSIS-06 | P0 | Select a stale PV after changing position; repeat while switching game during playback | Stale prefix is rejected before partial application; playback cannot continue into another game |
| JRN-ANALYSIS-07 | P0 | Stop one engine; Refresh; remove one seat | Other seats remain usable; stop/refresh update status; removed seat stops contributing output |
| JRN-ANALYSIS-08 | P1 | Add an already assigned profile; add distinct profiles up to four; attempt a fifth | Duplicate/fifth selection is blocked; current assignments remain unchanged; four seats can operate independently |
| JRN-ANALYSIS-09 | P0 | Add Journey unavailable alongside a working seat; Retry; remove the failing seat | Error is scoped to that seat; working output continues; retry failure remains recoverable; removal restores a usable panel |
| JRN-ANALYSIS-10 | P0 | Pause a timed live game after searches start; try PV clicks and analysis management | Existing search output may finish; PV clicks cannot move the game; stop/retry/refresh/add/remove remain available outside board edit |
| JRN-ANALYSIS-11 | P1 | Reload with Resume after restore on, then off | Assigned seats persist; searches restart only when enabled and eligible; board edit never starts them |
| JRN-ANALYSIS-12 | P1 | Select a history node without evaluation; navigate rapidly while engines update | Empty/queued feedback reflects selected node; delayed old output cannot overwrite another node's results |

Trace: `SCN-ANALYSIS-01`, `SCN-ANALYSIS-02`, `SCN-ANALYSIS-03`, `SCN-ANALYSIS-04`, `SCN-ANALYSIS-05`.

Review JRN-ANALYSIS-03/04/05 against [Q-ANALYSIS-003](questions/analysis/Q-ANALYSIS-003-SuggestionInteraction.md): current score-only and live-move-click policies do not by themselves prove the intended interactive analysis experience. Review recorded multi-engine output for actual game moves under [Q-ENGINE-001](questions/engine/Q-ENGINE-001-ComparisonAndPersistence.md); current-seat persistence does not establish historical actual-move records, and exploratory output is not eligible for recording.

Current fixtures have only three profiles, including one unavailable. Add distinct working profiles using Settings for the four-seat case, or seed them in the proposed engine fixture. Scripted transport currently recognises only `journey://a` and `journey://b`; multiple distinct profiles can use those valid paths. Real crashes, progressive/asynchronous depths and malformed UCI require the additional controls described below.

### 7. Clocks and interruption ownership — `clocks`

Starting state: `clocks-increment` is paused at 120 seconds + 2 seconds; `clocks-timeout-a` and `clocks-timeout-b` are paused at three seconds. Install a controlled clock before app bootstrap for exact boundary assertions.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-CLOCK-01 | P0 | Resume increment game; advance one second; play g1-f3 | White has 121 seconds immediately after the move, Black becomes running, and no second increment is awarded |
| JRN-CLOCK-02 | P0 | Pause, advance time, Resume; attempt gameplay while paused | Paused remaining time is stable; board/history/takeback/resign/draw mutations are blocked; resume starts the eligible colour only |
| JRN-CLOCK-03 | P0 | Open Settings, Save, Load and Custom from a running timed game, each in its own reset case; return/cancel | Menu pause freezes the clock; paired return removes only menu ownership and resumes when no other pause remains |
| JRN-CLOCK-04 | P0 | Repeat with manual pause already active, and with analysis-only pause active | Returning from the menu does not remove manual/analysis ownership or resume live work prematurely |
| JRN-CLOCK-05 | P1 | Turn Auto-pause on menu off; repeat navigation; separately use an untimed game | Disabled policy permits elapsed time; untimed game does not enter a timed pause/resume flow |
| JRN-CLOCK-06 | P0 | Resume timeout A; advance to just before, at and beyond expiry | Time clamps to zero; correct result and one timeout dialog appear; late move/resume cannot revive the finished live turn |
| JRN-CLOCK-07 | P0 | Dismiss A; switch to B and expire it without reloading/remounting | B also shows its own result; previous dialog state does not suppress another game's timeout |
| JRN-CLOCK-08 | P0 | After timeout, take back where permitted and expire the reopened game again | Reopened live game can receive a new timeout result/dialog; no stale one-time flag blocks it |
| JRN-CLOCK-09 | P1 | Background/hide and restore a running game; repeat after expiry | Time derives from timestamps, not missed UI ticks; focus return reconciles once; no extra increment or negative display |
| JRN-CLOCK-10 | P1 | Save/reload running and paused timed examples | Restored clock policy follows saved timestamps/state; paused examples do not lose hidden elapsed time; active examples reconcile elapsed time |
| JRN-CLOCK-11 | P1 | Switch to another game tab while the first clock runs | Existing tab-switch behaviour is preserved; do not expect menu auto-pause merely because another game tab becomes active |
| JRN-CLOCK-12 | P1 | Integration permutations: zero increment, repeated pause/resume and delayed timer reconciliation | No duplicate increments, duplicate timeout finalisation or loss of pause ownership |

Trace: `SCN-TIME-01`, `SCN-TIME-02`, `SCN-TIME-03`, `SCN-TIME-04`, `SCN-TIME-05`, `SCN-NAV-01`. Engine-finish-during-pause permutations belong to JRN-RACE below.

### 8. Saves, imports, exports and recent games — `saves`

Starting state: `save-library` has autosave plus Opening/Middlegame named snapshots; `save-other` has another group; valid, duplicate-ID, corrupt and unsupported-version import files exist. The named Middlegame file is newer than autosave, allowing latest-file selection to be distinguished from autosave-first display order.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-SAVE-01 | P0 | Open grouped Load; single-click/select a group; inspect its snapshots | Selection alone does not load; autosave displays first, separated from named saves; details follow the selected snapshot |
| JRN-SAVE-02 | P0 | Load Opening explicitly; separately double-click the group to load latest | Explicit load opens two-ply Opening; latest opens newer Middlegame; display ordering does not choose the wrong file |
| JRN-SAVE-03 | P0 | Save current game with a new name; reload and load that named file | Canonical document contains correct board/tree/players/result/clock; one named file appears and remains readable |
| JRN-SAVE-04 | P0 | Enter an existing name; Cancel overwrite, then confirm on a separate reset | Cancel preserves previous bytes; confirm replaces only that snapshot and refreshes its details |
| JRN-SAVE-05 | P0 | Try blank/whitespace, `auto`/`AUTO`, `.`, `..`, slash/backslash and invalid filename characters | Save is blocked before a write; no path escapes, reserved autosave overwrite or ghost entry |
| JRN-SAVE-06 | P0 | Set autosave interval to 3; play two, three and six plies; repeat with interval 0 | Writes occur at configured counts, update one `auto.json`, and do not overwrite named files; zero disables move-count autosave |
| JRN-SAVE-07 | P0 | Export to `exports/round-trip.json`; inspect; import that path | Export is version 1 with no runtime `$` fields; imported semantic state matches and has a fresh identity |
| JRN-SAVE-08 | P0 | Import `imports/valid.json`; repeat with `imports/duplicate-id.json` while original is open | Every external import receives a fresh ID, even without a collision; original workspace/files remain unchanged |
| JRN-SAVE-09 | P0 | Import corrupt and unsupported-version files; add an incomplete canonical document example | Error appears before insertion; tabs, active game and existing files remain intact; valid import still succeeds afterwards |
| JRN-SAVE-10 | P1 | Choose `chooseImport(null)` and `chooseExport(null)` before their respective UI actions | No new workspace or export file; cancellation never claims a successful write; existing state remains usable |
| JRN-SAVE-11 | P0 | Cancel deletion; delete a selected named save, then the last save of a group | Cancel preserves bytes; confirmed deletion removes only the target; selected entry/route falls back without stale details |
| JRN-SAVE-12 | P1 | Delete the final library entry; switch load/save contexts and return | Empty library is usable; no dangling selected-save route; an open in-memory game is not treated as deleted persistence |
| JRN-SAVE-13 | P0 | Return Home; reopen an unopened recent game and an already open game; repeat with an unopened target that disappears or becomes corrupt | Unopened target loads latest data; already open target preserves its in-memory workspace, including unsaved changes; missing target refreshes recent entries and stays Home; invalid load reports error without partial insertion |
| JRN-SAVE-14 | P0 | Load an already open identity; use a managed file whose internal ID differs from its enumerated folder; save again | Workspace collision is repaired; managed-load identity comes from its save group; next write cannot target an unrelated group |
| JRN-SAVE-15 | P1 | Save free analysis, board edit, nested history, promotion, timed and finished examples | Each restores its meaningful state; active runtime objects/caches are reconstructed rather than persisted |
| JRN-SAVE-16 | P1 | Open Save without a valid active game; open empty Load and attempt selection | Save cannot target a missing workspace; no-selection Load remains on a usable library route |

Trace: `SCN-SAVE-01`, `SCN-SAVE-02`, `SCN-SAVE-03`, `SCN-LOAD-01`, `SCN-NAV-03`, `SCN-EXPORT-01`, `SCN-IMPORT-01`, `SCN-IMPORT-02`, `SCN-LIFECYCLE-01`, `SCN-LIFECYCLE-02`.

For JRN-SAVE-07/15, compare the agreed recorded-analysis content for actual game moves from [Q-ANALYSIS-001](questions/analysis/Q-ANALYSIS-001-RecordedAnalysisScope.md), including subsequent live moves, exploratory pruning and reopening. Actual-move analysis records must survive the round trip; exploratory moves must not create those records. Workspace restoration may still include existing branches under its separate contract.

The existing public journey API reads files but cannot inject storage faults, delete arbitrary fixtures or hold a write. Add controlled test seams for disappearing entries and folder/document identity mismatch, or retain their exact permutations in integration tests. Do not pretend `chooseImport()` injects a write failure. Autosave-on-close means an application lifecycle checkpoint, not closing a game tab.

### 9. Settings and engine inventory — `settings`

Starting state: dark theme, Black orientation, three engine profiles, autosave interval 3, and `settings-game` as the return workspace. Settings starts on Engines.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-SETTINGS-01 | P0 | Change theme/orientation/coordinates/highlight and Apply; return, then reload | Applied appearance updates without restart and persists; board input still uses the correct chess squares |
| JRN-SETTINGS-02 | P1 | Use System theme; change emulated OS theme; repeat with explicit light/dark | System follows the host; explicit modes remain stable; subscriptions do not multiply after navigation |
| JRN-SETTINGS-03 | P1 | Set UI scale to visible minimum/maximum, 75% and 150%; inspect board/dialogs/library | Controls remain reachable/readable at the supported slider bounds; do not assume the schema's 200% bound is exposed by the UI |
| JRN-SETTINGS-04 | P0 | Edit settings; leave via Return, Cancel, game/tab navigation where exposed, and browser Back | Dirty guard offers Keep editing/Discard; keep preserves draft and route; discard navigates and restores persisted settings; Apply/Save is the explicit save path |
| JRN-SETTINGS-05 | P0 | Make a draft change; Apply; make another; discard | Applied change remains; only subsequent unapplied edits are discarded; Save persists and leaves while Apply stays |
| JRN-SETTINGS-06 | P1 | Reset settings: Cancel, then confirm and reload | Cancel preserves preferences/profiles; confirmed reset follows default persistence semantics and updates the running UI |
| JRN-SETTINGS-07 | P0 | Add named engine with options; Save profile; Apply settings; reopen Custom/player/analysis assignment | Profile becomes available consistently for future assignments and survives reload; profile save alone is still a staged settings change |
| JRN-SETTINGS-08 | P1 | Try empty/duplicate engine names; Copy repeatedly; edit/cancel a profile | Duplicate/empty names cannot be committed; copied profiles receive distinct identities/names; editor cancellation preserves the original |
| JRN-SETTINGS-09 | P0 | Edit/rename/remove a profile already seated in a game; Apply; keep that game's existing player | Existing copied assignment/options continue unchanged; future choices use the new inventory; Keep existing does not silently replace it |
| JRN-SETTINGS-10 | P1 | Add boolean, numeric, text and empty option values; remove an option; save/reload and initialise engine | Saved values retain the UI's supported type conversion and reach UCI initialisation; discovered option defaults do not rewrite configured values |
| JRN-SETTINGS-11 | P1 | Change restore-session, autosave interval/root, autosave-on-close and auto-pause preferences | Settings persist and the corresponding journeys observe the new policy; changing save root uses the new namespace without claiming old files were migrated |

Trace: `SCN-SETTINGS-01`, `SCN-SETTINGS-02`, `SCN-ENGINE-01`, `SCN-ENGINE-02`, `SCN-ENGINE-03`, `SCN-NAV-01`.

### 10. Startup recovery and restore — `recovery` plus persisted variants

Starting state: corrupt settings/layout, one missing game, one version-99 game and `recovery-valid`. Use additional valid session variants so recovery is not tested only with every fault combined.

| Case | Priority | Actions | Required result |
| --- | --- | --- | --- |
| JRN-RECOVERY-01 | P0 | Boot the existing combined recovery fixture | Defaults load where needed; valid game opens at `/game/recovery-valid`; unusable IDs are removed from open session; recoverable warning appears |
| JRN-RECOVERY-02 | P0 | Repeat with settings-only, layout-only, missing-game-only and unsupported-game-only faults | Each fallback is independent; valid preferences/games are preserved; startup finishes without a loading dead end |
| JRN-RECOVERY-03 | P0 | Restore a valid multi-game session and remembered Settings/library/game routes | Open-game order and active selection restore; route settles after required games load; eligible analysis starts according to preference |
| JRN-RECOVERY-04 | P0 | Disable Restore previous session, save the session and reload | Home opens with no restored workspaces; saved documents remain available through Load |
| JRN-RECOVERY-05 | P0 | Restore no valid games, stale active ID, invalid remembered route and partial UI-only state | Route falls back to an available game or Home; no duplicate/phantom tabs or implicit new game |
| JRN-RECOVERY-06 | P1 | Dismiss recovery notice; follow its Saved games and Settings actions in separate resets | Notice can be dismissed; recovery actions reach usable surfaces; no warning blocks normal play |
| JRN-RECOVERY-07 | P0 | Reload after recovery has repaired session state | Session no longer requests the removed IDs; no duplicate insertion; still-corrupt source files are not silently erased |
| JRN-RECOVERY-08 | P1 | Restore with assigned engine unavailable; restore paused/board-edit games | Workspace remains usable with scoped engine feedback; ineligible work does not start; no duplicate player turn is armed |

Trace: `SCN-SESSION-01`, `SCN-SESSION-02`, `SCN-SESSION-03`, `SCN-NAV-02`, `SCN-IMPORT-02`.

## Additional fixtures and controls

Extend existing seeds first. Add these three fixtures only for starting states that the original ten do not conveniently express. `rules` is now a registered launch command; the other two names remain proposals.

### A. Chess rules through the UI — `rules`

The owned [Rules fixture](../journeys/definitions/rules/) supplies compact positions for both castling sides/colours, immediate and expired en passant, check evasion, stalemate and insufficient material. Fixture checks validate roots and all seeded moves through the existing rule/serialisation helpers. Timed draw positions start ongoing and require a UI move to cause adjudication.

| Case | Priority | Actions and required result |
| --- | --- | --- |
| JRN-RULE-01 | P0 | Castle both ways/colours; king and rook land correctly, history notation and saved rights match; undo restores them |
| JRN-RULE-02 | P0 | Try castling in check, through attack, behind an occupied path and after king/rook movement; each illegal attempt preserves state |
| JRN-RULE-03 | P0 | Perform en passant immediately, then try after an intervening move; immediate capture removes the correct pawn, expired opportunity is unavailable |
| JRN-RULE-04 | P0 | Try pinned-piece/self-check moves, king captures onto defended squares and double-check responses; legal targets match king safety |
| JRN-RULE-05 | P0 | Make the final move into stalemate or insufficient material; draw is recorded once, live timing stops and review preserves the result |
| JRN-RULE-06 | P1 | Save/reload before castling/en passant and after each special move; rights, target square, captures and legal continuations survive |

Trace: extend the current `SCN-MOVE-01`/`SCN-MOVE-02` coverage with explicit case IDs; no new product feature is implied.

### B. Pending engine work — `engine-races`

Implemented in the [owned Engine-race journey](../journeys/definitions/engine-races/ScenarioReview.md). The focused `journeys/runtime/engine/` modules retain the default 150 ms depth-12/reply behaviour and add deterministic held searches/stop acknowledgements, raw UCI records, scoped spawn failures, scripted process exits and lifecycle diagnostics. Controls act only at the journey transport seam; they cannot mutate application games or launch real processes. The browser cases below are supplemented by an integration check for disposal while client stop acknowledgement blocks queued startup. Ponder ordering remains in protocol integration tests.

| Case | Priority | Actions and required result |
| --- | --- | --- |
| JRN-RACE-01 | P0 | Hold player reply, pause/open menu, release, then return/resume: no move while paused and exactly one validated move after the turn becomes ready |
| JRN-RACE-02 | P0 | Hold reply, enter analysis, explore/exit and resume as eligible: old work cannot apply to an unrelated rendered position or commit twice |
| JRN-RACE-03 | P0 | Hold reply, reassign the player, then release old output: replaced turn is cancelled and stale output never moves the new seat/game |
| JRN-RACE-04 | P0 | Hold reply across timeout/resignation/draw agreement: ended game's result and live position remain fixed |
| JRN-RACE-05 | P0 | Change analysis position rapidly and release results out of order: only the matching search/node accepts output; other games and seats remain independent |
| JRN-RACE-06 | P1 | Crash one analysis engine, retry successfully, then make retry fail repeatedly: other seats continue and manual recovery stays available |
| JRN-RACE-07 | P1 | Emit malformed/illegal PV followed by valid output and independent depth updates: bad lines do not replace valid output or fail unrelated searches |
| JRN-RACE-08 | P1 | Stop/remove/dispose a runtime with pending work, then emit late output: no dangling listener, orphaned search or late state mutation; ponder hit/miss ordering stays in protocol integration tests |

Trace: `SCN-MOVE-01`, `SCN-ANALYSIS-01` through `SCN-ANALYSIS-05`, `SCN-TIME-02`, `SCN-TIME-04`, `SCN-TIME-05`, `SCN-ENGINE-03`. Map individual `BR-*` references when implementing each permutation.

### C. Persistence failures — proposed `storage-failures`

Add path/operation-scoped fail-next controls and held-operation barriers to the journey storage seam. Cover read, list, write and delete separately. Clear all controls on reset and in test teardown; make the successful retry explicit. Reuse existing platform error kinds. The ordinary browser lane must also exercise a real storage-write rejection through a controlled browser storage boundary.

| Case | Priority | Actions and required result |
| --- | --- | --- |
| JRN-IO-01 | P0 | Fail named save/overwrite, then retry: prior snapshot remains readable, no success notice is shown for failure and retry writes the intended data |
| JRN-IO-02 | P0 | Fail autosave at an interval: play stays usable, named saves remain intact and a later successful checkpoint contains current data |
| JRN-IO-03 | P0 | Fail Settings Apply: persisted preferences remain unchanged, draft is recoverable and error is visible; retry succeeds |
| JRN-IO-04 | P0 | Fail list/read or remove a selected file before Load: clear failure/fallback, no partial workspace and no loading dead end |
| JRN-IO-05 | P1 | Fail deletion or remove target before confirmation: refresh stale selection, preserve other files and leave a valid route; do not claim successful deletion on I/O failure |
| JRN-IO-06 | P0 | Fail export write: no success claim/file; existing managed saves remain unchanged and another export can succeed |
| JRN-IO-07 | P1 | Hold snapshot details read, change selection/route, then release old read: stale details/overwrite target cannot leak into the new selection |
| JRN-IO-08 | P1 | Fail session/layout checkpoint at startup/navigation: current usable workspace survives and later successful persistence is verifiable by reload |

Trace: session/save/load/export/import/settings/lifecycle branches already listed above. If a particular recovery outcome needs a product fix, keep the failure visible as a defect; building the test seam does not authorise silently broadening production behaviour.

## Real platform journeys

### Ordinary browser

The five original browser checks have been strengthened into 18 focused variants under [e2e/browser](../e2e/browser/), with [owned metadata and review](../journeys/definitions/browser/ScenarioReview.md). They use real `File` upload and download events, not journey picker hooks. Never assert a specific best move, centipawn score or exact search depth from real Stockfish. The separate ordinary-browser lane registers these groups without inventing a seeded journey launcher.

| Case | Priority | Actions and required result |
| --- | --- | --- |
| JRN-BROWSER-01 | P0 | Create/play/save/reload, then open a new page in the same context: canonical game and session/appearance persist at the same origin |
| JRN-BROWSER-02 | P0 | Download JSON and upload it through the real chooser: semantic game round trip with fresh import identity; invalid JSON/UTF-8 is rejected without mutation |
| JRN-BROWSER-03 | P0 | Run two real Stockfish workers; stop/restart one, change position and reload: independent workers and matching WASM load; legal current output continues |
| JRN-BROWSER-04 | P0 | Play a timed game against Stockfish: one legal reply and correct turn/history; reload must not duplicate the due turn |
| JRN-BROWSER-05 | P1 | Use invalid/native/cross-origin engine locations or unavailable worker/WASM assets: actionable failure; local play and other workers remain usable |
| JRN-BROWSER-06 | P1 | Trigger page-hide/visibility checkpoints and ordinary explicit save: completed saves survive; actual tab-close autosave remains best effort and is not a guaranteed awaited shutdown |
| JRN-BROWSER-07 | P1 | Change system theme and reject a browser storage write: theme follows policy; failed persistence never appears as a successful durable write |

### NW.js desktop

Use a real host and a dedicated disposable save root. Mock-NW.js unit tests and journey mode are not substitutes. Record runtime, OS and engine version; the current repository does not provide a real NW.js end-to-end launch/project, so first establish and document a repeatable desktop harness or manual procedure.

| Case | Priority | Actions and required result |
| --- | --- | --- |
| JRN-DESKTOP-01 | P0 | Start with native platform auto-detection; create/play/save/restart: actual disk saves/session restore work |
| JRN-DESKTOP-02 | P0 | Import/export with native file pickers including Cancel and overwrite: correct path/JSON and no false success or managed-save mutation |
| JRN-DESKTOP-03 | P0 | Start a native UCI engine as opponent and concurrent analysis seats: independent process ownership and legal replies/output |
| JRN-DESKTOP-04 | P0 | Kill one engine process and recover via supported retry/reassignment: other processes and workspaces remain usable |
| JRN-DESKTOP-05 | P0 | Close application with autosave-on-close on/off; restart: enabled close awaits configured checkpoints; disabled close does not claim unsaved moves were persisted |
| JRN-DESKTOP-06 | P1 | Use unwritable/missing target, file removed during load, spaces/non-ASCII path and external file changes: typed errors/recovery, no accidental overwrite |
| JRN-DESKTOP-07 | P1 | Lose/regain focus and change OS theme; stop/remove engine and exit: clocks/theme reconcile and resources owned by stopped/disposed sessions are released |

## Cross-feature user sessions

After isolated cases pass, write a few short complete sessions. Each session gets its own fresh context; do not combine all coverage into one fragile test.

| Case | Priority | Session and checkpoints |
| --- | --- | --- |
| JRN-SESSION-01 | P0 | First-time player: Home → custom timed game → opening/capture → record analysis for actual moves under the agreed capture policy → explore/return → continue with a real move → named save → reload/load selected snapshot → resume → resign → reopen result. Assert actual-move records, position and clock survive; exploratory pruning creates no recording requirement |
| JRN-SESSION-02 | P0 | Study user: free analysis → nested branch → edit visible position → start a timed game → engine reply → export → import. Assert history reset occurs only on actual board edit and imported identity is fresh |
| JRN-SESSION-03 | P0 | Interrupted player: hold engine turn → Settings → apply appearance → return → single reply → timeout → review → save/reload. Assert no move during pause and no result reversal |
| JRN-SESSION-04 | P1 | Library user: two games with saves → latest versus selected load → duplicate import → delete chosen snapshot → recent reopen → failed write → retry. Assert independent identities/files and usable route after each operation |

## Interaction and presentation checks

- `JRN-UX-01` (P1): keyboard-only Home → creation → board selection → Save/Settings; visible focus, meaningful labels, Enter activation and supported dialog dismissal. Report missing accessible names, including promotion choices, as defects rather than relying permanently on glyph indexes.
- `JRN-UX-02` (P1): open nested confirmation/error flows; focus moves into the active dialog and returns sensibly; repeated confirm clicks do not produce duplicate operations. Check dismissal rules separately for non-dismissible draw resolution.
- `JRN-UX-03` (P2): test 1440×900 and 1024×768 desktop windows at 75/100/150% scale, both orientations and light/dark themes. Check controls, long names, nested history and save details for clipping; use smaller windows as exploratory evidence.
- `JRN-UX-04` (P2): long legal history, many saved snapshots, repeated route switches and engine start/stop cycles. Define a reproducible workload and establish a baseline before setting performance thresholds; assert responsiveness and absence of accumulating sessions/listeners.

## Implementation work packages

### Phase 1 — Establish evidence and case tracking

1. Run the existing unit, type-check and browser suites; record environment, counts and any pre-existing failures separately.
2. Introduce the distributed case register defined above: per-journey/per-behaviour metadata plus separate platform/session/usability metadata. Fields: case ID, priority, scenario/branch references, fixture, lane, spec/test reference and implementation availability. Aggregate these files into the coverage report, merging per-run execution evidence; only a recorded run can supply `passed` evidence.
3. Migrate descriptions from inline `Catalogue.json` entries to per-journey `Description.json` files, leaving a small name/path registry. Update the CLI/app loaders and preserve the composed `title`, `scenarios`, `steps` and browser API contracts. Link detailed cases from the journey README rather than duplicating scripts/data into the registry.
4. Mark every documented non-idea branch as covered, an identified test backlog item, or an explicit unsupported/deferred expectation with rationale. Resolve mismatches such as aspirational resource throttling separately from the implemented four-engine rejection rule.
5. Set up `scenarioReview` metadata and the question-recording workflow. Keep speculative topics as non-blocking review prompts; raise actual questions from concrete findings during journey implementation/testing. Do not make answering the planning prompts an exit condition for this phase.

Exit: baseline recorded, modular metadata/loading in place, all 48 scenarios have accountable cases, and the drift/question workflow is ready for use during implementation; no declaration of coverage based solely on catalogue membership or requirement to settle speculative prompts first.

### Phase 2 — Reusable browser helpers and P0 journeys

1. Extract the focused builders and support modules in the required structure before extending their existing responsibilities. Keep bootstrap, board interaction, navigation, saved-document inspection and evidence attachment separate; use UK spelling, `I` interfaces and the repository's compact TypeScript style.
2. Implement tests under `e2e/journeys/<name>/<behaviour>.spec.ts` and data under `journeys/definitions/<name>/data/`. Split result/tab/player cases within Play, and managed-save/load/import/deletion cases within Saves, from the start. Keep a small catalogue-driven bootstrap sweep; migrate overlapping assertions and mounted-app regressions without losing coverage.
3. Update `playwright.config.ts` when introducing these files: the journeys project currently matches only `Journey.spec.ts`. Match the nested journey folder, assign composed session specs to the appropriate server/project, and ensure ordinary-browser specs run only in their own project. Update TypeScript/test include paths as needed. The existing global setup owns both servers; extend it only if a lane actually needs another entry point.
4. Implement P0 cases from the existing ten seeds first. Reuse current UI-01–UI-17 regressions for precise store assertions, and add browser coverage of their user-facing triggers.
5. Add `rules` for the critical special-move cases and implement its P0 coverage before the core behaviour gate is considered complete.
6. Perform the scenario drift review with each journey, not just once in Phase 1. Prioritise recording/interactive analysis/multiple engines, update the question register as evidence emerges, and keep independent assertions progressing while a specific design decision remains open.

Exit: core create/play/history/setup/promotion/results/persistence journeys pass in a browser, with real file/engine smoke coverage retained.

Build the first small smoke set from JRN-FRESH-02, JRN-PLAY-01/03/08, JRN-HIST-03/05, JRN-SETUP-07, JRN-PROMO-02, JRN-CLOCK-03/07, JRN-SAVE-03/08, JRN-SETTINGS-04 and JRN-RECOVERY-01. Broaden to all relevant P0 branches as their fixtures and controls become available; keep real platform checks in their own lanes.

### Phase 3 — Deterministic faults and remaining branches

1. Implement journey-only engine barriers/faults and path-scoped storage faults at the existing injection boundaries, extracting the focused runtime modules from `PrepareJourney.ts`/`ScriptedEngine.ts` as described above. Keep normal development/production entry points unaffected.
2. Register proposed fixtures through the thin registry/composition layer. Keep each fixture's descriptions, case metadata and data modules in its own folder; add feature-scoped checks for legal trees, canonical documents, reset isolation and each fault control's lifecycle.
3. Write JRN-RACE and JRN-IO P0 cases, then remaining P1 cases and isolated recovery variants. Keep protocol-only malformed-line, ponder and exact cleanup permutations in integration tests where they already fit.
4. Extend fixture coverage checks to validate case/branch references and actual executable test references, not just the current scenario-ID set membership assertion. Ensure reset removes faults and held work.

Exit: deliberate failures preserve data and recover, asynchronous work cannot cross turn/game boundaries, and each supported scenario branch has evidence or a tracked gap.

### Phase 4 — Real platforms, composed sessions and usability

1. Strengthen ordinary-browser integration, including production-build worker/WASM loading; current Playwright servers use development mode, so add a separate preview/build procedure rather than counting a successful build as a runtime test.
2. Establish the NW.js procedure and run the native cases with real files/processes. Keep this lane marked unverified until performed on a real host.
3. Implement each of the four composed sessions in a separate spec, then keyboard/layout and longer workloads. Split ordinary-browser persistence, file transfer and Stockfish checks into their focused specs. Add more browser engines or operating systems only where support commitments justify them; Chromium is the current automated baseline.
4. Publish a run report from the coverage register with passed, failed, deferred and unverified cases plus defect/question links and scenario drift outcomes. Assess the complete play/explore/record/continue/reopen experience against the usability baseline. Assign remaining work by feature ownership rather than declaring the entire app covered.

Exit: supported browser and desktop paths have separate evidence; outstanding platform gaps remain explicit.

## Determinism, assertions and diagnostics

- Prefer roles/labels and square names already used by Playwright. Scope repeated buttons to their game, engine seat, snapshot or dialog. Add small stable semantic attributes or accessible labels only when existing UI offers no reliable target; avoid broad CSS/text matches that select the wrong seat.
- Use independent browser contexts with reset fixtures. The suite is configured `fullyParallel`; do not share storage, exports, held replies or fault settings across tests. Do not use module-global mutable game state in browser helpers.
- Install controlled Date/timer behaviour before application imports/bootstrap. Timestamp subclasses make late clock installation unreliable. Advance clocks deliberately and wait on observable results; do not use fixed sleeps to wait for engines or persistence.
- Assert intermediate states for races: before reply release, while paused, after return and after resume. Exact engine command/lifecycle counts belong in the controlled transport lane; browser tests prove the visible move happens once.
- Snapshot semantic game fields for round trips; account for intentionally fresh import IDs and updated timestamps. Persisted documents must exclude runtime `$` metadata. Await writes before reload and compare previous bytes on cancelled overwrite.
- Capture page errors as failures. Expected injected failures should be checked explicitly; do not suppress all console/error output to make a test pass. Retain Playwright traces and attach selected file inventories/JSON and screenshots on failure; screenshots complement behavioural assertions.
- Repeated failures that pass on retry are flaky failures to investigate, not reliable coverage. Keep real-worker assertions bounded by meaningful readiness and generous engine-specific timeouts; deterministic suites should not depend on machine playing strength.

## Execution and completion criteria

Use the repository's portable Node installation when it is not already on PATH. Current commands:

```powershell
$env:Path = 'E:\PortableApps\nodejs;' + $env:Path
npm run test:unit -- --run --maxWorkers=1
npm run type-check
npm run test:e2e -- --project=journeys
npm run test:e2e -- --project=browser
npm run build
```

Install Chromium with `npx playwright install chromium` only if it is missing. A future `--grep` smoke filter needs tags/test names to be implemented first; do not document it as an existing suite capability. Update CI/project matching before relying on split specs. Use one Vitest worker for the mounted application regressions, as documented by the current journey harness.

A journey is complete when its starting state is reproducible, actions exercise the real intended surface, normal and relevant cancellation/error paths have assertions, persistence-sensitive state is proved through a reload/load, asynchronous work is awaited or cancelled, and its owned metadata links it to a recorded result. It must also satisfy the module/data ownership and structure checks above, record its scenario drift review, and explicitly identify any assertion awaiting a design decision. An unresolved dependent assertion prevents that part of acceptance from being called complete; it does not stop unrelated journey work.

The overall implementation is complete when all P0 acceptance cases pass without unexplained retry dependence, all 48 committed scenarios and their supported branches are accounted for, current unit/type/build checks pass, the real-browser suite passes, and native coverage is either evidenced on NW.js or explicitly reported as unverified. The recording/interactive-analysis/multiple-engine experience must be assessed against the clarified product intent, with dependent design questions resolved and documentation reconciled. Deferred ideas, unanswered acceptance decisions and platform gaps must never be counted as passed tests.
