# SystemThemeAdapter

## Purpose
Expose host system-theme detection without leaking host globals into stores or presentation code.

## Public Interface
```ts
// src/contracts/platform/ISystemThemeAdapter.ts
interface ISystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode;
}
```

## Responsibilities
- report the current host theme as one of the built-in resolved themes, `ResolvedThemeMode.Light` or `ResolvedThemeMode.Dark`
- stay at the host-capability boundary only; it does not persist settings or choose how components style themselves

## Dependencies
- `window.matchMedia('(prefers-color-scheme: dark)')`, available in both the NW.js window and the browser

## Concrete Implementations
- NW.js: `defineNwjsSystemThemeAdapterStore(nw)` in `src/platform/nwjs/NwjsSystemThemeAdapter.ts` defines the `nwjsSystemThemeAdapter` Pinia store. It receives the shared `nw` object for composition symmetry but reads the theme from `window.matchMedia('(prefers-color-scheme: dark)')`, which reflects the operating-system appearance inside NW.js.
- Browser: `BrowserSystemThemeAdapter` in `src/platform/browser/BrowserSystemThemeAdapter.ts` is a plain class using the same media query.
- Theme-change notifications are registered through `IPlatformService.subscribeToSystemThemeChanged(...)`, not through this adapter. Both platform stores attach their media-query `change` listener only on the first subscription and detach it at store-scope disposal.

## Notes
- CSS `color-scheme` and `light-dark()` own application system-theme selection. `App.vue` applies the accepted theme policy and both palettes as CSS variables, and `SettingsStore` exposes the accepted policy and palettes. Neither queries nor subscribes to the OS theme. **Why:** the earlier reactive theme subscription required a watcher-driven effect; CSS already follows the host appearance in system mode without JavaScript, and explicit settings events apply accepted changes. See [CodeCleanupPlan](../../../ArchivedPlans/CodeCleanupPlan.md#watcher-disposition).
- `UserSettingService.getSystemTheme()` is the layer-2 path to this adapter. It is retained as an explicit platform capability; application styling does not call it.
- The adapter exposes built-in theme resolution only. It does not introduce a custom-theme registry or user-authored theme payloads.
