import { Deferred } from '@/utility/async/Deferred';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EngineClientType, EngineOptionType, type IEnginePackage } from '@/contracts';
import { createEngineRecord, createSettingsSnapshot } from './StateStoreTestUtility';

let useEnginesStore: typeof import('..').useEnginesStore;
const domain = {
  EngineRuntimeService: {
    getOptions: vi.fn(),
  },
  UserSettingService: {
    getSettings: vi.fn(),
  },
};

describe('useEnginesStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    domain.EngineRuntimeService.getOptions.mockReset();
    domain.UserSettingService.getSettings.mockReset();
    domain.UserSettingService.getSettings.mockReturnValue(createSettingsSnapshot());
    domain.EngineRuntimeService.getOptions.mockResolvedValue([
      { name: 'Threads', type: EngineOptionType.Integer, defaultValue: 1, minimum: 1, maximum: 1024 },
    ]);
    vi.doMock('@/domain', () => domain);
    ({ useEnginesStore } = await import('..'));
  });

  it('exposes configured engine inventory and validates selections', () => {
    const store = useEnginesStore();
    const engines = store.listConfiguredEngines();

    expect(engines).toBe(domain.UserSettingService.getSettings().analysis.engineInventory);
    expect(engines.map((engine) => engine.id)).toEqual(['engine-a', 'engine-b']);
    expect(store.getEngine('engine-a')?.displayName).toBe('Stockfish');
    expect(() => store.validateAnalysisSelection(['engine-a', 'engine-a'])).toThrow('duplicates');
    expect(() => store.validateAnalysisSelection(['missing'])).toThrow('Configured engine not found');
    expect(() => store.validateAnalysisSelection(['engine-a', 'engine-b'])).not.toThrow();
  });

  it('loads and caches option metadata without changing the configured options', async () => {
    const store = useEnginesStore();
    const engine = store.getEngine('engine-a')!;
    const configuredOptions = engine.options;

    const firstOptions = await store.loadOptionMeta('engine-a');
    const secondOptions = await store.loadOptionMeta('engine-a');

    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledOnce();
    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledWith(engine);
    expect(secondOptions).toBe(firstOptions);
    expect(store.getOptionMeta('engine-a')).toBe(firstOptions);
    expect(engine.options).toBe(configuredOptions);
    expect(engine.options).toEqual({ Threads: 1 });
  });

  it('refreshes cached option metadata on request', async () => {
    const store = useEnginesStore();
    await store.loadOptionMeta('engine-a');
    domain.EngineRuntimeService.getOptions.mockResolvedValue([
      { name: 'Hash', type: EngineOptionType.Integer, defaultValue: 16, minimum: 1, maximum: 4096 },
    ]);

    const options = await store.refreshOptionMeta('engine-a');

    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledTimes(2);
    expect(store.getOptionMeta('engine-a')).toBe(options);
    expect(options[0]?.name).toBe('Hash');
  });

  it('loads metadata for a draft profile before it is saved', async () => {
    const store = useEnginesStore();
    const engine = createEngineRecord('engine-draft', 'Draft Engine');

    const options = await store.loadOptionMeta(engine);

    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledWith(engine);
    expect(store.getOptionMeta(engine)).toBe(options);
    expect(store.getEngine(engine.id)).toBeUndefined();
  });

  it('invalidates cached metadata when the engine launch identity changes', async () => {
    const store = useEnginesStore();
    await store.loadOptionMeta('engine-a');
    store.getEngine('engine-a')!.entryPath = 'stockfish-next.exe';

    expect(store.getOptionMeta('engine-a')).toBeUndefined();
    await store.loadOptionMeta('engine-a');

    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledTimes(2);
    expect(domain.EngineRuntimeService.getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ entryPath: 'stockfish-next.exe' }));
  });

  it('rejects option metadata loading for an unknown profile', async () => {
    const store = useEnginesStore();

    await expect(store.loadOptionMeta('missing')).rejects.toThrow('Configured engine not found');

    expect(domain.EngineRuntimeService.getOptions).not.toHaveBeenCalled();
  });
});

describe('package discovery queue', () => {
  let service: typeof import('@/domain/EnginePackageService').EnginePackageService;
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    vi.doMock('@/domain', () => domain);
    ({ EnginePackageService: service } = await import('@/domain/EnginePackageService'));
    ({ useEnginesStore } = await import('..'));
  });
  afterEach(() => { vi.restoreAllMocks(); });
  it('shares an outstanding read and queues a fresh read behind an intervening installation', async () => {
    const pending = new Deferred<readonly IEnginePackage[]>();
    const list = vi.spyOn(service, 'listPackages').mockReturnValueOnce(pending).mockResolvedValue([]);
    const install = vi.spyOn(service, 'install').mockResolvedValue('engine-files/Test');
    const store = useEnginesStore();
    const first = store.refreshPackages();
    void store.refreshPackages();
    await Promise.resolve();
    expect(list).toHaveBeenCalledOnce();
    const mutation = store.installPackage('Test', { files: [] });
    const later = store.refreshPackages();
    expect(install).not.toHaveBeenCalled();
    pending.resolve([]);
    await Promise.all([first, mutation, later]);
    expect(install).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledTimes(3);
  });
  it('reports committed installation separately from failed rediscovery and recovers on refresh', async () => {
    vi.spyOn(service, 'install').mockResolvedValue('engine-files/Test');
    const list = vi.spyOn(service, 'listPackages').mockRejectedValueOnce(new Error('Read failed.')).mockResolvedValue([]);
    const store = useEnginesStore();
    await expect(store.installPackage('Test', { files: [] })).rejects.toMatchObject({ operation: 'refreshEnginePackagesAfterInstall', detail: 'engine-files/Test' });
    await store.refreshPackages();
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('reads removal references when its queued mutation starts', async () => {
    const pending = new Deferred<readonly IEnginePackage[]>();
    vi.spyOn(service, 'listPackages').mockReturnValueOnce(pending).mockResolvedValue([]);
    const remove = vi.spyOn(service, 'remove').mockResolvedValue(undefined);
    const references = [{ displayName: 'Draft', clientType: EngineClientType.UciWorker, entryPath: 'engine-files/Test/main.js' }];
    const read = vi.fn(() => references);
    const store = useEnginesStore();
    const refresh = store.refreshPackages();
    const mutation = store.removePackage('engine-files/Test', read);
    expect(read).not.toHaveBeenCalled();
    pending.resolve([]);
    await Promise.all([refresh, mutation]);
    expect(read).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('engine-files/Test', references);
  });
});
