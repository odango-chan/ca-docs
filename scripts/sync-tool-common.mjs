import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { pinSourceContext } from './source-revision.mjs';

const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const strict = process.env.CA_DOCS_SYNC_STRICT === '1';
const snapshotPath = path.resolve('data/generated/tool-common.json');

function headers() {
  const out = { Accept: 'application/vnd.github+json', 'User-Agent': 'ca-docs-sync' };
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

function splitRepo(value) {
  const [owner, repo] = String(value || '').split('/');
  if (!owner || !repo) throw new Error(`invalid repository ${value}`);
  return { owner, repo };
}

async function fetchText(ctx, rel) {
  const url = `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${rel}?ref=${encodeURIComponent(ctx.ref)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`failed to fetch ${rel}: HTTP ${res.status}`);
  const body = await res.json();
  if (!body?.content || body.encoding !== 'base64') throw new Error(`unexpected contents response for ${rel}`);
  return Buffer.from(body.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function revision(ctx) {
  const res = await fetch(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/branches/${encodeURIComponent(ctx.ref)}`, { headers: headers() });
  if (!res.ok) throw new Error(`failed to resolve source ref: HTTP ${res.status}`);
  const body = await res.json();
  return {
    commit: body?.commit?.sha || null,
    commitDate: body?.commit?.commit?.committer?.date || body?.commit?.commit?.author?.date || null,
  };
}

function sourceByRole(manifest, role, kind, publish) {
  const source = (manifest.sources || []).find((s) => s.role === role && s.kind === kind);
  if (!source) throw new Error(`manifest missing ${kind} role=${role}`);
  const allowed = new Set(source.publish || []);
  for (const item of publish) if (!allowed.has(item)) throw new Error(`role=${role} does not allow ${item}`);
  return source;
}

function refName(ref) {
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('#/components/schemas/')) return ref.split('/').at(-1);
  return null;
}

function resolveResponse(doc, raw) {
  if (raw?.$ref?.startsWith('#/components/responses/')) {
    return doc.components?.responses?.[raw.$ref.split('/').at(-1)] || raw;
  }
  return raw;
}

function fieldType(node) {
  if (!node || typeof node !== 'object') return null;
  if (Object.prototype.hasOwnProperty.call(node, 'const')) return 'const';
  if (node.enum) return 'enum';
  if (node.type) return Array.isArray(node.type) ? node.type.join(' | ') : node.type;
  if (node.$ref) return 'ref';
  if (node.oneOf) return 'oneOf';
  if (node.allOf) return 'allOf';
  return null;
}

function collectFields(node, prefix, out) {
  if (!node || typeof node !== 'object' || !node.properties) return;
  const required = new Set(Array.isArray(node.required) ? node.required : []);
  for (const [name, child] of Object.entries(node.properties)) {
    if (!child || typeof child !== 'object') continue;
    const p = prefix ? `${prefix}.${name}` : name;
    const item = {
      path: p,
      required: required.has(name),
      type: fieldType(child),
      description: child.description || null,
      ref: refName(child.$ref),
    };
    if (Object.prototype.hasOwnProperty.call(child, 'const')) item.const = child.const;
    if (Array.isArray(child.enum)) item.enum = child.enum;
    out.push(item);
    collectFields(child, p, out);
  }
}

function summarizeSchemas(doc) {
  const out = {};
  for (const [name, schema] of Object.entries(doc.components?.schemas || {})) {
    const fields = [];
    collectFields(schema, '', fields);
    out[name] = { title: schema.title || name, description: schema.description || null, fields };
  }
  return out;
}

function parseRoutes(doc) {
  const routes = [];
  for (const [routePath, item] of Object.entries(doc.paths || {})) {
    for (const method of ['get','post','put','patch','delete','head','options']) {
      const op = item?.[method];
      if (!op) continue;
      const requestSchema = refName(op.requestBody?.content?.['application/json']?.schema?.$ref);
      const exampleEntries = Object.values(op.requestBody?.content?.['application/json']?.examples || {});
      const requestExample = exampleEntries[0]?.value || null;
      const responses = Object.entries(op.responses || {}).map(([status, raw]) => {
        const r = resolveResponse(doc, raw);
        return {
          status,
          description: r?.description || '',
          schema: refName(r?.content?.['application/json']?.schema?.$ref),
        };
      });
      routes.push({
        method: method.toUpperCase(),
        path: routePath,
        operationId: op.operationId || null,
        summary: op.summary || '',
        description: op.description || '',
        request: requestSchema ? { schema: requestSchema, example: requestExample } : null,
        responses,
      });
    }
  }
  return routes;
}

async function fallback(reason) {
  if (strict) throw reason;
  try {
    const current = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
    console.warn(`tool-common: ${reason.message}; using published snapshot ${current.source?.commit || 'unknown'}`);
  } catch {
    throw reason;
  }
}

export async function syncToolCommon(component) {
  const { owner, repo } = splitRepo(component.repository);
  const ctx = { owner, repo, ref: component.ref || 'main' };
  const manifestPath = component.manifest || 'docs/public-docs.yaml';

  if (!token) {
    if (strict) throw new Error('CA_DOCS_SOURCE_TOKEN is required in strict sync mode');
    return fallback(new Error('source token not configured'));
  }

  try {
    const rev = await revision(ctx);
    // Read the manifest and all declared files from the same immutable revision.
    const pinnedCtx = pinSourceContext(ctx, rev);
    const manifestText = await fetchText(pinnedCtx, manifestPath);
    const manifest = yaml.load(manifestText);
    if (!manifest || manifest.kind !== 'PublicDocsManifest' || manifest.component !== component.id) {
      throw new Error(`invalid PublicDocsManifest at ${manifestPath}`);
    }

    const provider = sourceByRole(manifest, 'provider-http-api', 'openapi', ['operations','fields','enums','examples']);
    const control = sourceByRole(manifest, 'control-http-api', 'openapi', ['operations','fields','enums','examples']);
    const markdownRoles = {
      zh: {
        overview: sourceByRole(manifest, 'overview', 'markdown', ['body']),
        subjectIdentity: sourceByRole(manifest, 'subject-identity', 'markdown', ['body']),
        boundaries: sourceByRole(manifest, 'boundaries', 'markdown', ['body']),
      },
      en: {
        overview: sourceByRole(manifest, 'overview-en', 'markdown', ['body']),
        subjectIdentity: sourceByRole(manifest, 'subject-identity-en', 'markdown', ['body']),
        boundaries: sourceByRole(manifest, 'boundaries-en', 'markdown', ['body']),
      },
    };
    sourceByRole(manifest, 'http-route-registration', 'implementation-check', ['implementation-summary']);
    sourceByRole(manifest, 'process-contract-info', 'implementation-check', ['implementation-summary']);

    const allMarkdown = [
      markdownRoles.zh.overview, markdownRoles.zh.subjectIdentity, markdownRoles.zh.boundaries,
      markdownRoles.en.overview, markdownRoles.en.subjectIdentity, markdownRoles.en.boundaries,
    ];
    const [providerText, controlText, ...markdownTexts] = await Promise.all([
      fetchText(pinnedCtx, provider.path),
      fetchText(pinnedCtx, control.path),
      ...allMarkdown.map((source) => fetchText(pinnedCtx, source.path)),
    ]);
    const providerDoc = yaml.load(providerText);
    const controlDoc = yaml.load(controlText);

    const output = {
      component: component.id,
      source: {
        repository: component.repository,
        ref: ctx.sourceRef || ctx.ref,
        commit: rev.commit,
        commitDate: rev.commitDate,
        private: true,
        publicDocsManifest: manifestPath,
      },
      counts: {
        providerRoutes: parseRoutes(providerDoc).length,
        controlRoutes: parseRoutes(controlDoc).length,
      },
      pages: {
        zh: { overview: markdownTexts[0], subjectIdentity: markdownTexts[1], boundaries: markdownTexts[2] },
        en: { overview: markdownTexts[3], subjectIdentity: markdownTexts[4], boundaries: markdownTexts[5] },
      },
      api: {
        provider: {
          title: providerDoc.info?.title || 'Provider API',
          description: providerDoc.info?.description || '',
          routes: parseRoutes(providerDoc),
          schemas: summarizeSchemas(providerDoc),
        },
        control: {
          title: controlDoc.info?.title || 'Control API',
          description: controlDoc.info?.description || '',
          routes: parseRoutes(controlDoc),
          schemas: summarizeSchemas(controlDoc),
        },
      },
      sync: { mode: 'published', detail: null },
    };

    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`tool-common: refreshed via ${manifestPath}: ${output.counts.providerRoutes} provider routes, ${output.counts.controlRoutes} control routes from ${rev.commit}`);
  } catch (error) {
    await fallback(error instanceof Error ? error : new Error(String(error)));
  }
}
