# Native desktop journeys

JRN-DESKTOP-01–07 use a real NW.js SDK, physical files and an optional real UCI executable. These tests run separately from the browser/journey Playwright projects. See the [scenario review](../../journeys/definitions/desktop/ScenarioReview.md) for expected outcomes and source findings.

## Setup and execution

Install the project's supported Node version and npm dependencies. Download and extract the [NW.js SDK](https://nwjs.io/downloads/) for the host OS and a [native Stockfish executable](https://stockfishchess.org/download/) or another UCI engine. Retain the SDK's complete extracted folder. The analysis fixture requests three principal variations, so the native engine must support MultiPV with at least three lines. Set absolute executable paths; the engine is selected through the desktop profile editor by the tests.

```powershell
$env:Path = 'E:\PortableApps\nodejs;' + $env:Path
npm install
$env:CHESSVUE_NWJS_EXECUTABLE = 'E:\Tools\nwjs-sdk\nw.exe'
$env:CHESSVUE_UCI_EXECUTABLE = 'E:\Tools\stockfish\stockfish.exe'
npm run test:desktop
npm run journey -- report test-results/DesktopResults.json
```

Replace the example paths with your installations. An SDK executable named `Game.exe` also works when its supporting runtime files remain together. No Playwright Chromium download is needed for this lane: Playwright attaches to the actual NW.js Chromium over local CDP. The SDK must support remote debugging and the application must have Node access. The fixture rejects mock/fallback hosts and non-native version information.

The automated run hides application windows, disables Chromium background throttling, uses one worker and disables retries. It connects before app navigation to capture startup errors and requests. Tests without a supplied engine are skipped explicitly. Import/export and physical OS-focus/theme tests are also skipped until interactive mode is enabled. A default automated pass therefore does not complete JRN-DESKTOP-02 or JRN-DESKTOP-07.

## Interactive native acceptance

Run from a terminal you can see, with a real desktop session:

```powershell
$env:CHESSVUE_DESKTOP_INTERACTIVE = '1'
npm run test:desktop
npm run journey -- report test-results/DesktopResults.json
Remove-Item Env:CHESSVUE_DESKTOP_INTERACTIVE
```

The app window is visible. Attachment clears Playwright's default colour-scheme emulation (`colorScheme: null`), so CSS receives the real Windows appearance. Playwright retains document focus emulation for automated UI actions while covered; physical focus acceptance reads NW.js native window events. The fixture uses NW.js show/focus actions to present its own window. Follow the terminal's NATIVE DESKTOP CHECK messages; allow up to three minutes per native action. The suite leaves physical pickers to the operator and waits for observable app/file results. Do not attach Playwright's filechooser handler or use setInputFiles, since those bypass the native surface being accepted.

| Case | Operator action |
| --- | --- |
| JRN-DESKTOP-02 cancellation tests | Press Cancel in the actual Save/Open dialog. |
| JRN-DESKTOP-02 transfer | Save to the exact printed Unicode path; decline overwrite and Cancel; export again and accept overwrite; import that path. |
| JRN-DESKTOP-07 focus | Switch to another app for at least three seconds, then return. |
| JRN-DESKTOP-07 appearance | Set the actual OS appearance to light and then dark as requested; restore the original preference afterwards. |

On Windows, use Settings > Personalisation > Colours to change the app colour mode. The suite reads the media boundary and rendered colours; it does not change OS settings. Do not interact with the app outside the requested native action while automation is running. A locked/headless session cannot establish these physical interactions.

## Ownership, errors and reset

Each test creates its own application directory, profile and files beneath test-results. Restart assertions reuse that exact directory without resetting it. Native manifests grant Node access only to the local Vite origin. The ordinary application uses automatic platform detection; no journey seed, mocked process, virtual file store or picker override is installed.

Read-only-file checks require an account whose filesystem permissions actually reject the write. The test fails if permission protection is ineffective. Missing targets, deleted selected saves, Unicode paths, external edits and exclusive-create collisions use real filesystem operations. The storage helper reads typed adapter errors; game creation, moves, managed saves, loading and settings changes use the UI.

Each process check works with PIDs read from the actual owned engine assignments. Stop cancels an analysis search and retains the reusable child; Remove terminates that child. Application close awaits checkpoints and native engine exits. Failure teardown may force termination of only the launched NW.js process tree. Never point the harness at a personal save root.

Environment/version and UCI identity attachments, native logs, screenshots, traces and disk files remain under the Playwright output directory. Page errors fail the test. A fresh test creates a new directory; rerun the suite for a clean reset. Preserve needed output before another run, since Playwright cleans its output directory at run start.

## Evidence

The lane defines 14 journey variants across six specs, plus a startup regression check in `Startup.spec.ts`. That check requires an actual geolocation request to fail with permission denied under the response policy; native teardown also rejects Windows geolocation startup errors. The shared launcher disables `WinSystemLocationPermission`, and Vite development/preview responses send `Permissions-Policy: geolocation=()`. A full acceptance run supplies both executable paths, enables interactive mode and has no skipped, failed or retry-dependent variants. The JSON report maps each exact desktop project/title to its owned case metadata. Missing executables fail setup; skipped variants remain unverified. Discovery, adapter unit tests and browser tests cannot supply native passing evidence.

The [recorded Windows execution](../../docs/ArchivedPlans/JourneyImplementation.md#window-and-interactive-follow-up) uses NW.js 0.111.1 SDK and Stockfish 15.1. Thirteen journey variants have selected passing evidence across separate reports, including all three native picker variants with visible OS interaction and scoped Windows control automation. The user waived the remaining physical focus/theme check; it remains unverified. The record preserves earlier failures and identifies each selected report; it does not claim one clean combined run.

The geolocation follow-up passed against the supplied NW.js 0.111.1 SDK: `test-results/DesktopGeolocationResults.json` records the request denial and a native startup log without the Windows location-capability error. Type checking, the code audit and the production build also passed.

This procedure currently serves the normal development entry through Vite. It does not establish packaged production runtime coverage, other OS acceptance or production installer behaviour.
