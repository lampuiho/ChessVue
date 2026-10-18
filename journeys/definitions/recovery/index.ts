import { createRecoveryWorkspace } from './data/RecoveryWorkspace';
export function create(now: number, variant = 'combined') {
  return createRecoveryWorkspace(variant, now);
}
