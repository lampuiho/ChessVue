# Appearance Types

## Purpose
Define the low-level appearance contracts that turn persisted theme preferences into presentation-safe theme state. Sources: `contracts/Appearance.ts` and the built-in profiles in `config/AppearanceConfig.ts`.

## Interfaces
- `enum ThemeMode`
- `enum ResolvedThemeMode`
- `interface IAppearanceCssVariableMap`
- `interface IThemeProfileSnapshot`
- `interface IAppearanceProjection`

## Data Structures
```ts
const enum ThemeMode {
  System = "system",
  Light = "light",
  Dark = "dark"
}

const enum ResolvedThemeMode {
  Light = "light",
  Dark = "dark"
}

interface IAppearanceCssVariableMap {
  "--surface-app": string
  "--surface-panel": string
  "--surface-dialog": string
  "--surface-raised": string
  "--surface-sunken": string
  "--surface-overlay": string
  "--surface-highlight": string
  "--border-subtle": string
  "--text-primary": string
  "--text-muted": string
  "--text-on-accent": string
  "--text-on-accent-muted": string
  "--accent": string
  "--accent-soft": string
  "--accent-strong": string
  "--accent-ambient": string
  "--accent-watermark": string
  "--accent-shadow": string
  "--danger": string
  "--danger-soft": string
  "--success": string
  "--success-soft": string
  "--success-strong": string
  "--warning": string
  "--focus-ring": string
  "--focus-ring-soft": string
  "--scrollbar-thumb": string
  "--scrim": string
  "--shadow-sm-primary-colour": string
  "--shadow-sm-secondary-colour": string
  "--shadow-md-primary-colour": string
  "--shadow-md-secondary-colour": string
  "--shadow-header-colour": string
  "--shadow-control-colour": string
}

interface IThemeProfileSnapshot {
  readonly displayName: string
  readonly colourScheme: ResolvedThemeMode
  readonly cssVariables: Readonly<IAppearanceCssVariableMap>
}

interface IAppearanceProjection {
  readonly themeMode: ThemeMode
  readonly lightThemeProfile: IThemeProfileSnapshot
  readonly darkThemeProfile: IThemeProfileSnapshot
}
```

## Schemas
- `themeModes` and `resolvedThemeModes` feed `themeModeSchema` and `resolvedThemeModeSchema`.
- `appearanceCssVariableMapSchema` requires every semantic variable as a string. `themeProfileSnapshotSchema` adds a non-empty `displayName` and a resolved `colourScheme`. `appearanceProjectionSchema` validates the projection.

## Built-In Profiles
`config/AppearanceConfig.ts` exports `defaultLightThemeProfile` (`displayName: "Light"`, `colourScheme: light`) and `defaultDarkThemeProfile` (`displayName: "Dark"`, `colourScheme: dark`), each with a complete `IAppearanceCssVariableMap`. They are the only profiles in the baseline: `SettingsStore.appearanceProjection` pairs them with the accepted `themeMode`, `App.vue` falls back to them before settings load, and the Settings theme picker previews their colours.

## Rules
- `themeMode` is the persisted user choice from settings.
- System mode leaves CSS `color-scheme: light dark` active. Explicit light/dark settings override the colour scheme; `light-dark()` selects the corresponding palette without JavaScript OS-theme resolution.
- `App.vue` applies an accepted projection through an explicit appearance action: it writes each profile's map as `--theme-light-<name>` and `--theme-dark-<name>` properties on the document root, sets `data-theme-mode` (which the global stylesheet uses to force `color-scheme: light` or `dark`), and updates the `color-scheme` and `theme-color` meta tags. `base.css` defines each semantic variable as `light-dark(var(--theme-light-<name>), var(--theme-dark-<name>))`.
- `ResolvedThemeMode` is also the result type of the platform system-theme adapter and `SystemThemeChanged` event. App styling does not query or subscribe to them; CSS owns system-theme selection.
- The configured light and dark profile snapshots each contain the complete semantic app-chrome variable map for their declared colour scheme.
- Theme profiles are not part of the baseline user-settings snapshot. `IAppearanceProjection` is the seam that can later receive independently selected light and dark snapshots without changing presentation components.
- A profile snapshot has no profile ID and requires no registry lookup to render.
- Profile snapshots and their CSS-variable maps are readonly. Consumers retain their references and do not defensively clone them when projecting or rendering.
- A future profile editor owns mutable draft fields independently from its readonly base snapshot and publishes a replacement snapshot only on acceptance. It does not clone the base snapshot merely to begin editing.
- `IAppearanceProjection` exposes both configured snapshot references. CSS owns light/dark selection through the document colour scheme instead of receiving only the currently resolved palette.
- The semantic variable contract must remain stable so future user-created themes can supply values without requiring component-specific behaviour changes.
- App theme variables style shared UI chrome only; board and piece appearance remain separate concerns.
