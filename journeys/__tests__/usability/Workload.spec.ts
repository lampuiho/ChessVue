import { expect, it } from 'vitest';
import { SerializationService } from '@/domain/SerializationService';
import { createJourney } from '../../index';
import { JourneyFileSystem } from '../../JourneyFileSystem';
import { usabilityWorkload } from '../../definitions/usability/data/UsabilityScenario';
it('owns a repeatable workload whose snapshots and nested history survive round trips and reset', () => {
  const first = createJourney('usability');
  const files = first.files.filter((file) => file.path.startsWith('saves/'));
  expect(files).toHaveLength(usabilityWorkload.snapshots + 1);
  const game = SerializationService.deserialiseGame(files.find((file) => file.path.endsWith('/auto.json'))!.raw);
  const fs = new JourneyFileSystem(sessionStorage, 'usability-fixture', first.files);
  expect(fs.listFiles()).toHaveLength(first.files.length);
  sessionStorage.removeItem('usability-fixture');
  expect(game.livePath).toHaveLength(usabilityWorkload.plies);
  expect(game.renderedPath).toEqual(game.livePath);
  expect(game.moveTree.root.children[0]!.children[1]!.children[1]!.children).toHaveLength(2);
  first.files[0]!.raw = 'changed';
  expect(createJourney('usability').files[0]!.raw).not.toBe('changed');
});
