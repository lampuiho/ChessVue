import { DOMWrapper, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { IGame } from '@/contracts';
import { boot, legalMove } from '../support/UiHarness';
describe('JRN-ANALYSIS-06 stale suggestion boundary', () => {
  it('rejects an obsolete prefix before its still-legal first move can be committed', async () => {
    const context = await boot('analysis');
    const { games, domain, router } = context;
    const game = games.getGame('analysis-free') as unknown as IGame;
    await router.push('/game/analysis-free');
    await vi.waitFor(() => expect(game.analysis.seats[0]!.lines).toHaveLength(3));
    const stale = game.analysis.seats[0]!.lines[0]!.pv.slice(0, 3);
    await games.makeMove(game, legalMove(context, game, 'g1f3'));
    await games.makeMove(game, legalMove(context, game, context.rules.getUci(stale[1]!)));
    expect(context.rules.isMoveLegal(context.fixtures.getPosition(game, game.renderedPath), stale[0]!)).toBe(true);
    await games.stopAnalysis(game);
    const before = domain.SerializationService.serialiseGame(game);
    const { default: AnalysisPanel } = await import('@/components/AnalysisPanel.vue');
    const panel = new DOMWrapper(document.querySelector('.analysis-panel')).findComponent(AnalysisPanel);
    panel.vm.$emit('moveSelected', stale);
    await flushPromises();
    expect(document.querySelector('.toast')?.textContent).toContain('This suggested move is stale');
    expect(domain.SerializationService.serialiseGame(game)).toBe(before);
    expect(game.renderedPath).toHaveLength(4);
  });
});
