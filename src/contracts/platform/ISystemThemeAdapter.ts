import type { ResolvedThemeMode } from '../Appearance';

export interface ISystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode;
}
