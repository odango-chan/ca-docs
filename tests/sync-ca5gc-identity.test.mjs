import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceIdentityMatches } from '../scripts/sync-ca-5gc-sim.mjs';

test('registry can keep the published component id while matching the source repository identity', () => {
  const component = { id: 'ca-5gc-sim', sourceIdentity: 'env-5gc-sim' };
  assert.equal(sourceIdentityMatches({ component: 'env-5gc-sim' }, component), true);
  assert.equal(sourceIdentityMatches({ component: 'ca-5gc-sim' }, component), false);
});
