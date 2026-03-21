# ProcessManager

## Purpose
Own local UCI child-process lifecycle and raw process I/O for engine sessions.

## Public Interface
```ts
startProcess(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
sendCommand(sessionId: string, command: string): Promise<void>
subscribeToOutput(sessionId: string, onLine: (line: string) => void): () => void
stopProcess(sessionId: string): Promise<void>
restartProcess(session: IEngineRuntimeSession, engine: IEngineRecord): Promise<void>
```

## Responsibilities
- start and stop engine processes on demand
- route raw UCI output lines to store-owned parsers
- isolate failures to the affected session
- stop related processes when games close or engine assignments change

## Dependencies
- desktop child-process APIs

## Notes
- `ProcessManager` owns process mechanics only; it does not interpret chess or UI state.
- Unexpected exit marks the session unavailable until the user retries.
