import { PlatformTarget } from '@/contracts/platform/PlatformTarget';
import { getMockNwjs } from './NwjsMockUtility';
import type { INwjsGlobal, ISpawnedProcess } from './models';

export { PlatformTarget };
export type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from './models';

let _nwOverride: INwjsGlobal | null = null;
export function getPlatformTarget(): PlatformTarget {
  if (__CHESSVUE_PLATFORM__ !== 'auto') return __CHESSVUE_PLATFORM__;
  const nw = _nwOverride ?? (globalThis as typeof globalThis & { nw?: INwjsGlobal }).nw;
  return nw?.Window ? PlatformTarget.Nwjs : PlatformTarget.Browser;
}
export function setNwjsOverride(nw: INwjsGlobal | null) {
  _nwOverride = nw;
}
export function getNwjs(): INwjsGlobal {
  const platform = getPlatformTarget();
  if (platform !== PlatformTarget.Nwjs) throw new Error(`Unsupported platform target: ${platform}.`);
  if (_nwOverride !== null) return _nwOverride;
  const nw = (globalThis as typeof globalThis & { nw?: INwjsGlobal }).nw;
  return nw ?? getMockNwjs();
}
export function isProcessOpen(process: ISpawnedProcess): boolean {
  return process.exitCode === null && process.signalCode === null;
}
