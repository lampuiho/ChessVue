import type { IJourneySeed } from '../../Journey';
import { createStorageWorkspace } from './data/StorageWorkspace';
export function create(_now: number, variant?: string): IJourneySeed {
  const seed = createStorageWorkspace();
  if (variant === 'startup-session') seed.storageFaults = [{ operation: 'writeTextFile', path: 'game-session.json' }];
  return seed;
}
