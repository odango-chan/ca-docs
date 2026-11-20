import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { pinSourceContext } from './source-revision.mjs';
import { parseManifest, validateSourcePath } from './public-docs-manifest.mjs';

const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const strict = process.env.CA_DOCS_SYNC_STRICT === '1';

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

async function fetchBytes(context, sourcePath) {
  const rel = validateSourcePath(sourcePath);
  const url = `https://api.github.com/repos/${context.owner}/${context.repo}/contents/${rel}?ref=${encodeURIComponent(context.ref)}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) throw new Error(`failed to fetch declared source ${rel}: HTTP ${response.status}`);
  const body = await response.json();
  if (!body?.content || body.encoding !== 'base64') throw new Error(`unexpected response while reading ${rel}`);
  return Buffer.from(body.content.replace(/\n/g, ''), 'base64');
}

async function fetchText(context, sourcePath) {
  return (await fetchBytes(context, sourcePath)).toString('utf8');
}
async function sourceRevision(context) {
  const response = await fetch(`https://api.github.com/repos/${context.owner}/${context.repo}/commits/${encodeURIComponent(context.ref)}`, { headers: headers() });
  if (!response.ok) throw new Error(`failed to resolve source ref ${context.ref}: HTTP ${response.status}`);
  const body = await response.json();
  return {
    commit: body?.sha || null,
    commitDate: body?.commit?.committer?.date || body?.commit?.author?.date || null,
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
    publish: [...publish],
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
      publish: [...publish],
      language: source.language || null,
      body: publish.has('body') ? sourceText : null,
    };
  }
  if (source.kind === 'implementation-check') {
    return {
      kind: source.kind,
      role: source.role || null,
      path: source.path,
      publish: [...publish],
      implementationSummary: publish.has('implementation-summary')
        ? `Declared implementation source is present at the pinned source revision (${sourceText.length} characters).`
        : null,
    };
  }
  throw new Error(`unsupported public-doc source kind ${source.kind}`);
}

export async function buildSnapshot(component, manifestText, context, revision, readSource = (sourcePath) => fetchText(context, sourcePath)) {
  const manifest = parseManifest(manifestText, component.sourceIdentity || component.id);
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

function inferMediaType(sourcePath, fallback = 'application/octet-stream') {
  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === '.yaml' || extension === '.yml') return 'application/yaml';
  if (extension === '.json') return 'application/json';
  if (extension === '.md' || extension === '.markdown') return 'text/markdown';
  if (extension === '.txt') return 'text/plain';
  return fallback;
}

async function writeImmutableArtifact(relativePath, content) {
  const rel = validateSourcePath(relativePath);
  const root = path.resolve('public');
  const target = path.resolve(root, ...rel.split('/'));
  if (!target.startsWith(root + path.sep)) throw new Error(`public artifact path escapes public/: ${rel}`);
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const current = await fs.readFile(target);
    const currentHash = createHash('sha256').update(current).digest('hex');
    if (currentHash !== sha256) {
      throw new Error(`immutable artifact conflict at public/${rel}: existing SHA-256 ${currentHash}, incoming ${sha256}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  return { path: rel, sha256, size: bytes.length };
}

async function publishManifestArtifacts(component, manifest, context, revision) {
  const rawArtifacts = [];
  for (const source of manifest.sources) {
    if (!(source.publish || []).includes('raw')) continue;
    if (!['openapi', 'json-schema'].includes(source.kind)) {
      throw new Error(`raw publication is not supported for source kind ${source.kind}`);
    }
    const bytes = await fetchBytes(context, source.path);
    const relativePath = `source-artifacts/${component.id}/${revision.commit}/${source.path}`;
    const written = await writeImmutableArtifact(relativePath, bytes);
    rawArtifacts.push({
      sourcePath: source.path,
      kind: source.kind,
      url: written.path,
      mediaType: inferMediaType(source.path),
      sha256: written.sha256,
      size: written.size,
      sourceCommit: revision.commit,
    });
  }

  const releases = [];
  for (const release of manifest.releases) {
    const recordContext = { ...context, ref: release.releaseRecord.ref };
    const recordBytes = await fetchBytes(recordContext, release.releaseRecord.path);
    const recordPath = `releases/${component.id}/${release.releaseId}/${path.basename(release.releaseRecord.path)}`;
    const record = await writeImmutableArtifact(recordPath, recordBytes);
    const contracts = [];

    for (const contract of release.contracts) {
      const artifacts = [];
      if (release.publicationStatus !== 'WITHDRAWN') {
        const contractContext = { ...context, ref: contract.source.ref };
        for (const artifact of contract.artifacts) {
          const bytes = await fetchBytes(contractContext, artifact.path);
          const publicPath = `contracts/${component.id}/${contract.contractId}/${contract.version}/${artifact.path}`;
          const written = await writeImmutableArtifact(publicPath, bytes);
          artifacts.push({
            kind: artifact.kind,
            title: artifact.title || path.basename(artifact.path),
            language: artifact.language || null,
            sourcePath: artifact.path,
            url: written.path,
            mediaType: artifact.mediaType,
            sha256: written.sha256,
            size: written.size,
          });
        }
      }

      const provenance = {
        owner: component.repository,
        component: component.id,
        releaseId: release.releaseId,
        publicationStatus: release.publicationStatus,
        contractId: contract.contractId,
        version: contract.version,
        lifecycleStatus: contract.lifecycleStatus,
        latest: contract.latest === true,
        sourceCommit: contract.source.ref,
        releaseRecord: {
          sourceCommit: release.releaseRecord.ref,
          sourcePath: release.releaseRecord.path,
          url: record.path,
          sha256: record.sha256,
        },
        artifacts,
      };
      const provenancePath = `contracts/${component.id}/${contract.contractId}/${contract.version}/.ca-provenance.json`;
      await writeImmutableArtifact(provenancePath, JSON.stringify(provenance, null, 2) + '\n');
      contracts.push(provenance);
    }

    releases.push({
      releaseId: release.releaseId,
      publicationStatus: release.publicationStatus,
      releaseRecord: {
        sourcePath: release.releaseRecord.path,
        sourceCommit: release.releaseRecord.ref,
        url: record.path,
        sha256: record.sha256,
      },
      contracts,
    });
  }

  const catalog = {
    component: component.id,
    owner: component.repository,
    sourceCommit: revision.commit,
    generatedAt: new Date().toISOString(),
    releases,
  };
  const catalogPath = path.resolve('data/catalog', `${component.id}.json`);
  await fs.mkdir(path.dirname(catalogPath), { recursive: true });
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  return { rawArtifacts, catalog };
}

export async function buildCatalogIndex() {
  const directory = path.resolve('data/catalog');
  let files = [];
  try {
    files = (await fs.readdir(directory)).filter((name) => name.endsWith('.json') && !['contracts.json', 'releases.json'].includes(name));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const catalogs = await Promise.all(files.map(async (name) => JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))));
  const releases = catalogs.flatMap((catalog) => (catalog.releases || []).map((release) => ({
    component: catalog.component,
    owner: catalog.owner,
    ...release,
  })));
  const contracts = releases.flatMap((release) => release.contracts.map((contract) => ({
    component: release.component,
    owner: release.owner,
    releaseId: release.releaseId,
    publicationStatus: release.publicationStatus,
    ...contract,
  })));
  const identities = contracts.map((contract) => `${contract.contractId}@${contract.version}`);
  if (new Set(identities).size !== identities.length) {
    throw new Error('duplicate Contract ID + Version across Owner catalogs');
  }
  const latest = contracts.filter((contract) => contract.latest);
  if (new Set(latest.map((contract) => contract.contractId)).size !== latest.length) {
    throw new Error('multiple latest pointers for a Contract ID across Owner catalogs');
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'contracts.json'), JSON.stringify({ contracts }, null, 2) + '\n');
  await fs.writeFile(path.join(directory, 'releases.json'), JSON.stringify({ releases }, null, 2) + '\n');
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
