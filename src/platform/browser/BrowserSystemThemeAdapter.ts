import { ResolvedThemeMode } from '@/contracts';
import type { ISystemThemeAdapter } from '@/contracts/platform';

export class BrowserSystemThemeAdapter implements ISystemThemeAdapter {
  getSystemTheme(): ResolvedThemeMode {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light;
  }
}
