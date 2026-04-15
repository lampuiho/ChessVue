# ProcessManager

## Purpose
Own local child-process lifecycle for engine sessions.

## Public Interface
```ts
type ProcessHandle = string

spawnProcess(executablePath: string, args?: string[]): Promise<ProcessHandle>
assertProcessHandleOpen(processHandle: ProcessHandle): void
stopProcess(processHandle: ProcessHandle): Promise<void>
restartProcess(processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle>
```

## Responsibilities
- start and stop engine processes on demand
- surface stale or closed process handles through an explicit validity check used by the owning runtime paths
- isolate failures to the affected session
- stop related processes when games close or engine assignments change
- stay at the process-lifecycle boundary only; protocol-specific I/O and UCI commands belong outside this service

## Dependencies
- Node child-process APIs available through the active `NW.js` runtime
- shared platform failure contract from `DataInterface/PlatformError`

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess, protocol semantics, engine output, or UI state.
- `EngineRuntimeService` is the owning caller for `ProcessManager` in the baseline architecture.
- `ProcessHandle` is an opaque platform-owned token. Layer 2 binds that handle into the runtime-only `$` namespace of the relevant copied in-game engine object rather than leaking process identity into persisted game state.
- `spawnProcess` and `restartProcess` reject with `IPlatformError` of kind `processStartFailed` when the host cannot create the process.
- `assertProcessHandleOpen(...)` throws `IPlatformError` of kind `invalidProcessHandle` when the stored process handle is no longer valid.
- Post-start termination is observed by later process-handle checks or engine I/O failures rather than through a callback subscription contract.

## Lifecycle Example
`ProcessManager` only sees process creation and termination boundaries.

Example lower-level usage:

```text
spawn process -> stockfish.exe
assert process handle open -> continue or throw invalid process handle
stop process -> session closed
```

Protocol-specific examples such as UCI do not belong in `ProcessManager`.
