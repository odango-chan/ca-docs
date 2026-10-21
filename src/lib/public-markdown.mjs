import { marked } from 'marked';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

function sourceUrl(context) {
  const repository = String(context.repository || '');
  const commit = String(context.commit || '');
  const sourcePath = String(context.path || '');
  if (!/^[^/]+\/[^/]+$/.test(repository) || !/^[0-9a-f]{7,40}$/i.test(commit) || !sourcePath) {
    return null;
  }
  return new URL(`https://github.com/${repository}/blob/${commit}/${sourcePath}`);
}

function resolvePublishedUrl(href, context, image = false) {
  if (typeof href !== 'string' || !href.trim()) return null;
  const value = href.trim();
  if (value.startsWith('#')) return value;
  if (value.startsWith('//')) return null;
  if (/^mailto:/i.test(value)) return image ? null : value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      if (image && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  const base = sourceUrl(context);
  if (!base) return null;
  let resolved;
  try {
    resolved = value.startsWith('/')
      ? new URL(`https://github.com/${context.repository}/blob/${context.commit}/${value.replace(/^\/+/, '')}`)
      : new URL(value, base);
  } catch {
    return null;
  }
  if (resolved.origin !== 'https://github.com') return null;
  if (!image) return resolved.href;

  const match = resolved.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/);
  if (!match || `${match[1]}/${match[2]}` !== context.repository) return null;
  return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}${resolved.search}${resolved.hash}`;
}

export function renderPublicMarkdown(markdown, context) {
  const raw = String(markdown || '');
  const heading = raw.match(/^\uFEFF?\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  const title = heading?.[1]?.trim() || String(context.role || 'Documentation').replaceAll('-', ' ');
  const body = heading ? raw.slice(heading[0].length).trimStart() : raw;

  const renderer = new marked.Renderer();
  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = function ({ href, title: linkTitle, tokens }) {
    const safeHref = resolvePublishedUrl(href, context, false);
    const label = this.parser.parseInline(tokens || []);
    if (!safeHref) return label;
    const titleAttribute = linkTitle ? ` title="${escapeHtml(linkTitle)}"` : '';
    return `<a href="${escapeHtml(safeHref)}"${titleAttribute}>${label}</a>`;
  };
  renderer.image = ({ href, title: imageTitle, text }) => {
    const safeHref = resolvePublishedUrl(href, context, true);
    if (!safeHref) return escapeHtml(text || '');
    const titleAttribute = imageTitle ? ` title="${escapeHtml(imageTitle)}"` : '';
    return `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(text || '')}"${titleAttribute} loading="lazy" />`;
  };

  return {
    title,
    html: marked.parse(body, { renderer, async: false }),
  };
}
