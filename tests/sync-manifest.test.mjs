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

const branchCommit = 'd4696c2bbcba3a0c78371102bc934dc051036b5c';
const releaseCommit = 'a4696c2bbcba3a0c78371102bc934dc051036b5c';

function manifest(sources, releases = []) {
  return {
    apiVersion: 'connectionagent.io/v1alpha2',
    kind: 'PublicDocsManifest',
    component: 'env-fabric',
    title: { zh: 'env-fabric', en: 'env-fabric' },
    sources,
    releases,
  };
}

test('v1alpha2 manifest emits a versioned source snapshot and allowlisted summaries', async () => {
  const declared = manifest([
    {
      kind: 'openapi',
      path: 'schemas/v1alpha2/business.yaml',
      role: 'business-api',
      publish: ['metadata', 'operations', 'fields'],
    },
    {
      kind: 'json-schema',
      path: 'schemas/v1alpha2/observation.schema.yaml',
      role: 'network-observation',
      publish: ['metadata', 'fields', 'enums'],
    },
  ]);
  const texts = {
    'schemas/v1alpha2/business.yaml': `openapi: 3.1.0
info: {title: Business API, description: Owner APIs, version: v1}
paths:
  /v1/observations/query:
    post:
      operationId: queryObservations
      summary: Query observations
      requestBody:
        required: true
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
    'schemas/v1alpha2/observation.schema.yaml': `$id: https://example.test/observation
title: Network Observation
description: Owner-native network record
type: object
required: [sourceAuthority]
properties:
  sourceAuthority: {type: string, const: env-fabric}
  disposition: {type: string, enum: [OBSERVED, DROPPED]}
`,
  };
  const result = await buildSnapshot(
    component,
    yaml.dump(declared),
    { ref: branchCommit, sourceRef: 'main' },
    { commit: branchCommit, commitDate: '2026-11-19T00:00:00Z' },
    async (sourcePath) => texts[sourcePath],
  );
  const snapshot = result.snapshot;
  assert.equal(snapshot.schemaVersion, 'connectionagent.io/ca-docs-snapshot/v2');
  assert.equal(snapshot.component, 'env-fabric');
  assert.equal(snapshot.source.commit, branchCommit);
  const api = snapshot.sources.find((source) => source.kind === 'openapi');
  const contract = snapshot.publicDocs.contracts.find((source) => source.kind === 'json-schema');
  assert.equal(api.operations[0].operationId, 'queryObservations');
  assert.equal(api.operations[0].request.schema, 'Query');
  assert.equal(api.operations[0].request.example, undefined);
  assert.deepEqual(api.schemas.Query.fields.map((field) => field.path), ['pageSize', 'secretMode']);
  assert.deepEqual(contract.fields.map((field) => field.path), ['sourceAuthority', 'disposition']);
  assert.deepEqual(contract.enums.disposition, ['OBSERVED', 'DROPPED']);
  assert.equal(snapshot.source.ref, 'main');
  assert.equal(result.publicFiles.length, 0);
});

test('raw OpenAPI publication creates a commit-pinned public artifact only when explicitly allowlisted', async () => {
  const openApi = `openapi: 3.1.0
info: {title: Public API, version: v1}
paths: {}
`;
  const declared = manifest([
    {
      kind: 'openapi',
      path: 'contracts/public.openapi.yaml',
      role: 'public-api',
      publish: ['metadata', 'operations', 'raw'],
    },
  ]);
  const result = await buildSnapshot(
    component,
    yaml.dump(declared),
    { ref: branchCommit },
    { commit: branchCommit },
    async () => openApi,
  );
  assert.equal(
    result.snapshot.sources[0].rawPublicPath,
    '/api-snapshots/env-fabric/' + branchCommit + '/contracts/public.openapi.yaml',
  );
  assert.equal(result.publicFiles[0].content, openApi);
});

test('v1alpha1 manifests are rejected rather than silently accepted', async () => {
  const legacy = {
    ...manifest([{ kind: 'markdown', path: 'docs/overview.md', role: 'overview', publish: ['body'] }]),
    apiVersion: 'connectionagent.io/v1alpha1',
  };
  await assert.rejects(
    buildSnapshot(component, yaml.dump(legacy), { ref: branchCommit }, { commit: branchCommit }, async () => '# Overview'),
    /invalid PublicDocsManifest v1alpha2/,
  );
});

test('manifest loader rejects source path traversal before reading source content', async () => {
  const declared = manifest([
    { kind: 'markdown', path: '../private.md', role: 'overview', publish: ['metadata', 'body'] },
  ]);
  await assert.rejects(
    buildSnapshot(component, yaml.dump(declared), { ref: branchCommit }, { commit: branchCommit }, async () => ''),
    /invalid PublicDocsManifest v1alpha2|invalid public-doc source path/,
  );
  assert.throws(() => validateSourcePath('/etc/passwd'), /invalid public-doc source path/);
  for (const sourcePath of ['..\\private.md', 'docs//public.md', './public.md']) {
    assert.throws(() => validateSourcePath(sourcePath), /invalid public-doc source path/);
  }
});

test('Markdown body is published only when explicitly allowlisted', async () => {
  const declared = manifest([
    {
      kind: 'markdown',
      path: 'docs/public/overview.md',
      role: 'overview',
      language: 'en',
      publish: ['metadata', 'body'],
    },
  ]);
  const result = await buildSnapshot(
    component,
    yaml.dump(declared),
    { ref: branchCommit },
    { commit: branchCommit },
    async () => '# Public overview\n',
  );
  assert.equal(result.snapshot.sources[0].body, '# Public overview\n');
});

test('implementation checks publish derived routes but never private source text', async () => {
  const declared = manifest([
    {
      kind: 'implementation-check',
      path: 'internal/httpapi/server.go',
      role: 'http-route-registration',
      extractor: 'go-http-routes',
      publish: ['metadata', 'implementation-summary'],
    },
  ]);
  const privateSource = 'package httpapi\n// DO_NOT_PUBLISH\nfunc register(mux *http.ServeMux) { mux.HandleFunc("POST /v1/observations", handler) }';
  const result = await buildSnapshot(
    component,
    yaml.dump(declared),
    { ref: branchCommit },
    { commit: branchCommit },
    async () => privateSource,
  );
  assert.deepEqual(result.snapshot.sources[0].routes, [{ method: 'POST', path: '/v1/observations' }]);
  assert.equal(JSON.stringify(result.snapshot).includes('DO_NOT_PUBLISH'), false);
});

test('released contract artifacts are pinned, hashed and append-only public files', async () => {
  const declared = manifest([], [
    {
      releaseId: 'fabric-contracts-v1',
      releaseRecord: { path: 'docs/releases/fabric-v1.md', ref: releaseCommit },
      contracts: [
        {
          contractId: 'network-observation',
          version: 'v1',
          lifecycleStatus: 'FROZEN',
          source: { ref: branchCommit },
          artifacts: [
            {
              kind: 'json-schema',
              path: 'schemas/v1alpha2/network-observation.schema.yaml',
              mediaType: 'application/schema+yaml',
              publish: ['download', 'render'],
            },
            {
              kind: 'specification',
              path: 'docs/network-observation.md',
              mediaType: 'text/markdown',
              publish: ['download', 'render'],
            },
            {
              kind: 'other',
              path: 'contracts/network-observation-vectors.json',
              mediaType: 'application/json',
              publish: ['download', 'render'],
            },
          ],
        },
      ],
    },
  ]);
  const files = new Map([
    ['docs/releases/fabric-v1.md@' + releaseCommit, '# Fabric contracts v1\n\nRelease record body.\n'],
    ['schemas/v1alpha2/network-observation.schema.yaml@' + branchCommit, 'type: object\nproperties: {}\n'],
    ['docs/network-observation.md@' + branchCommit, '# Network Observation\n\nNormative specification body.\n'],
    ['contracts/network-observation-vectors.json@' + branchCommit, '{"cases":[{"id":"one"}]}'],
  ]);
  const result = await buildSnapshot(
    component,
    yaml.dump(declared),
    { ref: branchCommit },
    { commit: branchCommit },
    async (sourcePath, sourceRef) => files.get(sourcePath + '@' + sourceRef),
  );
  assert.equal(result.snapshot.releases[0].contracts[0].contractId, 'network-observation');
  const releasedSchema = result.snapshot.releases[0].contracts[0].artifacts[0];
  assert.equal(releasedSchema.summary.kind, 'json-schema');
  assert.equal(releasedSchema.summary.rawPublicPath, releasedSchema.publicPath);
  assert.ok(releasedSchema.summaryRole);
  const releasedSpecification = result.snapshot.releases[0].contracts[0].artifacts[1];
  assert.equal(releasedSpecification.summary.kind, 'specification');
  assert.match(releasedSpecification.summary.html, /Normative specification body/);
  const releasedVectors = result.snapshot.releases[0].contracts[0].artifacts[2];
  assert.equal(releasedVectors.summary.kind, 'other');
  assert.match(releasedVectors.summary.text, /"id": "one"/);
  assert.match(result.snapshot.releases[0].releaseRecord.html, /Release record body/);
  assert.equal(result.publicFiles.length, 5);
  assert.ok(result.publicFiles.some((file) => file.path.endsWith('/provenance.json')));
  assert.ok(result.publicFiles.some((file) => file.path.endsWith('/network-observation.schema.yaml')));
  assert.ok(result.publicFiles.every((file) => /^[0-9a-f]{64}$/.test(file.sha256)));
});

test('manifest component identity can differ from the public site component id only when registry declares it', async () => {
  const aliased = { ...component, id: 'ca-5gc-sim', sourceIdentity: 'env-5gc-sim' };
  const declared = {
    ...manifest([{ kind: 'markdown', path: 'docs/overview.md', role: 'overview', publish: ['body'] }]),
    component: 'env-5gc-sim',
  };
  const result = await buildSnapshot(
    aliased,
    yaml.dump(declared),
    { ref: branchCommit },
    { commit: branchCommit },
    async () => '# Overview',
  );
  assert.equal(result.snapshot.component, 'ca-5gc-sim');
  assert.equal(result.snapshot.sourceComponent, 'env-5gc-sim');
});
