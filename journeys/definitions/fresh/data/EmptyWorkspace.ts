import type { IJourneySeed } from '../../../Journey';

export function createEmptyWorkspace(): IJourneySeed {
  return { files: [], gameIds: [], activeRoute: '/home' };
}
