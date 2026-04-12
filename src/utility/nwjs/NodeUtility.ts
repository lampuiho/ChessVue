import { getMockNodeChildProcess, getMockNodeFs, getMockNodePath } from './NwjsMockUtility';

type NodeRequire = <T = unknown>(moduleName: string) => T;

function _getNodeRequire(): NodeRequire | null {
  const globalObject = globalThis as typeof globalThis & { require?: NodeRequire };
  return globalObject.require ?? null;
}
function _getNodeModule<T>(moduleName: string): T | null {
  const requireFunction = _getNodeRequire();
  if (requireFunction === null) return null;
  try {
    return requireFunction<T>(moduleName);
  } catch (error) {
    console.error(`[NodeUtility] Failed to load node module "${moduleName}".`, error);
    throw error;
  }
}

export function getNodeFs(): typeof import('node:fs') {
  return _getNodeModule<typeof import('node:fs')>('fs') ?? getMockNodeFs();
}
export function getNodePath(): typeof import('node:path') {
  return _getNodeModule<typeof import('node:path')>('path') ?? getMockNodePath();
}
export function getNodeChildProcess(): Pick<typeof import('node:child_process'), 'spawn'> {
  return _getNodeModule<typeof import('node:child_process')>('child_process') ?? getMockNodeChildProcess();
}
