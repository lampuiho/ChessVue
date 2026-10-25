import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerType, TimeControlPreset, type ICreateGameRequest, type IEngineRecord } from '@/contracts';
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
    settings.gameDefaults.defaultWhitePlayerType = PlayerType.Engine;
    wrapper = _mount(settings);
    expect(_submitButton().disabled).toBe(true);
    expect(wrapper.get<HTMLSelectElement>('#white-player').element.value).toBe('engine:');
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
  it('keeps engine defaults assigned and rejects unavailable required profiles', async () => {
    const settings = createSettingsSnapshot();
    settings.gameDefaults.defaultBlackPlayerType = PlayerType.Engine;
    settings.gameDefaults.defaultTimeControl.preset = TimeControlPreset.Untimed;
    const engine = createEngineRecord();
    wrapper = _mount(settings, [engine]);
    expect(wrapper.get<HTMLSelectElement>('#black-player').element.value).toBe(`engine:${engine.id}`);
    dependency.settings.settings.analysis.engineInventory = [{ ...engine, entryPath: '' }];
    await nextTick();
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(_submitButton().disabled).toBe(true);
    expect(dependency.games.createGame).not.toHaveBeenCalled();
  });
});

it('keeps creation failures retryable without navigating or closing, then completes once', async () => {
  const settings = createSettingsSnapshot();
  settings.gameDefaults.defaultWhitePlayerType = PlayerType.Engine;
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
