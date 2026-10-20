import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function findCaseFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return findCaseFiles(path);
    return entry.name.endsWith('.json') ? [path] : [];
  });
}
export function loadJourneyCases(root = repositoryRoot) {
  const paths = findCaseFiles(resolve(root, 'journeys/definitions')).filter((path) => path.replaceAll('\\', '/').includes('/cases/'));
  const sessions = resolve(root, 'journeys/coverage/sessions');
  if (existsSync(sessions)) paths.push(...findCaseFiles(sessions));
  const cases = paths.flatMap((path) => JSON.parse(readFileSync(path, 'utf8')));
  const identifiers = new Set();
  for (const entry of cases) {
    if (!/^JRN-[A-Z]+-\d+$/.test(entry.id) || identifiers.has(entry.id)) throw new Error(`Invalid or duplicate case ID: ${entry.id}.`);
    identifiers.add(entry.id);
    if (!['P0', 'P1', 'P2'].includes(entry.priority) || !['seeded-browser', 'ordinary-browser'].includes(entry.lane)
      || !['available', 'partial', 'backlog'].includes(entry.implementation)) throw new Error(`Invalid case metadata: ${entry.id}.`);
    if (entry.lane === 'ordinary-browser' && entry.fixture !== 'browser') throw new Error(`Invalid ordinary-browser fixture: ${entry.id}.`);
    for (const field of ['scenarios', 'branches', 'data', 'tests', 'remaining']) {
      if (!Array.isArray(entry[field])) throw new Error(`Missing ${field}: ${entry.id}.`);
    }
    const references = [entry.scenarioReview, ...entry.data, ...entry.tests.map((test) => test.spec)];
    for (const reference of references) {
      if (typeof reference !== 'string' || !existsSync(resolve(root, reference.split('#')[0]))) throw new Error(`Missing reference for ${entry.id}: ${reference}.`);
    }
    for (const test of entry.tests) {
      if (test.project !== undefined && !['journeys', 'browser'].includes(test.project)) throw new Error(`Invalid test project: ${entry.id}.`);
      if (entry.lane === 'ordinary-browser' && test.project !== 'browser') throw new Error(`Ordinary-browser cases require the browser project: ${entry.id}.`);
      if (!Array.isArray(test.titles) || !test.titles.length || test.titles.some((title) => !title.startsWith(entry.id + ' '))) throw new Error(`Invalid test titles: ${entry.id}.`);
    }
  }
  return cases.sort((left, right) => left.id.localeCompare(right.id));
}
