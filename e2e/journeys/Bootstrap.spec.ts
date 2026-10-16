import { test, expect } from '../support/TestEvidence';
import { openJourney } from '../support/JourneyBootstrap';
import registry from '../../journeys/Catalogue.json' with { type: 'json' };

for (const name of Object.keys(registry)) {
  test('boots the ' + name + ' journey in a browser', async ({ page }) => {
    await openJourney(page, name);
    if (name === 'analysis') await expect(page.locator('.analysis-line')).toHaveCount(6);
  });
}
