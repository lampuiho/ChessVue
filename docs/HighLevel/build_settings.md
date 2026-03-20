# ChessVue Build Settings

## Purpose
This document summarizes non-user configuration implied by:

- `docs/HighLevel/scenarios.md`
- `docs/HighLevel/plan.md`
- `docs/HighLevel/architecture.md`

These are build-time, platform, runtime, or deployment-level decisions. They may be configurable by developers, packagers, or the host shell, but they are not normal end-user preferences.

## Reading Guide
- `Current`: already part of the documented baseline.
- `Planned`: intended architecture or runtime decision.
- `Idea`: future possibility only.
- `Inferred`: not named as a concrete field, but clearly implied by the architecture.

## 1. Platform Target and Host Shell
These settings determine where ChessVue runs and what platform capabilities it can access.

| Setting | Status | Notes |
| --- | --- | --- |
| Host shell target | Planned | Browser, NW.js, Electron, Capacitor, or similar host environment. |
| Supported platforms | Planned | Windows, macOS, web, Android, iOS, and related targets are mentioned. |
| Environment detection strategy | Planned / Inferred | Needed to choose platform adapters at runtime. |
| Mobile-responsive support level | Planned | Mobile layout support is deferred but intentionally kept open. |

## 2. Engine Integration Runtime
These settings define how ChessVue talks to chess engines at runtime.

| Setting | Status | Notes |
| --- | --- | --- |
| Engine transport implementation | Planned | UCI over child process vs WebSocket vs browser-compatible transport. |
| Web build engine strategy | Planned | Web builds may use WebAssembly engines or remote servers. |
| Process manager implementation | Planned | Desktop/native shells need process spawn/communicate/terminate support. |
| Engine adapter implementation | Planned | Abstract interface with concrete runtime-specific adapters. |
| Engine restart policy defaults | Idea / Inferred | Retry/backoff strategy can exist even if not exposed as a user preference. |

## 3. Persistence and Storage Runtime
These settings define how data is stored and restored under each build target.

| Setting | Status | Notes |
| --- | --- | --- |
| Storage adapter implementation | Planned | `localStorage`, IndexedDB, filesystem, or equivalent backend. |
| Persistence backend selection | Planned | Can vary by platform or build target. |
| Auto-persist mechanism | Planned | Pinia plugin/service strategy for persistence wiring. |
| Save snapshot scope | Current / Planned | Persist visible screen state, not only raw game state. |
| Corrupt-state recovery strategy | Planned | Isolate bad payloads and fall back safely. |
| Migration strategy for saved schemas | Planned | Upgrade legacy saved data during load/startup. |

## 4. File I/O and Compatibility
These settings control supported file workflows and serialization capabilities.

| Setting | Status | Notes |
| --- | --- | --- |
| Save/load file adapter implementation | Current / Planned | Platform-specific file dialogs and file access. |
| Supported save format(s) | Current / Planned | JSON now, with room for broader format support later. |
| Import migration behavior | Planned | Older schemas may be upgraded during load. |
| Public-domain format support | Planned / Inferred | Plan mentions future mapping from external/public formats. |
| Batch import/export capability | Idea | Depends on platform support for multi-select/packaging. |

## 5. Routing and Application Structure Defaults
These are app-structure decisions that are usually fixed by the build, not changed by users.

| Setting | Status | Notes |
| --- | --- | --- |
| Route map | Current / Planned | `/game/:id`, `/settings`, `/analysis`, `/home`. |
| Tab behavior defaults | Current | Hide tab bar when only one game exists. |
| Initial module composition | Planned / Inferred | Game view, settings view, home view, analysis view, and related panels. |
| Feature exposure by platform | Planned / Inferred | Some features may differ between desktop, web, and mobile builds. |

## 6. Serialization and Data Contracts
These settings define how the app's data is represented and exchanged.

| Setting | Status | Notes |
| --- | --- | --- |
| Internal serialized game format | Planned | JSON-based, serializable from any state. |
| External format mapping | Planned | FEN/PGN/public-domain format mapping through serialization logic. |
| Analysis cache persistence model | Planned / Inferred | Analysis lines/top lines may be persisted with screen state. |
| Schema versioning | Planned / Inferred | Needed for migration and compatibility over time. |

## 7. Recommended Build/Runtime Config Groups
If ChessVue later defines a formal runtime/build config model, these are the clearest groups:

1. `platform`
   - host shell, supported targets, environment detection
2. `engineRuntime`
   - transport type, process manager, web-engine strategy
3. `persistenceRuntime`
   - storage adapter, auto-persist wiring, recovery and migration policy
4. `fileIo`
   - file adapter, supported import/export capabilities
5. `routing`
   - route map and view exposure defaults
6. `serialization`
   - internal/external formats, schema versioning, cache persistence

## Summary
The clearest build/runtime configuration areas are:

- host shell and platform target
- engine transport and process management
- persistence backend and migration strategy
- file I/O integration
- serialization and compatibility contracts
- platform-specific feature exposure

These settings should probably live outside the normal `SettingsStore`, in something like `RuntimeConfig`, adapter registration, or platform bootstrap code.
