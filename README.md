# ChessVue

ChessVue uses Vue 3, Pinia and Vite, with a desktop-first design and shared browser/NW.js application flows.

## Development

```sh
npm install
npm run dev
```

The default platform is `auto`: NW.js when its runtime is present, browser otherwise. Set `CHESSVUE_PLATFORM` to `browser` or `nwjs` to force a target, for example in PowerShell:

```powershell
$env:CHESSVUE_PLATFORM = 'browser'
npm run dev
```

Forcing `nwjs` retains the mock NW.js/Node fallback when the host is unavailable, so desktop adapters can still be tested without NW.js. Automatic platform detection selects the browser when no real NW.js runtime exists.

Browser games, settings, session and layout use localStorage for the current origin. The save folder is a virtual directory; it does not grant disk access. Import opens a browser file picker and export downloads canonical JSON. Native UCI executables use NW.js. Browser UCI engines run in dedicated workers; the bundled Stockfish.js engine uses a small single-threaded WASM build. Remote engine services remain deferred.

Browser visibility-hidden and page-hide events request autosave checkpoints. Browsers cannot await asynchronous shutdown handlers, so a final tab-close autosave is best effort. Explicit saves and move-count autosaves complete during normal use.

## NW.js desktop

Install the supported Node version, run `npm install`, then download and extract the [NW.js SDK](https://nwjs.io/downloads/) for your OS. Keep its extracted files together. Set the executable path and launch ChessVue:

```powershell
$env:Path = 'E:\PortableApps\nodejs;' + $env:Path
$env:CHESSVUE_NWJS_EXECUTABLE = 'E:\Tools\nwjs-sdk\nw.exe'
npm run desktop
```

Replace the example SDK path with yours. An existing SDK executable may be named `Game.exe`; use its full path and keep the surrounding runtime files in place. The launcher starts a local Vite server, creates the NW.js manifest and enables Node access for that loopback origin. Automatic platform detection selects the native adapters. Closing the app normally awaits autosaves and engine shutdown, and the launcher then stops the server.

Geolocation is disabled: Vite development and preview responses deny it with `Permissions-Policy: geolocation=()`, and the NW.js launcher disables Chromium’s Windows location-permission integration to avoid starting the Windows location capability check. Restart `npm run desktop` after changing launcher settings. If hosting a production build yourself, serve the same permissions header.

`npm run desktop` opens a visible application window. Automated desktop tests hide theirs by default; set `CHESSVUE_DESKTOP_INTERACTIVE=1` to run the operator checks with visible windows.

The development app keeps `settings.json`, `game-session.json`, `layout-state.json`, its Chromium profile and the default `saves/` folder beneath ignored `.desktop/development/`. Settings > Session > Save folder accepts a relative or absolute local path. Existing browser saves remain in that browser origin.

For a native engine, extract [Stockfish](https://stockfishchess.org/download/) or another UCI executable. In Settings > Engines > Add profile, select **Desktop executable**, enter its full executable path and save the profile/settings. Assign it as a player or analysis engine when creating a game. The included Stockfish.js worker is also available.

Run the native journeys with a real SDK and engine:

```powershell
$env:CHESSVUE_UCI_EXECUTABLE = 'E:\Tools\stockfish\stockfish.exe'
npm run test:desktop
$env:CHESSVUE_DESKTOP_INTERACTIVE = '1'
npm run test:desktop
npm run journey -- report test-results/DesktopResults.json
Remove-Item Env:CHESSVUE_DESKTOP_INTERACTIVE
```

The first run automates native disk/process checks. The interactive run opens visible windows and asks you to operate native file pickers, change focus and switch OS appearance. Missing/skipped native checks remain unverified. See the [desktop test procedure](e2e/desktop/README.md) for prerequisites, reset, evidence and the JRN-DESKTOP-01–07 matrix. This launcher runs the development app; packaged distribution is a separate step.

## Browser engines

In Settings > Engines, add an engine profile with location `stockfish.js`, then select it as an analysis engine or computer player in Custom game. Computer players use timed games. Each engine assignment gets an independent worker; stopping or restarting one does not affect the others. Other UCI worker scripts can use a URL served from the same site.

The engine remains `EngineClientType.Uci`. Desktop process I/O and browser worker messages share the same UCI session implementation. Vite serves the pinned Stockfish.js 19.0.1 worker and matching WASM during development and includes both in production builds. Its GPL licence and matching source links accompany the engine under `engines/stockfish/`.

See [upstream Stockfish.js](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) for engine source and build instructions.

## Journeys and browser end-to-end tests

The [user journey test development plan](docs/JourneyTestPlan.md) defines the scenarios to automate, failure cases, priorities and completion criteria.
The [implementation record](docs/ArchivedPlans/JourneyImplementation.md) tracks the first creation/save cases and their validation; `npm run journey -- report` reports the latest run against distributed case metadata.

```sh
npm run journey -- list
npm run journey -- history --open
npx playwright install chromium
npm run test:e2e
```

Playwright starts ordinary browser development and journey servers on ports 4173 and 4174. Tests cover play/save/reload, real file import/download, appearance persistence, all journey bootstraps, scripted analysis, journey export/import, real concurrent Stockfish analysis and a real engine opponent. No NW.js installation or local engine is required.

Journeys use the browser platform with isolated sessionStorage, deterministic dialog choices and scripted UCI transport. See [journeys/README.md](journeys/README.md) for fixtures, manual steps and reset controls. The separate [native desktop lane](e2e/desktop/README.md) covers real NW.js dialogs, local processes and awaited shutdown; native acceptance requires its recorded runtime results.

## Validation

```sh
npm run test:unit -- --run --maxWorkers=1
npm run type-check
npm run build
```

Use [VS Code](https://code.visualstudio.com/) with [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) for Vue/TypeScript support.
