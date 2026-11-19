import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import { pinSourceContext } from './source-revision.mjs';
import { renderPublicMarkdown } from '../src/lib/public-markdown.mjs';

const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const strict = process.env.CA_DOCS_SYNC_STRICT === '1';
const manifestSchema = yaml.load(
  await fs.readFile('schemas/v1alpha2/public-docs-manifest.schema.yaml', 'utf8'),
);
const validateManifestSchema = new Ajv2020({ allErrors: true }).compile(manifestSchema);
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateSourcePath(sourcePath) {
  if (
    typeof sourcePath !== 'string' ||
    !sourcePath ||
    sourcePath.startsWith('/') ||
    sourcePath.includes('\\') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(sourcePath)
  ) {
    throw new Error('invalid public-doc source path ' + sourcePath);
  }
  const segments = sourcePath.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) {
    throw new Error('invalid public-doc source path ' + sourcePath);
  }
  return sourcePath;
}

function assertCommitSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(label + ' must be a full immutable commit SHA');
  }
}

function assertManifest(manifest, component) {
  if (!validateManifestSchema(manifest)) {
    const detail = validateManifestSchema.errors
      ?.map((error) => (error.instancePath || '/') + ' ' + error.message)
      .join('; ');
    throw new Error('invalid PublicDocsManifest v1alpha2: ' + detail);
  }
  const expectedComponent = component.sourceIdentity || component.id;
  if (manifest.component !== expectedComponent) {
    throw new Error(
      'manifest component ' + manifest.component + ' does not match registry identity ' + expectedComponent,
    );
  }

  const roles = new Set();
  for (const source of manifest.sources) {
    validateSourcePath(source.path);
    const key = source.role;
    if (roles.has(key)) throw new Error('duplicate source role ' + key);
    roles.add(key);
    if (source.kind === 'implementation-check' && source.extractor && source.extractor !== 'go-http-routes') {
      throw new Error('unsupported implementation-check extractor ' + source.extractor);
    }
    if (source.extractor && source.kind !== 'implementation-check') {
      throw new Error('extractor is only valid for implementation-check sources');
    }
  }

  const releaseIds = new Set();
  const contractVersions = new Set();
  for (const release of manifest.releases) {
    if (releaseIds.has(release.releaseId)) throw new Error('duplicate releaseId ' + release.releaseId);
    releaseIds.add(release.releaseId);
    validateSourcePath(release.releaseRecord.path);
    assertCommitSha(release.releaseRecord.ref, 'releaseRecord.ref');
    for (const contract of release.contracts) {
      const identity = contract.contractId + '@' + contract.version;
      if (contractVersions.has(identity)) throw new Error('duplicate Contract ID/version ' + identity);
      contractVersions.add(identity);
      assertCommitSha(contract.source.ref, identity + ' source.ref');
      const artifactPaths = new Set();
      for (const artifact of contract.artifacts) {
        validateSourcePath(artifact.path);
        if (artifactPaths.has(artifact.path)) {
          throw new Error(identity + ' contains duplicate artifact path ' + artifact.path);
        }
        artifactPaths.add(artifact.path);
      }
    }
  }
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ca-docs-v2-manifest-sync',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  return headers;
}

function splitRepository(value) {
  const parts = String(value || '').split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error('invalid repository ' + value);
  }
  return { owner: parts[0], repo: parts[1] };
}

async function fetchText(context, sourcePath) {
  const rel = validateSourcePath(sourcePath);
  const url =
    'https://api.github.com/repos/' +
    context.owner +
    '/' +
    context.repo +
    '/contents/' +
    rel +
    '?ref=' +
    encodeURIComponent(context.ref);
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error('failed to fetch declared source ' + rel + ': HTTP ' + response.status);
  }
  const body = await response.json();
  if (!body?.content || body.encoding !== 'base64') {
    throw new Error('unexpected response while reading ' + rel);
  }
  return Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function sourceRevision(context) {
  const response = await fetch(
    'https://api.github.com/repos/' +
      context.owner +
      '/' +
      context.repo +
      '/branches/' +
      encodeURIComponent(context.ref),
    { headers: githubHeaders() },
  );
  if (!response.ok) {
    throw new Error('failed to resolve source ref ' + context.ref + ': HTTP ' + response.status);
  }
  const body = await response.json();
  return {
    commit: body?.commit?.sha || null,
    commitDate: body?.commit?.commit?.committer?.date || body?.commit?.commit?.author?.date || null,
  };
}

function parseYamlDocument(sourceText, source) {
  const document = yaml.load(sourceText);
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(source.kind + ' source ' + source.path + ' must contain a YAML/JSON object');
  }
  return document;
}

function schemaName(ref) {
  if (typeof ref !== 'string') return null;
  const marker = '#/components/schemas/';
  return ref.includes(marker) ? ref.slice(ref.indexOf(marker) + marker.length) : null;
}

function resolveSchemaReference(sourcePath, ref) {
  if (typeof ref !== 'string' || !ref) return null;
  const marker = '#/components/schemas/';
  if (ref.startsWith(marker)) return ref.slice(marker.length);
  const hash = ref.indexOf('#');
  const file = hash >= 0 ? ref.slice(0, hash) : ref;
  if (!file) return ref.startsWith('#') ? ref : null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), file));
}

function fieldType(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (Object.hasOwn(schema, 'const')) return 'const';
  if (Array.isArray(schema.enum)) return 'enum';
  if (schema.type) return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (schema.$ref) return 'ref';
  if (schema.oneOf) return 'oneOf';
  if (schema.anyOf) return 'anyOf';
  if (schema.allOf) return 'allOf';
  return null;
}

function collectFields(schema, prefix = '', output = []) {
  if (!schema || typeof schema !== 'object') return output;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  for (const [name, child] of Object.entries(schema.properties || {})) {
    if (!child || typeof child !== 'object') continue;
    const fieldPath = prefix ? prefix + '.' + name : name;
    const field = {
      path: fieldPath,
      required: required.has(name),
      type: fieldType(child),
      description: typeof child.description === 'string' ? child.description : null,
      ref: typeof child.$ref === 'string' ? child.$ref : null,
      oneOfRefs: Array.isArray(child.oneOf)
        ? child.oneOf.map((item) => item?.$ref).filter((item) => typeof item === 'string')
        : [],
      anyOfRefs: Array.isArray(child.anyOf)
        ? child.anyOf.map((item) => item?.$ref).filter((item) => typeof item === 'string')
        : [],
    };
    if (Object.hasOwn(child, 'const')) field.const = child.const;
    if (Array.isArray(child.enum)) field.enum = child.enum;
    if (child.default !== undefined) field.default = child.default;
    output.push(field);
    collectFields(child, fieldPath, output);
  }
  return output;
}

function collectConditionalRules(node, prefix = '', output = []) {
  if (!node || typeof node !== 'object') return output;
  for (const keyword of ['allOf', 'oneOf', 'anyOf']) {
    if (!Array.isArray(node[keyword])) continue;
    for (const branch of node[keyword]) {
      if (!branch || typeof branch !== 'object') continue;
      if (!branch.if || !branch.then) continue;
      const when = {};
      for (const [name, condition] of Object.entries(branch.if.properties || {})) {
        const fieldPath = prefix ? prefix + '.' + name : name;
        if (Object.hasOwn(condition || {}, 'const')) when[fieldPath] = [condition.const];
        else if (Array.isArray(condition?.enum)) when[fieldPath] = condition.enum;
      }
      const fields = collectFields(
        { properties: branch.then.properties || {}, required: branch.then.required || [] },
        prefix,
        [],
      );
      const required = (branch.then.required || []).map((name) =>
        prefix ? prefix + '.' + name : name,
      );
      if (Object.keys(when).length || fields.length || required.length) {
        output.push({ keyword, scope: prefix || null, when, required, fields });
      }
    }
  }
  for (const [name, child] of Object.entries(node.properties || {})) {
    const childPrefix = prefix ? prefix + '.' + name : name;
    collectConditionalRules(child, childPrefix, output);
  }
  return output;
}

function summarizeOpenApi(document, source) {
  if (!/^3\.(0|1)\./.test(String(document.openapi || ''))) {
    throw new Error('unsupported OpenAPI version in ' + source.path);
  }
  if (!document.info || typeof document.info.title !== 'string' || !document.paths) {
    throw new Error('invalid OpenAPI document in ' + source.path);
  }

  const publish = new Set(source.publish || []);
  const result = {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    publish: [...publish],
    sha256: null,
    metadata: publish.has('metadata')
      ? {
          title: document.info.title,
          description: document.info.description || '',
          version: document.info.version || null,
        }
      : null,
  };

  const schemas = document.components?.schemas || {};
  result.schemas = publish.has('fields')
    ? Object.fromEntries(
        Object.entries(schemas).map(([name, schema]) => [
          name,
          {
            title: schema.title || name,
            description: schema.description || null,
            fields: collectFields(schema),
            rules: collectConditionalRules(schema),
          },
        ]),
      )
    : {};

  if (publish.has('operations')) {
    result.operations = [];
    for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem?.[method];
        if (!operation) continue;
        const contentEntries = Object.entries(operation.requestBody?.content || {});
        const requestContent =
          operation.requestBody?.content?.['application/json'] ||
          contentEntries[0]?.[1] ||
          null;
        const requestSchema = resolveSchemaReference(source.path, requestContent?.schema?.$ref);
        const request = requestSchema
          ? {
              schema: requestSchema,
              required: operation.requestBody?.required === true,
              contentType: contentEntries[0]?.[0] || 'application/json',
            }
          : null;
        if (request && publish.has('examples')) {
          const examples = Object.values(requestContent?.examples || {})
            .map((entry) => entry?.value)
            .filter((value) => value !== undefined);
          if (examples.length) request.example = examples[0];
        }

        const responses = Object.entries(operation.responses || {}).map(([status, raw]) => {
          let response = raw;
          if (raw?.$ref?.startsWith('#/components/responses/')) {
            response =
              document.components?.responses?.[raw.$ref.split('/').at(-1)] || raw;
          }
          const responseContent =
            response?.content?.['application/json'] ||
            Object.values(response?.content || {})[0] ||
            null;
          return {
            status,
            description: response?.description || '',
            schema: resolveSchemaReference(source.path, responseContent?.schema?.$ref),
          };
        });

        result.operations.push({
          method: method.toUpperCase(),
          path: routePath,
          operationId: operation.operationId || null,
          summary: operation.summary || '',
          description: operation.description || '',
          tags: Array.isArray(operation.tags) ? operation.tags : [],
          request,
          responses,
        });
      }
    }
  } else {
    result.operations = [];
  }
  return result;
}

function summarizeJsonSchema(document, source) {
  const publish = new Set(source.publish || []);
  const fields = publish.has('fields') ? collectFields(document) : [];
  const rules = publish.has('fields') ? collectConditionalRules(document) : [];
  const enums = {};
  if (publish.has('enums')) {
    for (const field of fields) {
      if (Array.isArray(field.enum)) enums[field.path] = field.enum;
    }
  }
  return {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    publish: [...publish],
    sha256: null,
    metadata: publish.has('metadata')
      ? {
          id: document.$id || null,
          title: document.title || path.posix.basename(source.path),
          description: document.description || '',
        }
      : null,
    fields,
    rules,
    enums,
    examplesAllowed: publish.has('examples'),
    examples: publish.has('examples') ? document.examples || null : null,
  };
}

function summarizeMarkdown(sourceText, source) {
  const publish = new Set(source.publish || []);
  if (publish.has('body') && !sourceText.trim()) {
    throw new Error('published Markdown source is empty: ' + source.path);
  }
  return {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    language: source.language || null,
    publish: [...publish],
    sha256: null,
    body: publish.has('body') ? sourceText : null,
  };
}

function summarizeImplementationCheck(sourceText, source) {
  const publish = new Set(source.publish || []);
  const result = {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    extractor: source.extractor || null,
    publish: [...publish],
    sha256: null,
    implementationSummary: publish.has('implementation-summary')
      ? 'Declared implementation source is present at the pinned source revision (' +
        sourceText.length +
        ' characters).'
      : null,
    routes: [],
  };
  if (source.extractor === 'go-http-routes') {
    const pattern = /HandleFunc\("([A-Z]+)\s+([^"]+)"/g;
    result.routes = [...sourceText.matchAll(pattern)].map((match) => ({
      method: match[1],
      path: match[2],
    }));
  }
  return result;
}

export function summarizeDeclaredSource(source, sourceText) {
  let summary;
  if (source.kind === 'openapi') summary = summarizeOpenApi(parseYamlDocument(sourceText, source), source);
  else if (source.kind === 'json-schema') summary = summarizeJsonSchema(parseYamlDocument(sourceText, source), source);
  else if (source.kind === 'markdown') summary = summarizeMarkdown(sourceText, source);
  else if (source.kind === 'implementation-check') summary = summarizeImplementationCheck(sourceText, source);
  else throw new Error('unsupported public-doc source kind ' + source.kind);
  summary.sha256 = sha256(sourceText);
  return summary;
}

function sourceByRole(sources, role) {
  const source = sources.find((item) => item.role === role);
  if (!source) throw new Error('presentation references missing source role=' + role);
  return source;
}

function classifyRoute(routePath) {
  if (routePath.startsWith('/internal/fabric/')) return 'Fabric integration';
  if (routePath.startsWith('/internal/')) return 'Host control';
  if (routePath === '/identity' || routePath === '/healthz') return 'Diagnostics';
  return 'Owner API';
}

function buildPresentation(component, sources) {
  const config = component.presentation || {};
  const views = {};
  const schemaSources = sources.filter((source) => source.kind === 'json-schema');
  views.contracts = schemaSources.map((source) => ({
    kind: source.kind,
    path: source.path,
    role: source.role,
    title: source.metadata?.title || source.path,
    description: source.metadata?.description || null,
    fields: source.fields || [],
    rules: source.rules || [],
    enums: source.enums || {},
    examplesAllowed: source.examplesAllowed === true,
  }));

  if (config.semantics) {
    for (const [name, mapping] of Object.entries(config.semantics)) {
      const source = sourceByRole(sources, mapping.sourceRole);
      const field = (source.fields || []).find((item) => item.path === mapping.fieldPath);
      if (!field || !Array.isArray(field.enum)) {
        throw new Error('semantic presentation ' + name + ' requires enum field ' + mapping.fieldPath);
      }
      views[name] = field.enum;
    }
  }

  if (config.apiSurfaces) {
    views.api = {};
    for (const [name, role] of Object.entries(config.apiSurfaces)) {
      const source = sourceByRole(sources, role);
      if (source.kind !== 'openapi') throw new Error('API surface role=' + role + ' is not OpenAPI');
      views.api[name] = {
        title: source.metadata?.title || role,
        description: source.metadata?.description || '',
        routes: source.operations || [],
        schemas: source.schemas || {},
        path: source.path,
      };
    }
  }

  if (config.markdownPages) {
    views.pages = {};
    for (const [language, pages] of Object.entries(config.markdownPages)) {
      views.pages[language] = {};
      for (const [pageName, role] of Object.entries(pages)) {
        const source = sourceByRole(sources, role);
        if (source.kind !== 'markdown' || typeof source.body !== 'string') {
          throw new Error('Markdown page role=' + role + ' does not publish a body');
        }
        views.pages[language][pageName] = source.body;
      }
    }
  }

  if (config.routeComparison) {
    const openApi = sourceByRole(sources, config.routeComparison.openapiRole);
    const implementation = sourceByRole(sources, config.routeComparison.implementationRole);
    if (openApi.kind !== 'openapi' || implementation.kind !== 'implementation-check') {
      throw new Error('routeComparison must reference OpenAPI and implementation-check sources');
    }
    const documentedByKey = new Map(
      (openApi.operations || []).map((route) => [route.method + ' ' + route.path, route]),
    );
    const implementedByKey = new Map(
      (implementation.routes || []).map((route) => [route.method + ' ' + route.path, route]),
    );
    const keys = [...new Set([...documentedByKey.keys(), ...implementedByKey.keys()])].sort();
    views.routes = keys.map((key) => {
      const documented = documentedByKey.get(key);
      const implemented = implementedByKey.get(key);
      const selected = implemented || documented;
      return {
        ...selected,
        surface: classifyRoute(selected.path),
        documented: Boolean(documented),
        implemented: Boolean(implemented),
      };
    });
    views.drift = {
      implementationOnlyRoutes: views.routes.filter((route) => route.implemented && !route.documented),
      documentedOnlyRoutes: views.routes.filter((route) => route.documented && !route.implemented),
    };
    views.counts = {
      documentedRoutes: (openApi.operations || []).length,
      implementationRoutes: (implementation.routes || []).length,
    };
  }

  if (config.semantics) {
    views.counts = {
      ...(views.counts || {}),
      facts: (views.facts || []).length,
      operations: (views.operations || []).length,
    };
  }
  return views;
}

function addPublicFile(files, publicPath, content, expectedSha) {
  const existing = files.get(publicPath);
  const digest = expectedSha || sha256(content);
  if (existing && existing.sha256 !== digest) {
    throw new Error('conflicting public artifact path in one sync: ' + publicPath);
  }
  files.set(publicPath, { path: publicPath, content, sha256: digest });
}

export async function buildSnapshot(
  component,
  manifestText,
  context,
  revision,
  readSource = (sourcePath, sourceRef = context.ref) =>
    fetchText({ ...context, ref: sourceRef }, sourcePath),
) {
  const manifest = yaml.load(manifestText);
  assertManifest(manifest, component);
  const publicFiles = new Map();

  const sources = await Promise.all(
    manifest.sources.map(async (source) => {
      const sourceText = await readSource(source.path, context.ref);
      const summary = summarizeDeclaredSource(source, sourceText);
      if (source.publish.includes('raw')) {
        const publicPath =
          'api-snapshots/' +
          component.id +
          '/' +
          revision.commit +
          '/' +
          source.path;
        addPublicFile(publicFiles, publicPath, sourceText, summary.sha256);
        summary.rawPublicPath = '/' + publicPath;
      }
      return summary;
    }),
  );

  const releases = [];
  for (const release of manifest.releases) {
    const recordText = await readSource(release.releaseRecord.path, release.releaseRecord.ref);
    const recordDigest = sha256(recordText);
    const renderedRecord = renderPublicMarkdown(recordText, {
      repository: component.repository,
      commit: release.releaseRecord.ref,
      path: release.releaseRecord.path,
      role: release.releaseId,
    });
    const recordPath =
      'contracts/' +
      component.id +
      '/releases/' +
      release.releaseId +
      '/release-record/' +
      release.releaseRecord.path;
    addPublicFile(publicFiles, recordPath, recordText, recordDigest);

    const contractEntries = [];
    for (const contract of release.contracts) {
      const contractRoot =
        'contracts/' + component.id + '/' + contract.contractId + '/' + contract.version;
      const artifactEntries = [];
      for (const artifact of contract.artifacts) {
        const artifactText = await readSource(artifact.path, contract.source.ref);
        const digest = sha256(artifactText);
        const publicPath = contractRoot + '/' + artifact.path;
        addPublicFile(publicFiles, publicPath, artifactText, digest);
        let summary = null;
        let summaryRole = null;
        if (artifact.publish.includes('render')) {
          summaryRole =
            contract.contractId +
            '-' +
            contract.version +
            '-' +
            path.posix.basename(artifact.path).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
          if (artifact.kind === 'openapi' || artifact.kind === 'json-schema') {
            const summarySource = {
              kind: artifact.kind,
              role: summaryRole,
              path: artifact.path,
              publish:
                artifact.kind === 'openapi'
                  ? ['metadata', 'operations', 'fields', 'enums', 'examples']
                  : ['metadata', 'fields', 'enums', 'examples'],
            };
            summary =
              artifact.kind === 'openapi'
                ? summarizeOpenApi(parseYamlDocument(artifactText, summarySource), summarySource)
                : summarizeJsonSchema(parseYamlDocument(artifactText, summarySource), summarySource);
          } else if (artifact.kind === 'specification' && artifact.mediaType === 'text/markdown') {
            const rendered = renderPublicMarkdown(artifactText, {
              repository: component.repository,
              commit: contract.source.ref,
              path: artifact.path,
              role: summaryRole,
            });
            summary = {
              kind: 'specification',
              role: summaryRole,
              path: artifact.path,
              title: rendered.title,
              html: rendered.html,
            };
          } else if (artifact.kind === 'other' && artifact.mediaType === 'application/json') {
            const json = JSON.parse(artifactText);
            summary = {
              kind: 'other',
              role: summaryRole,
              path: artifact.path,
              title: path.posix.basename(artifact.path),
              text: JSON.stringify(json, null, 2),
            };
          } else {
            throw new Error(
              component.id + '/' + contract.contractId + ': artifact ' + artifact.path +
                ' declares render but has no renderer for ' + artifact.kind + ' ' + artifact.mediaType,
            );
          }
          summary.sha256 = digest;
          summary.rawPublicPath = '/' + publicPath;
        }
        artifactEntries.push({
          kind: artifact.kind,
          sourcePath: artifact.path,
          mediaType: artifact.mediaType,
          publish: artifact.publish,
          publicPath: '/' + publicPath,
          sha256: digest,
          summaryRole,
          summary,
        });
      }
      const provenance = {
        component: component.id,
        repository: component.repository,
        releaseId: release.releaseId,
        contractId: contract.contractId,
        version: contract.version,
        lifecycleStatus: contract.lifecycleStatus,
        sourceCommit: contract.source.ref,
        releaseRecord: {
          sourcePath: release.releaseRecord.path,
          sourceCommit: release.releaseRecord.ref,
          publicPath: '/' + recordPath,
          sha256: recordDigest,
        },
        artifacts: artifactEntries.map(({ summary, summaryRole, ...artifactEntry }) => artifactEntry),
      };
      const provenanceText = JSON.stringify(provenance, null, 2) + '\n';
      addPublicFile(
        publicFiles,
        contractRoot + '/provenance.json',
        provenanceText,
        sha256(provenanceText),
      );
      contractEntries.push({
        contractId: contract.contractId,
        version: contract.version,
        lifecycleStatus: contract.lifecycleStatus,
        sourceCommit: contract.source.ref,
        provenancePath: '/' + contractRoot + '/provenance.json',
        provenanceSha256: sha256(provenanceText),
        artifacts: artifactEntries,
      });
    }
    releases.push({
      releaseId: release.releaseId,
      releaseRecord: {
        sourcePath: release.releaseRecord.path,
        sourceCommit: release.releaseRecord.ref,
        publicPath: '/' + recordPath,
        sha256: recordDigest,
        title: renderedRecord.title,
        html: renderedRecord.html,
      },
      contracts: contractEntries,
    });
  }

  const views = buildPresentation(component, sources);
  const source = {
    repository: component.repository,
    ref: context.sourceRef || context.ref,
    commit: revision.commit,
    commitDate: revision.commitDate,
    publicDocsManifest: component.manifest || 'docs/public-docs.yaml',
    manifestSha256: sha256(manifestText),
  };
  if (component.presentation?.semantics?.facts) {
    source.factSchema = sourceByRole(sources, component.presentation.semantics.facts.sourceRole).path;
  }
  if (component.presentation?.semantics?.operations) {
    source.operationSchema = sourceByRole(sources, component.presentation.semantics.operations.sourceRole).path;
  }
  const snapshot = {
    schemaVersion: 'connectionagent.io/ca-docs-snapshot/v2',
    component: component.id,
    sourceComponent: manifest.component,
    title: manifest.title || component.title || { zh: manifest.component, en: manifest.component },
    source,
    sources,
    releases,
    publicDocs: {
      apiVersion: manifest.apiVersion,
      kind: manifest.kind,
      manifest: component.manifest || 'docs/public-docs.yaml',
      contracts: views.contracts,
    },
    ...views,
    sync: { mode: 'published', detail: null },
  };
  return { snapshot, publicFiles: [...publicFiles.values()] };
}

async function writeImmutableFile(publicPath, content, expectedSha) {
  const destination = path.resolve('public', publicPath);
  const digest = expectedSha || sha256(content);
  try {
    const existing = await fs.readFile(destination, 'utf8');
    if (sha256(existing) !== digest) {
      throw new Error('immutable public artifact changed at ' + publicPath);
    }
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content, 'utf8');
}

export async function syncManifest(component) {
  const snapshotPath = path.resolve('data/generated', component.id + '.json');
  const { owner, repo } = splitRepository(component.repository);
  const context = { owner, repo, ref: component.ref || 'main' };

  if (!token) {
    if (strict) throw new Error('CA_DOCS_SOURCE_TOKEN is required in strict sync mode');
    console.log(component.id + ': no source token; using the committed published snapshot');
    return;
  }

  try {
    const revision = await sourceRevision(context);
    const pinnedContext = pinSourceContext(context, revision);
    const manifestPath = component.manifest || 'docs/public-docs.yaml';
    const manifestText = await fetchText(pinnedContext, manifestPath);
    const result = await buildSnapshot(
      component,
      manifestText,
      pinnedContext,
      revision,
      (sourcePath, sourceRef = pinnedContext.ref) =>
        fetchText({ ...pinnedContext, ref: sourceRef }, sourcePath),
    );

    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(result.snapshot, null, 2) + '\n', 'utf8');
    for (const file of result.publicFiles) {
      await writeImmutableFile(file.path, file.content, file.sha256);
    }
    console.log(
      component.id +
        ': refreshed ' +
        result.snapshot.sources.length +
        ' sources and ' +
        result.snapshot.releases.length +
        ' releases from ' +
        revision.commit,
    );
  } catch (error) {
    if (strict) throw error;
    console.warn(component.id + ': upstream refresh failed; committed snapshot retained: ' + error.message);
  }
}
