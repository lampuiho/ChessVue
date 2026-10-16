import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadJourneyCases, repositoryRoot } from './CaseRegistry.mjs';

function executedTests(report) {
  if (!report) return [];
  function flatten(suites) {
    return suites.flatMap((suite) => [...(suite.specs ?? []), ...flatten(suite.suites ?? [])]);
  }
  return flatten(report.suites).flatMap((spec) => spec.tests.filter((test) => test.projectName === 'journeys').map((test) => ({
    spec: resolve(report.config.rootDir, spec.file), title: spec.title,
    passed: test.expectedStatus === 'passed' && test.status === 'expected' && test.results.length === 1 && test.results[0].status === 'passed',
    flaky: test.status === 'flaky' || test.results.length > 1,
    failed: test.status === 'unexpected' || ['failed', 'timedOut', 'interrupted'].includes(test.results.at(-1)?.status),
  })));
}
export function aggregateCaseResults(cases, report, root = repositoryRoot) {
  const executions = executedTests(report);
  return cases.map((entry) => {
    const expected = entry.tests.flatMap((test) => test.titles.map((title) => ({ spec: resolve(root, test.spec), title })));
    const matches = expected.map((test) => executions.filter((execution) => execution.spec === test.spec && execution.title === test.title));
    const missing = expected.filter((_, index) => !matches[index].length).map((test) => test.title);
    const observed = matches.flat();
    let execution = 'unverified';
    if (observed.some((match) => match.failed)) execution = 'failed';
    else if (observed.some((match) => match.flaky)) execution = 'flaky';
    else if (expected.length && !missing.length && observed.every((match) => match.passed) && !report.errors?.length) execution = 'passed';
    return { id: entry.id, implementation: entry.implementation, execution, remaining: entry.remaining, missing };
  });
}
export function printCoverageReport(path = 'test-results/JourneyResults.json') {
  const file = resolve(repositoryRoot, path);
  const report = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined;
  const results = aggregateCaseResults(loadJourneyCases(), report);
  console.log(report ? `Execution: ${report.stats.startTime} (${path})` : `No execution evidence at ${path}.`);
  for (const result of results) console.log(`${result.id.padEnd(15)} ${result.execution.padEnd(10)} ${result.implementation}${result.remaining.length ? ' - ' + result.remaining.join('; ') : ''}`);
  console.log(`${results.length} registered groups. Unregistered work remains in docs/JourneyTestPlan.md.`);
}
