import { getMockNwjs } from './NwjsMockUtility';
import type { INwjsGlobal } from './models';

export type PlatformTarget = 'nwjs';
export type { INwjsGlobal, INwjsWindow, ISpawnedProcess } from './models';

let _nwOverride: INwjsGlobal | null = null;

export function getPlatformTarget(): PlatformTarget {
  return __CHESSVUE_PLATFORM__;
}
export function setNwjsOverride(nw: INwjsGlobal | null): void {
  _nwOverride = nw;
}
export function getNwjs(): INwjsGlobal {
  if (_nwOverride !== null) return _nwOverride;
  if (getPlatformTarget() !== 'nwjs') throw new Error(`Unsupported platform target: ${getPlatformTarget()}.`);
  const globalObject = globalThis as typeof globalThis & { nw?: INwjsGlobal };
  const nw = globalObject.nw ?? getMockNwjs();
  return nw;
}
