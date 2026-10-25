import { expect, type Page } from '@playwright/test';
import type { ISettingsSnapshot } from '../../src/contracts';
import { waitForJourney } from './JourneyBootstrap';

export async function configureEngines(page: Page, profiles: { name: string; path: string }[]) {
  // Scripted native profiles are fixture data; the browser editor offers Worker profiles.
  await page.evaluate(async profiles => {
    const modulePath = '/src/domain/UserSettingService.ts';
    const { UserSettingService } = await import(modulePath);
    const settings = structuredClone(UserSettingService.getSettings()) as ISettingsSnapshot;
    settings.analysis.engineInventory = settings.analysis.engineInventory.filter(profile => profile.id !== 'stockfish');
    for (const profile of profiles) settings.analysis.engineInventory.push({ id: crypto.randomUUID(), displayName: profile.name, entryPath: profile.path, clientType: 'uci' as ISettingsSnapshot['analysis']['engineInventory'][number]['clientType'], options: {} });
    await UserSettingService.saveSettings(settings);
  }, profiles);
  await page.reload();
  await waitForJourney(page);
  await expect(page).toHaveURL(/\/(home|game\/[^/]+)$/);
}
