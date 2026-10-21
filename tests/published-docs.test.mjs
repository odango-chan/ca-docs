import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';
import { renderPublicMarkdown } from '../src/lib/public-markdown.mjs';

const root = process.cwd();
const registry = yaml.load(fs.readFileSync(path.join(root, 'data/components.yaml'), 'utf8'));
const publishedComponents = (registry.components || []).filter(
  (component) => component.status === 'active' && component.sync === 'manifest',
);

function siteRouteExists(urlString) {
  const url = new URL(urlString);
  if (url.origin !== 'https://odango-chan.github.io' || !url.pathname.startsWith('/ca-docs/')) {
    return true;
  }

  let route = url.pathname.slice('/ca-docs'.length);
  const localePrefix = route.startsWith('/en/') || route === '/en' ? 'en' : '';
  if (localePrefix) route = route === '/en' ? '/' : route.slice(3);
  const pageRoot = path.join(root, 'src', 'pages', localePrefix);
  const relative = route.replace(/^\/+|\/+$/g, '');
  const candidates = relative
    ? [
        path.join(pageRoot, relative, 'index.astro'),
        path.join(pageRoot, `${relative}.astro`),
      ]
    : [path.join(pageRoot, 'index.astro')];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

test('active manifest components have immutable, owner-matched published snapshots', () => {
  assert.ok(publishedComponents.length > 0, 'expected at least one active manifest component');

  for (const component of publishedComponents) {
    const snapshotPath = path.join(root, 'data', 'generated', `${component.id}.json`);
    assert.ok(fs.existsSync(snapshotPath), `${component.id}: snapshot is missing`);

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    assert.equal(snapshot.component, component.id);
    assert.equal(snapshot.source?.repository, component.repository);
    assert.equal(snapshot.source?.publicDocsManifest, component.manifest);
    assert.match(snapshot.source?.commit || '', /^[0-9a-f]{40}$/i, `${component.id}: source commit must be immutable`);
  }
});

test('published Markdown snapshots contain renderable bodies for both site locales', () => {
  for (const component of publishedComponents) {
    const snapshotPath = path.join(root, 'data', 'generated', `${component.id}.json`);
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const markdownSources = (snapshot.sources || []).filter((source) => source.kind === 'markdown');

    if (markdownSources.length === 0) continue;

    const languages = new Set();
    for (const source of markdownSources) {
      assert.ok(source.path && !source.path.startsWith('/') && !source.path.split('/').includes('..'),
        `${component.id}: invalid published source path ${source.path}`);
      assert.ok(['zh', 'en'].includes(source.language),
        `${component.id}: Markdown source ${source.path} must declare zh or en language`);
      assert.equal(typeof source.body, 'string', `${component.id}: ${source.path} has no published body`);
      assert.ok(source.body.trim().length > 0, `${component.id}: ${source.path} body is empty`);

      languages.add(source.language);
      const rendered = renderPublicMarkdown(source.body, {
        ...snapshot.source,
        path: source.path,
        role: source.role,
      });
      assert.ok(rendered.title.trim(), `${component.id}: ${source.path} has no document title`);
      assert.match(rendered.html, /<h[2-6]\b/, `${component.id}: ${source.path} has no rendered section headings`);
      assert.doesNotMatch(rendered.html, /<script(?:\s|>)/i, `${component.id}: unsafe HTML reached rendered output`);

      for (const match of source.body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
        const href = match[1].trim().replace(/^<|>$/g, '');
        if (/^https:\/\/odango-chan\.github\.io\/ca-docs(?:\/|$)/i.test(href)) {
          assert.ok(siteRouteExists(href), `${component.id}: published Markdown links to a missing site route: ${href}`);
        }
      }
    }

    assert.ok(languages.has('zh'), `${component.id}: missing Chinese Markdown publication`);
    assert.ok(languages.has('en'), `${component.id}: missing English Markdown publication`);
  }
});
