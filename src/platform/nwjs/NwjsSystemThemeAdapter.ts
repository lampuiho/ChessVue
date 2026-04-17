import { defineStore } from 'pinia';

import { ResolvedThemeMode } from '@/contracts';
import type { ISystemThemeAdapter } from '@/contracts/platform';
import type { INwjsGlobal } from '@/utility/nwjs/NwjsUtility';

export function defineNwjsSystemThemeAdapterStore(_nw: INwjsGlobal) {
  return defineStore('nwjsSystemThemeAdapter', () => {
    function getSystemTheme(): ResolvedThemeMode {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? ResolvedThemeMode.Dark : ResolvedThemeMode.Light;
    }

    const systemThemeAdapter = { getSystemTheme } satisfies ISystemThemeAdapter;
    return systemThemeAdapter;
  });
}
