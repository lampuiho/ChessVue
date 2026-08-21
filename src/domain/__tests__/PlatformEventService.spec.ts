import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IPlatformEventRegistration } from '@/contracts/platform';
import { RegistrationTimestamp } from '@/utility/date';

let PlatformEventService: typeof import('..').PlatformEventService;
const subscribeToAppCloseRequested = vi.fn();
const subscribeToAppFocusReturned = vi.fn();
const subscribeToSystemThemeChanged = vi.fn();
const getEventRegistrationSnapshot = vi.fn<() => IPlatformEventRegistration[]>();

describe('PlatformEventService', () => {
  beforeEach(async () => {
    vi.resetModules();
    subscribeToAppCloseRequested.mockReset();
    subscribeToAppFocusReturned.mockReset();
    subscribeToSystemThemeChanged.mockReset();
    getEventRegistrationSnapshot.mockReset();
    subscribeToAppCloseRequested.mockReturnValue(() => undefined);
    subscribeToAppFocusReturned.mockReturnValue(() => undefined);
    subscribeToSystemThemeChanged.mockReturnValue(() => undefined);
    getEventRegistrationSnapshot.mockReturnValue([{
      registrationId: 'theme-1',
      eventKey: 'systemThemeChanged',
      owner: 'settings',
      registeredAtUtc: new RegistrationTimestamp('2026-04-17T12:00:00.000Z'),
    } as IPlatformEventRegistration]);
    vi.doMock('@/platform', () => ({
      usePlatformService: () => ({
        subscribeToAppCloseRequested,
        subscribeToAppFocusReturned,
        subscribeToSystemThemeChanged,
        getEventRegistrationSnapshot,
      }),
    }));
    ({ PlatformEventService } = await import('..'));
  });

  it('delegates event subscriptions through the mocked platform service', () => {
    const onCloseRequested = vi.fn();
    const onFocusReturned = vi.fn();
    const onThemeChanged = vi.fn();
    const unsubscribeClose = PlatformEventService.subscribeToAppCloseRequested('games', onCloseRequested, 'close-handler');
    const unsubscribeFocus = PlatformEventService.subscribeToAppFocusReturned('games', onFocusReturned, 'focus-handler');
    const unsubscribeTheme = PlatformEventService.subscribeToSystemThemeChanged('settings', onThemeChanged, 'theme-handler');

    expect(subscribeToAppCloseRequested).toHaveBeenCalledWith('games', onCloseRequested, 'close-handler');
    expect(subscribeToAppFocusReturned).toHaveBeenCalledWith('games', onFocusReturned, 'focus-handler');
    expect(subscribeToSystemThemeChanged).toHaveBeenCalledWith('settings', onThemeChanged, 'theme-handler');
    expect(typeof unsubscribeClose).toBe('function');
    expect(typeof unsubscribeFocus).toBe('function');
    expect(typeof unsubscribeTheme).toBe('function');
  });

  it('returns the registration snapshot from the mocked platform service', () => {
    expect(PlatformEventService.getEventRegistrationSnapshot()).toEqual([{
      registrationId: 'theme-1',
      eventKey: 'systemThemeChanged',
      owner: 'settings',
      registeredAtUtc: new RegistrationTimestamp('2026-04-17T12:00:00.000Z'),
    }]);
  });
});
