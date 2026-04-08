# ProcessManager

## Purpose
Own local child-process lifecycle and raw process I/O for engine sessions.

## Public Interface
```ts
spawnProcess(sessionId: string, executablePath: string, args?: string[]): Promise<void>
writeInput(sessionId: string, payload: string): Promise<void>
subscribeToStdout(sessionId: string, onLine: (line: string) => void): () => void
subscribeToUnexpectedExit(sessionId: string, onUnexpectedExit: (error: IPlatformError) => void): () => void
stopProcess(sessionId: string): Promise<void>
restartProcess(sessionId: string, executablePath: string, args?: string[]): Promise<void>
```

## Responsibilities
- start and stop engine processes on demand
- route raw stdout lines to the owning layer-2 runtime service
- surface unexpected post-start process termination to the owning layer-2 runtime service
- isolate failures to the affected session
- stop related processes when games close or engine assignments change
- stay at the process boundary only; protocol-specific UCI commands belong in `EngineClient`

## Dependencies
- desktop child-process APIs
- shared platform failure contract from `DataInterface/PlatformError`

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess, protocol semantics, or UI state.
- `EngineRuntimeService` is the owning caller for `ProcessManager` in the baseline architecture.
- `spawnProcess` and `restartProcess` reject with `IPlatformError` of kind `processStartFailed` when the host cannot create the process.
- Post-start termination is treated separately as `unexpectedExit` so callers can distinguish launch failure from runtime failure.
- `subscribeToUnexpectedExit(...)` reports only post-start termination for the subscribed session and does not replace the launch-failure rejection path.
- The rewrite-phase mock must support scripted stdout, scripted unexpected exit, and per-session isolation so `EngineRuntimeService`, `EngineClient`, and analysis-flow tests do not depend on real engine binaries.

## Raw I/O Example
`ProcessManager` only sees process spawning, stdin writes, and stdout lines.

Example lower-level usage:

```text
spawn process -> stockfish.exe
write stdin -> <protocol payload>
read stdout -> <protocol output line>
```

Protocol-specific examples such as UCI belong in `EngineClient`, while `EngineRuntimeService` owns passing those protocol payloads across raw process I/O.
