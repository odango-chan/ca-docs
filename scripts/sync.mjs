import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { syncManifest } from './sync-manifest.mjs';

const registry = yaml.load(await fs.readFile('data/components.yaml', 'utf8'));
const active = (registry.components || []).filter((component) => component.status === 'active');

for (const component of active) {
  await syncManifest(component);
}
