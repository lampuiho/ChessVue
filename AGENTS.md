## Naming conventions
- Vue composable function names use the `useXxxx` pattern.
- Capitalised abbreviations should be treated as words in Pascal/camel, e.g., `HttpRequest` not `HTTPRequest`.
- Pascal case for classes, interfaces, types, and enums, and vue module names
- singular form if there is suffix
- private fields including functions use underscore prefix
- interfaces should start with I
- UK spelling

## Coding style
- Production files in `src/components` and its subfolders must be `.vue` files. Keep TypeScript composables/directives outside that tree; retain component tests in their existing colocated `__tests__` folders.
- prefer compact code, avoid line space. add line space if only two section of code is clearly unrelated, at which point a comment to separate is prefered or if long enough, refactor into private function. This includes no line space closing bracket and another scope such as functions, if else, etc.
- functions preferally be under 35 lines. more than that should try to make meaningful refactor into private functions
- if there is only a single line insdie if statement, prefer oneliner so as to avoid code folding. use scope only if too long.
- add semi-colon for every line of typescript
- Prefer inferred return types for implementation functions; omit redundant `: void` and `: Promise<void>`. Keep annotations required by an interface, callback contract, deliberate public constraint or inference limitation; being exported alone is not a reason to annotate. Do not remove `void` from callable types or promise generics merely because it appears in a search result.

## Async work and watchers
- Do not use generation, epoch or sequence counters to invalidate async work, or rename the same mechanism as a version/token. Give work an explicit owner, prevent duplicate starts, and cancel/settle superseded work at its action or lifecycle boundary. Review identity guards against that ownership invariant rather than adding more stale-result checks.
- Do not use watchers, including `watchEffect` and equivalent reactive subscriptions. Use computed values for derived state and explicit actions, component events, lifecycle hooks or router hooks for effects.
- Follow [the code cleanup plan](docs/CodeCleanupPlan.md) for ownership decisions, event boundaries and verification.
- Run `npm run check:code` after relevant changes. The build enforces the AST audit with no observer exceptions.

## Styling
- CSS `color-scheme` and `light-dark()` own browser system-theme selection. Apply accepted appearance settings through UI events; do not query or subscribe to OS-theme changes for app styling.
- Use global CSS consistently. `src/assets/main.css` is the only stylesheet entry; it imports the base and purpose-specific modules in `src/assets/styles` for both application entry points.
- Do not add Vue `<style>` blocks or `:deep`, `::v-deep`, `:global`, `>>>` or `/deep/` selectors. The build audit enforces this boundary.
- Shared primitives have one global owner. Select explicit class variants in templates; do not restyle shared buttons, fields or panel internals in route stylesheets.
- Keep selectors anchored to their owning class, including headings and paragraphs. Runtime style bindings supply CSS custom-property values only; put layout and presentation declarations in the global CSS modules.
