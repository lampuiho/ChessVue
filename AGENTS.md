## Naming conventions
- Capitalised abbreviations should be treated as words in Pascal/camel, e.g., `HttpRequest` not `HTTPRequest`.
- Pascal case for classes, interfaces, types, and enums, and vue module names
- singular form if there is suffix
- private fields use underscore prefix
- interfaces should start with I
- UK spelling

## Coding style
- prefer compact code, avoid line space. add line space if only two section of code is clearly unrelated, at which point a comment to separate is prefered or if long enough, refactor into private function. This includes no line space closing bracket and another scope such as functions, if else, etc.
- functions preferally be under 35 lines. more than that should try to make meaningful refactor into private functions
- if there is only a single line insdie if statement, prefer oneliner so as to avoid code folding. use scope only if too long.
- add semi-colon for every line of typescript
- Prefer inferred return types for implementation functions; omit redundant `: void` and `: Promise<void>`. Keep annotations required by an interface, callback contract, deliberate public constraint or inference limitation; being exported alone is not a reason to annotate. Do not remove `void` from callable types or promise generics merely because it appears in a search result.

## Async work and watchers
- Do not use generation, epoch or sequence counters to invalidate async work, or rename the same mechanism as a version/token. Give work an explicit owner, prevent duplicate starts, and cancel/settle superseded work at its action or lifecycle boundary. Review identity guards against that ownership invariant rather than adding more stale-result checks.
- Avoid watchers by default, including `watchEffect` and equivalent subscriptions. Use computed values for derived state and explicit actions, component events, lifecycle hooks or router hooks for effects. Watchers must not orchestrate gameplay, engine turns, persistence or modal completion.
- A retained watcher needs a specific external reactive boundary that cannot be handled directly, narrowly declared inputs, a short reason beside the code, and an owner for cleanup/disposal. Async watcher work must be invalidated on rerun and disposal, with handled failures; watcher cleanup is not a reason to introduce a watcher.
- Follow [the code cleanup plan](docs/CodeCleanupPlan.md) for ownership decisions, retained boundaries and verification. Existing watchers are not precedent for adding more.
- Run `npm run check:code` after relevant changes. The build enforces the AST audit; only the documented App appearance and Chessboard external-prop boundaries are currently permitted observers.
