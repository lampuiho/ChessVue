import type { IJourneySeed } from '../Journey';
export function create(): IJourneySeed {
  return { files: [], gameIds: [], activeRoute: '/home' };
}
