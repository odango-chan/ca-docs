import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPublicMarkdown } from '../src/lib/public-markdown.mjs';

const context = {
  repository: 'odango-chan/sandbox',
  commit: 'abcdef1234567890',
  path: 'docs/public/architecture.md',
  role: 'platform-architecture',
};

test('renders selected Markdown as long-form HTML and extracts its leading title', () => {
  const rendered = renderPublicMarkdown(
    '# Sandbox architecture\n\nA short introduction.\n\n## Responsibilities\n\n- Agent\n- Environment\n',
    context,
  );
  assert.equal(rendered.title, 'Sandbox architecture');
  assert.match(rendered.html, /<p>A short introduction<\/p>/);
  assert.match(rendered.html, /<h2>Responsibilities<\/h2>/);
  assert.match(rendered.html, /<li>Agent<\/li>/);
});

test('escapes raw HTML and blocks unsafe link schemes', () => {
  const rendered = renderPublicMarkdown(
    '# Safe page\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29)\n',
    context,
  );
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.doesNotMatch(rendered.html, /href="javascript:/i);
});

test('resolves relative links and images against the pinned owner revision', () => {
  const rendered = renderPublicMarkdown(
    '# Links\n\n[architecture](../architecture/sandbox.md)\n\n![diagram](./assets/overview.svg)\n',
    context,
  );
  assert.match(rendered.html, /https:\/\/github\.com\/odango-chan\/sandbox\/blob\/abcdef1234567890\/docs\/architecture\/sandbox\.md/);
  assert.match(rendered.html, /https:\/\/raw\.githubusercontent\.com\/odango-chan\/sandbox\/abcdef1234567890\/docs\/public\/assets\/overview\.svg/);
});
