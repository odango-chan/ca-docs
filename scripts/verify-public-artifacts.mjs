import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readPublicFile(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) {
    throw new Error('public artifact path must be absolute within the site: ' + publicPath);
  }
  const relative = publicPath.slice(1);
  const segments = relative.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('unsafe public artifact path: ' + publicPath);
  }
  const root = path.resolve('public');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    throw new Error('public artifact escaped public directory: ' + publicPath);
  }
  return fs.readFile(file);
}

async function assertDigest(publicPath, expected, label) {
  const bytes = await readPublicFile(publicPath);
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(label + ' SHA-256 mismatch at ' + publicPath + ': expected ' + expected + ', got ' + actual);
  }
}

const yaml = await import('js-yaml');
const registry = yaml.load(await fs.readFile('data/components.yaml', 'utf8'));

let checkedSnapshots = 0;
let checkedSources = 0;
let checkedContracts = 0;
let checkedArtifacts = 0;

for (const component of registry.components || []) {
  if (component.status !== 'active') continue;
  const snapshotPath = path.resolve('data/generated', component.id + '.json');
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  if (snapshot.schemaVersion !== 'connectionagent.io/ca-docs-snapshot/v2') {
    throw new Error(component.id + ': snapshot is not CA Docs v2');
  }
  if (snapshot.component !== component.id) {
    throw new Error(component.id + ': snapshot component identity mismatch');
  }

  for (const source of snapshot.sources || []) {
    checkedSources += 1;
    if (source.rawPublicPath) {
      await assertDigest(source.rawPublicPath, source.sha256, component.id + '/' + source.role);
    }
  }

  for (const release of snapshot.releases || []) {
    if (release.publicationStatus === 'WITHDRAWN') {
      if (release.contracts.some((contract) => contract.artifacts.length !== 0 || contract.provenancePath !== null)) {
        throw new Error(component.id + '/' + release.releaseId + ': withdrawn release must be a tombstone without published artifact links');
      }
      continue;
    }
    if (!['PUBLISHED', 'PREVIEW'].includes(release.publicationStatus)) {
      throw new Error(component.id + '/' + release.releaseId + ': invalid publication status');
    }
    await assertDigest(
      release.releaseRecord.publicPath,
      release.releaseRecord.sha256,
      component.id + '/' + release.releaseId + '/release-record',
    );
    for (const contract of release.contracts || []) {
      checkedContracts += 1;
      if (!/^[0-9a-f]{40}$/.test(contract.sourceCommit || '')) {
        throw new Error(component.id + '/' + contract.contractId + ': sourceCommit is not immutable');
      }
      await assertDigest(
        contract.provenancePath,
        contract.provenanceSha256,
        component.id + '/' + contract.contractId + '/provenance',
      );
      const provenanceBytes = await readPublicFile(contract.provenancePath);
      const provenance = JSON.parse(provenanceBytes.toString('utf8'));
      if (
        provenance.component !== component.id ||
        provenance.releaseId !== release.releaseId ||
        provenance.publicationStatus !== release.publicationStatus ||
        provenance.contractId !== contract.contractId ||
        provenance.version !== contract.version ||
        provenance.publicationStatus !== contract.publicationStatus ||
        contract.publicationStatus !== release.publicationStatus ||
        provenance.sourceCommit !== contract.sourceCommit
      ) {
        throw new Error(component.id + '/' + contract.contractId + ': provenance identity mismatch');
      }
      if (provenance.artifacts.length !== contract.artifacts.length) {
        throw new Error(component.id + '/' + contract.contractId + ': provenance artifact count mismatch');
      }
      if (
        provenance.releaseRecord.sourcePath !== release.releaseRecord.sourcePath ||
        provenance.releaseRecord.publicPath !== release.releaseRecord.publicPath ||
        provenance.releaseRecord.sha256 !== release.releaseRecord.sha256 ||
        provenance.releaseRecord.sourceCommit !== release.releaseRecord.sourceCommit
      ) {
        throw new Error(component.id + '/' + contract.contractId + ': release record provenance mismatch');
      }
      for (let artifactIndex = 0; artifactIndex < contract.artifacts.length; artifactIndex += 1) {
        const artifact = contract.artifacts[artifactIndex];
        const provenanceArtifact = provenance.artifacts[artifactIndex];
        if (
          provenanceArtifact.kind !== artifact.kind ||
          provenanceArtifact.sourcePath !== artifact.sourcePath ||
          provenanceArtifact.mediaType !== artifact.mediaType ||
          provenanceArtifact.publicPath !== artifact.publicPath ||
          provenanceArtifact.sha256 !== artifact.sha256 ||
          JSON.stringify(provenanceArtifact.publish) !== JSON.stringify(artifact.publish)
        ) {
          throw new Error(component.id + '/' + contract.contractId + ': artifact provenance mismatch at index ' + artifactIndex);
        }
        checkedArtifacts += 1;
        if (!artifact.publish.includes('download')) {
          throw new Error(component.id + '/' + contract.contractId + ': artifact is not explicitly downloadable');
        }
        await assertDigest(
          artifact.publicPath,
          artifact.sha256,
          component.id + '/' + contract.contractId + '/' + artifact.sourcePath,
        );
        if (artifact.summary) {
          if (
            artifact.summary.kind !== artifact.kind ||
            artifact.summary.sha256 !== artifact.sha256 ||
            artifact.summary.rawPublicPath !== artifact.publicPath
          ) {
            throw new Error(component.id + '/' + contract.contractId + ': rendered artifact summary mismatch');
          }
        }
      }
    }
  }
  checkedSnapshots += 1;
}

console.log(
  'Public artifact verification PASS: ' +
    checkedSnapshots +
    ' snapshots, ' +
    checkedSources +
    ' sources, ' +
    checkedContracts +
    ' contracts, ' +
    checkedArtifacts +
    ' released artifacts.',
);
