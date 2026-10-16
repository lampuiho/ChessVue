import { describe, expect, it } from 'vitest';
import { TimeControlPreset } from '@/contracts';
import { createInitialBoardPosition } from '@/utility/chess';
import { createGame } from '../../builders/GameFixtureBuilder';
import { createSettings } from '../../builders/SettingsFixtureBuilder';
import { createEngineProfiles } from '../../data/EngineProfile';
import { createJourney } from '../../index';

describe('journey builder ownership', () => {
  it('does not retain mutable caller board or time-control templates', () => {
    const rootPosition = createInitialBoardPosition();
    const timeControl = { preset: TimeControlPreset.Blitz, initialMs: 300000, incrementMs: 2000 };
    const first = createGame('first', 'First', [], { rootPosition, timeControl });
    const second = createGame('second', 'Second', [], { rootPosition, timeControl });
    first.rootPosition.board[0] = undefined;
    first.timeControl.incrementMs = 999;
    expect(second.rootPosition.board[0]).toEqual(rootPosition.board[0]);
    expect(second.rootPosition.board[0]).toBeDefined();
    expect(second.timeControl.incrementMs).toBe(2000);
    expect(timeControl.incrementMs).toBe(2000);
  });
  it('returns fresh settings and engine options on every invocation', () => {
    const first = createSettings();
    first.analysis.engineInventory[0]!.options.Hash = 999;
    first.gameSession.saveRootPath = 'changed';
    expect(createSettings().analysis.engineInventory[0]!.options.Hash).toBe(16);
    expect(createSettings().gameSession.saveRootPath).toBe('saves');
    const profiles = createEngineProfiles();
    profiles[0]!.options.Hash = 888;
    expect(createEngineProfiles()[0]!.options.Hash).toBe(16);
  });
  it.each(['fresh', 'play', 'history', 'setup', 'promotion', 'saves'])('%s does not share mutable seed files or game IDs', (name) => {
    const first = createJourney(name, 1000);
    const second = createJourney(name, 1000);
    first.files.push({ path: 'injected.json', raw: 'changed' });
    first.gameIds.push('injected');
    expect(second.files.some((file) => file.path === 'injected.json')).toBe(false);
    expect(second.gameIds).not.toContain('injected');
    expect(createJourney(name, 1000)).toEqual(second);
  });
});
