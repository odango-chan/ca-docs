import assert from 'node:assert/strict';
import test from 'node:test';
import { pinSourceContext } from '../scripts/source-revision.mjs';

const commit = 'd4696c2bbcba3a0c78371102bc934dc051036b5c';

test('pins source reads to immutable commit while preserving human-facing ref', () => {
  const pinned = pinSourceContext({ owner: 'odango-chan', repo: 'env-fabric', ref: 'main' }, { commit });
  assert.equal(pinned.ref, commit);
  assert.equal(pinned.sourceRef, 'main');
  assert.equal(pinned.owner, 'odango-chan');
  assert.equal(pinned.repo, 'env-fabric');
});

test('preserves an explicitly supplied sourceRef when pinning a context again', () => {
  const pinned = pinSourceContext({ ref: commit, sourceRef: 'release/1.x' }, { commit });
  assert.equal(pinned.ref, commit);
  assert.equal(pinned.sourceRef, 'release/1.x');
});

test('fails closed if a source ref does not resolve to a full immutable SHA', () => {
  for (const revision of [null, {}, { commit: null }, { commit: 'main' }, { commit: 'abc123' }]) {
    assert.throws(() => pinSourceContext({ ref: 'main' }, revision), /immutable commit SHA/);
  }
});
