import fs from 'node:fs/promises';
import yaml from 'js-yaml';
import { syncCa5gcSim } from './sync-ca-5gc-sim.mjs';
import { buildCatalogIndex, syncManifest } from './sync-manifest.mjs';
import { syncToolCommon } from './sync-tool-common.mjs';

const registry = yaml.load(await fs.readFile('data/components.yaml', 'utf8'));
const active = (registry.components || []).filter((component) => component.status === 'active');

for (const component of active) {
  // Domain projections preserve the existing component-specific pages. They do
  // not own source resolution, manifest validation, raw publication or releases.
  if (component.id === 'ca-5gc-sim') await syncCa5gcSim(component);
  if (component.id === 'tool-common') await syncToolCommon(component);

  // Every active Owner then goes through the same v1alpha2 publication pipeline.
  await syncManifest(component);
}

await buildCatalogIndex();
