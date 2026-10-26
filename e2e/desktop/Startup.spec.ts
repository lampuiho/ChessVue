import { test, expect } from './DesktopTest';

test('disables geolocation in the native app', async ({ desktop }) => {
  const response = await desktop.page.request.get(desktop.page.url());
  expect(response.headers()['permissions-policy']).toBe('geolocation=()');
  const result = await desktop.page.evaluate(() => new Promise<{ code: number; message: string }>(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ code: 0, message: 'Unexpected location access' }),
      error => resolve({ code: error.code, message: error.message }),
      { timeout: 1000 },
    );
  }));
  expect(result.code).toBe(1);
  expect(result.message).toContain('permissions policy');
});
