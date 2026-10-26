# External Worker loading experiments

Tested on 25 October 2026 using Windows x64, NW.js SDK 0.119.2, Chromium 156.0.8078.48 and its embedded Node.js 26.12.1.

Four approaches execute both original engines. The file-frame, loopback-frame and filesystem-junction approaches also pass the nested-Worker check. A bootstrap with URL shims works for the tested single-Worker engines but does not provide general nested-Worker support.

The experiments below changed no application code or approved implementation plan. After reviewing them, the user authorised the Blob bootstrap with local asset mapping. Its self-contained WorkerScriptLoader implementation and subsequent production/NW.js verification are recorded in the [installation plan](EngineInstallationReworkPlan.md#current-verification-limits). Statements below about candidates not being adopted describe the experimental stage.

## What was tested

The external package folder is outside every test application's root. It contains unchanged Lozza HCE 12.0 and Stockfish 19 lite single-worker JavaScript, with Stockfish's original neighbouring WASM file. File hashes are recorded and were verified unchanged after the runs. The folder name contains a space.

The basic checks create actual Workers, exchange UCI/ready messages, analyse the starting position to depth 3 and receive a best move. Independent fixtures check sibling importScripts, relative fetch of binary bytes, relative XMLHttpRequest and a nested Worker.

The expanded lifecycle check runs Lozza and Stockfish concurrently, stops and terminates Lozza, verifies Stockfish can still stop/respond, then creates a fresh Lozza Worker and obtains another analysed move. Those checks passed for the junction, loopback helper, file helper with its flag, and both bundled resource-bootstrap variants.

There are 26 distinct configurations. Failed attempts, crashes and harness failures are retained in the raw reports; incomplete early flag runs were repeated with a corrected harness. Harness deadlines bound experiments only; application startup handling is unchanged.

## Results

| Approach | Engines and neighbouring assets | Expanded checks | Cost or limitation |
| --- | --- | --- | --- |
| App-shipped file iframe + --allow-file-access-from-files | Both engines and original WASM pass | Concurrent analysis, stop/recreation, XHR and nested Worker pass | Changes the app's file-origin policy; requires a helper-frame owner. No server, package copy or script shim. |
| Loopback HTTP helper iframe | Both engines and original WASM pass | Concurrent analysis, stop/recreation, XHR and nested Worker pass | Requires a local server and helper-frame lifecycle. Main application stays at its existing extension URL. |
| Directory junction beneath the app root | Both engines and original WASM pass | Concurrent analysis, stop/recreation, XHR and nested Worker pass | Requires creating a filesystem link in the app root; only Windows with a writable app folder was tested. |
| Bundled bootstrap with location/importScripts/fetch/XHR URL shims | Both engines and original WASM pass | Concurrent analysis, stop/recreation and XHR pass; nested Worker fails | No flags/server/copy, but substitutes parts of the Worker environment. Covers the tested classic single-Worker builds. |
| Bundled bootstrap without the XHR shim | Both engines, sibling scripts and fetch pass | Lifecycle passes; XHR and nested Worker fail | More limited resource compatibility. |
| Blob bootstrap with location/importScripts/fetch URL shims | Both engines, sibling scripts and fetch pass | Expanded checks not repeated for this variant | Same resource-base technique; also owns a Blob URL. |
| Blob bootstrap changing only location | Both engines and WASM pass | Relative sibling import fails | Reading location is corrected, but native relative resource resolution is not. |
| Simple Blob or bundled importScripts bootstrap | Lozza passes; Stockfish and sibling assets fail | Insufficient for package loading | Imported script's resources still resolve against the bootstrap context. |
| Whole app served from loopback HTTP | Both engines, original WASM and sibling assets pass | Expanded checks not repeated for this variant | Changes application hosting/origin and adds a server; more scope than a helper iframe. |
| Direct file Worker plus flags only | No usable combination | Crashes or fails to load the script | Flags tested separately below. |
| File helper without the file-access flag | Fails | SecurityError from origin null | Tested with an app-shipped helper and an external helper. |
| Node worker_threads with a minimal message bridge | Lozza passes; Stockfish and browser-resource fixtures do not | Not a generic browser Worker replacement | This bridge does not supply a full browser Worker environment. |
| Original Stockfish as an NW.js child-process script | No UCI response within the experiment deadline | Inconclusive beyond this invocation | Does not establish that all Node execution strategies fail. |

### File helper: the constructor's realm matters

The successful test loads an app-shipped HTML helper through a file URL and creates the engine using that frame's Worker constructor:

~~~js
const WorkerClass = helperFrame.contentWindow.Worker;
const worker = new WorkerClass(externalEntryFileUrl);
~~~

The main application remains at its chrome-extension URL, retains Node access, and the engine Worker has its ordinary file URL. Browser-native resolution handles sibling scripts, WASM, fetch, XHR and nested Workers.

The helper is shipped by the app. The vendor package needs no HTML helper, manifest or generated metadata. The passing app-helper variant required no node-remote addition and no Node integration inside Workers.

The flag alone, with the Worker still created in the application's extension realm, crashes. A file helper without the flag fails with SecurityError. Both controls were tested.

Selecting this option would require an explicit decision about the flag and ownership of the helper frame. Packaged ZIP applications and other operating systems have not been verified. The experiment does not prescribe a new public API or globally replace the application's Worker constructor.

### Bootstrap: why importScripts alone is insufficient

A bootstrap Worker starts from an allowed app/Blob URL, then imports the supplied external entry. That runs plain JavaScript, but the Worker's native base URL still belongs to the bootstrap.

The successful single-Worker bootstrap exposes the external entry as location and resolves relative importScripts/fetch calls against that entry. Adding an XMLHttpRequest.open shim fixes the separate XHR fixture. Original vendor script bytes remain unchanged.

A nested new Worker('./child.js') still uses the bootstrap realm/base and fails. Changing location does not change the browser's internal origin or every resource-resolution algorithm. Do not treat this as a universal browser-package loader or claim support for threaded Stockfish builds.

### Flags tested

Direct creation from the app's extension frame was tested with:

- No extra flags.
- --enable-node-worker.
- --allow-file-access-from-files.
- --disable-web-security.
- --disable-features=EnforceDedicatedWorkerSameOriginCheck.
- The feature switch combined with file access, Node Workers, or both.
- The feature switch combined with --disable-web-security and file access.

None made direct file Workers usable. The initial three cases and --disable-web-security still terminate the renderer with DWH_INVALID_SCRIPT_URL_ORIGIN. Disabling the named feature prevents that crash in these tests, but the Workers fail to load. Broad combined flags also made require unavailable in the app frame.

The exact crash matches Chromium's dedicated-Worker origin enforcement. That is consistent with creating a file Worker from an extension-origin app frame; the source connection is an inference from the matching diagnostic and checks. See the [Chromium enforcement change](https://chromium.googlesource.com/chromium/src/+/8bde565f45a8baf9b84c129905eb53c9abe108d2%5E!/) and [NW.js frame privileges](https://docs.nwjs.io/For%20Users/Advanced/Security%20in%20NW.js/). NW.js documents --enable-node-worker as enabling Node integration in Workers; it does not promise to fix this origin mismatch. See [NW.js command-line options](https://docs.nwjs.io/References/Command%20Line%20Options/).

## Hosted-browser follow-up

The deployment requirement is an app hosted online, with users importing engine files locally and running no local server. The earlier loopback-server suggestion does not meet that requirement.

A follow-up test ran ordinary headless Chromium at a simulated HTTPS origin, https://hosted.example.test. Playwright supplied only the static HTML/test-driver responses. The browser had no Node access and no special file-access flags. Original engine files entered through a file input and were converted to local Blob URLs; no engine bytes were hosted or uploaded.

A Blob bootstrap mapped virtual package paths to those Blob URLs and resolved importScripts, fetch and XMLHttpRequest against the selected entry. It passed:

- Original Lozza and Stockfish/WASM UCI handshake, readiness and depth-3 analysis.
- Sibling scripts, binary fetch and XMLHttpRequest.
- Concurrent engine analysis, independent stop/termination and fresh Worker creation.

The network log contains exactly two GETs: the page and test driver. Engine requests reaching the host: zero. Uploaded bytes: zero. The nested-Worker fixture still fails because its relative child URL uses the Blob Worker's native base.

This establishes a browser-compatible counterpart to the NW.js bootstrap for the tested classic single-Worker engines. The browser supplies Blob asset URLs where the NW.js experiment used file URLs. A common production implementation, persistence integration and nested-Worker support have not been designed or adopted.

The existing service-worker browser path is also compatible with an online-hosted app: it answers package requests from browser-local storage. That does not require the host to receive engine files or the user to run a server. See [service-worker request interception](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) and [local object URLs](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static).

The new harness is VerifyHostedBrowser.mjs; its complete result and network log are in hosted-browser-results.json alongside the NW.js artifacts.

## Scope of the evidence

These are real SDK/Worker/engine runs, not mocked URL-unit checks. However:

- Windows and this SDK version were tested. macOS/Linux, archived/read-only app packaging and filesystem-link portability remain unverified.
- Original scripts and WASM were preserved. Arbitrary module-worker, pthread/SharedArrayBuffer, NNUE or different vendor builds were not validated.
- Special-character paths beyond the space in the fixture directory were not revalidated. The previously documented Stockfish URL-decoding issue is separate.
- The bootstrap's nested-Worker failure is a compatibility limit, even though the selected Stockfish lite and Lozza builds pass.
- No candidate is installed in the application. A choice requiring flags, a server, a helper frame, filesystem links or environment shims remains the user's architecture decision.

## Reproduction and artifacts

The isolated harness and raw evidence are under ignored node_modules/.cache/codex/external-worker-options:

- RunExperiments.mjs and driver.js.
- all-results.json: combined results for all 26 configurations.
- initial-results.json, follow-up-results.json, lifecycle-results.json and control-results.json: individual batches.
- Per-configuration stderr logs include the original renderer crash diagnostics.

For example, the lifecycle/resource comparison can be reproduced with portable Node:

~~~powershell
$env:WORKER_LIFECYCLE = '1'
$env:WORKER_RESOURCES = '1'
& 'E:\PortableApps\nodejs\node.exe' node_modules/.cache/codex/external-worker-options/RunExperiments.mjs filesystem-junction loopback-frame file-frame-app-helper bundled-resource-shim-xhr
~~~

The harness owns a loopback-only server and hidden SDK applications with separate test profiles. It closes them after each run. A final process check found no SDK processes left running. The application/build/test source checksum matches the checksum taken before the experiments.
