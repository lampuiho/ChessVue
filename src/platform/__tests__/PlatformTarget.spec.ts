import { EngineClientType } from '@/contracts/Engine';
import { createPinia, disposePinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNwjs, getPlatformTarget, PlatformTarget, setNwjsOverride } from '@/utility/nwjs/NwjsUtility';
import { getMockNwjs } from '@/utility/nwjs/NwjsMockUtility';

afterEach(() => {
  setNwjsOverride(null);
  vi.unstubAllGlobals();
});
describe('platform selection', () => {
  it('selects browser without NW.js globals and rejects access to NW.js', () => {
    vi.stubGlobal('nw', undefined);
    expect(getPlatformTarget()).toBe(PlatformTarget.Browser);
    expect(() => getNwjs()).toThrow('Unsupported platform target: browser.');
    expect(getPlatformTarget()).toBe(PlatformTarget.Browser);
  });
  it('selects NW.js automatically and prefers its real runtime over the mock', () => {
    const nw = { Window: { get: vi.fn() } };
    vi.stubGlobal('nw', nw);
    expect(getPlatformTarget()).toBe(PlatformTarget.Nwjs);
    expect(getNwjs()).toBe(nw);
  });
  it('runs the NW.js adapters with an explicit mock host and no NW.js installation', async () => {
    vi.resetModules();
    vi.stubGlobal('nw', undefined);
    vi.stubGlobal('require', undefined);
    const nwjsUtility = await import('@/utility/nwjs/NwjsUtility');
    nwjsUtility.setNwjsOverride(getMockNwjs());
    const { usePlatformService } = await import('@/platform');
    const pinia = createPinia();
    try {
      const platform = usePlatformService(pinia);
      const storage = platform.getStorageAdapter();
      await storage.writeTextFile('mock-platform-check.json', 'mocked NW.js', { overwrite: true });
      expect(await storage.readTextFile('mock-platform-check.json')).toBe('mocked NW.js');
      await storage.deleteFile('mock-platform-check.json');
      const processes = platform.getProcessManager(EngineClientType.Uci);
      const handle = await processes.spawnProcess('mock-engine');
      expect(() => processes.assertProcessOpen(handle)).not.toThrow();
      await processes.stopProcess(handle);
      expect(() => processes.assertProcessOpen(handle)).toThrow();
    } finally {
      nwjsUtility.setNwjsOverride(null);
      disposePinia(pinia);
    }
  });
  it('prefers an explicit NW.js override over the real runtime', () => {
    const nw = { Window: { get: vi.fn() } };
    vi.stubGlobal('nw', { Window: { get: vi.fn() } });
    setNwjsOverride(nw);
    expect(getPlatformTarget()).toBe(PlatformTarget.Nwjs);
    expect(getNwjs()).toBe(nw);
  });
});
