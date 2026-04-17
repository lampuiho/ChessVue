import { ResolvedThemeMode } from '@/contracts';
import type { IPlatformEventRegistration } from '@/contracts/platform';
import { usePlatformService } from '@/platform';

export const PlatformEventService = {
  subscribeToAppCloseRequested(owner: string, onCloseRequested: () => Promise<void> | void, debugLabel?: string): () => void {
    return usePlatformService().subscribeToAppCloseRequested(owner, onCloseRequested, debugLabel);
  },
  subscribeToAppFocusReturned(owner: string, onFocusReturned: () => Promise<void> | void, debugLabel?: string): () => void {
    return usePlatformService().subscribeToAppFocusReturned(owner, onFocusReturned, debugLabel);
  },
  subscribeToSystemThemeChanged(owner: string, onChanged: (theme: ResolvedThemeMode) => void, debugLabel?: string): () => void {
    return usePlatformService().subscribeToSystemThemeChanged(owner, onChanged, debugLabel);
  },
  getEventRegistrationSnapshot(): IPlatformEventRegistration[] {
    return usePlatformService().getEventRegistrationSnapshot();
  },
};
