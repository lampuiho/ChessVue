# Ordinary-browser scenario review

Reviewed against the browser adapters, user flows and [scenario baseline](../../../docs/HighLevel/scenarios.md). This lane starts with an empty browser context at the ordinary app origin. It creates its games, settings and engine profiles through the UI. It has no journey bootstrap, seeded filesystem, scripted engine or picker override. The `browser` fixture name identifies this platform lane; it is not an executable journey in the seeded catalogue.

Case metadata lives in [cases](cases/), shared branch inputs in [BrowserScenario.ts](data/BrowserScenario.ts), and browser actions/assertions in [e2e/browser](../../../e2e/browser/). Each test has a fresh Playwright context; same-context pages deliberately share origin storage. Page errors across all pages fail acceptance. Failed runs attach persisted browser storage and page errors; Playwright retains traces.

## JRN-BROWSER-01

Create a local game, play e4, write a named save, accept dark appearance and black orientation, then reload and open a second page at the same origin. Compare the complete exported canonical document after each restoration, allowing only an updated timestamp. Check the original game ID, session tabs/active game, route, orientation and saved appearance. The named save remains byte-for-byte unchanged. Scenario ownership: SCN-SESSION-02, SCN-MOVE-01, SCN-SAVE-03 and SCN-SETTINGS-01. This covers persisted same-origin reuse, not simultaneous cross-tab editing or live synchronisation.

## JRN-BROWSER-02

Export through an actual download event, read its JSON and submit the downloaded file through an actual file chooser. Compare every canonical field while allowing the newly allocated import identity and updated timestamp; verify both session IDs, preserved original autosave and imported reload. Separate invalid JSON and malformed UTF-8 uploads must leave all stored documents and the route unchanged, show the specific error and permit a valid chooser retry. Scenario ownership: SCN-EXPORT-01, SCN-IMPORT-01 and SCN-IMPORT-02. Browser download filenames replace desktop save-path selection; this lane makes no native-dialog claim.

## JRN-BROWSER-03

Configure two profiles using the bundled Stockfish alias and start free analysis. Observe two distinct real workers and successful requests for the matching single-thread WASM. Stop one search while the other remains running, then refresh and verify the same independently owned workers continue. Commit a local move and replay all exported PVs legally from the new position; repeat after reload with two fresh workers and fresh successful WASM requests. Scenario ownership: SCN-ANALYSIS-01/02/03 and SCN-SESSION-02. Stop controls cancel a search and retain its worker; they do not promise process termination. No best move, score or exact depth is prescribed.

## JRN-BROWSER-04

Create a one-minute game with local White and real Stockfish Black. Reload either after its reply or while its reply is due. The due branch holds only the first real WASM request, waits for the one-ply autosave and reloads before allowing asset delivery to settle. The replacement worker loads normally. Verify one legal black reply, a two-ply canonical path without extra children, White to move, positive bounded clocks and an ongoing result. Reload again and compare the complete move tree. Scenario ownership: SCN-MOVE-01, SCN-TIME-01 and SCN-SESSION-02. No deterministic engine move or elapsed search time is required.

## JRN-BROWSER-05

Parameterise malformed URLs, native executable paths, cross-origin URLs, a worker returning 404 and real Stockfish JavaScript whose adjacent WASM cannot load. The faulty seat must show an actionable error with Retry available. Its healthy sibling must keep its real worker, stream legal output after a local move and remain usable when the faulty seat is removed. Then create and play a fresh local live game. Only the failing asset route is controlled; the healthy worker and WASM remain real. Scenario ownership: SCN-ANALYSIS-01/02/03, SCN-ENGINE-01 and SCN-MOVE-01. Validation errors advise an appropriate browser/desktop location; asset errors expose engine failure and the recovery controls. No automatic reconnect is introduced.

## JRN-BROWSER-06

Disable interval autosave through Settings and establish that a new move has not yet been saved. Deliver pagehide or a hidden visibilitychange to the registered browser event boundary, then wait for the resulting durable autosave before reloading. Play another move, finish an ordinary named save and close the actual page. Open another page and verify the already completed named save and canonical game survive. Scenario ownership: SCN-SAVE-01/03 and SCN-SESSION-02. The visibility event uses a temporary `visibilityState` override, restored immediately after dispatch. Event dispatch while the page remains alive proves checkpoint handling; actual tab-close asynchronous autosave is best effort and is not a guaranteed awaited shutdown. The close assertion relies only on writes confirmed before closing.

## JRN-BROWSER-07

Use Chromium media emulation to change the actual prefers-color-scheme boundary in system, light and dark modes. System mode follows each change; explicit modes remain fixed. Host changes must not rewrite settings, and the accepted policy survives reload. Separately throw a real quota exception from browser Storage.setItem on the settings write: retain the previous accepted appearance, editable draft and unchanged persisted documents. Reload proves the rejected draft was not durable. Explicitly retry and reload to prove the later accepted dark preference and played move persist. Scenario ownership: SCN-SETTINGS-01. The existing JRN-IO-03 browser regression remains separately registered; this group adds rejected-write reload acceptance and real host-policy coverage.

## Availability and evidence

These are existing product flows. Acceptance exposed two defects: streamed analysis could replace an unchanged board prop and clear the user's selection, and a rejected Stockfish WASM startup promise could leave engine creation pending. GameView now retains its derived board snapshot within the same game/node/position; actual context or board changes still replace it. The bundled worker asset relays unhandled startup rejection into the transport's owned error/termination path in both development and production output.

The browser lane uses the existing development server and Chromium; successful production bundling does not establish production-hosted worker execution or native NW.js acceptance. Execution evidence and counts belong in [JourneyImplementation.md](../../../docs/JourneyImplementation.md#ordinary-browser-verification), separately from this review and test discovery.
