import { test, expect } from './UsabilityTest';
import { installWorkloadProbe, readResources } from './WorkloadProbe';
import { exerciseHistory, exerciseRoutes, exerciseEngine } from './WorkloadAction';
import { openJourney } from '../../support/JourneyBootstrap';
import { saveCurrentGame } from '../../support/GameSave';
import { usabilityWorkload } from '../../../journeys/definitions/usability/data/UsabilityScenario';
test('JRN-UX-04 establishes a sustained workload baseline without accumulating sessions or listeners', async ({ page }, testInfo) => {
  await installWorkloadProbe(page);
  await openJourney(page, 'usability');
  await exerciseHistory(page);
  await exerciseRoutes(page, 0);
  await exerciseEngine(page);
  const baseline = await readResources(page);
  expect(baseline).toMatchObject({ activeProcesses: 0, processListeners: 0, pendingSearches: 0, pendingTimers: 0, openGames: 1, tabs: 0 });
  const samples: { historyMs: number; routesMs: number; engineMs: number }[] = [];
  for (let cycle = 0; cycle < usabilityWorkload.cycles; cycle++) {
    const start = performance.now();
    await exerciseHistory(page);
    const history = performance.now();
    await exerciseRoutes(page, cycle);
    const routes = performance.now();
    await exerciseEngine(page);
    samples.push({ historyMs: history - start, routesMs: routes - history, engineMs: performance.now() - routes });
    await expect.poll(() => readResources(page)).toEqual(baseline);
  }
  const game = await saveCurrentGame(page, 'After sustained workload');
  expect(game.livePath).toHaveLength(usabilityWorkload.plies);
  expect(game.renderedPath).toEqual(game.livePath);
  expect(game.analysis.seats).toHaveLength(0);
  await testInfo.attach('workload-baseline', { body: JSON.stringify({ workload: usabilityWorkload, viewport: page.viewportSize(), baseline, final: await readResources(page), samples }, null, 2), contentType: 'application/json' });
});
