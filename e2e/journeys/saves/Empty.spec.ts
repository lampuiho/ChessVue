import { test, expect } from './SaveTest';
import { openJourney } from '../../support/JourneyBootstrap';
import { fileSnapshot } from './SaveAction';
test('JRN-SAVE-16 blocks saving a missing workspace and leaves an empty load route usable', async ({ page }) => {
  await openJourney(page, 'fresh');
  const before = await fileSnapshot(page);
  await page.getByRole('button', { name: /Load game/ }).click();
  await expect(page.getByRole('button', { name: 'Select game', exact: true })).toBeDisabled();
  await expect(page.getByText('No saved games yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.evaluate(() => {
    window.history.pushState({}, '', '/saved-games/save/missing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/saved-games\/save\/missing$/);
  await expect(page.getByText('No active game', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save game', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  expect(await fileSnapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: /Quick game/ })).toBeEnabled();
});
