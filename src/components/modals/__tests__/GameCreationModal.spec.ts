import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerColour, PlayerType, TimeControlPreset, type ICreateGameRequest, type IEngineRecord, type IEnginePlayer } from '@/contracts';
import { createEnginePlayer } from '@/utility/GameCreationUtility';
import { createEngineRecord, createGame, createSettingsSnapshot } from '@/state/__tests__/StateStoreTestUtility';
import { reactive, nextTick } from 'vue';
import { EngineRuntimeService } from '@/domain';
import { Deferred } from '@/utility/async/Deferred';
import GameCreationModal from '@/components/modals/GameCreationModal.vue';

const dependency = vi.hoisted(() => ({})) as ReturnType<typeof _dependencies>;
vi.mock('@/state', () => ({ useGamesStore: () => dependency.games, useSettingsStore: () => dependency.settings, useEnginesStore: () => dependency.engines, useUiStateStore: () => dependency.ui }));
vi.mock('vue-router', () => ({ useRouter: () => dependency.router }));
vi.mock('@/domain', async (original) => {
  const actual = await original<typeof import('@/domain')>();
  return { ...actual, EngineRuntimeService: { ...actual.EngineRuntimeService, getOptions: vi.fn(async () => []) } };
});
function _dependencies() {
  const snapshot = createSettingsSnapshot();
  const settings = reactive({ settings: snapshot, draftSettings: snapshot });
  return { settings, router: { push: vi.fn(async () => {}) }, ui: { openTab: vi.fn() },
    engines: { listConfiguredEngines: () => settings.settings.analysis.engineInventory },
    games: { getGame: vi.fn(() => createGame()), createGame: vi.fn(async (_request: ICreateGameRequest) => createGame()), startGameFromSetup: vi.fn(async () => {}) },
  };
}
function _mount(settings = createSettingsSnapshot(), engines: IEngineRecord[] = []) {
  settings.analysis.engineInventory = engines;
  dependency.settings.settings = settings;
  dependency.settings.draftSettings = settings;
  return mount(GameCreationModal, { props: { signal: new AbortController().signal } });
}
beforeEach(() => { Object.assign(dependency, _dependencies()); vi.clearAllMocks(); });
let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());
function _submitButton(): HTMLButtonElement {
  return wrapper.get<HTMLButtonElement>('[form="new-game-form"]').element;
}
describe('custom game validation', () => {
  it('collects Player 1 and Player 2 with random colours and leaves the draw to creation', async () => {
    wrapper = _mount();
    const toggle = wrapper.findAll('.toggle-row').find(row => row.text().includes('Randomly assign colours'))!.get('input');
    await toggle.setValue(true);
    expect(wrapper.get('#white-player').attributes('aria-label')).toBe('Player 1');
    expect(wrapper.get('#black-player').attributes('aria-label')).toBe('Player 2');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(dependency.games.createGame.mock.calls[0]![0]).toMatchObject({ randomiseColours: true, whitePlayer: { colour: PlayerColour.White }, blackPlayer: { colour: PlayerColour.Black } });
  });
  it('disables random colours when a player is unassigned', async () => {
    wrapper = _mount();
    await wrapper.get('#black-player').setValue('none');
    const toggle = wrapper.findAll('.toggle-row').find(row => row.text().includes('Randomly assign colours'))!.get<HTMLInputElement>('input');
    expect(toggle.element.disabled).toBe(true);
  });
  it.each(['', '-1', '0', '601'])('blocks invalid custom minutes %s before starting creation', async (minutes) => {
    wrapper = _mount();
    await wrapper.get('#time-preset').setValue('custom');
    await wrapper.get('input[type="number"]').setValue(minutes);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(_submitButton().disabled).toBe(true);
    expect(wrapper.get('[role="alert"]').text()).toContain('minutes');
    expect(dependency.games.createGame).not.toHaveBeenCalled();
  });
  it('preserves independently unassigned seats and valid custom clocks', async () => {
    wrapper = _mount();
    await wrapper.get('#black-player').setValue('none');
    await wrapper.get('#time-preset').setValue('custom');
    await wrapper.get('input[type="number"]').setValue('7');
    await wrapper.findAll('input[type="number"]')[1]!.setValue('3');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = dependency.games.createGame.mock.calls[0]![0];
    expect(request.whitePlayer?.type).toBe(PlayerType.Local);
    expect(request.blackPlayer).toBeUndefined();
    expect(request.timeControl).toEqual({ initialMs: 420000, incrementMs: 3000 });
    expect(request.showLiveAnalysisMoves).toBe(true);
  });
  it('requires an engine selection when the default engine is missing', async () => {
    const settings = createSettingsSnapshot();
    settings.gameDefaults.whitePlayer = createEnginePlayer({ ...createEngineRecord(), entryPath: '' }, PlayerColour.White);
    wrapper = _mount(settings);
    expect(_submitButton().disabled).toBe(true);
    expect(wrapper.get<HTMLSelectElement>('#white-player').element.value).toBe('keep');
    const engine = createEngineRecord();
    dependency.settings.settings.analysis.engineInventory = [engine];
    await nextTick();
    await wrapper.get('#white-player').setValue(`engine:${engine.id}`);
    expect(_submitButton().disabled).toBe(false);
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = dependency.games.createGame.mock.calls[0]![0];
    expect(request.whitePlayer?.type).toBe(PlayerType.Engine);
  });
  it('keeps the saved engine configuration after the inventory changes', async () => {
    const settings = createSettingsSnapshot();
    settings.gameDefaults.timeControl.preset = TimeControlPreset.Untimed;
    const engine = createEngineRecord();
    settings.gameDefaults.blackPlayer = createEnginePlayer(engine, PlayerColour.Black);
    wrapper = _mount(settings, [engine]);
    expect(wrapper.get<HTMLSelectElement>('#black-player').element.value).toBe('keep');
    dependency.settings.settings.analysis.engineInventory = [{ ...engine, entryPath: '' }];
    await nextTick();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(_submitButton().disabled).toBe(false);
    expect((dependency.games.createGame.mock.calls[0]![0].blackPlayer as IEnginePlayer).assignedEngine.entryPath).toBe(engine.entryPath);
  });
  it('uses accepted snapshot defaults with a custom clock and no surviving source profiles', async () => {
    const settings = createSettingsSnapshot();
    const engine = createEngineRecord();
    settings.gameDefaults.blackPlayer = createEnginePlayer(engine, PlayerColour.Black);
    settings.gameDefaults.analysisEngineProfiles = [engine];
    settings.gameDefaults.timeControl = { initialMs: 420000, incrementMs: 3000 };
    settings.gameDefaults.allowTakeback = false;
    settings.gameDefaults.showLiveAnalysisMoves = true;
    wrapper = _mount(settings);
    dependency.settings.draftSettings = { ...settings, gameDefaults: { ...settings.gameDefaults, name: 'Unsaved name' } };
    expect(wrapper.get<HTMLInputElement>('#game-name').element.value).toBe('New Game');
    expect(wrapper.get<HTMLSelectElement>('#time-preset').element.value).toBe('custom');
    await wrapper.get('input[type="number"]').setValue('8');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    const request = dependency.games.createGame.mock.calls[0]![0];
    expect(request).toMatchObject({ allowTakeback: false, showLiveAnalysisMoves: true, timeControl: { initialMs: 480000, incrementMs: 3000 }, analysisEngineProfiles: [engine] });
    expect(settings.gameDefaults.timeControl.initialMs).toBe(420000);
    expect((request.blackPlayer as IEnginePlayer).assignedEngine).not.toBe((settings.gameDefaults.blackPlayer as IEnginePlayer).assignedEngine);
  });
});

it('keeps creation failures retryable without navigating or closing, then completes once', async () => {
  const settings = createSettingsSnapshot();
  settings.gameDefaults.whitePlayer = createEnginePlayer(createEngineRecord(), PlayerColour.White);
  wrapper = _mount(settings, [createEngineRecord()]);
  vi.mocked(EngineRuntimeService.getOptions).mockRejectedValueOnce(new Error('Unavailable'));
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(wrapper.text()).toContain('Choose another player engine');
  expect(dependency.games.createGame).not.toHaveBeenCalled();
  expect(wrapper.emitted('dismissed')).toBeUndefined();
  await wrapper.get('form').trigger('submit');
  await flushPromises();
  expect(dependency.games.createGame).toHaveBeenCalledOnce();
  expect(dependency.ui.openTab).toHaveBeenCalledWith('game-1');
  expect(dependency.router.push).toHaveBeenCalledWith('/game/game-1');
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
});
it('prevents a second submit while the mounted creation action is pending', async () => {
  wrapper = _mount();
  const pending = new Deferred<ReturnType<typeof createGame>>();
  dependency.games.createGame.mockReturnValueOnce(pending);
  await wrapper.get('form').trigger('submit');
  await wrapper.get('form').trigger('submit');
  expect(dependency.games.createGame).toHaveBeenCalledOnce();
  expect(_submitButton().disabled).toBe(true);
  pending.resolve(createGame());
  await flushPromises();
  expect(wrapper.emitted('dismissed')).toHaveLength(1);
});
