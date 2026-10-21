import { test, expect } from '../../support/TestEvidence';
import { safetyScenarios } from '../../../journeys/definitions/rules/data/KingSafetyGame';
import { ruleColours, ruleSquare } from '../../../journeys/definitions/rules/data/RuleScenario';
import { playMove } from '../../support/BoardInteraction';
import { expectTargets, openRules, rejectMove } from './RuleAction';
for (const colour of ruleColours) for (const scenario of safetyScenarios) {
  test(`JRN-RULE-04 enforces ${colour} king safety for ${scenario.name} with exact legal targets`, async ({ page }) => {
    await openRules(page, `${scenario.name === 'pinned-en-passant' ? 'pinned-en-passant' : scenario.name}-${colour}`);
    const _sq = (coordinate: string) => ruleSquare(coordinate, colour);
    await expectTargets(page, _sq(scenario.from), scenario.targets.map(_sq));
    await rejectMove(page, _sq(scenario.from), _sq(scenario.illegal));
    if (scenario.name === 'double-check') await expectTargets(page, _sq('e1'), ['d1', 'f1', 'f2'].map(_sq));
    await playMove(page, _sq(scenario.name === 'double-check' ? 'e1' : scenario.from), _sq(scenario.legal));
    await expect(page.locator('.result-badge')).toHaveText(`${colour === 'white' ? 'black' : 'white'} to move`);
  });
}
