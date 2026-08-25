import { defineStore } from 'pinia';

import type { IEngineRecord } from '@/contracts';
import { UserSettingService } from '@/domain';

function getInventory(): IEngineRecord[] {
  return UserSettingService.getSettings().analysis.engineInventory;
}

export const useEnginesStore = defineStore('enginesStore', () => {
  function listConfiguredEngines(): IEngineRecord[] {
    return getInventory();
  }
  function getEngine(engineId: string): IEngineRecord | undefined {
    return listConfiguredEngines().find((engine) => engine.id === engineId);
  }
  function validateAnalysisSelection(engineIds: string[]): void {
    const uniqueIds = new Set(engineIds);
    if (uniqueIds.size !== engineIds.length) throw new Error('Analysis engine selection cannot contain duplicates.');
    if (engineIds.length > 4) throw new Error('Analysis engine selection cannot contain more than four engines.');
    const configuredEngineIds = new Set(listConfiguredEngines().map((engine) => engine.id));
    for (const engineId of engineIds) {
      if (!configuredEngineIds.has(engineId)) throw new Error(`Configured engine not found: ${engineId}.`);
    }
  }

  return { listConfiguredEngines, getEngine, validateAnalysisSelection };
});
