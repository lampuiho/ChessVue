# Journey implementation record

Started 15 October 2026 from commit `2d693f7`, using the existing working-tree [journey plan](JourneyTestPlan.md), scenario/contract edits and resolved exploratory-pruning decision. Those pre-existing design changes were preserved.

## First tranche

JRN-FRESH-01–09 now have 28 independent browser tests covering empty screens, quick creation/reload, custom cancellation, time/name validation boundaries, repeated submission, required engine success/failure, free analysis, two-engine refresh and saved defaults. Engine profiles are configured through the normal Settings UI; Fresh still starts empty.

JRN-SAVE-08 adds two independent import-identity cases, including a duplicate of an open game, with original-file preservation and save/reload. The former seeded export/import check migrates to JRN-SAVE-07 with canonical payload comparison and reload; it remains **partial** because the fixture contains no recorded analysis for actual game moves. Current-position evaluation and saved exploration are not counted as actual-move recording.

The ten-journey catalogue bootstrap sweep is retained. All descriptions now live under their owning definitions, with a small path registry and a loader shared by CLI/browser. Fresh and Saves own focused entry points/data/case metadata/reviews. The shared factory was removed in favour of game/history/clock/settings/workspace/save builders and fresh engine-profile templates. Remaining definitions keep their launch names and game IDs and migrate their data when their cases are developed.

Playwright discovers nested journey specs and preserves the separate ordinary-browser project. Shared support covers bootstrap, board clicks, creation, engine configuration, persistence inspection, explicit saves and failure evidence. Uncaught page errors fail journey tests; failures attach the virtual file inventory/contents, errors, screenshot and retained trace.

Case metadata is distributed under `definitions/<name>/cases/`. Registry tests validate IDs, file/review/spec/scenario/branch references and builder ownership. `npm run journey -- report` joins exact named test variants to the latest Playwright JSON report. Missing variants are unverified; retry-dependent execution is flaky; partial acceptance remains explicit even when its implemented assertions pass. A filtered run replaces the previous evidence rather than inheriting old passes.

## Baseline evidence

Environment: Windows PowerShell, portable Node **24.11.1**, installed Vitest **4.0.15**, repository Playwright/Chromium and Vite dependencies. No dependency installation or real engine executable was required. Vite/Chromium checks needed child-process access outside the workspace sandbox; the initial restricted attempts failed with `spawn EPERM` before tests ran.

| Baseline check | Observed result before implementation |
| --- | --- |
| `npm run type-check` | Passed |
| `npm run test:e2e` | 17 passed: 12 seeded-journey checks and 5 ordinary-browser checks |
| `npm run test:unit -- --run --maxWorkers=1` | 360 passed, 2 failed across 40 files; startup timeout and readiness failure in `UiFollowUp.spec.ts`, with a subsequent `Pinia destroyed` rejection |
| Isolated `UiFollowUp.spec.ts` rerun | 32 passed; baseline instability was reproducible as a different one-second readiness failure in the next full run |

The harness's default one-second readiness deadline could unmount the app while a lazily loaded route/startup save was still pending. Both mounted journey harnesses now await the same observable `api.ready` condition for up to five seconds, within the existing test deadline. Behaviour assertions and engine timing remain unchanged; no retries were added. Run unit and browser suites separately to avoid unnecessary startup contention.

## Verification

Final checks on 15 October 2026:

| Check | Result |
| --- | --- |
| `npm run test:unit -- --run --maxWorkers=1` | **373 passed across 43 files**, no unhandled errors |
| `npm run test:e2e -- --workers=4` | **46 passed**: 41 seeded checks and 5 ordinary-browser checks; no skipped, failed or flaky tests |
| `npm run type-check` | Passed |
| `npm run build` | Passed, including type checks and bundled Stockfish worker/WASM assets |
| `npm run journey -- list` | All ten launch names/descriptions resolve |
| `npm run journey -- report` and discovery audit | All 31 named variants match the 11 registered case groups; all ten bootstraps discovered; no missing/unregistered variants |
| Module/whitespace review | New owned modules remain below 200 lines; `git diff --check` passed |

The final browser report starts at `2026-10-15T21:22:32.490Z`. Its 11 registered groups have passing execution evidence: ten have available implementation, while JRN-SAVE-07 retains partial acceptance for recorded-analysis coverage. Per-run browser evidence is generated under ignored `test-results/JourneyResults.json`; case metadata does not contain hand-edited pass flags. The production build was not counted as a production-server runtime test.

## Play tranche

Implemented JRN-PLAY-01–12 on 15–16 October 2026 with **26 independent browser variants** in [focused Play specs](../e2e/journeys/play/). The [owned metadata](../journeys/definitions/play/cases/) and [scenario review](../journeys/definitions/play/ScenarioReview.md) trace moves, invalid input, checkmate/review, resignation, draw outcomes, takebacks, tab/route navigation, reassignment, free-analysis conversion and engine failure/recovery. Timed examples create games through Custom and install browser clock control before the application loads. The seeded four games retain their original IDs, positions, order and untimed behaviour; their construction now lives in Play's owned data module.

Added two JRN-PLAY-10 smothered-mate continuation variants: Journey A loses as Black after two forced replies and wins as White after three moves. The 5+2 puzzle is imported through the file picker, leaving the four seeded tabs unchanged. Puzzle continuation, player-assignment and navigation verification passed all nine browser tests; six focused puzzle legality, scripted-engine and registry checks passed, as did TypeScript checking. Engine moves are scripted for the exact puzzle positions and do not establish native-engine strength.

Verified the same puzzle with real Stockfish on 17 October 2026 in two additional [browser integration variants](../e2e/Browser.spec.ts). Both pass using the ordinary app, Settings profile `stockfish.js`, the actual file picker and a 1+2 clock. Worker creation, WASM loading, all five plies, final result, stopped clocks, exported player assignment and reload persistence are checked. The losing case exposed pondering from a predicted checkmated position, which Stockfish answered immediately and the client reported as a protocol error. The runtime now checks the predicted position before pondering. All 56 engine-runtime and browser/desktop UCI regressions pass, including the new terminal-ponder check; TypeScript checking also passes. Browser and journey Vite servers use separate caches per port to prevent stale dependency responses during concurrent runs.

The journeys exposed and now guard these implementation gaps:

- Empty ranks could collapse under implicit CSS grid sizing and make legal move targets invisible. The board now keeps eight equal rows and columns.
- Checkmate, resignation and draw agreement changed result/state without stopping the live clock. Each now materialises and stops timing; a terminal move also records the stopped node snapshot.
- Historical exploration after a result opened a live rewrite confirmation. It now creates analysis while preserving the recorded result and live path.
- Unassigning a seat retained terminal result/reason and analysis pause ownership. Conversion now clears live finality/offer/pause state while preserving the visible branch and history.
- The hidden single-tab strip removed the final workspace's only close control. The game menu now provides Close game while preserving managed saves.
- Player-engine failure could leave Starting displayed, and typed platform errors lost their message. Player creation, reassignment and restore now prepare a shallow reactive engine runtime in the state layer, so the panel tracks status/error directly. The runtime preserves typed error messages.
- A delayed failure retry could replace a newly armed local turn after reassignment. It now uses the existing due-turn gate; the recovery journey advances those retry timers before making the local reply.

UI-01/UI-16, UI-03/UI-15 and the four copied-engine UI-04 variants moved into [focused mounted-app Play suites](../journeys/__tests__/play/) using a shared harness. All UI-01–UI-17 identifiers and assertions remain. Registry discovery accounts for all twelve new groups, and Play joins the seed ownership/reset checks. Every new owned spec/helper/data/metadata module remains below 200 lines.

## Play verification

Final checks on **16 October 2026**:

| Check | Result |
| --- | --- |
| `npm run test:unit -- --run --maxWorkers=1 --testTimeout=90000` | **377 passed across 47 files**, no unhandled errors |
| `npm run test:e2e -- --workers=2 --timeout=90000` | **70 passed**: 65 seeded checks and 5 ordinary-browser checks; no skipped, failed or flaky tests |
| `npm run build` | Passed, including application/test type checks and bundled Stockfish assets |
| `npm run journey -- list` | All ten launch names/descriptions resolve |
| `npm run journey -- report` and title audit | All **55 named variants** match **23 registered groups**, with no missing or unregistered variants; all twelve Play groups passed |
| Module/whitespace review | New owned modules remain below 200 lines; `git diff --check` passed |

The unit follow-up adds a PlayerPanel regression covering failure and recovery through direct runtime changes. Its run used a longer outer test timeout because cold application compilation exceeded the default 15-second budget; the first successful bootstrap took about 29 seconds. Assertions and the five-second journey-readiness check remain unchanged. Browser verification used two workers and a 90-second outer limit after the host exceeded the default context-teardown budget; application timers and assertion timeouts remain unchanged.

The browser report starts at `2026-10-16T13:18:42.807Z`. Its 23 groups have passing execution evidence: 22 have complete available implementation, while JRN-SAVE-07 retains its existing partial acceptance. Results remain generated under ignored `test-results/JourneyResults.json`; source metadata carries no hand-edited pass flags. The production build was checked separately from the development-server browser run.

## History tranche

Implemented JRN-HIST-01–09 on 16 October 2026 with **16 independent browser variants** in [focused History specs](../e2e/journeys/history/), **nine integration checks** in [History application regressions](../journeys/__tests__/history/), and [owned case metadata and review](../journeys/definitions/history/ScenarioReview.md). The two original game IDs, six-ply live lines, nested branches and untimed behaviour are preserved in the owned fixture module. Timed variants create games through Custom and install browser time before loading the application.

The tranche covers root/mainline/sibling/nested navigation and capture display, a running clock during ordinary review, rewrite cancellation/confirmation, both blocked-takeback preferences, timed/untimed analysis with both colours and suggested-prefix playback, latest/earlier pruning, recorded actual-move analysis, manual/menu pause layering, board-edit guards, nested restoration and detached-node rejection.

The journeys exposed and now guard these gaps:

- History omitted the starting position. Start position now uses the guarded navigation boundary.
- Live position silently depended on an optional cached live node. It now resolves the persisted path, including after save/reload in review.
- Menus added pause ownership during untimed analysis, but untimed resumption would not remove it. Ownership now clears independently of whether a clock exists.
- Manual pause was unavailable from timed analysis, and board squares did not expose their disabled input state to keyboard/accessibility consumers. Both controls now reflect the documented pause permissions.
- Finished controls hid free-board editing while the state action still accepted it. Workspaces retaining a live path now reject board-edit entry.
- Node membership followed stale parent references without verifying child ownership. Detached nodes are now ignored before path derivation.
- Current-position output had no independent per-actual-move record. Available engine output is now copied at an actual move's commit, attached to that played node and displayed as pre-move Recorded analysis. The optional schema field retains compatibility with existing version-1 saves. Exploratory moves never create records, and later refresh/pruning cannot mutate copies.

The recording baseline captures only available analysis from the rendered live parent; it does not wait for a threshold or copy output from another rendered context. Integration verifies two independent engine snapshots, runtime exclusion, serialisation and the no-output case. Broader post-move capture/replacement choices remain review prompts. JRN-SAVE-07 stays partial because its separate fixture/journey still lacks actual-move recording acceptance.

## History verification

Final checks on **16 October 2026**:

| Check | Result |
| --- | --- |
| `npm run test:unit -- --run --maxWorkers=1` | **387 passed across 51 files**, no unhandled errors |
| `npm run test:e2e -- --workers=4` | **86 passed**: 81 seeded checks and 5 ordinary-browser checks; no skipped, failed or flaky tests |
| `npm run type-check` and `npm run build` | Passed, including the application/test type checks and bundled Stockfish assets |
| `npm run journey -- list` | All ten launch names/descriptions resolve |
| `npm run journey -- report` and title audit | All **71 named variants** match **32 registered groups**; no missing or unregistered variants, all nine History groups passed |
| Module/whitespace review | All 25 owned History code/metadata modules remain below 200 lines; `git diff --check` passed |

The browser report starts at `2026-10-16T16:22:25.451Z`. All 32 groups have passing execution evidence: 31 have complete available implementation, while JRN-SAVE-07 retains partial acceptance. Evidence remains generated under ignored `test-results/JourneyResults.json`; source metadata contains no hand-edited pass flags. The initial restricted browser invocation failed before execution with Vite `spawn EPERM`; approved child-process access enabled verification. The initial focused run exposed the documented runtime defects and one unchanged-default Settings test incorrectly attempting to click disabled Save; the final complete run passes without retries. One recording unit assertion compared JSON object-key order and was corrected to compare parsed values before the final full unit run. Production bundling was checked separately from the development-server runtime tests; no native NW.js or production-server engine execution is claimed.

## Setup tranche

Implemented JRN-SETUP-01–09 on 16 October 2026 with **24 independent browser variants** in [focused Setup specs](../e2e/journeys/setup/) and **eight integration checks** in [Setup application regressions](../journeys/__tests__/setup/). [Owned metadata and scenario review](../journeys/definitions/setup/ScenarioReview.md) link each required branch to its exact executable titles. The seed moved into `definitions/setup/index.ts` and its owned `data/SetupWorkspace.ts`, preserving both original IDs, the d4/d5/c4 history, editable endgame and untimed defaults. Registry discovery and fresh-seed ownership checks now include Setup.

Coverage includes both-colour free exploration and branching; no-op versus effective editing at both the visible continuation and the selected root; all twelve palette kind/colour combinations with add/toggle/replace/delete/drag; clear/reset with fresh engine output; locked history/player/gameplay/analysis controls; analysis assignment deferred until editing ends; failed analysis recovery; custom start cancellation and confirmation from edited and historical positions; required-engine validation/retry; and free-analysis/editor save/reload followed by continued use. Both start variants are included in `@smoke`.

Two implementation defects were reproduced and corrected:

- Finishing an unchanged edit session derived the analysis turn from the original root. It now derives it from the visible position, preserving the black-to-move opening state and history.
- An effective edit made while the existing root was selected retained its children. It now promotes a fresh root-only tree whenever history exists, so old moves cannot reappear against a changed root. Later edits preserve that single new root.

The UI-10/UI-17 setup regression moved intact out of `UiFollowUp.spec.ts`; its separate takeback-policy regression remains there. Focused integration checks reject prohibited direct actions without mutation, verify no engine work during editing, count exactly one analysis start after finishing, and compare all canonical setup fields after failed player validation before a single successful due-turn retry. All new owned modules remain below 200 lines. The reviewed free-analysis scenario labels and first-edit/Finish editing wording were corrected; no new position-validation policy or unresolved acceptance question was introduced.

## Setup verification

Final checks on **16 October 2026**:

| Check | Result |
| --- | --- |
| `npm run test:unit -- --run --maxWorkers=1` | **395 passed across 54 files**, including all eight Setup integration checks; no unhandled errors |
| `npm run test:e2e -- --workers=4 --retries=0` | **105/105 seeded checks passed**, including all 24 Setup variants; two ordinary-browser checks passed and three reached the 30-second outer deadline |
| `npm run test:e2e -- --project=browser --workers=2 --timeout=90000 --retries=0 --output=test-results/browser` | **5/5 ordinary-browser checks passed**, including real Stockfish, persistence and file transfer; no skipped, failed or flaky tests |
| `npm run build` | Passed, including `npm run type-check` for application, unit and end-to-end code, and bundled Stockfish assets |
| `npm run journey -- list` | All ten launch names/descriptions resolve |
| `npm run journey -- report` and title audit | All **95 named variants** match **41 registered groups**; no missing or unregistered variants, all nine Setup groups passed |
| Module/whitespace review | New owned modules remain below 200 lines; `git diff --check` passed |

The full browser report starts at `2026-10-16T17:54:23.910Z` and remains in ignored `test-results/JourneyResults.json`. All 41 registered groups have passing journey execution evidence: 40 have complete available implementation, while JRN-SAVE-07 retains partial acceptance. The three ordinary-browser deadline failures remain visible in that report; it is not described as a wholly passing combined run. The separate ordinary-browser report starts at `2026-10-16T18:01:01.722Z` in `test-results/BrowserResults.json`, selected with `PLAYWRIGHT_JSON_OUTPUT_FILE`. Its separate output directory preserves the completed journey report and diagnostic traces. Both lanes pass without retries; existing assertion and engine-readiness timeouts were unchanged. The ordinary-browser rerun used the longer outer budget and reduced worker count already documented for this host.

The unit run completed before the user's PC shutdown. The browser run then in progress was interrupted without a completed report, so browser verification resumed after restart. Initial focused runs reproduced the two board-edit defects and corrected test-only targeting, radio/toggle interaction and typed-error expectations. Final evidence above uses the corrected source, complete seeded execution and the separately passing ordinary-browser lane. No native NW.js or production-server engine execution is claimed.

## Promotion tranche

Implemented JRN-PROMO-01–05 on 16 October 2026 with **36 independent browser variants** in [focused Promotion specs](../e2e/journeys/promotion/), [owned case metadata](../journeys/definitions/promotion/cases/) and [scenario review](../journeys/definitions/promotion/ScenarioReview.md). The seed moved into `definitions/promotion/index.ts` and `data/PromotionWorkspace.ts`, retaining both original IDs, positions, local players, takeback permission and untimed defaults. Small owned parameter tables describe colours, choices and gestures; registry and seed-ownership checks include Promotion.

Four cancellation variants cover both colours and quiet/capture attempts, comparing all 64 square labels, canonical game, history, captures, turn and stored files before making a different legal move. Eight quiet and eight capture variants select every promotion piece and verify the board, SAN, exact single live move and saved result/check fields. Queen/rook capture promotions give check; bishop/knight capture promotions draw by insufficient material. Twelve gesture variants cover click/drag with black orientation and drag with white orientation, changing orientation through the real Settings UI. Four persistence variants restore quiet rook/capture knight underpromotions, including drawn results, take back to the original canonical workspace, preserve the promoted named snapshot and play a different promotion.

The inline chooser's glyph-only buttons lacked accessible names. It now exposes a named Pawn promotion group and colour/kind choice names, used by every journey without glyph indexes. The broader keyboard/focus journey remains separately planned. The stale promotion Planned label and shared-modal/palette process description now describe the exercised inline flow. No new promotion preference, rule policy or unresolved acceptance question was introduced. All eight quiet-choice variants join `@smoke`; new owned modules remain below 200 lines.

## Promotion verification

Final checks on **16 October 2026**:

| Check | Result |
| --- | --- |
| Focused `e2e/journeys/promotion` run, two workers, `--timeout=90000 --retries=0` | **36/36 passed**, covering all five Promotion groups |
| `npm run test:unit -- --run --maxWorkers=1` | **396 passed across 54 files**, no unhandled errors |
| `npm run test:e2e -- --project=journeys --workers=4 --timeout=90000 --retries=0` | **141/141 passed**: 131 named variants and ten bootstraps; no skipped, failed or flaky tests |
| `npm run test:e2e -- --project=browser --workers=2 --timeout=90000 --retries=0 --output=test-results/browser` | **5/5 passed**, including real Stockfish, persistence and file transfer; no skipped, failed or flaky tests |
| `npm run type-check` and `npm run build` | Passed, including application/unit/end-to-end type checks and bundled Stockfish worker/WASM assets |
| `npm run journey -- list` | All ten launch names/descriptions resolve |
| `npm run journey -- report` and title audit | All **131 named variants** match **46 registered groups**; no missing or unregistered variants, all five Promotion groups passed |
| Module/whitespace review | All 16 owned Promotion modules remain below 200 lines, with no trailing whitespace; `git diff --check` passed |

The completed seeded report starts at `2026-10-16T21:15:07.914Z` in ignored `test-results/JourneyResults.json`. All 46 groups have passing execution evidence: 45 have complete available implementation, while JRN-SAVE-07 retains its existing partial acceptance. The focused run was not used to claim execution of other groups. Source metadata contains no hand-edited pass flags. Restricted Vite startup failed with `spawn EPERM` before execution; approved child-process access enabled the unit/browser runs. The longer outer browser budget follows the existing host procedure; assertions and engine-readiness deadlines were unchanged. Production bundling was checked separately from development-server runtime tests.

The ordinary-browser report starts at `2026-10-16T21:22:34.923Z` in `test-results/BrowserResults.json`, selected with `PLAYWRIGHT_JSON_OUTPUT_FILE`. Its separate output directory preserves the complete seeded report. Both reports have zero errors; both lanes passed without retries. No native NW.js or production-server engine execution is claimed.

## Analysis tranche

Implemented JRN-ANALYSIS-01–12 on 16–17 October 2026 with **22 independent browser variants** in [focused Analysis specs](../e2e/journeys/analysis/) and **three mounted-application checks** in [Analysis integration](../journeys/__tests__/analysis/). [Owned case metadata](../journeys/definitions/analysis/cases/) names every variant and links the [scenario review](../journeys/definitions/analysis/ScenarioReview.md). The fixture moved into `definitions/analysis/index.ts` and `data/AnalysisWorkspace.ts`, preserving its three IDs, opening, player types, permissions and copied A/B assignments. Registry discovery and fresh-seed ownership checks include Analysis.

Coverage includes two current three-PV streams; pending search supersession; independent depth updates and rejected obsolete callbacks; seat/panel folds while results continue; score-only versus move-enabled live/history/analysis contexts; exact one/three-move prefixes in free, untimed in-game and timed in-game analysis; first-move-only live submission; complete stale-prefix rejection; cancellation on game switch; Stop/Refresh/removal; duplicate/four/fifth assignment rules; isolated start/retry failure; paused management with immutable live history/clocks; restore resume policy and board-edit suppression; and empty/queued history feedback during rapid navigation. Controlled integration delivers a stale prefix whose first move remains legal, verifying rejection before any partial commit. Browser timers control the UCI batch and playback intervals without adding a production fault seam or mutating games through journey hooks.

The review reconciles stale Current/Planned labels, the committed four-seat rejection limit, first-move live submission, explicit Refresh after stale suggestions, and low-level FRONTEND-DRIFT-04 notes that still claimed individual PV targets were absent. No new interaction-policy decision was required. Current-seat persistence remains separate from actual-move archives and temporary exploratory branches. These cases do not complete the remaining recording save/import/session work or real crash/protocol/platform lanes.

The browser harness accepts `CHESSVUE_E2E_PORT` so this run can use 4273/4274 alongside an existing server. Engine-inventory helpers now expect the actual return game route when Settings was opened from a game. Coverage references may declare their Playwright project; the default remains `journeys`, and explicit `browser` references are matched only against that project. This preserves the concurrently added real-Stockfish Play evidence without accepting the wrong lane. A focused report regression verifies both allowed and mismatched projects.

### Analysis verification

The complete Chromium run on 17 October 2026 passed **172/172 tests**: 165 seeded checks (155 named variants plus ten bootstrap checks) and seven ordinary-browser checks. It used `CHESSVUE_E2E_PORT=4273`, `PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/AnalysisRegressionResults.json` and `--output=test-results/analysis-regression` to preserve other runs. The report starts at `2026-10-17T03:36:40.214Z`, has zero errors/skips/failures/flaky results and completed without retries. Server cleanup took additional time after the final assertion, then completed normally; no forced shutdown or incomplete report is counted as a pass.

`npm run journey -- report test-results/AnalysisRegressionResults.json` reports all **58 registered groups** passed: 57 have available complete implementation and JRN-SAVE-07 retains its separate partial acceptance. A project/spec/title audit matches all **157 registered variants** (155 seeded and two real-browser Play variants), with no missing, duplicate or unregistered references. Every Analysis group has its full named execution evidence. Source metadata has no manually maintained pass flags.

`npm run build` passed, including production bundling, TypeScript checking and the bundled Stockfish worker/WASM assets. `npm run journey -- list` resolves all ten launch names. The focused coverage-report checks pass with explicit browser-project matching; `npm run test:unit -- --run --maxWorkers=1` passed **403/403 tests across 58 files**, including the three Analysis integration checks and six coverage-report checks, with no unhandled errors. Module/whitespace review keeps every owned Analysis module under 200 lines. The initial restricted Vitest launch failed with `spawn EPERM` before execution; approved local child-process access enabled verification. Initial focused runs exposed test-selector/typed-message mistakes and an empty-output expectation applied before any effective board edit; these were reconciled with the existing contracts rather than changing production behaviour. The stale-prefix snapshot now awaits engine stop so an unrelated accepted engine update cannot change its timestamp mid-comparison. The final runs use the corrected assertions. No native NW.js or production-server engine execution is claimed.

## Clocks tranche

Implemented JRN-CLOCK-01–12 on 17 October 2026 with **40 independent browser variants** in [focused Clock specs](../e2e/journeys/clocks/) and **eleven mounted-application checks** in [Clock integration](../journeys/__tests__/clocks/), including the two original UI-06 regressions migrated intact from `UiFollowUp.spec.ts`. [Owned case metadata](../journeys/definitions/clocks/cases/) names every executable variant and links the [scenario review](../journeys/definitions/clocks/ScenarioReview.md). The fixture moved into `definitions/clocks/index.ts` and `data/ClockWorkspace.ts`, preserving its three IDs, opening, players, takeback permissions and initially paused controls. Registry discovery and fresh-seed ownership checks include Clocks.

Coverage includes exact single increments; both-colour pause and zero-boundary expiry; Settings/Save/Load/Custom return paths; manual, analysis-only and restored pause ownership; disabled menu policy and untimed play; consecutive and reopened timeouts; hidden time without delivered UI ticks; running/paused/expired/analysis-paused save restoration; game-tab timing; and repeated zero/nonzero-increment pause cycles. Five new variants join the smoke set. Time is installed before bootstrap; simulated visibility/focus events exercise timestamp reconciliation without adding a production fault hook.

The journeys reproduced and corrected five defects:

- Restored paused games resumed clocks without arming an eligible player turn. Resume now retains existing work, flushes deferred output and requests a missing turn once.
- Menu return could clear the only reconstructed owner of a saved pause. Hydration now retains Manual for paused live games and Analysis plus Manual for paused analysis. Resume unlocks exploration; Exit analysis restarts live timing. Runtime owners remain outside the version-1 save schema.
- Concurrent timer/focus sync calls could both finalise a timeout. They share one pending settlement, cancelling the old turn before finalisation and ignoring a replaced clock snapshot or an already terminal result. The existing local-move-during-timeout-cancellation regression remains passing.
- Opening a menu at exact expiry could hide an ongoing zero-time turn behind a pause. Pause/resume boundaries now settle expiry before changing ownership.
- A dismissed timeout appeared again after a Save route remount. Notification state now belongs to each game's transient runtime and resets at a new timeout; it never prevents reconciliation of a reopened ongoing turn.

The scenario review corrects stale Planned labels and distinguishes explicit paused analysis from ordinary running history review. It retains the documented progression policy and adds no delay or timeout-material adjudication rules. Engine-finish permutations remain in JRN-RACE; simulated hidden time does not claim native OS suspension verification. All 23 owned modules remain below 200 lines.

### Clocks verification

On 17 October 2026, `npm run test:unit -- --run --maxWorkers=1` passed **413/413 tests across 62 files**, including all eleven Clock integration checks, with no unhandled errors. The generated unit report is `test-results/ClocksUnitResults.json`. The first owned restore check allows a 30-second outer compilation budget after initial cold starts exceeded the shared 15-second deadline; the harness's five-second readiness assertion remains unchanged. The final full run completed without errors.

The complete Chromium run passed **212/212 tests**: 205 seeded checks (195 named variants plus ten bootstraps) and seven ordinary-browser checks, including real Stockfish. It used `CHESSVUE_E2E_PORT=4373`, `PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/ClocksRegressionResults.json` and `--output=test-results/clocks-regression`, with four workers, a 90-second outer budget and no retries. The report starts at `2026-10-17T04:29:48.828Z`, has zero errors/skips/failures/flaky results and completed normally after server cleanup. All 40 Clock variants passed in that run.

`npm run journey -- report test-results/ClocksRegressionResults.json` reports all **70 registered groups** passed: 69 have complete available implementation and JRN-SAVE-07 retains its separate partial acceptance. The project/spec/title audit matches all **197 registered variants** (195 seeded and two real-browser Play variants), with no missing, duplicate or unregistered references. Every Clock group has its full named execution evidence; source metadata contains no manually maintained pass flags. Initial focused runs reproduced the five documented defects; the final complete run uses the corrected source and preserves the existing turn-cancellation order.

`npm run build` passed, including application/unit/end-to-end TypeScript checking, production bundling and bundled Stockfish worker/WASM assets. `npm run journey -- list` resolves all ten launch names. The module/whitespace audit found no oversized owned modules or trailing whitespace; `git diff --check` passed. Restricted Vite startup initially failed with `spawn EPERM`; approved local child-process access enabled verification. No native NW.js or production-server engine execution is claimed.

## Saves tranche

Implemented JRN-SAVE-01–16 on 17–18 October 2026 with **51 independent browser variants** in [focused Saves specs](../e2e/journeys/saves/), [owned metadata](../journeys/definitions/saves/cases/) and a [scenario review](../journeys/definitions/saves/ScenarioReview.md). The existing modular seed retains its two game IDs, original snapshots and timestamp ordering. Owned data adds an incomplete canonical import, a managed snapshot with mismatched internal identity, invalid-name cases and six restorable workspace examples. Unique scenario data stays under Saves; shared builders remain responsible only for construction.

Coverage includes group/snapshot selection without insertion; explicit versus latest loads; named save/reload/load; isolated overwrite cancellation/confirmation; eighteen invalid-name variants; interval-three/zero autosaves; version-1 transfer; fresh external identities; corrupt/version/incomplete rejection and recovery; picker cancellation/retry; selected/final deletion; empty library/context switching; open/unopened/missing/corrupt recent targets; managed identity repair and subsequent save paths; and free/edit/nested/promoted/timed/finished restoration with continued use.

SAVE-07 and a seventh SAVE-15 persistence variant now create actual moves with output from both engines, compare copied seats against the evaluated parent, continue play, explore both colours without recording, prune that temporary continuation and retain earlier actual-move records. They compare complete canonical payloads through managed save/reload and export/import/reload, then read the two-engine records from restored history. This supplies the previously missing SAVE-07 recording acceptance for the established available-output baseline. Broader capture/replacement policy prompts remain unchanged.

Seven mounted-application regressions move intact from `UiFollowUp.spec.ts` into [Saves integration](../journeys/__tests__/saves/), preserving UI-07/UI-08/UI-12 identifiers and assertions. Snapshot selection and the existing settings guard now await asynchronous route completion. Component checks prove invalid names never call the save store, including a control character. Store checks distinguish normal typed cancellation from real picker errors. One additional fault-boundary check verifies exact existing-managed-file restrictions and persistence across fresh readers.

The tranche corrects presentation validation for device names/trailing dots/control characters, selects refreshed details after a named save, refreshes Home recent entries after failed opens, and handles typed picker cancellation without false success or swallowing genuine errors. The test-only `changeFile` control simulates an external edit/removal after a recent card renders, is restricted to existing managed save files, and never alters an in-memory game. Straightforward Current/Planned, route-identity and guarded-empty-state documentation drift is reconciled with the exercised contracts.

### Saves verification

On 18 October 2026, the complete unit suite passed **425/425 tests across 66 files**, with no unhandled errors. The command used `--maxWorkers=1 --pool=threads`; the default forked worker stalled before collection on this host. The generated report is `test-results/SavesUnitResults.json`. The route-selection and settings-guard regressions await completion of asynchronous navigation and retain their original assertions.

`npm run build` passed, including application/unit/end-to-end TypeScript checks, production bundling and the Stockfish worker/WASM assets. `npm run journey -- list` resolves all ten launch names. Discovery and the project/spec/title audit match all **245 registered variants** across **84 groups**, with no missing, duplicate or unregistered references. Discovery itself is not execution evidence.

The broader three-worker Chromium run recorded **260 passing test assertions**: 253 seeded checks (243 named variants plus ten bootstraps) and seven ordinary-browser checks, including real Stockfish. Its report starts at `2026-10-18T09:44:59.822Z` in `test-results/SavesRegressionResults.json`, with no skipped, failed or flaky tests. It also contains **six worker shutdown errors**: three workers failed to exit within Playwright's five-minute stop deadline, with each error reported twice. This is not a clean whole-suite pass; the coverage aggregator correctly leaves groups unverified when a report contains global errors. The report is preserved unchanged.

The final focused Saves run passed **51/51 browser variants**, with zero errors, skips, failures or flaky results and normal worker/server cleanup. It used `--project=journeys e2e/journeys/saves --workers=1 --timeout=180000 --retries=0`, ports 4473/4474 and `--output=test-results/saves-acceptance`. The report starts at `2026-10-18T14:37:42.173Z` in `test-results/SavesAcceptanceResults.json`. `npm run journey -- report test-results/SavesAcceptanceResults.json` marks all **16 Saves groups passed**; the other 68 registered groups remain unverified in this filtered report and retain their earlier dated evidence. Together those accepted tranches complete 84 planned groups; this does not claim a clean current whole-suite run.

The final scenario/branch/data/spec/review audit resolves all 84 registered groups; all owned Saves modules remain below 200 lines, without trailing whitespace. Initial focused runs corrected test selectors, reload readiness and expectations for score-only engine output and finished-result wording. Three cold-start cases exceeded an earlier 90-second outer budget; the final focused run used 180 seconds without changing assertion or engine-readiness deadlines. Restricted child-process startup initially failed with `spawn EPERM`; approved access enabled verification. Generated reports remain under ignored `test-results/`; no source metadata contains hand-maintained pass flags.

## Settings tranche

Implemented JRN-SETTINGS-01–11 on 18 October 2026 with **24 seeded browser variants**, an additional **real Stockfish browser variant**, four focused integration checks, and [owned metadata and scenario review](../journeys/definitions/settings/ScenarioReview.md). The seed moved into `definitions/settings/index.ts` and `data/SettingsWorkspace.ts`, retaining `settings-game`, the e4/e5 opening, dark chrome, Black orientation, three profiles and autosave interval 3. UI-04/UI-14 retain their original assertions in the Settings integration modules.

Coverage includes immediate/persisted appearance and legal board input in both orientations; System and explicit themes across host changes; exact theme-subscription ownership; functional reachability at the visible 75%/150% scale bounds; Return/Cancel/browser Back keep/discard decisions; Apply versus Save; reset cancellation and confirmed defaults; staged profile saves and all future selectors; invalid names, distinct copies and editor cancellation; copied player configuration after rename/removal and Keep existing; option type conversion, removal, empty strings, UCI initialisation and separate discovered defaults; new save roots, move-count intervals, restore/close policy coercion and both menu-pause policies.

Two defects were exposed and corrected. Journey bootstrap installed `{}` as history state, which Vue Router treated as initialised despite its missing position; cancelled browser Back generated NaN offsets and returned to the wrong settings category. Clearing that state to null lets the router initialise valid positions. Untimed games accepted engine assignments but failed on the next engine turn because UCI required both clocks. Player/ponder searches now use the fixed 1000 ms budget in `BuildConfig.engine.untimedMoveTimeMs` for untimed games, while malformed timed clocks still fail explicitly. The ordinary-browser test exercises the bundled Stockfish worker after its reusable profile is removed.

Scenario and low-level documentation now describe the existing two-stage profile/settings commit, actual SettingsStore/EnginesStore ownership and the Keep editing/Discard guard. The settings overview no longer advertises autosave debounce or global takeback/rewrite-confirmation preferences outside the contract. Storage-failure branches, native NW.js behaviour, all-window-size usability and production-build worker execution remain separate work.

### Settings verification

The complete unit suite passed **429/429 tests across 70 files**, with no unhandled errors, using `--maxWorkers=1 --pool=threads`. Evidence is `test-results/SettingsUnitResults.json`. `npm run build` passed all application/unit/end-to-end TypeScript checks and production bundling, including the Stockfish assets. All ten journey launch names resolve. Discovery matches all **270 registered variants across 95 groups**, with no missing, duplicate or unregistered JRN references; the full runner discovers 285 tests including ten bootstraps and five other ordinary-browser checks. Discovery is not execution evidence.

The final focused run passed **25/25 Settings browser variants**, with zero errors, skips, failures or flaky results and normal worker/server cleanup. It ran both projects with `e2e/journeys/settings e2e/Browser.spec.ts --grep JRN-SETTINGS- --workers=2 --timeout=180000 --retries=0`, ports 4573/4574 and `--output=test-results/settings-accepted`. Evidence starts at `2026-10-18T15:20:23.551Z` in `test-results/SettingsAcceptanceResults.json`. The coverage aggregator marks all **11 Settings groups passed**; the other 84 groups remain unverified in this filtered report and retain their earlier dated evidence.

The preceding 42-test run passed all eight ordinary-browser checks (including real Stockfish), all ten journey bootstraps and 22 Settings assertions, with two new test expectation failures. That report is preserved in `test-results/SettingsRegressionResults.json`; it is not a clean whole-suite pass. The corrected Settings tests respect the existing score-only preference, verify the visible depth/score and saved output, and distinguish configured MultiPV 2 at initialisation from the explicit three-PV analysis request. The clean final run includes those corrected assertions. TypeScript checks passed again after the test corrections. No current clean run of the entire 285-test browser suite is claimed.

## Recovery tranche

Implemented JRN-RECOVERY-01–08 on 18 October 2026 with **32 independent browser variants**, [owned case metadata and scenario review](../journeys/definitions/recovery/ScenarioReview.md), and eight focused integration/fixture checks. The original combined seed moved to `definitions/recovery/index.ts` and `data/RecoveryWorkspace.ts`, retaining its IDs, corrupt source bytes and e4 position. Optional named variants use isolated persisted namespaces, survive reload/reset, and leave the ordinary combined launch available. All ten existing journey definitions now have modular entry points, owned data, cases and reviews.

Coverage includes independent settings/layout/missing-game/version faults; two-game ordered targeted restore with an unrelated saved game left closed; five remembered routes crossed with both analysis-resume preferences; disabled session restore followed by normal Load; seven stale/invalid/partial/duplicate session variants; three recovery-notice actions; repeated repaired-session reloads without source erasure; and unavailable player/analysis, paused, editing and live-engine restoration. Normal board play and saved payload assertions accompany recovery feedback. Invalid session documents still fall back as a whole under the existing persistence contract; the canonical schema was not weakened.

UI-13 retains both original regressions in the focused Startup module. Further integration checks observe the actual game-document reads after restart, exact player search counts, analysis subscriptions, pending next-turn promise identity, canonical fixture round trips and namespace/reset isolation. The journey bootstrap accepts an optional variant and stores its selection separately; it does not expose game mutation controls. No application recovery changes were needed. SCN-SESSION-02/03 now describe the existing current behaviour, correct session field names, in-memory settings fallback and retained corrupt files.

### Recovery verification

The full unit run passed **435/435 tests across 74 files**, with no unhandled errors, using direct portable Node, `vitest run --maxWorkers=1 --pool=threads`. Evidence is `test-results/RecoveryUnitResults.json`. The subsequently added namespace test passed separately in `test-results/RecoveryVariantResults.json`; the final focused run passed **8/8 checks across five Recovery files**, including namespace cleanup, in `test-results/RecoveryIntegrationResults.json`. These are separate runs, not a claimed 436-test single run.

`npm run build` passed application/unit/end-to-end TypeScript checking and production bundling, including Stockfish assets. Type checking passed again after the final fixture typing and selector changes. All ten launch names resolve. Discovery and the project/spec/title audit match **302 registered variants across 103 groups**, with no missing, duplicate or unregistered references; the full runner discovers **317 tests** including ten bootstraps and five other ordinary-browser checks. Discovery is not execution evidence.

The final focused browser run passed **32/32 variants**, with zero errors, skips, failures or flaky results and normal worker/server cleanup. It ran `--project=journeys e2e/journeys/recovery --workers=2 --timeout=180000 --retries=0`, ports 4773/4774 and `--output=test-results/recovery-accepted`. Evidence starts at `2026-10-18T19:55:25.376Z` in `test-results/RecoveryAcceptanceResults.json`. `npm run journey -- report test-results/RecoveryAcceptanceResults.json` marks all **eight Recovery groups passed**; the other 95 groups remain unverified in this filtered report and retain their earlier dated evidence.

The exploratory browser run exposed two selector mistakes (warning container versus paragraphs, and the Previous session field label) and was stopped before acceptance. Its artifacts remain under `test-results/recovery-browser/`; only the final clean run establishes browser acceptance. Restricted Vite startup failed with `spawn EPERM`; approved local process access enabled verification. The first npm-driven unit attempt stalled before collection; direct Node execution completed normally. No current whole-browser-suite, native NW.js or production-worker verification is claimed. Owned modules remain below 200 lines; metadata references and whitespace checks pass.

## Rules tranche

Implemented JRN-RULE-01–06 on 18 October 2026 with **50 independent browser variants**, [owned metadata and scenario review](../journeys/definitions/rules/ScenarioReview.md), and 41 focused fixture checks. The new `rules` launch has four default tabs for both colours' castling and immediate en passant. Forty named positions isolate both castling sides, five castling obstacles, king-safety restrictions and four timed draw precursors for each colour. Variants use the existing isolated persisted namespaces and ordinary startup path.

Coverage includes exact castling destinations, king/rook relocation, SAN, reconstructed rights and takeback; forbidden castling while checked, through attack, with an occupied path and after returned king/rook movement; immediate/expired en passant with material, notation, target expiry and restored opportunity; pinned rooks, defended king captures, double-check responses and pinned en passant; move-caused stalemate, bishop-only, knight-only and bare-king draws with exact final increments, stopped clocks, result-preserving review and reload; and save/reload before and after all six colour/special-move combinations with legal continuation and unchanged source snapshots.

Illegal attempts compare all board labels, history, managed save bytes and the complete canonical game, including clock snapshots, paths and captured-piece data. Fixtures validate both kings, the previous side's king safety, ongoing roots, legal seeded histories and canonical round trips. The catalogue, case registry, builder ownership and documentation include Rules. SCN-MOVE-01 now explicitly names stalemate and insufficient material in the existing game-over branch. No application rule or adjudication-policy change was required.

### Rules verification

The focused fixture/registry/ownership run passed **72/72 checks across four files**, including all 41 Rules checks. `npm run build` passed all application/unit/end-to-end TypeScript projects and production bundling, including Stockfish assets. All eleven launch names resolve. Discovery and the project/spec/title audit match **352 registered variants across 109 groups**, with no missing, duplicate or unregistered references. The complete runner discovers 368 tests including eleven bootstraps and five other ordinary-browser checks; discovery is not execution evidence.

The complete unit suite passed **480/480 tests across 76 files**, with no unhandled errors, using direct portable Node and `vitest run --maxWorkers=1 --pool=threads`. Its generated report is `test-results/RulesUnitResults.json`; catalogue-driven mounted startup includes the new default Rules workspace.

After the final filename alignment to `RuleAction` and `RuleWorkspace`, TypeScript checking passed again and **43/43 fixture/reference checks** passed on 19 October 2026. Evidence is `test-results/RulesReferenceResults.json`; every case still resolves its owned data, review and executable spec references.

The focused browser run passed **50/50 variants**, with zero errors, skips, failures or flaky results, no retries and normal worker/server cleanup. It used `e2e/journeys/rules --project=journeys --workers=2 --timeout=180000 --retries=0`, ports 4473/4474 and `--output=test-results/rules-acceptance`. Evidence starts at `2026-10-18T20:07:48.291Z` in `test-results/RulesAcceptanceResults.json`. `npm run journey -- report test-results/RulesAcceptanceResults.json` marks all **six Rules groups passed**; the other 103 groups remain unverified in this filtered report and retain their earlier dated evidence.

Restricted Vite startup initially failed with `spawn EPERM`; approved local child-process access enabled unit/browser/build verification. All 23 owned Rules modules remain below 200 lines. Generated execution evidence stays under ignored `test-results/`; source metadata contains no manual pass flags. This tranche does not claim a current whole-browser-suite, native NW.js or production-server runtime run.

## Engine-race tranche

Implemented JRN-RACE-01 through JRN-RACE-08 on 19 October 2026 with **15 independent browser variants**, [owned metadata and scenario review](../journeys/definitions/engine-races/ScenarioReview.md), and three focused control/disposal checks. The new `engine-races` launch owns a paused 60+2 Black engine turn after e4 and two independent free-analysis games with copied A/B seats. Its `incoming-draw` variant restores an engine offer for the existing acceptance action; no UCI draw negotiation is introduced.

The journey transport now lives in focused `journeys/runtime/engine/` modules. Legal reply/PV generation retains the existing 150 ms default. Deterministic controls hold player/analysis work and stop acknowledgements, release identified searches, inject individual UCI records, crash a scripted process and fail only the next matching starts. Search/process/listener diagnostics support cancellation and cleanup assertions. The controller acts only on the scripted transport and cannot modify canonical games or start native executables. Reset clears transient controls before reloading the original seed.

Coverage includes Manual/Menu/layered pauses with one deferred move and increment, reply completion before/after analysis exit, replacement by Local/B/Unassigned, timeout/resignation/incoming-draw finality, rapid rendered moves with independent out-of-order drains, crash/retry/repeated start failure/manual replacement, malformed and illegal PV rollback, independent depths, Stop/Remove and late output. A second game retains distinct depth-41/score-77 output while foreground searches update. The mounted disposal regression interrupts a client blocked on stop acknowledgement with replacement startup queued, then checks settled work, detached listeners/callback, closed handle, no late mutation and explicit recovery.

The journey emitter now removes once listeners by their original callbacks, fixing wrapper retention during process-start cleanup. No production application timing, turn scheduling, retry or UCI policy change was required. The scenario review records the UCI boundary limitation: an already issued intermediate search must drain its own stop result before the latest queued search can run; old records are released while that client context is stopping. Ponder hit/miss remains covered by the existing browser/desktop protocol suites.

### Engine-race verification

The complete unit suite passed **486/486 tests across 78 files**, with no unhandled errors, using direct portable Node and `vitest run --maxWorkers=1 --pool=threads --testTimeout=90000`. Generated evidence is `test-results/RaceUnitResults.json`; this includes all 33 engine-runtime and 23 browser/desktop UCI checks. The focused fixture/registry/control run also passed **45/45 checks across seven files** in `test-results/RaceFocusedUnitResults.json`.

`npm run build` passed all application/unit/end-to-end TypeScript projects and production bundling, including Stockfish assets. Type checking passed again after the final test/fixture refinements. All twelve launch names resolve. Discovery and the project/spec/title audit match **367 registered variants across 117 groups**, with no missing, duplicate or unregistered references; the runner discovers **384 tests** including twelve bootstraps and five other ordinary-browser checks. Discovery is not execution evidence. Every one of the 25 new owned code/metadata modules is below 200 lines; the largest is 109 lines.

The focused browser acceptance run passed **15/15 variants**, with no errors, skips, failures or retries and normal worker/server cleanup. It used `e2e/journeys/engine-races --project=journeys --workers=2 --timeout=90000 --retries=0`, ports 4173/4174, and starts at `2026-10-19T08:43:52.041Z` in `test-results/RaceAcceptanceResults.json`. Its generated journey report marks all eight race groups passed and the other 109 groups unverified. Final cross-game isolation assertions and the incoming-offer colour refinement are included in the broader regression verification recorded below.

The final broader regression run passed **115/115 browser tests** with zero errors, skips, failures, retries or flaky results and normal worker/server cleanup. It includes all final race assertions, the existing Analysis, Clocks and Play suites, and all twelve catalogue bootstraps. It used `e2e/journeys/engine-races e2e/journeys/analysis e2e/journeys/clocks e2e/journeys/play e2e/journeys/Bootstrap.spec.ts --project=journeys --workers=2 --timeout=90000 --retries=0`, ports 4173/4174, and starts at `2026-10-19T08:45:46.321Z` in `test-results/RaceRegressionResults.json`. The generated report marks all **eight race groups passed**; other groups retain only the evidence actually executed in that report. The clean run took about 14 minutes, including slow browser teardown.

The exploratory browser run corrected control accessible-name selectors and an assumption that no intermediate search had already entered the UCI client. No acceptance expectation was weakened: obsolete output must still remain absent, and only the final rendered position's legal PVs may appear. Restricted Vite startup initially failed with `spawn EPERM`; approved local process access enabled verification. Generated evidence remains under ignored `test-results/`; metadata contains no manual pass flags. No current whole-browser-suite, native NW.js or production-server runtime run is claimed.

## Storage-failure tranche

Implemented JRN-IO-01 through JRN-IO-08 on 19 October 2026 with **21 seeded browser variants**, **one ordinary-browser write-rejection variant**, [owned metadata and scenario review](../journeys/definitions/storage-failures/ScenarioReview.md), and **nine adapter/fixture checks**. The new `storage-failures` launch owns two local untimed games, a four-ply current position, separate Opening/Current/Other snapshots and a three-ply autosave interval. Its `startup-session` variant arms the initial session checkpoint rejection before stores mount and rearms on each bootstrap of that variant.

The journey-only storage controller wraps the normal browser adapter. Fail-next rules match an exact normalised path and operation, reuse existing platform error kinds and consume only the requested failure count. Individual barriers capture an in-flight read before delayed delivery, or defer write/delete commitment until release. Operation records expose IDs, paths and outcomes. Reset clears unused faults and cancels pending work without late mutation; browser tests also clear controls in teardown. The controller does not change application stores, bypass serialisation or replace production file persistence. File inspection bypasses faults so preservation assertions remain independent of the injected failure.

Coverage includes named-save/overwrite preservation and retry, failed interval autosave followed by continued play and a current checkpoint, rejected Settings Apply with accepted/draft separation, root/child list and details/Load read failures, external file disappearance, denied/missing/final-group deletion, export failure/retry, and held details released after selection/group/save-route/unmount changes. Session startup/navigation and both history/analysis layout folds retain usable in-memory work after failure and prove later persistence by reload. Normal close autosave remains enabled and is asserted separately from session/layout storage. The ordinary-browser case rejects an actual `Storage.setItem` with `QuotaExceededError`, exercising BrowserFileSystem error translation without journey hooks.

Three production recovery corrections were needed: App now handles session-checkpoint rejection with a recoverable notice and clears it on successful navigation; SavedGamesView refreshes deletion selection/routes even on failure; overwrite errors are visible inside their confirmation. Superseded details are also invalidated on unmount. Scenario branches now explicitly name pre-acceptance Settings write rejection, Load I/O errors, failed deletion and session checkpoints. The separate existing partial-application Settings branch is not reinterpreted as an atomic write failure or claimed by these tests.

The ordinary-browser storage spec lives under `e2e/browser/`, with Playwright discovery extended to that directory. Snapshot-row selection is a focused shared helper, re-exported from the original Saves helper for compatibility. All 26 new owned code/data/metadata/review modules are below 200 lines; the largest code module is 90 lines. Catalogue discovery resolves all thirteen launches. The project/spec/title audit matches **389 registered variants across 125 groups**, with no missing, duplicate or unregistered references; the complete runner discovers **407 tests**. Discovery is not execution evidence.

### Storage-failure verification

The complete unit suite passed **498/498 tests across 79 files**, including the nine new storage controls/fixture checks, all original UI-01–UI-17 regressions, SavedGamesView and all thirteen mounted journey bootstraps. It ran direct portable Node with `vitest run --maxWorkers=1 --pool=threads --testTimeout=90000`; generated evidence is `test-results/IoUnitResults.json`. No unhandled errors were reported. `npm run build` passed all TypeScript projects and production bundling, including Stockfish assets.

The final focused browser acceptance run passed **22/22 variants**, with zero errors, skips, failures, retries or flaky results and normal worker/server cleanup. It ran both projects with `e2e/journeys/storage-failures e2e/browser/Storage.spec.ts --grep JRN-IO- --workers=1 --timeout=180000 --retries=0`, ports 4573/4574 and `--output=test-results/io-acceptance-final`. Evidence starts at `2026-10-19T13:43:39.860Z` in `test-results/IoAcceptanceResults.json`. Its generated journey report marks all **eight IO groups passed** and the other 117 groups unverified; those retain their earlier dated evidence.

The broader two-worker regression run is preserved separately in `test-results/IoRegressionResults.json`, starting at `2026-10-19T09:26:51.418Z`. It covered all IO variants, thirteen catalogue bootstraps, existing Saves Load/ManagedSave/Deletion and Recovery Notice specs. It reported **59 passed and six unexpected teardown timeouts**, plus **two worker shutdown errors**. Two save-name cases and four IO variants exceeded the 180-second outer budget during context teardown; their recorded errors were teardown failures rather than assertion failures. This is not a clean 65-test pass. The final focused run reduced concurrency to one worker, kept assertion and outer deadlines unchanged and verified all IO variants in about 87 seconds. No production behaviour was changed in response to these host shutdown failures.

Exploratory reports remain under `test-results/IoExploratoryResults.json` and `IoCheckpointExploratoryResults.json`. They exposed test assumptions about the independent close autosave, the need to dismiss a notice covering a Settings action, and an immediate persisted-route read racing a previous successful checkpoint. The final assertions wait for the intended persisted route and preserve the required failure/retry outcomes. Restricted Vite startup initially failed with `spawn EPERM`; approved child-process access enabled verification. Type checking passed again after final spec organisation and synchronisation changes. Source metadata contains no manual pass flags; no current whole-browser-suite, native NW.js or production-server runtime pass is claimed.

The intermediate follow-up replaced the shared details-read counter and manual unmount invalidation with the selected-entry watcher's cleanup. Each pending delivery was invalidated when its watcher reran or stopped. Two new component regressions return to the same snapshot before the original read succeeds or fails, confirming fresh details survive both outcomes. The focused component run passed **22/22 tests** in `test-results/IoCleanupUnitResults.json`; all **four JRN-IO-07 browser variants** passed with one worker and no retries in `test-results/IoCleanupBrowserResults.json`. Type checking passed. These focused checks verify that intermediate correction separately from the earlier full-suite evidence; the explicit selection owner below supersedes its watcher.

## Code cleanup follow-up

Implemented CLEAN-02–06 from the [code cleanup plan](CodeCleanupPlan.md). Owned cancellation replaces playback generation and selected-details watcher delivery. Route commits, game activation, autosave feedback and dialog completion have explicit owners; journey readiness is derived directly. Only the documented App appearance and Chessboard external-prop observers remain, with a build-enforced AST allowlist. Body return annotations are inferred across application, adapters, journey tooling and tests while callable contracts remain typed.

The final unit/application suite passes **527/527 tests across 84 files**, including cancellation settlement, late details/dialog results, exactly-once route checkpoints, board-context drag/promotion reset and audit regressions. Type checking, the code audit and production build pass. The broad browser regression run passes **128/128 tests** across IO, Analysis, engine races, clock Menu ownership, Saves, Settings and cancellation flows; a further **27/27 browser tests** verify the final board fix through promotion gestures, editing, palette dragging and reset. The [cleanup verification record](CodeCleanupPlan.md#verification) owns exact scopes and generated run artifacts. These checks do not claim execution of the whole browser catalogue or native NW.js acceptance.

## Remaining work

The Fresh, Play, History, Setup, Promotion, Analysis, Clocks, Saves, Settings, Recovery, Rules, Engine-race and Storage-failure tranches complete **125 of the 147 planned groups**, leaving 22 in the backlog and none partial. They do not complete Phase 1. The remaining scenario/branch register, feature suites, further application-regression splits, runtime/support migrations, composed sessions and usability work remain in the plan. Scenario membership alone does not establish executed coverage of remaining branches.

Actual-move recording acceptance remains separate from temporary exploration and current-position multi-engine output. History establishes the available-output capture baseline; Saves now verifies its managed-save and export/import restoration, while composed recording sessions remain pending. No exploratory Keep/Record flow was added. Existing design review prompts remain non-blocking for independent work. Native NW.js dialogs/files/processes and production-build worker execution remain unverified.
