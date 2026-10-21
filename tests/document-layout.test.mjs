import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'src/styles/global.css'), 'utf8');

test('owner-published Markdown uses the article width for structural blocks', () => {
  assert.match(
    css,
    /\.docs-article \.prose \{\s*width:\s*100%;\s*max-width:\s*none;\s*min-width:\s*0;\s*\}/,
    'the Markdown wrapper must not be constrained to the paragraph reading measure',
  );
  assert.doesNotMatch(
    css,
    /\.docs-article \.prose \{\s*max-width:\s*var\(--reading-width\);\s*\}/,
    'the reading measure must not cap the entire Markdown document',
  );
  assert.match(
    css,
    /\.docs-article \.prose p,\s*\.docs-article \.prose li \{\s*max-width:\s*var\(--reading-width\);\s*\}/,
    'paragraphs and list items should retain a comfortable line length',
  );
});

test('document headings are not constrained by Latin ch-based width caps', () => {
  assert.doesNotMatch(
    css,
    /\.docs-article h1\s*\{[^}]*max-width:\s*\d+ch/,
    'document titles should wrap against the available article width, including CJK text',
  );
  assert.doesNotMatch(
    css,
    /\.home-hero h1\s*\{\s*max-width:\s*18ch/,
    'mobile homepage titles should not receive a second CJK-unfriendly width cap',
  );
});

test('tablet documentation layout uses the available viewport width', () => {
  assert.doesNotMatch(
    css,
    /\.docs-frame\s*\{\s*width:\s*min\(100% - 2rem,\s*900px\)/,
    'the tablet layout must not hard-cap the full sidebar-plus-content frame at 900px',
  );
});

test('superseded documentation redesign layer stays removed', () => {
  assert.doesNotMatch(
    css,
    /Documentation-first redesign: restrained surfaces, clear reading measure, stable navigation/,
    'keep one canonical documentation layout layer instead of appending a second copy',
  );
  assert.match(css, /Full-site finish: semantic navigation, readable long-form content, robust responsive behavior/);
});

test('consolidated layout retains section hierarchy and mobile table overflow', () => {
  assert.match(css, /\.docs-article \.section h2\s*\{/);
  assert.match(css, /\.docs-article \.section h3\s*\{/);
  assert.match(css, /\.docs-article \.section > p\s*\{/);
  assert.match(css, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.component-table \{ display: block; overflow-x: auto; \}/);
});

test('retired generic layout selectors do not leak into the shared site layout', () => {
  assert.doesNotMatch(css, /^\.shell\s*\{/m);
  assert.doesNotMatch(css, /^\.nav-row\s*\{/m);
  assert.doesNotMatch(css, /^nav\s*\{/m);
  assert.doesNotMatch(css, /^main\s*\{/m);
  assert.doesNotMatch(css, /\.component-row/);
  assert.doesNotMatch(css, /\.component-index/);
  assert.doesNotMatch(css, /\.footer-row/);
  assert.doesNotMatch(css, /\.muted-row/);
  assert.doesNotMatch(css, /\.home-secondary/);
  assert.doesNotMatch(css, /\.nav-api/);
});

test('the shared top navigation remains a single horizontal row', () => {
  assert.match(css, /\.top-nav\s*\{[^}]*flex-wrap:\s*nowrap/);
});

test('homepage styling has one canonical definition with explicit mobile overrides', () => {
  assert.doesNotMatch(css, /Home page: documentation index first, decoration second/);
  assert.match(css, /\.home-hero h1\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.home-hero h1 br \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.home-hero h1 \{ max-width: none;/);
});

test('shared primitive selectors have one canonical base definition', () => {
  const selectors = [
    'html {',
    'body {',
    'a {',
    'a:hover {',
    '.site-header {',
    '.brand {',
    '.brand:hover {',
    '.brand-mark {',
    '.language-switch {',
    '.language-switch a {',
    '.language-switch a.active {',
    '.site-footer {',
  ];
  const lines = css.split(String.fromCharCode(10));
  for (const selector of selectors) {
    assert.equal(lines.filter((line) => line.startsWith(selector)).length, 1, 'expected one base definition for ' + selector);
  }
});


test('homepage responsive rules share the canonical 700px breakpoint', () => {
  assert.equal(css.split('@media (max-width: 700px)').length - 1, 1);
  assert.doesNotMatch(css, /Homepage hero: editorial scale/);
});

test('retired component and navigation primitives stay removed', () => {
  for (const selector of ['.component-card', '.component-link', '.pills', '.private-source', '.top-api']) {
    assert.equal(css.includes(selector), false, 'retired selector should not return: ' + selector);
  }
});

test('root typography and design tokens share one canonical root block', () => {
  assert.equal(css.split(':root {').length - 1, 1);
  assert.match(css, /:root \{[^}]*font-family:[^}]*font-synthesis:\s*none/);
  assert.match(css, /:root \{[^}]*--page:\s*#f8f8f5/);
});
