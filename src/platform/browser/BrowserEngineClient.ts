import { defineUciEngineClientStore } from '../uci/UciEngineClient';
import type { BrowserEngineRegistry } from './BrowserProcessManager';

export function defineBrowserUciEngineClientStore(registry: BrowserEngineRegistry) {
  return defineUciEngineClientStore('browserUciEngineClient', (handle) => registry.get(handle));
}
