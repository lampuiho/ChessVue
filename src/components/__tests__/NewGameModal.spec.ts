import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { PlayerType, TimeControlPreset, type ICreateGameRequest } from '@/contracts';
import { createEngineRecord, createSettingsSnapshot } from '@/state/__tests__/StateStoreTestUtility';
import NewGameModal from '../NewGameModal.vue';

let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());
function submitButton(): HTMLButtonElement {
  return wrapper.get<HTMLButtonElement>('[form="new-game-form"]').element;
}
describe('custom game validation', () => {
  it.each(['', '-1', '0', '601'])('blocks invalid custom minutes %s before emitting a request', async (minutes) => {
    wrapper = mount(NewGameModal, { props: { settings: createSettingsSnapshot(), engines: [] } });
    await wrapper.get('#time-preset').setValue('custom');
    await wrapper.get('input[type="number"]').setValue(minutes);
    await wrapper.get('form').trigger('submit');
    expect(submitButton().disabled).toBe(true);
    expect(wrapper.get('[role="alert"]').text()).toContain('minutes');
    expect(wrapper.emitted('createRequested')).toBeUndefined();
  });
  it('preserves independently unassigned seats and valid custom clocks', async () => {
    wrapper = mount(NewGameModal, { props: { settings: createSettingsSnapshot(), engines: [] } });
    await wrapper.get('#black-player').setValue('none');
    await wrapper.get('#time-preset').setValue('custom');
    await wrapper.get('input[type="number"]').setValue('7');
    await wrapper.findAll('input[type="number"]')[1]!.setValue('3');
    await wrapper.get('form').trigger('submit');
    const request = wrapper.emitted('createRequested')![0]![0] as ICreateGameRequest;
    expect(request.whitePlayer?.type).toBe(PlayerType.Local);
    expect(request.blackPlayer).toBeUndefined();
    expect(request.timeControl).toEqual({ initialMs: 420000, incrementMs: 3000 });
    expect(request.showLiveAnalysisMoves).toBe(true);
  });
  it('requires an engine selection when the default engine is missing', async () => {
    const settings = createSettingsSnapshot();
    settings.gameDefaults.defaultWhitePlayerType = PlayerType.Engine;
    wrapper = mount(NewGameModal, { props: { settings, engines: [] } });
    expect(submitButton().disabled).toBe(true);
    expect(wrapper.get<HTMLSelectElement>('#white-player').element.value).toBe('engine:');
    const engine = createEngineRecord();
    await wrapper.setProps({ engines: [engine] });
    await wrapper.get('#white-player').setValue(`engine:${engine.id}`);
    expect(submitButton().disabled).toBe(false);
    await wrapper.get('form').trigger('submit');
    const request = wrapper.emitted('createRequested')![0]![0] as ICreateGameRequest;
    expect(request.whitePlayer?.type).toBe(PlayerType.Engine);
  });
  it('keeps engine defaults assigned and rejects unavailable required profiles', async () => {
    const settings = createSettingsSnapshot();
    settings.gameDefaults.defaultBlackPlayerType = PlayerType.Engine;
    settings.gameDefaults.defaultTimeControl.preset = TimeControlPreset.Untimed;
    const engine = createEngineRecord();
    wrapper = mount(NewGameModal, { props: { settings, engines: [engine] } });
    expect(wrapper.get<HTMLSelectElement>('#black-player').element.value).toBe(`engine:${engine.id}`);
    await wrapper.setProps({ engines: [{ ...engine, executablePath: '' }] });
    await wrapper.get('form').trigger('submit');
    expect(submitButton().disabled).toBe(true);
    expect(wrapper.emitted('createRequested')).toBeUndefined();
  });
});
