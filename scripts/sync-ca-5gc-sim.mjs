import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const strict = process.env.CA_DOCS_SYNC_STRICT === '1';
const snapshotPath = path.resolve('data/generated/ca-5gc-sim.json');

async function snapshotExists() {
  try {
    await fs.access(snapshotPath);
    return true;
  } catch {
    return false;
  }
}

export function sourceIdentityMatches(manifest, component) {
  return manifest?.component === (component.sourceIdentity || component.id);
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ca-docs-sync',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function splitRepository(repository) {
  const parts = String(repository || '').split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error(`invalid component repository ${repository}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

async function fetchRepoText(ctx, relativePath) {
  const url =
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/contents/${relativePath}` +
    `?ref=${encodeURIComponent(ctx.ref)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`failed to fetch ${relativePath}: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!payload?.content || payload.encoding !== 'base64') {
    throw new Error(`unexpected GitHub contents response for ${relativePath}`);
  }
  return Buffer.from(payload.content.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function sourceRevision(ctx) {
  const response = await fetch(
    `https://api.github.com/repos/${ctx.owner}/${ctx.repo}/branches/${encodeURIComponent(ctx.ref)}`,
    { headers: githubHeaders() },
  );
  if (!response.ok) {
    throw new Error(`failed to resolve source ref: HTTP ${response.status}`);
  }
  const payload = await response.json();
  return {
    commit: payload?.commit?.sha || null,
    commitDate:
      payload?.commit?.commit?.committer?.date ||
      payload?.commit?.commit?.author?.date ||
      null,
  };
}

function requireSource(manifest, role, kind, requiredPublish = []) {
  const source = (manifest.sources || []).find(
    (item) => item?.role === role && item?.kind === kind,
  );
  if (!source) {
    throw new Error(`public docs manifest missing ${kind} source role=${role}`);
  }
  const publish = new Set(source.publish || []);
  for (const item of requiredPublish) {
    if (!publish.has(item)) {
      throw new Error(`public docs source role=${role} does not allow publish=${item}`);
    }
  }
  return source;
}

function classifyRoute(routePath) {
  if (routePath.startsWith('/internal/fabric/')) return 'Fabric integration';
  if (routePath.startsWith('/internal/')) return 'Host control';
  if (routePath === '/identity' || routePath === '/healthz') return 'Diagnostics';
  return 'Owner API';
}

function resolveLocalSource(originPath, refValue) {
  if (!refValue || refValue.startsWith('#')) return null;
  const [base] = refValue.split('#');
  if (!base || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(base)) return null;
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(originPath), base.replace(/^\.\//, '')),
  );
}

function resolveResponse(document, response) {
  if (response?.$ref?.startsWith('#/components/responses/')) {
    const name = response.$ref.split('/').at(-1);
    return document.components?.responses?.[name] || response;
  }
  return response;
}

function openApiRoutes(document, sourcePath) {
  const routes = [];
  for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      const operation = pathItem?.[method];
      if (!operation) continue;

      const requestSchemaRef =
        operation.requestBody?.content?.['application/json']?.schema?.$ref || null;

      const responses = Object.entries(operation.responses || {}).map(([status, raw]) => {
        const response = resolveResponse(document, raw);
        const responseSchemaRef =
          response?.content?.['application/json']?.schema?.$ref || null;
        return {
          status,
          description: response?.description || '',
          schema: resolveLocalSource(sourcePath, responseSchemaRef),
        };
      });

      routes.push({
        method: method.toUpperCase(),
        path: routePath,
        operationId: operation.operationId || null,
        description: operation.description || '',
        request: requestSchemaRef
          ? {
              required: operation.requestBody?.required === true,
              contentType: 'application/json',
              schema: resolveLocalSource(sourcePath, requestSchemaRef),
            }
          : null,
        responses,
      });
    }
  }
  return routes;
}

function implementationRoutes(serverSource) {
  const routes = [];
  const pattern = /HandleFunc\("([A-Z]+)\s+([^"]+)"/g;
  for (const match of serverSource.matchAll(pattern)) {
    routes.push({ method: match[1], path: match[2] });
  }
  return routes;
}

function fieldType(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type) return Array.isArray(node.type) ? node.type.join(' | ') : node.type;
  if (Object.prototype.hasOwnProperty.call(node, 'const')) return 'const';
  if (node.enum) return 'enum';
  if (node.$ref) return 'ref';
  if (node.oneOf) return 'oneOf';
  if (node.allOf) return 'allOf';
  return null;
}

function publicRef(refValue) {
  if (!refValue || typeof refValue !== 'string') return null;
  const [base, fragment] = refValue.split('#');
  if (!base) return fragment ? `#${fragment}` : refValue;
  return `${path.posix.basename(base)}${fragment ? `#${fragment}` : ''}`;
}

function collectFields(node, prefix, allowEnums, out) {
  if (!node || typeof node !== 'object' || !node.properties) return;
  const required = new Set(Array.isArray(node.required) ? node.required : []);
  for (const [name, child] of Object.entries(node.properties)) {
    if (!child || typeof child !== 'object') continue;
    const fieldPath = prefix ? `${prefix}.${name}` : name;
    const entry = {
      path: fieldPath,
      required: required.has(name),
      type: fieldType(child),
      description: child.description || null,
      ref: publicRef(child.$ref),
      oneOfRefs: Array.isArray(child.oneOf)
        ? child.oneOf.map((item) => publicRef(item?.$ref)).filter(Boolean)
        : [],
    };
    if (Object.prototype.hasOwnProperty.call(child, 'const')) entry.const = child.const;
    if (allowEnums && Array.isArray(child.enum)) entry.enum = child.enum;
    out.push(entry);
    collectFields(child, fieldPath, allowEnums, out);
  }
}

function collectConditionalRules(node, prefix, allowEnums, out) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node.allOf)) {
    for (const branch of node.allOf) {
      if (!branch?.if || !branch?.then) continue;
      const when = {};
      for (const [name, condition] of Object.entries(branch.if.properties || {})) {
        const fieldPath = prefix ? `${prefix}.${name}` : name;
        if (Object.prototype.hasOwnProperty.call(condition || {}, 'const')) {
          when[fieldPath] = [condition.const];
        } else if (allowEnums && Array.isArray(condition?.enum)) {
          when[fieldPath] = condition.enum;
        }
      }

      const fields = [];
      collectFields(
        {
          properties: branch.then.properties || {},
          required: branch.then.required || [],
        },
        prefix,
        allowEnums,
        fields,
      );

      if (Object.keys(when).length || fields.length || (branch.then.required || []).length) {
        out.push({
          scope: prefix || null,
          when,
          required: (branch.then.required || []).map((name) =>
            prefix ? `${prefix}.${name}` : name,
          ),
          fields,
        });
      }
    }
  }

  for (const [name, child] of Object.entries(node.properties || {})) {
    const childPrefix = prefix ? `${prefix}.${name}` : name;
    collectConditionalRules(child, childPrefix, allowEnums, out);
  }
}

function summarizeSchema(source, document) {
  const publish = new Set(source.publish || []);
  const summary = {
    kind: source.kind,
    path: source.path,
    role: source.role || null,
    publish: [...publish],
  };
  if (publish.has('metadata')) {
    summary.title = document.title || null;
    summary.description = document.description || null;
  }
  if (publish.has('fields')) {
    const fields = [];
    const rules = [];
    collectFields(document, '', publish.has('enums'), fields);
    collectConditionalRules(document, '', publish.has('enums'), rules);
    summary.fields = fields;
    summary.rules = rules;
  }
  if (publish.has('enums')) {
    summary.enums = {};
    for (const field of summary.fields || []) {
      if (Array.isArray(field.enum)) summary.enums[field.path] = field.enum;
    }
  }
  summary.examplesAllowed = publish.has('examples');
  return summary;
}

async function useSnapshot(reason) {
  if (strict) throw reason;
  if (!(await snapshotExists())) throw reason;
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  console.warn(
    `ca-5gc-sim: upstream refresh unavailable (${reason.message}); using published snapshot ${snapshot.source?.commit || snapshot.source?.ref || 'unknown'}`,
  );
}

export async function syncCa5gcSim(component) {
  const { owner, repo } = splitRepository(component.repository);
  const ref = process.env.CA_5GC_SIM_REF || component.ref || 'main';
  const manifestPath = component.manifest || 'docs/public-docs.yaml';
  const ctx = { owner, repo, ref };

  if (!token) {
    if (strict) {
      throw new Error('CA_DOCS_SOURCE_TOKEN is required in strict sync mode');
    }
    if (!(await snapshotExists())) {
      throw new Error(
        'CA_DOCS_SOURCE_TOKEN is not configured and no checked-in ca-5gc-sim snapshot exists',
      );
    }
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
    console.log(
      `ca-5gc-sim: using published snapshot ${snapshot.source?.commit || snapshot.source?.ref || 'unknown'}`,
    );
    return;
  }

  try {
    const revision = await sourceRevision(ctx);
    if (!revision.commit) throw new Error(`source ref ${ctx.ref} did not resolve to an immutable commit SHA`);
    // Resolve the moving ref once and pin every source read to that commit.
    const pinnedCtx = { ...ctx, ref: revision.commit, sourceRef: ctx.ref };
    const manifestText = await fetchRepoText(pinnedCtx, manifestPath);
    const manifest = yaml.load(manifestText);

    if (
      !manifest ||
      manifest.apiVersion !== 'connectionagent.io/v1alpha1' ||
      manifest.kind !== 'PublicDocsManifest' ||
      !sourceIdentityMatches(manifest, component)
    ) {
      throw new Error(`invalid PublicDocsManifest at ${manifestPath}`);
    }

    const openApiSource = requireSource(manifest, 'owner-provider-http-api', 'openapi', ['operations']);
    const factSource = requireSource(manifest, 'fact-inventory', 'json-schema', ['enums']);
    const operationSource = requireSource(manifest, 'operation-inventory', 'json-schema', ['enums']);
    const implementationSource = requireSource(
      manifest,
      'http-route-registration',
      'implementation-check',
      ['implementation-summary'],
    );

    const publicSchemaSources = (manifest.sources || []).filter(
      (source) =>
        source?.kind === 'json-schema' &&
        (source.publish || []).some((item) => item === 'metadata' || item === 'fields' || item === 'enums'),
    );

    const texts = await Promise.all([
      fetchRepoText(pinnedCtx, openApiSource.path),
      fetchRepoText(pinnedCtx, factSource.path),
      fetchRepoText(pinnedCtx, operationSource.path),
      fetchRepoText(pinnedCtx, implementationSource.path),
      ...publicSchemaSources.map((source) => fetchRepoText(pinnedCtx, source.path)),
    ]);

    const [openApiText, factSchemaText, operationSchemaText, serverSource, ...schemaTexts] = texts;
    const openApi = yaml.load(openApiText);
    const factSchema = yaml.load(factSchemaText);
    const operationSchema = yaml.load(operationSchemaText);

    const facts = factSchema?.properties?.spec?.properties?.factSemantic?.enum || [];
    const operations =
      operationSchema?.properties?.spec?.properties?.operationSemantic?.enum || [];

    if (!facts.length || !operations.length) {
      throw new Error('manifest sources parsed, but semantic inventories are empty');
    }

    const contracts = publicSchemaSources.map((source, index) =>
      summarizeSchema(source, yaml.load(schemaTexts[index])),
    );

    const documented = openApiRoutes(openApi, openApiSource.path);
    const implemented = implementationRoutes(serverSource);
    const documentedByKey = new Map(
      documented.map((route) => [`${route.method} ${route.path}`, route]),
    );
    const implementedByKey = new Map(
      implemented.map((route) => [`${route.method} ${route.path}`, route]),
    );
    const keys = [...new Set([...documentedByKey.keys(), ...implementedByKey.keys()])].sort();

    const routes = keys.map((key) => {
      const doc = documentedByKey.get(key);
      const impl = implementedByKey.get(key);
      const selected = impl || doc;
      return {
        method: selected.method,
        path: selected.path,
        surface: classifyRoute(selected.path),
        operationId: doc?.operationId || null,
        description: doc?.description || '',
        request: doc?.request || null,
        responses: doc?.responses || [],
        documented: Boolean(doc),
        implemented: Boolean(impl),
      };
    });

    const output = {
      component: component.id,
      source: {
        repository: component.repository,
        ref: ctx.sourceRef || ctx.ref,
        commit: revision.commit,
        commitDate: revision.commitDate,
        private: true,
        publicDocsManifest: manifestPath,
        openApi: openApiSource.path,
        factSchema: factSource.path,
        operationSchema: operationSource.path,
        httpServer: implementationSource.path,
      },
      publicDocs: {
        apiVersion: manifest.apiVersion,
        kind: manifest.kind,
        manifest: manifestPath,
        contracts,
      },
      counts: {
        facts: facts.length,
        operations: operations.length,
        documentedRoutes: documented.length,
        implementationRoutes: implemented.length,
      },
      facts,
      operations,
      routes,
      drift: {
        implementationOnlyRoutes: routes.filter(
          (route) => route.implemented && !route.documented,
        ),
        documentedOnlyRoutes: routes.filter(
          (route) => route.documented && !route.implemented,
        ),
      },
      sync: {
        mode: 'published',
      },
    };

    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, JSON.stringify(output, null, 2) + '\n');

    console.log(
      `ca-5gc-sim: refreshed via ${manifestPath}: ${facts.length} facts, ${operations.length} operations, ${implemented.length} implementation routes from ${revision.commit}`,
    );
  } catch (error) {
    await useSnapshot(error instanceof Error ? error : new Error(String(error)));
  }
}
