import type { IJourneyDescription } from './Journey';

export function loadJourneyCatalogue(registry: Record<string, string>, readDescription: (path: string) => unknown): Record<string, IJourneyDescription>;
