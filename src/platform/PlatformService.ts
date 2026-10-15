import { getPlatformTarget, getNwjs, PlatformTarget } from '@/utility/nwjs/NwjsUtility';
import { useBrowserPlatformService } from './browser/BrowserPlatformService';
import { defineNwjsPlatformServiceStore } from './nwjs/NwjsPlatformService';

export const usePlatformService = (() => {
  switch (getPlatformTarget()) {
    case PlatformTarget.Nwjs: return defineNwjsPlatformServiceStore(getNwjs());
    case PlatformTarget.Browser: return useBrowserPlatformService;
  }
})();
