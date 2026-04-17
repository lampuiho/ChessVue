import type { IGame } from '@/contracts';
import type { ISavedGameGroup } from '@/contracts/domain';
import { SavedGameIndexService, SerializationService } from '@/domain';

function createDuplicateId(existingGameIds: ReadonlySet<string>, requestedId: string): string {
  if (!existingGameIds.has(requestedId)) return requestedId;
  let suffix = 2;
  while (existingGameIds.has(`${requestedId}-${suffix}`)) suffix += 1;
  return `${requestedId}-${suffix}`;
}

export async function listManagedSaveGroups(rootPath: string): Promise<ISavedGameGroup[]> {
  return SavedGameIndexService.projectSaveGroups(rootPath, await SerializationService.listManagedSaveEntries(rootPath));
}
export async function readGameDocument(filePath: string): Promise<IGame> {
  return SerializationService.readGameDocument(filePath);
}
export async function writeGameDocument(filePath: string, game: IGame, overwrite: boolean = false): Promise<void> {
  await SerializationService.writeGameDocument(filePath, game, overwrite);
}
export function repairDuplicateGameId(game: IGame, existingGameIds: ReadonlySet<string>): IGame {
  const nextId = createDuplicateId(existingGameIds, game.metadata.id);
  if (nextId === game.metadata.id) return structuredClone(game);
  return {
    ...structuredClone(game),
    metadata: {
      ...structuredClone(game.metadata),
      id: nextId,
      updatedAt: new Date().toISOString(),
    },
  };
}
