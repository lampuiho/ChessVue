import { ResolvedThemeMode, ThemeMode, type IAppearanceProjection, type ISettingsSnapshot } from '@/contracts';

const lightVariables = {
  '--surface-app': '#f4efe3',
  '--surface-panel': '#fffaf0',
  '--surface-dialog': '#fffdf7',
  '--border-subtle': '#d6c7a7',
  '--text-primary': '#2f2617',
  '--text-muted': '#6c5d43',
  '--accent': '#b6692d',
  '--danger': '#a53030',
  '--focus-ring': '#d18a2f',
} satisfies IAppearanceProjection['cssVariables'];
const darkVariables = {
  '--surface-app': '#171b1f',
  '--surface-panel': '#222931',
  '--surface-dialog': '#29323b',
  '--border-subtle': '#465465',
  '--text-primary': '#eef2f6',
  '--text-muted': '#b2bfcb',
  '--accent': '#d7a24d',
  '--danger': '#f06b6b',
  '--focus-ring': '#f2c46d',
} satisfies IAppearanceProjection['cssVariables'];

export function resolveThemeMode(settings: ISettingsSnapshot, systemTheme: ResolvedThemeMode): ResolvedThemeMode {
  switch (settings.appearance.themeMode) {
    case ThemeMode.Light: return ResolvedThemeMode.Light;
    case ThemeMode.Dark: return ResolvedThemeMode.Dark;
    default: return systemTheme;
  }
}
export function buildAppearanceProjection(settings: ISettingsSnapshot, resolvedThemeMode: ResolvedThemeMode): IAppearanceProjection {
  return {
    themeMode: settings.appearance.themeMode,
    resolvedThemeMode,
    cssVariables: resolvedThemeMode === ResolvedThemeMode.Dark ? { ...darkVariables } : { ...lightVariables },
  };
}
