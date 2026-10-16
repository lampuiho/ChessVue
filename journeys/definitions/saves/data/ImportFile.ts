import type { IGame } from '@/contracts';
import { SerializationService } from '@/domain/SerializationService';
import type { IJourneyFile } from '../../../Journey';
import { createImportGame } from './ImportGame';
import corrupt from './invalid/Corrupt.json?raw';

export function createImportFiles(duplicate: IGame): IJourneyFile[] {
  const valid = SerializationService.serialiseGame(createImportGame());
  const unsupported = { ...JSON.parse(valid), schemaVersion: 99 };
  return [
    { path: 'imports/valid.json', raw: valid },
    { path: 'imports/duplicate-id.json', raw: SerializationService.serialiseGame(duplicate) },
    { path: 'imports/corrupt.json', raw: corrupt },
    { path: 'imports/unsupported-version.json', raw: JSON.stringify(unsupported) },
  ];
}
