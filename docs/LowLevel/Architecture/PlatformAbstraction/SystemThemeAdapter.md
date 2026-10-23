# SystemThemeAdapter

## Browser Adaptation
`BrowserSystemThemeAdapter` reads `prefers-color-scheme` through `matchMedia`. The browser platform attaches a theme listener only when an explicit consumer requests that capability, and detaches it when disposed. App and SettingsStore do not request it; CSS owns application system-theme selection.

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
- CSS `color-scheme` and `light-dark()` own application theme selection. SettingsStore exposes the accepted policy and both palettes without reading or subscribing to the OS theme.
- Theme-change notifications are registered through `IPlatformService`, not through `SystemThemeAdapter`.
- The adapter exposes built-in theme resolution only. It does not introduce a custom-theme registry or any user-authored theme payloads.
- The rewrite-phase mock should provide deterministic light or dark responses so theme-resolution flows can be tested without a real desktop host.
