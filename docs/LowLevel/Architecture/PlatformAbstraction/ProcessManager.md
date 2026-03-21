# ProcessManager

## Purpose
Own local child-process lifecycle and raw process I/O for engine sessions.

## Public Interface
```ts
spawnProcess(sessionId: string, executablePath: string, args?: string[]): Promise<void>
writeInput(sessionId: string, payload: string): Promise<void>
subscribeToStdout(sessionId: string, onLine: (line: string) => void): () => void
stopProcess(sessionId: string): Promise<void>
restartProcess(sessionId: string, executablePath: string, args?: string[]): Promise<void>
```

## Responsibilities
- start and stop engine processes on demand
- route raw stdout lines to protocol-specific clients
- isolate failures to the affected session
- stop related processes when games close or engine assignments change

## Dependencies
- desktop child-process APIs

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess, protocol semantics, or UI state.
- Unexpected exit marks the session unavailable until the user retries.

## Raw I/O Example
`ProcessManager` only sees process spawning, stdin writes, and stdout lines.

Example lower-level usage:

```text
spawn process -> stockfish.exe
write stdin -> <protocol payload>
read stdout -> <protocol output line>
```

Protocol-specific examples such as UCI belong in `EngineClient`, which translates between typed engine operations and raw process I/O.
