import { expect, type Locator, type Page } from '@playwright/test';
export async function keyboardReach(page: Page, control: Locator, backwards = false) {
  await expect(control).toBeVisible();
  for (let step = 0; step < 220; step++) {
    if (await control.evaluate((element) => element === document.activeElement)) {
      await expect(control).toBeFocused();
      return;
    }
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`Keyboard could not reach ${await control.getAttribute('aria-label') ?? await control.textContent()}.`);
}
export async function keyboardActivate(page: Page, control: Locator, backwards = false) {
  await keyboardReach(page, control, backwards);
  await expectVisibleFocus(control);
  await page.keyboard.press('Enter');
}
export async function expectVisibleFocus(control: Locator) {
  expect(await control.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none';
  }), 'Keyboard focus has a visible ring or shadow').toBe(true);
}
export async function expectFocusInside(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
}
export async function expectFocusCycle(page: Page, dialog: Locator) {
  const buttons = dialog.getByRole('button');
  const first = buttons.first();
  const last = buttons.last();
  await keyboardReach(page, last);
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
}
