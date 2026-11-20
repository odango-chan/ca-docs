import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicOpenApiServers } from './public-openapi.mjs';

test('accepts relative server URLs and public HTTPS hosts', () => {
  assert.doesNotThrow(() => assertPublicOpenApiServers({ servers: [{ url: '/' }] }));
  assert.doesNotThrow(() => assertPublicOpenApiServers({ servers: [{ url: 'https://api.example.net/v1' }] }));
});

test('rejects loopback, private network and internal service URLs', () => {
  for (const url of [
    'http://127.0.0.1:8080',
    'http://10.0.0.4',
    'http://172.20.1.3',
    'http://192.168.1.10',
    'http://smf:8080',
    'http://service.default.svc',
    'http://api.cluster.local',
    'https://{apiHost}/v1',
  ]) {
    assert.throws(() => assertPublicOpenApiServers({ servers: [{ url }] }), /not publishable/);
  }
});

test('validates server URLs declared on individual operations', () => {
  assert.throws(
    () => assertPublicOpenApiServers({ paths: { '/health': { get: { servers: [{ url: 'http://localhost:8080' }] } } } }),
    /not publishable/,
  );
});

test('accepts a fully declared relative schema reference closure', () => {
  const documents = new Map([
    ['schemas/api.openapi.yaml', { components: { schemas: { Request: { $ref: './request.schema.yaml#/$defs/request' } } } }],
    ['schemas/request.schema.yaml', { $defs: { request: { type: 'object' } } }],
  ]);
  assert.doesNotThrow(() => assertDeclaredReferenceClosure(documents, [...documents.keys()]));
});

test('rejects undeclared and remote schema references', () => {
  assert.throws(
    () => assertDeclaredReferenceClosure(new Map([
      ['api.openapi.yaml', { components: { schemas: { Request: { $ref: './private.schema.yaml' } } } }],
    ]), ['api.openapi.yaml']),
    /unpublished schema reference/,
  );
  assert.throws(
    () => assertDeclaredReferenceClosure(new Map([
      ['api.openapi.yaml', { components: { schemas: { Request: { $ref: 'https://schemas.example.net/request.json' } } } }],
    ]), ['api.openapi.yaml']),
    /remote OpenAPI \/ JSON Schema reference/,
  );
});
