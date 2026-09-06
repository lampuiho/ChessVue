import { z } from 'zod';

export const enum ThemeMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}
export const themeModes = [ThemeMode.System, ThemeMode.Light, ThemeMode.Dark] as const;

export const enum ResolvedThemeMode {
  Light = 'light',
  Dark = 'dark',
}
export const resolvedThemeModes = [ResolvedThemeMode.Light, ResolvedThemeMode.Dark] as const;

export interface IAppearanceCssVariableMap {
  '--surface-app': string;
  '--surface-panel': string;
  '--surface-dialog': string;
  '--surface-raised': string;
  '--surface-sunken': string;
  '--surface-overlay': string;
  '--surface-highlight': string;
  '--border-subtle': string;
  '--text-primary': string;
  '--text-muted': string;
  '--text-on-accent': string;
  '--text-on-accent-muted': string;
  '--accent': string;
  '--accent-soft': string;
  '--accent-strong': string;
  '--accent-ambient': string;
  '--accent-watermark': string;
  '--accent-shadow': string;
  '--danger': string;
  '--danger-soft': string;
  '--success': string;
  '--success-soft': string;
  '--success-strong': string;
  '--warning': string;
  '--focus-ring': string;
  '--focus-ring-soft': string;
  '--scrollbar-thumb': string;
  '--scrim': string;
  '--shadow-sm-primary-colour': string;
  '--shadow-sm-secondary-colour': string;
  '--shadow-md-primary-colour': string;
  '--shadow-md-secondary-colour': string;
  '--shadow-header-colour': string;
  '--shadow-control-colour': string;
}
export interface IThemeProfileSnapshot {
  readonly displayName: string;
  readonly colourScheme: ResolvedThemeMode;
  readonly cssVariables: Readonly<IAppearanceCssVariableMap>;
}
export interface IAppearanceProjection {
  readonly themeMode: ThemeMode;
  readonly resolvedThemeMode: ResolvedThemeMode;
  readonly lightThemeProfile: IThemeProfileSnapshot;
  readonly darkThemeProfile: IThemeProfileSnapshot;
}
export const themeModeSchema = z.enum(themeModes);
export const resolvedThemeModeSchema = z.enum(resolvedThemeModes);
export const appearanceCssVariableMapSchema = z.object({
  '--surface-app': z.string(),
  '--surface-panel': z.string(),
  '--surface-dialog': z.string(),
  '--surface-raised': z.string(),
  '--surface-sunken': z.string(),
  '--surface-overlay': z.string(),
  '--surface-highlight': z.string(),
  '--border-subtle': z.string(),
  '--text-primary': z.string(),
  '--text-muted': z.string(),
  '--text-on-accent': z.string(),
  '--text-on-accent-muted': z.string(),
  '--accent': z.string(),
  '--accent-soft': z.string(),
  '--accent-strong': z.string(),
  '--accent-ambient': z.string(),
  '--accent-watermark': z.string(),
  '--accent-shadow': z.string(),
  '--danger': z.string(),
  '--danger-soft': z.string(),
  '--success': z.string(),
  '--success-soft': z.string(),
  '--success-strong': z.string(),
  '--warning': z.string(),
  '--focus-ring': z.string(),
  '--focus-ring-soft': z.string(),
  '--scrollbar-thumb': z.string(),
  '--scrim': z.string(),
  '--shadow-sm-primary-colour': z.string(),
  '--shadow-sm-secondary-colour': z.string(),
  '--shadow-md-primary-colour': z.string(),
  '--shadow-md-secondary-colour': z.string(),
  '--shadow-header-colour': z.string(),
  '--shadow-control-colour': z.string(),
});
export const themeProfileSnapshotSchema = z.object({
  displayName: z.string().min(1),
  colourScheme: resolvedThemeModeSchema,
  cssVariables: appearanceCssVariableMapSchema,
});

export const appearanceProjectionSchema = z.object({
  themeMode: themeModeSchema,
  resolvedThemeMode: resolvedThemeModeSchema,
  lightThemeProfile: themeProfileSnapshotSchema,
  darkThemeProfile: themeProfileSnapshotSchema,
});
