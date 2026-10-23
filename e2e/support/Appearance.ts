import { expect, type Page } from '@playwright/test';
import { defaultDarkThemeProfile, defaultLightThemeProfile } from '../../src/config/AppearanceConfig';
export async function expectTheme(page: Page, theme: 'light' | 'dark') {
  const profile = theme === 'light' ? defaultLightThemeProfile : defaultDarkThemeProfile;
  const colour = Number.parseInt(profile.cssVariables['--surface-app'].slice(1), 16);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(' + (colour >> 16) + ', ' + ((colour >> 8) & 255) + ', ' + (colour & 255) + ')');
}
