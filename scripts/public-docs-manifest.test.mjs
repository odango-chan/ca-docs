import test from 'node:test';
import assert from 'node:assert/strict';
import { parseManifest, validateSourcePath, validateManifest } from './public-docs-manifest.mjs';

const valid = {
  apiVersion: 'connectionagent.io/v1alpha2',
  kind: 'PublicDocsManifest',
  component: 'sample-owner',
  sources: [
    { kind: 'openapi', path: 'api/openapi.yaml', role: 'public-api', publish: ['metadata', 'operations', 'raw'] },
  ],
  releases: [
    {
      releaseId: 'sample-v1',
      publicationStatus: 'PUBLISHED',
      releaseRecord: { path: 'releases/v1.md', ref: '0123456789abcdef0123456789abcdef01234567' },
      contracts: [
        {
          contractId: 'sample-api',
          version: 'v1',
          lifecycleStatus: 'FROZEN',
          latest: true,
          source: { ref: '0123456789abcdef0123456789abcdef01234567' },
          artifacts: [{ kind: 'openapi', path: 'api/openapi.yaml', mediaType: 'application/yaml' }],
        },
      ],
    },
  ],
};

test('accepts a complete v1alpha2 manifest', () => {
  assert.equal(parseManifest(JSON.stringify(valid), 'sample-owner').component, 'sample-owner');
});

test('rejects v1alpha1 without compatibility fallback', () => {
  assert.throws(
    () => validateManifest({ ...valid, apiVersion: 'connectionagent.io/v1alpha1' }, 'sample-owner'),
    /invalid PublicDocsManifest v1alpha2/,
  );
});

test('requires releases even when there are no formal releases', () => {
  const manifest = { ...valid };
  delete manifest.releases;
  assert.throws(() => validateManifest(manifest, 'sample-owner'), /invalid PublicDocsManifest v1alpha2/);
});

test('rejects unsafe source and artifact paths', () => {
  for (const value of ['/absolute/file', '../escape', 'docs/../secret', 'docs\\\\secret', 'C:/secret']) {
    assert.throws(() => validateSourcePath(value), /invalid public-doc source path/);
  }
});

test('rejects duplicate contract versions and duplicate latest pointers', () => {
  const manifest = structuredClone(valid);
  manifest.releases.push({
    releaseId: 'sample-v2',
    publicationStatus: 'PUBLISHED',
    releaseRecord: { path: 'releases/v2.md', ref: '0123456789abcdef0123456789abcdef01234567' },
    contracts: [structuredClone(valid.releases[0].contracts[0])],
  });
  assert.throws(() => validateManifest(manifest, 'sample-owner'), /duplicate contract version/);
});

test('rejects a manifest for a different registered component', () => {
  assert.throws(() => validateManifest(valid, 'another-owner'), /does not match registry/);
});
