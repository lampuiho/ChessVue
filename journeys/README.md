# Testing journeys

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

[Catalogue.json](Catalogue.json) holds the scenario IDs and ordered manual steps for each journey. These are also available in the browser console as `window.chessVueJourney.steps`. Stable game IDs follow the names in [definitions/](definitions/), such as `history-allowed`, `promotion-white` and `clocks-timeout-b`.

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

`ready` means settings/layout, restored games and the current session route have settled. It does not mean analysis has finished or that the scenario passed. Wait for the expected rendered engine lines when testing analysis. Timed fixtures begin paused so tests control when their deadlines start. This repository currently uses Vitest; the example can be reused by an external end-to-end suite without adding Playwright as an application dependency.

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

Each journey lives in `definitions/<name>.ts`; shared game builders validate moves against the chess rules and serialise canonical version-1 documents. Add its description/scenarios/steps to `Catalogue.json` and register it in `index.ts`. Keep IDs and timestamps stable; only paused clock anchors use the seed time. Corrupt documents should be explicit overrides, as in `recovery` and `saves`.

```sh
npm run test:unit -- --run journeys --maxWorkers=1
npm run type-check
```

Fixture checks validate legal move trees, document round trips, committed-scenario coverage, persistence/reset isolation and the scripted UCI lifecycle. [UiFollowUp.spec.ts](__tests__/UiFollowUp.spec.ts) covers the completed UI-01–UI-17 fixes with 32 passing application regressions, supported by component and store tests. Use `--maxWorkers=1` for these application checks to avoid the observed parallel-bootstrap timeout. The journey entry point replaces `/src/main.ts` only for the journey command; ordinary development and production builds retain the normal entry point.
