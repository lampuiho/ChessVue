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

Implemented JRN-PLAY-01–12 on 15–16 October 2026 with **24 independent browser variants** in [focused Play specs](../e2e/journeys/play/). The [owned metadata](../journeys/definitions/play/cases/) and [scenario review](../journeys/definitions/play/ScenarioReview.md) trace moves, invalid input, checkmate/review, resignation, draw outcomes, takebacks, tab/route navigation, reassignment, free-analysis conversion and engine failure/recovery. Timed examples create games through Custom and install browser clock control before the application loads. The seeded four games retain their original IDs, positions, order and untimed behaviour; their construction now lives in Play's owned data module.

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

## Remaining work

The Fresh and Play tranches complete 22 of the 147 planned groups, with one further group partial. They do not complete Phase 1. The remaining scenario/branch register, feature suites, further application-regression splits, controlled engine/storage faults, rules fixture, composed sessions and usability work remain in the plan. Other fixture descriptions still establish starting data rather than executed branch coverage.

Actual-move recording acceptance remains separate from temporary exploration and current-position multi-engine output. No recording policy was inferred and no exploratory Keep/Record flow was added. The existing design review prompts remain non-blocking for independent work. Native NW.js dialogs/files/processes and production-build worker execution remain unverified.
