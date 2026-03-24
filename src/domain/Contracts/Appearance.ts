import { z } from 'zod'
import { themeModeSchema, type ThemeMode } from './Settings'

export const enum ResolvedThemeMode {
  Light = 'light',
  Dark = 'dark',
}
export const resolvedThemeModes = [ResolvedThemeMode.Light, ResolvedThemeMode.Dark] as const

export interface IAppearanceCssVariableMap {
  '--surface-app': string
  '--surface-panel': string
  '--surface-dialog': string
  '--border-subtle': string
  '--text-primary': string
  '--text-muted': string
  '--accent': string
  '--danger': string
  '--focus-ring': string
}

export interface IAppearanceProjection {
  themeMode: ThemeMode
  resolvedThemeMode: ResolvedThemeMode
  cssVariables: IAppearanceCssVariableMap
}

export const resolvedThemeModeSchema = z.enum(resolvedThemeModes)
export const appearanceCssVariableMapSchema = z.object({
  '--surface-app': z.string(),
  '--surface-panel': z.string(),
  '--surface-dialog': z.string(),
  '--border-subtle': z.string(),
  '--text-primary': z.string(),
  '--text-muted': z.string(),
  '--accent': z.string(),
  '--danger': z.string(),
  '--focus-ring': z.string(),
})

export const appearanceProjectionSchema = z.object({
  themeMode: themeModeSchema,
  resolvedThemeMode: resolvedThemeModeSchema,
  cssVariables: appearanceCssVariableMapSchema,
})
