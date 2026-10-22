import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const css = fs.readFileSync(path.join(root, 'src/styles/global.css'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/layouts/SiteLayout.astro'), 'utf8');
const architecturePage = fs.readFileSync(path.join(root, 'src/pages/architecture/system.astro'), 'utf8');
const architecturePageEn = fs.readFileSync(path.join(root, 'src/pages/en/architecture/system.astro'), 'utf8');
const benchmarkPage = fs.readFileSync(path.join(root, 'src/pages/benchmark/index.astro'), 'utf8');
const benchmarkPageEn = fs.readFileSync(path.join(root, 'src/pages/en/benchmark/index.astro'), 'utf8');

function listCssRulesByContext(source) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const frames = [];
  const contexts = [];
  let start = 0;

  for (let i = 0; i < withoutComments.length; i += 1) {
    if (withoutComments[i] === '{') {
      const prelude = withoutComments.slice(start, i).trim().replace(/\s+/g, ' ');
      if (prelude.startsWith('@')) {
        frames.push({ kind: 'at-rule' });
        contexts.push(prelude);
      } else {
        rules.push({ selector: prelude, context: contexts.join(' > ') });
        frames.push({ kind: 'rule' });
      }
      start = i + 1;
    } else if (withoutComments[i] === '}') {
      const frame = frames.pop();
      if (frame?.kind === 'at-rule') contexts.pop();
      start = i + 1;
    }
  }

  return rules;
}

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

test('generic grid and card rules fully overridden by the article layout stay removed', () => {
  for (const selector of [
    /^\\.section\\s*\\{/m,
    /^\\.section-head\\s*\\{/m,
    /^\\.grid\\s*\\{/m,
    /^\\.card\\s*\\{/m,
    /^\\.card\\.wide\\s*\\{/m,
    /^\\.card p\\s*\\{/m,
    /^\\.stats\\s*\\{/m,
    /\\.docs-article \\.grid\\s*\\{/,
  ]) {
    assert.doesNotMatch(css, selector, 'overridden generic selector should not return: ' + selector);
  }
});

test('760px responsive overrides are consolidated after their base styles', () => {
  assert.equal(css.split('@media (max-width: 760px)').length - 1, 1);
  const responsive = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(responsive, /\.cap-item \{ grid-template-columns: 1fr; gap: 0\.45rem; \}/);
  assert.match(responsive, /\.source-status \{ align-items: flex-start; flex-direction: column; \}/);
  assert.match(responsive, /\.doc-row \{ align-items: flex-start; \}/);
});

test('shared content rules keep only declarations that survive article overrides', () => {
  assert.match(css, /^\.hero \{\s*display: grid;\s*\}/m);
  assert.match(css, /^\.lede \{\s*margin: 0;\s*\}/m);
  assert.match(css, /^\.section-head p \{\s*max-width: 660px;\s*\}/m);
  assert.match(css, /^\.docs-article \.api-heading \{[^}]*margin-bottom: \.9rem;/m);
  for (const selector of [
    /^\.page-tabs\s*\{/m,
    /^\.api-card\s*\{/m,
    /^\.prose\s*\{/m,
    /^\.prose h1\s*\{/m,
    /^\.prose h2\s*\{/m,
    /^\.prose ul\s*,\s*$/m,
    /^\.prose table\s*\{/m,
  ]) {
    assert.doesNotMatch(css, selector, 'shadowed base selector should not return: ' + selector);
  }
});

test('API presentation keeps active styles in the shared article layer', () => {
  assert.match(css, /^\.docs-article \.api-heading \{[^}]*margin-bottom: \.9rem;/m);
  assert.match(css, /^\.docs-article \.api-meta \{[^}]*align-items: center;/m);
  assert.match(css, /^\.api-example summary \{\s*color: var\(--accent\);\s*\}/m);
  assert.doesNotMatch(css, /^\.api-heading\s*\{/m);
  assert.doesNotMatch(css, /^\.api-meta\s*\{/m);
  assert.doesNotMatch(css, /^\.response-row\s*\{/m);
  assert.doesNotMatch(css, /^\.api-example\s*\{/m);
  assert.doesNotMatch(css, /^\.api-example pre\s*\{/m);
  assert.doesNotMatch(css, /^\.response-contract table\s*\{/m);
  assert.doesNotMatch(css, /^\.docs-article \.api-block \{/m);
});


test('CSS selectors are not duplicated within the same cascade context', () => {
  const seen = new Set();
  for (const { selector, context } of listCssRulesByContext(css)) {
    const key = context + String.fromCharCode(0) + selector;
    assert.equal(seen.has(key), false, 'duplicate selector "' + selector + '" in ' + (context || 'base stylesheet'));
    seen.add(key);
  }
});


test('architecture and evaluation overview pages use the available content width', () => {
  assert.match(layout, /'docs-article-wide': wide/);
  assert.match(css, /\.docs-article\.docs-article-wide \{\s*width: 100%;\s*max-width: none;\s*\}/);
  for (const [name, source] of [
    ['Chinese architecture overview', architecturePage],
    ['English architecture overview', architecturePageEn],
    ['Chinese Benchmark overview', benchmarkPage],
    ['English Benchmark overview', benchmarkPageEn],
  ]) {
    assert.match(source, /<SiteLayout[^>]*wide=\{true\}/s, name + ' must opt into the wide article layout');
  }
});
