import { describe, expect, it } from 'vitest';
import { SerializationService } from '@/domain/SerializationService';
import { createJourney } from '../../index';
import { fallbackScenarios, faultVariants, restoredRoutes, runtimeVariants } from '../../definitions/recovery/data/RecoveryScenario';
const variants = ['combined', ...faultVariants, ...fallbackScenarios.map(({ name }) => name), ...runtimeVariants,
  ...restoredRoutes.flatMap(({ name }) => [`restore-${name}-on`, `restore-${name}-off`])];
describe('Recovery persisted variants', () => {
  it('builds fresh isolated canonical game documents and retains explicit invalid overrides', () => {
    for (const variant of variants) {
      const first = createJourney('recovery', 1000, variant);
      const second = createJourney('recovery', 1000, variant);
      expect(first).toEqual(second);
      for (const file of first.files.filter((file) => file.path.startsWith('saves/') && !file.path.includes('recovery-broken'))) {
        const game = SerializationService.deserialiseGame(file.raw);
        expect(SerializationService.deserialiseGame(SerializationService.serialiseGame(game))).toEqual(game);
      }
      for (const file of first.files) file.raw = 'changed';
      expect(createJourney('recovery', 1000, variant)).toEqual(second);
    }
    expect(() => createJourney('recovery', 1000, 'unknown')).toThrow('Unknown recovery variant');
  });
});
