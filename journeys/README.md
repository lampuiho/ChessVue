# Testing journeys

See the [user journey test development plan](../docs/JourneyTestPlan.md) for prioritised cases, expected outcomes, additional fixture work and browser/desktop coverage.

The plan requires [modular journey tests and fixture data](../docs/JourneyTestPlan.md#required-module-structure): journey-owned data/case metadata, focused shared builders/runtime helpers, and small specs grouped by behaviour. Follow that target structure when implementing the planned coverage, including migrating the launch catalogue to a small path registry.

For each journey, perform the [scenario drift review](../docs/JourneyTestPlan.md#scenario-drift-review-while-writing-journeys) against high-level scenarios, contracts, implementation and the user's priorities: ease of use, recorded analysis, interactive analysis during play and multiple engines. Record unclear design decisions in [docs/questions](../docs/questions/README.md), linked to the affected cases; continue independent work while those details remain open.

Recording is scoped to actual moves played in games. Exploratory moves remain temporary and the existing pruning policy is settled; see [Q-ANALYSIS-002](../docs/questions/analysis/Q-ANALYSIS-002-VariationRetention.md).

Start the app with repeatable, prefilled data:

```sh
npm run journey -- list
npm run journey -- history --open
npm run journey -- promotion --port 5174
```

The command prints its URL and uses port 5173 by default. Each command run gets a new namespace. Files live in this browser tab's `sessionStorage`, including settings, session/layout documents, managed saves, imports and exports. Reload retains those files and restores through the normal application startup path. In-memory moves survive reload only after the app saves them. Restarting the command starts a fresh run; a new browser context also starts clean. Journey storage and processes are virtual even in a desktop host, so fixtures never overwrite a real save folder or launch an executable.

| Name | Starting data | Useful manual actions |
| --- | --- | --- |
| `fresh` | No files or games | First launch, quick/custom creation, invalid time, illegal moves |
| `play` | Captures, one move to mate, drawn/resigned games; four tabs | Moves/history, results, draw/resign, reassignment, invalid route, one-tab visibility |
| `history` | Six-ply mainline, nested variations, takeback allowed/blocked games | Select/rewrite history, branch permissions, enter/exit in-game analysis |
| `setup` | Free opening analysis and sparse editable endgame | Piece palette, clear/reset, start from setup |
| `promotion` | White a7 and black h2, with capture targets | Quiet/capture promotion, all four pieces, cancel chooser |
| `analysis` | Two engines and three PVs; free, live score-only and live move-enabled games | Expand/collapse, suggestions, seat management, player engine response |
| `clocks` | Paused 2-minute + 2-second game and two paused 3-second games | Resume, increment, menu pause, consecutive timeouts without remounting |
| `saves` | Two save groups, autosaves/named saves, valid/corrupt/version/duplicate imports | Load, overwrite, delete, recent games, import/export, autosave |
| `settings` | Dark theme, black orientation, three engine profiles, return game | Apply/reset, dirty navigation, inventory refresh |
| `recovery` | Corrupt settings/layout, missing and unsupported active saves, one valid game | Startup fallback, repaired session, warning |
| `rules` | Both colours' castling and immediate en passant, plus isolated king-safety and timed draw variants | Special moves, illegal targets, takeback, adjudication and save/reload |
| `engine-races` | Paused Black engine turn after e4 and two independent A/B analysis games | Held replies/stop acknowledgements, cancellation, stale output, crashes, retry and cleanup |
| `storage-failures` | Two local games, Opening/Current/Other snapshots and a three-ply autosave interval | Scoped I/O failures, retry, stale details and session/layout checkpoints |

[Catalogue.json](Catalogue.json) maps launch names to each journey's `Description.json`. The shared loader composes titles, scenario references and ordered manual steps for the CLI and app. Steps are also available in the browser console as `window.chessVueJourney.steps`. Stable game IDs follow the names in [definitions/](definitions/), such as `history-allowed`, `promotion-white` and `clocks-timeout-b`.

## Reset and switch

```js
window.chessVueJourney.reset(); // Clear this journey's files and reload its seed.
```

Any journey server can run another fixture by visiting `/?journey=saves&reset=1`. Without `reset=1`, switching back restores that journey's files from this command run. Navigation/reload retains the selected journey even after the app removes the query string. The app initially starts at Home and restores the fixture's persisted route after its games load.

The Saves suite owns 51 browser variants for grouped browsing, named saves/overwrite/validation, autosave boundaries, transfer/identity/errors/cancellation, deletion, recent targets and restored workspace types. Two variants create actual-move records with both engines, continue play, prune temporary exploration and restore/review the records through managed saves and export/import. Seven mounted-application regressions preserve UI-07/UI-08/UI-12 under `__tests__/saves/`. [Saves scenario review](definitions/saves/ScenarioReview.md) links the contracts and findings.

Recovery adds optional persisted variants without changing its default combined seed. Open `/?journey=recovery&variant=settings&reset=1` to isolate settings corruption; `layout`, `missing-game` and `unsupported-game` isolate the other faults. `restore-game-on/off`, `restore-settings-on/off`, `restore-library-on/off`, `restore-library-selection-on/off` and `restore-save-on/off` cross remembered routes with analysis-resume policy. Further variants cover fallback/session repair and `unavailable-player`, `unavailable-analysis`, `paused`, `board-edit` and `live-engine`; see [RecoveryScenario.ts](definitions/recovery/data/RecoveryScenario.ts). Each variant has its own namespace and survives reload/reset. Opening `?journey=recovery` selects the original combined fixture again.

[Recovery](definitions/recovery/ScenarioReview.md) owns JRN-RECOVERY-01–08 with 32 independent browser variants and eight integration/fixture checks. Coverage includes independent document faults, ordered targeted restore, remembered routes, disabled restore with Load recovery, invalid/partial sessions, recovery actions, repaired reloads, source preservation and engine eligibility/turn ownership. UI-13 retains its original assertions under `__tests__/recovery/`. The clean [Recovery verification record](../docs/JourneyImplementation.md#recovery-verification) covers all eight groups; reproduce its report with `npm run journey -- report test-results/RecoveryAcceptanceResults.json`.

[Engine races](definitions/engine-races/ScenarioReview.md) owns JRN-RACE-01–08 with 15 browser variants and three control/disposal checks. Launch with `npm run journey -- engine-races`. Before resuming the player game, call `chessVueJourney.engines.hold('player')`; use `hold('analysis')` before Refresh to hold analysis. `searches()` returns IDs, kinds, paths and process IDs. `release(id)` releases a pending search; `holdStops(true)` also holds the terminating stop acknowledgement. `emit(id, 'info depth 25 score cp 42 pv ...')` injects a single raw UCI record, including late output after removal; `crash(processId)` exits a scripted process, and `failNext('journey://a', 3)` fails only the next three matching starts. `processes()` exposes lifecycle/listener counts for diagnostics. `reset()` clears controls and reloads the original files. The optional `incoming-draw` variant restores an existing engine offer for the ordinary acceptance path. These controls never launch a native executable or change application game state directly.

Reproduce acceptance with `npm run test:e2e -- e2e/journeys/engine-races --project=journeys --workers=2 --timeout=90000 --retries=0`. See the [verification record](../docs/JourneyImplementation.md#engine-race-verification) and run `npm run journey -- report test-results/RaceRegressionResults.json` for generated execution evidence.

## Automation

[Storage failures](definitions/storage-failures/ScenarioReview.md) owns JRN-IO-01–08 with 21 seeded browser variants, one ordinary-browser write-rejection variant and nine adapter/fixture checks. Launch with `npm run journey -- storage-failures`. The controller wraps the ordinary browser storage adapter and never changes application games directly:

```js
chessVueJourney.storage.failNext('writeTextFile', 'saves/io-game/Opening.json');
chessVueJourney.storage.failNext('listDirectory', 'saves');
chessVueJourney.storage.failNext('deleteFile', 'saves/io-game/Opening.json');
const readId = chessVueJourney.storage.holdNext('readTextFile', 'saves/io-game/Opening.json');
chessVueJourney.storage.release(readId); // Release after the read appears as held in operations().
chessVueJourney.storage.operations(); // Exact paths, IDs and held/succeeded/failed/cancelled outcomes.
chessVueJourney.storage.reset(); // Clear unused faults and cancel pending operations without late writes.
```

Faults match one normalised path and operation. An optional third argument to `failNext` selects the failure count; its optional fourth argument uses an existing platform error kind. Held reads capture their old result before delivery; held writes/deletes commit only after release. Direct file inspection bypasses faults. Controls clear on reload, journey reset and test teardown. `/?journey=storage-failures&variant=startup-session&reset=1` rejects the first session checkpoint before mounting; that named variant rearms on every bootstrap. Normal close autosave remains enabled independently of session/layout writes.

Run both storage-failure lanes and generate their case report:

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/IoAcceptanceResults.json'
npm run test:e2e -- e2e/journeys/storage-failures e2e/browser/Storage.spec.ts --grep JRN-IO- --workers=1 --timeout=180000 --retries=0
npm run journey -- report test-results/IoAcceptanceResults.json
```

The [Storage failure verification record](../docs/JourneyImplementation.md#storage-failure-verification) records execution evidence and limits. The ordinary-browser case rejects a real `Storage.setItem` with `QuotaExceededError`; it uses no journey fault hook.

Rules uses four default tabs and 40 named starting positions. Open `/?journey=rules&variant=castle-white-queen-rook-moved&reset=1` for a returned rook, or replace the variant with `castle-black-king-through-attack`, `pin-white`, `defended-capture-black`, `double-check-white`, `pinned-en-passant-black`, `stalemate-white`, `bishop-material-black`, `knight-material-white` or `bare-kings-black`. Castling obstacles are `in-check`, `through-attack`, `occupied-path`, `king-moved` and `rook-moved`, crossed with each colour and side. Draw variants start paused and ongoing; resume and play the final move described by the [owned scenario data](definitions/rules/data/DrawGame.ts). Variants retain their own namespace across reload. See the [Rules scenario review](definitions/rules/ScenarioReview.md) for acceptance boundaries.

JRN-RULE-01–06 own 50 passing browser variants and 41 fixture checks, covering special moves, illegal king exposure, move-caused draws and restoration. Reproduce the focused run with `npm run test:e2e -- e2e/journeys/rules --project=journeys --workers=2 --timeout=180000 --retries=0`. The [Rules verification record](../docs/JourneyImplementation.md#rules-verification) links the clean report; `npm run journey -- report test-results/RulesAcceptanceResults.json` reports all six Rules groups passed and leaves other groups unverified in that filtered run.

Use the same command as an end-to-end runner's web server; no separate fixture API or real engine installation is required. For example, with Playwright in your test harness:

```ts
// webServer.command: 'npm run journey -- play --port 5174'
await page.goto('http://127.0.0.1:5174/?journey=promotion&reset=1');
await page.waitForFunction(() => window.chessVueJourney?.ready);
await expect(page).toHaveURL(/\/game\/promotion-white$/);
// Continue with normal UI clicks/assertions.
```

`ready` means settings/layout, restored games and the current session route have settled. It does not mean analysis has finished or that the scenario passed. Wait for the expected rendered engine lines when testing analysis. Timed fixtures begin paused so tests control when their deadlines start. The repository includes Playwright as a development dependency. Run `npx playwright install chromium` once and `npm run test:e2e` to start both the ordinary browser app and journey servers and execute the browser suite. Use `npm run test:e2e -- --project=journeys` for just seeded journeys.

Native file dialogs are replaced with repeatable choices. Import defaults to `imports/valid.json`; choose another fixture before clicking Import:

```js
window.chessVueJourney.chooseImport('imports/corrupt.json');
window.chessVueJourney.chooseImport('imports/unsupported-version.json');
window.chessVueJourney.chooseImport('imports/duplicate-id.json');
window.chessVueJourney.chooseImport(null); // Cancel import.
window.chessVueJourney.chooseExport('exports/round-trip.json');
window.chessVueJourney.chooseExport(null); // Cancel export.
window.chessVueJourney.listFiles();
window.chessVueJourney.readFile('exports/round-trip.json');
```

`changeFile(path, raw)` simulates an external change to an existing managed save; use `null` to remove it or invalid JSON to corrupt it after a recent card renders. The isolated runtime restricts this to exact existing `saves/<group>/<name>.json` paths and never edits workspace state.

Choices remain selected until changed or reloaded. Otherwise export uses `exports/<suggested filename>`. Round-trip testing can select that exported path with `chooseImport('exports/round-trip.json')`. In automation, inspect data through `page.evaluate()` after the UI operation finishes. The hook exposes files and dialog choices; game changes still go through the normal UI/stores.

Engine profiles `journey://a` and `journey://b` implement UCI handshake, legal deterministic moves and three short PVs. Analysis reports one depth-12 update and remains running until stopped. `journey://unavailable`, or any other path, fails to start. These fixtures exercise the application's UCI client and process lifecycle; native file pickers, real process crashes, playing strength and sustained engine output still need desktop integration testing.

## Maintenance and checks

Run `npm run check:code` for the shared watcher, async-counter and return-inference rules. The production build includes this audit. Journey readiness is a read-only computed API getter; it does not need an observer. See the [cleanup implementation and verification](../docs/CodeCleanupPlan.md) for retained boundaries and regression evidence.

[Settings](definitions/settings/ScenarioReview.md) owns JRN-SETTINGS-01–11, with 24 seeded variants, one real Stockfish browser variant and four integration checks (including the migrated UI-04/UI-14 assertions). Coverage includes appearance/scale, theme subscription ownership, dirty navigation and reset, staged profiles/copies, copied assignments, typed options/UCI startup and session/save-root policies. Its seed preserves `settings-game` and the original preferences. The clean [Settings verification record](../docs/JourneyImplementation.md#settings-verification) covers all eleven groups. Settings acceptance uses both projects:

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'test-results/SettingsAcceptanceResults.json'
npm run test:e2e -- e2e/journeys/settings e2e/Browser.spec.ts --grep JRN-SETTINGS- --workers=2 --timeout=180000 --retries=0
npm run journey -- report test-results/SettingsAcceptanceResults.json
```

[Clocks](definitions/clocks/ScenarioReview.md) owns JRN-CLOCK-01–12, with 40 browser variants for exact increments/expiry, both-colour pause guards, all four menu paths, independent/restored pause owners, consecutive/reopened timeouts, missed ticks, save/reload and tab switching. Eleven mounted-application checks include the migrated UI-06 regressions. The seed lives in `definitions/clocks/data/ClockWorkspace.ts`, preserving all three IDs and initially paused clocks. Browser time is installed before bootstrap; visibility/focus events and missed intervals are simulated deterministically.

[Analysis](definitions/analysis/ScenarioReview.md) owns JRN-ANALYSIS-01–12, with 22 browser variants for concurrent output, folds, suggestion permissions/playback, scoped failures, seat management, timed pause, restore policy and rapid history navigation. Three mounted-application checks exercise retained stale prefixes, obsolete callbacks and assignment invariants. The seed now lives in `definitions/analysis/data/AnalysisWorkspace.ts` with the original three IDs and permissions.

All thirteen journey definitions live in `definitions/<name>/index.ts`, with owned descriptions, `data/`, `cases/` and `ScenarioReview.md`. Shared builders under `builders/` construct games, legal histories, clocks, settings, saves and workspaces; reusable profile/timestamp data lives under `data/`. Add a description path to `Catalogue.json` and compose the definition in `index.ts`. Keep IDs and timestamps stable; only paused clock anchors use the seed time. Corrupt documents should be explicit overrides, as in `recovery` and `saves`.

Implemented coverage includes JRN-FRESH-01–09, JRN-PLAY-01–12, JRN-HIST-01–09, JRN-SETUP-01–09, JRN-PROMO-01–05, JRN-CLOCK-01–12, JRN-ANALYSIS-01–12, JRN-SAVE-01–16, JRN-SETTINGS-01–11, JRN-RECOVERY-01–08, JRN-RULE-01–06, JRN-RACE-01–08 and JRN-IO-01–08. History owns 16 browser variants for navigation, rewrite decisions, branch preferences, paused exploration, pruning, actual-move records and nested restoration, with nine focused integration checks for recording, pause ownership, edit guards and detached nodes. [Setup](definitions/setup/ScenarioReview.md) owns 24 browser variants for free exploration, first-edit history clearing, all palette kinds/colours, clear/reset, edit guards, delayed analysis assignment, start cancellation/recovery and workspace reloads, plus eight focused integration checks for edit invariants, exact engine starts and the migrated UI-10/UI-17 assertions. [Promotion](definitions/promotion/ScenarioReview.md) owns 36 browser variants covering both colours, all quiet/capture choices, cancellation, drag/orientation and promoted save/reload/takeback, including insufficient-material draws. Feature specs live under `e2e/journeys/`; the catalogue sweep checks bootstrap only. Owned case metadata names every executable variant and links its scenario review. [JourneyImplementation.md](../docs/JourneyImplementation.md) records the baseline, scope and remaining work.

```sh
npm run test:e2e -- --project=journeys
npm run test:e2e -- --project=journeys --grep @smoke
npm run journey -- report
```

If another run owns ports 4173/4174, set `CHESSVUE_E2E_PORT=4373` before launching Playwright; both servers and project URLs then use 4373/4374. Set `PLAYWRIGHT_JSON_OUTPUT_FILE` and `--output` to separate paths when preserving another run's evidence. For the focused Saves acceptance report, run `npm run journey -- report test-results/SavesAcceptanceResults.json`. It covers only Saves; absent variants stay unverified. The broader `SavesRegressionResults.json` preserves 260 passing assertions and six worker shutdown errors, so it is not a clean whole-suite pass; see [Saves verification](../docs/JourneyImplementation.md#saves-verification).

Playwright writes per-run evidence to ignored `test-results/JourneyResults.json`. The report joins those results to distributed case metadata; absent variants remain unverified, and retries remain flaky. `passed` describes the named assertions in that run, while `partial` implementation retains its outstanding acceptance work. Reports do not count catalogue scenario membership as executed coverage, and a filtered run does not carry forward results from an earlier run.

```sh
npm run test:unit -- --run journeys --maxWorkers=1
npm run type-check
```

Fixture checks validate legal move trees, document round trips, scenario references, builder ownership, persistence/reset isolation and the scripted UCI lifecycle. Registry checks validate migrated case/data/spec/review references; coverage checks ensure missing, failed and retry-dependent runs are never reported as passes. [UiFollowUp.spec.ts](__tests__/UiFollowUp.spec.ts) and the focused [Play](__tests__/play/), [History](__tests__/history/) and [Setup](__tests__/setup/) regressions retain the UI-01–UI-17 assertions using the shared mounted-app harness, supported by component and store tests. Use `--maxWorkers=1` for these application checks and run them separately from browser work to avoid the observed bootstrap instability. The journey entry point replaces `/src/main.ts` only for the journey command; ordinary development and production builds retain the normal entry point. Journeys force the browser platform and use the same managed-file adapter as normal browser runs, with an isolated sessionStorage key per run/journey. Only picker choices and engine transport are replaced; the scripted transport reuses the shared desktop/browser UCI protocol client without starting native processes.
