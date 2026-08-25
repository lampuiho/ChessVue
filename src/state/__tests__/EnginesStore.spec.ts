import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSettingsSnapshot } from './StateStoreTestUtility';

let useEnginesStore: typeof import('..').useEnginesStore;
const domain = {
  UserSettingService: {
    getSettings: vi.fn(),
  },
};

describe('useEnginesStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    setActivePinia(createPinia());
    domain.UserSettingService.getSettings.mockReset();
    domain.UserSettingService.getSettings.mockReturnValue(createSettingsSnapshot());
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
});
