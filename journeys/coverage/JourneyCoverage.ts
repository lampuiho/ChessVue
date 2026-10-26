export interface IJourneyCase {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  scenarios: string[];
  branches: string[];
  fixture: string;
  lane: 'seeded-browser' | 'ordinary-browser' | 'native-desktop';
  implementation: 'available' | 'partial' | 'backlog';
  scenarioReview: string;
  data: string[];
  tests: { spec: string; titles: string[]; project?: 'journeys' | 'browser' | 'desktop' }[];
  remaining: string[];
}
export interface IJourneyCaseResult {
  id: string;
  implementation: IJourneyCase['implementation'];
  execution: 'passed' | 'failed' | 'flaky' | 'unverified';
  remaining: string[];
  missing: string[];
}
