# Appearance Types

## Purpose
Define the low-level appearance contracts that turn persisted theme preferences into presentation-safe theme state.

## Interfaces
- `type ThemeMode`
- `type ResolvedThemeMode`
- `interface IAppearanceCssVariableMap`
- `interface IAppearanceProjection`

## Data Structures
```ts
type ThemeMode = "system" | "light" | "dark"

type ResolvedThemeMode = "light" | "dark"

interface IAppearanceCssVariableMap {
  "--surface-app": string
  "--surface-panel": string
  "--surface-dialog": string
  "--border-subtle": string
  "--text-primary": string
  "--text-muted": string
  "--accent": string
  "--danger": string
  "--focus-ring": string
}

interface IAppearanceProjection {
  themeMode: ThemeMode
  resolvedThemeMode: ResolvedThemeMode
  cssVariables: IAppearanceCssVariableMap
}
```

## Rules
- `themeMode` is the persisted user choice from settings.
- `resolvedThemeMode` is the effective built-in theme after `system` mode has been mapped to the current OS theme.
- `cssVariables` is the semantic app-chrome variable map derived from the resolved theme and any other committed appearance configuration that affects shared UI chrome.
- The semantic variable contract must remain stable so future user-created themes can supply values without requiring component-specific behaviour changes.
- App theme variables style shared UI chrome only; board and piece appearance remain separate concerns.
