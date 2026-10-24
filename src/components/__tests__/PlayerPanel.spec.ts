import { mount } from '@vue/test-utils';
import { nextTick, reactive, shallowReactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { EngineAvailability, PlayerColour, PlayerType, type IEnginePlayer } from '@/contracts';
import { createAssignedEngine, createGame } from '@/state/__tests__/StateStoreTestUtility';
import PlayerPanel from '@/components/PlayerPanel.vue';

const dependency = vi.hoisted(() => ({ game: undefined as ReturnType<typeof createGame> | undefined, open: vi.fn() }));
vi.mock('@/state', () => ({ useGamesStore: () => ({ getGame: () => dependency.game }) }));
vi.mock('@/composables/ModalComposable', () => ({ useModal: () => ({ open: dependency.open }) }));
describe('PlayerPanel engine status', () => {
  it('updates failure and recovery feedback directly from its engine runtime', async () => {
    const engine = createAssignedEngine();
    const runtime = engine.$ = shallowReactive({ availability: EngineAvailability.Starting, lastError: undefined as string | undefined, analysisLines: new Map() });
    const player: IEnginePlayer = { colour: PlayerColour.Black, type: PlayerType.Engine, displayName: 'Engine', assignedEngine: engine };
    dependency.game = reactive(createGame());
    dependency.game.blackPlayer = player;
    const wrapper = mount(PlayerPanel, { props: { colour: PlayerColour.Black, gameId: dependency.game.metadata.id } });
    expect(wrapper.get('.engine-state').text()).toBe('starting');
    runtime.availability = EngineAvailability.Failed;
    runtime.lastError = 'Engine unavailable. Choose another player.';
    await nextTick();
    expect(wrapper.find('.engine-state').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain('Engine unavailable');
    runtime.availability = EngineAvailability.Ready;
    runtime.lastError = undefined;
    await nextTick();
    expect(wrapper.get('.engine-state').text()).toBe('ready');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
