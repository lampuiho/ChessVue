import { describe, expect, it } from 'vitest';

import { ResolvedThemeMode } from '@/contracts';
import { registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('NwjsSystemThemeAdapter', () => {
  it('reads the current system theme from matchMedia', () => {
    const adapter = getPlatformService().getSystemThemeAdapter();

    expect(adapter.getSystemTheme()).toBe(ResolvedThemeMode.Light);
    getEnvironment().mediaQuery.setMatches(true);
    expect(adapter.getSystemTheme()).toBe(ResolvedThemeMode.Dark);
  });
});
