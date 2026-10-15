# ChessVue

ChessVue uses Vue 3, Pinia and Vite. Design and implementation remain desktop-first; browser adapters let us verify the shared app and journeys before desktop integration.

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

## Browser engines

In Settings > Engines, add an engine profile with location `stockfish.js`, then select it as an analysis engine or computer player in Custom game. Computer players use timed games. Each engine assignment gets an independent worker; stopping or restarting one does not affect the others. Other UCI worker scripts can use a URL served from the same site.

The engine remains `EngineClientType.Uci`. Desktop process I/O and browser worker messages share the same UCI session implementation. Vite serves the pinned Stockfish.js 19.0.1 worker and matching WASM during development and includes both in production builds. Its GPL licence and matching source links accompany the engine under `engines/stockfish/`.

See [upstream Stockfish.js](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) for engine source and build instructions.

## Journeys and browser end-to-end tests

```sh
npm run journey -- list
npm run journey -- history --open
npx playwright install chromium
npm run test:e2e
```

Playwright starts ordinary browser development and journey servers on ports 4173 and 4174. Tests cover play/save/reload, real file import/download, appearance persistence, all journey bootstraps, scripted analysis, journey export/import, real concurrent Stockfish analysis and a real engine opponent. No NW.js installation or local engine is required.

Journeys use the browser platform with isolated sessionStorage, deterministic dialog choices and scripted UCI transport. See [journeys/README.md](journeys/README.md) for fixtures, manual steps and reset controls. Real NW.js dialogs, local processes and awaited shutdown still need desktop integration checks.

## Validation

```sh
npm run test:unit -- --run --maxWorkers=1
npm run type-check
npm run build
```

Use [VS Code](https://code.visualstudio.com/) with [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) for Vue/TypeScript support.
