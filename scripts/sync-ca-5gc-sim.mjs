import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const owner = 'odango-chan';
const repo = 'ca-5gc-sim';
const ref = process.env.CA_5GC_SIM_REF || 'main';
const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}`;

async function fetchText(relativePath) {
  const response = await fetch(`${rawBase}/${relativePath}`, {
    headers: { 'User-Agent': 'ca-docs-build' },
  });
  if (!response.ok) {
    throw new Error(`failed to fetch ${relativePath}: HTTP ${response.status}`);
  }
  return response.text();
}

async function sourceCommit() {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
    { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ca-docs-build' } },
  );
  if (!response.ok) return null;
  const payload = await response.json();
  return payload.sha || null;
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

const [openApiText, factSchemaText, operationSchemaText, serverSource, commit] =
  await Promise.all([
    fetchText('schemas/v1alpha1/fivegc-sim.openapi.yaml'),
    fetchText('schemas/v1alpha1/fivegc-sim-fact-read-request.schema.yaml'),
    fetchText('schemas/v1alpha1/fivegc-sim-operation-request.schema.yaml'),
    fetchText('internal/httpapi/server.go'),
    sourceCommit(),
  ]);

const openApi = yaml.load(openApiText);
const factSchema = yaml.load(factSchemaText);
const operationSchema = yaml.load(operationSchemaText);

const facts =
  factSchema?.properties?.spec?.properties?.factSemantic?.enum || [];
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
    openApi:
      'schemas/v1alpha1/fivegc-sim.openapi.yaml',
    factSchema:
      'schemas/v1alpha1/fivegc-sim-fact-read-request.schema.yaml',
    operationSchema:
      'schemas/v1alpha1/fivegc-sim-operation-request.schema.yaml',
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

const targetDir = path.resolve('data/generated');
await fs.mkdir(targetDir, { recursive: true });
await fs.writeFile(
  path.join(targetDir, 'ca-5gc-sim.json'),
  JSON.stringify(output, null, 2) + '\n',
);

console.log(
  `ca-5gc-sim: ${facts.length} facts, ${operations.length} operations, ${implemented.length} implementation routes`,
);
if (output.drift.implementationOnlyRoutes.length) {
  console.log(
    `route drift: ${output.drift.implementationOnlyRoutes.length} implementation route(s) are not in OpenAPI`,
  );
}
