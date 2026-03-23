# SystemThemeAdapter

## Purpose
Expose desktop system-theme detection and change notifications without leaking host globals into stores or presentation code.

## Public Interface
```ts
interface SystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode
  subscribeToSystemThemeChanged(onChanged: (theme: ResolvedThemeMode) => void): () => void
}
```

## Responsibilities
- report the current desktop theme as one of the built-in resolved app themes
- notify the state layer when the OS theme changes
- stay at the host-capability boundary only; it does not persist settings or choose how components style themselves

## Dependencies
- desktop host theme APIs

## Notes
- `SettingsStore` is the owner of translating `themeMode = system` into a current `resolvedThemeMode`.
- The adapter exposes built-in theme resolution only. It does not introduce a custom-theme registry or any user-authored theme payloads.
- The rewrite-phase mock should provide deterministic light or dark responses and scripted change notifications so theme flows can be tested without a real desktop host.
