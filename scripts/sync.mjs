import fs from 'node:fs/promises';
import yaml from 'js-yaml';

const registry = yaml.load(await fs.readFile('data/components.yaml', 'utf8'));
const active = (registry.components || []).filter((component) => component.status === 'active');

for (const component of active) {
  switch (component.id) {
    case 'ca-5gc-sim':
      await import('./sync-ca-5gc-sim.mjs');
      break;
    default:
      throw new Error(`no sync adapter registered for ${component.id}`);
  }
}
