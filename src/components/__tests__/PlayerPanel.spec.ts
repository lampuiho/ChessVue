import { mount } from '@vue/test-utils';
import { nextTick, shallowReactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { EngineAvailability, PlayerColour, PlayerType, type IEnginePlayer } from '@/contracts';
import { createAssignedEngine } from '@/state/__tests__/StateStoreTestUtility';
import PlayerPanel from '../PlayerPanel.vue';

describe('PlayerPanel engine status', () => {
  it('updates failure and recovery feedback directly from its engine runtime', async () => {
    const engine = createAssignedEngine();
    const runtime = engine.$ = shallowReactive({ availability: EngineAvailability.Starting, lastError: undefined as string | undefined, analysisLines: new Map() });
    const player: IEnginePlayer = { colour: PlayerColour.Black, type: PlayerType.Engine, displayName: 'Engine', assignedEngine: engine };
    const wrapper = mount(PlayerPanel, { props: { colour: PlayerColour.Black, player } });
    expect(wrapper.get('.engine-state').text()).toBe('starting');
    runtime.availability = EngineAvailability.Failed;
    runtime.lastError = 'Engine unavailable. Choose another player.';
    await nextTick();
    expect(wrapper.get('.engine-state').text()).toBe('failed');
    expect(wrapper.get('[role="alert"]').text()).toContain('Engine unavailable');
    runtime.availability = EngineAvailability.Ready;
    runtime.lastError = undefined;
    await nextTick();
    expect(wrapper.get('.engine-state').text()).toBe('ready');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
