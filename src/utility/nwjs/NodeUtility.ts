import { getMockNodeChildProcess, getMockNodeFs, getMockNodePath } from './NwjsMockUtility';

type NodeRequire = <T = unknown>(moduleName: string) => T;
interface INodeModuleOverrides {
  url?: typeof import('node:url');
  fs: typeof import('node:fs');
  path: typeof import('node:path');
  childProcess: Pick<typeof import('node:child_process'), 'spawn'>;
}
let _overrides: INodeModuleOverrides | undefined;
export function setNodeModuleOverrides(overrides?: INodeModuleOverrides) {
  _overrides = overrides;
}

function _getNodeRequire(): NodeRequire | undefined {
  const globalObject = globalThis as typeof globalThis & { require?: NodeRequire };
  return globalObject.require;
}
function _getNodeModule<T>(moduleName: string): T | undefined {
  const requireFunction = _getNodeRequire();
  if (!requireFunction) return;
  try {
    return requireFunction<T>(moduleName);
  } catch (error) {
    console.error(`[NodeUtility] Failed to load node module "${moduleName}".`, error);
    throw error;
  }
}

export function getNodeFs(): typeof import('node:fs') {
  return _overrides?.fs ?? _getNodeModule<typeof import('node:fs')>('fs') ?? getMockNodeFs();
}
export function getNodePath(): typeof import('node:path') {
  return _overrides?.path ?? _getNodeModule<typeof import('node:path')>('path') ?? getMockNodePath();
}
export function getNodeChildProcess(): Pick<typeof import('node:child_process'), 'spawn'> {
  return _overrides?.childProcess ?? _getNodeModule<typeof import('node:child_process')>('child_process') ?? getMockNodeChildProcess();
}

export function getNodeUrl(): typeof import('node:url') {
  const module = _overrides?.url ?? _getNodeModule<typeof import('node:url')>('url');
  if (!module) throw new Error('Node URL support is unavailable on this host.');
  return module;
}
