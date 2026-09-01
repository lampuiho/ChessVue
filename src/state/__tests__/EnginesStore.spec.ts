import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EngineOptionType } from '@/contracts';
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
    store.getEngine('engine-a')!.executablePath = 'stockfish-next.exe';

    expect(store.getOptionMeta('engine-a')).toBeUndefined();
    await store.loadOptionMeta('engine-a');

    expect(domain.EngineRuntimeService.getOptions).toHaveBeenCalledTimes(2);
    expect(domain.EngineRuntimeService.getOptions).toHaveBeenLastCalledWith(expect.objectContaining({ executablePath: 'stockfish-next.exe' }));
  });

  it('rejects option metadata loading for an unknown profile', async () => {
    const store = useEnginesStore();

    await expect(store.loadOptionMeta('missing')).rejects.toThrow('Configured engine not found');

    expect(domain.EngineRuntimeService.getOptions).not.toHaveBeenCalled();
  });
});
