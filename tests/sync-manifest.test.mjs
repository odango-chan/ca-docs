import assert from 'node:assert/strict';
import test from 'node:test';
import yaml from 'js-yaml';
import { buildSnapshot, validateSourcePath } from '../scripts/sync-manifest.mjs';

const component = {
  id: 'env-fabric',
  repository: 'odango-chan/env-fabric',
  manifest: 'docs/public-docs.yaml',
  title: { zh: 'env-fabric', en: 'env-fabric' },
};

test('manifest loader accepts canonical non-ca component slugs and emits allowlisted API/schema summaries', async () => {
  const manifest = {
    apiVersion: 'connectionagent.io/v1alpha1',
    kind: 'PublicDocsManifest',
    component: 'env-fabric',
    title: { zh: 'env-fabric', en: 'env-fabric' },
    sources: [
      { kind: 'openapi', path: 'schemas/v1alpha1/business.yaml', role: 'business-api', publish: ['metadata', 'operations', 'fields'] },
      { kind: 'json-schema', path: 'schemas/v1alpha1/observation.schema.yaml', role: 'network-observation', publish: ['metadata', 'fields'] },
    ],
  };
  const texts = {
    'schemas/v1alpha1/business.yaml': `openapi: 3.1.0
info: {title: Business API, description: Owner APIs, version: v1}
paths:
  /v1/observations/query:
    post:
      operationId: queryObservations
      summary: Query observations
      requestBody:
        content:
          application/json:
            schema: {$ref: '#/components/schemas/Query'}
            examples: {unsafe: {value: {sensitive: hidden}}}
      responses:
        '200': {description: Complete}
components:
  schemas:
    Query:
      type: object
      required: [pageSize]
      properties:
        pageSize: {type: integer, description: Result limit}
        secretMode: {type: string, enum: [private, internal]}
`,
    'schemas/v1alpha1/observation.schema.yaml': `$id: https://example.test/observation
title: Network Observation
description: Owner-native network record
type: object
required: [sourceAuthority]
properties:
  sourceAuthority: {type: string, const: env-fabric}
  disposition: {type: string, enum: [OBSERVED, DROPPED]}
`,
  };
  const snapshot = await buildSnapshot(
    component,
    yaml.dump(manifest),
    { ref: 'main' },
    { commit: 'abc123', commitDate: '2026-10-14T00:00:00Z' },
    async (sourcePath) => texts[sourcePath],
  );

  assert.equal(snapshot.component, 'env-fabric');
  const api = snapshot.sources.find((source) => source.kind === 'openapi');
  const contract = snapshot.sources.find((source) => source.kind === 'json-schema');
  assert.equal(api.operations[0].operationId, 'queryObservations');
  assert.equal(api.operations[0].examples, undefined);
  assert.deepEqual(api.schemas.Query.fields.map((field) => field.path), ['pageSize', 'secretMode']);
  assert.equal(api.schemas.Query.fields[1].enum, undefined);
  assert.deepEqual(contract.fields.map((field) => field.path), ['sourceAuthority', 'disposition']);
  assert.equal(contract.fields[1].enum, undefined);
  assert.equal(contract.metadata.title, 'network-observation');
  assert.equal(JSON.stringify(snapshot).includes('sensitive'), false);
  assert.equal(JSON.stringify(snapshot).includes('internal'), false);
  assert.equal(snapshot.source.commit, 'abc123');
});

test('manifest loader rejects source path traversal before reading source content', async () => {
  const manifest = {
    apiVersion: 'connectionagent.io/v1alpha1',
    kind: 'PublicDocsManifest',
    component: 'env-fabric',
    sources: [{ kind: 'markdown', path: '../private.md', role: 'overview', publish: ['metadata', 'body'] }],
  };
  await assert.rejects(
    buildSnapshot(component, yaml.dump(manifest), { ref: 'main' }, { commit: 'abc123' }, async () => ''),
    /invalid PublicDocsManifest|invalid public-doc source path/,
  );
  assert.throws(() => validateSourcePath('/etc/passwd'), /invalid public-doc source path/);
});

test('manifest loader supports markdown only when the manifest explicitly permits body publication', async () => {
  const manifest = {
    apiVersion: 'connectionagent.io/v1alpha1',
    kind: 'PublicDocsManifest',
    component: 'env-fabric',
    sources: [{ kind: 'markdown', path: 'docs/public/overview.md', role: 'overview', language: 'en', publish: ['metadata', 'body'] }],
  };
  const snapshot = await buildSnapshot(component, yaml.dump(manifest), { ref: 'main' }, { commit: 'abc123' }, async () => '# Public overview\n');
  assert.equal(snapshot.sources[0].body, '# Public overview\n');
});


test('snapshot records the human-facing source ref while pinning provenance to an immutable commit', async () => {
  const manifest = {
    apiVersion: 'connectionagent.io/v1alpha1',
    kind: 'PublicDocsManifest',
    component: 'env-fabric',
    sources: [{ kind: 'implementation-check', path: 'internal/httpapi/server.go', role: 'routes', publish: ['metadata', 'implementation-summary'] }],
  };
  const privateSource = 'package httpapi; // MUST_NOT_LEAK_PRIVATE_SOURCE';
  const snapshot = await buildSnapshot(
    component,
    yaml.dump(manifest),
    { ref: 'd4696c2bbcba3a0c78371102bc934dc051036b5c', sourceRef: 'main' },
    { commit: 'd4696c2bbcba3a0c78371102bc934dc051036b5c', commitDate: '2026-10-14T06:46:55Z' },
    async () => privateSource,
  );
  assert.equal(snapshot.source.ref, 'main');
  assert.equal(snapshot.source.commit, 'd4696c2bbcba3a0c78371102bc934dc051036b5c');
  assert.match(snapshot.sources[0].implementationSummary, /pinned source revision/);
  assert.equal(JSON.stringify(snapshot).includes('MUST_NOT_LEAK_PRIVATE_SOURCE'), false);
});

test('manifest loader rejects Windows separators and dot segments in declared paths', async () => {
  for (const sourcePath of ['..\\private.md', 'docs//public.md', './public.md']) {
    assert.throws(() => validateSourcePath(sourcePath), /invalid public-doc source path/);
  }
});
