import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { pinSourceContext } from './source-revision.mjs';
import Ajv2020 from 'ajv/dist/2020.js';

const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const strict = process.env.CA_DOCS_SYNC_STRICT === '1';
const manifestSchema = yaml.load(await fs.readFile('schemas/v1alpha1/public-docs-manifest.schema.yaml', 'utf8'));
const validateManifestSchema = new Ajv2020({ allErrors: true }).compile(manifestSchema);

export function validateSourcePath(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.startsWith('/') || sourcePath.includes('\\')) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  const segments = sourcePath.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  return sourcePath;
}

function assertManifest(manifest, component) {
  if (!validateManifestSchema(manifest)) {
    const detail = validateManifestSchema.errors?.map((error) => `${error.instancePath} ${error.message}`).join('; ');
    throw new Error(`invalid PublicDocsManifest: ${detail}`);
  }
  if (manifest.component !== component.id) {
    throw new Error(`manifest component ${manifest.component} does not match registry ${component.id}`);
  }
  for (const source of manifest.sources) validateSourcePath(source.path);
}

function headers() {
  const result = { Accept: 'application/vnd.github+json', 'User-Agent': 'ca-docs-manifest-sync' };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

function splitRepository(value) {
  const parts = String(value || '').split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) throw new Error(`invalid repository ${value}`);
  return { owner: parts[0], repo: parts[1] };
}

async function fetchText(context, sourcePath) {
  const rel = validateSourcePath(sourcePath);
  const url = `https://api.github.com/repos/${context.owner}/${context.repo}/contents/${rel}?ref=${encodeURIComponent(context.ref)}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`failed to fetch declared source ${rel}: HTTP ${response.status}`);
  const body = await response.json();
  if (!body?.content || body.encoding !== 'base64') throw new Error(`unexpected response while reading ${rel}`);
  return Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function sourceRevision(context) {
  const response = await fetch(`https://api.github.com/repos/${context.owner}/${context.repo}/branches/${encodeURIComponent(context.ref)}`, { headers: headers() });
  if (!response.ok) throw new Error(`failed to resolve source ref ${context.ref}: HTTP ${response.status}`);
  const body = await response.json();
  return {
    commit: body?.commit?.sha || null,
    commitDate: body?.commit?.commit?.committer?.date || body?.commit?.commit?.author?.date || null,
  };
}

function schemaName(ref) {
  if (typeof ref !== 'string') return null;
  const marker = '#/components/schemas/';
  return ref.includes(marker) ? ref.slice(ref.indexOf(marker) + marker.length) : null;
}

function fieldType(schema) {
  if (Object.hasOwn(schema || {}, 'const')) return 'const';
  if (Array.isArray(schema?.enum)) return 'enum';
  if (schema?.type) return Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (schema?.$ref) return 'ref';
  if (schema?.oneOf) return 'oneOf';
  if (schema?.allOf) return 'allOf';
  return null;
}

function collectFields(schema, publish, prefix = '', output = []) {
  if (!schema || typeof schema !== 'object') return output;
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  for (const [name, child] of Object.entries(schema.properties || {})) {
    const fieldPath = prefix ? `${prefix}.${name}` : name;
    const field = {
      path: fieldPath,
      required: required.has(name),
      type: fieldType(child),
      description: typeof child.description === 'string' ? child.description : null,
      ref: schemaName(child.$ref),
    };
    if (publish.has('enums') && Array.isArray(child.enum)) field.enum = child.enum;
    if (publish.has('enums') && Object.hasOwn(child, 'const')) field.const = child.const;
    output.push(field);
    collectFields(child, publish, fieldPath, output);
  }
  return output;
}

function summarizeOpenApi(document, source) {
  const publish = new Set(source.publish || []);
  const result = {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    metadata: publish.has('metadata') ? {
      title: document.info?.title || source.role || 'API',
      description: document.info?.description || '',
      version: document.info?.version || null,
    } : null,
  };
  const schemas = document.components?.schemas || {};
  if (publish.has('fields')) {
    result.schemas = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, {
      title: schema.title || name,
      description: schema.description || null,
      fields: collectFields(schema, publish),
    }]));
  } else {
    result.schemas = {};
  }
  if (publish.has('operations')) {
    result.operations = [];
    for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
      for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
        const operation = pathItem?.[method];
        if (!operation) continue;
        const item = {
          method: method.toUpperCase(),
          path: routePath,
          operationId: operation.operationId || null,
          summary: operation.summary || '',
          description: operation.description || '',
          responses: Object.entries(operation.responses || {}).map(([status, value]) => ({
            status,
            description: value?.description || '',
            schema: schemaName(value?.content?.['application/json']?.schema?.$ref),
          })),
        };
        const request = operation.requestBody?.content?.['application/json'];
        const requestSchema = schemaName(request?.schema?.$ref);
        if (requestSchema) item.request = { schema: requestSchema };
        if (publish.has('examples') && request) {
          const examples = Object.values(request.examples || {}).map((entry) => entry?.value).filter((value) => value !== undefined);
          if (examples.length) item.examples = examples;
        }
        result.operations.push(item);
      }
    }
  } else {
    result.operations = [];
  }
  return result;
}

function summarizeJsonSchema(document, source) {
  const publish = new Set(source.publish || []);
  return {
    kind: source.kind,
    role: source.role || null,
    path: source.path,
    metadata: publish.has('metadata') ? {
      id: document.$id || null,
      title: source.role || document.title || path.basename(source.path),
      description: document.description || '',
    } : null,
    fields: publish.has('fields') ? collectFields(document, publish) : [],
    enum: publish.has('enums') && Array.isArray(document.enum) ? document.enum : null,
  };
}

export function summarizeDeclaredSource(source, sourceText) {
  const publish = new Set(source.publish || []);
  if (source.kind === 'openapi') return summarizeOpenApi(yaml.load(sourceText), source);
  if (source.kind === 'json-schema') return summarizeJsonSchema(yaml.load(sourceText), source);
  if (source.kind === 'markdown') {
    return {
      kind: source.kind,
      role: source.role || null,
      path: source.path,
      language: source.language || null,
      body: publish.has('body') ? sourceText : null,
    };
  }
  if (source.kind === 'implementation-check') {
    return {
      kind: source.kind,
      role: source.role || null,
      path: source.path,
      implementationSummary: publish.has('implementation-summary')
        ? `Declared implementation source is present at the pinned source revision (${sourceText.length} characters).`
        : null,
    };
  }
  throw new Error(`unsupported public-doc source kind ${source.kind}`);
}

export async function buildSnapshot(component, manifestText, context, revision, readSource = (sourcePath) => fetchText(context, sourcePath)) {
  const manifest = yaml.load(manifestText);
  assertManifest(manifest, component);
  const sources = await Promise.all(manifest.sources.map(async (source) => {
    const text = await readSource(source.path);
    return summarizeDeclaredSource(source, text);
  }));
  return {
    component: manifest.component,
    title: manifest.title || component.title || { zh: manifest.component, en: manifest.component },
    source: {
      repository: component.repository,
      ref: context.sourceRef || context.ref,
      commit: revision.commit,
      commitDate: revision.commitDate,
      private: true,
      publicDocsManifest: component.manifest || 'docs/public-docs.yaml',
    },
    sources,
    sync: { mode: 'published', detail: null },
  };
}

async function fallback(snapshotPath, error) {
  if (strict) throw error;
  try {
    const current = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
    console.warn(`${current.component}: ${error.message}; using published snapshot ${current.source?.commit || 'unknown'}`);
  } catch {
    throw error;
  }
}

export async function syncManifest(component) {
  const snapshotPath = path.resolve('data/generated', `${component.id}.json`);
  const { owner, repo } = splitRepository(component.repository);
  const context = { owner, repo, ref: component.ref || 'main' };
  if (!token) {
    if (strict) throw new Error('CA_DOCS_SOURCE_TOKEN is required in strict sync mode');
    return fallback(snapshotPath, new Error('source token not configured'));
  }
  try {
    const rev = await sourceRevision(context);
    // Resolve the moving ref once, then read the manifest and every declared file
    // from that exact commit. This prevents a moving branch from producing a
    // snapshot whose provenance points at a different revision than its content.
    const pinnedContext = pinSourceContext(context, rev);
    const manifestText = await fetchText(pinnedContext, component.manifest || 'docs/public-docs.yaml');
    const snapshot = await buildSnapshot(
      component,
      manifestText,
      pinnedContext,
      rev,
      (sourcePath) => fetchText(pinnedContext, sourcePath),
    );
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`${component.id}: refreshed ${snapshot.sources.length} declared public sources from ${rev.commit}`);
  } catch (error) {
    await fallback(snapshotPath, error instanceof Error ? error : new Error(String(error)));
  }
}
