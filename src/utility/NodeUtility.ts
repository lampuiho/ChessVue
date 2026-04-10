import { getMockProcessNodeModules, getMockStorageNodeModules } from './NwjsMockUtility';

interface IFileDialogInput extends HTMLInputElement {
  oncancel: ((this: GlobalEventHandlers, ev: Event) => any) | null;
}
type NodeRequire = <T = unknown>(moduleName: string) => T;
type IInputFactory = (document: Document) => IFileDialogInput;

let _fsOverride: typeof import('node:fs') | null = null;
let _pathOverride: typeof import('node:path') | null = null;
let _documentOverride: Document | null = null;
let _inputFactoryOverride: IInputFactory | null = null;
let _childProcessOverride: Pick<typeof import('node:child_process'), 'spawn'> | null = null;

function _getNodeRequire(): NodeRequire | null {
  const globalObject = globalThis as typeof globalThis & { require?: NodeRequire };
  return globalObject.require ?? null;
}
function _getMockStorageModules() {
  return getMockStorageNodeModules(document);
}

export function setNwjsFsOverride(fs: typeof import('node:fs') | null): void {
  _fsOverride = fs;
}
export function setNwjsPathOverride(path: typeof import('node:path') | null): void {
  _pathOverride = path;
}
export function setNwjsDocumentOverride(documentOverride: Document | null): void {
  _documentOverride = documentOverride;
}
export function setNwjsInputFactoryOverride(inputFactory: IInputFactory | null): void {
  _inputFactoryOverride = inputFactory;
}
export function setNwjsChildProcessOverride(childProcess: Pick<typeof import('node:child_process'), 'spawn'> | null): void {
  _childProcessOverride = childProcess;
}
export function getNodeFs(): typeof import('node:fs') {
  if (_fsOverride !== null) return _fsOverride;
  const requireFunction = _getNodeRequire();
  if (requireFunction === null) return _getMockStorageModules().fs;
  return requireFunction<typeof import('node:fs')>('fs');
}
export function getNodePath(): typeof import('node:path') {
  if (_pathOverride !== null) return _pathOverride;
  const requireFunction = _getNodeRequire();
  if (requireFunction === null) return _getMockStorageModules().path;
  return requireFunction<typeof import('node:path')>('path');
}
export function getNodeDocument(): Document {
  if (_documentOverride !== null) return _documentOverride;
  return document;
}
export function createNwjsFileInput(document: Document): IFileDialogInput {
  if (_inputFactoryOverride !== null) return _inputFactoryOverride(document);
  const requireFunction = _getNodeRequire();
  if (requireFunction === null) return _getMockStorageModules().createInput(document);
  return document.createElement('input') as IFileDialogInput;
}
export function getNodeChildProcess(): Pick<typeof import('node:child_process'), 'spawn'> {
  if (_childProcessOverride !== null) return _childProcessOverride;
  const requireFunction = _getNodeRequire();
  if (requireFunction === null) return getMockProcessNodeModules().childProcess;
  return requireFunction<typeof import('node:child_process')>('child_process');
}
