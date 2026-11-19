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
