import { getMockNwjs } from './NwjsMockUtility';

export type PlatformTarget = 'nwjs';

export interface INwjsWindow {
  on(eventName: string, listener: (...args: any[]) => void): void;
  removeListener(eventName: string, listener: (...args: any[]) => void): void;
  hide(): void;
  close(force?: boolean): void;
}
export interface INwjsGlobal {
  Window: {
    get(windowObject?: Window): INwjsWindow;
  };
}
export interface ISpawnedProcess {
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  once(eventName: string, listener: (...args: any[]) => void): this;
  on(eventName: string, listener: (...args: any[]) => void): this;
  removeListener(eventName: string, listener: (...args: any[]) => void): this;
  kill(signal?: NodeJS.Signals | number): boolean;
}

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
