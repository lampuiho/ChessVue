import { describe, expect, it } from 'vitest';
import type { IJourneyCase } from '../../coverage/JourneyCoverage';
import { aggregateCaseResults } from '../../coverage/CoverageReport.mjs';

const entry: IJourneyCase = {
  id: 'JRN-FRESH-01', priority: 'P0', scenarios: ['SCN-SESSION-01'], branches: [], fixture: 'fresh', lane: 'seeded-browser',
  implementation: 'available', scenarioReview: 'review.md', data: [], remaining: [],
  tests: [{ spec: 'e2e/journeys/fresh/Creation.spec.ts', titles: ['JRN-FRESH-01 first branch', 'JRN-FRESH-01 second branch'] }],
};
function report(status = 'expected', results = [{ status: 'passed' }], projectName = 'journeys') {
  return { config: { rootDir: '/repo/e2e' }, errors: [], suites: [{ suites: [{ specs: entry.tests[0]!.titles.map((title) => ({
    file: 'journeys/fresh/Creation.spec.ts', title, tests: [{ projectName, expectedStatus: 'passed', status, results }],
  })) }] }] };
}
describe('journey coverage execution evidence', () => {
  it('does not turn metadata, discovery or missing variants into passes', () => {
    expect(aggregateCaseResults([entry], undefined, '/repo')[0]!.execution).toBe('unverified');
    const discovered = report('skipped', []);
    expect(aggregateCaseResults([entry], discovered, '/repo')[0]!.execution).toBe('unverified');
    const partial = report();
    partial.suites[0]!.suites[0]!.specs.pop();
    const result = aggregateCaseResults([entry], partial, '/repo')[0]!;
    expect(result.execution).toBe('unverified');
    expect(result.missing).toEqual(['JRN-FRESH-01 second branch']);
  });
  it('requires every named variant to pass in the journey project', () => {
    expect(aggregateCaseResults([entry], report(), '/repo')[0]!.execution).toBe('passed');
    expect(aggregateCaseResults([entry], report('expected', [{ status: 'passed' }], 'browser'), '/repo')[0]!.execution).toBe('unverified');
  });
  it('keeps failed and retry-dependent executions distinct from passes', () => {
    expect(aggregateCaseResults([entry], report('unexpected', [{ status: 'failed' }]), '/repo')[0]!.execution).toBe('failed');
    expect(aggregateCaseResults([entry], report('flaky', [{ status: 'failed' }, { status: 'passed' }]), '/repo')[0]!.execution).toBe('flaky');
    expect(aggregateCaseResults([entry], report('unexpected', [{ status: 'failed' }, { status: 'failed' }]), '/repo')[0]!.execution).toBe('failed');
  });
  it('accepts an explicit ordinary-browser reference only in its declared project', () => {
    const browser = { ...entry, tests: entry.tests.map((test) => ({ ...test, project: 'browser' as const })) };
    expect(aggregateCaseResults([browser], report(), '/repo')[0]!.execution).toBe('unverified');
    expect(aggregateCaseResults([browser], report('expected', [{ status: 'passed' }], 'browser'), '/repo')[0]!.execution).toBe('passed');
  });
  it('retains partial acceptance even after all implemented assertions pass', () => {
    const partial = { ...entry, implementation: 'partial' as const, remaining: ['Recorded-analysis payload still needs coverage.'] };
    expect(aggregateCaseResults([partial], report(), '/repo')[0]).toMatchObject({ implementation: 'partial', execution: 'passed', remaining: partial.remaining });
  });
  it('does not hide a failing repeated execution behind an earlier pass', () => {
    const repeated = report();
    const failed = report('unexpected', [{ status: 'failed' }]);
    repeated.suites.push(...failed.suites);
    expect(aggregateCaseResults([entry], repeated, '/repo')[0]!.execution).toBe('failed');
  });
});
