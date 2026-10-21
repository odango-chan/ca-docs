import fs from 'node:fs/promises';
import yaml from 'js-yaml';

const registry = yaml.load(await fs.readFile('data/components.yaml', 'utf8'));
const token = process.env.CA_DOCS_SOURCE_TOKEN || '';
if (!token) throw new Error('CA_DOCS_SOURCE_TOKEN is required for live snapshot verification');

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'ca-docs-snapshot-verification',
  Authorization: `Bearer ${token}`,
};

function splitRepository(value) {
  const parts = String(value || '').split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error(`invalid repository identity: ${value}`);
  }
  return { owner: parts[0], repo: parts[1] };
}

async function branchHead(component) {
  const { owner, repo } = splitRepository(component.repository);
  const ref = component.id === 'ca-5gc-sim'
    ? (process.env.CA_5GC_SIM_REF || component.ref || 'main')
    : (component.ref || 'main');
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(ref)}`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`${component.id}: cannot read ${component.repository}@${ref}: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (!/^[0-9a-f]{40}$/i.test(body?.commit?.sha || '')) {
    throw new Error(`${component.id}: GitHub returned no immutable branch-head SHA`);
  }
  return { ref, commit: body.commit.sha };
}

for (const component of (registry.components || []).filter((item) => item.status === 'active')) {
  const snapshotPath = `data/generated/${component.id}.json`;
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
  const head = await branchHead(component);
  if (snapshot.source?.repository !== component.repository) {
    throw new Error(
      `${component.id}: snapshot repository ${snapshot.source?.repository || '(missing)'} ` +
      `does not match registry ${component.repository}`,
    );
  }
  if (snapshot.source?.ref !== head.ref) {
    throw new Error(`${component.id}: snapshot ref ${snapshot.source?.ref || '(missing)'} != live ref ${head.ref}`);
  }
  if (snapshot.source?.commit !== head.commit) {
    throw new Error(`${component.id}: snapshot commit ${snapshot.source?.commit || '(missing)'} != live HEAD ${head.commit}`);
  }
  console.log(`${component.id}: PASS repository=${component.repository} ref=${head.ref} commit=${head.commit}`);
}
