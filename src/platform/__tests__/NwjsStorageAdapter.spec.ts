import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SerializationService } from '@/domain';
import { PlatformErrorKind } from '@/contracts';
import { createPersistedGame, normaliseTestPath, registerNwjsPlatformTestEnvironment } from './NwjsPlatformTestUtility';

const { getEnvironment: getTestEnvironment, getPlatformService } = registerNwjsPlatformTestEnvironment();

describe('NwjsStorageAdapter', () => {
  it('handles storage operations with documented failure semantics', async () => {
    const environment = getTestEnvironment();
    const storage = getPlatformService().getStorageAdapter();
    const gameDirectory = path.join(environment.rootPath, 'saves', 'game-1');
    const savePath = path.join(gameDirectory, 'auto.json');

    await storage.ensureDirectory(gameDirectory);
    await storage.writeTextFile(savePath, '{"ok":true}');
    await expect(storage.writeTextFile(savePath, '{}')).rejects.toMatchObject({ kind: PlatformErrorKind.AlreadyExists });
    expect(await storage.readTextFile(savePath)).toBe('{"ok":true}');
    const entries = await storage.listDirectory(gameDirectory);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe('auto.json');

    environment.queueDialogSelection(path.join(environment.rootPath, 'exports', 'game-1.json'));
    expect(await storage.showSaveDialog(savePath)).toContain('game-1.json');
  });
  it('routes persisted file operations through SerializationService', async () => {
    const environment = getTestEnvironment();
    const storage = getPlatformService().getStorageAdapter();
    const saveRoot = path.join(environment.rootPath, 'saves');
    const gameDirectory = path.join(saveRoot, 'game-1');
    const autosavePath = path.join(gameDirectory, 'auto.json');
    const sessionPath = path.join(environment.rootPath, 'game-session.json');
    const layoutPath = path.join(environment.rootPath, 'layout-state.json');
    const sessionSnapshot = {
      schemaVersion: 1,
      openGameIds: ['game-1'],
      activeGameId: 'game-1',
      activeRoute: '/game/game-1' as const,
    };
    const layoutState = {
      schemaVersion: 1,
      showHistoryPanel: true,
      showAnalysisPanel: true,
      historyCollapsed: false,
      analysisCollapsed: false,
      analysisEngineExpandedByIndex: [true, false],
    };

    await storage.ensureDirectory(gameDirectory);
    await SerializationService.writeGameSessionDocument(sessionPath, sessionSnapshot);
    await SerializationService.writeUiLayoutDocument(layoutPath, layoutState);
    await storage.writeTextFile(autosavePath, '{"schemaVersion":1}', { overwrite: true });
    expect(await SerializationService.readGameSessionDocument(sessionPath)).toEqual(sessionSnapshot);
    expect(await SerializationService.readUiLayoutDocument(layoutPath)).toEqual(layoutState);
    const entriesByDirectory = await SerializationService.listManagedSaveEntries(saveRoot);
    const normalisedGameDirectory = normaliseTestPath(gameDirectory);
    expect(entriesByDirectory.get(saveRoot)?.[0]).toMatchObject({ path: normalisedGameDirectory, name: 'game-1', isDirectory: true });
    expect(entriesByDirectory.get(normalisedGameDirectory)?.[0]).toMatchObject({ path: normaliseTestPath(autosavePath), name: 'auto.json', isDirectory: false });

    environment.queueDialogSelection(path.join(environment.rootPath, 'exports', 'game-1.json'));
    expect(await SerializationService.selectExportFile(autosavePath)).toContain('game-1.json');
    environment.queueDialogSelection(autosavePath);
    expect(await SerializationService.selectImportFile(saveRoot)).toContain('auto.json');
  });
  it('creates managed-save parent folders through SerializationService when writing a game document', async () => {
    const environment = getTestEnvironment();
    const savePath = path.join(environment.rootPath, 'saves', 'game-1', 'auto.json');

    await SerializationService.writeGameDocument(savePath, createPersistedGame(), true);

    expect(await getPlatformService().getStorageAdapter().readTextFile(savePath)).toContain('"schemaVersion": 1');
  });
});
