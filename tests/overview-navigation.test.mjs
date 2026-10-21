import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

const root = process.cwd();
const registry = yaml.load(fs.readFileSync(path.join(root, 'data/components.yaml'), 'utf8'));
const components = new Map((registry.components || []).map((component) => [component.id, component]));

const overviewPages = [
  { path: 'src/pages/index.astro', locale: 'zh', kind: 'home' },
  { path: 'src/pages/en/index.astro', locale: 'en', kind: 'home' },
  { path: 'src/pages/architecture/system.astro', locale: 'zh', kind: 'architecture' },
  { path: 'src/pages/en/architecture/system.astro', locale: 'en', kind: 'architecture' },
  { path: 'src/pages/benchmark/index.astro', locale: 'zh', kind: 'benchmark' },
  { path: 'src/pages/en/benchmark/index.astro', locale: 'en', kind: 'benchmark' },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolvePageRoute(target, locale) {
  const url = new URL(target, 'https://site.test');
  let route = url.pathname;

  if (locale === 'en') {
    if (route !== '/en' && !route.startsWith('/en/')) return { exists: false, reason: 'English link is missing the /en prefix' };
    route = route === '/en' ? '/' : route.slice(3);
  } else if (route === '/en' || route.startsWith('/en/')) {
    return { exists: false, reason: 'Chinese page links into the English route' };
  }

  const componentMatch = route.match(/^\/components\/([^/]+)\/?$/);
  if (componentMatch) {
    const componentId = componentMatch[1];
    const explicitPage = path.join(root, 'src', 'pages', locale === 'en' ? 'en' : '', 'components', componentId, 'index.astro');
    if (fs.existsSync(explicitPage)) {
      if (url.hash) {
        const source = fs.readFileSync(explicitPage, 'utf8');
        const anchor = decodeURIComponent(url.hash.slice(1));
        const anchorPattern = new RegExp(`\\bid=["']${escapeRegExp(anchor)}["']`);
        if (!anchorPattern.test(source)) {
          return { exists: false, reason: `no id="${anchor}" anchor in ${path.relative(root, explicitPage)}` };
        }
      }
      return { exists: true };
    }

    const component = components.get(componentId);
    const snapshotPath = path.join(root, 'data', 'generated', `${componentId}.json`);
    if (!component || component.status !== 'active' || component.sync !== 'manifest' || !fs.existsSync(snapshotPath)) {
      return { exists: false, reason: 'component detail route is not generated' };
    }

    if (url.hash) {
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      const role = decodeURIComponent(url.hash.slice(1));
      if (!(snapshot.sources || []).some((source) => source.role === role)) {
        return { exists: false, reason: `unknown source-section anchor #${role}` };
      }
    }
    return { exists: true };
  }

  const relative = route.replace(/^\/+|\/+$/g, '');
  const pageRoot = path.join(root, 'src', 'pages', locale === 'en' ? 'en' : '');
  const candidates = relative
    ? [path.join(pageRoot, relative, 'index.astro'), path.join(pageRoot, `${relative}.astro`)]
    : [path.join(pageRoot, 'index.astro')];
  const pageFile = candidates.find((candidate) => fs.existsSync(candidate));
  if (!pageFile) return { exists: false, reason: 'no static page matches this route' };

  if (url.hash) {
    const source = fs.readFileSync(pageFile, 'utf8');
    const anchor = decodeURIComponent(url.hash.slice(1));
    const anchorPattern = new RegExp(`\\bid=["']${escapeRegExp(anchor)}["']`);
    if (!anchorPattern.test(source)) {
      return { exists: false, reason: `no id="${anchor}" anchor in ${path.relative(root, pageFile)}` };
    }
  }

  return { exists: true };
}

test('home, architecture, and Benchmark links resolve in their own locale', () => {
  for (const page of overviewPages) {
    const source = fs.readFileSync(path.join(root, page.path), 'utf8');
    const links = [...source.matchAll(/href=\{href\('([^']+)'\)\}/g)].map((match) => match[1]);
    assert.ok(links.length >= 3, `${page.path}: expected navigation links`);

    for (const target of links) {
      const result = resolvePageRoute(target, page.locale);
      assert.ok(result.exists, `${page.path}: ${target} — ${result.reason || 'route missing'}`);
    }
  }
});

test('overview pages link to owner sections instead of duplicating long-form details', () => {
  for (const page of overviewPages) {
    const source = fs.readFileSync(path.join(root, page.path), 'utf8');
    if (page.kind === 'architecture') {
      assert.match(source, /components\/sandbox\/#platform-architecture/);
      assert.doesNotMatch(source, /M5 live governed-action|CreateSMContext|<h3>R2-B/);
    } else if (page.kind === 'benchmark') {
      assert.match(source, /components\/sandbox\/#benchmark-framework/);
      assert.match(source, /components\/ca-benchmarks\/#benchmark-assets/);
      assert.match(source, /components\/ca-benchmark-engine\/#evaluation-lifecycle/);
      assert.doesNotMatch(source, /G03|G04\s*\/\s*G05|E00:/);
    } else {
      assert.match(source, /components\/sandbox\/#platform-architecture/);
      assert.doesNotMatch(source, /architecture\/system\/#real-5gc-workflow/);
    }
  }
});
