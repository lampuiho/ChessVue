import type { IGame } from '@/contracts';
import { SerializationService } from '@/domain/SerializationService';
import type { IJourneyFile } from '../Journey';
import { fixtureTimestamp } from '../data/FixtureTimestamp';

export function saveFile(game: IGame, name = 'auto', modifiedAt = Date.parse(fixtureTimestamp)): IJourneyFile {
  return { path: `saves/${game.metadata.id}/${name}.json`, raw: SerializationService.serialiseGame(game), modifiedAt };
}
