import { isIP } from 'node:net';

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0);
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase();
  return value === '::' || value === '::1' || value.startsWith('fc') ||
    value.startsWith('fd') || value.startsWith('fe8') ||
    value.startsWith('fe9') || value.startsWith('fea') ||
    value.startsWith('feb') || value.startsWith('ff');
}

export function assertPublicOpenApiServers(document, sourcePath = '(OpenAPI)') {
  const servers = [...(document.servers || [])];
  for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
    servers.push(...(pathItem?.servers || []));
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']) {
      servers.push(...(pathItem?.[method]?.servers || []));
    }
  }

  for (const server of servers) {
    const raw = server?.url;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error(`invalid OpenAPI server URL in ${sourcePath}`);
    }
    const value = raw.trim();
    if (value.startsWith('/')) continue;

    let parsed;
    try {
      parsed = new URL(value.replace(/\{[^}]+\}/g, 'placeholder'));
    } catch {
      throw new Error(`unresolvable OpenAPI server URL in ${sourcePath}: ${value}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`non-HTTP OpenAPI server URL is not publishable in ${sourcePath}: ${value}`);
    }

    const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const ipVersion = isIP(host);
    const privateHost = host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      host.endsWith('.cluster.local') || host.endsWith('.svc') ||
      host.endsWith('.test') || host.endsWith('.example') ||
      host.endsWith('.invalid') || !host.includes('.') ||
      (ipVersion === 4 && isPrivateIpv4(host)) ||
      (ipVersion === 6 && isPrivateIpv6(host));
    if (privateHost) {
      throw new Error(`private or placeholder OpenAPI server URL is not publishable in ${sourcePath}: ${value}`);
    }
  }
}
