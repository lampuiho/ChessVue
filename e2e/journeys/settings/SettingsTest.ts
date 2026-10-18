import { test as base, expect } from '../../support/TestEvidence';
export const test = base.extend({});
test.use({ actionTimeout: 15000, navigationTimeout: 60000 });
export { expect };
