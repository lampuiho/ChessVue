import { describe, expect, it } from 'vitest';

import { EngineOptionType } from '@/contracts';
import { parseOptionLines } from '@/utility/UciUtility';

describe('UciUtility', () => {
  it('parses UCI option lines into protocol-neutral option metadata', () => {
    expect(parseOptionLines([
      'id name Example Engine',
      'option name Clear Hash type button',
      'option name Ponder type check default false',
      'option name Style type combo default Normal Play var Normal Play var Risky',
      'option name Threads type spin default 1 min 1 max 1024',
      'option name Evaluation File type string default example network.nnue',
      'uciok',
    ])).toEqual([
      { name: 'Clear Hash', type: EngineOptionType.Action },
      { name: 'Ponder', type: EngineOptionType.Boolean, defaultValue: false },
      { name: 'Style', type: EngineOptionType.Choice, defaultValue: 'Normal Play', choices: ['Normal Play', 'Risky'] },
      { name: 'Threads', type: EngineOptionType.Integer, defaultValue: 1, minimum: 1, maximum: 1024 },
      { name: 'Evaluation File', type: EngineOptionType.Text, defaultValue: 'example network.nnue' },
    ]);
  });
  it('rejects malformed UCI option metadata', () => {
    expect(() => parseOptionLines(['option name Threads type spin default one min 1 max 8'])).toThrow('Invalid UCI integer option default');
    expect(() => parseOptionLines(['option name Ponder type unknown'])).toThrow('Unsupported UCI option type');
  });
});
