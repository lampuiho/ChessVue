# ProcessManager

## Purpose
Own local child-process lifecycle for engine sessions.

## Public Interface
```ts
type ProcessHandle = string

spawnProcess(executablePath: string, args?: string[]): Promise<ProcessHandle>
subscribeToUnexpectedExit(processHandle: ProcessHandle, onUnexpectedExit: (error: IPlatformError) => void): () => void
stopProcess(processHandle: ProcessHandle): Promise<void>
restartProcess(processHandle: ProcessHandle, executablePath: string, args?: string[]): Promise<ProcessHandle>
```

## Responsibilities
- start and stop engine processes on demand
- surface unexpected post-start process termination to the owning layer-2 runtime service
- isolate failures to the affected session
- stop related processes when games close or engine assignments change
- stay at the process-lifecycle boundary only; protocol-specific I/O and UCI commands belong outside this service

## Dependencies
- desktop child-process APIs
- shared platform failure contract from `DataInterface/PlatformError`

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess, protocol semantics, engine output, or UI state.
- `EngineRuntimeService` is the owning caller for `ProcessManager` in the baseline architecture.
- `ProcessHandle` is an opaque platform-owned token. Layer 2 binds that handle into the runtime-only `$` namespace of the relevant copied in-game engine object rather than leaking process identity into persisted game state.
- `spawnProcess` and `restartProcess` reject with `IPlatformError` of kind `processStartFailed` when the host cannot create the process.
- Post-start termination is treated separately as `unexpectedExit` so callers can distinguish launch failure from runtime failure.
- `subscribeToUnexpectedExit(...)` reports only post-start termination for the subscribed session and does not replace the launch-failure rejection path.
- The rewrite-phase mock must support scripted unexpected exit and per-session isolation so `EngineRuntimeService` and analysis-flow tests do not depend on real engine binaries.

## Lifecycle Example
`ProcessManager` only sees process creation and termination boundaries.

Example lower-level usage:

```text
spawn process -> stockfish.exe
detect unexpected exit -> runtime error
stop process -> session closed
```

Protocol-specific examples such as UCI do not belong in `ProcessManager`.
