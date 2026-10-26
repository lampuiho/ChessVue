# Native desktop scenario review

Reviewed on 26 October 2026 against the working tree based on the revision recorded in [JourneyImplementation.md](../../../docs/ArchivedPlans/JourneyImplementation.md#native-desktop-verification). This lane uses the ordinary application entry with automatic platform selection inside an actual NW.js SDK. It never installs the journey platform, scripted UCI transport, virtual filesystem, Node overrides or picker substitutions.

The [case metadata](cases/) owns JRN-DESKTOP-01–07. [Scenario inputs](data/DesktopScenario.ts) name the two independent profiles and Unicode paths. [Tests and helpers](../../../e2e/desktop/) separate host lifecycle, UI actions, read-only inspection, engine setup and feature assertions. Desktop is a platform fixture, outside the seeded journey catalogue.

Reviewed contracts: [persistence](../../../docs/HighLevel/persistence_contract.md), [engine lifetime](../../../docs/HighLevel/engine_runtime.md), [settings](../../../docs/HighLevel/settings_contract.md), [state and clocks](../../../docs/HighLevel/state_model.md), [process mechanics](../../../docs/LowLevel/Architecture/PlatformAbstraction/ProcessManager.md) and [platform events](../../../docs/LowLevel/Architecture/PlatformAbstraction/PlatformServices.md). The owning SCN flows and BR branches are linked in each case's metadata. Findings below distinguish source inspection from executed native acceptance.

## JRN-DESKTOP-01

Aligned with SCN-SESSION-01/02, SCN-MOVE-01 and SCN-SAVE-03. From an empty real application directory, create a local game, play e4 and save a named snapshot containing spaces and non-ASCII characters. Verify physical JSON, route/session identity and canonical content. Close the real native window, await process exit and restart using the same directory/profile. Board, turn, history and identity must restore; the named file remains byte-for-byte unchanged. Auto detection must report desktop, Node and NW versions must exist, and no journey API may be installed.

## JRN-DESKTOP-02

Aligned with SCN-EXPORT-01 and SCN-IMPORT-01, including both Cancel branches. Three interactive tests operate actual OS pickers: independent import/export cancellation, then export/import and native overwrite decline/acceptance. The operator follows the exact output path printed in the terminal. Assertions check physical canonical JSON, fresh imported identity, restart restoration, unchanged original managed files and absence of false success after cancellation. No Playwright file-chooser interception or input.setFiles is used.

The recorded Windows runs now have passing evidence for all three native picker variants, using visible OS interaction and scoped Windows control automation. Cancel must settle through the host's cancel event; a host that fails to deliver it fails the test rather than receiving a synthetic success. The implementation record identifies each selected report.

## JRN-DESKTOP-03

Aligned with SCN-MOVE-01, SCN-ANALYSIS-01/02 and SCN-ENGINE-01. Use Stockfish or another native UCI engine supporting at least three MultiPV lines. Create native profiles through Settings; select one as Black and both as concurrent analysis engines in a timed game. Show live analysis moves explicitly. Play e4 and require one legal reply, distinct live PIDs for all three assignments, independent streamed analysis and no extra history children. Shutdown must release all three processes. The supplied executable's UCI name/author, path and the host versions are attached.

## JRN-DESKTOP-04

Aligned with SCN-ANALYSIS-02/03 and partial-failure/retry branches. Kill only Native A's actual PID, await its physical exit, then use the existing Stop action to detect the stale handle. Require an actionable failed seat with Retry, retain Native B's PID, then retry A and require a different PID. The process contract surfaces post-start termination at the next reference/I/O boundary; this matches the already accepted JRN-RACE-06 Stop → Retry flow and adds no asynchronous failure subscription. Both seats must supply legal continuations after a local move. Create and play another local workspace to establish continued usability. Closing the app releases surviving owned processes. This uses explicit retry; it introduces no automatic reconnect policy.

## JRN-DESKTOP-05

Aligned with SCN-SAVE-01 and SCN-SESSION-02. Independent enabled/disabled tests disable move-count autosave, complete a named zero-ply snapshot and play an unsaved move. Close through nw.Window.close(), await application process exit, then inspect disk and restart. Enabled close must persist the move; disabled close must preserve prior bytes and load the old snapshot without that move.

The settings contract coerces save-on-close on whenever session restore is on. Therefore the disabled branch turns both settings off through the UI, starts on Home and explicitly loads the persisted snapshot. This is settled policy, not a test workaround.

Source inspection exposed native manager disposal that tracked Workers but omitted native children, and window close that did not await manager cleanup. Private owned-process sets now drain exact children after registered close checkpoints. A real-host run additionally showed that closing the last window could leave the native application alive; after draining, the native binding now calls App.quit, with a forced-window-close fallback for injected hosts without that API. Focus/close/theme listeners detach at store disposal. Unit regressions prove cancellation during startup, duplicate close ownership, awaited termination and isolation; they do not establish NW.js acceptance.

## JRN-DESKTOP-06

Aligned with SCN-SAVE-03 and SCN-LOAD-01, including collision cancellation and I/O failures. Four tests cover Unicode managed paths, an external valid file edit, a declined overwrite, a file removed after selection but before Load, missing targets, a real read-only file and an explicit retry. UI paths retain usable workspaces; adapter calls inspect typed errors against physical filesystem failures. The read-only assertion intentionally fails if the executing account can still write the file.

A separate physical create race requires exactly one successful non-overwrite writer. Source inspection found access-then-write could overwrite a file created between those calls. Native writes now use Node's exclusive wx flag and map EEXIST to AlreadyExists; overwrite remains an explicit w write. This preserves the existing storage contract and file format. It adds no external-change monitor or conflict-resolution subsystem. The physical read-only-file run also exposed loss of typed error messages in confirmation/library feedback. Those projections now retain IPlatformError.message, and the native retry test verifies the specific write failure before restoring permission and retrying.

## JRN-DESKTOP-07

Aligned with SCN-TIME-01, SCN-SETTINGS-01 and SCN-ANALYSIS-03/05. Automated checks distinguish Stop search (retains its reusable process) from Remove engine (releases its process), preserve the sibling and verify final app exit releases it. An interactive test captures actual native focus events, checks the timed clock progresses after returning, then asks the operator to switch the physical OS appearance through light/dark. CSS must follow system mode without rewriting accepted settings; forced light must remain light on a dark host. The test removes its own focus listener and asks the operator to restore their original OS preference.

Physical OS appearance remains operator-owned; the harness never changes the registry or substitutes media emulation for this acceptance. Source inspection confirms application styling uses CSS colour-scheme/light-dark(), with no application system-theme query or subscription.

## Execution and reset

Each test owns a fresh directory under ignored test-results, including its NW profile and native files. Restarts reuse only that test's directory. Tests retain native logs, environment/engine identity, a screenshot and trace on a surviving page; page errors fail acceptance. The harness attaches to a blank native page before navigating to the normal entry so startup errors and requests are captured. Hidden runs use Chromium background-throttling controls, and skipped operator tests do not launch a runtime. On failed startup/teardown, forced termination targets only the launched NW process tree. Ordinary shutdown always goes through the native close event first.

Run with one worker and no retries using the [desktop procedure](../../../e2e/desktop/README.md). The SDK is required; engine-dependent tests explicitly skip without a native executable, and interactive tests explicitly skip without the operator flag. Missing/skipped tests remain unverified in the coverage report. The supplied NW.js 0.111.1 SDK and Stockfish 15.1 now have real-host execution evidence in the implementation record. Case completion follows the recorded results; discovery, type checking and mock/unit passes remain separate. All three native picker variants have recorded passing evidence. The combined physical focus/theme variant remains unverified under the user's explicit waiver; no physical test pass is claimed.
