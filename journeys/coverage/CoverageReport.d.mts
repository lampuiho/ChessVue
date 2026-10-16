import type { IJourneyCase, IJourneyCaseResult } from './JourneyCoverage';

export function aggregateCaseResults(cases: IJourneyCase[], report?: unknown, root?: string): IJourneyCaseResult[];
export function printCoverageReport(path?: string): void;
