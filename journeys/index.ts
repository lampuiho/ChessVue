import catalogue from './Catalogue.json';
import type { IJourneyDescription, IJourneySeed } from './Journey';
import * as fresh from './definitions/fresh';
import * as play from './definitions/play';
import * as history from './definitions/history';
import * as setup from './definitions/setup';
import * as promotion from './definitions/promotion';
import * as analysis from './definitions/analysis';
import * as clocks from './definitions/clocks';
import * as saves from './definitions/saves';
import * as settings from './definitions/settings';
import * as recovery from './definitions/recovery';

export const journeyCatalogue: Record<string, IJourneyDescription> = catalogue;
const definitions: Record<string, { create(now: number): IJourneySeed }> = { fresh, play, history, setup, promotion, analysis, clocks, saves, settings, recovery };
export function createJourney(name: string, now = Date.now()): IJourneySeed {
  const definition = Object.prototype.hasOwnProperty.call(definitions, name) ? definitions[name] : undefined;
  if (!definition) throw new Error(`Unknown journey: ${name}. Available: ${Object.keys(definitions).join(', ')}.`);
  return definition.create(now);
}
