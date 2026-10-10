import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const owner = 'odango-chan';
const repo = 'ca-5gc-sim';
const ref = process.env.CA_5GC_SIM_REF || 'main';
const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
const snapshotPath = path.resolve('data/generated/ca-5gc-sim.json');

async function snapshotExists() {
  try {
    await fs.access(snapshotPath);
    return true;
  } catch {
    return false;
  }
}

function githubHeaders(accept = 'application/vnd.github+json') {
  const headers = {
    Accept: accept,
    'User-Agent': 'ca-docs-build',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchRepoText(relativePath) {
  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/${relativePath}` +
    `?ref=${encodeURIComponent(ref)}`;
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

async function sourceCommit() {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(ref)}`,
    { headers: githubHeaders() },
  );
  if (!response.ok) {
    throw new Error(`failed to resolve source ref: HTTP ${response.status}`);
  }
  const payload = await response.json();
  return payload?.commit?.sha || null;
}

function classifyRoute(routePath) {
  if (routePath.startsWith('/internal/fabric/')) return 'Fabric integration';
  if (routePath.startsWith('/internal/')) return 'Host control';
  if (routePath === '/identity' || routePath === '/healthz') return 'Diagnostics';
  return 'Owner API';
}

function openApiRoutes(document) {
  const routes = [];
  for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
      if (pathItem?.[method]) {
        routes.push({
          method: method.toUpperCase(),
          path: routePath,
          operationId: pathItem[method].operationId || null,
        });
      }
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

if (!token) {
  if (!(await snapshotExists())) {
    throw new Error(
      'CA_DOCS_SOURCE_TOKEN is not configured and no checked-in ca-5gc-sim snapshot exists',
    );
  }
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  console.log(
    `ca-5gc-sim: using checked-in snapshot ${snapshot.source?.commit || snapshot.source?.ref || 'unknown'}`,
  );
  process.exit(0);
}

async function useSnapshot(reason) {
  if (!(await snapshotExists())) throw reason;
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  console.warn(
    `ca-5gc-sim: upstream refresh unavailable (${reason.message}); using checked-in snapshot ${snapshot.source?.commit || snapshot.source?.ref || 'unknown'}`,
  );
}

async function refreshFromUpstream() {
  const [openApiText, factSchemaText, operationSchemaText, serverSource, commit] =
    await Promise.all([
      fetchRepoText('schemas/v1alpha1/fivegc-sim.openapi.yaml'),
      fetchRepoText('schemas/v1alpha1/fivegc-sim-fact-read-request.schema.yaml'),
      fetchRepoText('schemas/v1alpha1/fivegc-sim-operation-request.schema.yaml'),
      fetchRepoText('internal/httpapi/server.go'),
      sourceCommit(),
    ]);

  const openApi = yaml.load(openApiText);
  const factSchema = yaml.load(factSchemaText);
  const operationSchema = yaml.load(operationSchemaText);

  const facts = factSchema?.properties?.spec?.properties?.factSemantic?.enum || [];
  const operations =
    operationSchema?.properties?.spec?.properties?.operationSemantic?.enum || [];

  if (!facts.length || !operations.length) {
    throw new Error('upstream schema parsed, but semantic inventories are empty');
  }

  const documented = openApiRoutes(openApi);
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
      documented: Boolean(doc),
      implemented: Boolean(impl),
    };
  });

  const output = {
    component: 'ca-5gc-sim',
    source: {
      repository: `${owner}/${repo}`,
      ref,
      commit,
      openApi: 'schemas/v1alpha1/fivegc-sim.openapi.yaml',
      factSchema: 'schemas/v1alpha1/fivegc-sim-fact-read-request.schema.yaml',
      operationSchema: 'schemas/v1alpha1/fivegc-sim-operation-request.schema.yaml',
      httpServer: 'internal/httpapi/server.go',
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
  };

  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `ca-5gc-sim: refreshed ${facts.length} facts, ${operations.length} operations, ${implemented.length} implementation routes from ${commit}`,
  );
}

try {
  await refreshFromUpstream();
} catch (error) {
  await useSnapshot(error instanceof Error ? error : new Error(String(error)));
}
