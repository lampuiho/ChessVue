import { describe, expect, it, vi } from 'vitest';
import { boot } from '../support/UiHarness';
describe('JRN-SETTINGS-10 option initialisation', () => {
  it('sends every configured value to UCI and keeps discovered defaults separate', async () => {
    const { stores } = await boot('settings');
    const { getNodeChildProcess } = await import('@/utility/nwjs/NodeUtility');
    const childProcess = getNodeChildProcess();
    const spawn = childProcess.spawn;
    const commands: string[] = [];
    vi.spyOn(childProcess, 'spawn').mockImplementation((...args) => {
      const process = spawn(...args);
      const write = process.stdin!.write.bind(process.stdin);
      vi.spyOn(process.stdin!, 'write').mockImplementation((chunk: any) => {
        commands.push(String(chunk).trim());
        return write(chunk);
      });
      return process;
    });
    const settings = stores.useSettingsStore();
    const profile = settings.draftSettings!.analysis.engineInventory[0]!;
    profile.options = { MultiPV: 2, Ponder: true, AnalyseMode: false, Contempt: -1.5, BookFile: 'book.bin', Empty: '' };
    await settings.applySettings();
    const before = JSON.stringify(settings.settings);
    const metadata = await stores.useEnginesStore().loadOptionMeta(profile.id);
    expect(metadata.find((option) => option.name === 'MultiPV')?.defaultValue).toBe(3);
    expect(metadata.find((option) => option.name === 'Hash')?.defaultValue).toBe(16);
    expect(commands).toEqual(expect.arrayContaining([
      'setoption name MultiPV value 2', 'setoption name Ponder value true', 'setoption name AnalyseMode value false',
      'setoption name Contempt value -1.5', 'setoption name BookFile value book.bin', 'setoption name Empty value',
    ]));
    expect(commands.some((command) => command.startsWith('setoption name Hash'))).toBe(false);
    expect(JSON.stringify(settings.settings)).toBe(before);
  });
});
