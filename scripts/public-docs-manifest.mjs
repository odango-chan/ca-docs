import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';

export const PUBLIC_DOCS_API_VERSION = 'connectionagent.io/v1alpha2';

const schemaPath = fileURLToPath(new URL('../schemas/v1alpha2/public-docs-manifest.schema.yaml', import.meta.url));
const schema = yaml.load(await fs.readFile(schemaPath, 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

export function validateSourcePath(sourcePath) {
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  if (sourcePath.startsWith('/') || sourcePath.includes(String.fromCharCode(92)) || /^[A-Za-z]:/.test(sourcePath)) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  const segments = sourcePath.split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  if (path.posix.normalize(sourcePath) !== sourcePath || /[\u0000-\u001f]/.test(sourcePath)) {
    throw new Error(`invalid public-doc source path ${sourcePath}`);
  }
  return sourcePath;
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

export function validateManifest(manifest, componentId) {
  if (!validateSchema(manifest)) {
    const detail = (validateSchema.errors || [])
      .map((error) => `${error.instancePath || '/'} ${error.message}`)
      .join('; ');
    throw new Error(`invalid PublicDocsManifest v1alpha2: ${detail}`);
  }
  if (manifest.apiVersion !== PUBLIC_DOCS_API_VERSION) {
    throw new Error(`unsupported PublicDocsManifest apiVersion ${manifest.apiVersion}`);
  }
  if (manifest.component !== componentId) {
    throw new Error(`manifest component ${manifest.component} does not match registry ${componentId}`);
  }

  for (const source of manifest.sources) validateSourcePath(source.path);
  unique(manifest.sources.map((source) => source.role).filter(Boolean), 'source role');
  unique(manifest.sources.map((source) => `${source.kind}:${source.path}`), 'source path');

  const releaseIds = [];
  const contractVersions = [];
  const latestContracts = [];
  for (const release of manifest.releases) {
    releaseIds.push(release.releaseId);
    validateSourcePath(release.releaseRecord.path);
    for (const contract of release.contracts) {
      const identity = `${contract.contractId}@${contract.version}`;
      contractVersions.push(identity);
      if (contract.latest === true) latestContracts.push(contract.contractId);
      unique(contract.artifacts.map((artifact) => artifact.path), `artifact path in ${identity}`);
      for (const artifact of contract.artifacts) validateSourcePath(artifact.path);
    }
  }
  unique(releaseIds, 'releaseId');
  unique(contractVersions, 'contract version');
  unique(latestContracts, 'latest contract pointer');
  return manifest;
}

export function parseManifest(manifestText, componentId) {
  let manifest;
  try {
    manifest = yaml.load(manifestText);
  } catch (error) {
    throw new Error(`invalid PublicDocsManifest YAML: ${error.message}`);
  }
  return validateManifest(manifest, componentId);
}
