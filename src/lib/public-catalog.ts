import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function loadPublicCatalog() {
  const registry = yaml.load(fs.readFileSync('data/components.yaml', 'utf8'));
  const entries = [];
  for (const component of registry.components || []) {
    if (component.status !== 'active') continue;
    const snapshotPath = path.resolve('data/generated', component.id + '.json');
    if (!fs.existsSync(snapshotPath)) continue;
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    entries.push({ component, snapshot });
  }
  return entries;
}

function getPublishedSources(snapshot, kind) {
  const living = (snapshot.sources || [])
    .filter((source) => source.kind === kind)
    .map((source) => ({ ...source, schemaGroup: 'living' }));
  const released = [];
  for (const release of snapshot.releases || []) {
    for (const contract of release.contracts || []) {
      for (const artifact of contract.artifacts || []) {
        if (artifact.kind !== kind || !artifact.summary) continue;
        released.push({
          ...artifact.summary,
          rawPublicPath: artifact.publicPath,
          sha256: artifact.sha256,
          releaseId: release.releaseId,
          contractId: contract.contractId,
          contractVersion: contract.version,
          lifecycleStatus: contract.lifecycleStatus,
          sourceCommit: contract.sourceCommit,
          schemaGroup: contract.contractId + '@' + contract.version,
        });
      }
    }
  }
  return [...living, ...released];
}

export function getOpenApiSources(snapshot) {
  return getPublishedSources(snapshot, 'openapi');
}

export function getJsonSchemaSources(snapshot) {
  return getPublishedSources(snapshot, 'json-schema');
}
