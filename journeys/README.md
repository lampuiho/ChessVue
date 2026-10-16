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

[Catalogue.json](Catalogue.json) maps launch names to each journey's `Description.json`. The shared loader composes titles, scenario references and ordered manual steps for the CLI and app. Steps are also available in the browser console as `window.chessVueJourney.steps`. Stable game IDs follow the names in [definitions/](definitions/), such as `history-allowed`, `promotion-white` and `clocks-timeout-b`.

## Reset and switch

```js
window.chessVueJourney.reset(); // Clear this journey's files and reload its seed.
```

Any journey server can run another fixture by visiting `/?journey=saves&reset=1`. Without `reset=1`, switching back restores that journey's files from this command run. Navigation/reload retains the selected journey even after the app removes the query string. The app initially starts at Home and restores the fixture's persisted route after its games load.

## Automation

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

Choices remain selected until changed or reloaded. Otherwise export uses `exports/<suggested filename>`. Round-trip testing can select that exported path with `chooseImport('exports/round-trip.json')`. In automation, inspect data through `page.evaluate()` after the UI operation finishes. The hook exposes files and dialog choices; game changes still go through the normal UI/stores.

Engine profiles `journey://a` and `journey://b` implement UCI handshake, legal deterministic moves and three short PVs. Analysis reports one depth-12 update and remains running until stopped. `journey://unavailable`, or any other path, fails to start. These fixtures exercise the application's UCI client and process lifecycle; native file pickers, real process crashes, playing strength and sustained engine output still need desktop integration testing.

## Maintenance and checks

Migrated journeys live in `definitions/<name>/index.ts`, with owned `data/`, `cases/` and `ScenarioReview.md`; the remaining flat definitions migrate when their behaviour is developed. Descriptions for all ten journeys already live beside their definitions. Shared builders under `builders/` construct games, legal histories, clocks, settings, saves and workspaces; reusable profile/timestamp data lives under `data/`. Add a description path to `Catalogue.json` and compose the definition in `index.ts`. Keep IDs and timestamps stable; only paused clock anchors use the seed time. Corrupt documents should be explicit overrides, as in `recovery` and `saves`.

Implemented coverage includes JRN-FRESH-01–09, JRN-PLAY-01–12, JRN-HIST-01–09, JRN-SETUP-01–09, the save/import identity case JRN-SAVE-08, and the workspace portion of JRN-SAVE-07. History owns 16 browser variants for navigation, rewrite decisions, branch preferences, paused exploration, pruning, actual-move records and nested restoration, with nine focused integration checks for recording, pause ownership, edit guards and detached nodes. [Setup](definitions/setup/ScenarioReview.md) owns 24 browser variants for free exploration, first-edit history clearing, all palette kinds/colours, clear/reset, edit guards, delayed analysis assignment, start cancellation/recovery and workspace reloads, plus eight focused integration checks for edit invariants, exact engine starts and the migrated UI-10/UI-17 assertions. Feature specs live under `e2e/journeys/`; the catalogue sweep checks bootstrap only. Owned case metadata names every executable variant and links its scenario review. [JourneyImplementation.md](../docs/JourneyImplementation.md) records the baseline, scope and remaining work.

```sh
npm run test:e2e -- --project=journeys
npm run test:e2e -- --project=journeys --grep @smoke
npm run journey -- report
```

Playwright writes per-run evidence to ignored `test-results/JourneyResults.json`. The report joins those results to distributed case metadata; absent variants remain unverified, and retries remain flaky. `passed` describes the named assertions in that run, while `partial` implementation retains its outstanding acceptance work. Reports do not count catalogue scenario membership as executed coverage, and a filtered run does not carry forward results from an earlier run.

```sh
npm run test:unit -- --run journeys --maxWorkers=1
npm run type-check
```

Fixture checks validate legal move trees, document round trips, scenario references, builder ownership, persistence/reset isolation and the scripted UCI lifecycle. Registry checks validate migrated case/data/spec/review references; coverage checks ensure missing, failed and retry-dependent runs are never reported as passes. [UiFollowUp.spec.ts](__tests__/UiFollowUp.spec.ts) and the focused [Play](__tests__/play/), [History](__tests__/history/) and [Setup](__tests__/setup/) regressions retain the UI-01–UI-17 assertions using the shared mounted-app harness, supported by component and store tests. Use `--maxWorkers=1` for these application checks and run them separately from browser work to avoid the observed bootstrap instability. The journey entry point replaces `/src/main.ts` only for the journey command; ordinary development and production builds retain the normal entry point. Journeys force the browser platform and use the same managed-file adapter as normal browser runs, with an isolated sessionStorage key per run/journey. Only picker choices and engine transport are replaced; the scripted transport reuses the shared desktop/browser UCI protocol client without starting native processes.
