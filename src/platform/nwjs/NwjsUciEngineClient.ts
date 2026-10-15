import type { ProcessHandle } from '@/contracts/platform';
import type { INwjsGlobal, ISpawnedProcess } from '@/utility/nwjs/NwjsUtility';
import { defineUciEngineClientStore } from '../uci/UciEngineClient';
import type { IUciTransport } from '../uci/IUciTransport';
import type { INwjsProcessRegistry } from './NwjsProcessRegistry';
import { attachProcessLineListeners, writeProcessLine } from './NwjsProcessLineUtility';

export function defineNwjsUciEngineClientStore(_nw: INwjsGlobal, processRegistry: INwjsProcessRegistry) {
  const transports = new WeakMap<ISpawnedProcess, IUciTransport>();
  function resolveTransport(handle: ProcessHandle): IUciTransport | undefined {
    const process = processRegistry.get(handle);
    if (!process) return;
    let transport = transports.get(process);
    if (!transport) {
      transport = {
        write: (command) => writeProcessLine(process, handle, command),
        subscribe: (onLine, onExit) => attachProcessLineListeners(process, onLine, (code, signal) => onExit(`code=${code ?? 'null'} signal=${signal ?? 'null'}`)),
      };
      transports.set(process, transport);
    }
    return transport;
  }
  return defineUciEngineClientStore('nwjsUciEngineClient', resolveTransport);
}
