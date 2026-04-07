# SystemThemeAdapter

## Purpose
Expose desktop system-theme detection without leaking host globals into stores or presentation code.

## Public Interface
```ts
interface SystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode
}
```

## Responsibilities
- report the current desktop theme as one of the built-in resolved app themes
- stay at the host-capability boundary only; it does not persist settings or choose how components style themselves

## Dependencies
- desktop host theme APIs

## Notes
- `SettingsStore` is the owner of translating `themeMode = system` into a current `resolvedThemeMode`.
- Theme-change notifications are registered through `IPlatformService`, not through `SystemThemeAdapter`.
- The adapter exposes built-in theme resolution only. It does not introduce a custom-theme registry or any user-authored theme payloads.
- The rewrite-phase mock should provide deterministic light or dark responses so theme-resolution flows can be tested without a real desktop host.
