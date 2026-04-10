import { getPlatformTarget, getNwjs } from '@/utility/NwjsUtility';

import { defineNwjsPlatformServiceStore } from './nwjs/NwjsPlatformService';

function _resolveNw() {
  return getNwjs();
}
export const usePlatformService = (() => {
  const platform = getPlatformTarget();
  switch (platform) {
    case 'nwjs': {
      const nw = _resolveNw();
      return defineNwjsPlatformServiceStore(nw);
    }
    default: throw new Error(`${platform} not supported.`);
  }
})();
