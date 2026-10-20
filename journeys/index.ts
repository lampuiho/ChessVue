import catalogue from './Catalogue.json';
import { loadJourneyCatalogue } from './CatalogueLoader.mjs';
import type { IJourneyDescription, IJourneySeed } from './Journey';
import * as fresh from './definitions/fresh/index';
import * as play from './definitions/play/index';
import * as history from './definitions/history/index';
import * as setup from './definitions/setup/index';
import * as promotion from './definitions/promotion/index';
import * as analysis from './definitions/analysis/index';
import * as clocks from './definitions/clocks/index';
import * as saves from './definitions/saves/index';
import * as settings from './definitions/settings/index';
import * as recovery from './definitions/recovery/index';
import * as rules from './definitions/rules/index';
import * as engineRaces from './definitions/engine-races/index';
import * as storageFailures from './definitions/storage-failures/index';
import * as sessions from './definitions/sessions/index';
import * as usability from './definitions/usability/index';

const descriptions = import.meta.glob<IJourneyDescription>('./definitions/*/Description.json', { eager: true, import: 'default' });
export const journeyCatalogue = loadJourneyCatalogue(catalogue, (path) => descriptions[path]);
const definitions: Record<string, { create(now: number, variant?: string): IJourneySeed }> = { fresh, play, history, setup, promotion, analysis, clocks, saves, settings, recovery, rules, 'engine-races': engineRaces, 'storage-failures': storageFailures, sessions, usability };
export function createJourney(name: string, now = Date.now(), variant?: string): IJourneySeed {
  const definition = Object.prototype.hasOwnProperty.call(definitions, name) ? definitions[name] : undefined;
  if (!definition) throw new Error(`Unknown journey: ${name}. Available: ${Object.keys(definitions).join(', ')}.`);
  return definition.create(now, variant);
}
