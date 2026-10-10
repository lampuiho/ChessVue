import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { EngineAvailability, PlayerColour } from '@/contracts';
import { createAnalysisSeat, createEngineRecord, createMove } from '@/state/__tests__/StateStoreTestUtility';
import AnalysisPanel from '../AnalysisPanel.vue';

describe('AnalysisPanel seats', () => {
  it('selects only the suggested prefix ending at the clicked move', async () => {
    const seat = createAnalysisSeat();
    const moves = [createMove(PlayerColour.White), createMove(PlayerColour.Black)];
    seat.lines = [{ depth: 12, pv: moves }];
    const wrapper = mount(AnalysisPanel, { props: { seats: [seat], showMoves: true } });
    const buttons = wrapper.findAll('.analysis-lines button');
    await buttons[0]!.trigger('click');
    await buttons[1]!.trigger('click');
    expect(wrapper.emitted('moveSelected')).toEqual([[[moves[0]]], [moves]]);
    wrapper.unmount();
  });
  it('renders prepared lines and keeps restored empty assignments manageable', () => {
    const populated = createAnalysisSeat();
    const empty = createAnalysisSeat(createEngineRecord('second', 'Second engine'));
    populated.lines = [{ depth: 12, scoreCp: 30, pv: [createMove(PlayerColour.White)] }];
    populated.assignedEngine.$ = { availability: EngineAvailability.Running, analysisLines: new Map([[4, { depth: 99, pv: [] }]]) };
    const wrapper = mount(AnalysisPanel, { props: { seats: [populated, empty], showMoves: true } });
    expect(wrapper.findAll('.engine-section')).toHaveLength(2);
    expect(wrapper.findAll('.analysis-lines button')).toHaveLength(1);
    expect(wrapper.text()).toContain('d12');
    expect(wrapper.text()).not.toContain('d99');
    expect(wrapper.text()).toContain('Engine unavailable');
    expect(wrapper.text()).not.toContain('No engine assigned');
    expect(wrapper.get<HTMLButtonElement>('[title="Refresh analysis"]').element.disabled).toBe(false);
    wrapper.unmount();
  });
  it('blocks paused move selection while allowing refresh, retry, stop, and removal', async () => {
    const running = createAnalysisSeat();
    const failed = createAnalysisSeat(createEngineRecord('second', 'Second engine'));
    running.lines = [{ depth: 12, pv: [createMove(PlayerColour.White)] }];
    running.assignedEngine.$ = { availability: EngineAvailability.Running, analysisLines: new Map() };
    failed.assignedEngine.$ = { availability: EngineAvailability.Failed, lastError: 'Engine failed', analysisLines: new Map() };
    const wrapper = mount(AnalysisPanel, { props: { seats: [running, failed], showMoves: true, disabled: true, startDisabled: false } });
    expect(wrapper.get<HTMLButtonElement>('.analysis-lines button').element.disabled).toBe(true);
    for (const title of ['Refresh analysis', 'Retry engine', 'Stop engine', 'Remove engine']) {
      const button = wrapper.find<HTMLButtonElement>(`[title="${title}"]`);
      expect(button.element.disabled).toBe(false);
      await button.trigger('click');
    }
    expect(wrapper.emitted('refreshRequested')).toHaveLength(1);
    expect(wrapper.emitted('retryRequested')).toEqual([[1]]);
    expect(wrapper.emitted('stopRequested')).toEqual([[0]]);
    expect(wrapper.emitted('engineRemoveRequested')).toEqual([[0]]);
    await wrapper.setProps({ startDisabled: true });
    expect(wrapper.get<HTMLButtonElement>('[title="Refresh analysis"]').element.disabled).toBe(true);
    expect(wrapper.get<HTMLButtonElement>('[title="Retry engine"]').element.disabled).toBe(true);
    wrapper.unmount();
  });
  it('allows stopping an empty seat while its engine is still starting', async () => {
    const seat = createAnalysisSeat();
    seat.assignedEngine.$ = { availability: EngineAvailability.Starting, analysisLines: new Map() };
    const wrapper = mount(AnalysisPanel, { props: { seats: [seat], disabled: true } });
    expect(wrapper.text()).toContain('Waiting for engine');
    await wrapper.get('[title="Stop engine"]').trigger('click');
    expect(wrapper.emitted('stopRequested')).toEqual([[0]]);
    wrapper.unmount();
  });
  it('retains accepted lines alongside failure feedback without claiming completion after Stop', async () => {
    const seat = createAnalysisSeat();
    seat.lines = [{ depth: 12, pv: [createMove(PlayerColour.White)] }];
    seat.assignedEngine.$ = { availability: EngineAvailability.Failed, lastError: 'Disconnected', analysisLines: new Map() };
    const wrapper = mount(AnalysisPanel, { props: { seats: [seat], showMoves: true } });
    expect(wrapper.text()).toContain('Disconnected');
    expect(wrapper.findAll('.analysis-lines button')).toHaveLength(1);
    seat.assignedEngine.$.availability = EngineAvailability.Ready;
    seat.assignedEngine.$.lastError = undefined;
    await wrapper.setProps({ seats: [seat], showMoves: false });
    expect(wrapper.text()).toContain('Analysis stopped');
    expect(wrapper.text()).not.toContain('Analysis complete');
    wrapper.unmount();
  });
});
