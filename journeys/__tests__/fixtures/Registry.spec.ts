import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import registry from '../../Catalogue.json';
import { loadJourneyCatalogue } from '../../CatalogueLoader.mjs';
import { loadJourneyCases, repositoryRoot } from '../../coverage/CaseRegistry.mjs';
import { journeyCatalogue } from '../../index';

describe('modular journey discovery', () => {
  it('loads the same catalogue in CLI and browser without embedding descriptions in the registry', () => {
    const catalogue = loadJourneyCatalogue(registry, (path) => JSON.parse(readFileSync(resolve('journeys', path), 'utf8')));
    expect(catalogue).toEqual(journeyCatalogue);
    for (const [name, path] of Object.entries(registry)) {
      expect(path).toBe(`./definitions/${name}/Description.json`);
      expect(catalogue[name]!.title).toBeTruthy();
    }
    expect(() => loadJourneyCatalogue(registry, () => undefined)).toThrow('Invalid journey description');
  });
  it('resolves every migrated case, data, review, scenario, branch and spec reference', () => {
    const source = readFileSync('docs/HighLevel/scenarios.md', 'utf8');
    const cases = loadJourneyCases();
    expect(cases.map((entry) => entry.id).sort()).toEqual([
      ...Array.from({ length: 12 }, (_, index) => `JRN-ANALYSIS-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `JRN-BROWSER-0${index + 1}`),
      ...Array.from({ length: 12 }, (_, index) => `JRN-CLOCK-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 9 }, (_, index) => `JRN-FRESH-0${index + 1}`),
      ...Array.from({ length: 9 }, (_, index) => `JRN-HIST-0${index + 1}`),
      ...Array.from({ length: 8 }, (_, index) => `JRN-IO-0${index + 1}`),
      ...Array.from({ length: 12 }, (_, index) => `JRN-PLAY-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 5 }, (_, index) => `JRN-PROMO-0${index + 1}`),
      ...Array.from({ length: 9 }, (_, index) => `JRN-RACE-0${index + 1}`),
      ...Array.from({ length: 8 }, (_, index) => `JRN-RECOVERY-0${index + 1}`),
      ...Array.from({ length: 6 }, (_, index) => `JRN-RULE-0${index + 1}`),
      ...Array.from({ length: 16 }, (_, index) => `JRN-SAVE-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 4 }, (_, index) => `JRN-SESSION-0${index + 1}`),
      ...Array.from({ length: 11 }, (_, index) => `JRN-SETTINGS-${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 9 }, (_, index) => `JRN-SETUP-0${index + 1}`),
      ...Array.from({ length: 4 }, (_, index) => `JRN-UX-0${index + 1}`),
    ]);
    for (const entry of cases) {
      if (entry.lane === 'ordinary-browser') {
        expect(entry.fixture).toBe('browser');
        expect(entry.tests.every((test) => test.project === 'browser')).toBe(true);
        expect(entry.tests.every((test) => !test.spec.startsWith('e2e/journeys/'))).toBe(true);
      } else expect(Object.keys(registry)).toContain(entry.fixture);
      for (const scenario of entry.scenarios) expect(source).toContain(`### ${scenario} -`);
      for (const branch of entry.branches) {
        const owningFlows = source.split(/^### /m).filter((flow) => entry.scenarios.some((scenario) => flow.startsWith(scenario + ' -')));
        expect(owningFlows.some((flow) => flow.includes('`' + branch + '`'))).toBe(true);
      }
      expect(readFileSync(resolve(repositoryRoot, entry.scenarioReview.split('#')[0]!), 'utf8')).toContain(`## ${entry.id}`);
      for (const test of entry.tests) expect(readFileSync(test.spec, 'utf8')).toContain(entry.id);
    }
  });
});
